/**
 * Vinyl Vault — Liquid Glass Experience (app.js)
 * Master Controller orchestrating Store, 3D Carousel Stage, Discogs Engine, and Scanner.
 */

import { initStore, getAllRecords, getFilteredRecords, saveRecord, deleteRecord, getStats } from './store.js';
import { LiquidCarousel } from './liquid-carousel.js';
import { searchDiscogsPrice, BarcodeScanner } from './discogs-engine.js';

class VinylApp {
  constructor() {
    this.carousel = null;
    this.scanner = null;
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.activeRecords = [];
    this.currentRecord = null;

    // DOM Elements
    this.stageWrapper = document.getElementById('liquid-stage-wrapper');
    this.wheelContainer = document.getElementById('option-wheel');
    this.ambientMesh = document.getElementById('ambientMesh');
    this.scannerModal = document.getElementById('scannerModal');
    this.scannerVideo = document.getElementById('scannerVideo');
    this.scannerResult = document.getElementById('scannerResult');
  }

  async init() {
    console.log('[VinylApp] Inizializzazione Liquid Glass Experience...');

    // 1. Inizializza archivio IndexedDB con i 97 vinili arricchiti
    await initStore();

    // 2. Inizializza Selettore 3D e Palcoscenico
    this.carousel = new LiquidCarousel({
      wheelContainer: this.wheelContainer,
      stageContainer: this.stageWrapper,
      onSelectRecord: (record) => this.onRecordSelected(record),
      onAction: (action, payload) => this.handleAction(action, payload)
    });

    // 3. Collega eventi dell'interfaccia (Dock, Ricerca, Scanner, Tastiera)
    this.bindDock();
    this.bindSearch();
    this.bindScanner();
    this.bindShortcuts();

    // 4. Carica catalogo iniziale
    this.refreshCatalog();
    this.updateStats();

    // 5. Registra Service Worker offline
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    console.log('[VinylApp] Sistema pronto al 100%.');
  }

  /**
   * Aggiorna la lista dei vinili in base a categoria e ricerca
   */
  refreshCatalog() {
    this.activeRecords = getFilteredRecords(this.currentCategory, this.searchQuery);
    this.carousel.setRecords(this.activeRecords);

    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
      emptyState.style.display = this.activeRecords.length === 0 ? 'flex' : 'none';
    }

