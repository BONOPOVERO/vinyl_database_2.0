# Vinyl Vault — Liquid Glass Experience 💿✨

Web application ultra-fluida e moderna per la gestione e consultazione della collezione di vinili di Lorenzo Bona, costruita con una raffinata estetica **Liquid Glass**, animazioni tridimensionali a 60–120 FPS e zero dipendenze esterne pesanti.

## 🌟 Caratteristiche Principali

- **Liquid Glass Design System:** Trasparenze ottiche con rifrazione multistrato (`backdrop-filter: blur(28px) saturate(210%)`), bisellature speculari (`inset specular lighting`), bordi prismatici iridescenti e mesh di luce dinamica che campiona i colori dominanti della copertina attiva.
- **Stage 3D & Disco in Vinile Estraibile:**
  - Card gatefold con inclinazione prospettica 3D (tilt reattivo al puntatore).
  - Disco in vinile con solchi concentrici fotorealistici e riflesso prismatico conico (`conic-gradient sheen`).
  - Animazione di estrazione e rotazione fluida con fisica a molla (`cubic-bezier`).
- **Ruota Cilindrica 3D (Wheel):** Navigazione laterale fluida con curvatura prospettica, supporto per scroll continuo e frecce direzionali.
- **Scheda Dettagli Profonda (Expandable Liquid Sheet):**
  - Tracklist completa con numerazione, posizione (Lato A / Lato B) e durata delle tracce.
  - Valutazione economica in tempo reale con moltiplicatore Goldmine (`Mint`, `NM`, `VG+`, `VG`, `G+`, `Poor`).
  - Codice di matrice (Runout Groove) con varianti A/B.
  - Codice a barre (EAN / UPC), etichetta, numero di catalogo, paese, anno di stampa e formato.
  - Galleria fotografica ad alta risoluzione (copertina, retro, etichette interne).
- **Dock a Capsula Fluttuante:**
  - Filtri per categoria istantanei: **Tutti**, **Personale**, **Wishlist**, **Famiglia**.
  - Contatore vinili e stima economica complessiva della collezione.
  - Pulsanti rapidi per aprire lo scanner e la scheda tecnica.
- **Scanner Barcode & Ricerca Matrice:**
  - Supporto per scansione con fotocamera tramite `BarcodeDetector` nativo.
  - Ricerca manuale rapida per barcode e codice matrice (sia nella collezione locale che su Discogs).
- **Architettura Zero-Bloat (Filosofia Ponytail):**
  - Nessun framework pesante, nessun bundle WASM, nessun motore 3D CPU-bound.
  - Memorizzazione nativa con IndexedDB e fallback su memoria locale.
  - PWA offline-ready con Service Worker.
