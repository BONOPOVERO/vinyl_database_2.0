/**
 * Liquid Glass FX Engine
 * Faithful recreation of nikdelvin/liquid-glass (iOS 26 Liquid Glass)
 * Pure CSS & SVG displacement mapping with chromatic aberration and automatic resize handling.
 */

const supportsBackdropFilterUrl = (() => {
  if (typeof document === 'undefined') return false;
  const testEl = document.createElement('div');
  testEl.style.cssText = 'backdrop-filter: url(#test)';
  const supported =
    testEl.style.backdropFilter === 'url(#test)' ||
    testEl.style.backdropFilter === 'url("#test")';
  return supported;
})();

export const getDisplacementMap = ({ height, width, radius, depth }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
        .mix { mix-blend-mode: screen; }
    </style>
    <defs>
        <linearGradient 
          id="Y" 
          x1="0" 
          x2="0" 
          y1="${Math.max(0, Math.ceil((radius / Math.max(1, height)) * 15))}%" 
          y2="${Math.min(100, Math.floor(100 - (radius / Math.max(1, height)) * 15))}%">
            <stop offset="0%" stop-color="#0F0" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
        <linearGradient 
          id="X" 
          x1="${Math.max(0, Math.ceil((radius / Math.max(1, width)) * 15))}%" 
          x2="${Math.min(100, Math.floor(100 - (radius / Math.max(1, width)) * 15))}%"
          y1="0" 
          y2="0">
            <stop offset="0%" stop-color="#F00" />
            <stop offset="100%" stop-color="#000" />
        </linearGradient>
    </defs>

    <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
    <g filter="blur(2px)">
      <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#Y)" class="mix" />
      <rect x="0" y="0" height="${height}" width="${width}" fill="url(#X)" class="mix" />
      <rect
          x="${depth}"
          y="${depth}"
          height="${Math.max(1, height - 2 * depth)}"
          width="${Math.max(1, width - 2 * depth)}"
          fill="#808080"
          rx="${radius}"
          ry="${radius}"
          filter="blur(${depth}px)"
      />
    </g>
</svg>`);

export const getDisplacementFilter = ({
  height,
  width,
  radius,
  depth,
  strength = 60,
  chromaticAberration = 2,
}) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="displace" color-interpolation-filters="sRGB">
            <feImage x="0" y="0" height="${height}" width="${width}" href="${getDisplacementMap({
              height,
              width,
              radius,
              depth,
            })}" result="displacementMap" />
            <feDisplacementMap
                transform-origin="center"
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration * 2}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="displacedR"
            />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength + chromaticAberration}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="displacedG"
            />
            <feDisplacementMap
                in="SourceGraphic"
                in2="displacementMap"
                scale="${strength}"
                xChannelSelector="R"
                yChannelSelector="G"
            />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="displacedB"
            />
            <feBlend in="displacedR" in2="displacedG" mode="screen"/>
            <feBlend in2="displacedB" mode="screen"/>
        </filter>
    </defs>
</svg>`) + '#displace';

export function applyLiquidGlass(element, options = {}) {
  if (!element) return;

  const depth = options.depth ?? parseFloat(element.dataset.depth || '8');
  const strength = options.strength ?? parseFloat(element.dataset.strength || '45');
  const chromaticAberration = options.chromaticAberration ?? parseFloat(element.dataset.cab || '2');
  const blur = options.blur ?? parseFloat(element.dataset.blur || '0');
  const saturate = options.saturate ?? parseFloat(element.dataset.saturate || '1.35');
  const brightness = options.brightness ?? parseFloat(element.dataset.brightness || '1.08');

  const rect = element.getBoundingClientRect();
  const width = Math.max(16, Math.round(rect.width));
  const height = Math.max(16, Math.round(rect.height));

  const computedStyle = window.getComputedStyle(element);
  const radius = parseFloat(computedStyle.borderRadius || '20') || 20;

  if (supportsBackdropFilterUrl) {
    const filterUrl = getDisplacementFilter({
      height,
      width,
      radius,
      depth,
      strength,
      chromaticAberration,
    });
    element.style.backdropFilter = `blur(${blur / 2}px) url('${filterUrl}') blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
    element.style.webkitBackdropFilter = element.style.backdropFilter;
  } else {
    // Ultra-polished fallback using multi-layer blur & saturation
    element.style.backdropFilter = `blur(18px) saturate(${saturate * 1.2}) brightness(${brightness})`;
    element.style.webkitBackdropFilter = `blur(18px) saturate(${saturate * 1.2}) brightness(${brightness})`;
  }
}

let resizeObserverInstance = null;

export function initLiquidGlass(root = document) {
  const elements = root.querySelectorAll('.liquid-glass-elem, .liquid-glass-card, .liquid-glass-btn, .liquid-glass-dock, .liquid-glass-panel, .glass-card');
  
  if (!resizeObserverInstance && typeof ResizeObserver !== 'undefined') {
    resizeObserverInstance = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyLiquidGlass(entry.target);
      }
    });
  }

  elements.forEach((el) => {
    applyLiquidGlass(el);
    if (resizeObserverInstance) {
      resizeObserverInstance.observe(el);
    }
  });
}
