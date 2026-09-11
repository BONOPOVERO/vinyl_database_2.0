// js/discogs-engine.js - Motore Prezzi Discogs, Scanner Barcode & Ricerca Matrice

const USER_AGENT = 'VinylVaultApp/3.0 +https://github.com/BONOPOVERO/vinyl_database_2.0';

export function getDiscogsToken() {
  return localStorage.getItem('discogs_api_token') || '';
}

export function setDiscogsToken(token) {
  if (token && token.trim()) localStorage.setItem('discogs_api_token', token.trim());
  else localStorage.removeItem('discogs_api_token');
}

export function calculateGoldminePrice(basePrice, discoGrade = '8', coverGrade = '7') {
  if (!basePrice || isNaN(basePrice) || basePrice <= 0) return 0;
  
  const d = parseInt(discoGrade, 10) || 8;
  const c = parseInt(coverGrade, 10) || 7;
  const avg = (d + c) / 2;

  let mult = 0.5;
  if (avg >= 9.5) mult = 1.0;       // Mint
  else if (avg >= 8.5) mult = 0.85; // Near Mint
  else if (avg >= 7.5) mult = 0.65; // VG+
  else if (avg >= 6.5) mult = 0.45; // VG
  else if (avg >= 5.0) mult = 0.30; // G+ / G
  else mult = 0.15;                 // Fair / Poor

  return parseFloat((basePrice * mult).toFixed(2));
}

export async function searchDiscogsPrice({ barcode, matrix, discoGrade = '8', coverGrade = '7' }) {
  const cleanBarcode = (barcode || '').trim();
  const cleanMatrix = (matrix || '').trim();

  if (!cleanBarcode && !cleanMatrix) {
    throw new Error('Specificare un codice a barre o un codice matrice.');
  }

  let searchUrl = '';
  if (cleanBarcode) {
    searchUrl = `https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanBarcode)}&type=release&format=Vinyl`;
  } else {
    searchUrl = `https://api.discogs.com/database/search?query=${encodeURIComponent(cleanMatrix)}&type=release&format=Vinyl`;
  }

  const token = getDiscogsToken();
  const headers = { 'User-Agent': USER_AGENT };
  if (token) headers['Authorization'] = `Discogs token=${token}`;

  const res = await fetch(searchUrl, { headers });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Limite richieste Discogs raggiunto. Riprova tra poco.');
    throw new Error(`Errore Discogs (${res.status})`);
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return { found: false, message: 'Nessuna release trovata per questo codice.' };
  }

  const bestMatch = data.results[0];
  const releaseId = bestMatch.id;

  let releaseDetails = null;
  let lowestPrice = null;

  try {
    const relRes = await fetch(`https://api.discogs.com/releases/${releaseId}`, { headers });
    if (relRes.ok) {
      releaseDetails = await relRes.json();
      if (releaseDetails.lowest_price != null) {
        lowestPrice = parseFloat(releaseDetails.lowest_price);
      }
    }
  } catch (e) {
    console.warn('[DiscogsEngine] Errore fetch dettagli release:', e);
  }

  const basePrice = lowestPrice || 25.0;
  const estimated = calculateGoldminePrice(basePrice, discoGrade, coverGrade);

  return {
    found: true,
    releaseId: releaseId,
    title: bestMatch.title || (releaseDetails && releaseDetails.title),
    year: bestMatch.year || (releaseDetails && releaseDetails.year),
    country: bestMatch.country || (releaseDetails && releaseDetails.country),
    thumb: bestMatch.thumb || (releaseDetails && releaseDetails.thumb),
    lowestPrice: lowestPrice,
    estimatedValue: estimated,
    discogsUrl: `https://www.discogs.com/release/${releaseId}`
  };
}

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
