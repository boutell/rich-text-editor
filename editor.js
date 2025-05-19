const zws = '\u200B';

const isMac = navigator.platform.toLowerCase().includes('mac');
const meta = isMac ? 'metaKey' : 'ctrlKey';

export default class Editor {
  constructor(editorEl, { styles, toggles, controlsEl }) {
    console.log('controlsEl was:', controlsEl);
    this.editor = editorEl;
    this.editor.setAttribute('contenteditable', 'true');
    this.styles = styles || [
      {
        tag: 'p',
        label: 'Paragraph'
      }
    ];
    this.toggles = toggles || [];
    this.controls = controlsEl;

    this.setupStyleMenu();
    this.setupToggles();
    this.attachEvents();
  }

  setupStyleMenu() {
    this.styleMenu = document.createElement('select');
    for (const style of this.styles) {
      const option = document.createElement('option');
      option.setAttribute('value', style.tag);
      option.innerText = style.label;
      this.styleMenu.append(option);
    }

    this.styleMenu.addEventListener('change', e => {
      this.preserveSelectionByCharacterOffset(() => {
        const tag = e.target.value;
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const blocks = new Set();

        const walker = document.createTreeWalker(
          this.editor,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
              if (!this.editor.contains(node)) return NodeFilter.FILTER_REJECT;
              if (!/^P|H[1-6]$/.test(node.tagName)) return NodeFilter.FILTER_SKIP;
              if (node === this.editor) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        if (sel.isCollapsed) {
          const zwsNode = document.createTextNode(zws);
          range.insertNode(zwsNode);
          sel.collapse(zwsNode, 1);
        }

        let node = walker.nextNode();
        while (node) {
          blocks.add(node);
          node = walker.nextNode();
        }

        for (const oldBlock of blocks) {
          if (oldBlock.tagName.toLowerCase() === tag) continue;
          const newBlock = document.createElement(tag);
          while (oldBlock.firstChild) {
            newBlock.appendChild(oldBlock.firstChild);
          }
          oldBlock.replaceWith(newBlock);
        }

        this.editor.normalize();
      });
    });
    this.controls.appendChild(this.styleMenu);
  }

  setupToggles() {
    for (const toggle of this.toggles) {
      const button = document.createElement('button');
      button.innerText = toggle.label;
      button.addEventListener('click', () => {
        this.toggle(toggle.tag);
      });
      this.controls.appendChild(button);
    }
  }

  updateStyleMenu() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const blocks = new Set();

    const walker = document.createTreeWalker(
      this.editor,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (!this.editor.contains(node)) return NodeFilter.FILTER_REJECT;
          if (!/^P|H[1-6]$/.test(node.tagName)) return NodeFilter.FILTER_SKIP;
          if (node === this.editor) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node = walker.nextNode();
    while (node) {
      blocks.add(node.tagName.toLowerCase());
      node = walker.nextNode();
    }

    const existing = this.styleMenu.querySelector('[value="_multiple"]');
    if (existing) existing.remove();

    if (blocks.size === 1) {
      this.styleMenu.value = [...blocks][0];
    } else if (blocks.size > 1) {
      const option = document.createElement('option');
      option.value = '_multiple';
      option.textContent = 'Multiple Styles';
      option.disabled = true;
      option.selected = true;
      this.styleMenu.prepend(option);
    } else {
      this.styleMenu.value = 'p';
    }
  }

  attachEvents() {
    document.addEventListener('selectionchange', () => this.updateStyleMenu());

    this.editor.addEventListener('keydown', (e) => {
      const sel = window.getSelection();

      if (e.key === 'ArrowLeft') {
        skipZWS('left');
      } else if (e.key === 'ArrowRight') {
        skipZWS('right');
      } else if (e[meta] && e.key === 'b') {
        e.preventDefault();
        toggle(this.editor, 'strong');
      } else if (e[meta] && e.key === 'i') {
        e.preventDefault();
        toggle(this.editor, 'em');
      } else if (e.key === 'Backspace') {
        removeZWSLeft();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const selectedTag = this.styleMenu.value || 'p';

        let currentBlock = range.startContainer;
        while (
          currentBlock &&
          currentBlock !== this.editor &&
          !/^P|H[1-6]$/i.test(currentBlock.tagName)
        ) {
          currentBlock = currentBlock.parentNode;
        }

        if (!currentBlock || currentBlock === this.editor) return;

        const afterRange = range.cloneRange();
        afterRange.setEndAfter(currentBlock);

        const fragment = afterRange.extractContents();
        const newBlock = document.createElement(selectedTag);
        const zwsNode = document.createTextNode(zws);
        newBlock.appendChild(zwsNode);
        newBlock.appendChild(fragment);

        if (currentBlock.nextSibling) {
          currentBlock.parentNode.insertBefore(newBlock, currentBlock.nextSibling);
        } else {
          currentBlock.parentNode.appendChild(newBlock);
        }

        const newRange = document.createRange();
        newRange.setStart(zwsNode, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        this.editor.normalize();
      }
    });
  }
  toggle(tagname) {
    this.preserveSelectionByCharacterOffset(() => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return toggleInlineTag(range, tagname);
      }
    });
  }

