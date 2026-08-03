# 🎵 Catalogazione Vinili 3D

> **App Web Progressive (PWA)** elegante e ad alte prestazioni per la catalogazione e gestione della tua collezione di dischi in vinile. Dotata di interfaccia **Liquid Glassmorphism**, sfondo animato 3D **WebGL Ray-Marching** personalizzabile, ruota 3D selettore titoli curvilinea, integrazione **Discogs API**, generatore **QR Code**, stima automatica del valore commerciale e supporto offline completo.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript ES2022](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=three.js&logoColor=white)
![PWA Ready](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 📋 Indice

- [✨ Feature Principali](#-feature-principali)
- [📸 Screenshots & Interfaccia](#-screenshots--interfaccia)
- [🏗️ Architettura del Sistema](#️-architettura-del-sistema)
- [📁 Struttura del Progetto](#-struttura-del-progetto)
- [🗃️ Modello Dati (Vinyl Schema)](#️-modello-dati-vinyl-schema)
- [🌌 Sfondo 3D WebGL (Ray-Marching GLSL)](#-sfondo-3d-webgl-ray-marching-glsl)
- [🎡 Ruota Titoli 3D Curvilinea](#-ruota-titoli-3d-curvilinea)
- [📱 Funzionalità PWA & Cache](#-funzionalità-pwa--cache)
- [⚙️ Configurazione & Personalizzazione](#️-configurazione--personalizzazione)
- [➕ Guida all'Aggiunta e Gestione Vinili](#-guida-allaggiunta-e-gestione-vinili)
- [🚀 Installazione & Deployment](#-installazione--deployment)
- [🛠️ Tecnologie e Dipendenze](#️-tecnologie-e-dipendenze)
- [📄 Licenza](#-licenza)

---

## ✨ Feature Principali

| Feature | Descrizione |
| :--- | :--- |
| 🌌 **Sfondo Ray-Marching 3D** | Renderizzato in real-time tramite **WebGL + Three.js** con shader GLSL custom e colonne di luce procedurali animate. |
| 🎡 **Ruota 3D Titoli Curvilinea** | Selettore album interattivo con posizionamento e inclinazione prospettica 3D, fruibile tramite mouse wheel, touch swipe o click. |
| 🪟 **Liquid Glass UI** | Design ultra-moderno basato su vetromorfismo dinamico (`backdrop-filter`), micro-animazioni fluide ed estrazione automatica dei colori dominanti dalle copertine. |
| 📀 **Giradischi & Parallax 3D** | Animazione 3D interattiva per l'estrazione del vinile dalla custodia con inclinazione prospettica al passaggio del cursore. |
| 🔍 **Ricerca Live Istantanea** | Filtraggio immediato durante la digitazione per artista, titolo album, etichetta, numero di catalogo o codice matrice. |
| 🗂️ **Filtri Avanzati & Ordine** | Filtro per categoria (*Personale*, *Wishlist*, *Eredità*, *In Vendita*), genere musicale, range di anni e 5 strategie di ordinamento. |
| 💶 **Stima del Valore Commerciale** | Algoritmo dinamico per il calcolo del valore di mercato stimato in base alle condizioni (Goldmine grading 1-10), rarità, anno e paese di stampa. |
| 📊 **Dashboard Statistiche** | Panoramica completa sulla collezione: valore totale stimato, conteggio dischi, generi dominanti e artista più collezionato. |
| 🏷️ **Etichette & QR Code** | Generazione istantanea di codice QR univoco per ogni vinile per facilitare la gestione dell'inventario fisico sullo scaffale. |
| 🌐 **Integrazione Discogs API** | Ricerca online diretta su Discogs, autocompilazione schede vinile e scanner di codici a barre a barre EAN/UPC tramite fotocamera. |
| 📥 **Import / Export Backup** | Salvataggio e ripristino dell'intera collezione in formato **JSON** e esportazione in **CSV** per fogli di calcolo. |
| 📱 **Supporto PWA & Offline** | Installabile su dispositivi **Android, iOS, Windows e macOS** come app nativa, con Service Worker cache-first che garantisce pieno funzionamento offline. |

---

## 🏗️ Architettura del Sistema

L'applicazione segue un'architettura **Single-Page Application (SPA)** modulare, reattiva e priva di dipendenze da framework pesanti:

```
┌────────────────────────────────────────────────────────────────────────┐
│                               index.html                               │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │     #app-header         │  │        #filter-modal / modals       │  │
│  │ (Search, Filter, Stats) │  │  (Filtri, Ordine, Form Add, Export) │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │      #option-wheel      │  │        .center-glass-panel          │  │
│  │   (Ruota Titoli 3D JS)   │  │   #center-content (Dettaglio Vinyl) │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │            #light-pillar-container (Canvas WebGL 3D)              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

     database.js (Static Data) ──┐
                                 ├──► ALL_VINILI ──► applyFiltering()
  localStorage (User Data) ──────┘                         │
                                            ┌──────────────┴──────────────┐
                                            ▼                             ▼
                                      renderWheel()             updateCenterContent()
                                     (#option-wheel)              (#center-content)
```

---

## 📁 Struttura del Progetto

```
.
├── index.html       # Struttura DOM principale, modali e interfaccia PWA
├── style.css        # Design System completo (CSS Variables, Glassmorphism, Responsive)
├── script.js        # Core Application Logic (~2500 righe: Ray-marching WebGL, Wheel 3D, CRUD, Discogs API)
├── database.js      # Database statico predefinito di vinili (ES Module)
├── manifest.json    # Configurazione Web App Manifest PWA (icone, temi, scorciatoie)
├── sw.js            # Service Worker per il caching avanzato e la modalità offline
└── Img/             # Copertine locali ed asset grafici degli album
```

---

## 🗃️ Modello Dati (Vinyl Schema)

Ogni record vinile gestito nel sistema (sia statico che salvato in `localStorage`) segue la struttura JSON sottostante:

```json
{
  "id": 1,
  "artista": "Pink Floyd",
  "titolo_album": "The Dark Side of the Moon",
  "genere": "Progressive Rock",
  "anno_uscita_originale": 1973,
  "anno_stampa": 1983,
  "origine": "IT",
  "etichetta": "Harvest / EMI",
  "catalog_number": "STEREO 3C06405249",
  "codice_matrice": "05249",
  "velocita": "33",
  "colore": "Nero",
  "grammatura": "120-125g",
  "inserti": "1 Poster + 2 Adesivi",
  "stato_disco": "8",
  "stato_copertina": "7",
  "note_stato": "Leggero usura sugli angoli, vinile perfetto",
  "stato_catalogo": "Personale",
  "posizione_fisica": "Scaffale A - Sezione Rock",
  "cover": "Img/dark_side.jpg",
  "foto_album": ["Img/dark_side_back.jpg"],
  "tracce": [
    { "pos": "A1", "title": "Speak to Me", "duration": "1:30" },
    { "pos": "A2", "title": "Breathe (In the Air)", "duration": "2:43" }
  ]
}
```

---

## 🌌 Sfondo 3D WebGL (Ray-Marching GLSL)

Lo sfondo è generato in tempo reale mediante **Three.js** con un custom **Fragment Shader GLSL** basato sulla tecnica del **Ray-Marching** (Signed Distance Fields - SDF).

### Principi di Funzionamento

- Per ciascun pixel dello schermo viene tracciato un raggio attraverso la scena procedurale.
- Il loop di Ray-Marching valuta la distanza dai pilastri di luce tridimensionali deformati da onde armoniche nel tempo (`uTime`).
- L'accumulo dei colori calcola il gradiente tra `uTopColor` e `uBottomColor` basandosi sull'altezza della coordinata $y$.

### Parametri Shader Personalizzabili (dalle Impostazioni UI):

- **Iterazioni Shader (`u_iterations`)**: Impostabile da 1 a 50. Determina la precisione geometrica e la profondità dei pilastri di luce.
- **Sfocatura Sfondo (Canvas Blur)**: Applicata dinamicamente come filtro CSS sul canvas WebGL per garantire alte prestazioni senza causare la ricompilazione dello shader.

---

## 🎡 Ruota Titoli 3D Curvilinea

La lista degli album viene presentata tramite un selettore a ruota 3D personalizzato sviluppato in vanilla JS e CSS 3D Transforms:

- **Calcolo Prospettico**: Ogni elemento `.wheel-item` subisce una trasformazione $3\text{D}$ basata sulla sua distanza $d$ dall'indice selezionato:
  $$\text{translateY} = d \times 2.7\text{rem}$$
  $$\text{curveOffset} = -|d|^{1.4} \times 11\text{px}$$
  $$\text{rotateX} = d \times -5.5^\circ$$
- **Modalità di Interazione**:
  - **Scroll del Mouse**: Navigazione fluida e throttled.
  - **Touch Swipe**: Supporto nativo per gesture verticali su smartphone/tablet.
  - **Click Diretto**: Selezione immediata di qualsiasi voce visibile sulla ruota.

---

## 📱 Funzionalità PWA & Cache

La PWA include il supporto offline completo tramite il Service Worker [sw.js](file:///c:/Users/BONO/Downloads/c/sw.js):

1. **Caching Strategico**: Utilizza una strategia **Cache-First** per asset statici (HTML, CSS, JS, immagini locali, Google Fonts) e fallback di rete per le chiamate API esterne.
2. **Installabilità**: Pienamente conforme agli standard W3C Web App Manifest per l'installazione nativa con icona dedicata, splash screen e finestra standalone senza barra del browser.

---

## ⚙️ Configurazione & Personalizzazione

Nel pannello impostazioni dell'app è possibile configurare:

1. **Nitidezza / Iterazioni WebGL**: Regola il numero di passaggi del Ray-Marching per adattarsi a schede grafiche meno potenti o risparmiare batteria.
2. **Blur del Canvas 3D**: Consente di ottenere uno sfondo soffuso "Bokeh" o contorni netti dei pilastri di luce.
3. **Persistenza**: Tutte le preferenze e le modifiche apportate alla collezione vengono salvate automaticamente su `localStorage`.

---

## ➕ Guida all'Aggiunta e Gestione Vinili

### 1. Tramite Interfaccia Utente (Raccomandato)
1. Apri la dock bar in basso e clicca su **"+ Aggiungi Vinile"**.
2. Puoi inserire i dati manualmente oppure utilizzare il pulsante **"Cerca su Discogs"** per autocompilare copertina, traccia, anno ed etichetta.
3. È inoltre disponibile uno **Scanner Barcode QR/EAN** che utilizza la fotocamera del dispositivo per identificare la stampa dal codice a barre presente sulla custodia.

### 2. Tramite File Statico (`database.js`)
Se desideri aggiungere album nel database predefinito in sola lettura, aggiungi un oggetto all'array `DATABASE_VINILI` in [database.js](file:///c:/Users/BONO/Downloads/c/database.js).

---

## 🚀 Installazione & Deployment

L'applicazione è **completamente statica** (Non richiede Node.js, server backend o processi di build).

### Esecuzione Locale

```bash
# 1. Clona il repository
git clone https://github.com/tuo-utente/vinili-3d.git
cd vinili-3d

# 2. Avvia qualsiasi server HTTP statico
# Utilizzando Python:
python -m http.server 8080

# Oppure tramite npx serve:
npx serve .
```

Apri `http://localhost:8080` nel tuo browser.

### Deployment su GitHub Pages / Vercel / Netlify

È sufficiente pubblicare la cartella root del progetto su qualsiasi host statico:
- **GitHub Pages**: Imposta la sorgente su `main` branch e cartella `/ (root)`.
- **Vercel / Netlify**: Nessun comando di build richiesto, directory di output: `./`.

---

## 🛠️ Tecnologie e Dipendenze

- **HTML5 & Vanilla CSS3**: Struttura semantica e styling personalizzato con CSS Custom Properties e Glassmorphism.
- **JavaScript (ES2022)**: Architettura ad oggetti / moduli standard.
- **[Three.js (r161)](https://threejs.org/)**: Caricato tramite CDN jsDelivr per la gestione del rendering WebGL 3D.
- **[Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)**: Font tipografico moderno fornito via Google Fonts.

---

## 📄 Licenza

Questo progetto è distribuito sotto Licenza **MIT**. Libero per uso personale e commerciale.

