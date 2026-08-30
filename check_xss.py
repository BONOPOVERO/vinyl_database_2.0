import re
with open('script.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.finditer(r'\.innerHTML\s*\+?=\s*`([^`]+)`', text)
for m in matches:
    content = m.group(1)
    if '${' in content and 'escapeHtml' not in content:
        print('---')
        print(m.group(0)[:150])
