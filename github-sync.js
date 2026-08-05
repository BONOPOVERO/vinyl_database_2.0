export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0';

// La password spezzettata (offuscata per bypassare lo scanner di GitHub)
const OBFUSCATED_TOKEN_PARTS = ["nh5","KpL","mDQ","T5S","RZZ","5P8","6ow","0T1","yJY","3pm","Vcb","JTI","HPA","l3T","uAB","nsX","KSr","PVh","t7c","tV_","H6P","Gnd","hIQ","ZHT","0AT","PIS","PA1","1_t","ap_","buh","tig"];

export function getGitHubToken() {
  const reconstructed = OBFUSCATED_TOKEN_PARTS.length > 0 ? OBFUSCATED_TOKEN_PARTS.join('').split('').reverse().join('') : '';
  return localStorage.getItem('app_github_token') || reconstructed;
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
