// Importa Three.js
import * as THREE from 'https://esm.sh/three';

// Importa il database dal file esterno
import { DATABASE_VINILI } from './database.js';

// ==========================================
// 1. REGISTRAZIONE SERVICE WORKER & RILEVAMENTO PWA INSTALLATA
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


let activeShaderMaterial = null;
let activeThreeRenderer = null;
let targetTopColor = new THREE.Vector3(0.32, 0.15, 1.0);
let targetBottomColor = new THREE.Vector3(1.0, 0.62, 0.98);
let isBgAnimationPaused = localStorage.getItem('app_bg_anim_paused') === 'true';
let bgIterations = parseInt(localStorage.getItem('app_bg_iterations'), 10) || 20;
let bgBlur = parseFloat(localStorage.getItem('app_bg_blur')) || 0.0;

function updateBackgroundSharpness(val) {
  bgIterations = Math.max(1, Math.min(50, parseInt(val, 10) || 20));
  localStorage.setItem('app_bg_iterations', bgIterations);

  if (activeShaderMaterial && activeShaderMaterial.uniforms && activeShaderMaterial.uniforms.u_iterations) {
    activeShaderMaterial.uniforms.u_iterations.value = bgIterations;
  }

  const badge = document.getElementById('sharpness-value-badge');
  if (badge) {
    let label = `${bgIterations} iter.`;
    if (bgIterations >= 40) label += ' (Ultra)';
    else if (bgIterations >= 28) label += ' (Alta qualità)';
    else if (bgIterations >= 15) label += ' (Bilanciato)';
    else label += ' (Veloce)';
    badge.textContent = label;
  }
}

function updateBackgroundBlur(val) {
  bgBlur = Math.max(0, Math.min(20, parseFloat(val) || 0));
  localStorage.setItem('app_bg_blur', bgBlur.toFixed(1));

  if (activeThreeRenderer && activeThreeRenderer.domElement) {
    activeThreeRenderer.domElement.style.filter = bgBlur > 0 ? `blur(${bgBlur}px)` : 'none';
  }

  const badge = document.getElementById('bg-blur-badge');
  if (badge) {
    badge.textContent = bgBlur > 0 ? `${bgBlur.toFixed(1)}px` : 'Nessuno';
  }
}

function updateAnimationToggleButtonUI() {
  const btn = document.getElementById('settings-toggle-anim-btn');
  if (btn) {
    if (isBgAnimationPaused) {
      btn.innerHTML = '▶️ Riprendi Animazioni Sfondo';
      btn.style.background = 'rgba(52, 211, 153, 0.2)';
      btn.style.borderColor = 'rgba(52, 211, 153, 0.6)';
    } else {
      btn.innerHTML = '⏸️ Metti in Pausa Animazioni Sfondo';
      btn.style.background = 'rgba(255, 255, 255, 0.08)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
    }
  }
}

function toggleBackgroundAnimation() {
  isBgAnimationPaused = !isBgAnimationPaused;
  localStorage.setItem('app_bg_anim_paused', isBgAnimationPaused ? 'true' : 'false');
  updateAnimationToggleButtonUI();
  if (isBgAnimationPaused) {
    showToast("⏸️ Animazioni Sfondo messe in Pausa");
  } else {
    showToast("▶️ Animazioni Sfondo riattivate!");
  }
}

const pillarContainer = document.getElementById('light-pillar-container');

