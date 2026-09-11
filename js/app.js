/**
 * Vinyl Vault — Liquid Glass Experience (app.js)
 * Architecture: Clean Vanilla JS with Liquid Glass FX, iTunes HD Cover Engine,
 * Discogs Wantlist Pricing Trick, and Price History Trends.
 */

import {
  initStore,
  getAllRecords,
  getFilteredRecords,
  getRecordById,
  saveRecord,
  deleteRecord,
  toggleWishlist,
  addPricePoint,
  updateRecordCover,
  getStats
} from './store.js';

import {
  fetchITunesCover,
  executePriceCheckWithWantlistTrick,
  searchDiscogsRelease,
  getDiscogsCredentials,
  setDiscogsCredentials,
  BarcodeScanner
} from './discogs-engine.js';

import { initLiquidGlass } from './liquid-glass-fx.js';

class VinylApp {
  constructor() {
    this.currentView = 'collection'; // 'collection' | 'wishlist' | 'trends'
    this.currentCategory = 'all';    // 'all' | 'personal' | 'family'
    this.searchQuery = '';
    this.sortKey = 'artist';
    this.activeRecords = [];
    this.selectedRecord = null;
    this.scanner = null;
    this.isDiscSpinning = false;

    // Cache DOM
    this.recordsGrid = document.getElementById('recordsGrid');
    this.emptyState = document.getElementById('emptyState');
    this.detailModal = document.getElementById('detailModal');
    this.scannerModal = document.getElementById('scannerModal');
    this.settingsModal = document.getElementById('settingsModal');
    this.trendsContainer = document.getElementById('trendsContainer');
    this.ambientMesh = document.getElementById('ambientMesh');

    // Menù Restringibile
    this.collapsibleMenu = document.getElementById('collapsibleMenu');
    this.toggleMenuBtn = document.getElementById('toggleMenuBtn');
    this.toggleMenuLabel = document.getElementById('toggleMenuLabel');
    this.toggleMenuChevron = document.getElementById('toggleMenuChevron');
    this.isMenuCollapsed = localStorage.getItem('vinyl_vault_menu_collapsed') === 'true';
  }

  async init() {
    console.log('[VinylApp] Avvio Vinyl Vault Liquid Glass 4.0...');

    // 1. Inizializza archivio IndexedDB con storico prezzi e wishlist
    await initStore();

    // 2. Collega eventi dell'interfaccia
    this.bindNavigation();
    this.applyMenuCollapseState();
    this.bindSearchAndSort();
    this.bindScanner();
    this.bindSettings();
    this.bindDetailEvents();
    this.bindKeyboard();

    // 3. Render iniziale
    this.render();
    this.updateStatsUI();

    // 4. Inizializza filtri Liquid Glass FX
    setTimeout(() => initLiquidGlass(), 100);

    // 5. Registra Service Worker se disponibile
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    console.log('[VinylApp] Pronto al 100%.');
  }

  // ==========================================
  // RENDERING CATALOGO & GRIGLIA
  // ==========================================

