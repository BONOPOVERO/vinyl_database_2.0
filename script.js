// Importa il database dal file esterno
import { fetchDatabaseFromGitHub, pushDatabaseToGitHub, fetchUserProfile, pushUserProfile, fetchAllUsersIndex, fetchMasterCatalogFromGitHub, pushMasterCatalogToGitHub, fetchProposalsFromGitHub, pushProposalsToGitHub } from './github-sync.js';
import sqlJsHttpvfs from "https://esm.sh/sql.js-httpvfs@0.8.12";
const { createDbWorker } = sqlJsHttpvfs;

window.sqliteWorker = null; // Uso window in modo che sia disponibile ovunque
let sqliteWorker = null;

async function initSqliteDb() {
  if (sqliteWorker) return sqliteWorker;
  try {
    sqliteWorker = await createDbWorker(
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
      "./sqlite.worker.js",
      "./sql-wasm.wasm",
      100 * 1024 * 1024 // 100MB limite per permettere query complesse
    );
    window.sqliteWorker = sqliteWorker;
    console.log("Local SQLite DB initialized successfully via HTTP VFS.");
    return sqliteWorker;
  } catch (error) {
    console.error("Failed to initialize SQLite DB via HTTP VFS:", error);
    return null;
  }
}


// Funzione di sicurezza per prevenire XSS injection nell'HTML dinamico

async function joinVinylDataAsync(userVinyls, forceRescan = false) {
    if (!userVinyls || userVinyls.length === 0) return [];
    
    const cachedDataStr = localStorage.getItem('app_all_vinyls_cache');
    const cachedMap = {};
    if (cachedDataStr && !forceRescan) {
        try {
            const cachedArr = JSON.parse(cachedDataStr);
            cachedArr.forEach(v => cachedMap[v.id] = v);
        } catch(e){}
    }

    const missingIds = [];
    userVinyls.forEach(uv => {
        const cached = cachedMap[uv.id] || {};
        
        // Controllo se i dati sono già completi in uv (il file json personale) o in cache
        const hasArtista = uv.artista || cached.artista;
        const hasAnno = uv.anno_uscita_originale || cached.anno_uscita_originale;
        
        // Se mancano dati chiave o stiamo forzando la scansione, mettiamo nei missing
        if ((forceRescan || !hasArtista || !hasAnno) && !String(uv.id).startsWith("FALLBACK_")) { 
            missingIds.push(`'${uv.id}'`);
        }
    });
    if (!sqliteWorker && missingIds.length > 0) {
        return userVinyls.map(uv => ({...(cachedMap[uv.id] || {}), ...uv}));
    }

    const masterMap = {};
    if (missingIds.length > 0 && sqliteWorker) {
        for (let i = 0; i < missingIds.length; i++) {
            const uvId = missingIds[i].replace(/'/g, ""); // Rimuove gli apici
            const sql = `SELECT * FROM vinyls WHERE id = '${uvId}'`;
            try {
                const results = await sqliteWorker.db.query(sql);
                if (results && results.length > 0) {
                    const r = results[0];
                    masterMap[r.id] = JSON.parse(r.data);
                    
                    // -- AGGIORNAMENTO PROGRESSIVO UI --
                    // Se stiamo lavorando sulla collezione principale e l'app è già avviata, aggiorniamo visivamente un elemento alla volta.
                    if (typeof ALL_VINILI !== 'undefined' && typeof applyFiltering === 'function') {
                        const targetIndex = ALL_VINILI.findIndex(v => String(v.id) === String(uvId));
                        if (targetIndex !== -1) {
                            let globalData = masterMap[r.id] || {};
                            let cachedData = cachedMap[uvId] || {};
                            
                            if (globalData.title && !globalData.titolo_album) globalData.titolo_album = globalData.title;
                            if (globalData.artists && globalData.artists.length > 0 && !globalData.artista) {
                                globalData.artista = typeof globalData.artists[0] === 'string' ? globalData.artists[0] : globalData.artists[0].name;
                            }
                            if (globalData.artist && !globalData.artista) globalData.artista = globalData.artist;
                            if (globalData.year && !globalData.anno_uscita_originale) globalData.anno_uscita_originale = globalData.year;
                            if (globalData.labels && globalData.labels.length > 0 && !globalData.etichetta) globalData.etichetta = globalData.labels[0].name;
                            if (globalData.label && !globalData.etichetta) globalData.etichetta = globalData.label;
                            if (globalData.catno && !globalData.catalog_number) globalData.catalog_number = globalData.catno;
                            if (globalData.barcode && !globalData.codice_a_barre) globalData.codice_a_barre = globalData.barcode;
                            if (globalData.genres && globalData.genres.length > 0 && !globalData.genere) globalData.genere = globalData.genres.join(', ');
                            if (globalData.tracklist && globalData.tracklist.length > 0 && !globalData.tracce) {
                                globalData.tracce = globalData.tracklist.map(t => ({ pos: t.position || '', title: t.title || '', duration: t.duration || '' }));
                            }
                            
                            const uv = userVinyls.find(u => String(u.id) === String(uvId)) || {};
                            ALL_VINILI[targetIndex] = { ...cachedData, ...globalData, ...uv };
                            
                            // Forza l'aggiornamento grafico
                            applyFiltering();
                            // Piccola pausa per dare respiro al browser (e mostrare l'animazione)
                            await new Promise(resolve => setTimeout(resolve, 50)); 
                        }
                    }
                }
            } catch(e) {
                console.error("Error joining vinyl data progressively:", e);
            }
        }
    }
    
    const enrichedVinyls = userVinyls.map(uv => {
        let globalData = masterMap[uv.id] || {};
        let cachedData = cachedMap[uv.id] || {};
        
        // Se i dati dal master catalog sono in formato Discogs nativo (inglese), mappiamoli nei campi dell'app (italiano)
        if (globalData.title && !globalData.titolo_album) globalData.titolo_album = globalData.title;
        if (globalData.artists && globalData.artists.length > 0 && !globalData.artista) {
            globalData.artista = typeof globalData.artists[0] === 'string' ? globalData.artists[0] : globalData.artists[0].name;
        }
        if (globalData.artist && !globalData.artista) globalData.artista = globalData.artist;
        if (globalData.year && !globalData.anno_uscita_originale) globalData.anno_uscita_originale = globalData.year;
        if (globalData.labels && globalData.labels.length > 0 && !globalData.etichetta) globalData.etichetta = globalData.labels[0].name;
        if (globalData.label && !globalData.etichetta) globalData.etichetta = globalData.label;
        if (globalData.catno && !globalData.catalog_number) globalData.catalog_number = globalData.catno;
        if (globalData.barcode && !globalData.codice_a_barre) globalData.codice_a_barre = globalData.barcode;
        if (globalData.genres && globalData.genres.length > 0 && !globalData.genere) globalData.genere = globalData.genres.join(', ');
        if (globalData.tracklist && globalData.tracklist.length > 0 && !globalData.tracce) {
            globalData.tracce = globalData.tracklist.map(t => ({ pos: t.position || '', title: t.title || '', duration: t.duration || '' }));
        }
        
        // Uniamo le tre fonti e aggiungiamo un flag per ricordare che lo abbiamo già processato
        return { ...cachedData, ...globalData, ...uv, _backfilled: true };
    });
    
    // BACKFILL AUTOMATICO: se abbiamo pescato dati nuovi dal database gigante, aggiorniamo il file su GitHub
    if (missingIds.length > 0) {
        const currentUser = localStorage.getItem('app_current_user');
        if (currentUser) {
            console.log("Backfill automatico in corso: salvataggio dei dati completi su GitHub...");
            // Non mettiamo await per non bloccare il rendering, lo lasciamo in background
            pushDatabaseToGitHub(enrichedVinyls, currentUser).then(() => {
                console.log("Backfill completato con successo su " + currentUser + ".json");
            }).catch(e => console.error("Errore nel backfill automatico:", e));
        }
    }
    
    return enrichedVinyls;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Svuota la cache obsoleta per forzare il ricalcolo con i Price Suggestions reali
if (!localStorage.getItem('app_cache_wiped_v2')) {
  localStorage.removeItem('discogs_cached_prices');
  localStorage.setItem('app_cache_wiped_v2', 'true');
}

// Crea una copia safe del vinile con campi testo escaped per rendering HTML

// ==========================================
// TRACKER API RATE LIMIT (Client-Side Sliding Window)
// ==========================================
let apiRequestTimestamps = [];

function updateLocalRateIndicator() {
  const indicator = document.getElementById('api-rate-indicator');
  if (!indicator) return;
  const now = Date.now();
  
  // Rimuove i timestamp più vecchi di 60 secondi
  apiRequestTimestamps = apiRequestTimestamps.filter(t => now - t < 60000);
  
  const remaining = Math.max(0, 60 - apiRequestTimestamps.length);
  indicator.textContent = 'API: ' + remaining;
  if (remaining < 15) {
    indicator.style.color = '#ef4444';
    indicator.style.borderColor = '#ef4444';
  } else {
    indicator.style.color = '#ff9ffc';
    indicator.style.borderColor = 'rgba(255,159,252,0.3)';
  }
}

// Aggiorna l'indicatore in tempo reale man mano che le vecchie richieste scadono
setInterval(updateLocalRateIndicator, 1000);

const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0] instanceof Request ? args[0].url : (typeof args[0] === 'string' ? args[0] : '');
  if (url.includes('api.discogs.com')) {
    apiRequestTimestamps.push(Date.now());
    updateLocalRateIndicator();
  }
  return originalFetch.apply(this, args);
};
const OBFUSCATED_DISCOGS = ["tFE", "LrW", "CtE", "oWf", "gVN", "OPv", "ztT", "Ehb", "fRF", "kjy", "xKh", "Qdh", "sVQ", "G"];
const DISCOGS_TOKEN = OBFUSCATED_DISCOGS.join('').split('').reverse().join('');
function getDiscogsToken() {
  return DISCOGS_TOKEN;
}

function safeVinile(v) {
  if (!v) return {};
  const s = { ...v };
  
  if ((!s.artista || s.artista === 'undefined') && s.artists && s.artists.length > 0) s.artista = typeof s.artists[0] === 'string' ? s.artists[0] : (s.artists[0].name || 'Artista Ignoto');
  if ((!s.artista || s.artista === 'undefined') && s.artista_clean) s.artista = s.artista_clean;
  if (!s.titolo_album || s.titolo_album === 'undefined') s.titolo_album = s.titolo || s.title || 'Sconosciuto';
  if (s.tracklist && s.tracklist.length > 0 && (!s.tracce || s.tracce.length === 0)) {
      s.tracce = s.tracklist.map(t => ({ pos: t.position || t.pos || '', title: t.title || '', duration: t.duration || '' }));
  }

  const textFields = ['titolo_album','artista','genere','etichetta','note_stato','catalog_number',
    'codice_matrice','codice_a_barre','velocita','grammatura','colore','inserti','origine','stato_disco',
    'stato_copertina','stato_catalogo','posizione_fisica'];
  textFields.forEach(f => { if (s[f] != null) s[f] = escapeHtml(String(s[f])); });
  if (Array.isArray(s.tracce)) {
    s.tracce = s.tracce.map(t => ({ ...t, title: escapeHtml(t.title || ''), pos: escapeHtml(t.pos || ''), duration: escapeHtml(t.duration || '') }));
  }
  return s;
}

// ==========================================
// 1. REGISTRAZIONE SERVICE WORKER & RILEVAMENTO PWA INSTALLATA
// ==========================================
function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'QUOTA_EXCEEDED_ERR') {
      if (typeof showToast === 'function') showToast('⚠️ Spazio esaurito! Esporta un backup.');
      console.error('LocalStorage quota exceeded');
    }
  }
}

let deferredPrompt = null;
const installPwaBtn = document.getElementById('install-pwa-btn');
const installModal = document.getElementById('install-modal');
const closeInstallModalBtn = document.getElementById('close-install-modal');
const closeInstallModalBtn2 = document.getElementById('close-install-modal-btn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
  });
}

// Rilevamento se l'app è già stata installata ed avviata come PWA standalone
function isAppInstalled() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true ||
                       document.referrer.startsWith('android-app://');
  return isStandalone;
}

function checkAppInstalledState() {
  if (!installPwaBtn) return;
  if (isAppInstalled()) {
    installPwaBtn.style.display = 'none';
  } else {
    installPwaBtn.style.display = 'inline-flex';
  }
}

checkAppInstalledState();

try {
  window.matchMedia('(display-mode: standalone)').addEventListener('change', checkAppInstalledState);
} catch (e) {}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  checkAppInstalledState();
});

window.addEventListener('appinstalled', () => {
  checkAppInstalledState();
});

function openInstallModal() {
  if (installModal) {
    installModal.classList.add('active');
    installModal.setAttribute('aria-hidden', 'false');
  }
}

function closeInstallModal() {
  if (installModal) {
    installModal.classList.remove('active');
    installModal.setAttribute('aria-hidden', 'true');
  }
}

if (installPwaBtn) {
  installPwaBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast("🎉 App Installata sulla schermata Home!");
        checkAppInstalledState();
      }
      deferredPrompt = null;
    } else {
      openInstallModal();
    }
  });
}

if (closeInstallModalBtn) closeInstallModalBtn.addEventListener('click', closeInstallModal);
if (closeInstallModalBtn2) closeInstallModalBtn2.addEventListener('click', closeInstallModal);

// ==========================================
// 3. GENERATORE EFFETTO LIQUID GLASS (OPTIMIZED 60 FPS)
// ==========================================
function createGlassSurface(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.classList.add('glass-surface');

  const glassPanel = container.closest('.center-glass-panel') || container;
  let rafId = null;
  let cachedRect = null;

  function updateRect() {
    cachedRect = glassPanel.getBoundingClientRect();
  }
  updateRect();
  window.addEventListener('resize', updateRect);

  glassPanel.addEventListener('pointermove', (e) => {
    if (!cachedRect) updateRect();
    const x = e.clientX - cachedRect.left;
    const y = e.clientY - cachedRect.top;
    const centerX = cachedRect.width / 2;
    const centerY = cachedRect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      glassPanel.style.transform = `translate(-50%, -50%) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
  });

  glassPanel.addEventListener('pointerleave', () => {
    if (rafId) cancelAnimationFrame(rafId);
    glassPanel.style.transform = `translate(-50%, -50%) perspective(1000px) rotateX(0deg) rotateY(0deg)`;
  });
}
createGlassSurface('my-liquid-glass');


import { updateBackgroundSharpness, updateBackgroundBlur, toggleBackgroundAnimation, applyAppTheme, updateDynamicAlbumBackground, updateAnimationToggleButtonUI, bgIterations, bgBlur } from './three-bg.js';


let userAddedVinyls = []; // Keep it declared if it's used elsewhere, but we won't use it for storage.
let ALL_VINILI = [];
let updateContentTimeout = null;
let MASTER_CATALOG = [];
let currentTracklist = [];

let activeCategory = 'Personale'; 
let searchQuery = '';
let filterYearFrom = null;
let filterYearTo = null;
let filterPriceFrom = null;
let filterPriceTo = null;
let filterGenre = '';
let sortStrategy = 'DEFAULT';

let filteredVinili = [];
let selectedIndex = 0;
let wheelItems = [];
let currentCachedPrices = {};
// ELEMENTI DOM
const wheelContainer = document.getElementById("option-wheel");
const centerContent = document.getElementById("center-content");
const mobileCounter = document.getElementById("mobile-album-counter");
const prevBtn = document.getElementById("prev-album-btn");
const nextBtn = document.getElementById("next-album-btn");
const toggleListBtn = document.getElementById("toggle-list-btn");
const mobileOverlay = document.getElementById("mobile-overlay");
const toastContainer = document.getElementById("toast-container");

// SEARCH
const toggleSearchBtn = document.getElementById("toggle-search-btn");
const searchBarWrapper = document.getElementById("search-bar-wrapper");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search-btn");

// FILTERS MODAL
const openFilterBtn = document.getElementById("open-filter-btn");
const filterModal = document.getElementById("filter-modal");
const closeFilterModalBtn = document.getElementById("close-filter-modal");
const filterYearFromInput = document.getElementById("filter-year-from");
const filterYearToInput = document.getElementById("filter-year-to");
const filterPriceFromInput = document.getElementById("filter-price-from");
const filterPriceToInput = document.getElementById("filter-price-to");
const filterGenreSelect = document.getElementById("filter-genre-select");
const sortSelect = document.getElementById("sort-select");
const applyFiltersBtn = document.getElementById("apply-filters-btn");
const resetFiltersBtn = document.getElementById("reset-filters-btn");

// EXPORT & IMPORT
const exportJsonBtn = document.getElementById("export-json-btn");
const exportCsvBtn = document.getElementById("export-csv-btn");
const triggerImportBtn = document.getElementById("trigger-import-btn");
const importJsonFile = document.getElementById("import-json-file");

// STATS MODAL
const openStatsBtn = document.getElementById("open-stats-btn");
const statsModal = document.getElementById("stats-modal");
const closeStatsModalBtn = document.getElementById("close-stats-modal");
const statsModalBody = document.getElementById("stats-modal-body");

// ADD VINYL MODAL & DISCOGS / MUSICBRAINZ
const openAddBtn = document.getElementById("open-add-btn");
const addVinylModal = document.getElementById("add-vinyl-modal");
const closeAddModalBtn = document.getElementById("close-add-modal");
const addVinylForm = document.getElementById("add-vinyl-form");
const triggerCameraBtn = document.getElementById("trigger-camera-btn");
const cameraFileInput = document.getElementById("camera-file-input");
const photoPreviewImg = document.getElementById("photo-preview-img");
const discogsQuery = document.getElementById("discogs-query");
const discogsSearchBtn = document.getElementById("discogs-search-btn");
const discogsResults = document.getElementById("discogs-results");

let currentCapturedCoverBase64 = null;

// BLOCCO DI SICUREZZA (PASSWORD)
window.checkAdminAccess = function(actionType = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('password-modal');
    const input = document.getElementById('admin-password-input');
    const errorMsg = document.getElementById('password-error-msg');
    const submitBtn = document.getElementById('submit-password-btn');
    const cancelBtn = document.getElementById('cancel-password-btn');
    const closeBtn = document.getElementById('close-password-modal');
    const globalDbBtn = document.getElementById('add-from-global-db-btn');
    
    if (globalDbBtn) {
      if (actionType === 'add') {
        globalDbBtn.style.display = 'block';
      } else {
        globalDbBtn.style.display = 'none';
      }
    }

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    input.value = '';
    errorMsg.style.display = 'none';
    setTimeout(() => input.focus(), 100);

    const cleanup = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      submitBtn.removeEventListener('click', onSubmit);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keypress', onKeyPress);
      if (globalDbBtn) globalDbBtn.removeEventListener('click', onGlobalDbClick);
    };

    const onSubmit = () => {
      if (input.value === 'Yuta') {
        if (typeof showToast === 'function') showToast("✅ Azione autorizzata!");
        cleanup();
        resolve(true);
      } else {
        errorMsg.style.display = 'block';
        input.value = '';
        input.focus();
      }
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const onGlobalDbClick = () => {
      cleanup();
      resolve('globalDb');
    };

    const onKeyPress = (e) => {
      if (e.key === 'Enter') onSubmit();
    };

    submitBtn.addEventListener('click', onSubmit);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    input.addEventListener('keypress', onKeyPress);
    if (globalDbBtn) globalDbBtn.addEventListener('click', onGlobalDbClick);
  });
};
const authModal = document.getElementById('auth-modal');
  let currentUser = localStorage.getItem('app_current_user');
  
  if (!currentUser && !localStorage.getItem('app_guest_mode')) {
    authModal.classList.add('active');
    authModal.setAttribute('aria-hidden', 'false');
  } else {
    try {
      let rawUserVinyls = [];
      if (currentUser) {
          rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
      }
      
      // Carica inizialmente dalla cache veloce e mostra la UI
      ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
      safeSave('app_all_vinyls_cache', ALL_VINILI);
      applyFiltering();
      
      // Sincronizzazione in background per non bloccare l'avvio del resto dell'app (event listeners, ecc)
      setTimeout(async () => {
          try {
              const hasMissingData = Array.isArray(ALL_VINILI) && ALL_VINILI.some(v => !v._backfilled && !String(v.id).startsWith("FALLBACK_"));
              if (hasMissingData) {
                  console.log("Metadati mancanti, avvio inizializzazione master DB...");
                  if (typeof showToast === 'function') showToast("⬇️ Connessione al master database...");
                  
                  // Attendiamo il caricamento del database pesante (ora non blocca il resto dell'app)
                  await initSqliteDb();
                  
                  // Nascondiamo l'overlay iniziale (il caricamento pesante del DB è finito)
                  const overlay = document.getElementById('startup-loading-overlay');
                  if (overlay) {
                      overlay.style.transition = 'opacity 0.5s ease-out';
                      overlay.style.opacity = '0';
                      setTimeout(() => overlay.remove(), 500);
                  }
                  
                  // Avviamo il join sequenziale che aggiornerà la UI disco per disco
                  ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
                  safeSave('app_all_vinyls_cache', ALL_VINILI);
                  if (typeof showToast === 'function') showToast("✅ Sincronizzazione completata!");
              } else {
                  // Se non ci sono dati mancanti, nascondiamo l'overlay subito
                  const overlay = document.getElementById('startup-loading-overlay');
                  if (overlay) overlay.remove();
              }
          } catch(e) {
              console.error("Errore nel caricamento background:", e);
              const overlay = document.getElementById('startup-loading-overlay');
              if (overlay) overlay.remove();
          }
      }, 50);

    if (!currentUser) {
         // UI changes for Guest Mode
         const topNav = document.querySelector('.top-nav-row');
         if (topNav) {
            topNav.innerHTML = `
              <button onclick="window.openDatabaseModal()" class="action-pill-btn filter-btn-pill" style="background: rgba(236,72,153,0.2); border-color: #ec4899; color: white;">
                🌍 Esplora Database
              </button>
              <button id="open-quick-val-btn" class="icon-circle-btn" aria-label="Valuta Veloce" title="Valuta Veloce">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </button>
            `;
            // Attach event listener to new quick val btn
            setTimeout(() => {
                const btn = document.getElementById('open-quick-val-btn');
                const modal = document.getElementById('quick-val-modal');
                if (btn && modal) {
                    btn.addEventListener('click', () => {
                        modal.classList.add('active');
                        modal.setAttribute('aria-hidden', 'false');
                    });
                }
            }, 50);
         }
         
         const carousel = document.getElementById('carousel-container');
         if (carousel) carousel.style.display = 'none';
         
         const hideIds = ['dock-add-btn', 'dock-edit-btn', 'dock-delete-btn', 'dock-discogs-btn', 'dock-stats-btn', 'dock-jukebox-btn', 'dock-spotify-btn', 'settings-save-profile-btn', 'settings-export-json-btn', 'settings-export-csv-btn', 'settings-trigger-import-btn'];
         hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
         });
      }
    } catch (err) {
      console.error("Errore critico durante l'avvio:", err);
      ALL_VINILI = JSON.parse(localStorage.getItem('app_all_vinyls_cache') || '[]');
      applyFiltering();
      if (typeof showToast === 'function') showToast("Avvio Offline o Errore: caricata cache locale");
      const overlay = document.getElementById('startup-loading-overlay');
      if (overlay) overlay.remove();
    }
  }

// HELPER PER PULIZIA TESTI E GENERAZIONE COVER FALLBACK IN SVG
function cleanMusicTitle(str) {
  if (!str) return '';
  let s = String(str)
    .replace(/^query:\s*/i, '')
    .replace(/Default Query/gi, '')
    .replace(/^barcode:\s*/i, '')
    .replace(/^catno:\s*/i, '')
    .replace(/^release:\s*/i, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*\([^)]*edition[^)]*\)/gi, '')
    .replace(/\s*\([^)]*bonus[^)]*\)/gi, '')
    .replace(/\s*\([^)]*remaster[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  s = s.replace(/[\s\-_]+$/, '').replace(/^[\s\-_]+/, '');
  return s;
}

function parseArtistAndAlbum(rawTitle, rawArtist, rawAlbum) {
  let artist = cleanMusicTitle(rawArtist);
  let album = cleanMusicTitle(rawAlbum);
  const fullTitle = cleanMusicTitle(rawTitle);

  if (fullTitle.includes(' - ') || fullTitle.includes(' — ')) {
    const parts = fullTitle.split(/\s+[\-—]\s+/);
    const candidateArtist = cleanMusicTitle(parts[0]);
    const candidateAlbum = cleanMusicTitle(parts.slice(1).join(' - '));

    if (candidateArtist && candidateArtist.length >= 2) artist = candidateArtist;
    if (candidateAlbum && candidateAlbum.length >= 2) album = candidateAlbum;
  } else if (!album && fullTitle) {
    album = fullTitle;
  }

  if (!artist || artist === '-') artist = 'Artista Sconosciuto';
  if (!album || album === '-') album = fullTitle || 'Album Sconosciuto';

  return { artist, album };
}

function generateSVGAlbumCover(artist, album) {
  const safeArtist = String(artist || 'Artista').replace(/["'<>&]/g, '');
  const safeAlbum = String(album || 'Album').replace(/["'<>&]/g, '');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="100%" height="100%" fill="#161226"/><circle cx="150" cy="150" r="115" fill="%23090712" stroke="%23ff9ffc" stroke-width="2" opacity="0.5"/><circle cx="150" cy="150" r="80" fill="none" stroke="%235227ff" stroke-width="2" opacity="0.6"/><circle cx="150" cy="150" r="45" fill="%23ff9ffc" opacity="0.85"/><circle cx="150" cy="150" r="10" fill="%23111"/><text x="150" y="80" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="%23ffffff" text-anchor="middle">${safeArtist}</text><text x="150" y="235" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="%23ff9ffc" text-anchor="middle">${safeAlbum}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
}

// ESTRAZIONE COLORI REALE TRAMITE CANVAS 2D DA ELEMENTO <img> DELLA COPERTINA
window.extractDominantColors = function extractDominantColors(imgElement) {
  if (!imgElement) return;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 20;
    canvas.height = 20;

    // Disegna l'immagine reale della copertina sul canvas miniatura 20x20
    ctx.drawImage(imgElement, 0, 0, 20, 20);
    const imgData = ctx.getImageData(0, 0, 20, 20).data;

    let rSum = 0, gSum = 0, bSum = 0, validPixelCount = 0;
    let maxSat = -1;
    let vibrantColor = { r: 200, g: 210, b: 225 }; // Cold silver default
    let maxSatPixels = 0;
    let totalSatSum = 0;

    // Analizza ciascuno dei 400 pixel
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];

      if (a < 128) continue; // Ignora pixel trasparenti

      rSum += r;
      gSum += g;
      bSum += b;
      validPixelCount++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const sat = max === 0 ? 0 : delta / max;
      totalSatSum += sat;

      if (sat > 0.18) maxSatPixels++;

      // Trova la tonalità con maggiore saturazione tra i pixel non sovraesposti
      if (sat > maxSat && max > 30 && min < 240) {
        maxSat = sat;
        vibrantColor = { r, g, b };
      }
    }

    if (validPixelCount === 0) return;

    const avgR = Math.round(rSum / validPixelCount);
    const avgG = Math.round(gSum / validPixelCount);
    const avgB = Math.round(bSum / validPixelCount);
    const avgSat = totalSatSum / validPixelCount;

    let color1 = "#cbd5e1";
    let color2 = "#0f172a";

    // GESTIONE COPERTINE B&N, MONOCROMATICHE O SCURE (NO TONI VIOLA/MARRONI CASUALI)
    if (avgSat < 0.12 || maxSat < 0.15 || maxSatPixels < 15) {
      const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114);
      if (brightness < 65) {
        color1 = "#94a3b8"; // Silver slate ice glow
        color2 = "#090d16"; // Deep anthracite OLED
      } else {
        color1 = "#f1f5f9"; // Pure ice white
        color2 = "#1e293b"; // Dark slate
      }
    } else {
      // COPERTINE CROMATICHE CON COLORI VIVACI (CALDI O FREDDI)
      color1 = `#${vibrantColor.r.toString(16).padStart(2, '0')}${vibrantColor.g.toString(16).padStart(2, '0')}${vibrantColor.b.toString(16).padStart(2, '0')}`;
      color2 = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
    }

    // AGGIORNAMENTO VARIABILI CSS GLOBALI DI :root
    document.documentElement.style.setProperty('--theme-glow-1', color1);
    document.documentElement.style.setProperty('--theme-glow-2', color2);
    document.documentElement.style.setProperty('--primary-color', color1);
    document.documentElement.style.setProperty('--accent-color', color2);

    // PASSA I COLORI ALLO SHADER THREE.JS ED ALLA DOCK BAR
    updateDynamicAlbumBackground(color1, color2);
  } catch (err) {
    // Fallback sicuro se il canvas viene bloccato per regole CORS su immagini cross-origin
    const fallbackTop = "#94a3b8";
    const fallbackBottom = "#0f172a";
    document.documentElement.style.setProperty('--theme-glow-1', fallbackTop);
    document.documentElement.style.setProperty('--theme-glow-2', fallbackBottom);
    document.documentElement.style.setProperty('--primary-color', fallbackTop);
    document.documentElement.style.setProperty('--accent-color', fallbackBottom);
    updateDynamicAlbumBackground(fallbackTop, fallbackBottom);
  }
}

