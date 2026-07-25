// Importa Three.js
import * as THREE from 'https://esm.sh/three';

// Importa il database dal file esterno
import { DATABASE_VINILI } from './database.js';

// ==========================================
// 1. GENERATORE EFFETTO LIQUID GLASS
// ==========================================
function createGlassSurface(containerId, config = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cfg = {
    width: 85 + 'vh',         
    height: 85 + 'vh',        
    borderRadius: 24,       
    borderWidth: 0.07,
    brightness: 60,
    opacity: 0.8,
    blur: 11,
    displace: 5,           
    backgroundOpacity: 0.05,
    saturation: 1.2,
    distortionScale: -120,  
    redOffset: 5,           
    greenOffset: 15,        
    blueOffset: 25,         
    xChannel: 'R',
    yChannel: 'G',
    mixBlendMode: 'screen',
    ...config
  };

  const uniqueId = Math.random().toString(36).substring(2, 9);
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const svgSupported = !(isWebkit || isFirefox);

  container.classList.add('glass-surface');
  container.classList.add(svgSupported ? 'glass-surface--svg' : 'glass-surface--fallback');
  
  container.style.width = typeof cfg.width === 'number' ? `${cfg.width}px` : cfg.width;
  container.style.height = typeof cfg.height === 'number' ? `${cfg.height}px` : cfg.height;
  container.style.borderRadius = `${cfg.borderRadius}px`;
  container.style.setProperty('--glass-frost', cfg.backgroundOpacity);
  container.style.setProperty('--glass-saturation', cfg.saturation);
  container.style.setProperty('--filter-id', `url(#${filterId})`);

  if (svgSupported) {
    const svgHTML = `
      <svg class="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${filterId}" colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage class="fe-map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
            
            <feDisplacementMap in="SourceGraphic" in2="map" result="dispRed" scale="${cfg.distortionScale + cfg.redOffset}" xChannelSelector="${cfg.xChannel}" yChannelSelector="${cfg.yChannel}" />
            <feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            
            <feDisplacementMap in="SourceGraphic" in2="map" result="dispGreen" scale="${cfg.distortionScale + cfg.greenOffset}" xChannelSelector="${cfg.xChannel}" yChannelSelector="${cfg.yChannel}" />
            <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            
            <feDisplacementMap in="SourceGraphic" in2="map" result="dispBlue" scale="${cfg.distortionScale + cfg.blueOffset}" xChannelSelector="${cfg.xChannel}" yChannelSelector="${cfg.yChannel}" />
            <feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            
            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur in="output" stdDeviation="${cfg.displace}" />
          </filter>
        </defs>
      </svg>
    `;
    
    container.insertAdjacentHTML('afterbegin', svgHTML);
    const feImage = container.querySelector('.fe-map');

    const generateDisplacementMap = (width, height) => {
      const edgeSize = Math.min(width, height) * (cfg.borderWidth * 0.5);
      const svgContent = `
        <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#0000"/>
              <stop offset="100%" stop-color="red"/>
            </linearGradient>
            <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#0000"/>
              <stop offset="100%" stop-color="blue"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="black"></rect>
          <rect x="0" y="0" width="${width}" height="${height}" rx="${cfg.borderRadius}" fill="url(#${redGradId})" />
          <rect x="0" y="0" width="${width}" height="${height}" rx="${cfg.borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${cfg.mixBlendMode}" />
          <rect x="${edgeSize}" y="${edgeSize}" width="${width - edgeSize * 2}" height="${height - edgeSize * 2}" rx="${cfg.borderRadius}" fill="hsl(0 0% ${cfg.brightness}% / ${cfg.opacity})" style="filter:blur(${cfg.blur}px)" />
        </svg>
      `;
      return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    };

    const updateMap = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width || parseInt(cfg.width);
      const h = rect.height || parseInt(cfg.height);
      feImage.setAttribute('href', generateDisplacementMap(w, h));
    };

    const resizeObserver = new ResizeObserver(() => setTimeout(updateMap, 0));
    resizeObserver.observe(container);
    updateMap();
  }
}

createGlassSurface('my-liquid-glass', {
  width: 85 + 'vh',
  height: 90 + 'vh',
  borderRadius: 24,
  distortionScale: -120, 
  displace: 5
});


// ==========================================
// 2. CONFIGURAZIONE SFONDO (LIGHTPILLAR)
// ==========================================
const PILLAR_CONFIG = {
  topColor: '#5227FF',
  bottomColor: '#FF9FFC',
  intensity: 1.0,
  rotationSpeed: 0.3,
  interactive: false,
  glowAmount: 0.005,
  pillarWidth: 3.0,
  pillarHeight: 0.4,
  noiseIntensity: 0.5,
  pillarRotation: 0, 
  quality: 'high'
};

const pillarContainer = document.getElementById('light-pillar-container');