    this.updateStats();
  }

  /**
   * Callback quando un vinile viene selezionato
   */
  onRecordSelected(record) {
    this.currentRecord = record;
    if (!record) return;

    // Estrazione colore dominante dalla copertina per illuminare lo sfondo in modo adattivo
    this.updateCoverAura(record.cover_image || (record.foto_album && record.foto_album[0]));
  }

  /**
   * Gestione azioni utente dal palcoscenico (aggiorna prezzo, cambia categoria, elimina)
   */
  async handleAction(action, payload) {
    if (action === 'refresh_price') {
      const record = payload;
      const priceValEl = document.getElementById('stage-price-val');
      const refreshBtn = document.getElementById('stage-refresh-price-btn');
      if (priceValEl) priceValEl.textContent = 'Verifica in corso...';
      if (refreshBtn) refreshBtn.disabled = true;

      try {
        const res = await searchDiscogsPrice({
          barcode: record.codice_a_barre,
          matrix: record.codice_matrice,
          discoGrade: record.stato_disco,
          coverGrade: record.stato_copertina
        });

        if (res.found && res.estimatedValue > 0) {
          record.valore_stimato = res.estimatedValue;
          record.discogs_release_id = res.releaseId;
          await saveRecord(record);
          this.carousel.renderStage();
          this.updateStats();
        } else {
          if (priceValEl) priceValEl.textContent = 'Nessun riscontro Discogs';
        }
      } catch (err) {
        if (priceValEl) priceValEl.textContent = 'Errore verifica Discogs';
        console.warn('Errore Discogs:', err);
      } finally {
        if (refreshBtn) refreshBtn.disabled = false;
      }

    } else if (action === 'change_category') {
      const { record, newCat } = payload;
      record.category = newCat;
      await saveRecord(record);
      this.refreshCatalog();

    } else if (action === 'delete_record') {
      const record = payload;
      await deleteRecord(record.id);
      this.refreshCatalog();
    }
  }

  /**
   * Aggiorna le statistiche e stima economica nel Dock Fluttuante
   */
  updateStats() {
    const stats = getStats(this.currentCategory);
    const countEl = document.getElementById('dockTotalCount');
    const valueEl = document.getElementById('dockTotalValue');

    if (countEl) countEl.textContent = stats.total;
    if (valueEl) valueEl.textContent = `€ ${stats.totalValue.toFixed(0)}`;
  }

  /**
   * Estrazione cromatica fluida dalla copertina attiva
   */
  updateCoverAura(imgUrl) {
    if (!imgUrl || imgUrl.startsWith('data:image/svg')) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (brightness > 25 && brightness < 235) {
            r += pr; g += pg; b += pb; count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          document.documentElement.style.setProperty('--ambient-glow-rgb', `${r}, ${g}, ${b}`);
        }
      } catch (e) {
        // Fallback su gradiente in caso di restrizioni CORS
      }
    };
  }

  /**
   * Eventi Dock a Capsula
   */
  bindDock() {
    const dockButtons = document.querySelectorAll('.dock-pill');
    dockButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dockButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category || 'all';
        this.refreshCatalog();
      });
    });

    const openScannerBtn = document.getElementById('openScannerBtn');
    if (openScannerBtn) {
      openScannerBtn.addEventListener('click', () => this.openScannerModal());
    }

    const dockScannerBtn = document.getElementById('dockScannerBtn');
    if (dockScannerBtn) {
      dockScannerBtn.addEventListener('click', () => this.openScannerModal());
    }
  }

  /**
   * Barra di ricerca live
   */
  bindSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClear');

    if (input) {
      input.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        if (clearBtn) clearBtn.style.display = this.searchQuery ? 'block' : 'none';
        this.refreshCatalog();
      });
    }

    if (clearBtn && input) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.searchQuery = '';
        clearBtn.style.display = 'none';
        this.refreshCatalog();
        input.focus();
      });
    }
  }

  /**
   * Scanner & Ricerca Matrice
   */
  bindScanner() {
    const closeBtn = document.getElementById('closeScannerModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeScannerModal());
    }

    if (this.scannerModal) {
      this.scannerModal.addEventListener('click', (e) => {
        if (e.target === this.scannerModal) this.closeScannerModal();
      });
    }

    const manualBarcodeBtn = document.getElementById('manualBarcodeBtn');
    const manualBarcodeVal = document.getElementById('manualBarcodeVal');
    if (manualBarcodeBtn && manualBarcodeVal) {
      manualBarcodeBtn.addEventListener('click', () => {
        const val = manualBarcodeVal.value.trim();
        if (val) this.processCodeSearch('barcode', val);
      });
      manualBarcodeVal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') manualBarcodeBtn.click();
      });
    }

    const manualMatrixBtn = document.getElementById('manualMatrixBtn');
    const manualMatrixVal = document.getElementById('manualMatrixVal');
    if (manualMatrixBtn && manualMatrixVal) {
      manualMatrixBtn.addEventListener('click', () => {
        const val = manualMatrixVal.value.trim();
        if (val) this.processCodeSearch('matrix', val);
      });
      manualMatrixVal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') manualMatrixBtn.click();
      });
    }
  }

  async openScannerModal() {
    if (!this.scannerModal) return;
    this.scannerModal.showModal();
    if (this.scannerResult) this.scannerResult.innerHTML = '';

    if (this.scannerVideo) {
      this.scanner = new BarcodeScanner(
        this.scannerVideo,
        (detectedBarcode) => {
          this.processCodeSearch('barcode', detectedBarcode);
        },
        (err) => {
          console.warn('Camera non disponibile o permesso negato:', err);
        }
      );
      this.scanner.start();
    }
  }

  closeScannerModal() {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner = null;
    }
    if (this.scannerModal && this.scannerModal.open) {
      this.scannerModal.close();
    }
  }

  async processCodeSearch(type, code) {
    if (!this.scannerResult) return;
    this.scannerResult.innerHTML = `
      <div class="scanner-status">
        <div class="spinner"></div> Ricerca per ${type}: <strong>${code}</strong>...
      </div>
    `;

    // 1. Controlla prima nella collezione locale
    const all = getAllRecords();
    const cleanCode = code.toLowerCase().trim();
    const localMatch = all.find(r => {
      if (type === 'barcode') {
        return (r.codice_a_barre || '').toLowerCase().trim() === cleanCode;
      } else {
        const matrixStr = (r.codice_matrice || '').toLowerCase();
        const hasIdent = (r.identifiers || []).some(id => (id.value || '').toLowerCase().includes(cleanCode));
        return matrixStr.includes(cleanCode) || hasIdent;
      }
    });

    if (localMatch) {
      this.scannerResult.innerHTML = `
        <div class="scanner-match-card local">
          <span class="match-badge">Trovato in Collezione</span>
          <h4>${localMatch.title}</h4>
          <p>${localMatch.artist} • Categoria: ${localMatch.category}</p>
          <div class="match-price">Valore Stimato: € ${parseFloat(localMatch.valore_stimato || 0).toFixed(2)}</div>
          <button type="button" class="liquid-btn-sm" id="goto-matched-record-btn">Visualizza Vinile</button>
        </div>
      `;

      document.getElementById('goto-matched-record-btn')?.addEventListener('click', () => {
        const idx = this.activeRecords.findIndex(r => r.id === localMatch.id);
        if (idx !== -1) {
          this.carousel.selectIndex(idx);
        } else {
          this.currentCategory = 'all';
          this.searchQuery = '';
          document.querySelectorAll('.dock-pill').forEach(b => b.classList.toggle('active', b.dataset.category === 'all'));
          this.refreshCatalog();
          const newIdx = this.activeRecords.findIndex(r => r.id === localMatch.id);
          if (newIdx !== -1) this.carousel.selectIndex(newIdx);
        }
        this.closeScannerModal();
      });
      return;
    }

    // 2. Interroga Discogs Live
    try {
      const res = await searchDiscogsPrice(type === 'barcode' ? { barcode: code } : { matrix: code });
      if (res.found) {
        this.scannerResult.innerHTML = `
          <div class="scanner-match-card discogs">
            <span class="match-badge discogs-badge">Discogs Live</span>
            <h4>${res.title}</h4>
            <p>${res.year || ''} • ${res.country || ''}</p>
            <div class="match-price">Prezzo Minimo: € ${res.lowestPrice ? res.lowestPrice.toFixed(2) : 'N/D'} | Stima Copia: € ${res.estimatedValue.toFixed(2)}</div>
            <a href="${res.discogsUrl}" target="_blank" rel="noopener" class="discogs-link-btn">Apri su Discogs ↗</a>
          </div>
        `;
      } else {
        this.scannerResult.innerHTML = `
          <div class="scanner-empty-box">
            <p>Nessun vinile trovato per <code>${code}</code>.</p>
          </div>
        `;
      }
    } catch (err) {
      this.scannerResult.innerHTML = `
        <div class="scanner-error-box">
          <p>Errore durante la ricerca Discogs: ${err.message}</p>
        </div>
      `;
    }
  }

  /**
   * Scorciatoie da tastiera
   */
  bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'Escape') {
        if (this.scannerModal && this.scannerModal.open) {
          this.closeScannerModal();
        }
      }
    });
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new VinylApp();
  app.init().catch(console.error);
  window.__vinylApp = app;
});
