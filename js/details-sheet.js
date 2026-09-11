// js/details-sheet.js - Scheda Dettagli Onnicomprensiva in Vetro Liquido

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

export function renderDetailsSheet(container, record, onAction) {
  if (!container || !record) return;

  const photos = Array.isArray(record.foto_album) && record.foto_album.length > 0 
    ? record.foto_album 
    : (record.cover_image ? [record.cover_image] : []);

  const discoRating = GOLDMINE_MAP[String(record.stato_disco)] || (record.stato_disco ? `Grado ${record.stato_disco}` : 'Non specificato');
  const coverRating = GOLDMINE_MAP[String(record.stato_copertina)] || (record.stato_copertina ? `Grado ${record.stato_copertina}` : 'Non specificato');

  const tracklist = record.tracklist || [];
  const sideA = tracklist.filter(t => (t.position || '').toUpperCase().startsWith('A') || (t.position || '').startsWith('1'));
  const sideB = tracklist.filter(t => (t.position || '').toUpperCase().startsWith('B') || (t.position || '').startsWith('2'));
  const otherSides = tracklist.filter(t => !sideA.includes(t) && !sideB.includes(t));

  const identifiers = record.identifiers || [];
  const matrixItems = identifiers.filter(i => (i.type || '').toLowerCase().includes('matrix') || (i.type || '').toLowerCase().includes('runout'));
  const otherIds = identifiers.filter(i => !matrixItems.includes(i));

  container.innerHTML = `
    <div class="sheet-glass-card">
      <div class="sheet-drag-handle"></div>

      <!-- HEADER SCHEDA -->
      <div class="sheet-header">
        <div>
          <div class="sheet-category-badge">${record.category.toUpperCase()}</div>
          <h2 class="sheet-title">${record.title}</h2>
          <div class="sheet-artist">${record.artist}</div>
        </div>
        <button type="button" class="sheet-close-btn" id="close-sheet-btn" aria-label="Chiudi Scheda">&times;</button>
      </div>

      <div class="details-sheet-scroll">
        
        <!-- CARD PREZZO & MERCATO DISCOGS -->
        <div class="liquid-card price-highlight-card">
          <div class="card-row-between">
            <span class="card-caption">💰 Valore di Mercato Discogs</span>
            <button type="button" id="sheet-refresh-price-btn" class="liquid-pill-action">
              🔄 Verifica Live
            </button>
          </div>
          <div class="price-big" id="sheet-price-val">
            ${record.valore_stimato ? `€ ${parseFloat(record.valore_stimato).toFixed(2)}` : 'In calcolo...'}
          </div>
          <div class="card-hint">Stima ponderata calcolata per la tua copia</div>
        </div>

        <!-- STATO DI CONSERVAZIONE GOLDMINE -->
        <div class="liquid-card">
          <div class="card-heading">✨ Stato di Conservazione (Goldmine)</div>
          <div class="grid-two">
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
            <div class="notes-callout">
              <strong>Note:</strong> ${record.note_stato}
            </div>
          ` : ''}
        </div>

        <!-- SPECIFICHE DI STAMPA & SUPPORTO -->
        <div class="liquid-card">
          <div class="card-heading">⚙️ Specifiche Stampa</div>
          <div class="grid-three">
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

        <!-- IDENTIFICATORI NUMISMATICI & MATRICE -->
        <div class="liquid-card">
          <div class="card-heading">🔍 Identificatori & Matrice sulla Cera</div>
          
          <div class="spec-tile" style="margin-bottom: 10px;">
            <span class="tile-label">Codice a Barre (Barcode / EAN)</span>
            <span class="tile-value font-mono">${record.codice_a_barre || 'Non presente / Vintage'}</span>
          </div>

          <div class="spec-tile">
            <span class="tile-label">Incisioni Matrice (Matrix / Runout)</span>
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

          ${otherIds.length > 0 ? `
            <div class="other-ids-row">
              ${otherIds.map(i => `<span class="other-id-tag">${i.type}: ${i.value}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <!-- TRACKLIST COMPLETA -->
        <div class="liquid-card">
          <div class="card-heading">🎵 Tracklist (${tracklist.length} Brani)</div>
          
          ${tracklist.length === 0 ? `
            <p class="empty-note">Nessuna traccia registrata.</p>
          ` : `
            <div class="tracklist-layout">
              ${sideA.length > 0 ? `
                <div class="track-group">
                  <div class="group-title">Lato A</div>
                  ${sideA.map(t => `
                    <div class="track-row">
                      <span class="track-idx">${t.position}</span>
                      <span class="track-name">${t.title}</span>
                      <span class="track-time">${t.duration || '—'}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${sideB.length > 0 ? `
                <div class="track-group">
                  <div class="group-title">Lato B</div>
                  ${sideB.map(t => `
                    <div class="track-row">
                      <span class="track-idx">${t.position}</span>
                      <span class="track-name">${t.title}</span>
                      <span class="track-time">${t.duration || '—'}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${otherSides.length > 0 ? `
                <div class="track-group">
                  <div class="group-title">Altre Tracce</div>
                  ${otherSides.map(t => `
                    <div class="track-row">
                      <span class="track-idx">${t.position || '•'}</span>
                      <span class="track-name">${t.title}</span>
                      <span class="track-time">${t.duration || '—'}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `}
        </div>

        <!-- FOTO GALLERY DELL'ALBUM -->
        ${photos.length > 1 ? `
          <div class="liquid-card">
            <div class="card-heading">📷 Foto Album & Dettagli (${photos.length})</div>
            <div class="sheet-photo-strip">
              ${photos.map((p, idx) => `
                <img src="${p}" class="sheet-photo-item" alt="Foto ${idx + 1}" onclick="window.open('${p}', '_blank')" onerror="this.style.display='none'">
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- GESTIONE CATEGORIA & ELIMINAZIONE -->
        <div class="sheet-footer-actions">
          <div class="category-change-row">
            <span>Sposta in:</span>
            <button type="button" class="liquid-chip ${record.category === 'personal' ? 'active' : ''}" data-cat="personal">Personal 👤</button>
            <button type="button" class="liquid-chip ${record.category === 'wishlist' ? 'active' : ''}" data-cat="wishlist">Wishlist ⭐</button>
            <button type="button" class="liquid-chip ${record.category === 'family' ? 'active' : ''}" data-cat="family">Family 👨‍👩‍👧‍👦</button>
          </div>
          <button type="button" id="sheet-delete-btn" class="liquid-delete-btn">🗑️ Elimina</button>
        </div>

      </div>
    </div>
  `;

  // Event handlers
  const closeBtn = container.querySelector('#close-sheet-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => container.classList.remove('active'));
  }

  const dragHandle = container.querySelector('.sheet-drag-handle');
  if (dragHandle) {
    dragHandle.addEventListener('click', () => container.classList.remove('active'));
  }

  const refreshBtn = container.querySelector('#sheet-refresh-price-btn');
  if (refreshBtn && onAction) {
    refreshBtn.addEventListener('click', () => onAction('refresh_price', record));
  }

  container.querySelectorAll('.category-change-row button').forEach(btn => {
    btn.addEventListener('click', () => {
      const newCat = btn.dataset.cat;
      if (newCat && newCat !== record.category && onAction) {
        onAction('change_category', { record, newCat });
      }
    });
  });

  const deleteBtn = container.querySelector('#sheet-delete-btn');
  if (deleteBtn && onAction) {
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Rimuovere "${record.title}" dalla collezione?`)) {
        onAction('delete_record', record);
      }
    });
  }
}
