# 🎵 Catalogazione Vinili 3D

> App web PWA per la catalogazione personale di dischi in vinile, con interfaccia Liquid Glass, sfondo 3D WebGL ray-marching e ruota selettore titoli animata.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=flat&logo=three.js&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installabile-5A0FC8?style=flat&logo=pwa&logoColor=white)

---

## 📋 Indice

- [Features](#-features)
- [Architettura](#-architettura)
- [Struttura File](#-struttura-file)
- [Modello Dati](#-modello-dati)
- [Sfondo 3D WebGL](#-sfondo-3d-webgl--fragment-shader)
- [Ruota Titoli 3D](#-ruota-titoli-3d)
- [Sistema PWA](#-sistema-pwa)
- [Impostazioni & Slider](#-impostazioni--slider)
- [Come aggiungere un vinile](#-come-aggiungere-un-vinile)
- [Deployment](#-deployment)
- [Dipendenze Esterne](#-dipendenze-esterne)

---

## ✨ Features

| Feature | Descrizione |
|---------|-------------|
| 🌊 **Sfondo WebGL** | Ray-marching 3D con pilastri di luce animati, scritto in GLSL puro, renderizzato con Three.js |
| 🎡 **Ruota Titoli** | Selettore 3D con effetto prospettico/curvilineare, navigabile a scroll e swipe |
| 🪟 **Liquid Glass UI** | Scheda centrale con `backdrop-filter`, bordi semitrasparenti e micro-ombre |
| 📀 **Giradischi animato** | Copertina cliccabile con animazione 3D di estrazione del vinile e tilt parallax |
| 🎨 **Colori dinamici** | Estrazione del colore dominante dalla copertina tramite canvas pixel sampling |
| 🔍 **Ricerca live** | Ricerca istantanea per artista, album, etichetta, catalog number, matrice |
| 🗂️ **Filtri & Ordinamento** | Categoria (Personale/Wishlist/Eredità), intervallo anno, genere, 5 strategie di sort |
| 💶 **Stima valore** | Calcolo automatico del valore commerciale basato su stato, rarità, origine, anno |
| 📊 **Statistiche** | Dashboard con totali, artista più presente, valore stimato totale collezione |
| 🏷️ **QR Code** | Generazione etichette QR per ogni vinile con identificativo univoco |
| 📥 **Import/Export** | Backup e ripristino collezione in JSON; export CSV |
| 🔗 **Ricerca Discogs** | Ricerca online su Discogs API + scanner barcode EAN |
| 💾 **Persistenza locale** | Tutti i vinili aggiunti dall'utente vengono salvati in `localStorage` |
| 📱 **PWA** | Installabile come app nativa (Android/iOS/Desktop), funziona offline |

---

## 🏗️ Architettura

```
┌──────────────────────────────────────────────────────┐
│                     index.html                       │
│  Header ─ SearchBar ─ FilterModal ─ SettingsModal    │
│  ┌──────────────┐   ┌─────────────────────────────┐  │
│  │ #option-wheel│   │    .center-glass-panel       │  │
│  │  (Ruota 3D)  │   │    .glass-surface            │  │
│  │  <aside>     │   │    #center-content           │  │
│  └──────────────┘   └─────────────────────────────┘  │
│        ┌─────────────────────────────────────────┐    │
│        │   #light-pillar-container  (WebGL BG)   │    │
│        └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘

  database.js ──► ALL_VINILI ──► applyFiltering()
                                      │
                            ┌─────────┴──────────┐
                        renderWheel()     updateCenterContent()
                            │                    │
                      #option-wheel        #center-content
                     (lista titoli)      (scheda dettaglio)
```

### Stato globale (variabili modulo in `script.js`)

| Variabile | Tipo | Descrizione |
|-----------|------|-------------|
| `ALL_VINILI` | `Array` | Database completo: statico + utente da localStorage |
| `filteredVinili` | `Array` | Sottoinsieme corrente dopo filtri e ricerca |
| `selectedIndex` | `number` | Indice del vinile attualmente visualizzato |
| `activeShaderMaterial` | `THREE.ShaderMaterial` | Riferimento al materiale GLSL del background |
| `activeThreeRenderer` | `THREE.WebGLRenderer` | Riferimento al renderer WebGL |
| `bgIterations` | `number` | Iterazioni shader (1–50), persistito in localStorage |
| `bgBlur` | `number` | Blur CSS canvas (0–20 px), persistito in localStorage |

---

## 📁 Struttura File

```
.
├── index.html       # Struttura HTML, modali, dock bar, layout principale
├── style.css        # CSS completo: layout, animazioni, glassmorphism, responsive
├── script.js        # Logica applicativa (~2500 righe): shader, ruota, CRUD, filtri
├── database.js      # Database statico dei vinili (ES module export)
├── manifest.json    # Configurazione PWA (nome, icona, colori, display mode)
├── sw.js            # Service Worker: cache-first strategy per offline support
└── Img/             # Copertine album (JPG/PNG referenziate dal database)
```

---

## 🗃️ Modello Dati

Ogni vinile in `database.js` e nei record utente segue questo schema:

```js
{
  "id": 1,                          // Identificativo univoco (intero)
  "artista": "Pink Floyd",
  "titolo_album": "The Dark Side of the Moon",
  "genere": "Progressive Rock",
  "anno_uscita_originale": 1973,
  "anno_stampa": 1983,              // Anno della stampa fisica posseduta
  "origine": "IT",                  // Paese di stampa (sigla ISO)
  "etichetta": "Harvest / EMI",
  "catalog_number": "STEREO 3C06405249",
  "codice_matrice": "05249",
  "velocita": "33",                 // RPM: "33" o "45"
  "colore": "Nero",
  "grammatura": "120-125g",
  "inserti": "1 Poster",
  "stato_disco": "8",               // Voto 1-10 condizioni disco
  "stato_copertina": "5",           // Voto 1-10 condizioni copertina
  "note_stato": "",                 // Note libere sullo stato fisico
  "stato_catalogo": "Personale",    // "Personale" | "Wishlist" | "Eredità"
  "posizione_fisica": "Scaffale A", // Posizione nella collezione
  "cover": "Img/dark_side.jpg",     // Path relativo o URL esterno della copertina
  "foto_album": ["Img/retro.jpg"],  // Foto aggiuntive (fronte, retro, interno, ecc.)
  "tracce": [                       // Tracklist (opzionale)
    { "pos": "A1", "title": "Speak to Me", "duration": "1:30" }
  ]
}
```

I **vinili utente** sono salvati in `localStorage` (`user_added_vinili`) e fusi con il database statico all'avvio:

```js
const userAddedVinyls = JSON.parse(localStorage.getItem('user_added_vinili') || '[]');
let ALL_VINILI = [...userAddedVinyls, ...DATABASE_VINILI];
```

---

## 🌌 Sfondo 3D WebGL & Fragment Shader

Lo sfondo è implementato con **Three.js r161** e un fragment shader GLSL custom basato su **ray-marching**.

### Come funziona il ray-marching

Per ogni pixel, il fragment shader lancia un raggio dallo stesso punto di vista (`ro`) nella direzione calcolata dall'UV (`rd`). Il raggio avanza a passi, valutando la **distanza da un campo di pilastri** (SDF — Signed Distance Field). Il colore viene accumulato in modo inversamente proporzionale alla distanza:

```glsl
precision mediump float;

uniform float uTime;
uniform int   u_iterations;   // Numero di passi (1-50, da slider UI)
uniform vec3  uTopColor;
uniform vec3  uBottomColor;

void main() {
  vec3 ro = vec3(0.0, 0.0, -10.0);  // Origin del raggio
  vec3 rd = normalize(vec3(uv, 1.0)); // Direzione

  vec3 col = vec3(0.0);
  float t = 0.1;

  for(int i = 0; i < u_iterations; i++) {
    vec3 p = ro + rd * t;

    // Wave deformation con frequenze armoniche
    // SDF: pilastro cilindrico con smooth union
    float d = length(cos(q.xz)) - 0.2;

    // Gradiente verticale: colore dal basso all'alto
    float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
    col += mix(uBottomColor, uTopColor, grad) / d;

    t += d * STEP_MULT;
    if(t > 50.0) break;
  }

  // Tonemapping sigmoid + noise dithering
  gl_FragColor = vec4(col * uIntensity, 1.0);
}
```

### Uniform aggiornate a runtime

| Uniform | Sorgente | Frequenza |
|---------|----------|-----------|
| `uTime` | `requestAnimationFrame` | Ogni frame |
| `uTopColor` / `uBottomColor` | Cambio tema, lerp smooth | Ogni frame |
| `uRotCos` / `uRotSin` | Loop animazione | Ogni frame |
| `u_iterations` | Slider "Iterazioni Shader" | On input |
| `uIntensity` | Preset tema | On change |

> **Nota tecnica**: il blur del background viene applicato come `filter: blur(Xpx)` sul `canvas` DOM invece che in GLSL, per evitare la ricompilazione dello shader ad ogni frame.

---

## 🎡 Ruota Titoli 3D

La lista album è un selettore a ruota con effetto prospettico 3D, implementata in CSS + JS puro (nessuna libreria).

### Layout

Gli item `.wheel-item` sono posizionati con `position: absolute; top: 50%` — tutti allo stesso punto di partenza (centro verticale del container). La funzione `updateWheel()` applica su ognuno un `transform 3D` calcolato in base alla distanza dall'item selezionato:

```js
function updateWheel() {
  wheelItems.forEach((item, index) => {
    const distance = index - selectedIndex;
    const absDist  = Math.abs(distance);

    const translateY  = distance * 2.7;               // rem — offset verticale
    const curveOffset = -Math.pow(absDist, 1.4) * 11; // px — curvatura orizzontale
    const rotateX     = distance * -5.5;              // deg — inclinazione prospettica
    const opacity     = Math.max(0.05, 1 - absDist * 0.22);
    const scale       = isSelected ? 1.05 : Math.max(0.76, 1 - absDist * 0.08);

    item.style.transform = `translate3d(${curveOffset}px,
                             calc(${translateY}rem - 50%), 0)
                             rotateX(${rotateX}deg) scale(${scale})`;
  });
}
```

### Navigazione supportata

- **Click** sull'item nella ruota
- **Scroll wheel** sopra il container (throttled)
- **Swipe touch** verticale (mobile)
- **Frecce prev/next** nella header mobile

---

## 📱 Sistema PWA

| File | Ruolo |
|------|-------|
| `manifest.json` | Nome, icona SVG inline, `display: standalone`, theme color `#5227ff` |
| `sw.js` | Service Worker con strategia **cache-first** |

Il Service Worker:
1. **Install** → mette in cache tutti gli asset principali
2. **Activate** → elimina cache versioni precedenti (`CACHE_NAME`)
3. **Fetch** → risponde dalla cache se disponibile; altrimenti rete + aggiorna cache; fallback su `index.html` se offline

Per forzare un aggiornamento della cache, incrementare `CACHE_NAME` in `sw.js`:
```js
const CACHE_NAME = 'vinili-app-v2'; // era v1
```

---

## ⚙️ Impostazioni & Slider

### Iterazioni Shader (`#settings-sharpness-slider`)

- **Range**: 1 – 50 (intero)  
- **Default**: 20  
- **Effetto**: numero di passi del loop ray-marching per pixel. Più iterazioni → più dettaglio → più carico GPU.  
- Aggiorna la uniform `u_iterations` tramite `updateBackgroundSharpness(val)`.

### Blur Sfondo (`#bg-blur-slider`)

- **Range**: 0 – 20 px  
- **Default**: 0  
- **Effetto**: `filter: blur(Xpx)` applicato **solo** al canvas WebGL.  
- Gestito da `updateBackgroundBlur(val)` che scrive esclusivamente su `activeThreeRenderer.domElement.style.filter`.

Entrambi i valori sono persistiti in `localStorage`:

```js
localStorage.setItem('app_bg_iterations', bgIterations); // chiave: app_bg_iterations
localStorage.setItem('app_bg_blur', bgBlur.toFixed(1));  // chiave: app_bg_blur
```

---

## ➕ Come aggiungere un vinile

### Via UI (consigliato)

Clicca **"+ Aggiungi Vinile"** nella dock bar. I dati vengono salvati in `localStorage` e sono immediatamente visibili nella ruota.

### Via `database.js` (statico, per sviluppatori)

Aggiungi un oggetto all'array `DATABASE_VINILI` rispettando il [modello dati](#-modello-dati). I vinili del database statico non sono modificabili/eliminabili dall'utente via UI.

```js
// database.js
export const DATABASE_VINILI = [
  {
    "id": 101,
    "artista": "Nuovo Artista",
    "titolo_album": "Nuovo Album",
    // ... tutti i campi
  },
  // ...
];
```

---

## 🚀 Deployment

L'app è **completamente statica** — nessun server backend, nessun build step, nessun package manager.

```bash
# Clona il repository
git clone https://github.com/tuo-utente/vinili-3d.git
cd vinili-3d

# Avvia un server statico locale (qualunque va bene)
npx serve .
# oppure
python -m http.server 8080
```

### GitHub Pages

1. *Settings → Pages*
2. Source: branch `main`, folder `/ (root)`
3. App disponibile su `https://tuo-utente.github.io/vinili-3d/`

> **Attenzione**: Three.js è caricato via CDN. È richiesta connessione internet al primo avvio; dopo che il Service Worker ha cachato gli asset, l'app funziona interamente offline.

---

## 🛠️ Dipendenze Esterne

| Libreria | Versione | Caricamento | Utilizzo |
|----------|----------|-------------|---------|
| [Three.js](https://threejs.org/) | r161 | CDN jsDelivr | WebGL renderer, ShaderMaterial, animazione |
| [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | — | Google Fonts | Font principale UI |

Nessun framework CSS, nessun bundler, nessun `npm install` richiesto.

---

## 📂 Immagini mancanti

Se un'immagine referenziata nel campo `"cover"` restituisce 404, l'app genera automaticamente un **placeholder SVG** con gradiente e iniziali artista/album:

```js
// Fallback generato dinamicamente in script.js
function generateSVGAlbumCover(artista, titolo) {
  // Colore derivato dal nome tramite hash
  // SVG con gradiente, cerchio centrale e testo
  return `data:image/svg+xml;charset=utf-8,...`;
}
```

Il tag `<img>` usa l'attributo `onerror` per applicare il fallback in modo non bloccante:

```html
<img src="${coverSrc}" onerror="this.onerror=null; this.src='${fallbackCover}';">
```

---

## 📄 Licenza

Progetto personale — uso libero per scopi non commerciali.
