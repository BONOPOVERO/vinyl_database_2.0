import sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open('script.js', 'r', encoding='utf-8') as f:
    text = f.read()
matches = re.finditer(r'\.innerHTML\s*\+?=\s*`([^`]+)`', text)
for m in matches:
    content = m.group(1)
    if '${' in content and 'escapeHtml' not in content:
        print('Match:')
        print(m.group(0)[:100])