if (pillarContainer) {
  const settings = { 
    iterations: 80, 
    waveIterations: 4, 
    pixelRatio: Math.min(window.devicePixelRatio, 2), 
    precision: 'highp', 
    stepMultiplier: 1.0 
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
    uniform vec2 uMouse;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uIntensity;
    uniform bool uInteractive;
    uniform float uGlowAmount;
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
      if(uInteractive && (uMouse.x != 0.0 || uMouse.y != 0.0)) {
        float a = uMouse.x * 6.283185;
        rotC = cos(a);
        rotS = sin(a);
      }

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
      
      vec3 exp2x = exp(2.0 * (col * uGlowAmount / widthNorm));
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
      uMouse: { value: new THREE.Vector2(0, 0) },
      uTopColor: { value: parseColor(PILLAR_CONFIG.topColor) },
      uBottomColor: { value: parseColor(PILLAR_CONFIG.bottomColor) },
      uIntensity: { value: PILLAR_CONFIG.intensity },
      uInteractive: { value: PILLAR_CONFIG.interactive },
      uGlowAmount: { value: PILLAR_CONFIG.glowAmount },
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
  const frameTime = 1000 / 60; // 60 FPS

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
// 3. LOGICA RUOTA DINAMICA & CONTENUTO
// ==========================================

const WHEEL_CONFIG = {
  defaultSelected: 0, 
  textColor: "#a6a6a6",
  activeColor: "#ffffff",
  fontSizeRem: 2.5, 
  spacing: 1.4,
  curve: 1,
  tilt: 6,
  blur: 2,
  fade: 0.25,
  minOpacity: 0.05
};

const wheelContainer = document.getElementById("option-wheel");

// GENERA DINAMICAMENTE LA RUOTA DAL DATABASE IMPORTATO
DATABASE_VINILI.forEach((vinile) => {
  const item = document.createElement("div");
  item.className = "wheel-item";
  item.textContent = `${vinile.titolo_album}`; 
  wheelContainer.appendChild(item);
});

const wheelItems = Array.from(wheelContainer.querySelectorAll(".wheel-item"));

const centerContent = document.getElementById("center-content");
const centerImage = document.getElementById("center-image");
const centerCaption = document.getElementById("center-caption");

let selectedIndex = WHEEL_CONFIG.defaultSelected;
let isDragging = false;
let startY = 0;

function updateCenterContent(index) {
  centerContent.classList.add("fade-out");
  
  setTimeout(() => {
    const vinile = DATABASE_VINILI[index];
    if (!vinile) return;

    centerImage.src = vinile.cover;
    
    const htmlInfo = `
      <strong>Artista:</strong> ${vinile.artista}<br>
      <strong>Album:</strong> ${vinile.titolo_album} (${vinile.anno_uscita_originale})<br>
      <strong>Genere:</strong> ${vinile.genere}<br>
      <strong>Stampa:</strong> ${vinile.origine} - ${vinile.anno_stampa} / ${vinile.anno_uscita_stampa}<br>
      <strong>Etichetta:</strong> ${vinile.etichetta}<br>
      <strong>Cat. No:</strong> ${vinile.catalog_number}<br>
      <strong>Matrice:</strong> ${vinile.codice_matrice}<br>
      <strong>Specifiche:</strong> ${vinile.velocita} giri | ${vinile.colore} | ${vinile.grammatura}<br>
      <strong>Condizioni:</strong> Disco ${vinile.stato_disco} / Copertina ${vinile.stato_copertina}<br>
      <strong>Inserti:</strong> ${vinile.inserti || "Nessuno"}<br>
      <strong>Catalogo:</strong> ${vinile.stato_catalogo}
      ${vinile.note_stato ? `<br><strong>Note:</strong> <em>${vinile.note_stato}</em>` : ""}
    `;
    
    centerCaption.innerHTML = htmlInfo;
    centerContent.classList.remove("fade-out");
  }, 300); 
}

function updateWheel() {
  wheelItems.forEach((item, index) => {
    let distance = index - selectedIndex;
    const absDist = Math.abs(distance);

    const translateY = distance * (WHEEL_CONFIG.fontSizeRem * WHEEL_CONFIG.spacing);
    const curveOffset = -Math.pow(absDist, 1.5) * WHEEL_CONFIG.curve * 12; 
    const rotateX = distance * -WHEEL_CONFIG.tilt;
    const opacity = Math.max(WHEEL_CONFIG.minOpacity, 1 - absDist * WHEEL_CONFIG.fade);
    const blurAmount = absDist * WHEEL_CONFIG.blur;
    const isSelected = distance === 0;

    item.style.color = isSelected ? WHEEL_CONFIG.activeColor : WHEEL_CONFIG.textColor;
    item.style.fontWeight = isSelected ? "600" : "400";
    item.style.filter = `blur(${blurAmount}px)`;
    item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg)`;
  });
}

function selectIndex(newIndex) {
  const targetIndex = Math.max(0, Math.min(newIndex, wheelItems.length - 1));
  
  if (targetIndex !== selectedIndex) {
    selectedIndex = targetIndex;
    updateWheel();
    updateCenterContent(selectedIndex); 
  }
}

wheelContainer.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY > 0) selectIndex(selectedIndex + 1);
  else if (e.deltaY < 0) selectIndex(selectedIndex - 1);
}, { passive: false });

wheelContainer.addEventListener("pointerdown", (e) => {
  isDragging = true;
  startY = e.clientY;
  if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
});

window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  if (e.cancelable) e.preventDefault();
  const deltaY = e.clientY - startY;
  if (Math.abs(deltaY) > 25) {
    selectIndex(selectedIndex + (deltaY > 0 ? -1 : 1));
    startY = e.clientY;
  }
});

window.addEventListener("pointerup", () => { isDragging = false; });
window.addEventListener("pointercancel", () => { isDragging = false; });

// Inizializzazione al caricamento della pagina
updateWheel();
updateCenterContent(selectedIndex);
