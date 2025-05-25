import Editor from './editor.js';

const toggles = [
  {
    tag: 'em',
    label: 'Italic'
  },
  {
    tag: 'strong',
    label: 'Bold'
  }
];

const styles = [
  {
    tag: 'p',
    label: 'Paragraph'
  },
  {
    tag: 'h1',
    label: 'Heading 1'
  },
  {
    tag: 'h2',
    label: 'Heading 2'
  },
  {
    tag: 'h3',
    label: 'Heading 3'
  },
  {
    tag: 'h4',
    label: 'Heading 4'
  },
  {
    tag: 'h5',
    label: 'Heading 5'
  },
  {
    tag: 'h6',
    label: 'Heading 6'
  },
  {
    tag: 'ul',
    label: 'Bulleted List'
  },
  {
    tag: 'ol',
    label: 'Numbered List'
  }
];

const editorEl = document.querySelector('#editor');
const controlsEl = document.querySelector('#controls');

const editor = new Editor(editorEl, { controlsEl, styles, toggles });