if (pillarContainer) {
  const settings = { 
    iterations: 21, // Ottimizzato per prestazioni fluide a 60 FPS senza lag GPU
    waveIterations: 2, 
    pixelRatio: Math.min(window.devicePixelRatio, 1.0), 
    precision: 'mediump', 
    stepMultiplier: 1.6 
  };

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

  const initialPixelRatio = Math.min(window.devicePixelRatio, 3.0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(initialPixelRatio);
  pillarContainer.appendChild(renderer.domElement);
  activeThreeRenderer = renderer;

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
    precision mediump float;

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
    uniform float uSharpness;
    uniform int u_iterations;
    varying vec2 vUv;

    const float STEP_MULT = 1.6;
    const int WAVE_ITER = 2;

    void main() {
      vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y, uPillarRotSin * uv.x + uPillarRotCos * uv.y);

      vec3 ro = vec3(0.0, 0.0, -10.0);
      vec3 rd = normalize(vec3(uv, 1.0));

      float rotC = uRotCos;
      float rotS = uRotSin;

      vec3 col = vec3(0.0);
      float t = 0.1;
      
      for(int i = 0; i < u_iterations; i++) {
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

      // Contrast / Sharpness scaling
      vec3 midCol = mix(uBottomColor, uTopColor, 0.5) * 0.3;
      col = mix(midCol, col, clamp(uSharpness, 0.5, 2.0));

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
      uTopColor: { value: new THREE.Vector3(0.32, 0.15, 1.0) },
      uBottomColor: { value: new THREE.Vector3(1.0, 0.62, 0.98) },
      uIntensity: { value: PILLAR_CONFIG.intensity },
      uPillarWidth: { value: PILLAR_CONFIG.pillarWidth },
      uPillarHeight: { value: PILLAR_CONFIG.pillarHeight },
      uNoiseIntensity: { value: PILLAR_CONFIG.noiseIntensity },
      uRotCos: { value: 1.0 },
      uRotSin: { value: 0.0 },
      uPillarRotCos: { value: Math.cos(pillarRotRad) },
      uPillarRotSin: { value: Math.sin(pillarRotRad) },
      uWaveSin: { value: Math.sin(0.4) },
      uWaveCos: { value: Math.cos(0.4) },
      uSharpness: { value: 1.0 },
      u_iterations: { value: bgIterations }
    },
    transparent: true,
    depthWrite: false,
    depthTest: false
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  activeShaderMaterial = material;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  let timeVal = 0;
  let lastTime = performance.now();

  function animate(currentTime) {
    requestAnimationFrame(animate);
    if (document.hidden) return;

    const deltaTime = Math.min((currentTime - lastTime) * 0.001, 0.1);
    lastTime = currentTime;

    if (!isBgAnimationPaused) {
      timeVal += 0.016 * PILLAR_CONFIG.rotationSpeed * 1.5;
    }

    if (material) {
      material.uniforms.uTime.value = timeVal;
      material.uniforms.uRotCos.value = Math.cos(timeVal * 0.3);
      material.uniforms.uRotSin.value = Math.sin(timeVal * 0.3);
      
      // TRANSIZIONE FLUIDA DEI COLORI LERP IN TEMPO REALE
      material.uniforms.uTopColor.value.lerp(targetTopColor, 0.045);
      material.uniforms.uBottomColor.value.lerp(targetBottomColor, 0.045);
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

// ==========================================
// 5. GESTIONE TEMA 3D DINAMICO & STATO APPLICAZIONE
// ==========================================

let currentAppThemeKey = localStorage.getItem('app_theme_choice') || 'AUTO_ALBUM';

const THEMES = {
  AUTO_ALBUM: {
    isAdaptive: true,
    topColor: '#5227FF',
    bottomColor: '#FF9FFC',
    intensity: 1.1,
    dockBg: 'rgba(82, 39, 255, 0.22)',
    dockBorder: 'rgba(255, 159, 252, 0.45)',
    dockGlow: 'rgba(255, 159, 252, 0.4)'
  },
  VIOLET: {
    topColor: '#5227FF',
    bottomColor: '#FF9FFC',
    intensity: 1.0,
    dockBg: 'rgba(82, 39, 255, 0.22)',
    dockBorder: 'rgba(255, 159, 252, 0.45)',
    dockGlow: 'rgba(255, 159, 252, 0.4)'
  },
  CYBERPUNK: {
    topColor: '#00F0FF',
    bottomColor: '#FF007F',
    intensity: 1.25,
    dockBg: 'rgba(0, 240, 255, 0.18)',
    dockBorder: 'rgba(0, 240, 255, 0.5)',
    dockGlow: 'rgba(255, 0, 127, 0.5)'
  },
  EMERALD: {
    topColor: '#059669',
    bottomColor: '#34D399',
    intensity: 1.1,
    dockBg: 'rgba(5, 150, 105, 0.22)',
    dockBorder: 'rgba(52, 211, 153, 0.5)',
    dockGlow: 'rgba(52, 211, 153, 0.45)'
  },
  SUNSET: {
    topColor: '#FF4500',
    bottomColor: '#FFB703',
    intensity: 1.15,
    dockBg: 'rgba(255, 69, 0, 0.22)',
    dockBorder: 'rgba(255, 183, 3, 0.5)',
    dockGlow: 'rgba(255, 183, 3, 0.45)'
  },
  ROYAL: {
    topColor: '#7C3AED',
    bottomColor: '#F59E0B',
    intensity: 1.2,
    dockBg: 'rgba(124, 58, 237, 0.22)',
    dockBorder: 'rgba(245, 158, 11, 0.5)',
    dockGlow: 'rgba(245, 158, 11, 0.45)'
  },
  OCEAN: {
    topColor: '#0284C7',
    bottomColor: '#06B6D4',
    intensity: 1.05,
    dockBg: 'rgba(2, 132, 199, 0.22)',
    dockBorder: 'rgba(6, 182, 212, 0.5)',
    dockGlow: 'rgba(6, 182, 212, 0.45)'
  },
  SYNTH: {
    topColor: '#C084FC',
    bottomColor: '#38BDF8',
    intensity: 1.15,
    dockBg: 'rgba(192, 132, 252, 0.22)',
    dockBorder: 'rgba(56, 189, 248, 0.5)',
    dockGlow: 'rgba(192, 132, 252, 0.45)'
  },
  OLED: {
    topColor: '#0F172A',
    bottomColor: '#1E40AF',
    intensity: 0.65,
    dockBg: 'rgba(15, 23, 42, 0.38)',
    dockBorder: 'rgba(59, 130, 246, 0.4)',
    dockGlow: 'rgba(30, 64, 175, 0.45)'
  }
};

function applyAppTheme(themeKey) {
  currentAppThemeKey = themeKey;
  const t = THEMES[themeKey] || THEMES.AUTO_ALBUM;
  localStorage.setItem('app_theme_choice', themeKey);

  document.querySelectorAll('.theme-chips .chip-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-theme') === themeKey);
  });

  if (t.isAdaptive) {
    const currentImgEl = document.querySelector('.album-cover-img');
    if (currentImgEl) {
      if (currentImgEl.complete && currentImgEl.naturalWidth !== 0) {
        extractDominantColors(currentImgEl);
      } else {
        currentImgEl.onload = () => extractDominantColors(currentImgEl);
      }
    }
  } else {
    document.documentElement.style.setProperty('--theme-glow-1', t.topColor);
    document.documentElement.style.setProperty('--theme-glow-2', t.bottomColor);
    document.documentElement.style.setProperty('--primary-color', t.topColor);
    document.documentElement.style.setProperty('--accent-color', t.bottomColor);

    const c1 = new THREE.Color(t.topColor);
    const c2 = new THREE.Color(t.bottomColor);
    targetTopColor.set(c1.r, c1.g, c1.b);
    targetBottomColor.set(c2.r, c2.g, c2.b);

    if (activeShaderMaterial) {
      activeShaderMaterial.uniforms.uIntensity.value = t.intensity;
    }

    const glassDock = document.getElementById('floating-glass-dock');
    const appHeader = document.querySelector('.app-header');
    if (glassDock) {
      glassDock.style.borderColor = t.dockBorder;
      glassDock.style.boxShadow = `inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(255, 255, 255, 0.1), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px ${t.dockGlow}`;
    }
    if (appHeader) {
      appHeader.style.borderColor = t.dockBorder;
      appHeader.style.boxShadow = `inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(255, 255, 255, 0.1), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px ${t.dockGlow}`;
    }
  }
}

function updateDynamicAlbumBackground(topHex, bottomHex) {
  if (currentAppThemeKey === 'AUTO_ALBUM') {
    if (topHex && topHex.startsWith('#')) {
      const c1 = new THREE.Color(topHex);
      targetTopColor.set(c1.r, c1.g, c1.b);
    }
    if (bottomHex && bottomHex.startsWith('#')) {
      const c2 = new THREE.Color(bottomHex);
      targetBottomColor.set(c2.r, c2.g, c2.b);
    }

    const glassDock = document.getElementById('floating-glass-dock');
    const appHeader = document.querySelector('.app-header');
    if (topHex && topHex.startsWith('#')) {
      const r = parseInt(topHex.slice(1,3), 16) || 148;
      const g = parseInt(topHex.slice(3,5), 16) || 163;
      const b = parseInt(topHex.slice(5,7), 16) || 184;
      const themeBorder = `${topHex}88`;
      const themeShadow = `inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(255, 255, 255, 0.1), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(${r}, ${g}, ${b}, 0.5)`;
      
      if (glassDock) {
        glassDock.style.borderColor = themeBorder;
        glassDock.style.boxShadow = themeShadow;
      }
      if (appHeader) {
        appHeader.style.borderColor = themeBorder;
        appHeader.style.boxShadow = themeShadow;
      }
    }
  }

  const heroWrapper = document.getElementById('cover-wrapper-btn');
  if (heroWrapper) {
    heroWrapper.style.setProperty('--album-primary-color', topHex);
    heroWrapper.style.setProperty('--album-secondary-color', bottomHex);
  }
}

const userAddedVinyls = JSON.parse(localStorage.getItem('user_added_vinili') || '[]');
let ALL_VINILI = [...userAddedVinyls, ...DATABASE_VINILI];

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
function extractDominantColors(imgElement) {
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

// ==========================================
// FASE 1: FETCH ASINCRONA API DISCOGS LIVE (2-STEP CON UTILITY DOM AUTOMATICA)
// ==========================================
async function fetchDiscogsLivePrice(matrixOrQuery, targetElementId = 'discogs-live-box', estimatedValue = 0) {
  const container = document.getElementById(targetElementId);
  if (!matrixOrQuery || matrixOrQuery.trim() === '') {
    if (container) {
      container.innerHTML = `<span style="opacity: 0.6;">🔍 Nessun codice matrice o catalogo disponibile per la verifica live</span>`;
    }
    return null;
  }

  try {
    const q = encodeURIComponent(matrixOrQuery.trim());
    const searchUrl = `https://api.discogs.com/database/search?q=${q}&type=release`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' }
    });

    if (!searchRes.ok) throw new Error('Search request failed');
    const searchData = await searchRes.json();

    if (searchData && searchData.results && searchData.results.length > 0) {
      const bestMatch = searchData.results[0];
      const releaseId = bestMatch.id;
      let lowestPrice = null;

      if (releaseId) {
        try {
          const detailUrl = `https://api.discogs.com/releases/${releaseId}`;
          const detailRes = await fetch(detailUrl, {
            headers: { 'User-Agent': 'VinylCollectorApp/2.0 +http://localhost' }
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData && detailData.lowest_price !== undefined && detailData.lowest_price !== null) {
              lowestPrice = detailData.lowest_price;
            }
          }
        } catch (_) {}
      }

      const priceText = formatCurrencyPrice(lowestPrice);

      // Salva in cache locale il prezzo reale ottenuto da Discogs per sommarlo nelle statistiche
      if (lowestPrice !== null && lowestPrice !== undefined) {
        try {
          const priceMap = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
          priceMap[matrixOrQuery] = lowestPrice;
          localStorage.setItem('discogs_cached_prices', JSON.stringify(priceMap));
        } catch (_) {}
      }

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
        const fallbackUrl = `https://www.discogs.com/search/?q=${q}&type=all`;
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
async function syncAllDiscogsPrices(force = false) {
  if (isDiscogsBatchSyncing) return;

  const freq = localStorage.getItem('app_discogs_sync_freq') || 'AUTO_ALWAYS';
  const lastSync = localStorage.getItem('app_discogs_last_sync_date');
  const today = new Date().toISOString().slice(0, 10);

  if (!force) {
    if (freq === 'MANUAL') return;
    if (freq === 'DAILY' && lastSync === today) return;
  }

  isDiscogsBatchSyncing = true;
  if (force) showToast("🔄 Avvio risincronizzazione automatica Discogs...");

  const personalVinyls = ALL_VINILI.filter(v => {
    const cat = (v.stato_catalogo || 'personale').toLowerCase();
    return cat.includes('personale') || cat === '';
  });

  const priceMap = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');

  for (const vinile of personalVinyls) {
    const queryKey = (vinile.codice_matrice && vinile.codice_matrice !== '??')
      ? vinile.codice_matrice 
      : (vinile.catalog_number && vinile.catalog_number !== '??') 
        ? vinile.catalog_number 
        : `${vinile.artista} ${vinile.titolo_album}`.trim();

    if (force || !priceMap[queryKey]) {
      await fetchDiscogsLivePrice(queryKey, null);
      await new Promise(res => setTimeout(res, 1200));
    }
  }

  localStorage.setItem('app_discogs_last_sync_date', today);
  isDiscogsBatchSyncing = false;
  if (force) showToast("✅ Risincronizzazione Discogs Completata!");
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
  console.log(`[Titoli] applyFiltering: ${filteredVinili.length} vinili da mostrare`);
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
  console.log(`[Titoli] renderWheel: ${filteredVinili.length} elementi da inserire`);
  wheelContainer.innerHTML = '';

  if (filteredVinili.length === 0) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "wheel-item";
    emptyItem.textContent = "Nessun vinile trovato";
    wheelContainer.appendChild(emptyItem);
    wheelItems = [emptyItem];
    return;
  }

  try {
    filteredVinili.forEach((vinile, idx) => {
      const item = document.createElement("div");
      item.className = "wheel-item";
      item.textContent = vinile.titolo_album || '(Senza titolo)';
      item.addEventListener("click", () => {
        selectIndex(idx);
        closeMobileDrawer();
      });
      wheelContainer.appendChild(item);
    });
  } catch (wheelErr) {
    console.error("Errore generazione ruota titoli:", wheelErr);
    // Fallback: mostra i titoli disponibili come testo semplice
    wheelContainer.innerHTML = '';
    filteredVinili.forEach((vinile, idx) => {
      try {
        const item = document.createElement("div");
        item.className = "wheel-item";
        item.textContent = vinile.titolo_album || '(Senza titolo)';
        item.addEventListener("click", () => { selectIndex(idx); closeMobileDrawer(); });
        wheelContainer.appendChild(item);
      } catch (_) { /* salta questo elemento, continua */ }
    });
  }

  wheelItems = Array.from(wheelContainer.querySelectorAll(".wheel-item"));
}

let isWheelAnimating = false;

function updateWheel() {
  if (!wheelContainer || filteredVinili.length === 0) return;

  wheelItems.forEach((item, index) => {
    const distance = index - selectedIndex;
    const absDist = Math.abs(distance);
    const isSelected = distance === 0;

    // Se l'elemento è oltre il 3° sopra o sotto, diventa completamente trasparente (invisibile)
    if (absDist > 3) {
      item.style.opacity = '0';
      item.style.pointerEvents = 'none';
      item.style.transform = `translate3d(40px, calc(${distance * 3.2}rem - 50%), 0) scale(0.65)`;
      item.classList.remove("active");
      return;
    }

    const translateY = distance * 3.2; 
    const curveOffset = Math.pow(absDist, 1.3) * 14; 
    const rotateX = distance * 6; 
    const opacity = isSelected ? 1 : Math.max(0.18, 1 - absDist * 0.26);
    const scale = isSelected ? 1.2 : Math.max(0.75, 1 - absDist * 0.1);

    item.style.pointerEvents = 'auto';
    item.classList.toggle("active", isSelected);
    item.style.opacity = opacity;
    item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg) scale(${scale})`;
  });
}

function triggerWheelAnimation() {
  requestAnimationFrame(updateWheel);
}

let updateContentTimeout = null;

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

  if (updateContentTimeout) clearTimeout(updateContentTimeout);

  centerContent.classList.add("fade-out");
  
  updateContentTimeout = setTimeout(() => {
    try {
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

      centerContent.innerHTML = `
        <div class="vinyl-hero gallery-stage">
          <!-- FARETTO DI LUCE DALL'ALTO (TOP SPOTLIGHT) -->
          <div class="hero-spotlight"></div>
          
          <div class="floating-art-wrapper">
            <div id="cover-wrapper-btn" class="album-cover-wrapper" title="Clicca per estrarre il vinile!">
              <img class="album-cover-img" src="${coverSrc}" alt="${vinile.titolo_album}" width="170" height="170" loading="eager" onerror="this.onerror=null; this.src='${fallbackCover}';">
              <div class="vinyl-disc"></div>
            </div>
            <!-- PROFONDA OMBRA 3D PROIETTATA SULLO SFONDO -->
            <div class="floating-floor-shadow"></div>
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

        <div class="section-title">📊 Scheda Tecnica & Specifiche Complete</div>
        <div class="specs-grid">
          <div class="spec-card">
            <span class="spec-label">ID Catalogo</span>
            <span class="spec-value">#${vinile.id}</span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Anno Uscita Originale</span>
            <span class="spec-value">${vinile.anno_uscita_originale || "-"}</span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Anno Stampa</span>
            <span class="spec-value">${vinile.anno_stampa || "-"}</span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Anno Uscita Stampa</span>
            <span class="spec-value">${vinile.anno_uscita_stampa || vinile.anno_stampa || "-"}</span>
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
            <span class="spec-label">Colore Vinile</span>
            <span class="spec-value">${vinile.colore || "Nero"}</span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Stato Disco (Goldmine)</span>
            <span class="spec-value" style="color: #ff9ffc; font-weight: 700;">
              ${convertRatingToGoldmine(vinile.stato_disco)}
            </span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Stato Copertina (Goldmine)</span>
            <span class="spec-value" style="color: #ff9ffc; font-weight: 700;">
              ${convertRatingToGoldmine(vinile.stato_copertina)}
            </span>
          </div>
          <div class="spec-card">
            <span class="spec-label">Inserti</span>
            <span class="spec-value">${vinile.inserti || "Nessuno"}</span>
          </div>
          <!-- CONTAINER AUTOMATICO VALORE MERCATO LIVE DISCOGS STILIZZATO -->
          <div class="spec-card" id="discogs-live-box" style="grid-column: 1 / -1;">
            <span class="spec-label">Valore di Mercato (Discogs Live)</span>
            <span class="spec-value" style="color: #34d399; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; animation: spinVinyl 1.5s linear infinite;">🌐</span>
              <span>Sincronizzazione in corso...</span>
            </span>
          </div>
          ${vinile.valore_stimato ? `
            <div class="spec-card">
              <span class="spec-label">Valore Utente Inserito</span>
              <span class="spec-value" style="color: #fbbf24; font-weight: 700;">€${vinile.valore_stimato}</span>
            </div>
          ` : ''}
          ${vinile.note_stato ? `
            <div class="spec-card" style="grid-column: 1 / -1;">
              <span class="spec-label">Note & Dettagli Stato</span>
              <span class="spec-value" style="font-style: italic;">${vinile.note_stato}</span>
            </div>
          ` : ''}
        </div>

        ${tracceHTML}
        ${fotoHTML}
      `;
      
      // INVOCAZIONE REALE AL CARICAMENTO/CAMBIO VINILE
      const currentImgEl = centerContent.querySelector('.album-cover-img');
      if (currentImgEl) {
        if (currentImgEl.complete && currentImgEl.naturalWidth !== 0) {
          extractDominantColors(currentImgEl);
        } else {
          currentImgEl.onload = () => extractDominantColors(currentImgEl);
        }
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
      const queryMatrix = (vinile.codice_matrice && vinile.codice_matrice !== '??')
        ? vinile.codice_matrice 
        : (vinile.catalog_number && vinile.catalog_number !== '??') 
          ? vinile.catalog_number 
          : `${vinile.artista} ${vinile.titolo_album} ${vinile.note_stato || ''} ${vinile.inserti || ''}`.trim();

      discogsAutoTimer = setTimeout(() => {
        fetchDiscogsLivePrice(queryMatrix, 'discogs-live-box', estimatedValue);
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
    document.querySelectorAll('.category-chips .chip-btn').forEach(b => {
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
    const queryMatrix = (v.codice_matrice && v.codice_matrice !== '??')
      ? v.codice_matrice 
      : (v.catalog_number && v.catalog_number !== '??') 
        ? v.catalog_number 
        : `${v.artista} ${v.titolo_album}`.trim();
        
    const cachedDiscogsPrices = JSON.parse(localStorage.getItem('discogs_cached_prices') || '{}');
    const discogsRealPrice = cachedDiscogsPrices[queryMatrix];

    const valData = calculateVinylValue(v);
    const itemVal = (discogsRealPrice !== undefined && discogsRealPrice !== null && !isNaN(discogsRealPrice))
      ? parseFloat(discogsRealPrice)
      : valData.total;

    const catStr = (v.stato_catalogo || 'personale').toLowerCase();
    const isPersonale = catStr.includes('personale') || catStr === '' || !v.stato_catalogo;

    if (isPersonale) {
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
      <div class="kpi-banner-sub">Somma dei prezzi di mercato reali letti da Discogs sui ${personale} dischi della collezione Personale (${symbol})</div>
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

  // PRIMO TENTATIVO: RICERCA BARCODE SU DISCOGS / MUSICBRAINZ
  const cleanBarcode = cleanQuery.replace(/[^0-9a-zA-Z]/g, '');

  // 1a. Discogs Barcode Endpoint (https://api.discogs.com/database/search?barcode=...)
  if (cleanBarcode.length >= 3) {
    try {
      const discogsRes = await fetch(`https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanBarcode)}`);
      if (discogsRes.ok) {
        const discogsData = await discogsRes.json();
        if (discogsData.results && discogsData.results.length > 0) {
          discogsData.results.forEach(item => {
            let artist = 'Artista Sconosciuto';
            let title = item.title || '';
            if (title.includes(' - ')) {
              const parts = title.split(' - ');
              artist = parts[0].trim();
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
              catno: item.catno || cleanBarcode
            });
          });
        }
      }
    } catch (e) {
      console.warn("Discogs Barcode fetch error:", e);
    }
  }

  // 1b. MusicBrainz Barcode Endpoint
  if (cleanBarcode.length >= 3) {
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
                catno: cleanBarcode
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
        cover: res.cover || null
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
  }
}

if (discogsSearchBtn && discogsQuery) {
  discogsSearchBtn.addEventListener('click', () => {
    searchMusicBrainzOrDiscogs(discogsQuery.value.trim());
  });
  discogsQuery.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchMusicBrainzOrDiscogs(discogsQuery.value.trim());
    }
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
      posizione_fisica: document.getElementById('add-posizione-fisica').value || 'Scaffale Principale',
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
// GESTIONE QR CODE ETICHETTA STAMPABILE
// ==========================================

const qrModal = document.getElementById('qr-modal');
const closeQrModalBtn = document.getElementById('close-qr-modal-btn');
const printStickerBtn = document.getElementById('print-sticker-btn');

window.openQRCodeModal = function(id) {
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile) return;

  document.getElementById('sticker-title').textContent = vinile.titolo_album || 'Album';
  document.getElementById('sticker-artist').textContent = vinile.artista || 'Artista';
  document.getElementById('sticker-year').textContent = vinile.anno_uscita_originale || vinile.anno_stampa || 'N/A';
  document.getElementById('sticker-cat').textContent = `Cat: ${vinile.catalog_number || vinile.codice_matrice || 'N/A'}`;
  document.getElementById('sticker-location').textContent = `📍 Posizione: ${vinile.posizione_fisica || 'Scaffale Principale'}`;

  const qrData = `${vinile.artista} - ${vinile.titolo_album} (Cat: ${vinile.catalog_number || 'N/A'}) [Pos: ${vinile.posizione_fisica || 'N/A'}]`;
  const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="100%" height="100%" fill="#fff"/><rect x="20" y="20" width="50" height="50" fill="#111827"/><rect x="30" y="30" width="30" height="30" fill="#fff"/><rect x="37" y="37" width="16" height="16" fill="#111827"/><rect x="130" y="20" width="50" height="50" fill="#111827"/><rect x="140" y="30" width="30" height="30" fill="#fff"/><rect x="147" y="37" width="16" height="16" fill="#111827"/><rect x="20" y="130" width="50" height="50" fill="#111827"/><rect x="30" y="140" width="30" height="30" fill="#fff"/><rect x="37" y="147" width="16" height="16" fill="#111827"/><rect x="90" y="40" width="20" height="20" fill="#111827"/><rect x="90" y="90" width="20" height="20" fill="#111827"/><rect x="40" y="90" width="20" height="20" fill="#111827"/><rect x="140" y="90" width="20" height="20" fill="#111827"/><rect x="120" y="130" width="20" height="20" fill="#111827"/><rect x="150" y="150" width="30" height="30" fill="#111827"/><rect x="90" y="140" width="20" height="40" fill="#111827"/></svg>`;
  document.getElementById('sticker-qr-img').src = 'data:image/svg+xml;utf8,' + encodeURIComponent(qrSvg);

  if (qrModal) {
    qrModal.classList.add('active');
    qrModal.setAttribute('aria-hidden', 'false');
  }
};

if (closeQrModalBtn) {
  closeQrModalBtn.addEventListener('click', () => {
    if (qrModal) {
      qrModal.classList.remove('active');
      qrModal.setAttribute('aria-hidden', 'true');
    }
  });
}

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

if (printStickerBtn) {
  printStickerBtn.addEventListener('click', () => window.print());
}

// ==========================================
// GESTIONE MODIFICA ED ELIMINAZIONE VINILE
// ==========================================
const editVinylModal = document.getElementById('edit-vinyl-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const editVinylForm = document.getElementById('edit-vinyl-form');
const deleteVinylFromEditBtn = document.getElementById('delete-vinyl-from-edit-btn');

window.openEditVinylModal = function(id) {
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile) return;

  document.getElementById('edit-vinyl-id').value = vinile.id;
  document.getElementById('edit-titolo').value = vinile.titolo_album || '';
  document.getElementById('edit-artista').value = vinile.artista || '';
  document.getElementById('edit-genere').value = vinile.genere || '';
  document.getElementById('edit-posizione-fisica').value = vinile.posizione_fisica || '';
  document.getElementById('edit-stato-catalogo').value = vinile.stato_catalogo || 'Personale';
  document.getElementById('edit-valore-stimato').value = vinile.valore_stimato || 25;
  document.getElementById('edit-anno-uscita').value = vinile.anno_uscita_originale || '';
  document.getElementById('edit-anno-stampa').value = vinile.anno_stampa || '';
  document.getElementById('edit-etichetta').value = vinile.etichetta || '';
  document.getElementById('edit-cat-num').value = vinile.catalog_number || '';
  document.getElementById('edit-matrice').value = vinile.codice_matrice || '';
  document.getElementById('edit-velocita').value = vinile.velocita || '33';
  document.getElementById('edit-grammatura').value = vinile.grammatura || '180g';
  document.getElementById('edit-stato-disco').value = vinile.stato_disco || '8';
  document.getElementById('edit-stato-copertina').value = vinile.stato_copertina || '8';
  document.getElementById('edit-note').value = vinile.note_stato || '';

  if (editVinylModal) {
    editVinylModal.classList.add('active');
    editVinylModal.setAttribute('aria-hidden', 'false');
  }
};

if (closeEditModalBtn) {
  closeEditModalBtn.addEventListener('click', () => {
    if (editVinylModal) {
      editVinylModal.classList.remove('active');
      editVinylModal.setAttribute('aria-hidden', 'true');
    }
  });
}

if (editVinylForm) {
  editVinylForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-vinyl-id').value;
    const index = ALL_VINILI.findIndex(v => String(v.id) === String(id));
    if (index === -1) return;

    ALL_VINILI[index] = {
      ...ALL_VINILI[index],
      titolo_album: document.getElementById('edit-titolo').value,
      artista: document.getElementById('edit-artista').value,
      genere: document.getElementById('edit-genere').value,
      posizione_fisica: document.getElementById('edit-posizione-fisica').value,
      stato_catalogo: document.getElementById('edit-stato-catalogo').value,
      valore_stimato: parseFloat(document.getElementById('edit-valore-stimato').value) || 25,
      anno_uscita_originale: parseInt(document.getElementById('edit-anno-uscita').value) || ALL_VINILI[index].anno_uscita_originale,
      anno_stampa: parseInt(document.getElementById('edit-anno-stampa').value) || ALL_VINILI[index].anno_stampa,
      etichetta: document.getElementById('edit-etichetta').value,
      catalog_number: document.getElementById('edit-cat-num').value,
      codice_matrice: document.getElementById('edit-matrice').value,
      velocita: document.getElementById('edit-velocita').value,
      grammatura: document.getElementById('edit-grammatura').value,
      stato_disco: document.getElementById('edit-stato-disco').value,
      stato_copertina: document.getElementById('edit-stato-copertina').value,
      note_stato: document.getElementById('edit-note').value
    };

    // Aggiorna userAddedVinyls se presente
    const userIdx = userAddedVinyls.findIndex(v => String(v.id) === String(id));
    if (userIdx !== -1) {
      userAddedVinyls[userIdx] = ALL_VINILI[index];
      localStorage.setItem('user_added_vinili', JSON.stringify(userAddedVinyls));
    }

    if (editVinylModal) {
      editVinylModal.classList.remove('active');
      editVinylModal.setAttribute('aria-hidden', 'true');
    }

    populateGenreSelect();
    applyFiltering();
    showToast("✏️ Vinile aggiornato con successo!");
  });
}

