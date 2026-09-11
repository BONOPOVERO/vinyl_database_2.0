// js/liquid-carousel.js - Selettore 3D a Ruota Cilindrica & Palcoscenico Liquid Glass Completo

const GOLDMINE_MAP = {
  '10': 'Mint (M)',
  '9': 'Near Mint (NM)',
  '8': 'Very Good Plus (VG+)',
  '7': 'Very Good (VG)',
  '6': 'Good Plus (G+)',
  '5': 'Good (G)',
  '4': 'Fair (F)',
  '3': 'Poor (P)'
};

export class LiquidCarousel {
  constructor({ wheelContainer, stageContainer, onSelectRecord, onAction }) {
    this.wheelContainer = wheelContainer;
    this.stageContainer = stageContainer;
    this.onSelect = onSelectRecord;
    this.onAction = onAction;
    this.records = [];
    this.selectedIndex = 0;
    this.lastWheelTime = 0;
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.isPlaying = false;

    this.initEvents();
  }

  setRecords(records) {
    this.records = records || [];
    this.selectedIndex = 0;
    this.renderWheel();
    this.renderStage();
    if (this.records.length > 0) {
      this.onSelect(this.records[0]);
    } else {
      this.onSelect(null);
    }
  }

  renderStage() {
    if (!this.stageContainer) return;
    const record = this.records[this.selectedIndex];

    if (!record) {
      this.stageContainer.innerHTML = `
        <div class="liquid-stage-card empty-card">
          <div class="empty-icon">💿</div>
          <h3>Nessun vinile trovato</h3>
          <p>Prova a modificare i filtri di ricerca o la categoria.</p>
        </div>
      `;
      return;
    }

    const cover = record.cover_image || (record.foto_album && record.foto_album[0]) || 'favicon.svg';
    const discoRating = GOLDMINE_MAP[String(record.stato_disco)] || (record.stato_disco ? `Grado ${record.stato_disco}` : 'VG+');
    const coverRating = GOLDMINE_MAP[String(record.stato_copertina)] || (record.stato_copertina ? `Grado ${record.stato_copertina}` : 'VG');

    const tracklist = record.tracklist || [];
    const identifiers = record.identifiers || [];
    const matrixItems = identifiers.filter(i => (i.type || '').toLowerCase().includes('matrix') || (i.type || '').toLowerCase().includes('runout'));
    const photos = Array.isArray(record.foto_album) && record.foto_album.length > 0 ? record.foto_album : [];

    this.stageContainer.innerHTML = `
      <div class="liquid-stage-card" id="liquid-stage-card">
        
        <!-- Specular Highlight Top Surface -->
        <div class="glass-specular-sheen"></div>
        <div class="liquid-cover-aura" id="cover-aura"></div>

        <!-- 3D Vinyl Sleeve & Interactive Disc Assembly -->
        <div class="stage-top-section">
          
          <button type="button" class="stage-nav-arrow arrow-prev" id="stage-prev-btn" title="Vinile Precedente">‹</button>

          <div class="liquid-art-assembly ${this.isPlaying ? 'playing' : ''}" id="art-assembly" title="Clicca il vinile per estrarlo e farlo ruotare!">
            <div class="liquid-sleeve-wrap">
              <img src="${cover}" class="liquid-sleeve-art" id="stage-cover-img" alt="${record.title}" onerror="this.src='favicon.svg'">
              <div class="sleeve-glass-gloss"></div>
            </div>
            <div class="liquid-vinyl-disc ${this.isPlaying ? 'playing' : ''}" id="stage-disc">
              <div class="vinyl-groove-rings"></div>
              <div class="vinyl-center-label"></div>
            </div>
            <div class="liquid-floor-shadow"></div>
          </div>

          <button type="button" class="stage-nav-arrow arrow-next" id="stage-next-btn" title="Vinile Successivo">›</button>

        </div>

        <!-- Info Titolo & Artista Primari -->
        <div class="liquid-stage-info">
          <span class="liquid-play-hint">🎵 Clicca il vinile per estrarlo</span>
          <h1 class="liquid-stage-title">${record.title}</h1>
          <h2 class="liquid-stage-artist">${record.artist}</h2>
          
          <div class="liquid-meta-row">
            <span class="liquid-tag tag-category cat-${record.category || 'personal'}">${(record.category || 'personal').toUpperCase()}</span>
            <span class="liquid-tag tag-genre">${record.genre || 'Rock'}</span>
            <span class="liquid-tag tag-year">${record.year || '—'}</span>
            <span class="liquid-tag tag-price">€ ${(parseFloat(record.valore_stimato) || 0).toFixed(2)}</span>
          </div>
        </div>

        <!-- SEZIONE DETTAGLI PROFONDI SCORREVOLI -->
        <div class="stage-scrollable-details">
          
          <!-- Card Valutazione Discogs Live -->
          <div class="liquid-sub-card price-highlight-card">
            <div class="sub-card-header">
              <span class="card-caption">💰 Valutazione Mercato Discogs</span>
              <button type="button" id="stage-refresh-price-btn" class="liquid-pill-action">🔄 Verifica Live</button>
            </div>
            <div class="price-big" id="stage-price-val">
              € ${(parseFloat(record.valore_stimato) || 0).toFixed(2)}
            </div>
            <div class="card-hint">Stima ponderata in base alle condizioni Goldmine della tua copia</div>
          </div>

          <!-- Tracce / Songs Menu -->
          ${tracklist.length > 0 ? `
            <div class="liquid-sub-card">
              <div class="sub-card-title">🎵 Canzoni & Tracklist (${tracklist.length} Brani)</div>
              <div class="tracklist-container">
                ${tracklist.map(t => `
                  <div class="track-row">
                    <span class="track-pos">${t.position || t.pos || '•'}</span>
                    <span class="track-name">${t.title}</span>
                    <span class="track-dur">${t.duration || ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Specifiche di Stampa -->
          <div class="liquid-sub-card">
            <div class="sub-card-title">⚙️ Specifiche di Stampa</div>
            <div class="specs-grid">
              <div class="spec-tile">
                <span class="tile-label">Etichetta</span>
                <span class="tile-value">${record.label || '—'}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">N° Catalogo</span>
                <span class="tile-value">${record.catalog_number || '—'}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">Paese</span>
                <span class="tile-value">${record.country || '—'}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">Formato</span>
                <span class="tile-value">${record.format || '12" LP'}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">Velocità</span>
                <span class="tile-value">${record.rpm || '33 ⅓ RPM'}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">Anno Prima Stampa</span>
                <span class="tile-value">${record.year || '—'}</span>
              </div>
            </div>
          </div>

          <!-- Stato di Conservazione Goldmine -->
          <div class="liquid-sub-card">
            <div class="sub-card-title">✨ Stato di Conservazione (Goldmine)</div>
            <div class="specs-grid-two">
              <div class="spec-tile">
                <span class="tile-label">Vinile (Media)</span>
                <span class="tile-value highlight-gold">${discoRating}</span>
              </div>
              <div class="spec-tile">
                <span class="tile-label">Copertina (Sleeve)</span>
                <span class="tile-value highlight-gold">${coverRating}</span>
              </div>
            </div>
            ${record.note_stato ? `
              <div class="notes-callout"><strong>Note:</strong> ${record.note_stato}</div>
            ` : ''}
          </div>

          <!-- Codici Matrice & Barcode -->
          <div class="liquid-sub-card">
            <div class="sub-card-title">🔍 Identificatori & Matrice Runout</div>
            <div class="spec-tile" style="margin-bottom: 0.6rem;">
              <span class="tile-label">Codice a Barre (Barcode / EAN)</span>
              <span class="tile-value font-mono">${record.codice_a_barre || 'Non presente / Vintage'}</span>
            </div>
            <div class="spec-tile">
              <span class="tile-label">Incisioni Matrice (Runout Groove)</span>
              ${matrixItems.length > 0 ? `
                <div class="matrix-list">
                  ${matrixItems.map(m => `
                    <div class="matrix-chip">
                      <span class="matrix-side">${m.description || 'Runout'}:</span>
                      <code class="matrix-val">${m.value}</code>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <code class="matrix-val-single">${record.codice_matrice || 'Nessuna incisione registrata'}</code>
              `}
            </div>
          </div>

          <!-- Galleria Foto Se Presenti -->
          ${photos.length > 0 ? `
            <div class="liquid-sub-card">
              <div class="sub-card-title">📷 Galleria Fotografica (${photos.length})</div>
              <div class="sheet-photo-strip">
                ${photos.map((p, idx) => `
                  <img src="${p}" class="sheet-photo-item" alt="Foto ${idx + 1}" onclick="window.open('${p}', '_blank')" onerror="this.style.display='none'">
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Footer Azioni Record -->
          <div class="stage-footer-actions">
            <div class="category-change-row">
              <span>Sposta in:</span>
              <button type="button" class="liquid-chip ${record.category === 'personal' ? 'active' : ''}" data-cat="personal">Personal 👤</button>
              <button type="button" class="liquid-chip ${record.category === 'wishlist' ? 'active' : ''}" data-cat="wishlist">Wishlist ⭐</button>
              <button type="button" class="liquid-chip ${record.category === 'family' ? 'active' : ''}" data-cat="family">Family 👨‍👩‍👧‍👦</button>
            </div>
            <button type="button" id="stage-delete-btn" class="liquid-delete-btn">🗑️ Elimina</button>
          </div>

        </div>

      </div>
    `;

    // Eventi Prev / Next sui pulsanti freccia
    this.stageContainer.querySelector('#stage-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prev();
    });
    this.stageContainer.querySelector('#stage-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.next();
    });

    // Interazione estrazione e rotazione vinile
    const assembly = this.stageContainer.querySelector('#art-assembly');
    const disc = this.stageContainer.querySelector('#stage-disc');
    if (assembly && disc) {
      assembly.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        disc.classList.toggle('playing', this.isPlaying);
        assembly.classList.toggle('playing', this.isPlaying);
      });
    }

    // Refresh prezzo
    this.stageContainer.querySelector('#stage-refresh-price-btn')?.addEventListener('click', () => {
      if (this.onAction) this.onAction('refresh_price', record);
    });

    // Cambio categoria
    this.stageContainer.querySelectorAll('.category-change-row button').forEach(btn => {
      btn.addEventListener('click', () => {
        const newCat = btn.dataset.cat;
        if (newCat && newCat !== record.category && this.onAction) {
          this.onAction('change_category', { record, newCat });
        }
      });
    });

    // Elimina record
    this.stageContainer.querySelector('#stage-delete-btn')?.addEventListener('click', () => {
      if (confirm(`Rimuovere "${record.title}" dalla collezione?`) && this.onAction) {
        this.onAction('delete_record', record);
      }
    });

    // Inclinazione prospettica 3D del vetro card
    const card = this.stageContainer.querySelector('#liquid-stage-card');
    if (card && window.matchMedia('(hover: hover)').matches) {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0)';
      });
    }
  }

  renderWheel() {
    if (!this.wheelContainer) return;
    if (this.drawerMode === undefined) {
      this.drawerMode = window.innerWidth <= 1024 ? 'list' : 'wheel';
    }

    const filterText = (this.drawerFilter || '').toLowerCase().trim();
    const visibleRecords = filterText 
      ? this.records.filter(r => (r.title || '').toLowerCase().includes(filterText) || (r.artist || '').toLowerCase().includes(filterText))
      : this.records;

    this.wheelContainer.innerHTML = `
      <div class="drawer-header-area">
        <div class="drawer-top-bar">
          <div class="drawer-title-group">
            <span class="drawer-icon">💿</span>
            <span class="drawer-title">I TUOI VINILI (${visibleRecords.length})</span>
          </div>
          <button type="button" class="drawer-close-btn" id="close-drawer-btn" aria-label="Chiudi">&times;</button>
        </div>

        <div class="drawer-mode-switch">
          <button type="button" class="drawer-mode-pill ${this.drawerMode === 'list' ? 'active' : ''}" data-mode="list">📋 Lista Catalogo</button>
          <button type="button" class="drawer-mode-pill ${this.drawerMode === 'wheel' ? 'active' : ''}" data-mode="wheel">🎡 Ruota 3D</button>
        </div>

        <div class="drawer-quick-search">
          <input type="text" id="drawerSearchInput" placeholder="🔍 Cerca per titolo, artista..." value="${this.drawerFilter || ''}" autocomplete="off">
          ${this.drawerFilter ? `<button type="button" class="drawer-clear-search" id="drawerClearSearch">&times;</button>` : ''}
        </div>
      </div>

      ${this.drawerMode === 'list' ? `
        <div class="drawer-catalog-list" id="drawer-catalog-list">
          ${visibleRecords.length === 0 ? `
            <div class="drawer-empty">Nessun vinile corrisponde alla ricerca</div>
          ` : visibleRecords.map((record) => {
            const origIdx = this.records.indexOf(record);
            const isSelected = origIdx === this.selectedIndex;
            const cover = record.cover_image || (record.foto_album && record.foto_album[0]) || 'favicon.svg';
            const price = (parseFloat(record.valore_stimato) || 0).toFixed(0);
            return `
              <div class="drawer-record-item ${isSelected ? 'active' : ''}" data-index="${origIdx}">
                <img src="${cover}" class="drawer-record-thumb" alt="${record.title}" onerror="this.src='favicon.svg'">
                <div class="drawer-record-info">
                  <div class="drawer-record-title">${record.title}</div>
                  <div class="drawer-record-artist">${record.artist} ${record.year ? `• ${record.year}` : ''}</div>
                </div>
                <div class="drawer-record-meta">
                  <span class="drawer-tag cat-${record.category || 'personal'}">${(record.category || 'personal')}</span>
                  <span class="drawer-price">€ ${price}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="wheel-items-stage" id="wheel-items-stage"></div>
      `}
    `;

    // Handler chiusura drawer
    this.wheelContainer.querySelector('#close-drawer-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMobileDrawer();
    });

    // Handler switch modalità
    this.wheelContainer.querySelectorAll('.drawer-mode-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.drawerMode = btn.dataset.mode;
        this.renderWheel();
      });
    });

    // Handler ricerca nel drawer
    const searchInput = this.wheelContainer.querySelector('#drawerSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.drawerFilter = e.target.value;
        this.renderWheel();
        const inputRef = this.wheelContainer.querySelector('#drawerSearchInput');
        if (inputRef) {
          inputRef.focus();
          inputRef.selectionStart = inputRef.selectionEnd = inputRef.value.length;
        }
      });
    }
    this.wheelContainer.querySelector('#drawerClearSearch')?.addEventListener('click', () => {
      this.drawerFilter = '';
      this.renderWheel();
    });

