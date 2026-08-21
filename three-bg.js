import * as THREE from 'https://esm.sh/three';

let activeShaderMaterial = null;
let activeThreeRenderer = null;
let targetTopColor = new THREE.Vector3(0.32, 0.15, 1.0);
let targetBottomColor = new THREE.Vector3(1.0, 0.62, 0.98);
let isBgAnimationPaused = localStorage.getItem('app_bg_anim_paused') === 'true';
const isMobileDevice = window.innerWidth <= 768;
export let bgIterations = parseInt(localStorage.getItem('app_bg_iterations'), 10) || (isMobileDevice ? 10 : 20);
export let bgBlur = parseFloat(localStorage.getItem('app_bg_blur')) || 0.0;

export function updateBackgroundSharpness(val) {
  bgIterations = Math.max(1, Math.min(50, parseInt(val, 10) || 20));
  localStorage.setItem('app_bg_iterations', bgIterations);

  if (activeShaderMaterial && activeShaderMaterial.uniforms && activeShaderMaterial.uniforms.u_iterations) {
    activeShaderMaterial.uniforms.u_iterations.value = bgIterations;
  }

  const badge = document.getElementById('sharpness-value-badge');
  if (badge) {
    let label = `${bgIterations} iter.`;
    if (bgIterations >= 40) label += ' (Ultra)';
    else if (bgIterations >= 28) label += ' (Alta qualitÃ )';
    else if (bgIterations >= 15) label += ' (Bilanciato)';
    else label += ' (Veloce)';
    badge.textContent = label;
  }
}

export function updateBackgroundBlur(val) {
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

export function updateAnimationToggleButtonUI() {
  const btn = document.getElementById('settings-toggle-anim-btn');
  if (btn) {
    if (isBgAnimationPaused) {
      btn.innerHTML = 'â–¶ï¸ Riprendi Animazioni Sfondo';
      btn.style.background = 'rgba(52, 211, 153, 0.2)';
      btn.style.borderColor = 'rgba(52, 211, 153, 0.6)';
    } else {
      btn.innerHTML = 'â¸ï¸ Metti in Pausa Animazioni Sfondo';
      btn.style.background = 'rgba(255, 255, 255, 0.08)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
    }
  }
}

export function toggleBackgroundAnimation() {
  isBgAnimationPaused = !isBgAnimationPaused;
  localStorage.setItem('app_bg_anim_paused', isBgAnimationPaused ? 'true' : 'false');
  updateAnimationToggleButtonUI();
  if (typeof showToast === 'function') {
    if (isBgAnimationPaused) {
      showToast("â¸ï¸ Animazioni Sfondo messe in Pausa");
    } else {
      showToast("â–¶ï¸ Animazioni Sfondo riattivate!");
    }
  } else if (window.showToast) {
      window.showToast(isBgAnimationPaused ? "â¸ï¸ Animazioni Sfondo messe in Pausa" : "â–¶ï¸ Animazioni Sfondo riattivate!");
  }
}

const pillarContainer = document.getElementById('light-pillar-container');

if (pillarContainer) {
  const isMobile = window.innerWidth <= 768;
  const settings = { 
    iterations: isMobile ? 12 : 21, 
    waveIterations: 2, 
    pixelRatio: isMobile ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 1.5), 
    precision: isMobile ? 'lowp' : 'mediump', 
    stepMultiplier: isMobile ? 2.5 : 1.6 
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

  // CSS GRADIENT FALLBACK FOR MOBILE
  if (isMobile) {
    pillarContainer.style.background = `linear-gradient(135deg, ${PILLAR_CONFIG.topColor}, ${PILLAR_CONFIG.bottomColor})`;
    
    
    pillarContainer.style.transition = "background 1s ease";
    
    // Polyfill per la funzione di aggiornamento colori
    window.updateDynamicAlbumBackground = (c1, c2) => {
      pillarContainer.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    };
    
    // Niente Three.js sul telefono!
  } else {
    // DESKTOP WEBGL
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: 'low-power',
        precision: settings.precision,
        stencil: false,
        depth: false
      });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(settings.pixelRatio);
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

    const float STEP_MULT = ${settings.stepMultiplier.toFixed(1)};
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
  } catch (err) {
    console.error("ThreeJS non supportato o errore contesto WebGL. Attivazione fallback sfocato.", err);
    pillarContainer.style.background = 'linear-gradient(135deg, #5227FF, #FF9FFC)';
    pillarContainer.style.filter = 'blur(100px)';
  }
  } // Chiusura else (isMobile)
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

export function applyAppTheme(themeKey) {
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
        if (typeof extractDominantColors === 'function') {
          extractDominantColors(currentImgEl);
        } else if (window.extractDominantColors) {
          window.extractDominantColors(currentImgEl);
        }
      } else {
        currentImgEl.onload = () => {
          if (typeof extractDominantColors === 'function') {
            extractDominantColors(currentImgEl);
          } else if (window.extractDominantColors) {
            window.extractDominantColors(currentImgEl);
          }
        };
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

export function updateDynamicAlbumBackground(topHex, bottomHex) {
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