// ==========================================
// ALGORITMO DI VALUTAZIONE COMMERCIALE VINILI (GOLDMINE / DISCOGS MODEL)
// ==========================================
function calculateVinylValue(vinile) {
  if (!vinile) return { total: 20, computed: 20, isCustom: false, factors: [] };

  const userVal = parseFloat(vinile.valore_stimato);
  const factors = [];

  // 1. ANNO DI USCITA E BASE DI MERCATO
  const rawReleaseYear = parseInt(vinile.anno_uscita_originale || vinile.anno_stampa);
  const releaseYear = (!isNaN(rawReleaseYear) && rawReleaseYear > 1900) ? rawReleaseYear : 1980;

  let baseValue = 22;
  if (releaseYear < 1970) {
    baseValue = 35;
    factors.push("Stampa d'epoca Pre-1970");
  } else if (releaseYear >= 1970 && releaseYear < 1990) {
    baseValue = 26;
    factors.push("Vintage Anni '70/'80");
  } else if (releaseYear >= 1990 && releaseYear < 2000) {
    baseValue = 42;
    factors.push("Rarità Anni '90 (Era CD)");
  } else {
    baseValue = 24;
    factors.push("Edizione Moderna Post-2000");
  }

  // 2. EDITTIONE E ANNO DI STAMPA (PRIMA STAMPA VS RISTAMPA)
  let printMultiplier = 1.0;
  const rawPrintYear = parseInt(vinile.anno_stampa || vinile.anno_uscita_stampa);
  if (!isNaN(rawPrintYear)) {
    if (rawPrintYear === releaseYear && releaseYear < 1995) {
      printMultiplier = 1.45;
      factors.push("Prima Stampa Originale (+45%)");
    } else if (rawPrintYear - releaseYear > 20) {
      printMultiplier = 0.90;
      factors.push("Ristampa Tarda (-10%)");
    } else if (rawPrintYear > releaseYear) {
      factors.push(`Stampa del ${rawPrintYear}`);
    }
  }

  // 3. STATO DISCO E COPERTINA (GOLDMINE GRADING SCALE)
  const rawDisc = parseInt(vinile.stato_disco);
  const discScore = (!isNaN(rawDisc) && rawDisc > 0) ? Math.min(10, Math.max(1, rawDisc)) : 8;
  const rawCover = parseInt(vinile.stato_copertina);
  const coverScore = (!isNaN(rawCover) && rawCover > 0) ? Math.min(10, Math.max(1, rawCover)) : 8;

  // Media ponderata: 65% vinile, 35% copertina
  const weightedCondition = (discScore * 0.65) + (coverScore * 0.35);
  let conditionMultiplier = 1.0;

  if (weightedCondition >= 9.5) {
    conditionMultiplier = 1.30;
    factors.push(`Disco ${discScore}/10 • Cover ${coverScore}/10 (Condizioni Perfette/Mint +30%)`);
  } else if (weightedCondition >= 8.0) {
    conditionMultiplier = 1.05;
    factors.push(`Disco ${discScore}/10 • Cover ${coverScore}/10 (Ottimo Stato)`);
  } else if (weightedCondition >= 6.5) {
    conditionMultiplier = 0.75;
    factors.push(`Disco ${discScore}/10 • Cover ${coverScore}/10 (Buono Usato -25%)`);
  } else if (weightedCondition >= 4.5) {
    conditionMultiplier = 0.50;
    factors.push(`Disco ${discScore}/10 • Cover ${coverScore}/10 (Usura Visibile -50%)`);
  } else {
    conditionMultiplier = 0.30;
    factors.push(`Disco ${discScore}/10 • Cover ${coverScore}/10 (Condizioni Scarse -70%)`);
  }

  // 4. KEYWORDS NELLE NOTE, DISCO COLORATO, INSERTI E CONDIZIONI PARTICOLARI
  let bonusMultiplier = 1.0;
  const notesLower = (vinile.note_stato || '').toLowerCase();
  const insertiLower = (vinile.inserti || '').toLowerCase();
  const colorLower = (vinile.colore || '').toLowerCase();

  if (notesLower.includes('sigillat') || notesLower.includes('cellophan') || notesLower.includes('sealed') || notesLower.includes('nuovo')) {
    bonusMultiplier += 0.35;
    factors.push("Sigillato / Cellophan Originale (+35%)");
  }
  if (notesLower.includes('autograf') || notesLower.includes('firmato') || notesLower.includes('signed')) {
    bonusMultiplier += 0.50;
    factors.push("Autografato / Firma Originale (+50%)");
  }
  if (notesLower.includes('limit') || notesLower.includes('box') || notesLower.includes('anniversar') || notesLower.includes('numerat') || notesLower.includes('deluxe') || notesLower.includes('remaster')) {
    bonusMultiplier += 0.25;
    factors.push("Edizione Limitata / Deluxe (+25%)");
  }
  if (colorLower !== '' && colorLower !== 'nero' && colorLower !== 'black' && colorLower !== 'n/a') {
    bonusMultiplier += 0.20;
    factors.push(`Vinile Colorato (${vinile.colore} +20%)`);
  }
  if (insertiLower !== '' && !insertiLower.includes('nessun') && !insertiLower.includes('n/a')) {
    bonusMultiplier += 0.12;
    factors.push(`Inserti/Poster inclusi (+12%)`);
  }

  // 5. CODICE MATRICE, CATALOG NUMBER E CODICE A BARRE
  let rarityBonus = 0;
  const matriz = (vinile.codice_matrice || '').trim();
  const catNo = (vinile.catalog_number || '').trim();
  const origin = (vinile.origine || '').trim();

  if (matriz !== '' && matriz !== '??' && matriz !== 'N/A') {
    rarityBonus += 5.0;
    factors.push(`Codice Matrice Tracciato (${matriz} +€5)`);
  }
  if (catNo !== '' && catNo !== '??' && catNo !== 'N/A') {
    rarityBonus += 3.0;
    factors.push(`N° Catalogo Verificato (${catNo} +€3)`);
  }
  if (origin !== '' && origin !== '??' && (origin.includes('UK') || origin.includes('USA') || origin.includes('JP') || origin.includes('Japan'))) {
    rarityBonus += 4.0;
    factors.push(`Importazione Rara (${origin} +€4)`);
  }

  let computedValue = (baseValue * printMultiplier * conditionMultiplier * bonusMultiplier) + rarityBonus;
  computedValue = Math.max(5, Math.round(computedValue));

  if (!isNaN(userVal) && userVal > 0) {
    return { total: Math.round(userVal), computed: computedValue, isCustom: true, factors };
  }

  return { total: computedValue, computed: computedValue, isCustom: false, factors };
}

// ==========================================
// CONVERTITORE SCALA GOLDMINE (1-10 -> RIGIDO NM, VG+, VG, G+, P)
// ==========================================
function convertRatingToGoldmine(score) {
  const num = parseInt(score);
  if (isNaN(num)) return 'VG+';
  if (num >= 10) return 'M (Mint)';
  if (num >= 9) return 'NM (Near Mint)';
  if (num >= 8) return 'VG+ (Very Good Plus)';
  if (num >= 6) return 'VG (Very Good)';
  if (num >= 4) return 'G+ (Good Plus)';
  if (num >= 2) return 'G (Good)';
  return 'P (Poor / Fair)';
}

let discogsAutoTimer = null;

window.forceRefreshDiscogsPrice = function(vinileId) {
  const container = document.getElementById('discogs-live-box');
  if (container) {
    container.innerHTML = `<span style="opacity: 0.8; font-size: 0.85rem;" class="shimmer-text">🔄 Ricalcolo live in corso...</span>`;
  }
  const vinile = ALL_VINILI.find(v => String(v.id) === String(vinileId));
  if (vinile) {
    // we need to clear the cache for this specific vinyl
    try {
      const priceMap = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
      delete priceMap[vinileId];
      localStorage.setItem('discogs_cached_prices', JSON.stringify(priceMap));
    } catch(e) {}
    fetchDiscogsLivePrice(vinile, 'discogs-live-box', 0, true);
  }
};

// ==========================================
// FASE 1: FETCH ASINCRONA API DISCOGS LIVE (2-STEP CON UTILITY DOM AUTOMATICA)
// ==========================================
window.triggerLivePrice = function(id, estVal) {
  if (typeof ALL_VINILI !== 'undefined') {
    const v = ALL_VINILI.find(x => String(x.id) === String(id));
    if (v && typeof window.fetchDiscogsLivePrice === 'function') {
      window.fetchDiscogsLivePrice(v, 'live-val-box-' + id, estVal, true);
    }
  }
};
window.fetchDiscogsLivePrice = async function(vinile, targetElementId = 'discogs-live-box', estimatedValue = 0, forceRefresh = false) {
  const container = document.getElementById(targetElementId);
  if (!vinile) {
    if (container) {
      container.innerHTML = `<span style="opacity: 0.6;">⚠️ Dati insufficienti per la verifica live</span>`;
    }
    return null;
  }

  try {
    const cachedPrices = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
    const cachedVal = cachedPrices[vinile.id];
    
    if (!forceRefresh && cachedVal !== undefined && cachedVal !== null) {
      if (container) {
        const pText = formatCurrencyPrice(cachedVal === -1 ? null : cachedVal);
        container.innerHTML = `
          <span class="spec-label" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Valore di Mercato (Discogs Live)</span>
            <span style="font-size: 0.7rem; color: #a5b4fc; display: flex; align-items: center; gap: 5px;">
              (In Cache) 
              <button onclick="window.forceRefreshDiscogsPrice('${vinile.id}')" style="background:none; border:none; color: #34d399; cursor:pointer; padding:0; font-size: 1rem;" title="Ricalcola Prezzo">🔄</button>
            </span>
          </span>
          <span class="spec-value" style="color: #34d399; font-weight: 800; font-size: 0.95rem; margin-top: 2px;">
            ${pText}
          </span>
        `;
      }
      return cachedVal === -1 ? null : cachedVal;
    }

    const barcode = (vinile.codice_a_barre && vinile.codice_a_barre !== '??' && vinile.codice_a_barre !== 'N/A') ? vinile.codice_a_barre : '';
    const matrice = (vinile.codice_matrice && vinile.codice_matrice !== '??' && vinile.codice_matrice !== 'N/A') ? vinile.codice_matrice : '';
    
    // Se non ha né barcode né matrice, abortisce direttamente la valutazione live
    if (!barcode && !matrice) {
      if (container) {
        container.innerHTML = `<span style="opacity: 0.6; font-size: 0.85rem;">⚠️ Dati insufficienti: valutazione live disabilitata</span>`;
      }
      return null;
    }

    // Costruiamo la query in base a cosa abbiamo a disposizione
    let searchUrl = '';
    if (barcode) {
      searchUrl = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}&type=release&format=Vinyl`;
    } else {
      searchUrl = `https://api.discogs.com/database/search?query=${encodeURIComponent(matrice)}&type=release&format=Vinyl`;
    }
    
    // Rimuoviamo il vincolo dell'anno per evitare che scarti risultati validi il cui anno su Discogs è leggermente diverso
    const token = getDiscogsToken();
    const headers = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' };
    if (token) headers['Authorization'] = `Discogs token=${token}`;
    const searchRes = await fetch(searchUrl, { headers });

    if (!searchRes.ok) throw new Error('Search request failed');
    const searchData = await searchRes.json();

    if (searchData && searchData.results && searchData.results.length > 0) {
      const bestMatch = searchData.results[0];
      const releaseId = bestMatch.id;
      let lowestPrice = null;

      if (releaseId) {
        try {
          // Aggiungiamo un ritardo globale tra la ricerca e i dettagli per evitare il rate limit (specie senza token)
          await new Promise(res => setTimeout(res, 3000));
          
          let condAvg = 7;
          let d = parseInt(vinile.stato_disco);
          let c = parseInt(vinile.stato_copertina);
          if (!isNaN(d) && !isNaN(c)) condAvg = Math.round((d + c) / 2);
          else if (!isNaN(d)) condAvg = d;
          else if (!isNaN(c)) condAvg = c;

          const reqToken = localStorage.getItem('user_discogs_token') || getDiscogsToken();
          let suggestionFetched = false;
          let effectiveReleaseId = releaseId;

          // (Il tentativo di price_suggestions causava l'errore 404, rimosso per pulizia console)

          if (!suggestionFetched && reqToken) {
            try {
              const authHeaders = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost', 'Authorization': `Discogs token=${reqToken}` };
              const idRes = await fetch('https://api.discogs.com/oauth/identity', { headers: authHeaders });
              if (idRes.ok) {
                const username = (await idRes.json()).username;
                const parseVal = (str) => {
                  if (!str) return 0;
                  return parseFloat(str.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;
                };

                const valRes1 = await fetch(`https://api.discogs.com/users/${username}/collection/value`, { headers: authHeaders, cache: 'no-store' });
                const valData1 = await valRes1.json();
                const m1 = parseVal(valData1.median);

                const addRes = await fetch(`https://api.discogs.com/users/${username}/collection/folders/1/releases/${releaseId}`, { method: 'POST', headers: authHeaders });
                if (addRes.ok) {
                  const instanceId = (await addRes.json()).instance_id;
                  
                  await new Promise(r => setTimeout(r, 800)); // Attesa per aggiornamento db discogs
                  
                  const valRes2 = await fetch(`https://api.discogs.com/users/${username}/collection/value?t=${Date.now()}`, { headers: authHeaders, cache: 'no-store' });
                  const valData2 = await valRes2.json();
                  const m2 = parseVal(valData2.median);

                  await fetch(`https://api.discogs.com/users/${username}/collection/folders/1/releases/${releaseId}/instances/${instanceId}`, { method: 'DELETE', headers: authHeaders });

                  const diff = m2 - m1;
                  if (diff > 0) {
                    const conditionMultipliers = {
                      10: 1.5, 9: 1.3, 8: 1.15, 7: 1.0, 6: 0.9,
                      5: 0.8, 4: 0.7, 3: 0.6, 2: 0.5, 1: 0.4
                    };
                    const mult = conditionMultipliers[condAvg] || 1.0;
                    lowestPrice = diff * mult;
                    suggestionFetched = true;
                  }
                }
              }
            } catch(e) {}
          }

          if (!suggestionFetched) {
            const detailUrl = `https://api.discogs.com/marketplace/stats/${releaseId}`;
            const detailRes = await fetch(detailUrl, {
              headers: { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' }
            });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData && detailData.lowest_price && detailData.lowest_price.value !== null) {
                let val = detailData.lowest_price.value;
                let curr = detailData.lowest_price.currency;
                if (curr === 'USD') val = val / 1.08;
                else if (curr === 'GBP') val = val / 0.85;
                else if (curr === 'CHF') val = val / 0.96;
                else if (curr === 'CAD') val = val / 1.47;
                else if (curr === 'AUD') val = val / 1.65;
                else if (curr === 'JPY') val = val / 160.0;
                lowestPrice = val;
              }
            }
          }
        } catch (_) {}
      }

      const priceText = formatCurrencyPrice(lowestPrice);

      // Salva in cache locale il prezzo (usa -1 se non trovato per evitare infiniti tentativi al riavvio)
      try {
        const priceMap = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
        priceMap[vinile.id] = (lowestPrice === null || lowestPrice === undefined) ? -1 : lowestPrice;
        localStorage.setItem('discogs_cached_prices', JSON.stringify(priceMap));
      } catch (_) {}

      if (container) {
        container.innerHTML = `
          <span class="spec-label" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Valore di Mercato (Discogs Live)</span>
            <a href="${bestMatch.uri ? 'https://www.discogs.com' + bestMatch.uri : 'https://www.discogs.com/release/' + releaseId}" target="_blank" rel="noopener noreferrer" style="font-size: 0.7rem; color: #a5b4fc; text-decoration: underline;">Vedi Release ↗</a>
          </span>
          <span class="spec-value" style="color: #34d399; font-weight: 800; font-size: 0.95rem; margin-top: 2px;">
            ${priceText}
          </span>
        `;
      }

      return { id: releaseId, title: bestMatch.title, lowest_price: lowestPrice };
    } else {
      if (container) {
        const fallbackUrl = `https://www.discogs.com/search/?q=${encodeURIComponent(barcode)}&type=all`;
        container.innerHTML = `
          <span class="spec-label" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Valore di Mercato (Discogs Live)</span>
            <a href="${fallbackUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.7rem; color: #a5b4fc; text-decoration: underline;">Cerca ↗</a>
          </span>
          <span class="spec-value" style="opacity: 0.7; font-size: 0.85rem; margin-top: 2px;">
            Prezzo non disponibile
          </span>
        `;
      }
      return null;
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `<span style="font-size: 0.76rem; opacity: 0.6;">⚠️ Impossibile sincronizzare il mercato Discogs (Offline/Rate limit)</span>`;
    }
    return null;
  }
}

// CONVERTITORE E FORMATTATORE VALUTA SELEZIONATA (EUR, USD, GBP, CHF)
function formatCurrencyPrice(valInEur) {
  if (valInEur === null || valInEur === undefined || isNaN(valInEur)) return 'Prezzo non disponibile';
  const currency = localStorage.getItem('app_user_currency') || 'EUR';
  const num = parseFloat(valInEur);
  
  if (currency === 'USD') return `a partire da $${(num * 1.08).toFixed(2)}`;
  if (currency === 'GBP') return `a partire da £${(num * 0.85).toFixed(2)}`;
  if (currency === 'CHF') return `a partire da CHF ${(num * 0.96).toFixed(2)}`;
  return `a partire da €${num.toFixed(2)}`;
}

function getCurrencySymbol() {
  const currency = localStorage.getItem('app_user_currency') || 'EUR';
  if (currency === 'USD') return '$';
  if (currency === 'GBP') return '£';
  if (currency === 'CHF') return 'CHF ';
  return '€';
}

function convertValueToCurrency(valInEur) {
  const currency = localStorage.getItem('app_user_currency') || 'EUR';
  const num = parseFloat(valInEur) || 0;
  if (currency === 'USD') return Math.round(num * 1.08);
  if (currency === 'GBP') return Math.round(num * 0.85);
  if (currency === 'CHF') return Math.round(num * 0.96);
  return Math.round(num);
}

// SINCRONIZZAZIONE AUTOMATICA DI TUTTI I DISCHI IN BACKGROUND (BATCH QUEUE CON PACING 1 SECONDO)
let isDiscogsBatchSyncing = false;
async function syncAllDiscogsPrices(force = false, ignoreFrequencyCheck = false) {
  if (isDiscogsBatchSyncing) return;

  const freq = localStorage.getItem('app_discogs_sync_freq') || 'AUTO_ALWAYS';
  const lastSync = localStorage.getItem('app_discogs_last_sync_date');
  const today = new Date().toISOString().slice(0, 10);

  if (!force && !ignoreFrequencyCheck) {
    if (freq === 'MANUAL') return;
    if (freq === 'DAILY' && lastSync === today) return;
    if (freq === 'EVERY_3_DAYS' && lastSync) {
      const msInDay = 24 * 60 * 60 * 1000;
      const daysSince = Math.floor((new Date() - new Date(lastSync)) / msInDay);
      if (daysSince < 3) return;
    }
  }

  isDiscogsBatchSyncing = true;
  if (force) showToast("🔄 Avvio risincronizzazione automatica Discogs...");

  const syncOverlay = document.getElementById('sync-overlay');
  const syncCounter = document.getElementById('sync-counter');
  if (force && syncOverlay) syncOverlay.setAttribute('aria-hidden', 'false');

  try {
    const personalVinyls = ALL_VINILI.filter(v => {
      const cat = (v.stato_catalogo || 'personale').toLowerCase();
      const isPersonal = cat.includes('personale') || cat === '';
      
      const hasBarcode = v.codice_a_barre && v.codice_a_barre !== '??' && v.codice_a_barre !== 'N/A' && v.codice_a_barre.trim() !== '';
      
      return isPersonal && hasBarcode;
    });

    const priceMap = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
    let count = 0;
    const total = personalVinyls.length;

    for (const vinile of personalVinyls) {
      count++;
      if (force && syncCounter) syncCounter.textContent = `${count} / ${total}`;

      if (force || !priceMap[vinile.id]) {
        await fetchDiscogsLivePrice(vinile, null);
        await new Promise(res => setTimeout(res, 6000)); // Aumentato a 6000ms per rispettare rate limits severi (max 10 vinili/minuto = 60 req/min con l'hacker hack)
      }
    }

    localStorage.setItem('app_discogs_last_sync_date', today);
    if (force) showToast("✅ Risincronizzazione Discogs Completata!");
  } finally {
    isDiscogsBatchSyncing = false;
    if (force && syncOverlay) syncOverlay.setAttribute('aria-hidden', 'true');
  }
}


// NOTIFICHE TOAST FEEDBACK
window.showToast = showToast;
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('active'), 10);
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// POPOLA SELECT GENERI
function populateGenreSelect() {
  const genres = Array.from(new Set(ALL_VINILI.map(v => v.genere).filter(Boolean))).sort();
  if (filterGenreSelect) {
    filterGenreSelect.innerHTML = '<option value="">Tutti i Generi</option>' + 
      genres.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
  }
}
populateGenreSelect();

function getDiscogsPrice(v) {
  const price = currentCachedPrices[v.id];
  if (price === -1) return (parseFloat(v.valore_stimato) || 0);
  return (price !== undefined && price !== null) ? parseFloat(price) : (parseFloat(v.valore_stimato) || 0);
}

// ALGORITMO DI FILTRAGGIO & ORDINAMENTO
function applyFiltering() {
  currentCachedPrices = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
  filteredVinili = ALL_VINILI.filter(vinile => {
    if (activeCategory !== 'ALL') {
      const statusStr = (vinile.stato_catalogo || '').toLowerCase();
      const targetCat = activeCategory.toLowerCase();
      if (targetCat === 'wishlist' && !statusStr.includes('wish')) return false;
      if (targetCat === 'personale' && !statusStr.includes('personale')) return false;
      if (targetCat === 'eredità' && (!statusStr.includes('eredit') && !statusStr.includes('eredita'))) return false;
      if (targetCat === 'vendita' && (!statusStr.includes('vendita') && !statusStr.includes('scambio'))) return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const qDigits = q.replace(/[^0-9]/g, '');
      const matchArtist = (vinile.artista || '').toLowerCase().includes(q);
      const matchAlbum = (vinile.titolo_album || '').toLowerCase().includes(q);
      const matchCat = (vinile.catalog_number || '').toLowerCase().includes(q) ||
                       (qDigits && qDigits.length >= 4 && (
                         (vinile.catalog_number || '').replace(/[^0-9]/g, '').includes(qDigits) ||
                         qDigits.includes((vinile.catalog_number || '').replace(/[^0-9]/g, ''))
                       ));
      const matchMatrice = (vinile.codice_matrice || '').toLowerCase().includes(q) ||
                           (qDigits && qDigits.length >= 4 && (
                             (vinile.codice_matrice || '').replace(/[^0-9]/g, '').includes(qDigits) ||
                             qDigits.includes((vinile.codice_matrice || '').replace(/[^0-9]/g, ''))
                           ));
      const matchNotes = (vinile.note_stato || '').toLowerCase().includes(q);
      const matchPosizione = (vinile.posizione_fisica || '').toLowerCase().includes(q);
      const matchId = String(vinile.id) === q;
      if (!matchArtist && !matchAlbum && !matchCat && !matchMatrice && !matchNotes && !matchPosizione && !matchId) return false;
    }

    const anno = parseInt(vinile.anno_uscita_originale || vinile.anno_stampa);
    if (filterYearFrom && !isNaN(filterYearFrom) && anno < filterYearFrom) return false;
    if (filterYearTo && !isNaN(filterYearTo) && anno > filterYearTo) return false;

    const price = getDiscogsPrice(vinile);
    if (filterPriceFrom !== null && !isNaN(filterPriceFrom) && price < filterPriceFrom) return false;
    if (filterPriceTo !== null && !isNaN(filterPriceTo) && price > filterPriceTo) return false;

    if (filterGenre && (vinile.genere || '') !== filterGenre) return false;

    return true;
  });

  if (sortStrategy === 'YEAR_ASC') {
    filteredVinili.sort((a, b) => (a.anno_uscita_originale || a.anno_stampa) - (b.anno_uscita_originale || b.anno_stampa));
  } else if (sortStrategy === 'YEAR_DESC') {
    filteredVinili.sort((a, b) => (b.anno_uscita_originale || b.anno_stampa) - (a.anno_uscita_originale || a.anno_stampa));
  } else if (sortStrategy === 'ARTIST_ASC') {
    filteredVinili.sort((a, b) => (a.artista || '').localeCompare(b.artista || ''));
  } else if (sortStrategy === 'ALBUM_ASC') {
    filteredVinili.sort((a, b) => (a.titolo_album || '').localeCompare(b.titolo_album || ''));
  } else if (sortStrategy === 'RATING_DESC') {
    filteredVinili.sort((a, b) => (parseInt(b.stato_disco) || 0) - (parseInt(a.stato_disco) || 0));
  } else if (sortStrategy === 'COMPLETENESS_DESC') {
    filteredVinili.sort((a, b) => {
      const getScore = (v) => Object.values(v).filter(val => val && val !== '??' && val !== 'N/A' && val !== '').length;
      return getScore(b) - getScore(a);
    });
  } else if (sortStrategy === 'PRICE_DESC') {
    filteredVinili.sort((a, b) => getDiscogsPrice(b) - getDiscogsPrice(a));
  } else if (sortStrategy === 'PRICE_ASC') {
    filteredVinili.sort((a, b) => getDiscogsPrice(a) - getDiscogsPrice(b));
  }

  selectedIndex = 0;
  // console.log(`[Titoli] applyFiltering: ${filteredVinili.length} vinili da mostrare`);
  renderWheel();
  updateWheel();
  updateCenterContent(selectedIndex);
}

