import { TOOL } from './constants.js';

// Emerald DaisyUI palette fallbacks (used when CSS variables aren't available, e.g. SSR).
const EMERALD_FALLBACK = {
  [TOOL.PATH]:     '#ecfdf5', // base-200 approx
  [TOOL.HEDGE]:    '#059669', // primary (emerald)
  [TOOL.PLAZA]:    '#ea5234', // accent (coral/red)
  [TOOL.ENTRANCE]: '#377cfb', // secondary (blue)
  [TOOL.EXIT]:     '#ea5234'  // accent (coral/red)
};

// Read a DaisyUI CSS variable from the document root and return it as a usable color string.
// DaisyUI 4+ exposes them as oklch() values in CSS custom properties.
function readVar(name) {
  if (typeof document === 'undefined') return null;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || null;
}

/**
 * Returns a color map keyed by TOOL integer values.
 * Colors are read at runtime from the active DaisyUI theme CSS variables so they
 * automatically match any theme without hardcoded hex values.
 */
export function getThemeColors() {
  // DaisyUI 4 exposes variables as raw oklch channel values (no wrapping function).
  // We must wrap them ourselves when assigning to canvas fillStyle.
  function oklch(varName) {
    const raw = readVar(varName);
    if (!raw) return null;
    // If it already has a CSS function wrapper just return it.
    if (raw.startsWith('oklch(') || raw.startsWith('rgb') || raw.startsWith('#')) return raw;
    return `oklch(${raw})`;
  }

  // Derive a darker shade of an oklch variable for dithering.
  // DaisyUI 5 returns full oklch(L C H) strings; DaisyUI 3/4 returned raw channel values.
  function oklchDarker(varName, delta = 0.06) {
    const raw = readVar(varName);
    if (!raw) return null;

    let channelStr;
    if (raw.startsWith('oklch(')) {
      channelStr = raw.slice(6, -1).trim(); // strip "oklch(" and ")"
    } else if (raw.startsWith('rgb') || raw.startsWith('#')) {
      return null; // can't easily darken these formats
    } else {
      channelStr = raw.trim();
    }

    const parts = channelStr.split(/\s+/);
    if (parts.length < 3) return null;
    const isPct = parts[0].endsWith('%');
    let L = parseFloat(parts[0]);
    if (isPct) L /= 100;
    L = Math.max(0, L - delta);
    const lStr = isPct ? `${(L * 100).toFixed(2)}%` : L.toFixed(4);
    return `oklch(${lStr} ${parts[1]} ${parts[2]})`;
  }

  return {
    [TOOL.PATH]:     oklch('--color-base-200')  || EMERALD_FALLBACK[TOOL.PATH],
    [TOOL.HEDGE]:    oklch('--color-primary')   || EMERALD_FALLBACK[TOOL.HEDGE],
    [TOOL.PLAZA]:    oklch('--color-accent')    || EMERALD_FALLBACK[TOOL.PLAZA],
    [TOOL.ENTRANCE]: oklch('--color-secondary') || EMERALD_FALLBACK[TOOL.ENTRANCE],
    [TOOL.EXIT]:     oklch('--color-accent')    || EMERALD_FALLBACK[TOOL.EXIT],
    hedgeDither:     oklchDarker('--color-primary', 0.22) || '#022c22', // much darker emerald for dither
    solve:           oklch('--color-secondary') || '#377cfb' // blue solve line
  };
}
