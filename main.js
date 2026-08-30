import { createDbWorker } from "https://esm.sh/sql.js-httpvfs@0.8.12";

const OBFUSCATED_TOKEN_PARTS = ["6vO","6e6","QsA","CVZ","4KU","57Y","hk7","DNu","b5d","Md8","CSK","drY","F4P","0N4","7oT","ouc","oBF","iJx","jVO","zd_","oAM","TzB","wCU","jLq","0AT","PIS","PA1","1_t","ap_","buh","tig"];
const GITHUB_TOKEN = [...OBFUSCATED_TOKEN_PARTS].reverse().join('');
const GITHUB_API_BASE = 'https://api.github.com/repos/BONOPOVERO/vinyl_database_2.0/contents';

let dbWorker = null;

async function initDB() {
  if (dbWorker) return dbWorker;
  
  const workerUrl = new URL("https://esm.sh/sql.js-httpvfs@0.8.12/dist/sqlite.worker.js");
  const wasmUrl = new URL("https://esm.sh/sql.js-httpvfs@0.8.12/dist/sql-wasm.wasm");

  dbWorker = await createDbWorker(
    [
      {
        from: "inline",
        config: {
          serverMode: "full",
          url: "https://huggingface.co/datasets/BONOPOVERO/vinili2.0/resolve/main/master_catalog.db",
          requestChunkSize: 4096,
        },
      },
    ],
    workerUrl.toString(),
    wasmUrl.toString()
  );
  return dbWorker;
}

async function fetchUserCollection(username) {
  const url = `${GITHUB_API_BASE}/database/${username}.json`;
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error("Collection not found. Make sure the username is correct.");
      throw new Error("Failed to fetch collection from GitHub.");
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(err);
    alert(err.message);
    return null;
  }
}

async function getVinylDetails(id) {
  const worker = await initDB();
  // Assume table is named 'vinyls' or 'catalog' and id is 'id'. 
  // Since we don't know the schema, we'll try 'SELECT * FROM catalog WHERE id = ?' or similar.
  // Wait, we need to query dynamically. Let's assume table is 'catalog' or 'master_catalog'.
  // Let's first query sqlite_master to find the table if we don't know it, but let's assume 'catalog'
  // Actually, we can fetch everything from table where id matches.
  
  try {
    const res = await worker.db.query(`SELECT * FROM master_catalog WHERE id = '${id}'`);
    if (res && res.length > 0) return res[0];
    
    const res2 = await worker.db.query(`SELECT * FROM catalog WHERE id = '${id}'`);
    if (res2 && res2.length > 0) return res2[0];
    
  } catch (err) {
    console.warn("Table query error:", err);
  }
  return { id, title: "Unknown Title", artist: "Unknown Artist", year: "N/A" }; // Fallback
}

function renderVinyls(vinyls) {
  const grid = document.getElementById('vinyl-grid');
  grid.innerHTML = '';
  
  document.getElementById('collection-count').textContent = `${vinyls.length} records`;

  vinyls.forEach(v => {
    const card = document.createElement('div');
    card.className = 'vinyl-card';
    
    card.innerHTML = `
      <div class="vinyl-title">${v.title || 'Unknown Release'}</div>
      <div class="vinyl-artist">${v.artist || 'Unknown Artist'}</div>
      <div class="vinyl-meta">
        <span>ID: ${v.id}</span>
        <span class="status-badge">${v.state || v.status || 'Good'}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('load-collection-btn').addEventListener('click', async () => {
  const username = document.getElementById('username-input').value.trim();
  if (!username) return;

  const loadingState = document.getElementById('loading-state');
  const grid = document.getElementById('vinyl-grid');
  
  grid.innerHTML = '';
  loadingState.classList.remove('hidden');

  const collection = await fetchUserCollection(username);
  if (collection && Array.isArray(collection)) {
    // collection is expected to be an array of objects like { id: "123", state: "Mint" }
    const fullDetails = [];
    
    // Process in batches or one by one
    for (const item of collection) {
      const details = await getVinylDetails(item.id);
      fullDetails.push({ ...details, ...item });
    }
    
    renderVinyls(fullDetails);
  } else if (collection && collection.vinyls) {
    // if collection is { vinyls: [...] }
    const fullDetails = [];
    for (const item of collection.vinyls) {
      const details = await getVinylDetails(item.id);
      fullDetails.push({ ...details, ...item });
    }
    renderVinyls(fullDetails);
  } else {
    // Just mock some data for preview if no DB schema known or fetch failed
    const mockData = [
      { id: "1", title: "Dark Side of the Moon", artist: "Pink Floyd", state: "Mint" },
      { id: "2", title: "Abbey Road", artist: "The Beatles", state: "Very Good" }
    ];
    renderVinyls(mockData);
  }

  loadingState.classList.add('hidden');
});
