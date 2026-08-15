# Vinyl Database 3.0 WebApp

Questa repository contiene tutto il necessario per far girare localmente o ospitare su GitHub Pages la **Vinyl Database 3.0 WebApp**, un'applicazione completa per la gestione delle proprie collezioni di vinili con funzionalità di Community e calcolo in tempo reale del valore dei dischi.

## 🚀 Caratteristiche Principali

- **Gestione Collezione Universale**: Aggiungi, rimuovi e sposta i dischi tra categorie (Personale, Wishlist, Eredità, In Vendita).
- **Integrazione Prezzi Live**: Calcolo in tempo reale del valore dei vinili collegandosi dinamicamente ai mercati collezionistici come Discogs.
- **Database Globale Iper-veloce**: Ricerca ultra-rapida su un catalogo globale tramite database SQLite locale (letto con HTTP VFS) ospitato su HuggingFace per una gestione senza limiti.
- **Scansione Intelligente dei Dati**: Pulsante dedicato per forzare la riscansione e completare automaticamente i metadati mancanti (tracklist, codici a barre, label) scansionando l'intera collezione contro il catalogo master.
- **Integrazione con GitHub**: L'app si sincronizza direttamente con il repository GitHub per salvare il tuo profilo, la tua libreria e leggere i dati della community tramite le API di GitHub.
- **Supporto PWA (Offline & Installabile)**: Service worker integrato per cache offline e installazione dell'app su desktop e smartphone.
- **Interfaccia Grafica Adattiva**: Grafica Glassmorphism ad altissimo contrasto. Lo sfondo e i colori dei menu cambiano magicamente adattandosi in tempo reale ai colori dominanti della copertina del vinile che stai visualizzando.

## 📂 Struttura della Repository

L'applicazione segue ora un'architettura a cartelle standard e modulare, ottimizzata per il deployment su GitHub Pages:

- 📄 **`index.html`**: Il punto di ingresso principale dell'app. Contiene lo scheletro della UI, i modal e le interfacce principali.
- 📄 **`sw.js` / `manifest.json`**: File necessari per la Progressive Web App (PWA). Il service worker gestisce la cache di tutti gli asset per il funzionamento offline.
- 📁 **`css/`**
  - **`style.css`**: Il foglio di stile globale. Include le definizioni CSS per il design Glassmorphism e le variabili cromatiche camaleontiche per adattarsi alle copertine.
- 📁 **`js/`**
  - **`script.js`**: Il motore frontend principale dell'app. Gestisce la manipolazione del DOM, il calcolo dei prezzi, e le logiche SQLite.
  - **`github-sync.js`**: Modulo API indipendente. Gestisce l'autenticazione tramite Token e le chiamate fetch per leggere/scrivere sul DB GitHub remoto.
  - **`three-bg.js`**: Modulo dedicato al motore 3D (Three.js) per l'animazione dello sfondo interattivo (particelle fluttuanti, tunnel ciano/viola).
- 📁 **`lib/`**
  - **`sqlite.worker.js` / `sql-wasm.wasm`**: I motori compilati WebAssembly di sql.js-httpvfs necessari per interrogare SQL nativamente nel browser.
- 📁 **`database/`**
  - **`config.json`**: Configurazione del database per il VFS.
- 📁 **`users/`**
  - Contiene i file JSON dei singoli utenti (le collezioni personali e wishlist aggiornate in tempo reale via GitHub API).

## 🛠 Modificare le Impostazioni Avanzate

Se vuoi "forkare" questa repository per farne una tua versione, dovrai modificare alcune costanti all'interno dei file JavaScript:

1. **Il repository GitHub di Sync**:
   Vai nel file **`js/github-sync.js`** alla riga 1:
   ```javascript
   export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0'; // o il nome della tua repo
   ```

2. **Password Amministratore (Admin Access)**:
   La password è utilizzata per autorizzare modifiche sensibili.
   Vai in **`js/script.js`**, cerca la funzione `checkAdminAccess` per poter aggiornare o cambiare la password.

3. **Il Token GitHub "Obfuscato"**:
   Per fare chiamate all'API GitHub anche prima che l'utente inserisca il proprio Token, c'è un token interno in `js/github-sync.js`.
   ```javascript
   const OBFUSCATED_TOKEN_PARTS = ["nh5","KpL", ...];
   ```

## 💻 Come avviare localmente per i test
Usa sempre un server locale (`Live Server` o un webserver Python) per navigare nella cartella. I moduli ECMAScript (`<script type="module">`) e le fetch a database WebAssembly non funzionano se apri il file cliccandolo due volte col protocollo `file://`.

Buona esplorazione e buona musica! 🎶
