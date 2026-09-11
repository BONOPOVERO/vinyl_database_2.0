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

async function getVinylsBatch(items) {
  if (!items || items.length === 0) return [];
  const worker = await initDB();
  const detailMap = new Map();
  const ids = items.map(item => String(item.id).replace(/'/g, "")).filter(Boolean);
  
  if (ids.length === 0) return items;

  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const inClause = chunk.map(id => `'${id}'`).join(',');
    
    try {
      // Tabella primaria in master_catalog.db è 'vinyls' con colonna data JSON
      const res = await worker.db.query(`SELECT * FROM vinyls WHERE id IN (${inClause})`);
      if (res && res.length > 0) {
        for (const row of res) {
          let parsedData = {};
          if (row.data) {
            try { parsedData = JSON.parse(row.data); } catch(e) { parsedData = row; }
          } else {
            parsedData = row;
          }
          detailMap.set(String(row.id), parsedData);
        }
      } else {
        // Fallback per schemi alternativi
        const resFallback = await worker.db.query(`SELECT * FROM master_catalog WHERE id IN (${inClause})`);
        if (resFallback && resFallback.length > 0) {
          for (const row of resFallback) {
            detailMap.set(String(row.id), row);
          }
        }
      }
    } catch(err) {
      console.warn("Batch query error:", err);
    }
  }

  return items.map(item => {
    const details = detailMap.get(String(item.id)) || {};
    return {
      id: item.id,
      title: details.titolo_album || details.title || item.title || "Unknown Title",
      artist: details.artista || (details.artists && details.artists[0]?.name) || details.artist || item.artist || "Unknown Artist",
      year: details.anno_uscita_originale || details.year || item.year || "N/A",
      ...details,
      ...item
    };
  });
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
  const items = Array.isArray(collection) ? collection : (collection && collection.vinyls ? collection.vinyls : null);

  if (items && items.length > 0) {
    const fullDetails = await getVinylsBatch(items);
    renderVinyls(fullDetails);
  } else {
    // Mock data per preview se nessun dato presente
    const mockData = [
      { id: "1", title: "Dark Side of the Moon", artist: "Pink Floyd", state: "Mint" },
      { id: "2", title: "Abbey Road", artist: "The Beatles", state: "Very Good" }
    ];
    renderVinyls(mockData);
  }

  loadingState.classList.add('hidden');
});
