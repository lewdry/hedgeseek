import { TOOL } from './constants.js';
import { coordToIndex } from './gridMath.js';

// --- Hedge dither tile ---

/**
 * Builds a 2×2 OffscreenCanvas with a checkerboard of the two hedge shades.
 * Using ctx.createPattern(tile, 'repeat') on this gives a fine ordered-dither
 * texture that can be reused across every hedge cell.
 */
function buildHedgeTile(hedgeColor, ditherColor) {
  const tile = new OffscreenCanvas(2, 2);
  const ctx = tile.getContext('2d');
  // (0,0) and (1,1) → base hedge color
  ctx.fillStyle = hedgeColor;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  // (1,0) and (0,1) → dither shade
  ctx.fillStyle = ditherColor;
  ctx.fillRect(1, 0, 1, 1);
  ctx.fillRect(0, 1, 1, 1);
  return tile;
}

// --- Square drawing ---

function drawSquareCell(ctx, x, y, cellSize, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
}

// --- Full grid draw ---

function drawSquareGrid(ctx, gridData, W, H, cellSize, colors, hedgePattern) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tile = gridData[coordToIndex(x, y, W)];
      const fill = (tile === TOOL.HEDGE && hedgePattern) ? hedgePattern : colors[tile];
      drawSquareCell(ctx, x, y, cellSize, fill);
    }
  }
}

// --- Canvas size helpers ---

export function getCanvasSize(W, H, cellSize) {
  return { width: W * cellSize, height: H * cellSize };
}

// --- Offscreen canvas ---

/**
 * Builds an OffscreenCanvas containing the full static maze geometry.
 * Returns the offscreen canvas so the main canvas can copy it with drawImage().
 */
export function buildOffscreenCanvas(gridData, W, H, cellSize, colors) {
  const { width, height } = getCanvasSize(W, H, cellSize);
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');

  // Pre-render one dither tile and derive a repeating pattern from it.
  const hedgeTile = buildHedgeTile(colors[TOOL.HEDGE], colors.hedgeDither);
  const hedgePattern = ctx.createPattern(hedgeTile, 'repeat');

  drawSquareGrid(ctx, gridData, W, H, cellSize, colors, hedgePattern);

  return offscreen;
}

/**
 * Renders a frame: copies the offscreen canvas then draws a single highlighted cell on top.
 * highlightCell is {x, y} or null.
 */
export function renderFrame(mainCtx, offscreen, highlightCell, cellSize, colors, currentTool) {
  mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
  mainCtx.drawImage(offscreen, 0, 0);

  if (highlightCell) {
    const { x, y } = highlightCell;
    const baseColor = colors[currentTool] ?? colors[TOOL.PATH];

    // Draw with slight transparency to show the hover intent.
    mainCtx.globalAlpha = 0.6;
    drawSquareCell(mainCtx, x, y, cellSize, baseColor);
    mainCtx.globalAlpha = 1.0;
  }
}

/**
 * Draws the freehand solve path on top of the main canvas.
 * solvePath is an array of {x, y} pixel points; null entries are pen-lift separators.
 */
export function renderSolvePath(ctx, solvePath, color) {
  if (!solvePath || solvePath.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'flat';
  ctx.lineJoin = 'flat';

  ctx.beginPath();
  let penDown = false;
  for (const pt of solvePath) {
    if (pt === null) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      ctx.moveTo(pt.x, pt.y);
      penDown = true;
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Redraws entrance, exit, and goal cells on top of the main canvas so they
 * appear above the solve path line (higher z-order).
 */
export function renderOverlayCells(ctx, gridData, W, H, cellSize, colors) {
  const OVERLAY_TILES = new Set([TOOL.ENTRANCE, TOOL.EXIT, TOOL.PLAZA]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tile = gridData[coordToIndex(x, y, W)];
      if (OVERLAY_TILES.has(tile)) {
        drawSquareCell(ctx, x, y, cellSize, colors[tile]);
      }
    }
  }
}

/**
 * Paints a single cell directly onto the offscreen canvas.
 * Call this after updating gridData so the offscreen stays in sync.
 */
export function paintSingleCell(offscreen, x, y, cellSize, colors, tileType) {
  const ctx = offscreen.getContext('2d');
  let fill = colors[tileType];
  if (tileType === TOOL.HEDGE) {
    const hedgeTile = buildHedgeTile(colors[TOOL.HEDGE], colors.hedgeDither);
    fill = ctx.createPattern(hedgeTile, 'repeat');
  }
  drawSquareCell(ctx, x, y, cellSize, fill);
}