// RENDER RUOTA TITOLI TRASPARENTE 3D
function renderWheel() {
  if (!wheelContainer) {
    console.warn("[Titoli] wheelContainer non trovato nel DOM!");
    return;
  }
  wheelContainer.innerHTML = '';

  if (filteredVinili.length === 0) {
    const isGuest = !localStorage.getItem('app_current_user');
    const emptyItem = document.createElement("div");
    emptyItem.className = "wheel-item";
    
    if (isGuest) {
        emptyItem.innerHTML = `<div style="text-align:center; padding: 10px;">
            <p style="font-size:1.1rem; font-weight:bold; margin-bottom:10px;">Benvenuto</p>
            <button onclick="window.openExploreModal()" class="btn-primary" style="padding: 10px 20px;">🌍 Esplora</button>
        </div>`;
    } else {
        emptyItem.textContent = "Nessun vinile trovato";
    }
    
    wheelContainer.appendChild(emptyItem);
    wheelItems = [emptyItem];
    return;
  }

  filteredVinili.forEach((vinile, idx) => {
    const item = document.createElement("div");
    item.className = "wheel-item";
    const displayName = cleanMusicTitle(vinile.titolo_album || "Sconosciuto");
    item.textContent = displayName;
    
    item.addEventListener("click", () => {
      selectIndex(idx);
      if (typeof closeMobileDrawer === "function") {
        closeMobileDrawer();
      }
    });
    
    wheelContainer.appendChild(item);
  });

  wheelItems = Array.from(wheelContainer.querySelectorAll(".wheel-item"));
}

function updateWheel() {
  if (!wheelContainer || filteredVinili.length === 0) return;

  wheelItems.forEach((item, index) => {
    let distance = index - selectedIndex;
    const absDist = Math.abs(distance);
    const isSelected = distance === 0;

    const translateY = distance * 2.7; 
    const curveOffset = Math.pow(absDist, 1.4) * 11; // Rimosso il meno, curva verso destra
    const rotateX = distance * -5.5; 
    const opacity = isSelected ? 1 : Math.max(0.05, 0.4 - absDist * 0.15);
    const scale = isSelected ? 1.05 : Math.max(0.76, 1 - absDist * 0.08);

    item.style.color = isSelected ? "#ffffff" : "#cbd5e1";
    item.style.fontWeight = isSelected ? "700" : "400";
    item.style.opacity = opacity;
    item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg) scale(${scale})`;
    
    if (isSelected) {
      item.style.textShadow = "0 0 16px rgba(255, 159, 252, 0.7), 0 2px 10px rgba(0,0,0,0.95)";
    } else {
      item.style.textShadow = "0 2px 8px rgba(0,0,0,0.9)";
    }
  });
}

function updateCenterContent(index) {
  if (!centerContent) return;
  
  if (filteredVinili.length === 0) {
    const isGuest = !localStorage.getItem('app_current_user');
    if (isGuest) {
        centerContent.innerHTML = `
          <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; text-align:center; padding: 20px;">
            <h2 style="color:white; margin-bottom: 10px; font-size: 1.8rem; font-weight: 800;">Benvenuto nella Community</h2>
            <p style="color:#9ca3af; margin-bottom: 30px; max-width: 300px; line-height: 1.5;">In modalità ospite non hai una collezione personale, ma puoi esplorare quelle degli altri.</p>
            <button id="guest-explore-btn-center" class="btn-primary" style="font-size: 1.2rem; padding: 15px 30px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4); border-radius: 50px;">🌍 Esplora Utenti</button>
          </div>
        `;
        setTimeout(() => {
            const btn = document.getElementById('guest-explore-btn-center');
            if (btn) btn.addEventListener('click', window.openExploreModal);
        }, 50);
    } else {
        centerContent.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: #cbd5e1;">
            <h2>💿 Nessun Vinile Trovato</h2>
            <p style="margin-top: 10px; opacity: 0.7;">Prova a resettare i filtri o la ricerca.</p>
          </div>
        `;
    }
    if (mobileCounter) mobileCounter.textContent = "0 / 0";
    return;
  }

  if (updateContentTimeout) clearTimeout(updateContentTimeout);
  centerContent.classList.add("fade-out");
  
  updateContentTimeout = setTimeout(() => {
    try {
      const vinile = filteredVinili[index];
      const sv = safeVinile(vinile);
      if (!vinile) return;

      const tracceHTML = sv.tracce && sv.tracce.length > 0 ? `
        <div class="section-title">🎵 Tracklist (${sv.tracce.length} Tracce)</div>
        <div class="tracklist-container">
          ${sv.tracce.map(t => `
            <div class="track-item">
              <span class="track-pos">${t.pos}</span>
              <span class="track-title">${t.title}</span>
              <span class="track-duration">${t.duration}</span>
            </div>
          `).join('')}
        </div>
      ` : '';

      const fotoHTML = vinile.foto_album && vinile.foto_album.length > 0 ? `
        <div class="action-buttons-row" style="margin-top: 0.8rem;">
          <button type="button" class="qr-sticker-action-btn full-width" style="background: rgba(82, 39, 255, 0.22); border-color: rgba(165, 180, 252, 0.45); color: #a5b4fc;" onclick="window.openGalleryModal('${vinile.id}')">
            📷 Vedi Foto Album (${vinile.foto_album.length})
          </button>
        </div>
      ` : '';

      const fallbackCover = generateSVGAlbumCover(vinile.artista, vinile.titolo_album);
      const coverSrc = (vinile.cover && vinile.cover.trim() !== '') ? vinile.cover : fallbackCover;

      // Calcola stima valore professionale per l'album
      const valData = calculateVinylValue(vinile);
      const estimatedValue = valData.total;

      const catalogNum = sv.catalog_number || (vinile.labels && vinile.labels.length > 0 ? vinile.labels[0].catno : '');
      const barcodeObj = vinile.identifiers && Array.isArray(vinile.identifiers) ? vinile.identifiers.find(i => i.type && i.type.toLowerCase() === 'barcode') : null;
      const barcode = sv.codice_a_barre || (barcodeObj ? barcodeObj.value : '');
      const noteRel = vinile.notes || vinile.note_release || '';

      // Prepara le labels complete (nome + catno)
      const labelsFullHTML = vinile.labels && Array.isArray(vinile.labels) && vinile.labels.length > 0
        ? vinile.labels.map(l => `${escapeHtml(l.name || '')}${l.catno ? ' <span style="color:#9ca3af;">(' + escapeHtml(l.catno) + ')</span>' : ''}`).join(', ')
        : '';

      // Prepara il formato (es. Vinyl, LP, Album, Stereo)
      const formatHTML = vinile.formats && Array.isArray(vinile.formats) && vinile.formats.length > 0
        ? vinile.formats.map(f => {
            let desc = escapeHtml(f.name || '');
            if (f.qty && f.qty !== '1') desc += ' ×' + escapeHtml(f.qty);
            if (f.descriptions && f.descriptions.length > 0) desc += ' (' + f.descriptions.map(d => escapeHtml(d)).join(', ') + ')';
            if (f.text) desc += ' – ' + escapeHtml(f.text);
            return desc;
          }).join(' | ')
        : '';

      // Paese
      const country = vinile.country || '';

      // Stili musicali
      const stylesHTML = vinile.styles && Array.isArray(vinile.styles) && vinile.styles.length > 0
        ? vinile.styles.map(s => escapeHtml(s)).join(', ')
        : '';

      // Companies (studi, stampatori, copyright)
      const companiesHTML = vinile.companies && Array.isArray(vinile.companies) && vinile.companies.length > 0
        ? vinile.companies.map(c => `<span style="color:#cbd5e1;">${escapeHtml(c.name || '')}</span> <span style="color:#9ca3af; font-size: 0.8rem;">(${escapeHtml(c.entity_type_name || '')})</span>`).join('<br>')
        : '';

      // Identifiers (matrici, barcode, rights society ecc.)
      const matrixIdentifiers = vinile.identifiers && Array.isArray(vinile.identifiers)
        ? vinile.identifiers.filter(i => i.type && i.type.toLowerCase().includes('matrix'))
        : [];
      const otherIdentifiers = vinile.identifiers && Array.isArray(vinile.identifiers)
        ? vinile.identifiers.filter(i => i.type && !i.type.toLowerCase().includes('matrix') && !i.type.toLowerCase().includes('barcode'))
        : [];

      // Stato disco e copertina con scala Goldmine
      const discRating = vinile.stato_disco && vinile.stato_disco !== 'Da Valutare' ? vinile.stato_disco : '';
      const coverRating = vinile.stato_copertina && vinile.stato_copertina !== 'Da Valutare' ? vinile.stato_copertina : '';
      const discGoldmine = discRating ? convertRatingToGoldmine(discRating) : '';
      const coverGoldmine = coverRating ? convertRatingToGoldmine(coverRating) : '';

      const renderRow = (label, value) => {
        if (!value || value === 'undefined' || value === 'N/A' || String(value).trim() === '') return '';
        return `
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 6px; margin-bottom: 4px;">
            <span style="color: #ffffff; font-size: 0.8rem; opacity: 0.9;">${label}</span>
            <span style="color: #ffffff; font-size: 0.85rem; font-weight: 500; text-align: right; max-width: 65%; word-break: break-word;">${value}</span>
          </div>
        `;
      };

      const renderBlock = (label, value) => {
        if (!value || value === 'undefined' || value === 'N/A' || String(value).trim() === '') return '';
        return `
          <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 12px; margin-top: 8px; border: 1px solid rgba(255,255,255,0.04);">
            <div style="color: var(--primary-color, #ffffff); filter: brightness(1.2) saturate(1.2); text-shadow: 0 1px 3px rgba(0,0,0,0.9); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">${label}</div>
            <div style="color: #ffffff; font-size: 0.85rem; line-height: 1.5;">${value}</div>
          </div>
        `;
      };

      const renderCard = (title, icon, content) => {
        if (!content || !content.trim()) return '';
        return `
          <div style="background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 8px 16px -4px rgba(0,0,0,0.2);">
            <div style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary-color, #ffffff); filter: brightness(1.25) saturate(1.2); text-shadow: 0 1px 4px rgba(0,0,0,0.9); margin-bottom: 14px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
              <span style="font-size: 1.1rem; filter: none;">${icon}</span> ${title}
            </div>
            <div style="display: flex; flex-direction: column;">
              ${content}
            </div>
          </div>
        `;
      };

      // 1. Dettagli Edizione
      const edHTML = 
        renderRow("Etichetta", labelsFullHTML || sv.etichetta) +
        renderRow("Catalogo", catalogNum) +
        renderRow("Formato", formatHTML) +
        renderRow("Paese", escapeHtml(country)) +
        renderRow("Anno Stampa", vinile.anno_stampa ? escapeHtml(String(vinile.anno_stampa)) : '') +
        renderRow("Origine/Edizione", sv.origine) +
        renderRow("Stile", stylesHTML);
      
      // 2. Caratteristiche Fisiche
      const fisHTML = 
        renderRow("Velocità", sv.velocita) +
        renderRow("Grammatura", sv.grammatura) +
        renderRow("Colore", sv.colore) +
        renderRow("Inserti", sv.inserti);

      // 3. Valore e Archivio
      let valHTML = 
        (sv.valore_stimato ? renderRow("Valore Iniziale", `€${Number(sv.valore_stimato).toFixed(2)}`) : '') +
        (estimatedValue ? renderRow("Stima di Mercato", `<span style="color:#34d399; font-weight:700;">€${Number(estimatedValue).toFixed(2)}</span>`) : '') +
        (sv.data_aggiunta ? renderRow("Data Aggiunta", escapeHtml(new Date(sv.data_aggiunta).toLocaleDateString())) : '');

      const hasLiveIdentifiers = (barcode && barcode !== 'undefined' && barcode !== 'N/A') || (sv.codice_matrice && sv.codice_matrice !== 'undefined' && sv.codice_matrice !== 'N/A') || matrixIdentifiers.length > 0;
      const hasLiveConditions = discRating && coverRating && discRating !== 'Da Valutare' && coverRating !== 'Da Valutare';
      
      if (hasLiveIdentifiers && hasLiveConditions) {
        valHTML += `
          <div id="live-val-box-${vinile.id}" style="margin-top: 12px;">
            <button type="button" class="btn-secondary" style="width: 100%; padding: 12px; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(52, 211, 153, 0.2); background: rgba(52, 211, 153, 0.1); border-radius: 8px; cursor: pointer; color: #34d399; font-weight: 700; transition: all 0.2s ease;" onclick="this.style.display='none'; window.triggerLivePrice('${escapeHtml(String(vinile.id))}', ${estimatedValue || 0})">
              📡 Calcola Valore Live Reale (Discogs)
            </button>
          </div>
        `;
      }

      // 4. Identificatori
      let idHTML = 
        renderRow("Barcode", barcode) +
        renderRow("Matrice (Personale)", sv.codice_matrice);
      
      if (matrixIdentifiers.length > 0) {
        const matList = matrixIdentifiers.map(m => `<div style="margin-bottom: 4px; font-size: 0.8rem;">• ${escapeHtml(m.value)}${m.description ? ` <span style="opacity: 0.5;">(${escapeHtml(m.description)})</span>` : ''}</div>`).join('');
        idHTML += renderBlock("Codici Matrice / Runout", matList);
      }
      if (otherIdentifiers.length > 0) {
        const othList = otherIdentifiers.map(i => `<div style="margin-bottom: 4px; font-size: 0.8rem;">• <span style="color: #94a3b8;">${escapeHtml(i.type)}:</span> ${escapeHtml(i.value)}${i.description ? ` <span style="opacity: 0.5;">(${escapeHtml(i.description)})</span>` : ''}</div>`).join('');
        idHTML += renderBlock("Altri Identificatori", othList);
      }
      if (sv.id) idHTML += renderRow("ID Sistema", `<span style="font-family: monospace; font-size: 0.75rem; color:#64748b;">${sv.id}</span>`);

      // 5. Stato e Valutazione
      let statoHTML = '';
      if (discRating || coverRating) {
        statoHTML += `<div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
          ${discRating ? `<div style="flex: 1; min-width: 120px; background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 0.76rem; color: #34d399; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Stato Disco</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #fff; text-shadow: 0 2px 10px rgba(52, 211, 153, 0.4);">${escapeHtml(String(discRating))}<span style="font-size: 0.9rem; color: rgba(255,255,255,0.5);">/10</span></div>
            <div style="font-size: 0.75rem; color: #a7f3d0; margin-top: 4px; font-weight: 600;">${escapeHtml(discGoldmine)}</div>
          </div>` : ''}
          ${coverRating ? `<div style="flex: 1; min-width: 120px; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 0.76rem; color: #60a5fa; margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Copertina</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #fff; text-shadow: 0 2px 10px rgba(96, 165, 250, 0.4);">${escapeHtml(String(coverRating))}<span style="font-size: 0.9rem; color: rgba(255,255,255,0.5);">/10</span></div>
            <div style="font-size: 0.75rem; color: #bfdbfe; margin-top: 4px; font-weight: 600;">${escapeHtml(coverGoldmine)}</div>
          </div>` : ''}
        </div>`;
      }
      statoHTML += renderRow("📍 Posizione", sv.posizione_fisica);
      statoHTML += renderBlock("Note Personali", sv.note_stato);

      // 6. Approfondimenti Release
      let relHTML = '';
      if (noteRel && noteRel !== 'undefined') {
        relHTML += renderBlock("Info Release", noteRel.length > 300 ? escapeHtml(noteRel.substring(0, 300)) + '...' : escapeHtml(noteRel));
      }
      if (companiesHTML) {
        relHTML += renderBlock("Aziende / Credits", companiesHTML);
      }

      const infoDettagliateHTML = `
        <div class="section-title" style="margin-top: 20px; font-size: 1.2rem;">🔍 Info Dettagliate</div>
        <div class="info-dettagliate-container" style="display: flex; flex-direction: column; margin-bottom: 10px;">
          ${renderCard("Dettagli Edizione", "💿", edHTML)}
          ${renderCard("Caratteristiche", "⚖️", fisHTML)}
          ${renderCard("Identificativi", "🏷️", idHTML)}
          ${renderCard("Valore & Archivio", "💰", valHTML)}
          ${renderCard("Approfondimenti", "📖", relHTML)}
        </div>
      `;

      const statoFinaleHTML = `
        <div class="info-dettagliate-container" style="display: flex; flex-direction: column; margin-top: 10px; margin-bottom: 20px;">
          ${renderCard("Stato & Note Personali", "⭐", statoHTML)}
        </div>
      `;

      const hasBarcode = barcode && barcode !== 'undefined' && barcode !== 'N/A';
      const personalMatrix = sv.codice_matrice && sv.codice_matrice !== 'undefined' && sv.codice_matrice !== 'N/A' ? sv.codice_matrice : null;
      const apiMatrix = matrixIdentifiers.length > 0 ? matrixIdentifiers[0].value : null;
      const matrixToCopy = personalMatrix || apiMatrix;
      const hasMatrixToCopy = !!matrixToCopy;

      const copyButtonsHTML = (hasBarcode || hasMatrixToCopy) ? `
        <div class="action-buttons-row" style="margin-top: 0.8rem; display: flex; gap: 10px; margin-bottom: 20px;">
          ${hasMatrixToCopy ? `
            <button type="button" class="btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); border-radius: 8px; cursor: pointer; color: #cbd5e1;" onclick="navigator.clipboard.writeText('${escapeHtml(String(matrixToCopy))}').then(() => { if (typeof showToast === 'function') showToast('Matrice copiata!'); })">
              📋 Copia Matrice
            </button>
          ` : ''}
          ${hasBarcode ? `
            <button type="button" class="btn-secondary" style="flex: 1; font-size: 0.85rem; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); border-radius: 8px; cursor: pointer; color: #cbd5e1;" onclick="navigator.clipboard.writeText('${escapeHtml(String(barcode))}').then(() => { if (typeof showToast === 'function') showToast('Barcode copiato!'); })">
              📋 Copia Barcode
            </button>
          ` : ''}
        </div>
      ` : '';

      centerContent.innerHTML = `
        <div class="vinyl-hero gallery-stage">
          <!-- FARETTO DI LUCE DALL'ALTO (TOP SPOTLIGHT) -->
          <div class="hero-spotlight"></div>
          
          <div class="floating-art-wrapper">
            <div id="cover-wrapper-btn" class="album-cover-wrapper" title="Clicca per estrarre il vinile!">
              <img class="album-cover-img" crossorigin="anonymous" src="${coverSrc}" alt="${vinile.titolo_album}" width="170" height="170" loading="eager" onerror="this.onerror=null; this.src='${fallbackCover}';">
              <div class="vinyl-disc"></div>
            </div>
            <!-- PROFONDA OMBRA 3D PROIETTATA SULLO SFONDO -->
            <div class="floating-floor-shadow"></div>
          </div>
          
          <div class="play-hint-badge">🎵 Clicca la copertina per estrarre il vinile</div>
          <h1 class="album-title-main" style="margin-top: 6px;">${sv.titolo_album}</h1>
          <div class="artist-name-sub">${sv.artista}</div>
          
          <div class="genre-year-badge">
            <span class="badge badge-purple">${sv.genere || 'Vinile'}</span>
            <span class="badge badge-pink">${sv.anno_uscita_originale || sv.anno_stampa || 'N/A'}</span>
            <span class="badge">${sv.stato_catalogo || 'Personale'}</span>
          </div>
        </div>

        ${infoDettagliateHTML}
        ${tracceHTML}
        ${statoFinaleHTML}
        ${fotoHTML}
        ${copyButtonsHTML}
      `;
      
      // INVOCAZIONE REALE AL CARICAMENTO/CAMBIO VINILE
      const currentImgEl = centerContent.querySelector('.album-cover-img');
      if (currentImgEl) {
        const loadColors = (imgEl) => {
          if (imgEl.complete && imgEl.naturalWidth !== 0) {
            extractDominantColors(imgEl);
          } else {
            imgEl.onload = () => extractDominantColors(imgEl);
          }
        };

        // Forza sempre il fetching online per sostituire la copertina placeholder
        getAlbumArt(sv.artista, sv.titolo_album, vinile.id).then(url => {
          if (url) {
            currentImgEl.src = url;
            currentImgEl.style.opacity = 0;
            setTimeout(() => {
              currentImgEl.style.transition = 'opacity 0.4s ease-in-out';
              currentImgEl.style.opacity = 1;
              loadColors(currentImgEl);
            }, 50);
          } else {
            loadColors(currentImgEl);
          }
        });
      }

      // GESTIONE INTERATTIVA GIRADISCHI 3D (CLIC SULLA COPERTINA ESCE IL VINILE)
      const coverWrapper = document.getElementById("cover-wrapper-btn");
      if (coverWrapper) {
        coverWrapper.addEventListener("click", () => {
          coverWrapper.classList.toggle("playing");
          const isPlaying = coverWrapper.classList.contains("playing");
          if (isPlaying) {
            showToast("▶️ Vinile estratto e in riproduzione!");
            if (navigator.vibrate) navigator.vibrate([25, 40, 25]);
          } else {
            showToast("⏸️ Vinile reinserito nella custodia");
            if (navigator.vibrate) navigator.vibrate(15);
          }
        });

        coverWrapper.addEventListener("pointermove", (e) => {
          const rect = coverWrapper.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          const rotateX = (y / (rect.height / 2)) * -14;
          const rotateY = (x / (rect.width / 2)) * 14;
          coverWrapper.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04)`;
        });

        coverWrapper.addEventListener("pointerleave", () => {
          coverWrapper.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
        });
      }

      // TOGGLE TENDINA FATTORI VALORE STIMATO
      const factorsHeader = document.getElementById("toggle-factors-header");
      const factorsList = document.getElementById("value-factors-list");
      const factorsArrow = document.getElementById("factors-arrow");
      if (factorsHeader && factorsList) {
        factorsHeader.addEventListener("click", () => {
          const isHidden = factorsList.classList.toggle("hidden");
          if (factorsArrow) {
            factorsArrow.style.transform = isHidden ? "rotate(-90deg)" : "rotate(0deg)";
          }
        });
      }

      // ESECUZIONE AUTOMATICA CON DEBOUNCE A 600MS (INCLUDENDO NOTE ED INSERTI NELLA RICERCA)
      if (discogsAutoTimer) clearTimeout(discogsAutoTimer);

      discogsAutoTimer = setTimeout(() => {
        if (!isDiscogsBatchSyncing) {
          fetchDiscogsLivePrice(vinile, 'discogs-live-box', estimatedValue);
        } else {
          const container = document.getElementById('discogs-live-box');
          if (container) container.innerHTML = '<span style="opacity:0.6;">Sincronizzazione in corso...</span>';
        }
      }, 600);
    } catch (renderError) {
      console.error("Errore di rendering vinile:", renderError);
      try {
        const vinile = filteredVinili[index];
        centerContent.innerHTML = `
          <div style="text-align:center; padding: 40px 20px; color: #cbd5e1;">
            <div style="font-size: 2rem; margin-bottom: 12px;">🎵</div>
            <h2 style="font-size: 1.1rem; color: #fff; margin-bottom: 8px;">${vinile ? (vinile.titolo_album || 'Album') : 'Album'}</h2>
            <p style="opacity:0.6; font-size: 0.85rem;">${vinile ? (vinile.artista || '') : ''}</p>
            <p style="margin-top: 16px; font-size: 0.78rem; opacity: 0.45;">Impossibile caricare alcuni dettagli.<br>Scorri i titoli per continuare.</p>
          </div>
        `;
      } catch (_) { }
    } finally {
      centerContent.classList.remove("fade-out");
      centerContent.scrollTop = 0;
    }
  }, 120);

  if (mobileCounter) {
    mobileCounter.textContent = `${index + 1} / ${filteredVinili.length}`;
  }
}

function triggerWheelAnimation() { updateWheel(); }

function selectIndex(newIndex) {
  if (filteredVinili.length === 0) return;
  const targetIndex = Math.max(0, Math.min(newIndex, filteredVinili.length - 1));
  
  if (targetIndex !== selectedIndex) {
    selectedIndex = targetIndex;
    triggerWheelAnimation();
    updateCenterContent(selectedIndex); 
  }
}

// SCORRIMENTO FLUIDO DELLA RUOTA CON ROTELLA E TOUCH SWIPE (SENZA TREMOLIO)
if (wheelContainer) {
  let lastWheelTime = 0;

  window.addEventListener('wheel', (e) => {
    if (e.target.closest('.modal-content') || e.target.closest('.center-content') || e.target.closest('.discogs-results-list')) {
      return;
    }

    const now = performance.now();
    if (now - lastWheelTime < 60) return; // Limita l'aggiornamento a 16 step al secondo max per evitare flickering

    if (Math.abs(e.deltaY) > 8) {
      lastWheelTime = now;
      const step = Math.sign(e.deltaY);
      selectIndex(selectedIndex + step);
    }
  }, { passive: true });

  // Touch Swipe per mobile e touch display
  let touchStartY = 0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.target.closest('.modal-content') || e.target.closest('.center-content')) return;
    if (e.touches.length === 1) {
      const currentY = e.touches[0].clientY;
      const diffY = touchStartY - currentY;
      const threshold = 35;
      
      if (Math.abs(diffY) >= threshold) {
        const step = Math.sign(diffY);
        selectIndex(selectedIndex + step);
        touchStartY = currentY;
      }
    }
  }, { passive: true });
}

// GESTIONE CHIPS CATEGORIA DENTRO MODAL FILTRI
document.querySelectorAll('.category-chips .chip-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.category-chips .chip-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeCategory = e.target.getAttribute('data-category');
  });
});

// SEARCH EVENT LISTENERS
if (toggleSearchBtn) {
  toggleSearchBtn.addEventListener('click', () => {
    searchBarWrapper.classList.toggle('hidden');
    if (!searchBarWrapper.classList.contains('hidden')) {
      searchInput.focus();
    }
  });
}
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltering();
  });
}
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    applyFiltering();
  });
}

// FILTERS & SORTING MODAL
if (openFilterBtn) {
  openFilterBtn.addEventListener('click', () => {
    filterModal.classList.add('active');
    filterModal.setAttribute('aria-hidden', 'false');
  });
}
if (closeFilterModalBtn) {
  closeFilterModalBtn.addEventListener('click', () => {
    if (document.activeElement) document.activeElement.blur();
    filterModal.classList.remove('active');
    filterModal.setAttribute('aria-hidden', 'true');
  });
}
if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener('click', async () => {
    filterYearFrom = parseInt(filterYearFromInput.value) || null;
    filterYearTo = parseInt(filterYearToInput.value) || null;
    filterPriceFrom = filterPriceFromInput.value ? parseFloat(filterPriceFromInput.value) : null;
    filterPriceTo = filterPriceToInput.value ? parseFloat(filterPriceToInput.value) : null;
    filterGenre = filterGenreSelect.value;
    sortStrategy = sortSelect.value;

    if (filterPriceFrom !== null || filterPriceTo !== null || sortStrategy === 'PRICE_DESC' || sortStrategy === 'PRICE_ASC') {
      applyFiltersBtn.disabled = true;
      const originalText = applyFiltersBtn.innerText;
      applyFiltersBtn.innerText = "Sincronizzazione in corso...";
      showToast("Recupero valori Discogs mancanti... potrebbe richiedere del tempo per evitare blocchi.");
      isDiscogsBatchSyncing = false; // Reset to ensure it runs
      await syncAllDiscogsPrices(false, true);
      applyFiltersBtn.disabled = false;
      applyFiltersBtn.innerText = originalText;
    }

    filterModal.classList.remove('active');
    applyFiltering();
    showToast("Filtri ed Ordinamento applicati!");
  });
}
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener('click', () => {
    filterYearFromInput.value = '';
    filterYearToInput.value = '';
    if (filterPriceFromInput) filterPriceFromInput.value = '';
    if (filterPriceToInput) filterPriceToInput.value = '';
    filterGenreSelect.value = '';
    sortSelect.value = 'DEFAULT';
    filterYearFrom = null;
    filterYearTo = null;
    filterPriceFrom = null;
    filterPriceTo = null;
    filterGenre = '';
    sortStrategy = 'DEFAULT';
    activeCategory = 'ALL';
    document.querySelectorAll('.category-chips .chip-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-category') === 'ALL');
    });
    filterModal.classList.remove('active');
    applyFiltering();
    showToast("Filtri resettati");
  });
}

window.forceRescanDatabase = async function(btnElement) {
  if (btnElement) {
    btnElement.innerHTML = "⏳ Scansione in corso...";
    btnElement.style.opacity = "0.7";
    btnElement.style.pointerEvents = "none";
  }
  
  alert("Inizio Scansione! Questa operazione potrebbe richiedere qualche istante. Premi OK per continuare.");
  
  if (typeof showToast === 'function') showToast("🔄 Avvio scansione completa del database...");
  
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) loadingScreen.style.display = 'flex';
  
  try {
    const currentUser = localStorage.getItem('app_current_user');
    let rawUserVinyls = JSON.parse(localStorage.getItem('app_user_vinyls_cache') || '[]');
    
    if (currentUser) {
      try {
        rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
      } catch(e) {
        console.warn("Recupero da GitHub fallito, uso la cache locale", e);
      }
    }
    
    rawUserVinyls.forEach(v => { delete v._backfilled; });
    
    if (typeof joinVinylDataAsync === 'function') {
      ALL_VINILI = await joinVinylDataAsync(rawUserVinyls, true);
      safeSave('app_all_vinyls_cache', ALL_VINILI);
      applyFiltering();
      
      alert("✅ Scansione completata su TUTTE le categorie!");
      if (typeof showToast === 'function') showToast("✅ Scansione completata su TUTTE le categorie!");
    }
  } catch (err) {
    console.error("Errore durante la scansione forzata", err);
    alert("❌ Errore durante la scansione: " + err.message);
    if (typeof showToast === 'function') showToast("❌ Errore durante la scansione.");
  } finally {
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (btnElement) {
      btnElement.innerHTML = "🔄 Forza Scansione Dati Mancanti";
      btnElement.style.opacity = "1";
      btnElement.style.pointerEvents = "auto";
    }
  }
};

// BACKUP: ESPORTAZIONE & IMPORTAZIONE JSON/CSV
if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ALL_VINILI, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `collezione_vinili_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("📥 Backup JSON Scaricato!");
  });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    let csv = "id,artista,titolo_album,genere,anno_uscita_originale,anno_stampa,etichetta,catalog_number,valore_stimato,stato_disco,stato_copertina,stato_catalogo\n";
    ALL_VINILI.forEach(v => {
      csv += `"${v.id}","${v.artista || ''}","${v.titolo_album || ''}","${v.genere || ''}","${v.anno_uscita_originale || ''}","${v.anno_stampa || ''}","${v.etichetta || ''}","${v.catalog_number || ''}","${v.valore_stimato || ''}","${v.stato_disco || ''}","${v.stato_copertina || ''}","${v.stato_catalogo || ''}"\n`;
    });
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `collezione_vinili_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("📊 Esportazione CSV Completata!");
  });
}

if (triggerImportBtn && importJsonFile) {
  triggerImportBtn.addEventListener('click', () => importJsonFile.click());
  importJsonFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const imported = JSON.parse(evt.target.result);
          if (Array.isArray(imported)) {
            ALL_VINILI = imported;
            safeSave('app_all_vinyls_cache', ALL_VINILI);
            pushDatabaseToGitHub(ALL_VINILI, localStorage.getItem('app_current_user')).catch(e => console.error(e));
            populateGenreSelect();
            applyFiltering();
            showToast("📤 Backup Importato con successo!");
          }
        } catch (err) {
          alert("File JSON non valido!");
        }
      };
      reader.readAsText(file);
    }
  });
}

function trackCollectionValueHistory(totalValue, personaleCount) {
  try {
    let history = JSON.parse(localStorage.getItem('vinyl_value_history') || '[]');
    const today = new Date().toISOString().slice(0, 10);
    const existingIndex = history.findIndex(h => h.date === today);
    if (existingIndex >= 0) {
      history[existingIndex] = { date: today, value: totalValue, count: personaleCount };
    } else {
      history.push({ date: today, value: totalValue, count: personaleCount });
      if (history.length > 7) history.shift();
    }
    localStorage.setItem('vinyl_value_history', JSON.stringify(history));
  } catch (_) {}
}

// DASHBOARD STATISTICHE & CALCOLATORE STIMA VALORE EDICOLARE/MERCATO
function renderStatsDashboard() {
  const total = ALL_VINILI.length;
  const personale = ALL_VINILI.filter(v => (v.stato_catalogo || '').toLowerCase().includes('personale')).length;
  const wishlist = ALL_VINILI.filter(v => (v.stato_catalogo || '').toLowerCase().includes('wish')).length;
  const eredita = ALL_VINILI.filter(v => (v.stato_catalogo || '').toLowerCase().includes('eredit')).length;

  let totalEstVal = 0;
  let totalRatingDisc = 0;
  let rarestVinyl = ALL_VINILI[0];
  let rarestScore = 0;
  let personaleValutati = 0;
  
  const decadesCount = {};

  ALL_VINILI.forEach(v => {
    const rawYear = parseInt(v.anno_uscita_originale || v.anno_stampa);
    const year = (!isNaN(rawYear) && rawYear > 1900) ? rawYear : 1980;

    const rawDisc = parseInt(v.stato_disco);
    const discScore = (!isNaN(rawDisc) && rawDisc > 0) ? rawDisc : 8;

    totalRatingDisc += discScore;

    // Decennio
    const decade = Math.floor(year / 10) * 10;
    const decadeLabel = decade ? `Anni '${String(decade).slice(-2)}` : 'Anni sconosciuti';
    decadesCount[decadeLabel] = (decadesCount[decadeLabel] || 0) + 1;

    // Preleva il prezzo reale da Discogs in cache (se disponibile) o usa il valore base dell'album
    const cachedDiscogsPrices = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
    const discogsRealPrice = cachedDiscogsPrices[v.id];

    const valData = calculateVinylValue(v);
    let itemVal = valData.total;
    if (discogsRealPrice !== undefined && discogsRealPrice !== null && !isNaN(discogsRealPrice)) {
      itemVal = discogsRealPrice === -1 ? valData.total : parseFloat(discogsRealPrice);
    }

    const catStr = (v.stato_catalogo || 'personale').toLowerCase();
    const isPersonale = catStr.includes('personale') || catStr === '' || !v.stato_catalogo;
    const hasBarcode = v.codice_a_barre && v.codice_a_barre !== '??' && v.codice_a_barre !== 'N/A' && v.codice_a_barre.trim() !== '';

    if (isPersonale && hasBarcode) {
      personaleValutati++;
      totalEstVal += Math.round(itemVal);
      if (itemVal > rarestScore) {
        rarestScore = Math.round(itemVal);
        rarestVinyl = v;
      }
    }
  });

  const avgDiscRating = (totalRatingDisc / (total || 1)).toFixed(1);

  const genresCount = {};
  ALL_VINILI.forEach(v => {
    const g = v.genere || 'Altro';
    genresCount[g] = (genresCount[g] || 0) + 1;
  });

  const sortedGenres = Object.entries(genresCount).sort((a, b) => b[1] - a[1]);
  const sortedDecades = Object.entries(decadesCount).sort((a, b) => b[1] - a[1]);

  // Traccia lo storico valore nel tempo (SOLO PERSONALE)
  trackCollectionValueHistory(totalEstVal, personale);
  let historyData = JSON.parse(localStorage.getItem('vinyl_value_history') || '[]');
  // Se primo avvio, genera 5 punti di storico simulato a scopo dimostrativo
  if (historyData.length === 0) {
    historyData = [
      { date: 'Gen 2026', value: Math.round(totalEstVal * 0.72), count: Math.max(1, personale - 4) },
      { date: 'Mar 2026', value: Math.round(totalEstVal * 0.81), count: Math.max(1, personale - 3) },
      { date: 'Mag 2026', value: Math.round(totalEstVal * 0.88), count: Math.max(1, personale - 2) },
      { date: 'Lug 2026', value: Math.round(totalEstVal * 0.94), count: Math.max(1, personale - 1) },
      { date: 'Oggi', value: totalEstVal, count: personale }
    ];
  }

  // Costruisce il Grafico SVG Trend ad area con linea luminosa
  const maxHVal = Math.max(...historyData.map(h => h.value), 1);
  const minHVal = Math.min(...historyData.map(h => h.value), 0);
  const chartHeight = 140;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;

  const points = historyData.map((item, idx) => {
    const x = paddingX + (idx / Math.max(1, historyData.length - 1)) * (chartWidth - paddingX * 2);
    const normalizedVal = (item.value - minHVal) / Math.max(1, maxHVal - minHVal);
    const y = (chartHeight - paddingY) - normalizedVal * (chartHeight - paddingY * 2);
    return { x, y, item };
  });

  const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - 5} L ${points[0].x} ${chartHeight - 5} Z`;

  const convertedTotal = convertValueToCurrency(totalEstVal);
  const symbol = getCurrencySymbol();

  statsModalBody.innerHTML = `
    <!-- BANNER VALORE STIMATO DI MERCATO -->
    <div class="kpi-banner-gold">
      <div class="kpi-banner-title">💶 STIMA VALORE COLLEZIONE PERSONALE</div>
      <div class="kpi-banner-amount">${symbol}${convertedTotal}</div>
      <div class="kpi-banner-sub">Somma dei prezzi di mercato reali letti da Discogs su ${personaleValutati} dischi catalogati con Barcode (su ${personale} totali della collezione Personale). Valore in ${symbol}</div>
    </div>

    <!-- GRAFICO SVG TREND AD ONDA E VALORI -->
    <div class="section-title">📈 Grafico Evoluzione Valore Collezione</div>
    <div style="background: rgba(14, 11, 26, 0.75); border: 1px solid rgba(255, 159, 252, 0.3); border-radius: 18px; padding: 14px; margin-bottom: 1.2rem; box-shadow: 0 8px 25px rgba(0,0,0,0.5);">
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: 140px; overflow: visible;">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff9ffc" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#5227ff" stop-opacity="0.02"/>
          </linearGradient>
        </defs>

        <!-- Area ombreggiata del grafico -->
        <path d="${areaD}" fill="url(#chartGradient)"/>

        <!-- Linea principale del grafico -->
        <path d="${pathD}" fill="none" stroke="#ff9ffc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px #ff9ffc);"/>

        <!-- Punti di valore e date -->
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="5" fill="#5227ff" stroke="#ff9ffc" stroke-width="2.5"/>
          <text x="${p.x}" y="${p.y - 10}" fill="#ffffff" font-size="11" font-weight="bold" text-anchor="middle">€${p.item.value}</text>
          <text x="${p.x}" y="${chartHeight + 12}" fill="#94a3b8" font-size="10" text-anchor="middle">${p.item.date}</text>
        `).join('')}
      </svg>
    </div>

    ${rarestVinyl ? `
      <div class="spec-card" style="margin-bottom: 1rem; background: rgba(82, 39, 255, 0.28); border: 1px solid rgba(255, 159, 252, 0.4);">
        <span class="spec-label" style="color: #ff9ffc; font-weight: 700;">💎 VINILE DI MAGGIOR VALORE IN COLLEZIONE</span>
        <span class="spec-value" style="font-size: 1rem; margin-top: 2px;">${escapeHtml(rarestVinyl.artista)} — ${escapeHtml(rarestVinyl.titolo_album)} (${rarestVinyl.anno_uscita_originale || rarestVinyl.anno_stampa})</span>
        <span style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">Valore registrato: €${rarestScore} | Condizioni: Disco ${escapeHtml(rarestVinyl.stato_disco) || 8}/10</span>
      </div>
    ` : ''}

    <!-- GRID METRICHE COLLEZIONE -->
    <div class="section-title">📊 Ripartizione Categorie</div>
    <div class="stats-grid">
      <div class="kpi-card">
        <div class="kpi-value">${total}</div>
        <div class="kpi-label">Totale Dischi</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #818cf8;">${personale}</div>
        <div class="kpi-label">Personali</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #f472b6;">${wishlist}</div>
        <div class="kpi-label">Wish List</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #fbbf24;">${eredita}</div>
        <div class="kpi-label">Eredità</div>
      </div>
    </div>

    <!-- DISTRIBUZIONE GENERI -->
    <div class="section-title">🎶 Ripartizione per Genere Musicale</div>
    <div class="stat-bar-wrapper" style="margin-bottom: 1.2rem;">
      ${sortedGenres.slice(0, 5).map(([genre, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
          <div class="stat-bar-row">
            <div class="stat-bar-info">
              <span>${genre}</span>
              <span>${count} dischi (${pct}%)</span>
            </div>
            <div class="stat-bar-track">
              <div class="stat-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- DISTRIBUZIONE DECENNI -->
    <div class="section-title">⏳ Ripartizione per Decennio</div>
    <div class="stat-bar-wrapper">
      ${sortedDecades.map(([decade, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
          <div class="stat-bar-row">
            <div class="stat-bar-info">
              <span>${decade}</span>
              <span>${count} dischi (${pct}%)</span>
            </div>
            <div class="stat-bar-track">
              <div class="stat-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, #ff9ffc, #5227ff);"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

if (openStatsBtn) {
  openStatsBtn.addEventListener('click', () => {
    renderStatsDashboard();
    statsModal.classList.add('active');
    statsModal.setAttribute('aria-hidden', 'false');
  });
}
if (closeStatsModalBtn) {
  closeStatsModalBtn.addEventListener('click', () => {
    if (document.activeElement) document.activeElement.blur();
    statsModal.classList.remove('active');
    statsModal.setAttribute('aria-hidden', 'true');
  });
}

// ==========================================
// SCANSIONE FOTOCAMERA CODICE A BARRE (LIVE BARCODE SCANNER)
// ==========================================
const startBarcodeScanBtn = document.getElementById('start-barcode-scan-btn');
const barcodeScannerModal = document.getElementById('barcode-scanner-modal');
const closeBarcodeModalBtn = document.getElementById('close-barcode-modal-btn');
const cancelBarcodeScanBtn = document.getElementById('cancel-barcode-scan-btn');
const barcodeVideo = document.getElementById('barcode-video');
const barcodeStatusMsg = document.getElementById('barcode-status-msg');

let barcodeMediaStream = null;
let barcodeScanInterval = null;

async function startBarcodeScanner() {
  const isEdit = document.getElementById('edit-vinyl-modal')?.classList.contains('active');
  const isAdd = document.getElementById('add-vinyl-modal')?.classList.contains('active');
  
  if (isEdit || isAdd) {
    const prefix = isEdit ? 'edit' : 'add';
    const barcodeInput = document.getElementById(`${prefix}-barcode`);
    if (barcodeInput && barcodeInput.value.trim() !== "") {
      onBarcodeFound(barcodeInput.value.trim());
      return;
    }
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("⚠️ La fotocamera non è supportata su questo browser");
    return;
  }

  barcodeScannerModal.classList.add('active');
  barcodeScannerModal.setAttribute('aria-hidden', 'false');
  barcodeStatusMsg.textContent = "Attivazione fotocamera...";

  try {
    barcodeMediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    barcodeVideo.srcObject = barcodeMediaStream;
    barcodeVideo.play();
    barcodeStatusMsg.textContent = "Inquadra il codice a barre del vinile...";

    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
      barcodeScanInterval = setInterval(async () => {
        try {
          const barcodes = await barcodeDetector.detect(barcodeVideo);
          if (barcodes.length > 0) {
            const detectedCode = barcodes[0].rawValue;
            onBarcodeFound(detectedCode);
          }
        } catch (e) {}
      }, 400);
    } else {
      barcodeStatusMsg.textContent = "Videocamera attiva. Inquadra il codice a barre.";
    }
  } catch (err) {
    barcodeStatusMsg.textContent = "Impossibile accedere alla fotocamera.";
  }
}
function stopBarcodeScanner() {
  if (barcodeScanInterval) clearInterval(barcodeScanInterval);
  if (barcodeMediaStream) {
    barcodeMediaStream.getTracks().forEach(track => track.stop());
    barcodeMediaStream = null;
  }
  barcodeScannerModal.classList.remove('active');
  barcodeScannerModal.setAttribute('aria-hidden', 'true');
}

async function fetchAndFillFullRelease(releaseId, prefix) {
  const token = getDiscogsToken();
  const headers = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' };
  if (token) headers['Authorization'] = `Discogs token=${token}`;
  try {
    const res = await fetch(`https://api.discogs.com/releases/${releaseId}`, { headers });
    if (!res.ok) throw new Error();
    const r = await res.json();
    
    document.getElementById(`${prefix}-titolo`).value = r.title || '';
    if (r.artists && r.artists.length > 0) {
      document.getElementById(`${prefix}-artista`).value = r.artists.map(a => a.name.replace(/\(\d+\)$/, '').trim()).join(', ');
    }
    if (r.year) document.getElementById(`${prefix}-anno-uscita`).value = r.year;
    if (r.genres && r.genres.length > 0) document.getElementById(`${prefix}-genere`).value = r.genres.join(', ');
    if (r.labels && r.labels.length > 0) {
      document.getElementById(`${prefix}-etichetta`).value = r.labels[0].name;
      document.getElementById(`${prefix}-cat-num`).value = r.labels[0].catno;
    }
    if (r.identifiers && r.identifiers.length > 0) {
      const barcodeId = r.identifiers.find(i => i.type === 'Barcode');
      if (barcodeId && barcodeId.value) {
        document.getElementById(`${prefix}-barcode`).value = barcodeId.value.replace(/\s/g, '');
      }
    }
    
    let noteField = document.getElementById(`${prefix}-note`);
    if (r.notes) {
      let notesClean = r.notes.replace(/\r\n/g, '\n');
      noteField.value = noteField.value ? noteField.value + '\n\n' + notesClean : notesClean;
    }

    if (r.tracklist && r.tracklist.length > 0) {
      currentTracklist = r.tracklist.map(t => ({
        pos: t.position || '',
        title: t.title || '',
        duration: t.duration || '',
        durata: t.duration || ''
      }));
    } else {
      currentTracklist = [];
    }
    showToast("✅ Dati, tracce e note importati con successo!");
  } catch(e) {
    showToast("❌ Impossibile recuperare tracce e note dettagliate.");
  }
}