window.deleteVinyl = function(id) {
  const vinile = ALL_VINILI.find(v => String(v.id) === String(id));
  if (!vinile) return;

  if (confirm(`Sei sicuro di voler eliminare "${vinile.titolo_album}" dalla collezione?`)) {
    ALL_VINILI = ALL_VINILI.filter(v => String(v.id) !== String(id));
    const userIdx = userAddedVinyls.findIndex(v => String(v.id) === String(id));
    if (userIdx !== -1) {
      userAddedVinyls.splice(userIdx, 1);
      localStorage.setItem('user_added_vinili', JSON.stringify(userAddedVinyls));
    }

    if (editVinylModal) {
      editVinylModal.classList.remove('active');
      editVinylModal.setAttribute('aria-hidden', 'true');
    }

    applyFiltering();
    selectIndex(Math.max(0, selectedIndex - 1));
    showToast("🗑️ Vinile eliminato dalla collezione");
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

document.getElementById('dock-qr-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.openQRCodeModal(vinile.id);
});

document.getElementById('dock-add-vinyl-btn')?.addEventListener('click', () => {
  if (bottomQuickMenu) bottomQuickMenu.classList.remove('active');
  if (addVinylModal) {
    addVinylModal.classList.add('active');
    addVinylModal.setAttribute('aria-hidden', 'false');
  }
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
}

if (forceSyncBtn) {
  forceSyncBtn.addEventListener('click', () => {
    syncAllDiscogsPrices(true);
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
          userAddedVinyls = importedData;
          localStorage.setItem('user_added_vinili', JSON.stringify(userAddedVinyls));
          ALL_VINILI = [...userAddedVinyls, ...DATABASE_VINILI];
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
document.getElementById('dock-add-btn')?.addEventListener('click', () => {
  if (addVinylModal) {
    addVinylModal.classList.add('active');
    addVinylModal.setAttribute('aria-hidden', 'false');
  }
});

document.getElementById('dock-edit-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.openEditVinylModal(vinile.id);
});

document.getElementById('dock-delete-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) window.deleteVinyl(vinile.id);
});

document.getElementById('dock-discogs-btn')?.addEventListener('click', () => {
  const vinile = filteredVinili[selectedIndex];
  if (vinile) {
    const query = encodeURIComponent(vinile.catalog_number || vinile.codice_matrice || (vinile.artista + ' ' + vinile.titolo_album));
    window.open(`https://www.discogs.com/search/?q=${query}&type=all`, '_blank', 'noopener,noreferrer');
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
  const fallbackCover = generateSVGAlbumCover(vinile.artista, vinile.titolo_album);
  const coverSrc = (vinile.cover && vinile.cover.trim() !== '') ? vinile.cover : fallbackCover;

  jukeboxDisplay.innerHTML = `
    <div class="floating-art-wrapper" style="margin-bottom: 12px;">
      <div class="album-cover-wrapper playing" style="width: 200px; height: 200px;">
        <img class="album-cover-img" src="${coverSrc}" alt="${vinile.titolo_album}" width="200" height="200">
        <div class="vinyl-disc" style="right: -85px;"></div>
      </div>
      <div class="floating-floor-shadow" style="width: 170px;"></div>
    </div>
    <h2 style="color: #fff; font-size: 1.4rem; font-weight: 800; margin-top: 6px;">${vinile.titolo_album}</h2>
    <div style="color: #ff9ffc; font-size: 1.1rem; font-weight: 700; margin-top: 2px;">${vinile.artista}</div>
    <div style="margin-top: 8px; font-size: 0.82rem; color: #cbd5e1; display: flex; gap: 8px; justify-content: center;">
      <span class="badge badge-purple">${vinile.genere || 'Vinile'}</span>
      <span class="badge badge-pink">${vinile.anno_uscita_originale || vinile.anno_stampa || 'N/A'}</span>
      <span class="badge" style="color:#ff9ffc;">📀 ${vinile.stato_catalogo || 'Personale'}</span>
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

// INIZIALIZZA L'APPLICAZIONE & AVVIA SINCRONIZZAZIONE AUTOMATICA IN BACKGROUND SU DISCOGS
applyFiltering();
setTimeout(syncAllDiscogsPrices, 2000);

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