  preserveSelectionByCharacterOffset(fn) {
    const container = this.editor;
    if (!container || container.nodeType !== 1 || !container.isConnected) return;

    const offsets = getCharacterOffsets(container);
    if (!offsets) {
      fn();
      return;
    }

    if (fn() === false) {
      return;
    }

    restoreSelectionFromOffsets(container, offsets.start, offsets.end);
  }

}

function toggleInlineTag(range, tagName) {
  if (!range) return;
  const textNodes = collectTextNodes(range);
  const allInside = [...textNodes].every(node => isInsideTag(node, tagName));
  if (range.collapsed) return toggleWhenCollapsed(range, tagName);
  else if (allInside) return unwrapTagInRange(range, textNodes, tagName);
  else return wrapRangeInTag(range, tagName);
}

function toggleWhenCollapsed(range, tagName) {
  const inside = isInsideTag(range.startContainer, tagName);
  if (inside) {
    const strong = findClosestTag(range.startContainer, tagName);
    const parent = strong.parentNode;
    const zwsNode = document.createTextNode(zws);
    parent.insertBefore(zwsNode, strong.nextSibling);
    const newRange = document.createRange();
    newRange.setStart(zwsNode, 1);
    newRange.setEnd(zwsNode, 1);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
    return false;
  }

  const wrapper = document.createElement(tagName);
  const zwsNode = document.createTextNode(zws);
  wrapper.appendChild(zwsNode);
  range.insertNode(wrapper);
  range.setStart(zwsNode, 1);
  range.setEnd(zwsNode, 1);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return false;
}

function wrapRangeInTag(range, tagName) {
  const textNodes = collectTextNodes(range);

  for (const textNode of textNodes) {
    if (isInsideTag(textNode, tagName)) continue;

    let startOffset = 0;
    let endOffset = textNode.length;

    if (textNode === range.startContainer) startOffset = range.startOffset;
    if (textNode === range.endContainer) endOffset = range.endOffset;
    if (startOffset >= endOffset) continue;

    let middle = textNode;

    if (endOffset < middle.length) {
      middle.splitText(endOffset);
    }

    if (startOffset > 0) {
      middle = middle.splitText(startOffset);
    }

    const wrapper = document.createElement(tagName);
    wrapper.textContent = middle.textContent;
    middle.parentNode.replaceChild(wrapper, middle);

    const next = wrapper.nextSibling;
    if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === tagName.toUpperCase()) {
      while (next.firstChild) wrapper.appendChild(next.firstChild);
      next.remove();
    }

    const prev = wrapper.previousSibling;
    if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.tagName === tagName.toUpperCase()) {
      while (wrapper.firstChild) prev.appendChild(wrapper.firstChild);
      wrapper.remove();
    }
  }

  normalizeRangeContainer(range);
}

