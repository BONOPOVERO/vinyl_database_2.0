// Importa Three.js
import * as THREE from 'https://esm.sh/three';

// Importa il database dal file esterno
import { DATABASE_VINILI } from './database.js';

// ==========================================
// 1. REGISTRAZIONE SERVICE WORKER & PWA INSTALLATION
// ==========================================
// ==========================================
// 1. REGISTRAZIONE SERVICE WORKER & PWA INSTALLATION
// ==========================================
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

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
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


// ==========================================
// 4. CONFIGURAZIONE SFONDO (LIGHTPILLAR HIGH PERFORMANCE)
// ==========================================
const PILLAR_CONFIG = {
  topColor: '#5227FF',
  bottomColor: '#FF9FFC',
  intensity: 1.0,
  rotationSpeed: 0.3,
  noiseIntensity: 0.3,
  pillarWidth: 3.0,
  pillarHeight: 0.4,
  pillarRotation: 0
};

const pillarContainer = document.getElementById('light-pillar-container');

if (pillarContainer) {
  const settings = { 
    iterations: 21, // Ottimizzato per prestazioni fluide a 60 FPS senza lag GPU
    waveIterations: 2, 
    pixelRatio: Math.min(window.devicePixelRatio, 1.0), 
    precision: 'mediump', 
    stepMultiplier: 1.6 
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
    precision: settings.precision,
    stencil: false,
    depth: false
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(settings.pixelRatio);
  pillarContainer.appendChild(renderer.domElement);

  const parseColor = hex => {
    const color = new THREE.Color(hex);
    return new THREE.Vector3(color.r, color.g, color.b);
  };

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    precision ${settings.precision} float;

    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uIntensity;
    uniform float uPillarWidth;
    uniform float uPillarHeight;
    uniform float uNoiseIntensity;
    uniform float uRotCos;
    uniform float uRotSin;
    uniform float uPillarRotCos;
    uniform float uPillarRotSin;
    uniform float uWaveSin;
    uniform float uWaveCos;
    varying vec2 vUv;

    const float STEP_MULT = ${settings.stepMultiplier.toFixed(1)};
    const int MAX_ITER = ${settings.iterations};
    const int WAVE_ITER = ${settings.waveIterations};

    void main() {
      vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y, uPillarRotSin * uv.x + uPillarRotCos * uv.y);

      vec3 ro = vec3(0.0, 0.0, -10.0);
      vec3 rd = normalize(vec3(uv, 1.0));

      float rotC = uRotCos;
      float rotS = uRotSin;

      vec3 col = vec3(0.0);
      float t = 0.1;
      
      for(int i = 0; i < MAX_ITER; i++) {
        vec3 p = ro + rd * t;
        p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

        vec3 q = p;
        q.y = p.y * uPillarHeight + uTime;
        
        float freq = 1.0;
        float amp = 1.0;
        for(int j = 0; j < WAVE_ITER; j++) {
          q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
          q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
          freq *= 2.0;
          amp *= 0.5;
        }
        
        float d = length(cos(q.xz)) - 0.2;
        float bound = length(p.xz) - uPillarWidth;
        float k = 4.0;
        float h = max(k - abs(d - bound), 0.0);
        d = max(d, bound) + h * h * 0.0625 / k;
        d = abs(d) * 0.15 + 0.01;

        float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
        col += mix(uBottomColor, uTopColor, grad) / d;

        t += d * STEP_MULT;
        if(t > 50.0) break;
      }

      float widthNorm = uPillarWidth / 3.0;
      vec3 exp2x = exp(2.0 * (col * 0.005 / widthNorm));
      col = (exp2x - 1.0) / (exp2x + 1.0);
      col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
      
      gl_FragColor = vec4(col * uIntensity, 1.0);
    }
  `;

  const pillarRotRad = (PILLAR_CONFIG.pillarRotation * Math.PI) / 180;
  
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTopColor: { value: parseColor(PILLAR_CONFIG.topColor) },
      uBottomColor: { value: parseColor(PILLAR_CONFIG.bottomColor) },
      uIntensity: { value: PILLAR_CONFIG.intensity },
      uPillarWidth: { value: PILLAR_CONFIG.pillarWidth },
      uPillarHeight: { value: PILLAR_CONFIG.pillarHeight },
      uNoiseIntensity: { value: PILLAR_CONFIG.noiseIntensity },
      uRotCos: { value: 1.0 },
      uRotSin: { value: 0.0 },
      uPillarRotCos: { value: Math.cos(pillarRotRad) },
      uPillarRotSin: { value: Math.sin(pillarRotRad) },
      uWaveSin: { value: Math.sin(0.4) },
      uWaveCos: { value: Math.cos(0.4) }
    },
    transparent: true,
    depthWrite: false,
    depthTest: false
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  let timeVal = 0;
  let lastTime = performance.now();
  const frameTime = 1000 / 30; // Capped at 30 FPS background render to save GPU & eliminate UI stutter

  function animate(currentTime) {
    requestAnimationFrame(animate);
    if (document.hidden) return; // Posa rendering se la scheda non è visibile
    const deltaTime = currentTime - lastTime;
    if (deltaTime >= frameTime) {
      timeVal += 0.016 * PILLAR_CONFIG.rotationSpeed;
      material.uniforms.uTime.value = timeVal;
      material.uniforms.uRotCos.value = Math.cos(timeVal * 0.3);
      material.uniforms.uRotSin.value = Math.sin(timeVal * 0.3);
      renderer.render(scene, camera);
      lastTime = currentTime - (deltaTime % frameTime);
    }
  }
  requestAnimationFrame(animate);
}

// ==========================================
// 5. GESTIONE DATABASE & STATO APPLICAZIONE
// ==========================================

const userAddedVinyls = JSON.parse(localStorage.getItem('user_added_vinili') || '[]');
let ALL_VINILI = [...userAddedVinyls, ...DATABASE_VINILI];

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

let activeCategory = 'ALL'; 
let searchQuery = '';
let filterYearFrom = null;
let filterYearTo = null;
let filterGenre = '';
let sortStrategy = 'DEFAULT';

let filteredVinili = [];
let selectedIndex = 0;
let wheelItems = [];

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

// NOTIFICHE TOAST FEEDBACK
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
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
      genres.map(g => `<option value="${g}">${g}</option>`).join('');
  }
}
populateGenreSelect();

// ALGORITMO DI FILTRAGGIO & ORDINAMENTO
function applyFiltering() {
  filteredVinili = ALL_VINILI.filter(vinile => {
    if (activeCategory !== 'ALL') {
      const statusStr = (vinile.stato_catalogo || '').toLowerCase();
      const targetCat = activeCategory.toLowerCase();
      if (targetCat === 'wishlist' && !statusStr.includes('wish')) return false;
      if (targetCat === 'personale' && !statusStr.includes('personale')) return false;
      if (targetCat === 'eredità' && (!statusStr.includes('eredit') && !statusStr.includes('eredita'))) return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const qDigits = q.replace(/[^0-9]/g, '');
      const matchArtist = (vinile.artista || '').toLowerCase().includes(q);
      const matchAlbum = (vinile.titolo_album || '').toLowerCase().includes(q);
      const matchGenre = (vinile.genere || '').toLowerCase().includes(q);
      const matchLabel = (vinile.etichetta || '').toLowerCase().includes(q);
      const matchCat = (vinile.catalog_number || '').toLowerCase().includes(q);
      const matchMatrice = (vinile.codice_matrice || '').toLowerCase().includes(q) ||
                           (qDigits && qDigits.length >= 3 && (vinile.codice_matrice || '').replace(/[^0-9]/g, '').includes(qDigits));
      const matchNotes = (vinile.note_stato || '').toLowerCase().includes(q);
      const matchId = String(vinile.id) === q;
      if (!matchArtist && !matchAlbum && !matchGenre && !matchLabel && !matchCat && !matchMatrice && !matchNotes && !matchId) return false;
    }

    const anno = parseInt(vinile.anno_uscita_originale || vinile.anno_stampa);
    if (filterYearFrom && !isNaN(filterYearFrom) && anno < filterYearFrom) return false;
    if (filterYearTo && !isNaN(filterYearTo) && anno > filterYearTo) return false;

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
  }

  selectedIndex = 0;
  renderWheel();
  updateWheel();
  updateCenterContent(selectedIndex);
}

// RENDER RUOTA TITOLI TRASPARENTE 3D
function renderWheel() {
  wheelContainer.innerHTML = '';
  
  if (filteredVinili.length === 0) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "wheel-item";
    emptyItem.textContent = "Nessun vinile trovato";
    wheelContainer.appendChild(emptyItem);
    wheelItems = [emptyItem];
    return;
  }

  filteredVinili.forEach((vinile, idx) => {
    const item = document.createElement("div");
    item.className = "wheel-item";
    item.textContent = vinile.titolo_album;
    item.addEventListener("click", () => {
      selectIndex(idx);
      closeMobileDrawer();
    });
    wheelContainer.appendChild(item);
  });

  wheelItems = Array.from(wheelContainer.querySelectorAll(".wheel-item"));
}

function updateWheel() {
  if (filteredVinili.length === 0) return;

  wheelItems.forEach((item, index) => {
    let distance = index - selectedIndex;
    const absDist = Math.abs(distance);
    const isSelected = distance === 0;

    const translateY = distance * 2.7; 
    const curveOffset = -Math.pow(absDist, 1.4) * 11; 
    const rotateX = distance * -5.5; 
    const opacity = Math.max(0.05, 1 - absDist * 0.22);
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
  if (filteredVinili.length === 0) {
    centerContent.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #cbd5e1;">
        <h2>🔍 Nessun Vinile Trovato</h2>
        <p style="margin-top: 10px; opacity: 0.7;">Prova a resettare i filtri o la ricerca.</p>
      </div>
    `;
    if (mobileCounter) mobileCounter.textContent = "0 / 0";
    return;
  }

  centerContent.classList.add("fade-out");
  
  setTimeout(() => {
    const vinile = filteredVinili[index];
    if (!vinile) return;

    const tracceHTML = vinile.tracce && vinile.tracce.length > 0 ? `
      <div class="section-title">🎵 Tracklist (${vinile.tracce.length} Tracce)</div>
      <div class="tracklist-container">
        ${vinile.tracce.map(t => `
          <div class="track-item">
            <span class="track-pos">${t.pos}</span>
            <span class="track-title">${t.title}</span>
            <span class="track-duration">${t.duration}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    const fotoHTML = vinile.foto_album && vinile.foto_album.length > 0 ? `
      <div class="section-title">📷 Foto Album (${vinile.foto_album.length})</div>
      <div class="gallery-container">
        ${vinile.foto_album.map(imgUrl => `
          <img class="gallery-thumb" src="${imgUrl}" alt="${vinile.titolo_album}" loading="lazy" onclick="window.openPhotoModal('${imgUrl}')">
        `).join('')}
      </div>
    ` : '';

    function generateSVGAlbumCover(artist, album) {
      const safeArtist = String(artist || 'Artista').replace(/["'<>&]/g, '');
      const safeAlbum = String(album || 'Album').replace(/["'<>&]/g, '');
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="100%" height="100%" fill="#161226"/><circle cx="150" cy="150" r="115" fill="%23090712" stroke="%23ff9ffc" stroke-width="2" opacity="0.5"/><circle cx="150" cy="150" r="80" fill="none" stroke="%235227ff" stroke-width="2" opacity="0.6"/><circle cx="150" cy="150" r="45" fill="%23ff9ffc" opacity="0.85"/><circle cx="150" cy="150" r="10" fill="%23111"/><text x="150" y="80" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="%23ffffff" text-anchor="middle">${safeArtist}</text><text x="150" y="235" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="%23ff9ffc" text-anchor="middle">${safeAlbum}</text></svg>`;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
    }

    const fallbackCover = generateSVGAlbumCover(vinile.artista, vinile.titolo_album);
    const coverSrc = (vinile.cover && vinile.cover.trim() !== '') ? vinile.cover : fallbackCover;

    // Calcola stima valore professionale per l'album
    const valData = calculateVinylValue(vinile);
    const estimatedValue = valData.total;

    centerContent.innerHTML = `
      <div class="vinyl-hero">
        <div id="cover-wrapper-btn" class="album-cover-wrapper" title="Clicca per estrarre il vinile!">
          <img class="album-cover-img" src="${coverSrc}" alt="${vinile.titolo_album}" width="170" height="170" loading="eager" onerror="this.onerror=null; this.src='${fallbackCover}';">
          <div class="vinyl-disc"></div>
        </div>
        <div class="play-hint-badge">🎵 Clicca la copertina per estrarre il vinile</div>
        <h1 class="album-title-main" style="margin-top: 6px;">${vinile.titolo_album}</h1>
        <div class="artist-name-sub">${vinile.artista}</div>
        
        <div class="genre-year-badge">
          <span class="badge badge-purple">${vinile.genere || 'Vinile'}</span>
          <span class="badge badge-pink">${vinile.anno_uscita_originale || vinile.anno_stampa || 'N/A'}</span>
          <span class="badge">${vinile.stato_catalogo || 'Personale'}</span>
        </div>
      </div>

      <div class="section-title">📊 Scheda Tecnica & Specifiche</div>
      <div class="specs-grid">
        <div class="spec-card">
          <span class="spec-label">Etichetta</span>
          <span class="spec-value">${vinile.etichetta || "-"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Origine Stampa</span>
          <span class="spec-value">${vinile.origine || "-"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Anno Stampa</span>
          <span class="spec-value">${vinile.anno_stampa || "-"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Cat. Number</span>
          <span class="spec-value">${vinile.catalog_number || "-"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Cod. Matrice</span>
          <span class="spec-value">${vinile.codice_matrice || "-"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Velocità & Grammatura</span>
          <span class="spec-value">${vinile.velocita || "33"} RPM | ${vinile.grammatura || "180g"}</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Stato Disco / Cover</span>
          <span class="spec-value">Disco: ${vinile.stato_disco || 8}/10 | Cover: ${vinile.stato_copertina || 8}/10</span>
        </div>
        <div class="spec-card">
          <span class="spec-label">Inserti</span>
          <span class="spec-value">${vinile.inserti || "Nessuno"}</span>
        </div>
        ${vinile.note_stato ? `
          <div class="spec-card" style="grid-column: 1 / -1;">
            <span class="spec-label">Note</span>
            <span class="spec-value" style="font-style: italic;">${vinile.note_stato}</span>
          </div>
        ` : ''}
      </div>

      <!-- SCHEDA VALORE COMMERCIALE (SUBITO PRIMA DELLA TRACKLIST CON TAG A SCOMPARTIMENTO) -->
      ${valData.factors.length > 0 ? `
        <div class="vinyl-value-box" style="margin-top: 1.2rem; background: linear-gradient(135deg, rgba(82, 39, 255, 0.28), rgba(255, 159, 252, 0.2)); border: 1px solid rgba(255, 159, 252, 0.45); padding: 12px 14px; border-radius: 16px;">
          <div id="toggle-factors-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="spec-label" style="color: #ff9ffc; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.5px;">💶 VALORE COMMERCIALE STIMATO</span>
              <span id="factors-arrow" style="font-size: 0.75rem; color: #ff9ffc; transition: transform 0.2s ease; display: inline-block;">▼</span>
            </div>
            <span style="font-size: 1.4rem; font-weight: 800; color: #ffffff; text-shadow: 0 2px 8px rgba(0,0,0,0.8);">€${estimatedValue}</span>
          </div>
          <div id="value-factors-list" style="margin-top: 10px; font-size: 0.74rem; color: #cbd5e1; display: flex; flex-wrap: wrap; gap: 5px;">
            ${valData.factors.map(f => `<span style="background: rgba(0, 0, 0, 0.45); padding: 4px 9px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.14); font-weight: 500;">✓ ${f}</span>`).join('')}
          </div>
        </div>
      ` : `
        <div class="spec-card" style="margin-top: 1.2rem; background: linear-gradient(135deg, rgba(82, 39, 255, 0.28), rgba(255, 159, 252, 0.2)); border: 1px solid rgba(255, 159, 252, 0.45); padding: 12px 14px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
          <span class="spec-label" style="color: #ff9ffc; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.5px;">💶 VALORE COMMERCIALE STIMATO</span>
          <span style="font-size: 1.4rem; font-weight: 800; color: #ffffff;">€${estimatedValue}</span>
        </div>
      `}

      ${tracceHTML}
      ${fotoHTML}
    `;
    
    // GESTIONE INTERATTIVA GIRADISCHI (CLIC SULLA COPERTINA ESCE IL VINILE)
    const coverWrapper = document.getElementById("cover-wrapper-btn");
    if (coverWrapper) {
      coverWrapper.addEventListener("click", () => {
        coverWrapper.classList.toggle("playing");
        const isPlaying = coverWrapper.classList.contains("playing");
        if (isPlaying) {
          showToast("▶️ Vinile estratto dalla custodia!");
        } else {
          showToast("⏸️ Vinile reinserito nella custodia");
        }
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

    centerContent.classList.remove("fade-out");
    centerContent.scrollTop = 0;
  }, 250); 

  if (mobileCounter) {
    mobileCounter.textContent = `${index + 1} / ${filteredVinili.length}`;
  }
}

function selectIndex(newIndex) {
  if (filteredVinili.length === 0) return;
  const targetIndex = Math.max(0, Math.min(newIndex, filteredVinili.length - 1));
  
  if (targetIndex !== selectedIndex) {
    selectedIndex = targetIndex;
    updateWheel();
    updateCenterContent(selectedIndex); 
  }
}

// GESTIONE CHIPS CATEGORIA DENTRO MODAL FILTRI
document.querySelectorAll('.modal-category-chips .chip-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.modal-category-chips .chip-btn').forEach(b => b.classList.remove('active'));
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
    filterModal.classList.remove('active');
    filterModal.setAttribute('aria-hidden', 'true');
  });
}
if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener('click', () => {
    filterYearFrom = parseInt(filterYearFromInput.value) || null;
    filterYearTo = parseInt(filterYearToInput.value) || null;
    filterGenre = filterGenreSelect.value;
    sortStrategy = sortSelect.value;
    filterModal.classList.remove('active');
    applyFiltering();
    showToast("Filtri ed Ordinamento applicati!");
  });
}
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener('click', () => {
    filterYearFromInput.value = '';
    filterYearToInput.value = '';
    filterGenreSelect.value = '';
    sortSelect.value = 'DEFAULT';
    filterYearFrom = null;
    filterYearTo = null;
    filterGenre = '';
    sortStrategy = 'DEFAULT';
    activeCategory = 'ALL';
    document.querySelectorAll('.modal-category-chips .chip-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-category') === 'ALL');
    });
    filterModal.classList.remove('active');
    applyFiltering();
    showToast("Filtri resettati");
  });
}

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
            localStorage.setItem('user_added_vinili', JSON.stringify(ALL_VINILI));
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

    // Calcola stima valore usando l'algoritmo multi-fattore (SOLO COLLEZIONE PERSONALE)
    const valData = calculateVinylValue(v);
    const itemVal = valData.total;
    const isPersonale = (v.stato_catalogo || '').toLowerCase().includes('personale');

    if (isPersonale) {
      totalEstVal += itemVal;
      if (itemVal > rarestScore) {
        rarestScore = itemVal;
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

  statsModalBody.innerHTML = `
    <!-- BANNER VALORE STIMATO DI MERCATO -->
    <div class="kpi-banner-gold">
      <div class="kpi-banner-title">💶 STIMA VALORE COLLEZIONE PERSONALE</div>
      <div class="kpi-banner-amount">€${totalEstVal}</div>
      <div class="kpi-banner-sub">Calcolato esclusivamente sui ${personale} dischi della collezione Personale (Voto Medio: ${avgDiscRating}/10)</div>
    </div>

    ${rarestVinyl ? `
      <div class="spec-card" style="margin-bottom: 1rem; background: rgba(82, 39, 255, 0.28); border: 1px solid rgba(255, 159, 252, 0.4);">
        <span class="spec-label" style="color: #ff9ffc; font-weight: 700;">💎 VINILE DI MAGGIOR VALORE IN COLLEZIONE</span>
        <span class="spec-value" style="font-size: 1rem; margin-top: 2px;">${rarestVinyl.artista} — ${rarestVinyl.titolo_album} (${rarestVinyl.anno_uscita_originale || rarestVinyl.anno_stampa})</span>
        <span style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">Valore registrato: €${rarestScore} | Condizioni: Disco ${rarestVinyl.stato_disco || 8}/10</span>
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

function onBarcodeFound(code) {
  stopBarcodeScanner();
  showToast(`🎉 Codice letto: ${code}`);
  if (discogsQuery) discogsQuery.value = code;
  const matriceInput = document.getElementById('add-matrice');
  if (matriceInput) matriceInput.value = code;
  searchMusicBrainzOrDiscogs(code);
}

if (startBarcodeScanBtn) startBarcodeScanBtn.addEventListener('click', startBarcodeScanner);
if (closeBarcodeModalBtn) closeBarcodeModalBtn.addEventListener('click', stopBarcodeScanner);
if (cancelBarcodeScanBtn) cancelBarcodeScanBtn.addEventListener('click', stopBarcodeScanner);

// RICERCA MULTI-API (LOCAL DATABASE + ITUNES API + MUSICBRAINZ)
async function searchMusicBrainzOrDiscogs(query) {
  if (!query) return;
  discogsSearchBtn.textContent = 'Ricerca in corso...';
  discogsResults.classList.remove('hidden');
  discogsResults.innerHTML = '<div style="padding:10px; font-size:0.82rem; color:#ff9ffc;">🔍 Ricerca in corso nel catalogo locale e nei database online...</div>';

  const cleanQuery = query.trim();
  const digitsOnly = cleanQuery.replace(/[^0-9]/g, '');
  const isNumericBarcode = digitsOnly.length >= 6;

  let resultsHTML = '';
  let foundAny = false;

  // 1. RICERCA NEL DATABASE LOCALE (ALL_VINILI)
  const localMatches = ALL_VINILI.filter(v => {
    const qLower = cleanQuery.toLowerCase();
    const dOnly = digitsOnly;
    
    const matchMatrice = (v.codice_matrice || '').toLowerCase().includes(qLower) || 
                         (dOnly && dOnly.length >= 3 && (v.codice_matrice || '').replace(/[^0-9]/g, '').includes(dOnly));
    const matchCatNum = (v.catalog_number || '').toLowerCase().includes(qLower) || 
                        (dOnly && dOnly.length >= 3 && (v.catalog_number || '').replace(/[^0-9]/g, '').includes(dOnly));
    const matchArtist = (v.artista || '').toLowerCase().includes(qLower);
    const matchAlbum = (v.titolo_album || '').toLowerCase().includes(qLower);
    const matchId = String(v.id) === cleanQuery;

    return matchMatrice || matchCatNum || matchArtist || matchAlbum || matchId;
  });

  if (localMatches.length > 0) {
    foundAny = true;
    resultsHTML += `
      <div style="font-size:0.75rem; font-weight:700; color:#818cf8; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.1);">
        📁 Trovato nella tua collezione (${localMatches.length})
      </div>
    `;
    localMatches.forEach(rel => {
      const recordJson = encodeURIComponent(JSON.stringify({
        title: `${rel.artista} - ${rel.titolo_album}`,
        year: rel.anno_uscita_originale || rel.anno_stampa || '',
        label: [rel.etichetta || ''],
        catno: rel.catalog_number || rel.codice_matrice || '',
        genre: [rel.genere || ''],
        cover_image: rel.cover || null,
        localId: rel.id
      }));

      resultsHTML += `
        <div class="discogs-item" style="border: 1px solid rgba(129, 140, 248, 0.4); background: rgba(129, 140, 248, 0.12);" onclick="window.selectDiscogsResult('${recordJson}')">
          <div class="discogs-item-info">
            <div class="discogs-item-title" style="color: #a5b4fc;">📁 ${rel.artista} — ${rel.titolo_album}</div>
            <div class="discogs-item-sub">📅 ${rel.anno_uscita_originale || 'N/A'} • Cat: ${rel.catalog_number || 'N/A'} • Matrice: ${rel.codice_matrice || 'N/A'}</div>
          </div>
        </div>
      `;
    });
  }

  // 2. RICERCA ONLINE (ITUNES API + MUSICBRAINZ)
  try {
    const onlineResults = [];

    // 2a. iTunes API Search (ottimo per barcode UPC/EAN e album)
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(isNumericBarcode ? digitsOnly : cleanQuery)}&entity=album&limit=5`;
      const itunesRes = await fetch(itunesUrl);
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          itunesData.results.forEach(album => {
            onlineResults.push({
              title: `${album.artistName} - ${album.collectionName}`,
              artist: album.artistName,
              album: album.collectionName,
              year: album.releaseDate ? album.releaseDate.slice(0, 4) : '',
              label: album.copyright || 'Apple Music / iTunes',
              catno: cleanQuery,
              genre: album.primaryGenreName || 'Rock',
              cover_image: album.artworkUrl100 ? album.artworkUrl100.replace('100x100bb', '600x600bb') : null
            });
          });
        }
      }
    } catch (e) {}

    // 2b. MusicBrainz API Search
    if (onlineResults.length < 5) {
      try {
        let mbQueries = [];
        if (isNumericBarcode) {
          mbQueries.push(`barcode:${digitsOnly}`);
          if (digitsOnly.length === 12) mbQueries.push(`barcode:0${digitsOnly}`); // UPC to EAN-13
          if (digitsOnly.length === 13 && digitsOnly.startsWith('0')) mbQueries.push(`barcode:${digitsOnly.slice(1)}`);
          mbQueries.push(`catno:${digitsOnly}`);
        } else {
          mbQueries.push(`release:${encodeURIComponent(cleanQuery)}`);
        }

        for (const mbQuery of mbQueries) {
          const mbUrl = `https://musicbrainz.org/ws/2/release/?query=${mbQuery}&fmt=json`;
          const mbRes = await fetch(mbUrl);
          if (mbRes.ok) {
            const mbData = await mbRes.json();
            if (mbData.releases && mbData.releases.length > 0) {
              mbData.releases.slice(0, 5).forEach(rel => {
                const artistName = rel['artist-credit'] ? rel['artist-credit'].map(a => a.name).join(' & ') : 'Artista Sconosciuto';
                const year = rel.date ? rel.date.slice(0, 4) : '';
                const labelInfo = rel['label-info'] && rel['label-info'][0];
                const label = labelInfo && labelInfo.label ? labelInfo.label.name : '';
                const catNo = labelInfo ? labelInfo['catalog-number'] || '' : '';

                if (!onlineResults.some(r => r.title.toLowerCase() === `${artistName} - ${rel.title}`.toLowerCase())) {
                  onlineResults.push({
                    title: `${artistName} - ${rel.title}`,
                    artist: artistName,
                    album: rel.title,
                    year: year,
                    label: label,
                    catno: catNo || cleanQuery,
                    genre: 'Rock',
                    cover_image: null
                  });
                }
              });
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (onlineResults.length > 0) {
      foundAny = true;
      resultsHTML += `
        <div style="font-size:0.75rem; font-weight:700; color:#ff9ffc; padding:4px 6px; margin-top:6px; border-bottom:1px solid rgba(255,255,255,0.1);">
          🌐 Risultati Database Online (${onlineResults.length})
        </div>
      `;
      onlineResults.forEach(rel => {
        const recordJson = encodeURIComponent(JSON.stringify({
          title: rel.title,
          year: rel.year,
          label: [rel.label],
          catno: rel.catno,
          genre: [rel.genre],
          cover_image: rel.cover_image
        }));

        resultsHTML += `
          <div class="discogs-item" onclick="window.selectDiscogsResult('${recordJson}')">
            ${rel.cover_image ? `<img src="${rel.cover_image}" alt="Cover" width="40" height="40" style="border-radius:6px; object-fit:cover;">` : ''}
            <div class="discogs-item-info">
              <div class="discogs-item-title">${rel.title}</div>
              <div class="discogs-item-sub">📅 ${rel.year || 'N/A'} ${rel.label ? `• 🏷️ ${rel.label}` : ''} ${rel.catno ? `(${rel.catno})` : ''}</div>
            </div>
          </div>
        `;
      });
    }

  } catch (err) {
    console.error(err);
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
    discogsResults.innerHTML = resultsHTML;
  }
}

if (discogsSearchBtn && discogsQuery) {
  discogsSearchBtn.addEventListener('click', () => {
    searchMusicBrainzOrDiscogs(discogsQuery.value.trim());
  });
}

window.selectDiscogsResult = function(encodedJson) {
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
      addVinylModal.classList.remove('active');
      discogsResults.classList.add('hidden');
      showToast("✨ Vinile selezionato nella tua collezione!");
      return;
    }

    const parts = r.title.split(' - ');
    if (parts.length >= 2) {
      document.getElementById('add-artista').value = parts[0].trim();
      document.getElementById('add-titolo').value = parts.slice(1).join(' - ').trim();
    } else {
      document.getElementById('add-titolo').value = r.title;
    }
    if (r.year) document.getElementById('add-anno-uscita').value = r.year;
    if (r.genre && r.genre[0]) document.getElementById('add-genere').value = r.genre[0];
    if (r.label && r.label[0]) document.getElementById('add-etichetta').value = r.label[0];
    if (r.catno) document.getElementById('add-cat-num').value = r.catno;
    if (r.cover_image) {
      currentCapturedCoverBase64 = r.cover_image;
      photoPreviewImg.src = r.cover_image;
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
  openAddBtn.addEventListener('click', () => {
    addVinylModal.classList.add('active');
    addVinylModal.setAttribute('aria-hidden', 'false');
  });
}
if (closeAddModalBtn) {
  closeAddModalBtn.addEventListener('click', () => {
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
  addVinylForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newVinyl = {
      id: Date.now(),
      titolo_album: document.getElementById('add-titolo').value,
      artista: document.getElementById('add-artista').value,
      genere: document.getElementById('add-genere').value || 'Rock',
      stato_catalogo: document.getElementById('add-stato-catalogo').value,
      valore_stimato: parseFloat(document.getElementById('add-valore-stimato').value) || 25,
      anno_uscita_originale: parseInt(document.getElementById('add-anno-uscita').value) || new Date().getFullYear(),
      anno_stampa: parseInt(document.getElementById('add-anno-stampa').value) || new Date().getFullYear(),
      anno_uscita_stampa: parseInt(document.getElementById('add-anno-stampa').value) || new Date().getFullYear(),
      origine: 'IT',
      etichetta: document.getElementById('add-etichetta').value || 'Indipendente',
      catalog_number: document.getElementById('add-cat-num').value || 'N/A',
      codice_matrice: document.getElementById('add-matrice').value || 'N/A',
      velocita: document.getElementById('add-velocita').value || '33',
      colore: 'Nero',
      grammatura: document.getElementById('add-grammatura').value || '180g',
      inserti: 'Nessuno',
      stato_disco: document.getElementById('add-stato-disco').value || '8',
      stato_copertina: document.getElementById('add-stato-copertina').value || '8',
      note_stato: document.getElementById('add-note').value || '',
      cover: currentCapturedCoverBase64 || '',
      tracce: [],
      foto_album: currentCapturedCoverBase64 ? [currentCapturedCoverBase64] : []
    };

    ALL_VINILI.unshift(newVinyl);
    userAddedVinyls.unshift(newVinyl);
    localStorage.setItem('user_added_vinili', JSON.stringify(userAddedVinyls));

    addVinylForm.reset();
    currentCapturedCoverBase64 = null;
    photoPreviewImg.classList.add('hidden');
    document.querySelector('.scan-placeholder').style.display = 'flex';

    addVinylModal.classList.remove('active');
    populateGenreSelect();
    applyFiltering();
    selectIndex(0);
    showToast("🎉 Nuovo Vinile Aggiunto con successo!");
  });
}

// HEADER MOBILE NAV & DRAWER TOGGLE
if (prevBtn) prevBtn.addEventListener("click", () => selectIndex(selectedIndex - 1));
if (nextBtn) nextBtn.addEventListener("click", () => selectIndex(selectedIndex + 1));

function toggleMobileDrawer() {
  wheelContainer.classList.toggle("open");
  mobileOverlay.classList.toggle("active");
}
function closeMobileDrawer() {
  wheelContainer.classList.remove("open");
  mobileOverlay.classList.remove("active");
}

if (toggleListBtn) toggleListBtn.addEventListener("click", toggleMobileDrawer);
if (mobileOverlay) mobileOverlay.addEventListener("click", closeMobileDrawer);

let isWheelThrottled = false;
wheelContainer.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (isWheelThrottled) return;
  isWheelThrottled = true;
  if (e.deltaY > 0) selectIndex(selectedIndex + 1);
  else if (e.deltaY < 0) selectIndex(selectedIndex - 1);
  setTimeout(() => { isWheelThrottled = false; }, 80);
}, { passive: false });

window.addEventListener('resize', () => updateWheel());

// INIZIALIZZA L'APPLICAZIONE
applyFiltering();