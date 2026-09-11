// js/store.js - IndexedDB nativo & Memoria Reattiva a Zero Latenza (< 1ms)

const DB_NAME = 'VinylVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';

let db = null;
let inMemoryRecords = [];

export async function initStore() {
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });

  // Carica da DB
  let items = await getAllFromDb();

  // Se DB vuoto, carica da data/records.json
  if (!items || items.length === 0) {
    try {
      const res = await fetch('data/records.json');
      if (res.ok) {
        items = await res.json();
        await bulkInsert(items);
        console.log(`[Store] Inizializzati ${items.length} vinili dal dataset seed.`);
      }
    } catch (err) {
      console.warn('[Store] Impossibile caricare data/records.json:', err);
    }
  }

  inMemoryRecords = items || [];
  return inMemoryRecords;
}

function getAllFromDb() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function bulkInsert(items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getAllRecords() {
  return inMemoryRecords;
}

export function getFilteredRecords(category = 'all', searchQuery = '') {
  let list = inMemoryRecords;

  if (category && category.toLowerCase() !== 'all') {
    const cat = category.toLowerCase();
    list = list.filter(r => (r.category || 'personal').toLowerCase() === cat);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(r => {
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchArtist = (r.artist || '').toLowerCase().includes(q);
      const matchLabel = (r.label || '').toLowerCase().includes(q);
      const matchCat = (r.catalog_number || '').toLowerCase().includes(q);
      const matchMatrix = (r.codice_matrice || '').toLowerCase().includes(q);
      const matchBarcode = (r.codice_a_barre || '').toLowerCase().includes(q);
      const matchGenre = (r.genre || '').toLowerCase().includes(q);
      return matchTitle || matchArtist || matchLabel || matchCat || matchMatrix || matchBarcode || matchGenre;
    });
  }

  return list;
}

export function getRecordById(id) {
  return inMemoryRecords.find(r => String(r.id) === String(id)) || null;
}

export async function saveRecord(record) {
  if (!record.id) record.id = 'rec_' + Date.now();
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(record);
  
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  const idx = inMemoryRecords.findIndex(r => String(r.id) === String(record.id));
  if (idx >= 0) inMemoryRecords[idx] = record;
  else inMemoryRecords.unshift(record);

  return record;
}

export async function deleteRecord(id) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  inMemoryRecords = inMemoryRecords.filter(r => String(r.id) !== String(id));
  return true;
}

export function getStats(category = 'all') {
  const list = getFilteredRecords(category);
  const total = list.length;
  const totalValue = list.reduce((sum, r) => sum + (parseFloat(r.valore_stimato) || 0), 0);
  return { total, totalValue };
}