function unwrapTagInRange(range, textNodes, tagName) {
  tagName = tagName.toUpperCase();
  const seen = new Set();

  for (const textNode of textNodes) {
    if (seen.has(textNode)) continue;
    seen.add(textNode);

    let startOffset = 0;
    let endOffset = textNode.length;

    if (textNode === range.startContainer) startOffset = range.startOffset;
    if (textNode === range.endContainer) endOffset = range.endOffset;
    if (startOffset >= endOffset) continue;

    let selected = textNode;

    if (endOffset < selected.length) {
      selected.splitText(endOffset);
    }
    if (startOffset > 0) {
      selected = selected.splitText(startOffset);
    }

    const outerTag = findClosestTag(selected, tagName);
    if (!outerTag) continue;

    const outerParent = outerTag.parentNode;
    const selectedChild = getChildOfAncestor(selected, outerTag);

    const beforeTag = outerTag.cloneNode(false);
    const afterTag = outerTag.cloneNode(false);

    let state = 'before';
    for (const child of [...outerTag.childNodes]) {
      if (child === selectedChild) {
        state = 'after';
        continue;
      }
      const clone = child.cloneNode(true);
      (state === 'before' ? beforeTag : afterTag).appendChild(clone);
    }

    const selectedParts = splitWrapperForSelectedNode(selectedChild, selected);

    const fragments = [];
    if (beforeTag.hasChildNodes()) fragments.push(beforeTag);
    fragments.push(...selectedParts.unwrapped);
    if (afterTag.hasChildNodes()) fragments.push(afterTag);

    const merged = [];
    for (const frag of fragments) {
      const last = merged[merged.length - 1];
      if (
        last &&
        frag.tagName &&
        last.tagName === frag.tagName &&
        last.tagName === tagName
      ) {
        while (frag.firstChild) last.appendChild(frag.firstChild);
      } else {
        merged.push(frag);
      }
    }

    for (const el of merged) {
      outerParent.insertBefore(el, outerTag);
    }
    outerTag.remove();
  }

  normalizeRangeContainer(range);
}

function splitWrapperForSelectedNode(wrapper, selected) {
  if (wrapper === selected) {
    return {
      unwrapped: [document.createTextNode(selected.textContent)]
    };
  }

  const tagName = wrapper.tagName;
  const before = wrapper.cloneNode(false);
  const middle = wrapper.cloneNode(false);
  const after = wrapper.cloneNode(false);

  let state = 'before';
  for (const child of [...wrapper.childNodes]) {
    if (child === selected) {
      middle.appendChild(document.createTextNode(child.textContent));
      state = 'after';
      continue;
    }
    const clone = child.cloneNode(true);
    if (state === 'before') before.appendChild(clone);
    else after.appendChild(clone);
  }

  const output = [];

  if (before.hasChildNodes()) {
    const outer = wrapper.parentNode.cloneNode(false);
    outer.appendChild(before);
    output.push(outer);
  }

  output.push(middle);

  if (after.hasChildNodes()) {
    const outer = wrapper.parentNode.cloneNode(false);
    outer.appendChild(after);
    output.push(outer);
  }

  return { unwrapped: output };
}

function collectTextNodes(range) {
  const nodes = new Set();

  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    nodes.add(range.startContainer);
  } else {
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node =>
          range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      }
    );
    let node = walker.nextNode();
    while (node) {
      nodes.add(node);
      node = walker.nextNode();
    }
  }

  return nodes;
}

function isInsideTag(node, tagName) {
  let current = node.parentNode;
  tagName = tagName.toUpperCase();
  while (current) {
    if (current.tagName === tagName) return true;
    current = current.parentNode;
  }
  return false;
}

function findClosestTag(node, tagName) {
  let current = node.parentNode;
  tagName = tagName.toUpperCase();
  while (current) {
    if (current.tagName === tagName) return current;
    current = current.parentNode;
  }
  return null;
}

