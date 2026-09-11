/**
 * Liquid Glass Vinyl Experience — Main Controller (app.js)
 * High-performance, zero-bloat, reactive state and event management.
 */

import { Store } from './store.js';
import { LiquidCarousel } from './liquid-carousel.js';
import { DetailsSheet } from './details-sheet.js';
import { DiscogsEngine } from './discogs-engine.js';

class VinylApp {
  constructor() {
    this.store = null;
    this.carousel = null;
    this.detailsSheet = null;
    this.discogs = new DiscogsEngine();

    this.currentCategory = 'all';
    this.searchQuery = '';
    this.activeRecords = [];
    this.selectedRecord = null;

    this.ambientMesh = document.getElementById('ambientMesh');
    this.scannerModal = document.getElementById('scannerModal');
    this.scannerResult = document.getElementById('scannerResult');
  }

  async init() {
    console.log('[VinylApp] Initializing Liquid Glass Experience...');

    // 1. Initialize Store & Data
    this.store = new Store();
    await this.store.init();

    // 2. Initialize Components
    this.carousel = new LiquidCarousel({
      stageEl: document.getElementById('liquidStage'),
      wheelEl: document.getElementById('recordsWheel'),
      onSelect: (record) => this.handleRecordSelect(record)
    });

    this.detailsSheet = new DetailsSheet({
      containerEl: document.getElementById('detailsSheetContainer'),
      discogsEngine: this.discogs,
      onClose: () => {
        // Optional callback when sheet closes
      }
    });

    // 3. Bind UI Events
    this.bindDockEvents();
    this.bindSearchEvents();
    this.bindScannerEvents();
    this.bindKeyboardShortcuts();

    // 4. Initial Load
    this.applyFilters();
    this.updateDockStats();

    // 5. Register Service Worker for offline PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('[SW] Registration failed:', err);
        });
      });
    }
  }

  /**
   * Filter records based on category and search query
   */
  applyFilters() {
    this.activeRecords = this.store.filter(this.currentCategory, this.searchQuery);
    this.carousel.setRecords(this.activeRecords);

    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      emptyState.style.display = this.activeRecords.length === 0 ? 'flex' : 'none';
    }

    if (this.activeRecords.length > 0) {
      this.handleRecordSelect(this.activeRecords[this.carousel.currentIndex] || this.activeRecords[0]);
    } else {
      this.selectedRecord = null;
      this.detailsSheet.render(null);
    }
  }

  /**
   * Handle record selection from carousel or wheel
   */
  handleRecordSelect(record) {
    if (!record) return;
    this.selectedRecord = record;
    this.detailsSheet.render(record);
    this.extractAndApplyAmbientGlow(record.cover_image || record.cover);
  }

  /**
   * Dynamically extract dominant color from cover art and update ambient mesh
   */
  extractAndApplyAmbientGlow(imgSrc) {
    if (!imgSrc || !this.ambientMesh) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(img, 0, 0, 16, 16);

        const imgData = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imgData.length; i += 16) {
          // Avoid near blacks and near whites for vibrant glowing refraction
          const pr = imgData[i];
          const pg = imgData[i + 1];
          const pb = imgData[i + 2];
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;

          if (brightness > 20 && brightness < 240) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          document.documentElement.style.setProperty('--ambient-glow-rgb', `${r}, ${g}, ${b}`);
        }
      } catch (e) {
        // Fallback default cyan/purple iridescent glow on CORS restrictions
      }
    };
  }

  /**
   * Bind category buttons & quick action buttons in floating glass dock
   */
  bindDockEvents() {
    const dockButtons = document.querySelectorAll('.dock-pill');
    dockButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dockButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category || 'all';
        this.applyFilters();
      });
    });

    const openScannerBtn = document.getElementById('openScannerBtn');
    if (openScannerBtn) {
      openScannerBtn.addEventListener('click', () => {
        this.openScanner();
      });
    }

    const openDetailsBtn = document.getElementById('openDetailsBtn');
    if (openDetailsBtn) {
      openDetailsBtn.addEventListener('click', () => {
        this.detailsSheet.toggleSheet();
      });
    }
  }

  /**
   * Update floating dock counter and total value estimate
   */
  updateDockStats() {
    const stats = this.store.getStats();
    const countEl = document.getElementById('dockTotalCount');
    const valueEl = document.getElementById('dockTotalValue');

    if (countEl) countEl.textContent = stats.total;
    if (valueEl) valueEl.textContent = `€${stats.totalValue.toFixed(0)}`;
  }

  /**
   * Search input with instant fluid filtering
   */
  bindSearchEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        if (searchClear) {
          searchClear.style.display = this.searchQuery ? 'block' : 'none';
        }
        this.applyFilters();
      });
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.applyFilters();
        searchInput.focus();
      });
    }
  }

  /**
   * Barcode & Matrix runout scanner modal
   */
  bindScannerEvents() {
    const closeBtn = document.getElementById('closeScannerModal');
    const manualBarcodeBtn = document.getElementById('manualBarcodeBtn');
    const manualBarcodeVal = document.getElementById('manualBarcodeVal');
    const manualMatrixBtn = document.getElementById('manualMatrixBtn');
    const manualMatrixVal = document.getElementById('manualMatrixVal');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeScanner());
    }

    if (this.scannerModal) {
      this.scannerModal.addEventListener('click', (e) => {
        if (e.target === this.scannerModal) this.closeScanner();
      });
    }

    if (manualBarcodeBtn && manualBarcodeVal) {
      manualBarcodeBtn.addEventListener('click', () => {
        const val = manualBarcodeVal.value.trim();
        if (val) this.processSearchCode('barcode', val);
      });
      manualBarcodeVal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') manualBarcodeBtn.click();
      });
    }

    if (manualMatrixBtn && manualMatrixVal) {
      manualMatrixBtn.addEventListener('click', () => {
        const val = manualMatrixVal.value.trim();
        if (val) this.processSearchCode('matrix', val);
      });
      manualMatrixVal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') manualMatrixBtn.click();
      });
    }
  }

  async openScanner() {
    if (!this.scannerModal) return;
    this.scannerModal.showModal();
    if (this.scannerResult) this.scannerResult.innerHTML = '';

    const videoEl = document.getElementById('scannerVideo');
    if (videoEl && this.discogs.isScannerSupported()) {
      try {
        await this.discogs.startBarcodeScanner(videoEl, (barcode) => {
          this.processSearchCode('barcode', barcode);
          this.discogs.stopBarcodeScanner();
        });
      } catch (err) {
        console.warn('Camera scanner not started:', err);
      }
    }
  }

  closeScanner() {
    this.discogs.stopBarcodeScanner();
    if (this.scannerModal && this.scannerModal.open) {
      this.scannerModal.close();
    }
  }

  async processSearchCode(type, code) {
    if (!this.scannerResult) return;
    this.scannerResult.innerHTML = `<div class="scanner-loading"><div class="spinner"></div> Ricerca Discogs per ${type}: <strong>${code}</strong>...</div>`;

    // 1. Check local collection first
    const localMatch = this.store.findLocalMatch(type, code);
    if (localMatch) {
      const idx = this.activeRecords.findIndex(r => r.id === localMatch.id);
      this.scannerResult.innerHTML = `
        <div class="scanner-found local-found">
          <div class="badge">In Collezione</div>
          <h4>${localMatch.artist} - ${localMatch.title}</h4>
          <p>Valore stimato: €${localMatch.price || localMatch.estimated_value || 'N/D'} (${localMatch.condition || 'VG+'})</p>
          <button class="glass-btn-primary" id="selectFoundRecordBtn">Seleziona Vinile</button>
        </div>
      `;
      document.getElementById('selectFoundRecordBtn')?.addEventListener('click', () => {
        if (idx !== -1) this.carousel.goToIndex(idx);
        this.closeScanner();
      });
      return;
    }

    // 2. Fetch live from Discogs API
    try {
      let results = [];
      if (type === 'barcode') {
        results = await this.discogs.searchByBarcode(code);
      } else {
        results = await this.discogs.searchByMatrix(code);
      }

      if (results && results.length > 0) {
        const item = results[0];
        const valData = await this.discogs.fetchLiveValuation(item.id);
        const medPrice = valData.median || valData.suggested || 25;

        this.scannerResult.innerHTML = `
          <div class="scanner-found discogs-found">
            <div class="badge">Discogs Live</div>
            <h4>${item.title || `${item.artist} - ${item.release_title}`}</h4>
            <p>Formato: ${item.format?.join(', ') || 'Vinyl'} | Anno: ${item.year || 'N/D'}</p>
            <div class="price-pill">Prezzo Mediano Stimato: <strong>€${medPrice.toFixed(2)}</strong></div>
            <p class="matrix-info">ID Discogs: #${item.id} ${item.catno ? `| Cat: ${item.catno}` : ''}</p>
            <a href="${item.uri ? `https://www.discogs.com${item.uri}` : `https://www.discogs.com/release/${item.id}`}" target="_blank" rel="noopener" class="glass-btn-secondary">Apri su Discogs ↗</a>
          </div>
        `;
      } else {
        this.scannerResult.innerHTML = `
          <div class="scanner-empty">
            <p>Nessun vinile trovato su Discogs per <code>${code}</code>.</p>
            <small>Verifica se il codice matrice include spazi o caratteri d'incisione speciali.</small>
          </div>
        `;
      }
    } catch (err) {
      this.scannerResult.innerHTML = `
        <div class="scanner-error">
          <p>Errore durante l'interrogazione Discogs: ${err.message}</p>
        </div>
      `;
    }
  }

  /**
   * Keyboard arrows navigation & Esc to close modals
   */
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.carousel.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.carousel.prev();
      } else if (e.key === 'Escape') {
        if (this.scannerModal && this.scannerModal.open) {
          this.closeScanner();
        } else if (this.detailsSheet.isOpen) {
          this.detailsSheet.toggleSheet();
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.detailsSheet.toggleSheet();
      }
    });
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VinylApp();
  app.init().catch(console.error);
  window.__vinylApp = app;
});