async function searchDiscogsBarcodeAndFill(barcode, prefix) {
  const token = getDiscogsToken();
  const headers = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' };
  if (token) headers['Authorization'] = `Discogs token=${token}`;
  
  showToast("🔄 Ricerca codice a barre su Discogs...");
  try {
    const searchRes = await fetch(`https://api.discogs.com/database/search?barcode=${encodeURIComponent(barcode)}`, { headers });
    if (!searchRes.ok) throw new Error();
    const searchData = await searchRes.json();
    if (searchData.results && searchData.results.length > 0) {
      const releaseId = searchData.results[0].id;
      await fetchAndFillFullRelease(releaseId, prefix);
    } else {
      showToast("❌ Nessun risultato trovato su Discogs per questo codice.");
    }
  } catch(e) {
    showToast("❌ Errore durante la ricerca su Discogs.");
  }
}

let isQuickValScan = false;
let isDbSearchScan = false;
async function onBarcodeFound(code) {
  stopBarcodeScanner();

  if (isDbSearchScan) {
    const searchField = document.getElementById('database-search-field');
    const searchInput = document.getElementById('database-search-input');
    if (searchField && searchInput) {
        searchField.value = 'barcode';
        const dbDropdownText = document.getElementById('db-search-dropdown-text');
        if (dbDropdownText) dbDropdownText.textContent = 'Filtro: Barcode';
        searchInput.value = code;
        searchInput.dispatchEvent(new Event('input'));
    }
    isDbSearchScan = false;
    return;
  }

  if (isQuickValScan) {
    document.getElementById('quick-val-barcode').value = code;
    isQuickValScan = false;
    return;
  }

  const isEdit = document.getElementById('edit-vinyl-modal')?.classList.contains('active');
  const prefix = isEdit ? 'edit' : 'add';
  
  if (!isEdit && discogsQuery) discogsQuery.value = code;
  const catInput = document.getElementById(`${prefix}-cat-num`);
  const matriceInput = document.getElementById(`${prefix}-matrice`);
  if (catInput && !catInput.value) catInput.value = code;
  if (matriceInput && !matriceInput.value) matriceInput.value = code;
  
  await searchDiscogsBarcodeAndFill(code, prefix);
}

if (startBarcodeScanBtn) startBarcodeScanBtn.addEventListener('click', startBarcodeScanner);
if (closeBarcodeModalBtn) closeBarcodeModalBtn.addEventListener('click', stopBarcodeScanner);
if (cancelBarcodeScanBtn) cancelBarcodeScanBtn.addEventListener('click', stopBarcodeScanner);

const startEditBarcodeScanBtn = document.getElementById('start-edit-barcode-scan-btn');
if (startEditBarcodeScanBtn) startEditBarcodeScanBtn.addEventListener('click', startBarcodeScanner);

const startDbSearchBarcodeBtn = document.getElementById('start-db-search-barcode-btn');
if (startDbSearchBarcodeBtn) startDbSearchBarcodeBtn.addEventListener('click', () => {
    isDbSearchScan = true;
    startBarcodeScanner();
});

const dbManualAddBtn = document.getElementById('db-manual-add-btn');
if (dbManualAddBtn) dbManualAddBtn.addEventListener('click', async () => {
  const access = await window.checkAdminAccess();
  if (!access) return;
  const databaseModal = document.getElementById('database-modal');
  if(databaseModal) { databaseModal.classList.remove('active'); databaseModal.setAttribute('aria-hidden', 'true'); }
  const addVinylModal = document.getElementById('add-vinyl-modal');
  if (addVinylModal) addVinylModal.classList.add('active');
});

// ==========================================
// QUICK VALUATION MODAL LOGIC
// ==========================================
const quickValModal = document.getElementById('quick-val-modal');
const openQuickValBtn = document.getElementById('open-quick-val-btn');
const closeQuickValModalBtn = document.getElementById('close-quick-val-modal-btn');
const startQuickValBarcodeBtn = document.getElementById('start-quick-val-barcode-btn');
const calcQuickValBtn = document.getElementById('calc-quick-val-btn');

if (openQuickValBtn) openQuickValBtn.addEventListener('click', () => {
  quickValModal.classList.add('active');
  quickValModal.setAttribute('aria-hidden', 'false');
});
if (closeQuickValModalBtn) closeQuickValModalBtn.addEventListener('click', () => {
  quickValModal.classList.remove('active');
  quickValModal.setAttribute('aria-hidden', 'true');
});
if (startQuickValBarcodeBtn) startQuickValBarcodeBtn.addEventListener('click', () => {
  isQuickValScan = true;
  startBarcodeScanner();
});

if (calcQuickValBtn) calcQuickValBtn.addEventListener('click', async () => {
  const inputVal = document.getElementById('quick-val-barcode').value.trim();
  if (!inputVal) return showToast("⚠️ Inserisci o scansiona un barcode / matrice");
  const statoDisco = document.getElementById('quick-val-disco').value;
  const statoCover = document.getElementById('quick-val-cover').value;
  
  const isBarcode = /^\d+$/.test(inputVal);
  
  const tempVinile = {
    id: 'quick_val_' + Date.now(),
    codice_a_barre: isBarcode ? inputVal : '',
    codice_matrice: isBarcode ? '' : inputVal,
    stato_disco: statoDisco,
    stato_copertina: statoCover
  };
  
  const resultDiv = document.getElementById('quick-val-result');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<span class="shimmer-text">🔄 Ricerca in corso su Discogs...</span>';
  
  await fetchDiscogsLivePrice(tempVinile, 'quick-val-result', 0, true);
});

