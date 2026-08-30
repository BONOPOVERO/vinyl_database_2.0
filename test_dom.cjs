const { JSDOM } = require('jsdom');
const dom = new JSDOM();
const parser = new dom.window.DOMParser();
const doc = parser.parseFromString('<option value="1">1</option>', 'text/html');
console.log('BODY:', doc.body.innerHTML);
const doc2 = parser.parseFromString('<tr><td>1</td></tr>', 'text/html');
console.log('BODY2:', doc2.body.innerHTML);
