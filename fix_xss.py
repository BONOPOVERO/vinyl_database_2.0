import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

sanitize_fn = """
window.sanitizeHTML = function(html) {
  if (typeof html !== 'string') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(s => s.remove());
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
      for (const attr of el.attributes) {
          if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name);
          }
      }
      if (el.tagName.toLowerCase() === 'iframe' || el.tagName.toLowerCase() === 'object' || el.tagName.toLowerCase() === 'embed') {
          el.remove();
      }
  });
  return doc.body.innerHTML;
};
"""

if 'window.sanitizeHTML = ' not in content:
    content = sanitize_fn + '\n' + content

# Replace innerHTML = `...` with innerHTML = window.sanitizeHTML(`...`)
# We can't just blindly replace all .innerHTML = because some might be .innerHTML = '' or .innerHTML = document.createElement...
# Let's use a regex to replace .innerHTML = `something` with .innerHTML = window.sanitizeHTML(`something`)
# And .innerHTML = someVar with .innerHTML = window.sanitizeHTML(someVar)

# Since we don't know if the RHS is complex, let's just use regex to wrap the rest of the line? No, it might span multiple lines.
# Actually, I can just replace `\.innerHTML\s*=\s*(.*?);` NO, template literals span multiple lines.

# Instead of regex, I will write a simple parser in python:
def replace_innerhtml(text):
    # Find all `.innerHTML = `
    result = []
    idx = 0
    while True:
        pos = text.find('.innerHTML = ', idx)
        if pos == -1:
            result.append(text[idx:])
            break
        # Append up to `.innerHTML = `
        result.append(text[idx:pos + len('.innerHTML = ')])
        idx = pos + len('.innerHTML = ')
        
        # We need to find the end of the expression. This is tricky.
        # But wait! We can just use a proxy!
        # Object.defineProperty(Element.prototype, 'safeInnerHTML', { set: function(val) { this.innerHTML = sanitizeHTML(val); }})
        pass
        
    return "".join(result)

# Wait! A much safer way: 
# Replace all `.innerHTML = ` with `.innerHTML = window.sanitizeHTML(` + something + `)` is hard.
# What if we just redefine `innerHTML`?
# NO, re-defining `innerHTML` on `Element.prototype` is not standard, it's better to just do a global replace of `.innerHTML = ` with `.innerHTML = window.sanitizeHTML(` ?
# Actually, I can just replace `\.innerHTML = ` with `.innerHTML = window.sanitizeHTML(` but wait, I can't close the parenthesis easily.

# Alternatively, I can find all `\.innerHTML = ` and rename them to `.safeInnerHTML = ` and then add a polyfill:
polyfill = """
Object.defineProperty(Element.prototype, 'safeInnerHTML', {
    set: function(val) {
        this.innerHTML = window.sanitizeHTML(val);
    }
});
"""
# This is incredibly elegant.

if 'safeInnerHTML' not in content:
    content = polyfill + content
    content = content.replace('.innerHTML =', '.safeInnerHTML =')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)
