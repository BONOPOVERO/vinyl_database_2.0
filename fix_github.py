import re

with open('github-sync.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove obfuscated token
content = re.sub(r'const OBFUSCATED_TOKEN_PARTS = \[.*?\];\n', '', content, flags=re.DOTALL)
content = re.sub(r'const reconstructed = .*?;\n', '', content)
content = content.replace('return t || reconstructed;', "return t || '';")

# Add fetchWithRetry
fetch_with_retry = '''
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 404 || res.status === 401) {
        return res;
      }
      if (i === retries - 1) return res;
    } catch (err) {
      if (i === retries - 1) throw err;
    }
    await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
  }
}
'''
if 'async function fetchWithRetry' not in content:
    content = content.replace('export function getGitHubToken', fetch_with_retry + '\\nexport function getGitHubToken')

content = re.sub(r'(?<!function )fetch\(', 'fetchWithRetry(', content)

with open('github-sync.js', 'w', encoding='utf-8') as f:
    f.write(content)
