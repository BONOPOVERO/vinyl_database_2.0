// js/liquid-carousel.js - Selettore & Palcoscenico 3D con Fisica Liquida e Inclinazione Realistica

export class LiquidCarousel {
  constructor({ wheelContainer, stageContainer, onSelectRecord }) {
    this.wheelContainer = wheelContainer;
    this.stageContainer = stageContainer;
    this.onSelect = onSelectRecord;
    this.records = [];
    this.selectedIndex = 0;
    this.lastWheelTime = 0;
    this.touchStartY = 0;
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
        <div class="liquid-empty-stage">
          <div class="empty-icon">💿</div>
          <h3>Nessun vinile in questa categoria</h3>
          <p>Seleziona un'altra categoria o azzera i filtri di ricerca.</p>
        </div>
      `;
      return;
    }

    const cover = record.cover_image || (record.foto_album && record.foto_album[0]) || 'favicon.svg';

    this.stageContainer.innerHTML = `
      <div class="liquid-stage-card" id="liquid-stage-card">
        <!-- RIFLESSO SPECULARE VETRO SUPERFICIALE -->
        <div class="glass-specular-sheen"></div>

        <!-- ALONE DI LUCE AMBIENTALE ADATTIVO SUL VINILE -->
        <div class="liquid-cover-aura" id="cover-aura"></div>

        <!-- CUSTODIA 3D & DISCO IN VINILE -->
        <div class="liquid-art-assembly" id="art-assembly" title="Clicca per estrarre il vinile!">
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

        <!-- INFO TITOLO & ARTISTA CENTRALE -->
        <div class="liquid-stage-info">
          <span class="liquid-play-hint">🎵 Clicca il vinile per estrarlo</span>
          <h1 class="liquid-stage-title">${record.title}</h1>
          <h2 class="liquid-stage-artist">${record.artist}</h2>
          
          <div class="liquid-meta-row">
            <span class="liquid-tag tag-category">${record.category.toUpperCase()}</span>
            <span class="liquid-tag tag-genre">${record.genre || 'Rock'}</span>
            <span class="liquid-tag tag-year">${record.year || '—'}</span>
            ${record.valore_stimato ? `<span class="liquid-tag tag-price">€ ${parseFloat(record.valore_stimato).toFixed(2)}</span>` : ''}
          </div>
        </div>

        <!-- PULSANTE APRI SCHEDA COMPLETA -->
        <button type="button" class="liquid-inspect-btn" id="open-details-sheet-btn">
          <span>Esplora Tutte le Informazioni</span>
          <span class="btn-arrow">↓</span>
        </button>
      </div>
    `;

    // Eventi interattivi sul vinile estraibile
    const assembly = this.stageContainer.querySelector('#art-assembly');
    const disc = this.stageContainer.querySelector('#stage-disc');
    if (assembly && disc) {
      assembly.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        disc.classList.toggle('playing', this.isPlaying);
        assembly.classList.toggle('playing', this.isPlaying);
      });
    }

    // Dynamic 3D tilt con il movimento del mouse
    const card = this.stageContainer.querySelector('#liquid-stage-card');
    if (card) {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(1000px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0)`;
      });
    }

    // Tasto apri dettagli completi
    const openBtn = this.stageContainer.querySelector('#open-details-sheet-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        const sheet = document.getElementById('details-sheet-panel');
        if (sheet) sheet.classList.add('active');
      });
    }
  }

  renderWheel() {
    if (!this.wheelContainer) return;
    this.wheelContainer.innerHTML = '';

    if (this.records.length === 0) return;

    this.records.forEach((record, idx) => {
      const item = document.createElement('div');
      item.className = 'liquid-wheel-item';
      item.dataset.index = idx;
      item.textContent = record.title || 'Senza Titolo';

      item.addEventListener('click', () => {
        this.selectIndex(idx);
        this.closeMobileDrawer();
      });

      this.wheelContainer.appendChild(item);
    });

    this.wheelItems = Array.from(this.wheelContainer.querySelectorAll('.liquid-wheel-item'));
    this.updateWheelPositions();
  }

  updateWheelPositions() {
    if (!this.wheelContainer || this.records.length === 0) return;

    this.wheelItems.forEach((item, index) => {
      const distance = index - this.selectedIndex;
      const absDist = Math.abs(distance);
      const isSelected = distance === 0;

      // Curva cilindrica 3D ultra-fluida
      const translateY = distance * 2.8;
      const curveOffset = Math.pow(absDist, 1.35) * 12; // Curva verso destra
      const rotateX = distance * -5.5;
      const opacity = isSelected ? 1 : Math.max(0.04, 0.42 - absDist * 0.16);
      const scale = isSelected ? 1.08 : Math.max(0.74, 1 - absDist * 0.08);

      item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg) scale(${scale})`;
      item.style.opacity = opacity;

      if (isSelected) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  selectIndex(newIndex) {
    if (this.records.length === 0) return;
    const target = Math.max(0, Math.min(newIndex, this.records.length - 1));
    if (target !== this.selectedIndex) {
      this.selectedIndex = target;
      this.updateWheelPositions();
      this.renderStage();
      if (this.records[this.selectedIndex]) {
        this.onSelect(this.records[this.selectedIndex]);
      }
    }
  }

  next() { this.selectIndex(this.selectedIndex + 1); }
  prev() { this.selectIndex(this.selectedIndex - 1); }

  toggleMobileDrawer() {
    this.wheelContainer.classList.toggle('open');
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.classList.toggle('active');
  }

  closeMobileDrawer() {
    this.wheelContainer.classList.remove('open');
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  initEvents() {
    // 1. Scorrimento globale della rotella del mouse
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('.details-sheet-scroll') || e.target.closest('dialog') || e.target.closest('.app-dialog')) {
        return;
      }
      const now = performance.now();
      if (now - this.lastWheelTime < 60) return;
      if (Math.abs(e.deltaY) > 8) {
        this.lastWheelTime = now;
        this.selectIndex(this.selectedIndex + Math.sign(e.deltaY));
      }
    }, { passive: true });

    // 2. Touch swipe su mobile
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.target.closest('.details-sheet-scroll') || e.target.closest('dialog')) return;
      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const diff = this.touchStartY - currentY;
        if (Math.abs(diff) > 35) {
          this.selectIndex(this.selectedIndex + Math.sign(diff));
          this.touchStartY = currentY;
        }
      }
    }, { passive: true });

    // 3. Tasti freccia su/giù
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase())) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.prev(); }
    });

    // 4. Overlay mobile
    const overlay = document.getElementById('mobile-overlay');
    if (overlay) overlay.addEventListener('click', () => this.closeMobileDrawer());

    // 5. Toggle titoli
    const toggleBtn = document.getElementById('toggle-wheel-btn');
    if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleMobileDrawer());
  }
}
