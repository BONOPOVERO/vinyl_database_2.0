// Importa Three.js
import * as THREE from 'https://esm.sh/three';

// Importa il database dal file esterno
import { DATABASE_VINILI } from './database.js';

// ==========================================
// 1. REGISTRAZIONE SERVICE WORKER & PWA INSTALLATION
// ==========================================
let deferredPrompt = null;
const installPwaBtn = document.getElementById('install-pwa-btn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installPwaBtn) {
    installPwaBtn.classList.remove('hidden');
  }
});

if (installPwaBtn) {
  installPwaBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast("🎉 App Installata sulla schermata Home!");
    }
    deferredPrompt = null;
    installPwaBtn.classList.add('hidden');
  });
}

// ==========================================
// 2. SINTETIZZATORE AUDIO CREPITIO VINILE (WEB AUDIO API)
// ==========================================
let audioCtx = null;
let isAudioEnabled = false;

function playVinylCrackle(duration = 0.35) {
  if (!isAudioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const isPop = Math.random() > 0.982;
      output[i] = isPop ? (Math.random() * 2 - 1) * 0.5 : (Math.random() * 2 - 1) * 0.018;
    }
    
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1250;
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    whiteNoise.start();
  } catch (err) {
    console.log('Audio error:', err);
  }
}