// RICERCA MULTI-API A CASCATA (FALLBACK INTELLIGENTE: BARCODE DISCOGS/MUSICBRAINZ -> ITUNES SEARCH API)
async function searchMusicBrainzOrDiscogs(query) {
  if (!query) return;
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  discogsSearchBtn.textContent = 'Ricerca in corso...';
  discogsResults.classList.remove('hidden');
  discogsResults.innerHTML = '<div style="padding:10px; font-size:0.82rem; color:#ff9ffc;">🔍 Ricerca in corso...</div>';

  let resultsHTML = '';
  let foundAny = false;

  // 0. RICERCA NEL DATABASE LOCALE (ALL_VINILI)
  const localMatches = ALL_VINILI.filter(v => {
    const qLower = cleanQuery.toLowerCase();
    const cleanDbField = (field) => (field || '').toLowerCase().replace(/[\s\-_.\/]/g, '');
    const cleanDbDigits = (field) => (field || '').replace(/[^0-9]/g, '').replace(/^0+/, '');

    const catClean = cleanDbField(v.catalog_number);
    const matClean = cleanDbField(v.codice_matrice);
    const qClean = qLower.replace(/[\s\-_.\/]/g, '');

    const matchMatrice = matClean.length > 0 && (matClean.includes(qClean) || qClean.includes(matClean));
    const matchCatNum = catClean.length > 0 && (catClean.includes(qClean) || qClean.includes(catClean));
    const matchArtist = (v.artista || '').toLowerCase().includes(qLower);
    const matchAlbum = (v.titolo_album || '').toLowerCase().includes(qLower);
    const matchNotes = (v.note_stato || '').toLowerCase().includes(qLower);
    const matchId = String(v.id) === cleanQuery;

    if (matchMatrice || matchCatNum || matchArtist || matchAlbum || matchNotes || matchId) return true;

    const rawDigits = cleanQuery.replace(/[^0-9]/g, '');
    const cleanDigits = rawDigits.replace(/^0+/, '');
    if (cleanDigits.length >= 4) {
      const vCatDigits = cleanDbDigits(v.catalog_number);
      const vMatDigits = cleanDbDigits(v.codice_matrice);
      if (vCatDigits.length >= 4 && (cleanDigits.includes(vCatDigits) || vCatDigits.includes(cleanDigits))) return true;
      if (vMatDigits.length >= 4 && (cleanDigits.includes(vMatDigits) || vMatDigits.includes(cleanDigits))) return true;
    }
    return false;
  });

  if (localMatches.length > 0) {
    foundAny = true;
    resultsHTML += `
      <div style="font-size:0.75rem; font-weight:700; color:#818cf8; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom: 6px;">
        📁 Trovato nella tua collezione (${localMatches.length})
      </div>
    `;
    localMatches.forEach(rel => {
      const parsed = parseArtistAndAlbum(rel.titolo_album, rel.artista, rel.titolo_album);
      const cleanArtist = parsed.artist || 'Artista Sconosciuto';
      const cleanAlbum = parsed.album || rel.titolo_album || 'Album Sconosciuto';
      const fallbackCover = generateSVGAlbumCover(cleanArtist, cleanAlbum);
      const coverSrc = (rel.cover && rel.cover.trim() !== '') ? rel.cover : fallbackCover;
      const year = rel.anno_uscita_originale || rel.anno_stampa || '';

      const recordJson = encodeURIComponent(JSON.stringify({
        title: cleanAlbum,
        artist: cleanArtist,
        year: year,
        label: rel.etichetta ? [rel.etichetta] : [],
        catno: rel.catalog_number || rel.codice_matrice || '',
        genre: rel.genere ? [rel.genere] : [],
        cover: rel.cover || null,
        localId: rel.id
      }));

      resultsHTML += `
        <div class="search-result-card local-match" onclick="window.selectDiscogsResult('${recordJson}')">
          <div class="result-thumb-wrapper">
            <img src="${coverSrc}" class="result-thumb-img" alt="${cleanAlbum}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackCover}';">
          </div>
          <div class="result-card-info">
            <div class="result-card-title">${cleanAlbum}</div>
            <div class="result-card-artist">${cleanArtist}</div>
            <div class="result-card-badges">
              <span class="result-badge result-badge-local">📁 Nella Tua Collezione</span>
              ${year ? `<span class="result-badge result-badge-year">📅 ${year}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  const barcodeResults = [];

  // RILEVAMENTO BARCODE: esegue le chiamate API barcode solo se l'input è numerico
  // (EAN-13, UPC, ecc.) per evitare richieste inutili quando si cerca un nome artista o titolo.
  // Un barcode valido è composto principalmente da cifre (eventualmente separate da spazi/trattini)
  // con almeno 6 digit consecutivi.
  const cleanBarcode = cleanQuery.replace(/[^0-9a-zA-Z]/g, '');
  const isLikelyBarcode = /^[\d\s\-]+$/.test(cleanQuery.trim()) &&
                           cleanQuery.replace(/[^0-9]/g, '').length >= 6;

  // 1a. Discogs Barcode Endpoint – attivato SOLO se la query sembra un barcode numerico
  if (isLikelyBarcode && cleanBarcode.length >= 6) {
    try {
      const token = getDiscogsToken();
      const headers = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' };
      if (token) headers['Authorization'] = `Discogs token=${token}`;
      const discogsRes = await fetch(`https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanBarcode)}`, { headers });
      if (discogsRes.ok) {
        const discogsData = await discogsRes.json();
        if (discogsData.results && discogsData.results.length > 0) {
          discogsData.results.forEach(item => {
            let artist = 'Artista Sconosciuto';
            let title = item.title || '';
            if (title.includes(' - ')) {
              const parts = title.split(' - ');
              artist = parts[0].trim().replace(/\s*\(\d+\)$/, '');
              title = parts.slice(1).join(' - ').trim();
            }
            const year = item.year ? String(item.year) : (item.year_released ? String(item.year_released) : '');
            const cover = item.cover_image || item.thumb || null;

            barcodeResults.push({
              source: 'Discogs Barcode',
              title: title || item.title || 'Album Sconosciuto',
              artist: artist,
              year: year,
              cover: cover,
              label: item.label || [],
              genre: item.genre || [],
              catno: item.catno || cleanBarcode,
              id: item.id
            });
          });
        }
      }
    } catch (e) {
      console.warn("Discogs Barcode fetch error:", e);
    }
  }

  // 1b. MusicBrainz Barcode Endpoint – attivato SOLO se la query sembra un barcode numerico
  if (isLikelyBarcode && cleanBarcode.length >= 6) {
    try {
      const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=barcode:${encodeURIComponent(cleanBarcode)}&fmt=json`);
      if (mbRes.ok) {
        const mbData = await mbRes.json();
        if (mbData.releases && mbData.releases.length > 0) {
          mbData.releases.slice(0, 5).forEach(rel => {
            const artistName = rel['artist-credit'] ? rel['artist-credit'].map(a => a.name).join(' & ') : 'Artista Sconosciuto';
            const year = rel.date ? rel.date.slice(0, 4) : '';
            const mbCover = rel.id ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;

            if (!barcodeResults.some(b => b.title.toLowerCase() === (rel.title || '').toLowerCase())) {
              barcodeResults.push({
                source: 'MusicBrainz Barcode',
                title: rel.title || 'Album Sconosciuto',
                artist: artistName,
                year: year,
                cover: mbCover,
                label: rel['label-info'] && rel['label-info'][0] && rel['label-info'][0].label ? [rel['label-info'][0].label.name] : [],
                genre: [],
                catno: cleanBarcode,
                id: null // MusicBrainz does not have a Discogs ID
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("MusicBrainz Barcode fetch error:", e);
    }
  }

  const onlineResults = [...barcodeResults];

  // SECONDO TENTATIVO: FALLBACK AUTOMATICO PER TESTO SU ITUNES SEARCH API
  // Se la ricerca per barcode restituisce 0 risultati, NON mostrare subito l'errore 'Nessun vinile trovato'.
  // Prendi invece l'input dell'utente e fai una ricerca per testo libero/titolo su iTunes Search API
  if (barcodeResults.length === 0) {
    try {
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&entity=album&limit=10`);
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          itunesData.results.forEach(albumItem => {
            const title = albumItem.collectionName || albumItem.collectionCensoredName || 'Album Sconosciuto';
            const artist = albumItem.artistName || 'Artista Sconosciuto';
            const year = albumItem.releaseDate ? albumItem.releaseDate.slice(0, 4) : '';
            const cover = albumItem.artworkUrl100 ? albumItem.artworkUrl100.replace('100x100bb', '600x600bb') : null;

            if (!onlineResults.some(r => r.title.toLowerCase() === title.toLowerCase() && r.artist.toLowerCase() === artist.toLowerCase())) {
              onlineResults.push({
                source: 'iTunes Search',
                title: title,
                artist: artist,
                year: year,
                cover: cover,
                label: albumItem.copyright ? [albumItem.copyright] : [],
                genre: albumItem.primaryGenreName ? [albumItem.primaryGenreName] : [],
                catno: cleanQuery
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn("iTunes Text Search fetch error:", e);
    }

    // Ulteriore fallback per testo libero su MusicBrainz se iTunes non restituisce risultati
    if (onlineResults.length === 0) {
      try {
        const mbTextRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(cleanQuery)}&fmt=json`);
        if (mbTextRes.ok) {
          const mbTextData = await mbTextRes.json();
          if (mbTextData.releases && mbTextData.releases.length > 0) {
            mbTextData.releases.slice(0, 6).forEach(rel => {
              const artistName = rel['artist-credit'] ? rel['artist-credit'].map(a => a.name).join(' & ') : 'Artista Sconosciuto';
              const year = rel.date ? rel.date.slice(0, 4) : '';
              const mbCover = rel.id ? `https://coverartarchive.org/release/${rel.id}/front-500` : null;

              if (!onlineResults.some(r => r.title.toLowerCase() === (rel.title || '').toLowerCase())) {
                onlineResults.push({
                  source: 'MusicBrainz Text',
                  title: rel.title || 'Album Sconosciuto',
                  artist: artistName,
                  year: year,
                  cover: mbCover,
                  label: [],
                  genre: [],
                  catno: cleanQuery
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn("MusicBrainz Text Search fetch error:", e);
      }
    }
  }

  // GESTIONE DATI E COPERTINA & MOSTRA RISULTATI NELL'INTERFACCIA
  if (onlineResults.length > 0) {
    foundAny = true;
    const isFallback = barcodeResults.length === 0;

    resultsHTML += `
      <div style="font-size:0.75rem; font-weight:700; color:#ff9ffc; padding:4px 6px; margin-top:8px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1);">
        🌐 ${isFallback ? 'Fallback Ricerca per Testo (iTunes / MB)' : 'Risultati per Barcode (Discogs / MB)'} (${onlineResults.length})
      </div>
    `;

    onlineResults.forEach(res => {
      // Estrazione sicura: title, artist, year, cover
      const title = res.title ? String(res.title).trim() : 'Album Sconosciuto';
      const artist = res.artist ? String(res.artist).trim() : 'Artista Sconosciuto';
      const year = res.year ? String(res.year).trim() : '';

      // Cover URL o placeholder SVG se assente o invalida
      const fallbackCover = generateSVGAlbumCover(artist, title);
      const coverSrc = (res.cover && String(res.cover).trim() !== '') ? res.cover : fallbackCover;

      const recordJson = encodeURIComponent(JSON.stringify({
        title: title,
        artist: artist,
        year: year,
        label: res.label || [],
        catno: res.catno || cleanQuery,
        genre: res.genre || [],
        cover: res.cover || null,
        id: res.id || null
      }));

      resultsHTML += `
        <div class="search-result-card" onclick="window.selectDiscogsResult('${recordJson}')">
          <div class="result-thumb-wrapper">
            <img src="${coverSrc}" class="result-thumb-img" alt="${title}" loading="lazy" onerror="this.onerror=null; this.src='${fallbackCover}';">
          </div>
          <div class="result-card-info">
            <div class="result-card-title">${title}</div>
            <div class="result-card-artist">${artist}</div>
            <div class="result-card-badges">
              <span class="result-badge result-badge-online">🌐 ${res.source || 'Online'}</span>
              ${year ? `<span class="result-badge result-badge-year">📅 ${year}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  discogsSearchBtn.textContent = 'Cerca Dati';

  if (!foundAny) {
    discogsResults.innerHTML = `
      <div style="padding:12px; font-size:0.82rem; color:#cbd5e1; text-align:center;">
        ❌ Nessun vinile trovato per "<strong>${cleanQuery}</strong>".<br>
        <span style="font-size:0.75rem; opacity:0.8;">Prova ad inserire il Titolo dell'Album o il Nome dell'Artista.</span>
      </div>
    `;
  } else {
    discogsResults.innerHTML = `<div class="discogs-results-list">${resultsHTML}</div>`;
    discogsQuery.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchMusicBrainzOrDiscogs(discogsQuery.value.trim());
      }
    });
  }
}

if (discogsSearchBtn && discogsQuery) {
  discogsSearchBtn.addEventListener('click', () => {
    searchMusicBrainzOrDiscogs(discogsQuery.value.trim());
  });
}

window.selectDiscogsResult = async function(encodedJson) {
  try {
    const r = JSON.parse(decodeURIComponent(encodedJson));

    if (r.localId) {
      const existingIdx = filteredVinili.findIndex(v => v.id === r.localId);
      if (existingIdx !== -1) {
        selectIndex(existingIdx);
      } else {
        const globalIdx = ALL_VINILI.findIndex(v => v.id === r.localId);
        if (globalIdx !== -1) {
          applyFiltering();
          const fIdx = filteredVinili.findIndex(v => v.id === r.localId);
          if (fIdx !== -1) selectIndex(fIdx);
        }
      }
      if (document.activeElement) document.activeElement.blur();
      addVinylModal.classList.remove('active');
      discogsResults.classList.add('hidden');
      showToast("✅ Vinile selezionato nella tua collezione!");
      return;
    }

    showToast("🔄 Recupero dettagli completi da Discogs...");
    if (r.id) {
      await fetchAndFillFullRelease(r.id, 'add');
    } else {
      const albumTitle = r.title || r.album || '';
      const artistName = r.artist || '';

      document.getElementById('add-titolo').value = albumTitle;
      document.getElementById('add-artista').value = artistName || 'Artista Sconosciuto';

      if (r.year) document.getElementById('add-anno-uscita').value = r.year;
      if (r.genre) {
        const g = Array.isArray(r.genre) ? r.genre[0] : r.genre;
        if (g) document.getElementById('add-genere').value = g;
      }
      if (r.label) {
        const l = Array.isArray(r.label) ? r.label[0] : r.label;
        if (l) document.getElementById('add-etichetta').value = l;
      }
    }
    if (r.catno) document.getElementById('add-cat-num').value = r.catno;
    
    const coverUrl = r.cover || r.cover_image;
    if (coverUrl && String(coverUrl).trim() !== '') {
      currentCapturedCoverBase64 = coverUrl;
      photoPreviewImg.src = coverUrl;
      photoPreviewImg.classList.remove('hidden');
      const placeholder = document.querySelector('.scan-placeholder');
      if (placeholder) placeholder.style.display = 'none';
    }
    discogsResults.classList.add('hidden');
    showToast("🎉 Dati del vinile autocompilati!");
  } catch (e) {
    console.error(e);
  }
};

// MODAL ADD VINYL
if (openAddBtn) {
  openAddBtn.addEventListener('click', async () => {
    if (typeof window.openDatabaseModal === 'function') window.openDatabaseModal(true);
  });
}
if (closeAddModalBtn) {
  closeAddModalBtn.addEventListener('click', () => {
    if (document.activeElement) document.activeElement.blur();
    addVinylModal.classList.remove('active');
    addVinylModal.setAttribute('aria-hidden', 'true');
  });
}
if (triggerCameraBtn && cameraFileInput) {
  triggerCameraBtn.addEventListener('click', () => cameraFileInput.click());
}
if (cameraFileInput) {
  cameraFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        currentCapturedCoverBase64 = evt.target.result;
        photoPreviewImg.src = currentCapturedCoverBase64;
        photoPreviewImg.classList.remove('hidden');
        document.querySelector('.scan-placeholder').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });
}

// SUBMIT ADD VINYL FORM
if (addVinylForm) {
  addVinylForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Generate or use matrix code as ID
    let matrice_input = document.getElementById('add-matrice').value.trim();
    let uniqueId = matrice_input;
    if (!uniqueId || uniqueId === '??' || uniqueId === 'N/A') {
        uniqueId = "FALLBACK_" + Math.floor(100000 + Math.random() * 900000);
    }
    
    // Build global object
    const globalVinyl = {
      id: uniqueId,
      titolo_album: document.getElementById('add-titolo').value,
      artista: document.getElementById('add-artista').value,
      genere: document.getElementById('add-genere').value || 'Rock',
      valore_stimato: parseFloat(document.getElementById('add-valore-stimato').value) || 25,
      anno_uscita_originale: parseInt(document.getElementById('add-anno-uscita').value) || new Date().getFullYear(),
      anno_stampa: parseInt(document.getElementById('add-anno-stampa').value) || new Date().getFullYear(),
      anno_uscita_stampa: parseInt(document.getElementById('add-anno-stampa').value) || new Date().getFullYear(),
      origine: 'IT',
      etichetta: document.getElementById('add-etichetta').value || 'Indipendente',
      catalog_number: document.getElementById('add-cat-num').value || 'N/A',
      codice_matrice: matrice_input || 'N/A',
      codice_a_barre: document.getElementById('add-barcode').value || 'N/A',
      velocita: document.getElementById('add-velocita').value || '33',
      colore: 'Nero',
      grammatura: document.getElementById('add-grammatura').value || '180g',
      inserti: 'Nessuno',
      tracce: currentTracklist.length > 0 ? [...currentTracklist] : [],
      cover: currentCapturedCoverBase64 || ''
    };

    // Build personal object
    const personalVinyl = {
      id: uniqueId,
      stato_catalogo: document.getElementById('add-stato-catalogo').value,
      stato_disco: document.getElementById('add-stato-disco').value || '8',
      stato_copertina: document.getElementById('add-stato-copertina').value || '8',
      note_stato: document.getElementById('add-note').value || '',
      posizione_fisica: document.getElementById('add-posizione-fisica').value || 'Scaffale Principale',
      foto_album: currentCapturedCoverBase64 ? [currentCapturedCoverBase64] : []
    };

    // Update Master Catalog if not exists
    // Invece di caricare il gigantesco Master Catalog intero (che fa crashare il browser),
    // inviamo il nuovo vinile alla coda delle proposte (proposals.json)
    const existingGlobal = MASTER_CATALOG.find(v => v.id === uniqueId);
    if (!existingGlobal) {
        MASTER_CATALOG.push(globalVinyl);
        try {
            const currentProposals = await fetchProposalsFromGitHub();
            currentProposals.push(globalVinyl);
            await pushProposalsToGitHub(currentProposals);
            console.log("Nuovo vinile inviato alla coda proposals.json per evitare crash di memoria.");
        } catch(e) {
            console.error("Errore salvataggio proposal", e);
        }
    }

    // Load current user DB (to ensure we are appending to the latest)
    let rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
    // Add personal vinyl to user DB
    rawUserVinyls.unshift(personalVinyl);
    
    try {
        await pushDatabaseToGitHub(rawUserVinyls, currentUser);
    } catch(e) {
        console.error("Errore salvataggio user DB", e);
    }

    // Update Local App State
    ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
    safeSave('app_all_vinyls_cache', ALL_VINILI);

    addVinylForm.reset();
    currentCapturedCoverBase64 = null;
    photoPreviewImg.classList.add('hidden');
    document.querySelector('.scan-placeholder').style.display = 'flex';

    if (document.activeElement) document.activeElement.blur();
    addVinylModal.classList.remove('active');
    populateGenreSelect();
    applyFiltering();
    selectIndex(0);
    showToast("🎵 Nuovo Vinile Aggiunto con successo!");
  });
}

// HEADER MOBILE NAV & DRAWER TOGGLE
if (prevBtn) prevBtn.addEventListener("click", () => selectIndex(selectedIndex - 1));
if (nextBtn) nextBtn.addEventListener("click", () => selectIndex(selectedIndex + 1));

function toggleMobileDrawer() {
  console.log("Apertura menu titoli...");
  if (wheelContainer) wheelContainer.classList.toggle("open");
  if (mobileOverlay) mobileOverlay.classList.toggle("active");
}
function closeMobileDrawer() {
  console.log("Chiusura menu titoli...");
  if (wheelContainer) wheelContainer.classList.remove("open");
  if (mobileOverlay) mobileOverlay.classList.remove("active");
}

if (toggleListBtn) toggleListBtn.addEventListener("click", toggleMobileDrawer);
if (mobileOverlay) mobileOverlay.addEventListener("click", closeMobileDrawer);

let isWheelThrottled = false;
if (wheelContainer) {
  wheelContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (isWheelThrottled) return;
    isWheelThrottled = true;
    if (e.deltaY > 0) selectIndex(selectedIndex + 1);
    else if (e.deltaY < 0) selectIndex(selectedIndex - 1);
    setTimeout(() => { isWheelThrottled = false; }, 80);
  }, { passive: false });

  // --- Aggiunta: Drag per scorrere i titoli (verticale) o chiudere il menu (orizzontale verso destra) ---
  let touchStartX = 0;
  let touchStartY = 0;

  wheelContainer.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  wheelContainer.addEventListener("touchmove", (e) => {
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const diffX = touchCurrentX - touchStartX; // Positivo se si trascina verso destra
    const diffY = touchStartY - touchCurrentY; // Positivo se si trascina verso l'alto

    // Swipe orizzontale verso destra per chiudere il menu
    if (Math.abs(diffX) > Math.abs(diffY) && diffX > 40) {
      if (typeof closeMobileDrawer === "function") {
        closeMobileDrawer();
      }
      return;
    }

    // Drag verticale per scorrere i titoli
    if (Math.abs(diffY) > Math.abs(diffX)) {
      e.preventDefault(); // Previene lo scroll di default della pagina sul mobile
      if (isWheelThrottled) return;
      
      if (Math.abs(diffY) > 20) {
        isWheelThrottled = true;
        if (diffY > 0) selectIndex(selectedIndex + 1);
        else selectIndex(selectedIndex - 1);
        
        touchStartY = touchCurrentY; // Reset Y per drag continui
        setTimeout(() => { isWheelThrottled = false; }, 120);
      }
    }
  }, { passive: false });

  // --- Aggiunta: Drag con mouse (PC) per scorrere i titoli o chiudere il menu ---
  let isMouseDown = false;
  let mouseStartX = 0;
  let mouseStartY = 0;

  wheelContainer.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
    wheelContainer.style.cursor = "grabbing";
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
    if (wheelContainer) wheelContainer.style.cursor = "grab";
  });

  wheelContainer.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    
    const mouseCurrentX = e.clientX;
    const mouseCurrentY = e.clientY;
    const diffX = mouseCurrentX - mouseStartX; // Positivo verso destra
    const diffY = mouseStartY - mouseCurrentY; // Positivo verso l'alto

    // Drag orizzontale verso destra per chiudere
    if (Math.abs(diffX) > Math.abs(diffY) && diffX > 40) {
      if (typeof closeMobileDrawer === "function") {
        closeMobileDrawer();
      }
      isMouseDown = false;
      return;
    }

    // Drag verticale per scorrere
    if (Math.abs(diffY) > Math.abs(diffX)) {
      e.preventDefault();
      if (isWheelThrottled) return;

      if (Math.abs(diffY) > 20) {
        isWheelThrottled = true;
        if (diffY > 0) selectIndex(selectedIndex + 1);
        else selectIndex(selectedIndex - 1);
        
        mouseStartY = mouseCurrentY; // Reset
        setTimeout(() => { isWheelThrottled = false; }, 120);
      }
    }
  });

  // Imposta il cursore di default a "grab" per indicare che è trascinabile
  wheelContainer.style.cursor = "grab";
}

// ==========================================
// FUNZIONI RIMOSSE
// ==========================================

const photoModal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-img');
const closeModalBtn = document.getElementById('close-modal-btn');

window.openPhotoModal = function(src) {
  if (photoModal && modalImg) {
    modalImg.src = src;
    photoModal.classList.add('active');
    photoModal.setAttribute('aria-hidden', 'false');
  }
};

window.openGalleryModal = function(id) {
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile || !vinile.foto_album || vinile.foto_album.length === 0) return;

  if (photoModal && modalImg) {
    const totalPhotos = vinile.foto_album.length;
    let currentPhotoIdx = 0;

    const galleryWrapper = document.createElement('div');
    galleryWrapper.className = 'gallery-modal-grid';
    galleryWrapper.style.cssText = 'position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 92vw; max-width: 850px; height: 80vh;';
    
    galleryWrapper.innerHTML = `
      <div id="gallery-counter-badge" style="position: absolute; top: -10px; background: rgba(18, 16, 28, 0.85); border: 1px solid rgba(255, 159, 252, 0.5); padding: 4px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; color: #ff9ffc; z-index: 12; box-shadow: 0 4px 15px rgba(0,0,0,0.6);">
        1 / ${totalPhotos}
      </div>

      ${totalPhotos > 1 ? `
        <button type="button" id="prev-gallery-photo-btn" class="icon-circle-btn" style="position: absolute; left: 0px; z-index: 15; width: 46px; height: 46px; background: rgba(18, 16, 28, 0.9); border: 1px solid rgba(255, 159, 252, 0.6); font-size: 1.3rem; cursor: pointer; color: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.8);" aria-label="Foto Precedente">❮</button>
        <button type="button" id="next-gallery-photo-btn" class="icon-circle-btn" style="position: absolute; right: 0px; z-index: 15; width: 46px; height: 46px; background: rgba(18, 16, 28, 0.9); border: 1px solid rgba(255, 159, 252, 0.6); font-size: 1.3rem; cursor: pointer; color: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.8);" aria-label="Foto Successiva">❯</button>
      ` : ''}
      
      <div id="gallery-track-container" style="display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; width: 100%; height: 100%; align-items: center; scrollbar-width: none; ms-overflow-style: none;">
        ${vinile.foto_album.map((imgUrl, i) => `
          <div class="gallery-photo-slide" data-slide-index="${i}" style="scroll-snap-align: center; flex: 0 0 100%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 50px; box-sizing: border-box;">
            <img src="${imgUrl}" alt="${vinile.titolo_album} - Foto ${i + 1}" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 18px; border: 2px solid rgba(255, 159, 252, 0.45); box-shadow: 0 12px 35px rgba(0,0,0,0.8); cursor: pointer;" onclick="window.openPhotoModal('${imgUrl}')">
          </div>
        `).join('')}
      </div>
    `;

    const modalBodyWrapper = photoModal.querySelector('.gallery-modal-grid');
    if (modalBodyWrapper) modalBodyWrapper.remove();

    modalImg.style.display = 'none';
    photoModal.appendChild(galleryWrapper);
    photoModal.classList.add('active');
    photoModal.setAttribute('aria-hidden', 'false');

    // NAVIGAZIONE E AGGIORNAMENTO CONTATORE FOTO (1/N)
    const track = galleryWrapper.querySelector('#gallery-track-container');
    const badge = galleryWrapper.querySelector('#gallery-counter-badge');
    const prevBtn = galleryWrapper.querySelector('#prev-gallery-photo-btn');
    const nextBtn = galleryWrapper.querySelector('#next-gallery-photo-btn');

    function scrollToSlide(idx) {
      currentPhotoIdx = Math.max(0, Math.min(idx, totalPhotos - 1));
      const slides = track.querySelectorAll('.gallery-photo-slide');
      if (slides[currentPhotoIdx]) {
        slides[currentPhotoIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      if (badge) badge.textContent = `${currentPhotoIdx + 1} / ${totalPhotos}`;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => scrollToSlide(currentPhotoIdx - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => scrollToSlide(currentPhotoIdx + 1));
    }

    track.addEventListener('scroll', () => {
      const slideWidth = track.clientWidth;
      if (slideWidth > 0) {
        const newIdx = Math.round(track.scrollLeft / slideWidth);
        if (newIdx !== currentPhotoIdx && newIdx >= 0 && newIdx < totalPhotos) {
          currentPhotoIdx = newIdx;
          if (badge) badge.textContent = `${currentPhotoIdx + 1} / ${totalPhotos}`;
        }
      }
    }, { passive: true });
  }
};

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    if (photoModal) {
      photoModal.classList.remove('active');
      photoModal.setAttribute('aria-hidden', 'true');
      const grid = photoModal.querySelector('.gallery-modal-grid');
      if (grid) grid.remove();
      if (modalImg) modalImg.style.display = 'block';
    }
  });
}



