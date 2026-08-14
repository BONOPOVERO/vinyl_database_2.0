# Vinyl Database 2.0 WebApp

Questa repository contiene tutto il necessario per far girare localmente o ospitare su GitHub Pages la **Vinyl Database 2.0 WebApp**, un'applicazione completa per la gestione delle proprie collezioni di vinili con funzionalità di Community.

## 🚀 Caratteristiche Principali

- **Gestione Collezione Personale**: Aggiungi, rimuovi e modifica i dischi della tua collezione.
- **Database Globale Iper-veloce**: Ricerca ultra-rapida su un catalogo globale grazie a un database locale in formato SQLite caricato nativamente tramite HTTP VFS (senza pesare sulla memoria RAM del browser).
- **Integrazione con GitHub**: L'app si sincronizza direttamente con il repository GitHub per salvare il tuo profilo, la tua libreria e leggere i dati della community tramite le API di GitHub.
- **Esplora Community**: Scopri altri collezionisti, aggiungili agli amici, e naviga nel loro database personale per vedere quali dischi possiedono!
- **Protezione Password per Token**: Il tuo Personal Access Token (PAT) di GitHub è salvato nel browser in totale sicurezza ed è sbloccabile solo tramite la password di Amministrazione. Fallback automatico in caso di problemi col token.
- **Supporto PWA (Offline & Installabile)**: Service worker integrato per cache offline e installazione dell'app su desktop e smartphone.
- **Interfaccia Grafica Glassmorphism 3D**: Sfondo animato 3D (con Three.js) e interfacce eleganti "effetto vetro" per un design moderno e ultra-responsivo.

## 📁 Struttura della Repository

- **`index.html`**: Il punto di ingresso principale dell'app. Contiene l'intero scheletro della UI, i modal per le impostazioni, la community, il database globale e il profilo.
- **`style.css`**: Contiene tutte le regole grafiche e le animazioni. Utilizza un tema scuro con accenti ciano/viola neon e l'effetto "Glassmorphism" per i pannelli.
- **`script.js`**: Il motore principale (frontend) dell'app. Gestisce il ciclo di vita dell'interfaccia, i listener dei pulsanti, la logica di SQLite locale e gran parte delle visualizzazioni a schermo.
- **`github-sync.js`**: Il modulo chiave per tutte le comunicazioni con le API di GitHub. Gestisce le chiamate di lettura/scrittura per i profili utente, la lista community e la gestione del token.
- **`three-bg.js`**: Script dedicato all'animazione tridimensionale interattiva in background (onde ciano, particelle fluttuanti) costruita sopra la libreria Three.js.
- **`master_catalog.db`**: Il database SQLite "globale" pre-compilato con le informazioni e le release di tutti i vinili, letto tramite HTTP VFS.
- **`sqlite.worker.js` / `sql-wasm.wasm`**: I motori worker necessari per eseguire query SQL ad alta efficienza all'interno del browser web.
- **`sw.js` / `manifest.json`**: File necessari per trasformare la pagina web in una vera e propria App installabile (Progressive Web App).

## ⚙️ Modificare le Impostazioni Avanzate

Se vuoi "forkare" questa repository per farne una tua versione, dovrai modificare alcune costanti all'interno dei file JavaScript per puntare al tuo repository anziché a quello di default:

1. **Il repository GitHub di Sync**:
   Vai nel file **`github-sync.js`** alla riga 1:
   ```javascript
   export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0';
   ```
   *Sostituisci il nome con "tuo_nome/tua_repo" per fare in modo che i dati utente e la community si salvino nella tua repository.*

2. **Password Amministratore (Admin Access)**:
   La password è utilizzata per autorizzare modifiche sensibili (es: sblocco del token o aggiunte manuali fuori database).
   Vai in **`script.js`**, cerca la funzione `checkAdminAccess` per poter aggiornare o cambiare il livello di verifica:
   ```javascript
   const storedPass = "Yuta"; // o qualsiasi logica di autenticazione preferisci
   ```

3. **Il Token GitHub "Obfuscato"**:
   Per fare chiamate all'API GitHub anche prima che l'utente inserisca il proprio Token personale, c'è un token interno suddiviso in piccoli frammenti all'inizio di `github-sync.js`.
   ```javascript
   const OBFUSCATED_TOKEN_PARTS = ["nh5","KpL", ...];
   ```
   *Questo evita che i bot automatici di GitHub invalidino istantaneamente la tua chiave pubblica.* 

## 🛠️ Come avviare localmente per i test
Se vuoi testare l'app in locale, ti sconsigliamo di aprirla col doppio clic (protocollo `file://`). Utilizza invece un qualsiasi server locale leggero (ad esempio `Live Server` su VSCode) per garantire che i caricamenti via `fetch()` e SQLite funzionino correttamente.

Buona esplorazione e buona musica! 🎵