  render() {
    if (this.currentView === 'trends') {
      this.recordsGrid.style.display = 'none';
      this.emptyState.style.display = 'none';
      this.trendsContainer.style.display = 'block';
      this.renderTrends();
      return;
    }

    this.trendsContainer.style.display = 'none';
    this.recordsGrid.style.display = 'grid';

    // Determina la categoria da filtrare
    const targetCat = this.currentView === 'wishlist' ? 'wishlist' : this.currentCategory;
    this.activeRecords = getFilteredRecords(targetCat, this.searchQuery, this.sortKey);

    if (this.activeRecords.length === 0) {
      this.recordsGrid.innerHTML = '';
      this.emptyState.style.display = 'flex';
      return;
    }

    this.emptyState.style.display = 'none';
    this.recordsGrid.innerHTML = this.activeRecords.map(r => this.renderRecordCard(r)).join('');

    // Ri-applica l'effetto Liquid Glass alle nuove card
    requestAnimationFrame(() => initLiquidGlass(this.recordsGrid));

    // Collega i click sulle card
    this.recordsGrid.querySelectorAll('.record-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-wishlist-toggle')) return;
        const id = card.dataset.id;
        this.openDetail(id);
      });
    });

    // Wishlist quick toggle
    this.recordsGrid.querySelectorAll('.card-wishlist-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const updated = await toggleWishlist(id);
        this.showToast(updated.category === 'wishlist' ? '⭐ Vinile aggiunto alla Wishlist' : '💿 Vinile spostato in Collezione');
        this.render();
        this.updateStatsUI();
      });
    });
  }

  renderRecordCard(r) {
    const cover = r.cover_image || (r.foto_album && r.foto_album[0]) || 'favicon.svg';
    const isWishlist = r.category === 'wishlist';
    const price = parseFloat(r.valore_stimato || 0).toFixed(2);
    const year = r.year ? `<span class="card-year">${r.year}</span>` : '';
    const genre = r.genre ? `<span class="card-tag">${r.genre}</span>` : '';

    return `
      <article class="record-card liquid-glass-card" data-id="${r.id}">
        <div class="card-cover-wrap">
          <img src="${cover}" alt="${this.escapeHtml(r.title)}" class="card-cover-img" loading="lazy" onerror="this.src='favicon.svg'">
          <div class="card-gloss-sheen"></div>
          <button type="button" class="card-wishlist-toggle ${isWishlist ? 'active' : ''}" data-id="${r.id}" title="${isWishlist ? 'Rimuovi da Wishlist' : 'Aggiungi a Wishlist'}">
            ★
          </button>
        </div>
        <div class="card-content">
          <div class="card-meta-tags">
            ${genre}
            ${year}
          </div>
          <h3 class="card-title" title="${this.escapeHtml(r.title)}">${this.escapeHtml(r.title)}</h3>
          <h4 class="card-artist" title="${this.escapeHtml(r.artist)}">${this.escapeHtml(r.artist)}</h4>
          <div class="card-footer">
            <span class="card-price-badge">€ ${price}</span>
            <span class="card-condition-pill">${this.getGradeBadge(r.stato_disco)}</span>
          </div>
        </div>
      </article>
    `;
  }

  getGradeBadge(grade) {
    const g = String(grade);
    if (g === '10') return 'Mint';
    if (g === '9') return 'NM';
    if (g === '8') return 'VG+';
    if (g === '7') return 'VG';
    if (g === '6') return 'G+';
    if (g === '5') return 'G';
    return 'VG+';
  }

  // ==========================================
  // SCHEDA DI DETTAGLIO & ISPEZIONE (MODAL)
  // ==========================================

  openDetail(id) {
    const record = getRecordById(id);
    if (!record) return;
    this.selectedRecord = record;
    this.isDiscSpinning = false;

    this.renderDetailContent(record);
    this.detailModal.showModal();
    this.updateCoverAura(record.cover_image || (record.foto_album && record.foto_album[0]));
    requestAnimationFrame(() => initLiquidGlass(this.detailModal));
  }

  closeDetail() {
    this.detailModal.close();
    this.selectedRecord = null;
    this.resetCoverAura();
  }

  renderDetailContent(r) {
    const cover = r.cover_image || (r.foto_album && r.foto_album[0]) || 'favicon.svg';
    const isWishlist = r.category === 'wishlist';
    const priceHistory = Array.isArray(r.price_history) ? r.price_history : [];

    // Prepara il grafico dei prezzi (SVG sparkline)
    const chartSvg = this.generatePriceHistoryChart(priceHistory);

    // Tracklist
    const tracklistHtml = Array.isArray(r.tracklist) && r.tracklist.length > 0
      ? r.tracklist.map(t => `
          <li class="track-item">
            <span class="track-pos">${t.position || '•'}</span>
            <span class="track-name">${this.escapeHtml(t.title)}</span>
            <span class="track-dur">${t.duration || ''}</span>
          </li>
        `).join('')
      : '<p class="empty-hint">Nessuna tracklist memorizzata.</p>';

    // Identificatori & matrice
    const matrixCode = r.codice_matrice || (r.identifiers && r.identifiers.find(i => (i.type || '').toLowerCase().includes('matrix'))?.value) || 'Non specificato';
    const barcode = r.codice_a_barre || 'Non specificato';

    this.detailModal.innerHTML = `
      <div class="modal-dialog-card liquid-glass-panel">
        <button type="button" class="modal-close-icon" id="closeDetailBtn" aria-label="Chiudi">&times;</button>

        <div class="detail-grid">
          <!-- Colonna Sinistra: 3D Sleeve & Spinning Disc -->
          <div class="detail-artwork-column">
            <div class="vinyl-art-stage ${this.isDiscSpinning ? 'spinning' : ''}" id="detailArtStage" title="Clicca sul vinile per farlo girare!">
              <div class="vinyl-sleeve">
                <img src="${cover}" class="sleeve-img" id="detailCoverImg" alt="${this.escapeHtml(r.title)}" onerror="this.src='favicon.svg'">
                <div class="sleeve-sheen"></div>
              </div>
              <div class="vinyl-disc" id="detailDisc">
                <div class="disc-grooves"></div>
                <div class="disc-label">
                  <span class="disc-label-text">${r.rpm || '33 RPM'}</span>
                </div>
              </div>
            </div>

            <div class="artwork-action-row">
              <button type="button" class="liquid-glass-btn btn-secondary" id="fetchItunesCoverBtn" title="Cerca e sostituisci la copertina con la versione HD da iTunes">
                🎨 Copertina HD (iTunes)
              </button>
              <button type="button" class="liquid-glass-btn btn-secondary ${isWishlist ? 'active-star' : ''}" id="toggleWishlistDetailBtn">
                ${isWishlist ? '★ In Wishlist' : '☆ Sposta in Wishlist'}
              </button>
            </div>
          </div>

          <!-- Colonna Destra: Informazioni, Quotazioni & Trend -->
          <div class="detail-info-column">
            <div class="detail-header-group">
              <div class="detail-category-badge">${r.category ? r.category.toUpperCase() : 'COLLEZIONE'}</div>
              <h1 class="detail-title">${this.escapeHtml(r.title)}</h1>
              <h2 class="detail-artist">${this.escapeHtml(r.artist)}</h2>
              <div class="detail-meta-pills">
                ${r.year ? `<span class="detail-pill">📅 ${r.year}</span>` : ''}
                ${r.genre ? `<span class="detail-pill">🎸 ${r.genre}</span>` : ''}
                ${r.country ? `<span class="detail-pill">🌍 ${r.country}</span>` : ''}
                ${r.label ? `<span class="detail-pill">🏷️ ${r.label}</span>` : ''}
                ${r.catalog_number ? `<span class="detail-pill">#️⃣ ${r.catalog_number}</span>` : ''}
              </div>
            </div>

            <!-- Sezione Prezzo & Trucco Discogs -->
            <div class="detail-price-box liquid-glass-elem">
              <div class="price-header-row">
                <div class="price-main-display">
                  <span class="price-label">Valutazione Attuale</span>
                  <span class="price-amount" id="detailCurrentPrice">€ ${parseFloat(r.valore_stimato || 0).toFixed(2)}</span>
                </div>
                <button type="button" class="liquid-glass-btn btn-accent" id="discogsPriceTrickBtn" title="Inserisce temporaneamente il vinile nella tua Wantlist Discogs, estrae il valore esatto e lo rimuove">
                  ⚡ Verifica con Trucco Discogs
                </button>
              </div>

              <!-- Grafico Storico Prezzi -->
              <div class="price-trend-section">
                <div class="trend-title-row">
                  <span class="trend-title">Storico Prezzi nel Tempo</span>
                  <span class="trend-count">${priceHistory.length} rilevazioni</span>
                </div>
                <div class="trend-chart-wrap">
                  ${chartSvg}
                </div>
                <div class="price-timeline-list">
                  ${priceHistory.slice(-4).reverse().map(p => `
                    <div class="timeline-point">
                      <span class="point-date">${p.date || 'Recente'}</span>
                      <span class="point-note">${p.note || 'Rilevazione'}</span>
                      <span class="point-price">€ ${parseFloat(p.price).toFixed(2)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Specifiche e Condizioni -->
            <div class="detail-specs-grid">
              <div class="spec-card">
                <span class="spec-name">Stato Disco (Media)</span>
                <span class="spec-val">${this.getGradeBadge(r.stato_disco)} (${r.stato_disco || '8'}/10)</span>
              </div>
              <div class="spec-card">
                <span class="spec-name">Stato Copertina</span>
                <span class="spec-val">${this.getGradeBadge(r.stato_copertina)} (${r.stato_copertina || '7'}/10)</span>
              </div>
              <div class="spec-card">
                <span class="spec-name">Codice Matrice</span>
                <span class="spec-val code-font">${this.escapeHtml(matrixCode)}</span>
              </div>
              <div class="spec-card">
                <span class="spec-name">Codice a Barre</span>
                <span class="spec-val code-font">${this.escapeHtml(barcode)}</span>
              </div>
            </div>

            <!-- Tracklist -->
            <div class="detail-tracklist-section">
              <h3 class="tracklist-heading">Elenco Tracce</h3>
              <ul class="tracklist-container">
                ${tracklistHtml}
              </ul>
            </div>

            <!-- Footer Azioni -->
            <div class="detail-footer-actions">
              <button type="button" class="liquid-glass-btn btn-danger" id="deleteRecordBtn">
                🗑️ Elimina Vinile
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindDetailEventsInsideModal(r);
  }

  bindDetailEventsInsideModal(r) {
    const closeBtn = document.getElementById('closeDetailBtn');
    if (closeBtn) closeBtn.onclick = () => this.closeDetail();

    // Rotazione vinile su click dello stage
    const artStage = document.getElementById('detailArtStage');
    if (artStage) {
      artStage.onclick = () => {
        this.isDiscSpinning = !this.isDiscSpinning;
        artStage.classList.toggle('spinning', this.isDiscSpinning);
      };
    }

    // Copertina HD iTunes
    const itunesBtn = document.getElementById('fetchItunesCoverBtn');
    if (itunesBtn) {
      itunesBtn.onclick = async () => {
        itunesBtn.disabled = true;
        itunesBtn.textContent = '⏳ Ricerca iTunes...';
        try {
          const hdCover = await fetchITunesCover(r.artist, r.title);
          if (hdCover) {
            await updateRecordCover(r.id, hdCover);
            const coverImg = document.getElementById('detailCoverImg');
            if (coverImg) coverImg.src = hdCover;
            this.showToast('✨ Copertina HD recuperata con successo da Apple iTunes!');
            this.render();
            this.updateCoverAura(hdCover);
          } else {
            this.showToast('⚠️ Nessuna copertina trovata su iTunes per questo titolo.');
          }
        } catch (err) {
          this.showToast('❌ Errore durante la chiamata ad Apple iTunes.');
        } finally {
          itunesBtn.disabled = false;
          itunesBtn.textContent = '🎨 Copertina HD (iTunes)';
        }
      };
    }

    // Toggle Wishlist da dettaglio
    const wishlistBtn = document.getElementById('toggleWishlistDetailBtn');
    if (wishlistBtn) {
      wishlistBtn.onclick = async () => {
        const updated = await toggleWishlist(r.id);
        this.showToast(updated.category === 'wishlist' ? '⭐ Spostato in Wishlist' : '💿 Spostato in Collezione');
        this.renderDetailContent(updated);
        this.render();
        this.updateStatsUI();
      };
    }

    // Trucco Discogs Wantlist
    const discogsBtn = document.getElementById('discogsPriceTrickBtn');
    if (discogsBtn) {
      discogsBtn.onclick = async () => {
        discogsBtn.disabled = true;
        discogsBtn.textContent = '⏳ Esecuzione trucco Wantlist...';

        try {
          const res = await executePriceCheckWithWantlistTrick({
            releaseId: r.id,
            discoGrade: r.stato_disco,
            coverGrade: r.stato_copertina,
            barcode: r.codice_a_barre,
            matrix: r.codice_matrice
          });

          // Aggiungi il nuovo punto allo storico
          const noteText = res.usedWantlistTrick ? 'Trucco Wantlist Discogs' : 'Stima Mercato Discogs';
          const updated = await addPricePoint(r.id, {
            price: res.estimatedPrice,
            condition: this.getGradeBadge(r.stato_disco),
            note: noteText
          });

          this.showToast(`✅ Prezzo aggiornato: € ${res.estimatedPrice} (${noteText})`);
          this.renderDetailContent(updated);
          this.render();
          this.updateStatsUI();
        } catch (err) {
          console.error(err);
          this.showToast(`❌ Verifica fallita: ${err.message}`);
        } finally {
          discogsBtn.disabled = false;
          discogsBtn.textContent = '⚡ Verifica con Trucco Discogs';
        }
      };
    }

    // Elimina
    const deleteBtn = document.getElementById('deleteRecordBtn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm(`Sei sicuro di voler rimuovere "${r.title}" dal catalogo?`)) {
          await deleteRecord(r.id);
          this.showToast('🗑️ Vinile rimosso con successo.');
          this.closeDetail();
          this.render();
          this.updateStatsUI();
        }
      };
    }
  }

  // ==========================================
  // GRAFICO STORICO PREZZI (SVG SPARKLINE)
  // ==========================================

  generatePriceHistoryChart(history) {
    if (!history || history.length === 0) {
      return '<div class="chart-empty">Nessun punto storico registrato</div>';
    }

    const points = history.map(h => parseFloat(h.price) || 0);
    const minVal = Math.min(...points);
    const maxVal = Math.max(...points);
    const range = (maxVal - minVal) || 1;

    const width = 450;
    const height = 110;
    const padding = 15;

    const coords = points.map((val, idx) => {
      const x = padding + (idx / Math.max(1, points.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
      return { x, y, val, date: history[idx].date || '' };
    });

    const pathD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

    return `
      <svg viewBox="0 0 ${width} ${height}" class="price-sparkline" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#chartGrad)" />
        <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${coords.map(pt => `
          <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.5" fill="#0369a1" stroke="#38bdf8" stroke-width="2">
            <title>${pt.date}: € ${pt.val.toFixed(2)}</title>
          </circle>
        `).join('')}
      </svg>
    `;
  }

  // ==========================================
  // DASHBOARD TREND & STATISTICHE
  // ==========================================

  renderTrends() {
    const stats = getStats();
    const records = getAllRecords();

    // Raggruppamento per genere
    const genreCounts = {};
    records.forEach(r => {
      const g = r.genre || 'Altro';
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });

    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    this.trendsContainer.innerHTML = `
      <div class="trends-dashboard">
        <div class="trends-hero-card liquid-glass-panel">
          <div class="hero-stat-block">
            <span class="hero-label">Valore Stimato Collezione</span>
            <span class="hero-value">€ ${stats.totalValue.toLocaleString('it-IT')}</span>
            <span class="hero-sub">${stats.collectionCount} vinili custoditi</span>
          </div>
          <div class="hero-stat-block">
            <span class="hero-label">Budget Desiderato (Wishlist)</span>
            <span class="hero-value">€ ${stats.wishlistValue.toLocaleString('it-IT')}</span>
            <span class="hero-sub">${stats.wishlistCount} vinili in cerca</span>
          </div>
        </div>

        <div class="trends-two-col">
          <!-- Top Valued Records -->
          <div class="trends-card liquid-glass-panel">
            <h3 class="panel-heading">💎 Vinili Più Preziosi</h3>
            <div class="top-records-list">
              ${stats.topValued.map((r, idx) => `
                <div class="top-record-item" data-id="${r.id}">
                  <span class="top-rank">#${idx + 1}</span>
                  <img src="${r.cover_image || 'favicon.svg'}" class="top-thumb" alt="${r.title}">
                  <div class="top-info">
                    <span class="top-title">${this.escapeHtml(r.title)}</span>
                    <span class="top-artist">${this.escapeHtml(r.artist)}</span>
                  </div>
                  <span class="top-price">€ ${parseFloat(r.valore_stimato || 0).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Genere & Distribuzione -->
          <div class="trends-card liquid-glass-panel">
            <h3 class="panel-heading">🎸 Generi Principali</h3>
            <div class="genre-bars">
              ${sortedGenres.map(([genre, count]) => {
                const pct = Math.round((count / records.length) * 100);
                return `
                  <div class="genre-bar-row">
                    <div class="genre-meta">
                      <span>${genre}</span>
                      <span>${count} (${pct}%)</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Click sui top records per aprirli
    this.trendsContainer.querySelectorAll('.top-record-item').forEach(item => {
      item.onclick = () => this.openDetail(item.dataset.id);
    });

    requestAnimationFrame(() => initLiquidGlass(this.trendsContainer));
  }

  // ==========================================
  // EVENT BINDINGS & CONTROLLI
  // ==========================================

  bindNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        this.currentView = view;

        // Mostra o nascondi filtri categoria secondari
        const catDock = document.getElementById('categoryDock');
        if (catDock) {
          catDock.style.display = view === 'collection' ? 'flex' : 'none';
        }

        this.render();
      });
    });

    // Tasto Restringi / Espandi Menù
    if (this.toggleMenuBtn) {
      this.toggleMenuBtn.addEventListener('click', () => {
        this.isMenuCollapsed = !this.isMenuCollapsed;
        localStorage.setItem('vinyl_vault_menu_collapsed', String(this.isMenuCollapsed));
        this.applyMenuCollapseState();
        setTimeout(() => initLiquidGlass(), 120);
      });
    }

    // Filtri pillole categoria ("Tutti", "Personale", "Famiglia")
    const catPills = document.querySelectorAll('.category-pill');
    catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentCategory = pill.dataset.category;
        this.render();
      });
    });
  }

  applyMenuCollapseState() {
    if (this.collapsibleMenu) {
      this.collapsibleMenu.classList.toggle('collapsed', this.isMenuCollapsed);
    }
    if (this.toggleMenuLabel) {
      this.toggleMenuLabel.textContent = this.isMenuCollapsed ? 'Filtri' : 'Chiudi';
    }
    if (this.toggleMenuChevron) {
      this.toggleMenuChevron.textContent = this.isMenuCollapsed ? '▾' : '▴';
    }
    if (this.toggleMenuBtn) {
      this.toggleMenuBtn.classList.toggle('is-active', !this.isMenuCollapsed);
    }
  }

  bindSearchAndSort() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const sortSelect = document.getElementById('sortSelect');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (searchClear) searchClear.style.display = this.searchQuery ? 'block' : 'none';
        this.render();
      });
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        searchClear.style.display = 'none';
        this.render();
        searchInput.focus();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortKey = e.target.value;
        this.render();
      });
    }
  }

  bindScanner() {
    const openScannerBtn = document.getElementById('openScannerBtn');
    const closeScannerBtn = document.getElementById('closeScannerModal');
    const videoEl = document.getElementById('scannerVideo');
    const manualBarcodeBtn = document.getElementById('manualBarcodeBtn');
    const manualBarcodeVal = document.getElementById('manualBarcodeVal');
    const manualMatrixBtn = document.getElementById('manualMatrixBtn');
    const manualMatrixVal = document.getElementById('manualMatrixVal');
    const scannerResult = document.getElementById('scannerResult');

    if (openScannerBtn && this.scannerModal) {
      openScannerBtn.addEventListener('click', () => {
        this.scannerModal.showModal();
        requestAnimationFrame(() => initLiquidGlass(this.scannerModal));

        if (videoEl && !this.scanner) {
          this.scanner = new BarcodeScanner(
            videoEl,
            (barcode) => this.handleBarcodeDetected(barcode),
            (err) => console.warn('[Scanner] Camera error:', err)
          );
          this.scanner.start();
        }
      });
    }

    if (closeScannerBtn && this.scannerModal) {
      closeScannerBtn.addEventListener('click', () => {
        if (this.scanner) {
          this.scanner.stop();
          this.scanner = null;
        }
        this.scannerModal.close();
      });
    }

    // Ricerca manuale Barcode
    if (manualBarcodeBtn && manualBarcodeVal) {
      manualBarcodeBtn.addEventListener('click', async () => {
        const val = manualBarcodeVal.value.trim();
        if (!val) return;
        manualBarcodeBtn.disabled = true;
        manualBarcodeBtn.textContent = 'Ricerca...';
        await this.handleBarcodeDetected(val);
        manualBarcodeBtn.disabled = false;
        manualBarcodeBtn.textContent = 'Cerca Barcode';
      });
    }

    // Ricerca manuale Matrice
    if (manualMatrixBtn && manualMatrixVal) {
      manualMatrixBtn.addEventListener('click', async () => {
        const val = manualMatrixVal.value.trim();
        if (!val) return;
        manualMatrixBtn.disabled = true;
        manualMatrixBtn.textContent = 'Ricerca...';
        await this.handleMatrixSearch(val);
        manualMatrixBtn.disabled = false;
        manualMatrixBtn.textContent = 'Cerca Matrice';
      });
    }
  }

  async handleBarcodeDetected(barcode) {
    const scannerResult = document.getElementById('scannerResult');
    if (scannerResult) {
      scannerResult.innerHTML = `<div class="scanner-loading">🔍 Ricerca Discogs & iTunes per Barcode: <b>${barcode}</b>...</div>`;
    }

    try {
      const discogsData = await searchDiscogsRelease({ barcode });
      if (discogsData.found) {
        this.renderNewRecordPreview(discogsData);
      } else {
        if (scannerResult) {
          scannerResult.innerHTML = `<div class="scanner-error">❌ Nessuna release trovata su Discogs per ${barcode}.</div>`;
        }
      }
    } catch (err) {
      if (scannerResult) {
        scannerResult.innerHTML = `<div class="scanner-error">⚠️ Errore ricerca: ${err.message}</div>`;
      }
    }
  }

  async handleMatrixSearch(matrix) {
    const scannerResult = document.getElementById('scannerResult');
    if (scannerResult) {
      scannerResult.innerHTML = `<div class="scanner-loading">🔍 Ricerca matrice Runout: <b>${matrix}</b>...</div>`;
    }

    try {
      const discogsData = await searchDiscogsRelease({ matrix });
      if (discogsData.found) {
        this.renderNewRecordPreview(discogsData);
      } else {
        if (scannerResult) {
          scannerResult.innerHTML = `<div class="scanner-error">❌ Nessuna release trovata su Discogs per questa matrice.</div>`;
        }
      }
    } catch (err) {
      if (scannerResult) {
        scannerResult.innerHTML = `<div class="scanner-error">⚠️ Errore ricerca: ${err.message}</div>`;
      }
    }
  }

  async renderNewRecordPreview(data) {
    const scannerResult = document.getElementById('scannerResult');
    if (!scannerResult) return;

    // Prova a prendere la copertina in HD da iTunes
    let hdCover = data.thumb;
    try {
      const itunesArt = await fetchITunesCover(data.title.split('-')[0] || '', data.title.split('-')[1] || data.title);
      if (itunesArt) hdCover = itunesArt;
    } catch (e) {}

    scannerResult.innerHTML = `
      <div class="new-record-preview liquid-glass-elem">
        <img src="${hdCover || 'favicon.svg'}" class="preview-thumb" alt="${this.escapeHtml(data.title)}">
        <div class="preview-info">
          <h4>${this.escapeHtml(data.title)}</h4>
          <p>${data.year || 'Anno N.D.'} • ${data.country || ''} • ${data.label || ''}</p>
        </div>
        <button type="button" class="liquid-glass-btn btn-primary" id="confirmAddRecordBtn">
          ➕ Aggiungi al Vault
        </button>
      </div>
    `;

    const confirmBtn = document.getElementById('confirmAddRecordBtn');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const parts = data.title.split(' - ');
        const artist = parts.length > 1 ? parts[0].trim() : 'Artista';
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : data.title;

        const newRec = {
          id: String(data.releaseId || Date.now()),
          title: title,
          artist: artist,
          year: data.year || '',
          country: data.country || '',
          label: data.label || '',
          catalog_number: data.catno || '',
          genre: data.genre ? (Array.isArray(data.genre) ? data.genre[0] : data.genre) : 'Rock',
          category: this.currentView === 'wishlist' ? 'wishlist' : 'personal',
          stato_disco: '8',
          stato_copertina: '7',
          valore_stimato: 25,
          cover_image: hdCover || '',
          codice_a_barre: data.barcode || '',
          price_history: [
            {
              date: new Date().toISOString().slice(0, 10),
              price: 25,
              condition: 'VG+',
              note: 'Aggiunta iniziale'
            }
          ]
        };

        await saveRecord(newRec);
        this.showToast('✅ Vinile aggiunto con successo!');
        if (this.scannerModal) this.scannerModal.close();
        if (this.scanner) {
          this.scanner.stop();
          this.scanner = null;
        }
        this.render();
        this.updateStatsUI();
        this.openDetail(newRec.id);
      };
    }
  }

  bindSettings() {
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsModal');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const tokenInput = document.getElementById('discogsTokenInput');
    const usernameInput = document.getElementById('discogsUsernameInput');

    if (openSettingsBtn && this.settingsModal) {
      openSettingsBtn.addEventListener('click', () => {
        const { token, username } = getDiscogsCredentials();
        if (tokenInput) tokenInput.value = token;
        if (usernameInput) usernameInput.value = username;
        this.settingsModal.showModal();
        requestAnimationFrame(() => initLiquidGlass(this.settingsModal));
      });
    }

    if (closeSettingsBtn && this.settingsModal) {
      closeSettingsBtn.addEventListener('click', () => {
        this.settingsModal.close();
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        const token = tokenInput ? tokenInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : '';
        setDiscogsCredentials({ token, username });
        this.showToast('💾 Credenziali Discogs salvate con successo!');
        this.settingsModal.close();
      });
    }
  }

  bindDetailEvents() {
    if (this.detailModal) {
      this.detailModal.addEventListener('cancel', () => {
        this.selectedRecord = null;
        this.resetCoverAura();
      });
    }
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.detailModal && this.detailModal.open) this.closeDetail();
        if (this.scannerModal && this.scannerModal.open) this.scannerModal.close();
        if (this.settingsModal && this.settingsModal.open) this.settingsModal.close();
      }
    });
  }

  updateStatsUI() {
    const stats = getStats();
    const countEl = document.getElementById('dockTotalCount');
    const valEl = document.getElementById('dockTotalValue');
    if (countEl) countEl.textContent = stats.collectionCount;
    if (valEl) valEl.textContent = `€ ${stats.totalValue.toLocaleString('it-IT')}`;
  }

  updateCoverAura(coverUrl) {
    if (!this.ambientMesh) return;
    if (!coverUrl) return;

    // Crea un colore dinamico dallo sfondo
    const orb = this.ambientMesh.querySelector('.orb-primary');
    if (orb) {
      orb.style.opacity = '0.45';
      orb.style.transform = 'scale(1.2)';
    }
  }

  resetCoverAura() {
    if (!this.ambientMesh) return;
    const orb = this.ambientMesh.querySelector('.orb-primary');
    if (orb) {
      orb.style.opacity = '0.25';
      orb.style.transform = 'scale(1.0)';
    }
  }

  showToast(message) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast liquid-glass-elem';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('visible');
    initLiquidGlass(toast);

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3200);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Inizializza l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  const app = new VinylApp();
  app.init();
});