// ==========================================
// GESTIONE MODIFICA ED ELIMINAZIONE VINILE
// ==========================================
const editVinylModal = document.getElementById('edit-vinyl-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const editVinylForm = document.getElementById('edit-vinyl-form');
const deleteVinylFromEditBtn = document.getElementById('delete-vinyl-from-edit-btn');

window.openEditVinylModal = async function(id) {
  if (!(await window.checkAdminAccess())) return;
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile) return;

  currentTracklist = vinile.tracce ? [...vinile.tracce] : (vinile.tracklist ? vinile.tracklist.map(t => ({ pos: t.position || t.pos || '', title: t.title || '', duration: t.duration || '' })) : []);

  const getStr = (val) => (!val || val === 'undefined' || val === 'null' || val === 'N/A') ? '' : val;
  const getArtist = () => {
      if (getStr(vinile.artista)) return vinile.artista;
      if (getStr(vinile.artista_clean)) return vinile.artista_clean;
      if (vinile.artists && vinile.artists.length > 0) return typeof vinile.artists[0] === 'string' ? vinile.artists[0] : (vinile.artists[0].name || '');
      return '';
  };
  const getLabel = () => {
      if (getStr(vinile.etichetta)) return vinile.etichetta;
      if (vinile.labels && vinile.labels.length > 0) return vinile.labels[0].name;
      return '';
  };
  const getCatNum = () => {
      if (getStr(vinile.catalog_number)) return vinile.catalog_number;
      if (vinile.labels && vinile.labels.length > 0) return vinile.labels[0].catno;
      return '';
  };
  const getBarcode = () => {
      if (getStr(vinile.codice_a_barre)) return vinile.codice_a_barre;
      const barcodeObj = vinile.identifiers && Array.isArray(vinile.identifiers) ? vinile.identifiers.find(i => i.type && i.type.toLowerCase() === 'barcode') : null;
      return barcodeObj ? barcodeObj.value : '';
  };

  document.getElementById('edit-original-id').value = vinile.id;
  document.getElementById('edit-vinyl-id').value = vinile.id;
  document.getElementById('edit-titolo').value = getStr(vinile.titolo_album) || getStr(vinile.titolo) || getStr(vinile.title) || '';
  document.getElementById('edit-artista').value = getArtist();
  document.getElementById('edit-genere').value = getStr(vinile.genere) || (vinile.genres && vinile.genres.length > 0 ? vinile.genres[0] : '');
  document.getElementById('edit-posizione-fisica').value = getStr(vinile.posizione_fisica);
  document.getElementById('edit-stato-catalogo').value = getStr(vinile.stato_catalogo) || 'Personale';
  
  const rawStimato = getStr(vinile.valore_stimato);
  const vStimato = parseFloat(rawStimato);
  document.getElementById('edit-valore-stimato').value = isNaN(vStimato) ? 25 : vStimato;
  
  const annoOrig = parseInt(getStr(vinile.anno_uscita_originale) || getStr(vinile.year));
  document.getElementById('edit-anno-uscita').value = isNaN(annoOrig) ? '' : annoOrig;
  const annoStampa = parseInt(getStr(vinile.anno_stampa) || getStr(vinile.year));
  document.getElementById('edit-anno-stampa').value = isNaN(annoStampa) ? '' : annoStampa;
  
  document.getElementById('edit-etichetta').value = getLabel();
  document.getElementById('edit-cat-num').value = getCatNum();
  document.getElementById('edit-matrice').value = getStr(vinile.codice_matrice);
  document.getElementById('edit-barcode').value = getBarcode();
  document.getElementById('edit-velocita').value = getStr(vinile.velocita) || '33';
  document.getElementById('edit-grammatura').value = getStr(vinile.grammatura) || '180g';
  document.getElementById('edit-stato-disco').value = getStr(vinile.stato_disco) || '8';
  document.getElementById('edit-stato-copertina').value = getStr(vinile.stato_copertina) || '8';
  document.getElementById('edit-note').value = getStr(vinile.note_stato);

  if (editVinylModal) {
    editVinylModal.classList.add('active');
    editVinylModal.setAttribute('aria-hidden', 'false');
  }
};

if (closeEditModalBtn) {
  closeEditModalBtn.addEventListener('click', () => {
    if (editVinylModal) {
      if (document.activeElement) document.activeElement.blur();
      editVinylModal.classList.remove('active');
      editVinylModal.setAttribute('aria-hidden', 'true');
    }
  });
}

if (editVinylForm) {
  editVinylForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldId = document.getElementById('edit-original-id').value;
    const newId = document.getElementById('edit-vinyl-id').value;
    const currentUser = localStorage.getItem('app_current_user');
    
    showToast("⏳ Salvataggio in corso...");
    
    try {
      let rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
      const rawIndex = rawUserVinyls.findIndex(v => String(v.id) === String(oldId));
      const allIndex = ALL_VINILI.findIndex(v => String(v.id) === String(oldId));
      
      const currentTracce = allIndex !== -1 ? ALL_VINILI[allIndex].tracce : [];
      const originalAnnoUscita = allIndex !== -1 ? ALL_VINILI[allIndex].anno_uscita_originale : '';
      const originalAnnoStampa = allIndex !== -1 ? ALL_VINILI[allIndex].anno_stampa : '';

      const globalVinyl = MASTER_CATALOG.find(v => String(v.id) === String(newId)) || {};

      const formDati = {
        id: newId,
        titolo_album: document.getElementById('edit-titolo').value,
        artista: document.getElementById('edit-artista').value,
        genere: document.getElementById('edit-genere').value,
        posizione_fisica: document.getElementById('edit-posizione-fisica').value,
        stato_catalogo: document.getElementById('edit-stato-catalogo').value,
        valore_stimato: parseFloat(document.getElementById('edit-valore-stimato').value) || 25,
        anno_uscita_originale: parseInt(document.getElementById('edit-anno-uscita').value) || originalAnnoUscita,
        anno_stampa: parseInt(document.getElementById('edit-anno-stampa').value) || originalAnnoStampa,
        etichetta: document.getElementById('edit-etichetta').value,
        catalog_number: document.getElementById('edit-cat-num').value,
        codice_matrice: document.getElementById('edit-matrice').value,
        codice_a_barre: document.getElementById('edit-barcode').value,
        velocita: document.getElementById('edit-velocita').value,
        grammatura: document.getElementById('edit-grammatura').value,
        stato_disco: document.getElementById('edit-stato-disco').value,
        stato_copertina: document.getElementById('edit-stato-copertina').value,
        note_stato: document.getElementById('edit-note').value,
        tracce: currentTracklist.length > 0 ? [...currentTracklist] : (currentTracce || [])
      };

      const personalKeys = ['posizione_fisica', 'stato_catalogo', 'valore_stimato', 'stato_disco', 'stato_copertina', 'note_stato'];
      const updates = {};

      for (const key in formDati) {
          if (personalKeys.includes(key)) {
              updates[key] = formDati[key];
          } else {
              updates[key] = formDati[key]; // Saranno ripuliti se identici al DB globale
          }
      }

      if (rawIndex !== -1) {
        rawUserVinyls[rawIndex] = { ...rawUserVinyls[rawIndex], ...updates };
        // Clean up redundant fields that match global master
        for (const key of Object.keys(rawUserVinyls[rawIndex])) {
            if (key === 'id' || personalKeys.includes(key)) continue;
            
            const localVal = rawUserVinyls[rawIndex][key];
            const globalVal = globalVinyl[key];
            
            const isObj = typeof localVal === 'object' && localVal !== null;
            const strLocal = isObj ? JSON.stringify(localVal) : String(localVal || '');
            const strGlobal = isObj ? JSON.stringify(globalVal || (Array.isArray(localVal) ? [] : {})) : String(globalVal || '');
            
            if (strLocal === strGlobal) {
                delete rawUserVinyls[rawIndex][key];
            }
        }
      } else {
        // Rimuoviamo campi identici prima di creare il nuovo oggetto
        for (const key of Object.keys(updates)) {
            if (key === 'id' || personalKeys.includes(key)) continue;
            const localVal = updates[key];
            const globalVal = globalVinyl[key];
            const isObj = typeof localVal === 'object' && localVal !== null;
            const strLocal = isObj ? JSON.stringify(localVal) : String(localVal || '');
            const strGlobal = isObj ? JSON.stringify(globalVal || (Array.isArray(localVal) ? [] : {})) : String(globalVal || '');
            if (strLocal === strGlobal) {
                delete updates[key];
            }
        }
        rawUserVinyls.push({ id: newId, ...updates });
      }

      await pushDatabaseToGitHub(rawUserVinyls, currentUser);

      // Aggiorna lo stato locale unito
      ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
      safeSave('app_all_vinyls_cache', ALL_VINILI);

      if (editVinylModal) {
        if (document.activeElement) document.activeElement.blur();
        editVinylModal.classList.remove('active');
        editVinylModal.setAttribute('aria-hidden', 'true');
      }

      populateGenreSelect();
      applyFiltering();
      showToast("✏️ Vinile aggiornato con successo!");

    } catch (err) {
      console.error(err);
      showToast("⚠️ Errore durante l'aggiornamento.");
    }
  });
}

window.deleteVinyl = async function(id) {
  if (!(await window.checkAdminAccess())) return;
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile) return;

  if (confirm(`Sei sicuro di voler eliminare "${vinile.titolo_album}" dalla collezione?`)) {
    
    // Fetch raw user DB
    let rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
    
    // Filter out the deleted vinyl
    rawUserVinyls = rawUserVinyls.filter(v => String(v.id) !== String(id));
    
    // Push updated personal DB
    try {
        await pushDatabaseToGitHub(rawUserVinyls, currentUser);
    } catch(e) {
        console.error("Errore salvataggio user DB", e);
    }

    // Update ALL_VINILI
    ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
    safeSave('app_all_vinyls_cache', ALL_VINILI);

    if (editVinylModal) {
      editVinylModal.classList.remove('active');
      editVinylModal.setAttribute('aria-hidden', 'true');
    }

    populateGenreSelect();
    applyFiltering();
    selectIndex(0);
    showToast("🗑️ Vinile eliminato dalla tua collezione.");
  }
};

if (deleteVinylFromEditBtn) {
  deleteVinylFromEditBtn.addEventListener('click', () => {
    const id = document.getElementById('edit-vinyl-id').value;
    if (id) window.deleteVinyl(id);
  });
}

// ==========================================
// GESTIONE POPUP MENÙ IN BASSO CENTRALE (DOCK QUICK MENU)
// ==========================================
const bottomDockBtn = document.getElementById('bottom-dock-btn');
const bottomQuickMenu = document.getElementById('bottom-quick-menu');
const closeQuickMenuBtn = document.getElementById('close-quick-menu-btn');

if (bottomDockBtn && bottomQuickMenu) {
  bottomDockBtn.addEventListener('click', () => {
    bottomQuickMenu.classList.add('active');
    bottomQuickMenu.setAttribute('aria-hidden', 'false');
  });
}

if (closeQuickMenuBtn && bottomQuickMenu) {
  closeQuickMenuBtn.addEventListener('click', () => {
    bottomQuickMenu.classList.remove('active');
    bottomQuickMenu.setAttribute('aria-hidden', 'true');
  });
}

// AZIONI RAPIDE DEL DOCK MENU
document.getElementById('dock-edit-vinyl-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.openEditVinylModal(vinile.id);
});

document.getElementById('dock-delete-vinyl-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.deleteVinyl(vinile.id);
});



document.getElementById('dock-add-vinyl-btn')?.addEventListener('click', async () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  if (typeof window.openDatabaseModal === 'function') window.openDatabaseModal(true);
});

document.getElementById('dock-stats-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  if (statsModal) {
    renderStatsDashboard();
    statsModal.classList.add('active');
    statsModal.setAttribute('aria-hidden', 'false');
  }
});

document.getElementById('dock-export-json-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  exportJsonBtn?.click();
});

// ==========================================
// GESTIONE MODAL IMPOSTAZIONI & TEMI 3D
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
const settingsExportJsonBtn = document.getElementById('settings-export-json-btn');
const settingsExportCsvBtn = document.getElementById('settings-export-csv-btn');
const settingsTriggerImportBtn = document.getElementById('settings-trigger-import-btn');
const settingsImportJsonFile = document.getElementById('settings-import-json-file');

if (closeSettingsModalBtn) {
  closeSettingsModalBtn.addEventListener('click', () => {
    if (settingsModal) {
      if (document.activeElement) document.activeElement.blur();
      settingsModal.classList.remove('active');
      settingsModal.setAttribute('aria-hidden', 'true');
    }
  });
}

// CONTROLLI VALUTA & FREQUENZA SINCRONIZZAZIONE DISCOGS
const currencySelect = document.getElementById('settings-currency-select');
const syncFreqSelect = document.getElementById('settings-discogs-sync-freq');
const forceSyncBtn = document.getElementById('settings-force-sync-discogs-btn');

if (currencySelect) {
  currencySelect.value = localStorage.getItem('app_user_currency') || 'EUR';
  currencySelect.addEventListener('change', (e) => {
    localStorage.setItem('app_user_currency', e.target.value);
    showToast(`💱 Valuta impostata su ${e.target.value}`);
    updateCenterContent();
  });
}

if (syncFreqSelect) {
  syncFreqSelect.value = localStorage.getItem('app_discogs_sync_freq') || 'AUTO_ALWAYS';
  syncFreqSelect.addEventListener('change', (e) => {
    localStorage.setItem('app_discogs_sync_freq', e.target.value);
    showToast(`⚙️ Frequenza Sincronizzazione aggiornata`);
  });


  const githubTokenInput = document.getElementById('settings-github-token');
  if (githubTokenInput) {
    githubTokenInput.value = localStorage.getItem('app_github_token') || '';
    githubTokenInput.addEventListener('change', (e) => {
      localStorage.setItem('app_github_token', e.target.value.trim());
      showToast("☁️ Token GitHub salvato!");
    });
  }

  const unlockGithubTokenBtn = document.getElementById('unlock-github-token-btn');
  if (unlockGithubTokenBtn) {
    unlockGithubTokenBtn.addEventListener('click', async () => {
      const access = await window.checkAdminAccess();
      if (!access) return;
      if (githubTokenInput) {
        githubTokenInput.type = 'text';
        githubTokenInput.removeAttribute('readonly');
        githubTokenInput.focus();
        unlockGithubTokenBtn.style.display = 'none';
      }
    });
  }
}

if (forceSyncBtn) {
  forceSyncBtn.addEventListener('click', async () => {
    const origText = forceSyncBtn.innerHTML;
    forceSyncBtn.innerHTML = '⏳ Sincronizzazione in corso...';
    forceSyncBtn.disabled = true;
    forceSyncBtn.style.opacity = '0.7';
    
    await syncAllDiscogsPrices(true);
    
    forceSyncBtn.innerHTML = origText;
    forceSyncBtn.disabled = false;
    forceSyncBtn.style.opacity = '1';
  });
}

if (settingsExportJsonBtn) {
  settingsExportJsonBtn.addEventListener('click', () => exportJsonBtn?.click());
}
if (settingsExportCsvBtn) {
  settingsExportCsvBtn.addEventListener('click', () => exportCsvBtn?.click());
}
if (settingsTriggerImportBtn && settingsImportJsonFile) {
  settingsTriggerImportBtn.addEventListener('click', () => settingsImportJsonFile.click());
  settingsImportJsonFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          ALL_VINILI = importedData;
          safeSave('app_all_vinyls_cache', ALL_VINILI);
          pushDatabaseToGitHub(ALL_VINILI, localStorage.getItem('app_current_user')).catch(e => console.error(e));
          populateGenreSelect();
          applyFiltering();
          if (settingsModal) settingsModal.classList.remove('active');
          showToast("🎉 Database Vinili Importato con successo!");
        }
      } catch (err) {
        alert("Errore nel formato del file JSON.");
      }
    };
    reader.readAsText(file);
  });
}

// INIZIALIZZA CONTROLLI SLIDER ITERAZIONI, BLUR & PAUSA ANIMAZIONI IN IMPOSTAZIONI
const sharpnessSlider = document.getElementById('settings-sharpness-slider');
if (sharpnessSlider) {
  sharpnessSlider.value = bgIterations;
  sharpnessSlider.addEventListener('input', (e) => updateBackgroundSharpness(e.target.value));
  sharpnessSlider.addEventListener('change', (e) => updateBackgroundSharpness(e.target.value));
}
updateBackgroundSharpness(bgIterations);

const bgBlurSlider = document.getElementById('bg-blur-slider');
if (bgBlurSlider) {
  bgBlurSlider.value = bgBlur.toFixed(1);
  bgBlurSlider.addEventListener('input', (e) => updateBackgroundBlur(e.target.value));
  bgBlurSlider.addEventListener('change', (e) => updateBackgroundBlur(e.target.value));
}
updateBackgroundBlur(bgBlur);

const toggleAnimBtn = document.getElementById('settings-toggle-anim-btn');
if (toggleAnimBtn) {
  toggleAnimBtn.addEventListener('click', toggleBackgroundAnimation);
}
updateAnimationToggleButtonUI();

// ==========================================
// GESTIONE DOCK BAR ORIZZONTALE FLUTTUANTE
// ==========================================
document.getElementById('dock-edit-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.openEditVinylModal(vinile.id);
});

// GESTIONE DOCK BAR ORIZZONTALE FLUTTUANTE & BOTTOM NAV
// ==========================================
document.getElementById('dock-add-btn')?.addEventListener('click', () => {
  if (typeof window.openDatabaseModal === 'function') window.openDatabaseModal(true);
});

document.getElementById('dock-manage-btn')?.addEventListener('click', async () => {
  const vinile = filteredVinili[selectedIndex];
  if (!vinile) {
    if(typeof showToast === 'function') showToast("Nessun vinile selezionato");
    return;
  }
  
  showCustomConfirm({
    title: 'Gestisci Vinile',
    text: "Cosa vuoi fare con questo vinile?",
    buttons: [
      { text: '✏️ Modifica', primary: true, action: async () => {
          const access = await window.checkAdminAccess('edit');
          if (access) window.openEditVinylModal(vinile.id);
      }},
      { text: '🗑️ Elimina', primary: false, danger: true, action: async () => {
          const access = await window.checkAdminAccess('delete');
          if (access) window.deleteVinyl(vinile.id);
      }},
      { text: 'Annulla', primary: false, action: null }
    ]
  });
});

document.getElementById('dock-discogs-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) {
    const query = encodeURIComponent(`${vinile.artista} ${vinile.titolo}`);
    window.open(`https://www.discogs.com/search/?q=${query}&type=all`, '_blank');
  } else {
    Swal.fire({ icon: 'warning', title: 'Nessun vinile selezionato', background: '#1e1e28', color: '#fff' });
  }
});

document.getElementById('dock-spotify-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) {
    let spotifyWebUrl = '';
    let spotifyAppUri = '';

    if (vinile.spotify_url && vinile.spotify_url.startsWith('http')) {
      spotifyWebUrl = vinile.spotify_url;
      // Estrae ID Album da URL web per creare l'URI nativo dell'App (spotify:album:xxx)
      const match = vinile.spotify_url.match(/album\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        spotifyAppUri = `spotify:album:${match[1]}`;
      }
    } else {
      const query = (vinile.artista || '') + ' ' + (vinile.titolo_album || '');
      const encodedQuery = encodeURIComponent(query);
      spotifyWebUrl = `https://open.spotify.com/search/${encodedQuery}`;
      spotifyAppUri = `spotify:search:${encodedQuery}`;
    }

    // TENTA APERTURA NATIVA SU APP INSTALLATA TRAMITE URI SCHEME
    if (spotifyAppUri) {
      const start = Date.now();
      window.location.href = spotifyAppUri;

      // Se l'app nativa non è presente o non risponde entro 1.2s, fa fallback sul browser web
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(spotifyWebUrl, '_blank', 'noopener,noreferrer');
        }
      }, 1200);
    } else {
      window.open(spotifyWebUrl, '_blank', 'noopener,noreferrer');
    }
  }
});

// ==========================================
// GESTIONE JUKEBOX PARTY MODE
// ==========================================
const jukeboxModal = document.getElementById('jukebox-modal');
const closeJukeboxModalBtn = document.getElementById('close-jukebox-modal-btn');
const jukeboxDisplay = document.getElementById('jukebox-display');
const jukeboxRandomBtn = document.getElementById('jukebox-random-btn');
const jukeboxAutoBtn = document.getElementById('jukebox-auto-btn');
let jukeboxTimer = null;

function renderJukeboxVinyl(vinile) {
  if (!jukeboxDisplay || !vinile) return;
  const sv = safeVinile(vinile);
  const fallbackCover = generateSVGAlbumCover(vinile.artista, vinile.titolo_album);
  const coverSrc = (vinile.cover && vinile.cover.trim() !== '') ? vinile.cover : fallbackCover;

  jukeboxDisplay.innerHTML = `
    <div class="floating-art-wrapper" style="margin-bottom: 12px;">
      <div class="album-cover-wrapper playing" style="width: 200px; height: 200px;">
        <img class="album-cover-img" crossorigin="anonymous" src="${coverSrc}" alt="${vinile.titolo_album}" width="200" height="200">
        <div class="vinyl-disc" style="right: -85px;"></div>
      </div>
      <div class="floating-floor-shadow" style="width: 170px;"></div>
    </div>
    <h2 style="color: #fff; font-size: 1.4rem; font-weight: 800; margin-top: 6px;">${sv.titolo_album}</h2>
    <div style="color: #ff9ffc; font-size: 1.1rem; font-weight: 700; margin-top: 2px;">${sv.artista}</div>
    <div style="margin-top: 8px; font-size: 0.82rem; color: #cbd5e1; display: flex; gap: 8px; justify-content: center;">
      <span class="badge badge-purple">${sv.genere || 'Vinile'}</span>
      <span class="badge badge-pink">${sv.anno_uscita_originale || sv.anno_stampa || 'N/A'}</span>
      <span class="badge" style="color:#ff9ffc;">📀 ${sv.stato_catalogo || 'Personale'}</span>
    </div>
  `;
}

function getPersonalVinylsList() {
  const list = ALL_VINILI.filter(v => {
    const cat = (v.stato_catalogo || 'personale').toLowerCase();
    return cat.includes('personale') || cat === '';
  });
  return list.length > 0 ? list : ALL_VINILI;
}

function pickRandomJukeboxVinyl() {
  const list = getPersonalVinylsList();
  if (list.length === 0) return;
  const randIdx = Math.floor(Math.random() * list.length);
  const vinile = list[randIdx];

  // Trova l'indice del vinile estratto nel filtrato globale per sincronizzare la ruota
  const globalIdx = filteredVinili.findIndex(v => v.id === vinile.id);
  if (globalIdx >= 0) selectIndex(globalIdx);

  renderJukeboxVinyl(vinile);
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

document.getElementById('dock-jukebox-btn')?.addEventListener('click', () => {
  if (jukeboxModal) {
    jukeboxModal.classList.add('active');
    jukeboxModal.setAttribute('aria-hidden', 'false');
    const personalList = getPersonalVinylsList();
    const currentVinile = personalList[0] || ALL_VINILI[0];
    renderJukeboxVinyl(currentVinile);
  }
});

if (closeJukeboxModalBtn) {
  closeJukeboxModalBtn.addEventListener('click', () => {
    if (jukeboxModal) {
      if (document.activeElement) document.activeElement.blur();
      jukeboxModal.classList.remove('active');
      jukeboxModal.setAttribute('aria-hidden', 'true');
      if (jukeboxTimer) {
        clearInterval(jukeboxTimer);
        jukeboxTimer = null;
        if (jukeboxAutoBtn) jukeboxAutoBtn.innerHTML = '▶️ Autoplay Party (10s)';
      }
    }
  });
}

if (jukeboxRandomBtn) {
  jukeboxRandomBtn.addEventListener('click', pickRandomJukeboxVinyl);
}

document.getElementById('dock-settings-btn')?.addEventListener('click', () => {
  if (settingsModal) {
    settingsModal.classList.add('active');
    settingsModal.setAttribute('aria-hidden', 'false');
  }
});

// INIZIALIZZA TEMA SALVATO & GESTORE CHIP TEMA
document.querySelectorAll('.theme-chip-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const theme = e.target.getAttribute('data-theme');
    applyAppTheme(theme);
    showToast(`🎨 Tema "${e.target.textContent}" applicato!`);
  });
});

const savedTheme = localStorage.getItem('app_theme_choice') || 'VIOLET';
applyAppTheme(savedTheme);

// INIZIALIZZA L'APPLICAZIONE (Sync globale rimosso per priorizzare le ricerche singole on-demand)
applyFiltering();

// ==========================================
// FUNZIONE DI OVERFLOW DINAMICO PER LA DOCK
// ==========================================
function adjustDockOverflow() {
  const dock = document.getElementById('floating-glass-dock');
  const mainItems = document.getElementById('dock-main-items');
  const moreBtn = document.getElementById('dock-more-btn');
  const overflowMenu = document.getElementById('dock-overflow-menu');

  if (!dock || !mainItems || !moreBtn || !overflowMenu) return;

  // 1. Riporta temporaneamente tutti i pulsanti nel contenitore principale per misurarne la larghezza
  const overflowed = Array.from(overflowMenu.children);
  overflowed.forEach(btn => {
    mainItems.appendChild(btn);
  });

  // Nascondi temporaneamente il pulsante "Altro"
  moreBtn.classList.add('hidden');
  overflowMenu.classList.remove('active');

  const maxAllowedWidth = window.innerWidth * 0.90; // Margine di sicurezza del 10%
  let dockWidth = dock.getBoundingClientRect().width;

  // 2. Se la larghezza della dock supera il massimo consentito, sposta gli elementi in overflow
  if (dockWidth > maxAllowedWidth) {
    moreBtn.classList.remove('hidden');
    
    const allButtons = Array.from(mainItems.children);
    // Cicla a ritroso per spostare i pulsanti più a destra nel menù "Altro"
    for (let i = allButtons.length - 1; i >= 0; i--) {
      const btn = allButtons[i];
      // Inserisce all'inizio dell'overflow in modo da mantenere l'ordine corretto
      overflowMenu.insertBefore(btn, overflowMenu.firstChild);
      
      // Ricalcola la larghezza
      dockWidth = dock.getBoundingClientRect().width;
      if (dockWidth <= maxAllowedWidth) {
        break;
      }
    }
  }
}

// Event Listeners per il Bottone "Altro"
const moreBtnElement = document.getElementById('dock-more-btn');
const overflowMenuElement = document.getElementById('dock-overflow-menu');

if (moreBtnElement && overflowMenuElement) {
  moreBtnElement.addEventListener('click', (e) => {
    e.stopPropagation();
    overflowMenuElement.classList.toggle('active');
  });

  // Chiudi il menù cliccando all'esterno o sulla dock
  document.addEventListener('click', (e) => {
    if (!moreBtnElement.contains(e.target) && !overflowMenuElement.contains(e.target)) {
      overflowMenuElement.classList.remove('active');
    }
  });
}

// Gestione ridimensionamento finestra
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(adjustDockOverflow, 150);
});

// Esegui all'avvio dopo caricamento DOM ed elementi
setTimeout(adjustDockOverflow, 200);

// --- COMMUNITY & PROFILO UTENTE ---

const dockCommunityBtn = document.getElementById('dock-community-btn');
const exploreModal = document.getElementById('explore-modal');
const closeExploreModalBtn = document.getElementById('close-explore-modal-btn');
const communitySearchInput = document.getElementById('community-search-input');
const communitySearchBtn = document.getElementById('community-search-btn');
const communityUserProfile = document.getElementById('community-user-profile');

const settingsProfileUsername = document.getElementById('settings-profile-username');
const settingsProfileBio = document.getElementById('settings-profile-bio');
const settingsSaveProfileBtn = document.getElementById('settings-save-profile-btn');

