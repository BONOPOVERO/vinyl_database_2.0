// ==========================================
// CONFIGURAZIONE OPZIONI E PARAMETRI
// ==========================================
const CONFIG = {
  defaultSelected: 2,           // Indice dell'elemento selezionato all'avvio
  textColor: "#a6a6a6",         // Colore degli elementi a riposo
  activeColor: "#ffffff",       // Colore dell'elemento selezionato
  fontSizeRem: 3,               // Dimensione del font (rem)
  spacing: 1.4,                 // Spaziatura tra le opzioni
  curve: 1,                     // Intensità della curvatura
  tilt: 6,                      // Inclinazione 3D (gradi)
  blur: 2,                      // Sfocatura progressiva (px)
  fade: 0.25,                   // Trasparenza progressiva
  minOpacity: 0.05,             // Opacità minima per gli elementi lontani
  loop: false,                  // Se true, scorrimento infinito
  soundUrl: "/assets/sounds/click-soft.mp3", // Percorso dell'effetto audio (opzionale)
  soundVolume: 0.5
};

// ==========================================
// SELEZIONE ELEMENTI DOM E STATO INIZIALE
// ==========================================
const container = document.getElementById("option-wheel");
const items = Array.from(container.querySelectorAll(".wheel-item"));

let selectedIndex = CONFIG.defaultSelected;
let isDragging = false;
let startY = 0;

// Gestione Audio (carica il suono se il file esiste)
let clickSound = null;
if (CONFIG.soundUrl) {
  clickSound = new Audio(CONFIG.soundUrl);
  clickSound.volume = CONFIG.soundVolume;
}

function playSound() {
  if (clickSound) {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {}); // Ignora l'errore se l'autoplay è bloccato dal browser
  }
}

// ==========================================
// CALCOLO POSIZIONI E TRASFORMAZIONI 3D
// ==========================================
function updateWheel() {
  items.forEach((item, index) => {
    let distance = index - selectedIndex;

    // Calcolo del loop
    if (CONFIG.loop) {
      const half = items.length / 2;
      if (distance > half) distance -= items.length;
      if (distance < -half) distance += items.length;
    }

    const absDist = Math.abs(distance);

    // Calcoli per l'effetto 3D
    const itemHeight = CONFIG.fontSizeRem * CONFIG.spacing;
    const translateY = distance * itemHeight;

    // Curvatura per il LATO DESTRO (valore negativo per curvare verso l'interno)
    const curveOffset = -Math.pow(absDist, 1.5) * CONFIG.curve * 12;

    const rotateX = distance * -CONFIG.tilt;
    const opacity = Math.max(CONFIG.minOpacity, 1 - absDist * CONFIG.fade);
    const blurAmount = absDist * CONFIG.blur;
    const isSelected = distance === 0;

    // Applica le proprietà CSS all'elemento
    item.style.color = isSelected ? CONFIG.activeColor : CONFIG.textColor;
    item.style.fontWeight = isSelected ? "600" : "400";
    item.style.filter = `blur(${blurAmount}px)`;
    item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg)`;
    
    // Salva l'opacità di base del 3D come variabile CSS personalizzata
    item.style.setProperty('--base-opacity', opacity);
  });
}

function selectIndex(newIndex) {
  let target = newIndex;

  if (CONFIG.loop) {
    target = (newIndex + items.length) % items.length;
  } else {
    target = Math.max(0, Math.min(newIndex, items.length - 1));
  }

  if (target !== selectedIndex) {
    selectedIndex = target;
    playSound();
    updateWheel();
  }
}

// ==========================================
// EVENTI: SCROLL (MOUSE / TOUCHPAD)
// ==========================================
container.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY > 0) {
    selectIndex(selectedIndex + 1);
  } else if (e.deltaY < 0) {
    selectIndex(selectedIndex - 1);
  }
}, { passive: false });

// ==========================================
// EVENTI: TRASCINAMENTO (DESKTOP E MOBILE)
// ==========================================
container.addEventListener("pointerdown", (e) => {
  isDragging = true;
  startY = e.clientY;

  // Cattura il puntatore per non perdere l'interazione su Mobile se il dito esce dall'elemento
  if (e.target.setPointerCapture) {
    e.target.setPointerCapture(e.pointerId);
  }
});

window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  if (e.cancelable) {
    e.preventDefault(); // Previene lo scroll di pagina su smartphone
  }

  const deltaY = e.clientY - startY;
  const threshold = 25; // Pixel di scorrimento necessari per avanzare di 1 voce

  if (Math.abs(deltaY) > threshold) {
    const step = deltaY > 0 ? -1 : 1;
    selectIndex(selectedIndex + step);
    startY = e.clientY; // Resetta il punto di partenza per il prossimo passo
  }
});

window.addEventListener("pointerup", (e) => {
  if (isDragging) {
    isDragging = false;
    if (e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignora se la cattura è già stata rilasciata
      }
    }
  }
});

window.addEventListener("pointercancel", () => {
  isDragging = false;
});

// Inizializzazione al caricamento della pagina
updateWheel();
