// js/discogs-engine.js - Motore Prezzi Discogs, Scanner Barcode, Ricerca Matrice & iTunes Cover Art

const USER_AGENT = 'VinylVaultApp/4.0 +https://github.com/BONOPOVERO/vinyl_database_2.0';

export function getDiscogsCredentials() {
  return {
    token: localStorage.getItem('discogs_api_token') || '',
    username: localStorage.getItem('discogs_username') || ''
  };
}

export function setDiscogsCredentials({ token, username }) {
  if (token !== undefined) {
    if (token && token.trim()) localStorage.setItem('discogs_api_token', token.trim());
    else localStorage.removeItem('discogs_api_token');
  }
  if (username !== undefined) {
    if (username && username.trim()) localStorage.setItem('discogs_username', username.trim());
    else localStorage.removeItem('discogs_username');
  }
}

// ==========================================
// ITUNES SEARCH API (COPERTINE HD)
// ==========================================

function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const itunesMemoryCache = new Map();

/**
 * Cerca la copertina dell'album su Apple Music / iTunes Search API a massima risoluzione (1000x1000).
 */
export async function fetchITunesCover(artist, title) {
  if (!artist || !title) return null;
  const key = `${normalizeStr(artist)}|${normalizeStr(title)}`;
  if (itunesMemoryCache.has(key)) return itunesMemoryCache.get(key);

  const query = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${query}&entity=album&limit=5`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const normTargetArtist = normalizeStr(artist);
      const normTargetTitle = normalizeStr(title);

      // Cerca il miglior match esaminando i primi 5 risultati
      let match = data.results.find(item => {
        const itemArtist = normalizeStr(item.artistName);
        const itemTitle = normalizeStr(item.collectionName);
        const artistOk = itemArtist.includes(normTargetArtist) || normTargetArtist.includes(itemArtist);
        const titleOk = itemTitle.includes(normTargetTitle) || normTargetTitle.includes(itemTitle);
        return artistOk && titleOk;
      }) || data.results[0];

      if (match && match.artworkUrl100) {
        // Upgrade da thumbnail 100x100 a ultra HD 1000x1000bb
        const hdCover = match.artworkUrl100.replace('100x100bb', '1000x1000bb').replace('100x100', '1000x1000');
        itunesMemoryCache.set(key, hdCover);
        return hdCover;
      }
    }
  } catch (err) {
    console.warn('[iTunesEngine] Ricerca copertina fallita:', err);
  }

  itunesMemoryCache.set(key, null);
  return null;
}

// ==========================================
// GOLDMINE VALUATION FORMULA
// ==========================================

export function calculateGoldminePrice(basePrice, discoGrade = '8', coverGrade = '7') {
  if (!basePrice || isNaN(basePrice) || basePrice <= 0) return 20.0;
  
  const d = parseInt(discoGrade, 10) || 8;
  const c = parseInt(coverGrade, 10) || 7;
  const avg = (d + c) / 2;

  let mult = 0.5;
  if (avg >= 9.5) mult = 1.0;       // Mint (M)
  else if (avg >= 8.5) mult = 0.85; // Near Mint (NM)
  else if (avg >= 7.5) mult = 0.65; // VG+
  else if (avg >= 6.5) mult = 0.45; // VG
  else if (avg >= 5.0) mult = 0.30; // G+ / G
  else mult = 0.15;                 // Fair / Poor

  return parseFloat((basePrice * mult).toFixed(2));
}

// ==========================================
// DISCOGS ENGINE CON TRUCCO DELLA WANTLIST
// ==========================================

/**
 * Esegue la stima prezzo sfruttando il trucco della Wantlist Discogs:
 * 1. Inserisce il vinile nella Wantlist dell'utente
 * 2. Preleva le price suggestions condizionate / quotazioni di mercato
 * 3. Rimuove immediatamente il vinile dalla Wantlist
 */
export async function executePriceCheckWithWantlistTrick({ releaseId, discoGrade = '8', coverGrade = '7', barcode, matrix }) {
  const { token, username } = getDiscogsCredentials();
  const headers = { 'User-Agent': USER_AGENT };
  if (token) headers['Authorization'] = `Discogs token=${token}`;

  let targetReleaseId = releaseId;

  // Se non abbiamo ancora il releaseId, cerchiamolo per barcode o matrice
  if (!targetReleaseId) {
    if (barcode || matrix) {
      const searchRes = await searchDiscogsRelease({ barcode, matrix });
      if (searchRes.found) {
        targetReleaseId = searchRes.releaseId;
      }
    }
  }

  if (!targetReleaseId) {
    throw new Error('Nessun identificativo release Discogs fornito.');
  }

  let finalPrice = null;
  let lowestMarket = null;
  let medianMarket = null;
  let usedWantlistTrick = false;

  // 1. TRUCCO WANTLIST (Se utente e token sono configurati)
  if (username && token) {
    try {
      console.log(`[DiscogsTrick] Inserimento temporaneo release ${targetReleaseId} nella Wantlist di @${username}...`);
      const putRes = await fetch(`https://api.discogs.com/users/${encodeURIComponent(username)}/wants/${targetReleaseId}`, {
        method: 'PUT',
        headers
      });

      if (putRes.ok || putRes.status === 201 || putRes.status === 200) {
        usedWantlistTrick = true;
      }

      // Prova a recuperare le Price Suggestions ufficiali di Discogs condizionate dal rating
      try {
        const suggRes = await fetch(`https://api.discogs.com/marketplace/price_suggestions/${targetReleaseId}`, { headers });
        if (suggRes.ok) {
          const suggestions = await suggRes.json();
          // Mappatura Goldmine
          const d = parseInt(discoGrade, 10) || 8;
          let condKey = 'Very Good Plus (VG+)';
          if (d >= 10) condKey = 'Mint (M)';
          else if (d >= 9) condKey = 'Near Mint (NM or M-)';
          else if (d >= 8) condKey = 'Very Good Plus (VG+)';
          else if (d >= 7) condKey = 'Very Good (VG)';
          else if (d >= 6) condKey = 'Good Plus (G+)';
          else condKey = 'Good (G)';

          if (suggestions[condKey] && suggestions[condKey].value != null) {
            finalPrice = parseFloat(suggestions[condKey].value);
          }
        }
      } catch (suggErr) {
        console.warn('[DiscogsTrick] price_suggestions non accessibile:', suggErr);
      }
    } catch (wantErr) {
      console.warn('[DiscogsTrick] Errore inserimento wantlist:', wantErr);
    } finally {
      // 3. RIMOZIONE IMMEDIATA DALLA WANTLIST
      if (usedWantlistTrick) {
        try {
          console.log(`[DiscogsTrick] Rimozione di release ${targetReleaseId} dalla Wantlist di @${username}...`);
          await fetch(`https://api.discogs.com/users/${encodeURIComponent(username)}/wants/${targetReleaseId}`, {
            method: 'DELETE',
            headers
          });
        } catch (delErr) {
          console.warn('[DiscogsTrick] Errore rimozione da wantlist:', delErr);
        }
      }
    }
  }

  // Se il trucco o le price suggestions non hanno fornito un prezzo esatto, preleviamo lowest_price / base
  try {
    const relRes = await fetch(`https://api.discogs.com/releases/${targetReleaseId}`, { headers });
    if (relRes.ok) {
      const relData = await relRes.json();
      if (relData.lowest_price != null) {
        lowestMarket = parseFloat(relData.lowest_price);
      }
      if (relData.num_for_sale != null) {
        medianMarket = lowestMarket ? parseFloat((lowestMarket * 1.35).toFixed(2)) : null;
      }
    }
  } catch (relErr) {
    console.warn('[DiscogsEngine] Errore dettagli release:', relErr);
  }

  // Calcolo finale ponderato
  if (!finalPrice) {
    const base = lowestMarket || 25.0;
    finalPrice = calculateGoldminePrice(base, discoGrade, coverGrade);
  }

  return {
    releaseId: targetReleaseId,
    estimatedPrice: parseFloat(finalPrice.toFixed(2)),
    lowestMarketPrice: lowestMarket,
    medianMarketPrice: medianMarket,
    usedWantlistTrick,
    date: new Date().toISOString(),
    formattedDate: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  };
}