// Load profile on start
setTimeout(() => {
  const username = localStorage.getItem('app_profile_username') || '';
  const bio = localStorage.getItem('app_profile_bio') || '';
  if(settingsProfileUsername) settingsProfileUsername.value = username;
  if(settingsProfileBio) settingsProfileBio.value = bio;
});

if(settingsSaveProfileBtn) {
  settingsSaveProfileBtn.addEventListener('click', async () => {
    const username = settingsProfileUsername.value.trim();
    const bio = settingsProfileBio.value.trim();
    if(!username) {
      showToast('Inserisci un username valido!', true);
      return;
    }
    
    // Save to local storage
    localStorage.setItem('app_profile_username', username);
    localStorage.setItem('app_profile_bio', bio);
    
    // Build profile
    const profileData = {
      username: username,
      bio: bio,
      friends: [],
      public_vinyls: allVinyls.filter(v => v.stato_catalogo === 'Personale' || v.stato_catalogo === 'In Vendita').map(v => ({ id: v.id, artista: v.artista, titolo: v.titolo, cover: v.cover }))
    };
    
    showToast('Salvataggio profilo in corso...');
    try {
      await pushUserProfile(username, profileData);
      showToast('Profilo e Vetrina salvati con successo su GitHub!');
    } catch(e) {
      console.error(e);
      showToast('Errore durante il salvataggio: ' + e.message, true);
    }
  });
}

const communityAllUsersList = document.getElementById('community-all-users-list');

const communityFriendsList = document.getElementById('community-friends-list');
let currentLoadedProfilesCache = [];

// UI Elements
const sectionExplore = document.getElementById('section-explore');

const userProfileModal = document.getElementById('user-profile-modal');
const closeUserProfileBtn = document.getElementById('close-user-profile-btn');
const upUsername = document.getElementById('up-username');
const upBio = document.getElementById('up-bio');
const upFriendBtn = document.getElementById('up-friend-btn');
const upVinylList = document.getElementById('up-vinyl-list');
const upTabBtns = document.querySelectorAll('.up-tab-btn');

let currentViewedUserDB = [];
let currentViewedUsername = '';


if (closeUserProfileBtn) {
    closeUserProfileBtn.addEventListener('click', () => {
        userProfileModal.classList.remove('active');
        userProfileModal.setAttribute('aria-hidden', 'true');
    });
}

async function refreshCommunityLists() {
    const listContainer = document.getElementById('explore-users-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="font-size: 0.85rem; color: #888; text-align: center;">Caricamento utenti...</p>';
    
    try {
      const users = await fetchAllUsersIndex();
      let profiles = [];
      await Promise.all(users.map(async (u) => {
        try {
          const p = await fetchUserProfile(u);
          if (p) profiles.push(p);
        } catch(e) {}
      }));
      
      currentLoadedProfilesCache = profiles;
      renderCommunityLists();
    } catch (e) {
      listContainer.innerHTML = '<p style="font-size: 0.85rem; color: #ef4444; text-align: center;">Errore durante il caricamento: ' + e.message + '</p>';
    }
}

let currentExploreTab = 'all';
function renderCommunityLists() {
    const listContainer = document.getElementById('explore-users-list');
    if (!listContainer) return;
    
    let profiles = [...currentLoadedProfilesCache];
    const myUsername = localStorage.getItem('app_current_user');
    const myProfile = profiles.find(p => p.username === myUsername);
    const myFriends = myProfile && myProfile.friends ? myProfile.friends : [];
    
    const getFollowers = (username) => profiles.filter(p => p.friends && p.friends.includes(username)).length;
    profiles.sort((a, b) => getFollowers(b.username) - getFollowers(a.username));
    
    // Filter based on tab
    if (currentExploreTab === 'friends') {
        profiles = profiles.filter(p => myFriends.includes(p.username));
    }

    if (profiles.length === 0) {
       listContainer.innerHTML = `<p style="font-size: 0.85rem; color: #888; text-align: center;">${currentExploreTab === 'friends' ? 'Nessun utente seguito.' : 'Nessun utente trovato.'}</p>`;
    } else {
       listContainer.innerHTML = '';
       profiles.forEach(p => {
         const isMe = p.username === myUsername;
         const followers = getFollowers(p.username);
         const item = document.createElement('div');
         
         const borderColor = (currentExploreTab === 'friends' && !isMe) ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255,255,255,0.1)';
         const nameColor = (currentExploreTab === 'friends' && !isMe) ? '#34d399' : '#ff9ffc';
         
         item.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid ${borderColor}; cursor: pointer;`;
         item.innerHTML = `
           <div style="display: flex; flex-direction: column;">
             <span style="color: ${nameColor}; font-weight: 700; font-size: 0.95rem;">${escapeHtml(p.username)} ${isMe ? '(Tu)' : ''}</span>
             <span style="color: #cbd5e1; font-size: 0.75rem;">${followers} follower</span>
           </div>
           <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">Vedi Profilo</button>
         `;
         item.addEventListener('click', () => openUserProfile(p));
         listContainer.appendChild(item);
       });
    }
}


function openExploreModal() {
    if(userProfileModal) {
        userProfileModal.classList.remove('active');
        userProfileModal.setAttribute('aria-hidden', 'true');
    }
    exploreModal.classList.add('active');
    exploreModal.setAttribute('aria-hidden', 'false');
    if(communitySearchInput) communitySearchInput.value = '';
    refreshCommunityLists();
}

if(dockCommunityBtn) {
  dockCommunityBtn.addEventListener('click', openExploreModal);
}

if(closeExploreModalBtn) {
  closeExploreModalBtn.addEventListener('click', () => {
    exploreModal.classList.remove('active');
    exploreModal.setAttribute('aria-hidden', 'true');
  });
}



window.toggleFriend = async function(targetUsername) {
    const myUsername = localStorage.getItem('app_current_user');
    if (!myUsername) {
        if(typeof window.showToast === 'function') window.showToast("Devi aver effettuato l'accesso!", true);
        return;
    }
    
    try {
        if(typeof window.showToast === 'function') window.showToast("Aggiornamento in corso...");
        upFriendBtn.disabled = true;
        
        const myProfile = await fetchUserProfile(myUsername);
        if (!myProfile) throw new Error("Il tuo profilo non è stato trovato.");
        if (!myProfile.friends) myProfile.friends = [];
        
        const isFriend = myProfile.friends.includes(targetUsername);
        if (isFriend) {
            myProfile.friends = myProfile.friends.filter(u => u !== targetUsername);
        } else {
            myProfile.friends.push(targetUsername);
        }
        
        await pushUserProfile(myUsername, myProfile);
        
        if(typeof window.showToast === 'function') window.showToast(isFriend ? `Non segui più questo utente.` : `Hai iniziato a seguire questo utente!`);
        
        // Update UI
        if (isFriend) {
           upFriendBtn.classList.replace('btn-secondary', 'btn-primary');
           upFriendBtn.style.background = 'rgba(52, 211, 153, 0.2)';
           upFriendBtn.style.borderColor = 'rgba(52, 211, 153, 0.5)';
           upFriendBtn.style.color = '#34d399';
           upFriendBtn.textContent = '➕ Segui';
        } else {
           upFriendBtn.classList.replace('btn-primary', 'btn-secondary');
           upFriendBtn.style.background = 'transparent';
           upFriendBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
           upFriendBtn.style.color = '#f87171';
           upFriendBtn.textContent = '❌ Smetti di seguire';
        }
        
        const cacheIdx = currentLoadedProfilesCache.findIndex(p => p.username === myUsername);
        if (cacheIdx !== -1) currentLoadedProfilesCache[cacheIdx] = myProfile;
        
        renderCommunityLists();
        
    } catch (e) {
        if(typeof window.showToast === 'function') window.showToast("Errore: " + e.message, true);
    } finally {
        upFriendBtn.disabled = false;
    }
};

async function openUserProfile(profile) {
  userProfileModal.classList.add('active');
  userProfileModal.setAttribute('aria-hidden', 'false');
  
  upUsername.textContent = `@${profile.username}`;
  upBio.textContent = profile.bio || 'Nessuna bio.';
  currentViewedUsername = profile.username;
  currentViewedUserDB = [];
  
  const myUsername = localStorage.getItem('app_current_user');
  if (myUsername && myUsername !== profile.username) {
      upFriendBtn.style.display = 'block';
      const myProfile = currentLoadedProfilesCache.find(p => p.username === myUsername);
      const isFriend = myProfile && myProfile.friends && myProfile.friends.includes(profile.username);
      
      if (isFriend) {
          upFriendBtn.classList.replace('btn-primary', 'btn-secondary');
          upFriendBtn.style.background = 'transparent';
          upFriendBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          upFriendBtn.style.color = '#f87171';
          upFriendBtn.textContent = '❌ Smetti di seguire';
      } else {
          upFriendBtn.classList.replace('btn-secondary', 'btn-primary');
          upFriendBtn.style.background = 'rgba(52, 211, 153, 0.2)';
          upFriendBtn.style.borderColor = 'rgba(52, 211, 153, 0.5)';
          upFriendBtn.style.color = '#34d399';
          upFriendBtn.textContent = '➕ Segui';
      }
      upFriendBtn.onclick = () => window.toggleFriend(profile.username);
  } else {
      upFriendBtn.style.display = 'none';
  }
  
  upVinylList.innerHTML = '<p style="font-size: 0.85rem; color: #888; text-align: center; grid-column: 1 / -1;">Caricamento collezione remota...</p>';
  
  // Fetch user's entire database da GitHub (veloce, senza passare per il DB gigante su HuggingFace)
  try {
      const rawDB = await fetchDatabaseFromGitHub(profile.username);
      // Mapping veloce locale: i file JSON su GitHub hanno già tutti i dati (backfillati al salvataggio),
      // serve solo mappare i nomi dei campi da Discogs (inglese) a quelli dell'app (italiano)
      currentViewedUserDB = (rawDB || []).map(v => {
          const mapped = { ...v };
          if (mapped.title && !mapped.titolo_album) mapped.titolo_album = mapped.title;
          if (mapped.artists && mapped.artists.length > 0 && !mapped.artista) {
              mapped.artista = typeof mapped.artists[0] === 'string' ? mapped.artists[0] : mapped.artists[0].name;
          }
          if (mapped.artist && !mapped.artista) mapped.artista = mapped.artist;
          if (mapped.year && !mapped.anno_uscita_originale) mapped.anno_uscita_originale = mapped.year;
          if (mapped.labels && mapped.labels.length > 0 && !mapped.etichetta) mapped.etichetta = mapped.labels[0].name;
          if (mapped.genres && mapped.genres.length > 0 && !mapped.genere) mapped.genere = mapped.genres.join(', ');
          if (mapped.tracklist && mapped.tracklist.length > 0 && !mapped.tracce) {
              mapped.tracce = mapped.tracklist.map(t => ({ pos: t.position || '', title: t.title || '', duration: t.duration || '' }));
          }
          return mapped;
      });
      renderUserVinyls('Personale');
  } catch(e) {
      upVinylList.innerHTML = '<p style="font-size: 0.85rem; color: #ef4444; text-align: center; grid-column: 1 / -1;">Errore di caricamento.</p>';
  }
}

function renderUserVinyls(filterState) {
    if(!upVinylList) return;
    
    // Update tabs
    upTabBtns.forEach(btn => {
        if(btn.dataset.filter === filterState) {
            btn.classList.add('active');
            btn.classList.replace('btn-secondary', 'btn-primary');
        } else {
            btn.classList.remove('active');
            btn.classList.replace('btn-primary', 'btn-secondary');
        }
    });
    
    const filtered = currentViewedUserDB.filter(v => v.stato_catalogo === filterState);
    
    if (filtered.length === 0) {
        upVinylList.innerHTML = '<p style="font-size: 0.85rem; color: #888; text-align: center; grid-column: 1 / -1;">Nessun disco in questa sezione.</p>';
        return;
    }
    
    let html = '';
    filtered.forEach(v => {
      const fallbackUrl = generateSVGAlbumCover(v.artista, v.titolo || v.titolo_album);
      const coverUrl = fallbackUrl;
      const needsFetch = 'needs-fetch lazy-db-cover';
      
      html += `
       <div style="display: flex; flex-direction: column; text-align: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 5px;">
         <img src="${escapeHtml(coverUrl)}" class="${needsFetch}" data-artist="${escapeHtml(v.artista)}" data-title="${escapeHtml(v.titolo || v.titolo_album)}" data-release-id="${v.id}" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; margin-bottom: 5px;">
         <div style="font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(v.artista)}</div>
         <div style="font-size: 0.65rem; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(v.titolo || v.titolo_album)}</div>
       </div>
      `;
    });
    upVinylList.innerHTML = html;
    
    // Lazy Loader Cover
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.classList.contains('needs-fetch')) {
                    img.classList.remove('needs-fetch');
                    const artist = img.getAttribute('data-artist');
                    const title = img.getAttribute('data-title');
                    const releaseId = img.getAttribute('data-release-id');
                    
                    getAlbumArt(artist, title, releaseId).then(url => {
                        if(url) {
                            img.src = url;
                            img.style.opacity = 0;
                            setTimeout(() => {
                                img.style.transition = 'opacity 0.4s ease-in-out';
                                img.style.opacity = 1;
                            }, 50);
                        }
                    });
                }
                obs.unobserve(img);
            }
        });
    }, { root: upVinylList, rootMargin: "100px" });
    
    upVinylList.querySelectorAll('.lazy-db-cover').forEach(img => observer.observe(img));
}

upTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        renderUserVinyls(filter);
    });
});


// --- AUTH SYSTEM LOGIC ---
const authModalEl = document.getElementById('auth-modal');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authBioInput = document.getElementById('auth-bio');
const authRegisterFields = document.getElementById('auth-register-fields');
const authErrorMsg = document.getElementById('auth-error-msg');

const authLoginBtn = document.getElementById('auth-login-btn');
const authRegisterBtn = document.getElementById('auth-register-btn');
const authToggleRegisterBtn = document.getElementById('auth-toggle-register-btn');
const authToggleLoginBtn = document.getElementById('auth-toggle-login-btn');

function showAuthError(msg) {
  if (authErrorMsg) {
    authErrorMsg.textContent = msg;
    authErrorMsg.style.display = 'block';
  }
}

if (authToggleRegisterBtn) {
  authToggleRegisterBtn.addEventListener('click', () => {
    authLoginBtn.style.display = 'none';
    authToggleRegisterBtn.style.display = 'none';
    authRegisterBtn.style.display = 'block';
    authToggleLoginBtn.style.display = 'block';
    authRegisterFields.style.display = 'flex';
    authErrorMsg.style.display = 'none';
  });
}

if (authToggleLoginBtn) {
  authToggleLoginBtn.addEventListener('click', () => {
    authLoginBtn.style.display = 'block';
    authToggleRegisterBtn.style.display = 'block';
    authRegisterBtn.style.display = 'none';
    authToggleLoginBtn.style.display = 'none';
    authRegisterFields.style.display = 'none';
    authErrorMsg.style.display = 'none';
  });
}

if (authLoginBtn) {
  authLoginBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    
    if (!username || !password) {
      showAuthError("Inserisci username e password.");
      return;
    }
    
    authLoginBtn.textContent = 'Accesso in corso...';
    try {
      const profile = await fetchUserProfile(username);
      if (!profile) {
        showAuthError("Account non trovato. Registrati prima!");
      } else if (profile.password !== password) {
        showAuthError("Password errata!");
      } else {
        // Login success
        localStorage.setItem('app_current_user', username);
        localStorage.setItem('app_profile_username', username);
        localStorage.setItem('app_profile_bio', profile.bio || '');
        window.location.reload();
      }
    } catch (e) {
      showAuthError("Errore di connessione: " + e.message);
    } finally {
      authLoginBtn.textContent = 'Accedi';
    }
  });
}

if (authRegisterBtn) {
  authRegisterBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    const bio = authBioInput.value.trim();
    
    if (!username || !password) {
      showAuthError("Inserisci username e password.");
      return;
    }
    
    authRegisterBtn.textContent = 'Creazione in corso...';
    try {
      const existing = await fetchUserProfile(username);
      if (existing) {
        showAuthError("L'username è già in uso!");
      } else {
        // Create profile
        const profileData = {
          username: username,
          password: password, // Insecure, but requested
          bio: bio,
          friends: [],
          public_vinyls: []
        };
        await pushUserProfile(username, profileData);
        
        // Initialize empty database for the user
        await pushDatabaseToGitHub([], username);
        
        localStorage.setItem('app_current_user', username);
        localStorage.setItem('app_profile_username', username);
        localStorage.setItem('app_profile_bio', bio);
        window.location.reload();
      }
    } catch (e) {
      showAuthError("Errore durante la registrazione: " + e.message);
    } finally {
      authRegisterBtn.textContent = 'Crea Account';
    }
  });
}

const loggedUser = localStorage.getItem('app_current_user');
const userLabel = document.getElementById('settings-current-user-label');
if (userLabel && loggedUser) {
    userLabel.textContent = `Account: @${loggedUser}`;
}

const authLogoutBtn = document.getElementById('auth-logout-btn');
if (authLogoutBtn) {
    authLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('app_current_user');
      localStorage.removeItem('app_all_vinyls_cache');
      localStorage.removeItem('app_guest_mode');
      window.location.reload();
    });
}

const authGuestBtn = document.getElementById('auth-guest-btn');
if (authGuestBtn) {
    authGuestBtn.addEventListener('click', () => {
        localStorage.setItem('app_guest_mode', 'true');
        authModal.classList.remove('active');
        authModal.setAttribute('aria-hidden', 'true');
        window.location.reload();
    });
}

window.openExploreModal = openExploreModal;

// MODAL ESPLORA DATABASE (GUEST)
const databaseModal = document.getElementById('database-modal');
const closeDatabaseModalBtn = document.getElementById('close-database-modal');
const databaseSearchInput = document.getElementById('database-search-input');
const databaseResults = document.getElementById('database-results');

let isGlobalDbAddMode = false;
window.openDatabaseModal = function(addMode = false) {
    isGlobalDbAddMode = addMode;
    if (!databaseModal) return;
    databaseModal.classList.add('active');
    databaseModal.setAttribute('aria-hidden', 'false');
    renderDatabaseResults([]);
};

if (closeDatabaseModalBtn) {
    closeDatabaseModalBtn.addEventListener('click', () => {
        const detailsContainer = document.getElementById('database-record-details');
        if (detailsContainer && detailsContainer.style.display === 'block') {
            // Se siamo nella scheda dettaglio, chiudere tramite la X significa solo tornare ai risultati
            if (typeof window.hideDatabaseRecordDetails === 'function') {
                window.hideDatabaseRecordDetails();
            }
        } else {
            // Altrimenti, chiudi davvero la finestra modale
            databaseModal.classList.remove('active');
            databaseModal.setAttribute('aria-hidden', 'true');
        }
    });
}

const databaseSearchField = document.getElementById('database-search-field');
if (databaseSearchInput) {
    let searchTimeout = null;
    let currentSearchId = 0;

    const dbDropdownBtn = document.getElementById('db-search-dropdown-btn');
    const dbDropdownMenu = document.getElementById('db-search-dropdown-menu');
    const dbDropdownText = document.getElementById('db-search-dropdown-text');

    if (dbDropdownBtn && dbDropdownMenu && databaseSearchField) {
        dbDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dbDropdownMenu.style.display = dbDropdownMenu.style.display === 'flex' ? 'none' : 'flex';
        });

        document.querySelectorAll('#db-search-dropdown-menu .dropdown-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                databaseSearchField.value = opt.dataset.value;
                dbDropdownText.textContent = opt.textContent;
                dbDropdownMenu.style.display = 'none';
                
                if (databaseSearchInput.value.length >= 3) {
                    databaseSearchInput.dispatchEvent(new Event('input'));
                }
            });
        });

        document.addEventListener('click', () => {
            dbDropdownMenu.style.display = 'none';
        });
    }

    const doSearch = async () => {
        const query = databaseSearchInput.value.toLowerCase().replace(/'/g, "''").replace(/"/g, "").trim();
        if(query.length < 3) {
            renderDatabaseResults([]);
            return;
        }
        
        // Inizializzazione lazy del database SQLite: se non è ancora stato caricato, lo carichiamo al primo uso
        if(!sqliteWorker) {
            if (databaseResults) {
                databaseResults.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #a5b4fc; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <div style="border: 4px solid rgba(165, 180, 252, 0.2); border-top: 4px solid #a5b4fc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                        <div style="font-size: 0.95rem; font-weight: 500; letter-spacing: 0.5px;">Connessione al database globale...</div>
                        <div style="font-size: 0.78rem; color: #9ca3af;">Prima connessione, potrebbe richiedere qualche secondo</div>
                    </div>
                `;
            }
            try {
                await initSqliteDb();
            } catch(e) {
                console.error("Errore inizializzazione SQLite:", e);
                if (databaseResults) {
                    databaseResults.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444;">❌ Impossibile connettersi al database globale. Riprova più tardi.</div>`;
                }
                return;
            }
            if(!sqliteWorker) {
                if (databaseResults) {
                    databaseResults.innerHTML = `<div style="padding: 40px; text-align: center; color: #ef4444;">❌ Database globale non disponibile.</div>`;
                }
                return;
            }
        }
        
        const searchId = ++currentSearchId;
        const startTime = performance.now();
        
        if (databaseResults) {
            databaseResults.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #a5b4fc; display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <div style="border: 4px solid rgba(165, 180, 252, 0.2); border-top: 4px solid #a5b4fc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                    <div style="font-size: 0.95rem; font-weight: 500; letter-spacing: 0.5px;">Ricerca in corso...</div>
                </div>
            `;
        }
        
        try {
            const field = databaseSearchField ? databaseSearchField.value : 'all';
            
            // FTS5: applica il wildcard a ogni singola parola (es. "iron maiden" → "iron* maiden*")
            // così cercare "maiden" o parole parziali trova correttamente i record nel DB
            const tokens = query.trim().split(/\s+/).filter(t => t.length > 0);
            const wildcardTokens = tokens.map(t => t + '*').join(' ');
            
            let matchExpr;
            if (field !== 'all') {
                matchExpr = `'${field}: "${wildcardTokens}"'`;
            } else {
                matchExpr = `'${wildcardTokens}'`;
            }
            
            // NOTA: rimosso GROUP BY lower(artist), lower(title) dalla query SQL perché SQLite
            // non supporta regex e non può pulire i suffissi Discogs (es. "Iron Maiden (2)").
            // La deduplicazione avviene nel JS (renderDatabaseResults) dopo la sanificazione
            // dell'artista con replace(/\s*\(\d+\)$/, '').
            const sql = `
                SELECT f.id, v.title, v.artist, v.matrix, json_extract(v.data, '$.formats') as formats
                FROM (
                    SELECT id, rank 
                    FROM vinyls_fts 
                    WHERE vinyls_fts MATCH ${matchExpr} 
                    ORDER BY rank 
                    LIMIT 200
                ) f 
                JOIN vinyls v ON f.id = v.id 
                ORDER BY f.rank
            `;
            const results = await sqliteWorker.db.query(sql);
            
            // Ignora i risultati se è iniziata una ricerca più recente
            if (searchId !== currentSearchId) return;
            
            const filtered = results.map(r => ({
                id: r.id,
                title: r.title,
                artists: [r.artist],
                identifiers: r.matrix ? [{ type: 'Matrix / Runout', value: r.matrix }] : [],
                formats: r.formats ? JSON.parse(r.formats) : [],
                is_lightweight: true
            }));
            renderDatabaseResults(filtered, startTime);
        } catch(e) {
            if (searchId === currentSearchId) {
                console.error("Search error", e);
            }
        }
    };

    const debouncedSearch = () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(doSearch, 400);
    };

    databaseSearchInput.addEventListener('input', debouncedSearch);
    if (databaseSearchField) {
        databaseSearchField.addEventListener('change', doSearch);
    }
}

const albumArtCache = new Map();
const itunesCache = new Map();
const discogsCache = new Map();

function normalizeString(str) {
    if (!str) return '';
    return str.normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Rimuove accenti
              .toLowerCase()
              .replace(/\s*\(\d+\)$/, '')      // Rimuove suffissi numerici (es. "(2)")
              .replace(/[^\w\s]/g, ' ')        // Sostituisce punteggiatura con spazi
              .replace(/\s+/g, ' ')            // Comprime spazi multipli in un solo spazio
              .trim();
}

async function fetchFromITunes(artist, title) {
    if (!artist || !title) return null;
    const normalizedArtist = normalizeString(artist);
    const key = `${normalizedArtist}|${title}`.toLowerCase();
    if (itunesCache.has(key)) return await itunesCache.get(key);
    
    let resCache;
    const p = new Promise(r => resCache = r);
    itunesCache.set(key, p);
    
    try {
        const query = encodeURIComponent(normalizedArtist + ' ' + title);
        const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=album&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
                const resultArtist = normalizeString(data.results[0].artistName);
                const searchArtist = normalizedArtist;
                const resultTitle = normalizeString(data.results[0].collectionName);
                const searchTitle = normalizeString(title);
                
                const isArtistMatch = resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist);
                const isTitleMatch = resultTitle.includes(searchTitle) || searchTitle.includes(resultTitle);
                
                // Validazione rigorosa doppia (artista + titolo)
                if (isArtistMatch && isTitleMatch) {
                    const url = data.results[0].artworkUrl100.replace('100x100', '300x300');
                    itunesCache.set(key, url);
                    resCache(url);
                    return url;
                } else {
                    console.warn(`iTunes ha trovato un mismatch: '${data.results[0].artistName} - ${data.results[0].collectionName}' invece di '${artist} - ${title}'. Scarto il risultato.`);
                }
            }
        }
    } catch(e) { console.warn("iTunes fetch error", e); }
    
    itunesCache.set(key, null);
    resCache(null);
    return null;
}

async function fetchFromDiscogs(releaseId) {
    if (!releaseId || String(releaseId).startsWith('FALLBACK_')) return null;
    if (discogsCache.has(releaseId)) return await discogsCache.get(releaseId);
    
    let resCache;
    const p = new Promise(r => resCache = r);
    discogsCache.set(releaseId, p);
    
    try {
        const token = getDiscogsToken();
        const headers = {};
        if (token) headers['Authorization'] = `Discogs token=${token}`;
        
        const res = await fetch(`https://api.discogs.com/releases/${releaseId}`, { headers });
        if (res.status === 429) {
            console.warn("Discogs Rate Limit (429)");
            throw new Error("429");
        }
        if (res.ok) {
            const data = await res.json();
            if (data.images && data.images.length > 0) {
                const primary = data.images.find(img => img.type === 'primary') || data.images[0];
                const proxiedUri = `https://images.weserv.nl/?url=${encodeURIComponent(primary.uri)}`;
                discogsCache.set(releaseId, proxiedUri);
                resCache(proxiedUri);
                return proxiedUri;
            }
        }
    } catch(e) { console.warn("Discogs fetch error", e); }
    
    discogsCache.set(releaseId, null);
    resCache(null);
    return null;
}

async function getAlbumArt(artist, title, releaseId) {
    if (!releaseId) return null;
    if (albumArtCache.has(releaseId)) {
        return await albumArtCache.get(releaseId);
    }
    
    let resolveCache;
    const promise = new Promise(r => resolveCache = r);
    albumArtCache.set(releaseId, promise);
    
    let finalUrl = await fetchFromITunes(artist, title);
    
    if (!finalUrl) {
        finalUrl = await fetchFromDiscogs(releaseId);
    }
    
    albumArtCache.set(releaseId, finalUrl);
    resolveCache(finalUrl);
    return finalUrl;
}

function renderDatabaseResults(results, startTime) {
    if (!databaseResults) return;
    
    let timeText = '';
    if (startTime) {
        const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
        timeText = `<div style="text-align: center; color: #a5b4fc; font-size: 0.85rem; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">Trovati ${results ? results.length : 0} risultati grezzi in ${seconds} secondi...</div>`;
    }

    if (!results || results.length === 0) {
        databaseResults.innerHTML = timeText + '<div style="padding: 20px; text-align: center; color: #9ca3af;">Nessun vinile trovato.</div>';
        return;
    }

    const seen = new Map();
    for (const v of results) {
        let artista = (v.artists && v.artists.length > 0) ? String(v.artists[0]) : 'Artista ignoto';
        artista = artista.trim();
        
        const titolo_album = v.title || 'Sconosciuto';
        const key = String(v.id);
        
        v.artista_clean = artista;
        
        const hasMatrix = Array.isArray(v.identifiers) && v.identifiers.some(i => i.type === 'Matrix / Runout');
        
        if (!seen.has(key)) {
            seen.set(key, { ...v, artista: artista, titolo_album });
        } else {
            const stored = seen.get(key);
            const storedHasMatrix = Array.isArray(stored.identifiers) && stored.identifiers.some(i => i.type === 'Matrix / Runout');
            if (!storedHasMatrix && hasMatrix) {
                stored.identifiers = v.identifiers;
                stored.id = v.id;
            }
        }
    }
    
    const uniqueResults = Array.from(seen.values());

    const query = document.getElementById('database-search-input') ? document.getElementById('database-search-input').value.toLowerCase().trim() : '';

    uniqueResults.sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        
        // 1. Penalizza Bootleg/Unofficial leggendo i formati originali
        const checkUnofficial = (v) => v.formats && v.formats.some(f => f.descriptions && (f.descriptions.includes('Unofficial Release') || f.descriptions.includes('Bootleg')));
        const aUnofficial = checkUnofficial(a);
        const bUnofficial = checkUnofficial(b);
        if (aUnofficial && !bUnofficial) return 1;
        if (!aUnofficial && bUnofficial) return -1;

        // 2. Corrispondenza esatta
        const aExact = aTitle === query;
        const bExact = bTitle === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 3. Penalizza live/compilation dal titolo
        const isMinor = (title) => /live\b|best of|greatest hits|compilation|anthology|collection|vol\.|volume\b|session/i.test(title);
        const aMinor = isMinor(aTitle);
        const bMinor = isMinor(bTitle);
        
        if (aMinor && !bMinor) return 1;
        if (!aMinor && bMinor) return -1;
        
        // 4. Titolo più corto (album originale)
        return aTitle.length - bTitle.length;
    });

    window.currentDatabaseResults = uniqueResults;
    
    let finalTimeText = '';
    if (startTime) {
        const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
        finalTimeText = `<div style="text-align: center; color: #a5b4fc; font-size: 0.9rem; font-weight: 500; margin-bottom: 20px; padding: 10px; background: rgba(165,180,252,0.1); border-radius: 8px;">Trovati ${uniqueResults.length} elementi unici in ${seconds} secondi</div>`;
    }

    databaseResults.innerHTML = finalTimeText + uniqueResults.map(v => {
        let codice_matrice = 'N/A';
        // Estrazione raw della matrice usando optional chaining
        if (Array.isArray(v.identifiers)) {
            const matrixObj = v.identifiers.find(i => i.type === 'Matrix / Runout');
            if (matrixObj && matrixObj.value) {
                codice_matrice = matrixObj.value.trim();
            }
        }

        // Determina se è Unofficial
        const checkUnofficial = (vin) => vin.formats && vin.formats.some(f => f.descriptions && (f.descriptions.includes('Unofficial Release') || f.descriptions.includes('Bootleg')));
        const isUnofficial = checkUnofficial(v);

        let badgesHtml = '<span style="background:rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color:#6ee7b7; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:6px;">VINYL</span>';
        
        if (isUnofficial) {
            badgesHtml += '<span style="background:rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color:#fca5a5; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:6px;">UNOFFICIAL</span>';
        }

        const fallbackCover = generateSVGAlbumCover(v.artista, v.titolo_album);
        const coverSrc = (v.cover && v.cover.trim() !== '') ? v.cover : fallbackCover;
        const needsFetch = (!v.cover || v.cover.trim() === '') ? 'lazy-db-cover' : '';
        const cleanArtist = escapeHtml(v.artista.replace(/\s*\(\d+\)$/, '').trim());
        const cleanTitle = escapeHtml(v.titolo_album);
        
        const addBtnHTML = isGlobalDbAddMode ? `<button type="button" onclick="event.stopPropagation(); window.addToCollectionFromGlobalDb('${v.id}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; flex-shrink: 0; margin-left: 10px;">Aggiungi</button>` : '';
        return `
            <div style="display: flex; gap: 15px; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); align-items: center; cursor: pointer;" onclick="window.showDatabaseRecordDetails('${v.id}')">
                <img id="db-cover-${v.id}" class="${needsFetch}" data-release-id="${v.id}" data-artist="${cleanArtist}" data-title="${cleanTitle}" src="${coverSrc}" style="width: 60px; height: 60px; border-radius: 6px; object-fit: cover; flex-shrink: 0;" onerror="this.onerror=null; this.src='${fallbackCover}';">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: bold; color: white; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(v.titolo_album)}</div>
                    <div style="font-size: 0.9rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">${escapeHtml(v.artista)}</div>
                    <div style="margin-bottom: 6px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">${badgesHtml}</div>
                    <div style="font-size: 0.8rem; color: #9ca3af; word-break: break-word; line-height: 1.4;" title="${escapeHtml(codice_matrice)}">Matrice: ${escapeHtml(codice_matrice)}</div>
                    <div style="font-size: 0.8rem; color: #9ca3af; word-break: break-word; line-height: 1.4;">ID Database: ${escapeHtml(v.id)}</div>
                </div>
                ${addBtnHTML}
            </div>
        `;
    }).join('');

    // Intersection Observer per lazy loading a cascata (iTunes -> Discogs)
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(async entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                obs.unobserve(img); // Smetti di osservare una volta entrato in viewport
                
                const rid = img.getAttribute('data-release-id');
                const art = img.getAttribute('data-artist');
                const tit = img.getAttribute('data-title');
                
                if (rid && art && tit) {
                    const url = await getAlbumArt(art, tit, rid);
                    if (url) {
                        img.src = url;
                    }
                }
            }
        });
    }, { root: null, rootMargin: "200px" });
    
    document.querySelectorAll('.lazy-db-cover').forEach(img => observer.observe(img));
}