    // Se modalità Catalogo a Lista
    if (this.drawerMode === 'list') {
      const listContainer = this.wheelContainer.querySelector('#drawer-catalog-list');
      if (listContainer) {
        listContainer.querySelectorAll('.drawer-record-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index, 10);
            if (!isNaN(idx)) {
              this.selectIndex(idx);
              this.closeMobileDrawer();
            }
          });
        });

        // Scroll automatico all'elemento attivo
        setTimeout(() => {
          const activeEl = listContainer.querySelector('.drawer-record-item.active');
          if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 60);
      }
      return;
    }

    // Se modalità Ruota 3D
    const stage = this.wheelContainer.querySelector('#wheel-items-stage');
    if (!stage) return;

    if (visibleRecords.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wheel-item';
      empty.textContent = 'Nessun vinile';
      stage.appendChild(empty);
      return;
    }

    visibleRecords.forEach((record) => {
      const origIdx = this.records.indexOf(record);
      const item = document.createElement('div');
      item.className = 'wheel-item';
      item.dataset.index = origIdx;
      item.innerHTML = `
        <span class="wheel-item-title">${record.title || 'Senza Titolo'}</span>
        <span class="wheel-item-sub">${record.artist || 'Sconosciuto'}</span>
      `;

      item.addEventListener('click', () => {
        this.selectIndex(origIdx);
        this.closeMobileDrawer();
      });

      stage.appendChild(item);
    });

    this.wheelItems = Array.from(stage.querySelectorAll('.wheel-item'));
    this.updateWheelPositions();
  }

  updateWheelPositions() {
    if (!this.wheelContainer || this.records.length === 0 || !this.wheelItems) return;
    const isMobile = window.innerWidth <= 1024;

    this.wheelItems.forEach((item) => {
      const index = parseInt(item.dataset.index, 10);
      const distance = index - this.selectedIndex;
      const absDist = Math.abs(distance);
      const isSelected = distance === 0;

      // Matematica cilindrica 3D fluida, armoniosa e senza fuoriuscite
      const translateY = distance * 2.8;
      const curveOffset = isMobile ? Math.pow(absDist, 1.1) * 3 : Math.pow(absDist, 1.35) * 9;
      const rotateX = distance * -5.5;
      const opacity = isSelected ? 1 : Math.max(0.35, 0.78 - absDist * 0.08);
      const scale = isSelected ? 1.06 : Math.max(0.82, 1 - absDist * 0.04);

      item.style.color = isSelected ? '#ffffff' : '#cbd5e1';
      item.style.fontWeight = isSelected ? '800' : '500';
      item.style.opacity = opacity;
      item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg) scale(${scale})`;

      if (isSelected) {
        item.classList.add('active');
        item.style.textShadow = '0 0 16px rgba(56, 189, 248, 0.85), 0 2px 10px rgba(0,0,0,0.95)';
      } else {
        item.classList.remove('active');
        item.style.textShadow = '0 2px 8px rgba(0,0,0,0.85)';
      }
    });
  }

  selectIndex(newIndex) {
    if (this.records.length === 0) return;
    const target = Math.max(0, Math.min(newIndex, this.records.length - 1));
    if (target !== this.selectedIndex) {
      this.selectedIndex = target;
      if (this.drawerMode === 'wheel') {
        this.updateWheelPositions();
      } else if (this.wheelContainer) {
        // Aggiorna classe active nella lista catalogo
        this.wheelContainer.querySelectorAll('.drawer-record-item').forEach(el => {
          el.classList.toggle('active', parseInt(el.dataset.index, 10) === target);
        });
      }
      this.renderStage();
      if (this.records[this.selectedIndex]) {
        this.onSelect(this.records[this.selectedIndex]);
      }
    }
  }

  next() { this.selectIndex(this.selectedIndex + 1); }
  prev() { this.selectIndex(this.selectedIndex - 1); }

  toggleMobileDrawer() {
    const willOpen = !this.wheelContainer.classList.contains('open');
    this.wheelContainer.classList.toggle('open', willOpen);
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.classList.toggle('active', willOpen);

    if (willOpen) {
      // Se apriamo su mobile, assicuriamoci di re-renderizzare o centrare l'elemento attivo
      this.renderWheel();
    }
  }

  closeMobileDrawer() {
    this.wheelContainer.classList.remove('open');
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  initEvents() {
    // 1. Scorrimento della rotella del mouse
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.stage-scrollable-details') || e.target.closest('.drawer-catalog-list') || e.target.closest('dialog')) return;
      const now = performance.now();
      if (now - this.lastWheelTime < 60) return;
      if (Math.abs(e.deltaY) > 8) {
        this.lastWheelTime = now;
        this.selectIndex(this.selectedIndex + Math.sign(e.deltaY));
      }
    }, { passive: true });

    // 2. Touch swipe su mobile
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.touchStartY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.target.closest('.stage-scrollable-details') || e.target.closest('.drawer-catalog-list') || e.target.closest('dialog')) return;
      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const diffY = this.touchStartY - currentY;
        const diffX = this.touchStartX - currentX;

        // Se swipe orizzontale (cambio vinile con swipe sullo stage)
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) this.next();
          else this.prev();
          this.touchStartX = currentX;
          this.touchStartY = currentY;
          return;
        }

        // Se swipe verticale (scorrimento ruota sullo stage)
        if (Math.abs(diffY) > 35 && Math.abs(diffY) > Math.abs(diffX)) {
          this.selectIndex(this.selectedIndex + Math.sign(diffY));
          this.touchStartY = currentY;
          this.touchStartX = currentX;
        }
      }
    }, { passive: true });

    // 3. Touch Drag dedicato dentro il wheelContainer
    if (this.wheelContainer) {
      let isThrottled = false;
      let drawerTouchX = 0;
      let drawerTouchY = 0;

      this.wheelContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          drawerTouchX = e.touches[0].clientX;
          drawerTouchY = e.touches[0].clientY;
        }
      }, { passive: true });

      this.wheelContainer.addEventListener('touchmove', (e) => {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - drawerTouchX;
        const diffY = drawerTouchY - currentY;

        // Swipe orizzontale verso destra per chiudere il cassetto
        if (diffX > 50 && Math.abs(diffX) > Math.abs(diffY)) {
          this.closeMobileDrawer();
          return;
        }

        // In modalità Ruota 3D: drag verticale fluido per ruotare
        if (this.drawerMode === 'wheel' && Math.abs(diffY) > Math.abs(diffX)) {
          e.preventDefault();
          if (isThrottled) return;
          if (Math.abs(diffY) > 20) {
            isThrottled = true;
            if (diffY > 0) this.next();
            else this.prev();
            drawerTouchY = currentY;
            setTimeout(() => { isThrottled = false; }, 90);
          }
        }
      }, { passive: false });
    }

    // 4. Frecce tastiera
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
    });

    // 5. Overlay mobile
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.addEventListener('click', () => this.closeMobileDrawer());

    // 6. Toggle bottone titoli
    const toggleBtn = document.getElementById('toggle-wheel-btn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleMobileDrawer());
  }
}