/**
 * Ricerca release su Discogs tramite Barcode o Codice Matrice
 */
export async function searchDiscogsRelease({ barcode, matrix, query }) {
  const cleanBarcode = (barcode || '').trim();
  const cleanMatrix = (matrix || '').trim();
  const cleanQuery = (query || '').trim();

  let searchUrl = '';
  if (cleanBarcode) {
    searchUrl = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanBarcode)}&type=release&format=Vinyl`;
  } else if (cleanMatrix) {
    searchUrl = `https://api.discogs.com/database/search?query=${encodeURIComponent(cleanMatrix)}&type=release&format=Vinyl`;
  } else if (cleanQuery) {
    searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(cleanQuery)}&type=release&format=Vinyl`;
  } else {
    throw new Error('Nessun termine di ricerca specificato.');
  }

  const { token } = getDiscogsCredentials();
  const headers = { 'User-Agent': USER_AGENT };
  if (token) headers['Authorization'] = `Discogs token=${token}`;

  const res = await fetch(searchUrl, { headers });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite richieste Discogs raggiunto. Riprova tra poco.');
    throw new Error(`Errore Discogs (${res.status})`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return { found: false, message: 'Nessuna release trovata.' };
  }

  const best = data.results[0];
  return {
    found: true,
    releaseId: best.id,
    title: best.title,
    year: best.year,
    country: best.country,
    thumb: best.thumb,
    genre: best.genre,
    style: best.style,
    label: best.label ? best.label[0] : '',
    catno: best.catno || '',
    barcode: best.barcode ? best.barcode[0] : cleanBarcode,
    discogsUrl: `https://www.discogs.com/release/${best.id}`
  };
}

// ==========================================
// BARCODE SCANNER
// ==========================================

export class BarcodeScanner {
  constructor(videoElement, onDetected, onError) {
    this.video = videoElement;
    this.onDetected = onDetected;
    this.onError = onError;
    this.stream = null;
    this.detector = null;
    this.isScanning = false;
    this.animId = null;

    if ('BarcodeDetector' in window) {
      try {
        this.detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } }
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.isScanning = true;
      this.loop();
    } catch (err) {
      if (this.onError) this.onError(err);
    }
  }

  stop() {
    this.isScanning = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  async loop() {
    if (!this.isScanning) return;
    if (this.detector && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try {
        const barcodes = await this.detector.detect(this.video);
        if (barcodes && barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          if (raw) {
            this.stop();
            this.onDetected(raw);
            return;
          }
        }
      } catch (e) {}
    }
    this.animId = requestAnimationFrame(() => this.loop());
  }
}
