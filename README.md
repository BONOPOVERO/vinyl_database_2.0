# Vinyl Database 2.0 WebApp (Audit V2 Edition)

Questa repository contiene tutto il necessario per far girare localmente o ospitare su GitHub Pages la **Vinyl Database 2.0 WebApp**, un'applicazione completa per la gestione delle proprie collezioni di vinili con funzionalità di Community. Questa versione include l'imponente aggiornamento **Audit V2**, che rivoluziona le performance e l'architettura interna dell'applicazione!

## 🚀 Caratteristiche Principali

- **Gestione Collezione Personale**: Aggiungi, rimuovi e modifica i dischi della tua collezione.
- **Database Globale Iper-veloce**: Ricerca ultra-rapida su un catalogo globale grazie a un database locale in formato SQLite caricato nativamente tramite HTTP VFS (senza pesare sulla memoria RAM del browser).
- **Integrazione con GitHub Sicura**: L'app si sincronizza direttamente con il repository GitHub per salvare il tuo profilo e leggere i dati della community. **Sicurezza al primo posto**: non ci sono più chiavi offuscate nel codice! Tutti i token vengono inseriti in totale sicurezza dall'utente e salvati localmente in `localStorage`.
- **Esplora Community**: Scopri altri collezionisti, aggiungili agli amici e naviga nel loro database personale per vedere quali dischi possiedono.
- **Supporto PWA (Offline & Installabile)**: Service worker integrato per cache offline e installazione dell'app su desktop e smartphone.
- **Interfaccia Grafica Glassmorphism 3D**: Sfondo animato 3D (con Three.js) e interfacce eleganti "effetto vetro" per un design moderno e ultra-responsivo.

## ⚡ Novità dell'Aggiornamento Audit V2 (Architettura & Performance)

L'aggiornamento Audit V2 ha portato incredibili miglioramenti all'applicazione, rendendola molto più veloce, sicura e accessibile:

- **Risoluzione N+1 Database Queries**: Le query al database sono state drammaticamente ottimizzate grazie al batching tramite la clausola `IN` di SQLite. Niente più colli di bottiglia!
- **Rifattorizzazione Asincrona Integrale**: Tutti i cicli asincroni basati su `forEach` (notoriamente problematici) sono stati completamente rimossi e sostituiti con soluzioni `for...of` o `Promise.all` veloci ed efficienti.
- **Sicurezza Anti-XSS**: È stato introdotto un nuovo polyfill custom `safeInnerHTML` per manipolare il DOM, eliminando ogni possibile vulnerabilità XSS e garantendo la massima sicurezza dei dati mostrati nell'app.
- **Nuovo Meccanismo fetchWithRetry**: La vecchia gestione dei token offuscati, insicura e limitante, è stata rimpiazzata. L'app ora si affida ai token personali salvati in `localStorage` dell'utente, abbinati a una nuova eccezionale logica `fetchWithRetry` con *exponential backoff* per gestire elegantemente eventuali fallimenti delle API.
- **Miglioramenti di Accessibilità (a11y)**: I modali sono ora interamente navigabili da screen reader grazie all'introduzione estensiva dei tag `WAI-ARIA`. Inoltre, il background WebGL 3D ora rispetta la preferenza di sistema `prefers-reduced-motion` per evitare disagi agli utenti sensibili ai movimenti a schermo.
- **Ottimizzazione Three.js & Cache**: Lo script `three-bg.js` è stato fortemente alleggerito, ed è ora gestito molto più efficientemente e conservato nella cache dal nostro `sw.js` per avviarsi in tempi da record anche offline!

## 📁 Struttura della Repository

- **`index.html`**: Il punto di ingresso principale dell'app. Contiene l'intero scheletro della UI, i modal per le impostazioni, la community, il database globale e il profilo.
- **`style.css`**: Contiene tutte le regole grafiche e le animazioni (tema scuro, accenti neon, Glassmorphism).
- **`script.js`**: Il motore principale frontend dell'app. Gestisce la logica UI e le chiamate di base.
- **`github-sync.js`**: Il modulo chiave per le comunicazioni API con GitHub, dotato ora della meccanica *fetchWithRetry*.
- **`three-bg.js`**: Script dedicato all'animazione tridimensionale interattiva in background, altamente ottimizzato.
- **`master_catalog.db`**: Il database SQLite "globale" pre-compilato.
- **`sqlite.worker.js` / `sql-wasm.wasm`**: I motori worker necessari per eseguire le query SQL ad alta efficienza all'interno del browser web.
- **`sw.js` / `manifest.json`**: File base per la configurazione PWA e il caching (ora potenziato!).

## ⚙️ Modificare le Impostazioni Avanzate

Se vuoi "forkare" questa repository per farne una tua versione, dovrai modificare alcune costanti all'interno dei file JavaScript:

1. **Il repository GitHub di Sync**:
   Vai nel file **`github-sync.js`** alla riga 1:
   ```javascript
   export const GITHUB_REPO = 'BONOPOVERO/vinyl_database_2.0';
   ```
   *Sostituisci il nome con "tuo_nome/tua_repo" per fare in modo che i dati utente si salvino nella tua repository.*

2. **Password Amministratore (Admin Access)**:
   La password è utilizzata per autorizzare modifiche sensibili (es: aggiunte manuali fuori database).
   Vai in **`script.js`**, cerca la funzione `checkAdminAccess` per poter aggiornare o cambiare il livello di verifica:
   ```javascript
   const storedPass = "Yuta"; // o qualsiasi logica preferita
   ```

*(Nota: la gestione del token offuscato non è più necessaria! Fornisci semplicemente il tuo token personale direttamente nell'interfaccia utente sicura dell'applicazione.)*

## 🛠️ Come avviare localmente per i test
Se vuoi testare l'app in locale, ti sconsigliamo di aprirla col doppio clic (protocollo `file://`). Utilizza invece un qualsiasi server locale leggero (ad esempio `Live Server` su VSCode) per garantire che i caricamenti via `fetch()`, la cache del Service Worker e SQLite funzionino correttamente.

Buona esplorazione e buona musica! 🎵