// ==========================================
// 3. GENERATORE EFFETTO LIQUID GLASS
// ==========================================
function createGlassSurface(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.classList.add('glass-surface');

  const glassPanel = container.closest('.center-glass-panel') || container;

  glassPanel.addEventListener('pointermove', (e) => {
    const rect = glassPanel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    glassPanel.style.transform = `translate(-50%, -50%) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  glassPanel.addEventListener('pointerleave', () => {
    glassPanel.style.transform = `translate(-50%, -50%) perspective(1000px) rotateX(0deg) rotateY(0deg)`;
  });
}
createGlassSurface('my-liquid-glass');


// ==========================================
// 4. CONFIGURAZIONE SFONDO (LIGHTPILLAR OPTIMIZED)
// ==========================================
const PILLAR_CONFIG = {
  topColor: '#5227FF',
  bottomColor: '#FF9FFC',
  intensity: 1.0,
  rotationSpeed: 0.3,
  noiseIntensity: 0.4,
  pillarWidth: 3.0,
  pillarHeight: 0.4,
  pillarRotation: 0
};

const pillarContainer = document.getElementById('light-pillar-container');

if (pillarContainer) {
  const settings = { 
    iterations: 32, 
    waveIterations: 2, 
    pixelRatio: Math.min(window.devicePixelRatio, 1.5), 
    precision: 'mediump', 
    stepMultiplier: 1.4 
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
  const frameTime = 1000 / 60; 

  function animate(currentTime) {
    requestAnimationFrame(animate);
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
const toggleAudioBtn = document.getElementById("toggle-audio-btn");
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
  filterGenreSelect.innerHTML = '<option value="">Tutti i Generi</option>' + 
    genres.map(g => `<option value="${g}">${g}</option>`).join('');
}
populateGenreSelect();

// GESTIONE AUDIO TOGGLE
if (toggleAudioBtn) {
  toggleAudioBtn.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    toggleAudioBtn.classList.toggle('active', isAudioEnabled);
    showToast(isAudioEnabled ? "🔊 Suono Vinile Attivato" : "🔇 Audio Disattivato");
    if (isAudioEnabled) playVinylCrackle(0.5);
  });
}

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
      const matchArtist = (vinile.artista || '').toLowerCase().includes(q);
      const matchAlbum = (vinile.titolo_album || '').toLowerCase().includes(q);
      const matchGenre = (vinile.genere || '').toLowerCase().includes(q);
      const matchLabel = (vinile.etichetta || '').toLowerCase().includes(q);
      const matchCat = (vinile.catalog_number || '').toLowerCase().includes(q);
      if (!matchArtist && !matchAlbum && !matchGenre && !matchLabel && !matchCat) return false;
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

    // Calcola stima valore realistica per l'album
    const rawDiscScore = parseInt(vinile.stato_disco);
    const discScore = (!isNaN(rawDiscScore) && rawDiscScore > 0) ? rawDiscScore : 8;
    const estimatedValue = vinile.valore_stimato || Math.round((parseInt(vinile.anno_uscita_originale || 1980) < 1975 ? 30 : 20) * (discScore / 10));

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
          <span class="spec-label">Valore Stimato / Prezzo</span>
          <span class="spec-value" style="color: #ff9ffc; font-weight: 700;">€${estimatedValue}</span>
        </div>
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
          isAudioEnabled = true;
          if (toggleAudioBtn) toggleAudioBtn.classList.add('active');
          playVinylCrackle(0.6);
          showToast("▶️ Riproduzione Vinile in corso!");
        } else {
          showToast("⏸️ Vinile reinserito nella custodia");
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
    playVinylCrackle(0.35); 
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

    // Se l'utente ha inserito un valore personalizzato lo usa, altrimenti calcola la stima base (€20-€35)
    let itemVal = parseFloat(v.valore_stimato);
    if (isNaN(itemVal) || itemVal <= 0) {
      const base = (year < 1975) ? 30 : 22;
      itemVal = Math.round(base * (discScore / 10));
    }

    totalEstVal += itemVal;

    if (itemVal > rarestScore) {
      rarestScore = itemVal;
      rarestVinyl = v;
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
      <div class="kpi-banner-title">💶 STIMA VALORE COMMERCIALE COLLEZIONE</div>
      <div class="kpi-banner-amount">€${totalEstVal}</div>
      <div class="kpi-banner-sub">Basato sui prezzi inseriti e sulle valutazioni (Voto Medio: ${avgDiscRating}/10)</div>
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
  playVinylCrackle(0.2);
  stopBarcodeScanner();
  showToast(`🎉 Codice letto: ${code}`);
  if (discogsQuery) discogsQuery.value = code;
  document.getElementById('add-matrice').value = code;
  searchMusicBrainzOrDiscogs(code);
}

if (startBarcodeScanBtn) startBarcodeScanBtn.addEventListener('click', startBarcodeScanner);
if (closeBarcodeModalBtn) closeBarcodeModalBtn.addEventListener('click', stopBarcodeScanner);
if (cancelBarcodeScanBtn) cancelBarcodeScanBtn.addEventListener('click', stopBarcodeScanner);

// RICERCA MULTI-API (MUSICBRAINZ LIBERA + DISCOGS)
async function searchMusicBrainzOrDiscogs(query) {
  if (!query) return;
  discogsSearchBtn.textContent = 'Ricerca in corso...';
  discogsResults.classList.remove('hidden');
  discogsResults.innerHTML = '<div style="padding:10px; font-size:0.82rem; color:#ff9ffc;">🔍 Ricerca nel database di oltre 3 milioni di vinili...</div>';

  try {
    const cleanQuery = query.trim().replace(/[^0-9a-zA-Z]/g, '');
    const isNumericBarcode = /^\d+$/.test(cleanQuery);
    
    let mbUrl = isNumericBarcode
      ? `https://musicbrainz.org/ws/2/release/?query=barcode:${cleanQuery}&fmt=json`
      : `https://musicbrainz.org/ws/2/release/?query=release:${encodeURIComponent(query)}&fmt=json`;

    const mbRes = await fetch(mbUrl);
    const mbData = await mbRes.json();

    if (mbData.releases && mbData.releases.length > 0) {
      discogsSearchBtn.textContent = 'Cerca Dati';
      discogsResults.innerHTML = mbData.releases.slice(0, 5).map(rel => {
        const artistName = rel['artist-credit'] ? rel['artist-credit'].map(a => a.name).join(' & ') : 'Artista Sconosciuto';
        const year = rel.date ? rel.date.slice(0, 4) : 'N/A';
        const label = rel['label-info'] && rel['label-info'][0] && rel['label-info'][0].label ? rel['label-info'][0].label.name : 'Indipendente';
        const catNo = rel['label-info'] && rel['label-info'][0] ? rel['label-info'][0]['catalog-number'] || '' : '';

        const recordJson = encodeURIComponent(JSON.stringify({
          title: `${artistName} - ${rel.title}`,
          year: year,
          label: [label],
          catno: catNo,
          genre: ['Rock'],
          cover_image: null
        }));

        return `
          <div class="discogs-item" onclick="window.selectDiscogsResult('${recordJson}')">
            <div class="discogs-item-info">
              <div class="discogs-item-title">${artistName} — ${rel.title}</div>
              <div class="discogs-item-sub">📅 ${year} • 🏷️ ${label} ${catNo ? `(${catNo})` : ''}</div>
            </div>
          </div>
        `;
      }).join('');
      return;
    }

    discogsResults.innerHTML = '<div style="padding:10px; font-size:0.8rem; color:#cbd5e1;">Nessun vinile trovato per questo codice. Prova ad inserire il titolo dell\'album.</div>';
    discogsSearchBtn.textContent = 'Cerca Dati';
  } catch (err) {
    discogsSearchBtn.textContent = 'Cerca Dati';
    showToast("Errore durante la ricerca dei dati.");
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
      document.querySelector('.scan-placeholder').style.display = 'none';
    }
    discogsResults.classList.add('hidden');
    showToast("🎉 Dati del vinile autocompilati!");
  } catch (e) {
    console.log(e);
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

wheelContainer.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY > 0) selectIndex(selectedIndex + 1);
  else if (e.deltaY < 0) selectIndex(selectedIndex - 1);
}, { passive: false });

window.addEventListener('resize', () => updateWheel());

// INIZIALIZZA L'APPLICAZIONE
applyFiltering();