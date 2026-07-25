// Configurazione dei parametri (corrispondono alle props di React)
const CONFIG = {
  defaultSelected: 2,
  textColor: "#a6a6a6",
  activeColor: "#ffffff",
  fontSizeRem: 3,
  spacing: 1.4,
  curve: 1,
  tilt: 6,
  blur: 2,
  fade: 0.25,
  minOpacity: 0.05,
  loop: false,
  soundUrl: "/assets/sounds/click-soft.mp3"
};

// Selezioniamo gli elementi DOM
const container = document.getElementById("option-wheel");
const items = Array.from(container.querySelectorAll(".wheel-item"));

let selectedIndex = CONFIG.defaultSelected;
let isDragging = false;
let startY = 0;

// Caricamento audio opzionale
const clickSound = CONFIG.soundUrl ? new Audio(CONFIG.soundUrl) : null;

function playSound() {
  if (clickSound) {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  }
}

// Funzione principale che applica le trasformazioni 3D
function updateWheel() {
  items.forEach((item, index) => {
    let distance = index - selectedIndex;

    // Gestione del Loop
    if (CONFIG.loop) {
      const half = items.length / 2;
      if (distance > half) distance -= items.length;
      if (distance < -half) distance += items.length;
    }

    const absDist = Math.abs(distance);

    // Calcolo coordinate 3D
    const itemHeight = CONFIG.fontSizeRem * CONFIG.spacing; // in rem
    const translateY = distance * itemHeight;
    const curveOffset = Math.pow(absDist, 1.5) * CONFIG.curve * 12;
    const rotateX = distance * -CONFIG.tilt;
    const opacity = Math.max(CONFIG.minOpacity, 1 - absDist * CONFIG.fade);
    const blurAmount = absDist * CONFIG.blur;
    const isSelected = distance === 0;

    // Applicazione degli stili all'elemento HTML
    item.style.color = isSelected ? CONFIG.activeColor : CONFIG.textColor;
    item.style.fontWeight = isSelected ? "600" : "400";
    item.style.opacity = opacity;
    item.style.filter = `blur(${blurAmount}px)`;
    item.style.transform = `translate3d(${curveOffset}px, calc(${translateY}rem - 50%), 0) rotateX(${rotateX}deg)`;
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

// EVENTI: Scroll con la rotella del mouse
container.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY > 0) selectIndex(selectedIndex + 1);
  else if (e.deltaY < 0) selectIndex(selectedIndex - 1);
}, { passive: false });

// EVENTI: Trascinamento (Drag) con Mouse o Touch
container.addEventListener("pointerdown", (e) => {
  isDragging = true;
  startY = e.clientY;
});

window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  const deltaY = e.clientY - startY;
  const threshold = CONFIG.fontSizeRem * 16 * CONFIG.spacing * 0.4;

  if (Math.abs(deltaY) > threshold) {
    const step = deltaY > 0 ? -1 : 1;
    selectIndex(selectedIndex + step);
    startY = e.clientY;
  }
});

window.addEventListener("pointerup", () => { isDragging = false; });

// Inizializzazione al caricamento
updateWheel();