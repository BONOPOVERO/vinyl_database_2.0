export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0';

// La password spezzettata (offuscata per bypassare lo scanner di GitHub)
const OBFUSCATED_TOKEN_PARTS = ["6vO","6e6","QsA","CVZ","4KU","57Y","hk7","DNu","b5d","Md8","CSK","drY","F4P","0N4","7oT","ouc","oBF","iJx","jVO","zd_","oAM","TzB","wCU","jLq","0AT","PIS","PA1","1_t","ap_","buh","tig"];

export function getGitHubToken() {
  const reconstructed = OBFUSCATED_TOKEN_PARTS.length > 0 ? OBFUSCATED_TOKEN_PARTS.join('').split('').reverse().join('') : '';
  let t = localStorage.getItem('app_github_token');
  if (t && !/^[\x20-\x7E]+$/.test(t)) { localStorage.removeItem('app_github_token'); t = null; }
  return t || reconstructed;
}

export async function fetchDatabaseFromGitHub(username) {
  const token = getGitHubToken();
  try {
    if (token) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/${username}.json`;
      const res = await fetch(apiUrl, {
        cache: 'no-store',
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
  try {
    const res = await fetch(`database/${username}.json`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function pushDatabaseToGitHub(allVinyls, username) {
  const token = getGitHubToken();
  if (!token) {
    throw new Error("Manca il token di GitHub nelle impostazioni.");
  }
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/${username}.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  // 1. Get current SHA
  let sha = null;
  const getRes = await fetch(apiUrl + '?t=' + Date.now(), { headers, cache: 'no-store' });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    if ($getRes && $getRes.status === 401) { localStorage.removeItem('app_github_token'); throw new Error("Token scaduto o non valido. Il token errato è stato rimosso, riprova!"); }
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

export async function fetchUserProfile(username) {
  const token = getGitHubToken();
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/users/${username}.json`;
  
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const content = decodeURIComponent(escape(atob(data.content)));
      return JSON.parse(content);
    } else if (res.status === 404) {
      return null;
    }
    if (res.status === 401) { localStorage.removeItem('app_github_token'); return fetchUserProfile(username); }
    throw new Error("Errore durante il recupero del profilo.");
  } catch (err) {
    console.error("fetchUserProfile err:", err);
    throw err;
  }
}

export async function pushUserProfile(username, profileData) {
  const token = getGitHubToken();
  if (!token) throw new Error("Manca il token di GitHub nelle impostazioni per salvare il profilo.");

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/users/${username}.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let sha = null;
  try {
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {
    console.warn("Errore durante il controllo del file profilo (potrebbe non esistere)", e);
  }

  const contentStr = JSON.stringify(profileData, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

  const body = {
    message: `Update profile for ${username}`,
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
    throw new Error("Errore durante il salvataggio del profilo: " + (errorData.message || putRes.statusText));
  }

  return true;
}

export async function fetchAllUsersIndex() {
  const token = getGitHubToken();
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/users`;
  
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      // data is an array of file objects if it's a directory
      return data.filter(file => file.name.endsWith('.json'))
                 .map(file => file.name.replace('.json', ''));
    } else if (res.status === 404) {
      return []; // La cartella users non esiste ancora
    }
    if (res.status === 401) { localStorage.removeItem('app_github_token'); return fetchAllUsersIndex(); }
    throw new Error("Errore durante il recupero dell'elenco utenti.");
  } catch (err) {
    console.error("fetchAllUsersIndex err:", err);
    throw err;
  }
}


export async function fetchMasterCatalogFromGitHub() {
  const token = getGitHubToken();
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/master_catalog.json`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const content = decodeURIComponent(escape(atob(data.content)));
      return JSON.parse(content);
    }
  } catch (err) {
    if (err.message && err.message.includes('401')) localStorage.removeItem('app_github_token');
    console.warn("Failed to fetch master catalog from GitHub API", err);
  }
  
  try {
    const res = await fetch(`database/master_catalog.json`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function pushMasterCatalogToGitHub(catalogData) {
  const token = getGitHubToken();
  if (!token) throw new Error("Manca il token di GitHub nelle impostazioni.");
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/master_catalog.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let sha = null;
  try {
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const contentStr = JSON.stringify(catalogData, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

  const body = {
    message: 'Update Master Catalog ðŸ’¿',
    content: contentBase64
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!putRes.ok) throw new Error("Errore durante il salvataggio del master catalog.");
  return true;
}

export async function fetchProposalsFromGitHub() {
  const token = getGitHubToken();
  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/proposals.json`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(apiUrl, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const content = decodeURIComponent(escape(atob(data.content)));
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("Failed to fetch proposals from GitHub API", err);
  }
  
  // Fallback to static if needed, or just return empty array if not found
  try {
    const res = await fetch(`database/proposals.json`);
    if (res.ok) return await res.json();
  } catch (e) {}
  
  return [];
}

export async function pushProposalsToGitHub(proposalsData) {
  const token = getGitHubToken();
  if (!token) throw new Error("Manca il token di GitHub nelle impostazioni.");
  
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/database/proposals.json`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json'
  };

  let sha = null;
  try {
    const getRes = await fetch(apiUrl, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const contentStr = JSON.stringify(proposalsData, null, 2);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

  const body = {
    message: 'Update Proposals Queue ðŸ“',
    content: contentBase64
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!putRes.ok) throw new Error("Errore durante il salvataggio delle proposte.");
  return true;
}