function normalizeRangeContainer(range) {
  let el = range.commonAncestorContainer;
  while (el && el.nodeType !== 1) {
    el = el.parentNode;
  }
  if (el) el.normalize();
}

function getChildOfAncestor(node, ancestor) {
  let current = node;
  while (current && current.parentNode !== ancestor) {
    current = current.parentNode;
  }
  return current;
}

function getCharacterOffsets(container) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  const startRange = document.createRange();
  startRange.setStart(container, 0);
  startRange.setEnd(range.startContainer, range.startOffset);
  const start = getRangeTextLength(startRange);

  const endRange = document.createRange();
  endRange.setStart(container, 0);
  endRange.setEnd(range.endContainer, range.endOffset);
  const end = getRangeTextLength(endRange);

  return { start, end };
}

function getRangeTextLength(range) {
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node =>
        range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  );

  let length = 0;
  let node;
  while ((node = walker.nextNode())) {
    const nodeRange = range.cloneRange();
    nodeRange.selectNodeContents(node);

    if (range.startContainer === node) {
      nodeRange.setStart(node, range.startOffset);
    }
    if (range.endContainer === node) {
      nodeRange.setEnd(node, range.endOffset);
    }

    length += nodeRange.toString().length;
  }

  return length;
}

function restoreSelectionFromOffsets(container, startOffset, endOffset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode = null, endNode = null;
  let startNodeOffset = 0, endNodeOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const len = node.textContent.length;

    if (!startNode && currentOffset + len >= startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && currentOffset + len >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset += len;
  }

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    if (
      range.collapsed &&
      range.startContainer.nodeType === Node.TEXT_NODE &&
      range.startContainer.nodeValue === zws &&
      range.startOffset === 0
    ) {
      range.setStart(range.startContainer, 1);
      range.setEnd(range.startContainer, 1);
      sel.removeAllRanges();
      sel.addRange(range);
    }    
  }
}

function skipZWS(dir) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  const collapsed = range.collapsed;
  const isLeft = dir === 'left';

  const pos = isLeft
    ? findTextNodeBackward(sel.focusNode, sel.focusOffset)
    : findTextNodeForward(sel.focusNode, sel.focusOffset);

  if (!pos.node) return;

  const { node: txt, offset: off } = pos;

  const isZWS = isLeft
    ? (off > 0 && txt.nodeValue[off - 1] === zws)
    : (off < txt.nodeValue.length && txt.nodeValue[off] === zws);

  if (!isZWS) return;

  const newOffset = isLeft ? off - 1 : off + 1;
  const newRange = document.createRange();

  if (collapsed) {
    newRange.setStart(txt, newOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } else {
    sel.extend(txt, newOffset);
  }
}

function findTextNodeBackward(node, offset) {
  if (node.nodeType === Node.TEXT_NODE && offset > 0) {
    return { node, offset };
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  walker.currentNode = node;
  while (walker.previousNode()) {
    const n = walker.currentNode;
    const len = n.nodeValue.length;
    if (len > 0) return { node: n, offset: len };
  }
  return { node: null, offset: 0 };
}

function findTextNodeForward(node, offset) {
  if (node.nodeType === Node.TEXT_NODE && offset < node.nodeValue.length) {
    return { node, offset };
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  walker.currentNode = node;
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeValue.length > 0) return { node: n, offset: 0 };
  }
  return { node: null, offset: 0 };
}

function removeZWSLeft() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;

  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return;

  const text = startContainer.nodeValue;
  if (startOffset === 0) return;

  if (text[startOffset - 1] === zws) {
    const updated = text.slice(0, startOffset - 1) + text.slice(startOffset);
    startContainer.nodeValue = updated;

    const newOffset = startOffset - 1;
    const newRange = document.createRange();
    newRange.setStart(startContainer, newOffset);
    newRange.setEnd(startContainer, newOffset);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}
