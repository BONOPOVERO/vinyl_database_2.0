export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0';
// Default token provided by user
export const DEFAULT_GITHUB_TOKEN = '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';

export function getGitHubToken() {
  return localStorage.getItem('app_github_token') || DEFAULT_GITHUB_TOKEN;
}

export async function fetchDatabaseFromGitHub() {
  // Always fetch via API to get the latest if we have a token, 
  // otherwise fetch the local static database.json as fallback.
  const token = getGitHubToken();
  try {
    if (token) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database.json`;
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'If-None-Match': '' // Avoid 304 if we want fresh data, or let it cache
        }
      });
      if (res.ok) {
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content)));
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn("Failed to fetch from GitHub API, falling back to static database.json", err);
  }
  
  // Fallback to static file (served by GitHub pages)
  const res = await fetch('database.json');
  return await res.json();
}

export async function pushDatabaseToGitHub(allVinyls) {
  const token = getGitHubToken();
  if (!token) {
    throw new Error("Manca il token di GitHub nelle impostazioni.");
  }
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  // 1. Get current SHA
  let sha = null;
  const getRes = await fetch(apiUrl, { headers });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    throw new Error("Impossibile recuperare il file dal repository. Controlla il Token.");
  }

  // 2. Encode to Base64 (Unicode safe)
  const contentStr = JSON.stringify(allVinyls, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

  // 3. PUT request
  const body = {
    message: 'Sync automatico da Vinyl WebApp \uD83D\uDCBE',
    content: contentBase64
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const errorData = await putRes.json();
    throw new Error("Errore durante il salvataggio su GitHub: " + (errorData.message || putRes.statusText));
  }
  
  return true;
}
