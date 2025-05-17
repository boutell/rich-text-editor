export default function (el, options) {
  const editor = document.createElement('div');
  editor.contentEditable = true;
  editor.style.border = '1px solid #ccc';
  editor.style.padding = '10px';
  editor.style.minHeight = '100px';
  el.appendChild(editor);

  const toolbar = document.createElement('div');
  toolbar.style.marginBottom = '10px';
  el.insertBefore(toolbar, editor);

  const buttons = [
    { label: 'Bold', mark: 'strong' },
    { label: 'Italic', mark: 'em' },
    { label: 'Underline', mark: 'u' },
    { label: 'Strike', mark: 's' }
  ];

  buttons.forEach(({ label, mark }) => {
    const button = document.createElement('button');
    button.innerText = label;
    button.addEventListener('click', () => {
      if (mark) {
        applyMark(mark);
      }
    });
    toolbar.append(button);
  });

  function applyMark(mark) {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    if (range.startContainer.closest(mark)) {
      return removeMark(mark);
    }
  }

  return {
    getContent() {
      return editor.innerHTML;
    },
    setContent(content) {
      editor.innerHTML = content;
    },
  };
}