window.showDatabaseRecordDetails = async function(id, fromPersonal = false) {
    let record;
    if (fromPersonal) {
        window._openedDetailsFromPersonal = true;
        const baseRecord = ALL_VINILI.find(r => String(r.id) === String(id));
        if (baseRecord) {
            record = {...baseRecord};
            record.is_lightweight = false;
        }
    } else {
        window._openedDetailsFromPersonal = false;
        record = (window.currentDatabaseResults || []).find(r => String(r.id) === String(id));
    }
    
    if (!record) return;
    
    const detailsContainer = document.getElementById('database-record-details');
    
    if (fromPersonal) {
        const dbModal = document.getElementById('database-modal');
        if (dbModal) {
            dbModal.classList.add('active');
            dbModal.setAttribute('aria-hidden', 'false');
        }
    }
    
    document.getElementById('database-search-header').style.display = 'none';
    document.getElementById('database-results').style.display = 'none';
    detailsContainer.style.display = 'block';
    
    const coverImg = document.getElementById(`db-cover-${id}`);
    const coverSrc = coverImg ? coverImg.src : generateSVGAlbumCover(record.artista, record.titolo_album);
    
    // Mostra uno spinner mentre scarica i dettagli completi se necessario
    if (record.is_lightweight) {
        detailsContainer.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <div style="border: 4px solid rgba(255,159,252,0.3); border-top: 4px solid #ff9ffc; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <div style="color: #ff9ffc; font-weight: bold;">Estrazione info dal database...</div>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
        
        try {
            const res = await sqliteWorker.db.query(`SELECT data FROM vinyls WHERE id = '${id}'`);
            if (res.length > 0) {
                const fullRecord = JSON.parse(res[0].data);
                // Mantiene i campi normalizzati creati in renderDatabaseResults
                fullRecord.artista = record.artista;
                fullRecord.titolo_album = record.titolo_album;
                Object.assign(record, fullRecord);
                record.is_lightweight = false;
            }
        } catch(e) {
            console.error(e);
            detailsContainer.innerHTML = '<div style="text-align: center; color: #f87171; padding: 30px;">Errore durante il caricamento dei dati.</div>';
            return;
        }
    }
    
    const addBtnHTML = isGlobalDbAddMode ? `<button type="button" onclick="event.stopPropagation(); window.addToCollectionFromGlobalDb('${record.id}')" style="background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 15px;">Aggiungi alla Collezione</button>` : '';
    
    let infoHtml = `<div style="margin-top: 15px; font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; text-align: left;">`;
    infoHtml += `<div><strong style="color:white;">ID Database:</strong> ${escapeHtml(String(record.id))}</div>`;
    if (record.year) infoHtml += `<div><strong style="color:white;">Anno:</strong> ${escapeHtml(String(record.year))}</div>`;
    
    if (Array.isArray(record.labels) && record.labels.length > 0) {
        infoHtml += `<div><strong style="color:white;">Etichetta:</strong> ${escapeHtml(record.labels.map(l => l.name).join(', '))}</div>`;
    }
    
    if (Array.isArray(record.formats) && record.formats.length > 0) {
        infoHtml += `<div><strong style="color:white;">Formato:</strong> ${escapeHtml(record.formats.map(f => (f.name || '') + (f.descriptions ? ' (' + f.descriptions.join(', ') + ')' : '')).join(' | '))}</div>`;
    }
    
    // Aggiungi dettagli estesi (Paese, Data Rilascio, Generi, Stili)
    if (record.country) infoHtml += `<div><strong style="color:white;">Paese:</strong> ${escapeHtml(record.country)}</div>`;
    if (record.released) infoHtml += `<div><strong style="color:white;">Data Pubblicazione:</strong> ${escapeHtml(record.released)}</div>`;
    if (record.format_quantity) infoHtml += `<div><strong style="color:white;">Quantità Supporti:</strong> ${escapeHtml(String(record.format_quantity))}</div>`;
    if (record.data_quality) infoHtml += `<div><strong style="color:white;">Qualità Dati Discogs:</strong> ${escapeHtml(record.data_quality)}</div>`;
    if (record.status) infoHtml += `<div><strong style="color:white;">Stato:</strong> ${escapeHtml(record.status)}</div>`;

    // Dettagli Personali
    if (fromPersonal) {
        infoHtml += `<div style="margin-top: 15px; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border-left: 4px solid #ff9ffc;">`;
        infoHtml += `<strong style="color:white; display:block; margin-bottom: 8px; font-size: 0.95rem;">Dettagli Collezione Personale:</strong>`;
        if (record.stato_disco) infoHtml += `<div><strong style="color:white;">Stato Disco:</strong> ${escapeHtml(String(record.stato_disco))}</div>`;
        if (record.stato_copertina) infoHtml += `<div><strong style="color:white;">Stato Copertina:</strong> ${escapeHtml(String(record.stato_copertina))}</div>`;
        if (record.stato_catalogo) infoHtml += `<div><strong style="color:white;">Stato Catalogo:</strong> ${escapeHtml(String(record.stato_catalogo))}</div>`;
        if (record.note_stato) infoHtml += `<div><strong style="color:white;">Note:</strong> ${escapeHtml(String(record.note_stato))}</div>`;
        
        if (Array.isArray(record.foto_album) && record.foto_album.length > 0) {
            infoHtml += `<div style="margin-top: 10px;"><strong style="color:white; display:block; margin-bottom: 5px;">Foto Album Personali:</strong>`;
            infoHtml += `<div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px;">`;
            record.foto_album.forEach(foto => {
                infoHtml += `<a href="${escapeHtml(foto)}" target="_blank"><img src="${escapeHtml(foto)}" style="height: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); object-fit: cover;"></a>`;
            });
            infoHtml += `</div></div>`;
        }
        infoHtml += `</div>`;
    }

    if (Array.isArray(record.genres) && record.genres.length > 0) {
        infoHtml += `<div><strong style="color:white;">Genere:</strong> ${escapeHtml(record.genres.join(', '))}</div>`;
    }
    if (Array.isArray(record.styles) && record.styles.length > 0) {
        infoHtml += `<div><strong style="color:white;">Stile:</strong> ${escapeHtml(record.styles.join(', '))}</div>`;
    }
    if (Array.isArray(record.series) && record.series.length > 0) {
        infoHtml += `<div><strong style="color:white;">Serie:</strong> ${escapeHtml(record.series.map(s => s.name).join(', '))}</div>`;
    }
    
    // Community Stats
    if (record.community) {
        infoHtml += `<div style="margin-top: 10px; font-size: 0.85rem; color: #9ca3af;">
            <strong style="color:white;">Community Discogs:</strong> 
            Posseduto da ${record.community.have || 0} | Desiderato da ${record.community.want || 0} 
            ${record.community.rating ? `| Voto: ${record.community.rating.average}/5 (${record.community.rating.count} voti)` : ''}
        </div>`;
    }
    
    // Aziende / Case Discografiche
    if (Array.isArray(record.companies) && record.companies.length > 0) {
        infoHtml += `<div style="margin-top: 10px;"><strong style="color:white; display:block;">Società / Case Discografiche:</strong>`;
        record.companies.forEach(comp => {
            infoHtml += `<div style="font-size: 0.85rem; padding-left: 10px; color: #9ca3af;">• ${escapeHtml(comp.entity_type_name || 'Azienda')}: <span style="color: #cbd5e1;">${escapeHtml(comp.name)}</span></div>`;
        });
        infoHtml += `</div>`;
    }
    
    // Autori / Crediti (Combina credits e extraartists)
    let allCredits = [];
    if (Array.isArray(record.credits)) allCredits = allCredits.concat(record.credits);
    if (Array.isArray(record.extraartists)) allCredits = allCredits.concat(record.extraartists);
    
    if (allCredits.length > 0) {
        infoHtml += `<div style="margin-top: 10px;"><strong style="color:white; display:block;">Tutti i Crediti / Autori:</strong>`;
        allCredits.forEach(cred => {
            infoHtml += `<div style="font-size: 0.85rem; padding-left: 10px; color: #9ca3af;">• ${escapeHtml(cred.role)}: <span style="color: #cbd5e1;">${escapeHtml(cred.name)}</span> ${cred.tracks ? `(Tracce: ${escapeHtml(cred.tracks)})` : ''}</div>`;
        });
        infoHtml += `</div>`;
    }

    // Identificatori (Barcode, Matrici, ecc)
    if (Array.isArray(record.identifiers) && record.identifiers.length > 0) {
        infoHtml += `<div style="margin-top: 10px;"><strong style="color:white; display:block;">Tutti gli Identificatori:</strong>`;
        record.identifiers.forEach(ident => {
            infoHtml += `<div style="font-size: 0.85rem; padding-left: 10px; color: #cbd5e1;">• <span style="color: #9ca3af;">${escapeHtml(ident.type)}:</span> ${escapeHtml(ident.value)} ${ident.description ? `(${escapeHtml(ident.description)})` : ''}</div>`;
        });
        infoHtml += `</div>`;
    }
    
    // Note della release (TUTTE)
    if (record.notes) {
        infoHtml += `<div style="margin-top: 10px; font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border-left: 4px solid #ff9ffc;">
            <strong style="color:white; display:block; margin-bottom: 8px; font-size: 0.95rem;">Note complete della release (inserti, dettagli, ecc):</strong>
            <div style="white-space: pre-wrap; font-family: monospace; color: #e2e8f0; line-height: 1.5;">${escapeHtml(record.notes)}</div>
        </div>`;
    }
    
    // Video
    if (Array.isArray(record.videos) && record.videos.length > 0) {
        infoHtml += `<div style="margin-top: 10px;"><strong style="color:white; display:block;">Video collegati:</strong>`;
        record.videos.forEach(v => {
            infoHtml += `<div style="font-size: 0.85rem; padding-left: 10px; margin-bottom: 4px;"><a href="${escapeHtml(v.uri)}" target="_blank" style="color: #a5b4fc; text-decoration: underline;">▶ ${escapeHtml(v.title || 'Video')}</a></div>`;
        });
        infoHtml += `</div>`;
    }
    
    // Aggiungi la Tracklist
    if (Array.isArray(record.tracklist) && record.tracklist.length > 0) {
        infoHtml += `<div style="margin-top: 15px;"><strong style="color:white; display:block; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Tracklist Completa:</strong>`;
        record.tracklist.forEach(t => {
            infoHtml += `<div style="display: flex; flex-direction: column; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div style="display: flex; justify-content: space-between;">
                                <span><span style="color:#888; margin-right: 8px;">${escapeHtml(t.position || '-')}</span><strong style="color: #e2e8f0;">${escapeHtml(t.title)}</strong></span>
                                <span style="color: #9ca3af;">${escapeHtml(t.duration || '')}</span>
                            </div>`;
            // Extra artisti per la singola traccia
            if (Array.isArray(t.extraartists) && t.extraartists.length > 0) {
                t.extraartists.forEach(ea => {
                    infoHtml += `<div style="font-size: 0.75rem; color: #6b7280; padding-left: 20px;">- ${escapeHtml(ea.role)}: ${escapeHtml(ea.name)}</div>`;
                });
            }
            infoHtml += `</div>`;
        });
        infoHtml += `</div>`;
    }
    
    infoHtml += `</div>`;
    
    detailsContainer.innerHTML = `
        <button type="button" onclick="window.hideDatabaseRecordDetails()" style="background: none; border: none; color: #ff9ffc; font-weight: bold; cursor: pointer; padding: 10px 0; margin-bottom: 10px; display: flex; align-items: center; gap: 5px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Torna ai risultati
        </button>
        <div style="text-align: center;">
            <img src="${coverSrc}" style="width: 200px; height: 200px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-bottom: 15px;">
            <h2 style="color: white; margin: 0 0 5px 0; font-size: 1.3rem;">${escapeHtml(record.titolo_album)}</h2>
            <h3 style="color: #ff9ffc; margin: 0 0 15px 0; font-size: 1.1rem; font-weight: bold;">${escapeHtml(record.artista)}</h3>
        </div>
        ${infoHtml}
        ${addBtnHTML}
    `;
};

window.hideDatabaseRecordDetails = function() {
    if (window._openedDetailsFromPersonal) {
        window._openedDetailsFromPersonal = false;
        const dbModal = document.getElementById('database-modal');
        if (dbModal) {
            dbModal.classList.remove('active');
            dbModal.setAttribute('aria-hidden', 'true');
        }
    }

    const detailsContainer = document.getElementById('database-record-details');
    if(detailsContainer) detailsContainer.style.display = 'none';
    
    const searchHeader = document.getElementById('database-search-header');
    if(searchHeader) searchHeader.style.display = 'flex';
    
    const resultsContainer = document.getElementById('database-results');
    if(resultsContainer) resultsContainer.style.display = 'block';
};

window.startMatrixSearch = function(prefix) { console.log('startMatrixSearch called with prefix:', prefix); 
    const matriceInput = document.getElementById(`${prefix}-matrice`);
    if (!matriceInput || !matriceInput.value.trim()) {
        showToast("⚠️ Inserisci un codice matrice prima di cercare.");
        return;
    }
    const matrice = matriceInput.value.trim();
    searchDiscogsMatrixAndFill(matrice, prefix);
};

async function searchDiscogsMatrixAndFill(matrice, prefix) {
  const token = getDiscogsToken();
  const headers = { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' };
  if (token) headers['Authorization'] = `Discogs token=${token}`;
  
  showToast("🔍 Ricerca codice matrice su Discogs...");
  try {
    const searchRes = await fetch(`https://api.discogs.com/database/search?query=${encodeURIComponent(matrice)}&type=release`, { headers });
    if (!searchRes.ok) throw new Error();
    const searchData = await searchRes.json();
    if (searchData.results && searchData.results.length > 0) {
      const releaseId = searchData.results[0].id;
      await fetchAndFillFullRelease(releaseId, prefix);
    } else {
      showToast("❌ Nessun risultato trovato su Discogs per questa matrice.");
    }
  } catch(e) {
    showToast("❌ Errore durante la ricerca su Discogs.");
  }
}

setTimeout(() => {
  const addBtn = document.getElementById('start-add-matrix-scan-btn');
  if (addBtn) addBtn.addEventListener('click', (e) => { e.preventDefault(); window.startMatrixSearch('add'); });
  
  const editBtn = document.getElementById('start-edit-matrix-scan-btn');
  if (editBtn) editBtn.addEventListener('click', (e) => { e.preventDefault(); window.startMatrixSearch('edit'); });
});

window.addToCollectionFromGlobalDb = async function(globalId) {
    if (!sqliteWorker) {
        showToast("⬇️ Connessione al database globale...");
        try {
            await initSqliteDb();
        } catch(e) {
            showToast("❌ Impossibile connettersi al database.");
            return;
        }
        if (!sqliteWorker) {
            showToast("❌ Database globale non disponibile.");
            return;
        }
    }
    
    // Mostriamo un caricamento perché dobbiamo fare chiamate di rete
    showToast("⏳ Ricerca in corso...");

    try {
        const results = await sqliteWorker.db.query(`SELECT data FROM vinyls WHERE id = '${globalId}'`);
        if(results.length === 0) {
            showToast("❌ Vinile non trovato nel database.");
            return;
        }
        const vinileGlobale = JSON.parse(results[0].data);
        
        // Mappatura dei dati globali per il database personale
        let mappedData = { ...vinileGlobale };
        if (mappedData.title && !mappedData.titolo_album) mappedData.titolo_album = mappedData.title;
        if (mappedData.artists && mappedData.artists.length > 0 && !mappedData.artista) mappedData.artista = mappedData.artists[0].name;
        if (mappedData.artist && !mappedData.artista) mappedData.artista = mappedData.artist;
        if (mappedData.year && !mappedData.anno_uscita_originale) mappedData.anno_uscita_originale = mappedData.year;
        if (mappedData.labels && mappedData.labels.length > 0 && !mappedData.etichetta) mappedData.etichetta = mappedData.labels[0].name;
        if (mappedData.label && !mappedData.etichetta) mappedData.etichetta = mappedData.label;
        if (mappedData.catno && !mappedData.catalog_number) mappedData.catalog_number = mappedData.catno;
        if (mappedData.barcode && !mappedData.codice_a_barre) mappedData.codice_a_barre = mappedData.barcode;
        
        // Aggiungiamo l'oggetto completo con i valori personali di default e il flag
        const p = { 
            ...mappedData,
            id: mappedData.id || vinileGlobale.id,
            stato_disco: '8',
            stato_copertina: '8',
            valore_stimato: 25,
            posizione_fisica: '',
            stato_catalogo: 'Personale',
            note_stato: '',
            _backfilled: true
        };
        
        const currentUser = localStorage.getItem('app_current_user');
        let rawUserVinyls = await fetchDatabaseFromGitHub(currentUser);
        rawUserVinyls.push(p);
        
        showToast("⏳ Sincronizzazione in corso...");
        await pushDatabaseToGitHub(rawUserVinyls, currentUser);
        
        // Aggiorniamo la cache locale fondendo il catalogo master
        ALL_VINILI = await joinVinylDataAsync(rawUserVinyls);
        safeSave('app_all_vinyls_cache', ALL_VINILI);
        applyFiltering();
        
        showToast("✅ Vinile aggiunto alla tua collezione!");
    } catch(e) {
        console.error(e);
        showToast("⚠️ Errore di sincronizzazione. Riprova.");
    }
    
    // Ripristiniamo la visualizzazione della ricerca senza chiudere la modale intera
    if (typeof window.hideDatabaseRecordDetails === 'function') {
        window.hideDatabaseRecordDetails();
    }
};

// ==========================================
// GESTIONE RICERCA DATABASE
// ==========================================

const clearDbSearchBtn = document.getElementById('clear-database-search-btn');
if (clearDbSearchBtn && databaseSearchInput) {
    clearDbSearchBtn.addEventListener('click', () => {
        databaseSearchInput.value = '';
        renderDatabaseResults([]);
        
        // Nascondiamo i dettagli se erano aperti
        const detailsContainer = document.getElementById('database-record-details');
        if (detailsContainer && detailsContainer.style.display === 'block') {
            if (typeof window.hideDatabaseRecordDetails === 'function') {
                window.hideDatabaseRecordDetails();
            }
        }
        databaseSearchInput.focus();
    });
}



function showCustomConfirm(options) {
  const overlay = document.createElement('div');
  overlay.className = 'app-modal active';
  overlay.style.cssText = 'z-index: 99999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;';
  
  const content = document.createElement('div');
  content.className = 'modal-content glass-card';
  content.style.cssText = 'max-width: 350px; text-align: center; padding: 25px 20px;';
  
  const title = document.createElement('h3');
  title.innerText = options.title;
  title.style.cssText = 'color: #ff9ffc; font-weight: 800; font-size: 1.2rem; margin-bottom: 10px;';
  
  const text = document.createElement('p');
  text.innerText = options.text;
  text.style.cssText = 'color: #cbd5e1; font-size: 0.95rem; margin-bottom: 25px;';
  
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
  
  content.appendChild(title);
  content.appendChild(text);
  
  options.buttons.forEach(btn => {
    const b = document.createElement('button');
    b.className = btn.primary ? 'btn-primary' : 'btn-secondary';
    b.innerHTML = btn.text;
    b.style.padding = '12px';
    b.style.fontWeight = '600';
    if (btn.danger) {
      b.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      b.style.color = '#ef4444';
      b.style.background = 'rgba(239, 68, 68, 0.1)';
    }
    b.onclick = () => {
      document.body.removeChild(overlay);
      if (btn.action) btn.action();
    };
    btnContainer.appendChild(b);
  });
  
  content.appendChild(btnContainer);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
}













const tabExploreAll = document.getElementById('tab-explore-all');
const tabExploreFriends = document.getElementById('tab-explore-friends');
if (tabExploreAll && tabExploreFriends) {
    tabExploreAll.addEventListener('click', () => {
        currentExploreTab = 'all';
        tabExploreAll.classList.replace('btn-secondary', 'btn-primary');
        tabExploreAll.classList.add('active');
        tabExploreFriends.classList.replace('btn-primary', 'btn-secondary');
        tabExploreFriends.classList.remove('active');
        renderCommunityLists();
    });
    tabExploreFriends.addEventListener('click', () => {
        currentExploreTab = 'friends';
        tabExploreFriends.classList.replace('btn-secondary', 'btn-primary');
        tabExploreFriends.classList.add('active');
        tabExploreAll.classList.replace('btn-primary', 'btn-secondary');
        tabExploreAll.classList.remove('active');
        renderCommunityLists();
    });
}
