<script>
  import { TOOL } from '../lib/constants.js';
  import { coordToIndex, getPixelToSquareGrid } from '../lib/gridMath.js';
  import { getThemeColors } from '../lib/theme.js';
  import { solveMaze } from '../lib/mazeAlgorithms.js';
  import {
    buildOffscreenCanvas,
    renderFrame,
    renderSolvePath,
    paintSingleCell,
    getCanvasSize
  } from '../lib/renderers.js';

  let { gridData, W, H, currentTool, paintCell, eraseSolvePath = $bindable(), autoSolve = $bindable() } = $props();

  let canvasEl = $state(null);
  let containerEl = $state(null);
  let offscreen = null;
  let highlightCell = $state(null);
  let isPainting = $state(false);

  // Solve path: array of {x,y} pixel points; null = pen lift between strokes.
  let solvePath = [];

  // Expose erase function to parent via bindable prop.
  eraseSolvePath = () => {
    solvePath = [];
    renderAll(null);
  };

  // Expose auto-solve function to parent via bindable prop.
  autoSolve = () => {
    const path = solveMaze(gridData, W, H);
    if (!path) return;
    const half = cellSize / 2;
    solvePath = path.map(({ x, y }) => ({ x: x * cellSize + half, y: y * cellSize + half }));
    renderAll(null);
  };

  // Derive cell size from container dimensions.
  let cellSize = $state(12);

  // Leave ~5% on each side so the maze always has a visible border.
  const PADDING_FACTOR = 0.9;

  function computeCellSize() {
    if (!containerEl) return;
    const { width, height } = containerEl.getBoundingClientRect();
    const usableW = width * PADDING_FACTOR;
    const usableH = height * PADDING_FACTOR;
    cellSize = Math.max(4, Math.floor(Math.min(usableW / W, usableH / H)));
  }

  // Effect 1: set up ResizeObserver and compute initial cell size.
  // Reads: containerEl, W, H (via computeCellSize closure).
  // Writes: cellSize (via computeCellSize). Does NOT read cellSize — no loop.
  $effect(() => {
    if (!containerEl) return;
    computeCellSize();

    const ro = new ResizeObserver(() => {
      computeCellSize();
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // Effect 2: rebuild offscreen canvas when data, layout, or cell size changes.
  // Reads: gridData, W, H, cellSize, canvasEl, currentTool.
  // Writes: canvasEl.width/height, offscreen (not a read dependency here). No loop.
  $effect(() => {
    const data = gridData;
    const w = W;
    const h = H;
    const cs = cellSize;
    const tool = currentTool;

    if (!canvasEl || cs <= 0) return;

    const colors = getThemeColors();
    const { width, height } = getCanvasSize(w, h, cs);
    canvasEl.width = width;
    canvasEl.height = height;

    offscreen = buildOffscreenCanvas(data, w, h, cs, colors);
    solvePath = [];
    const ctx = canvasEl.getContext('2d');
    renderFrame(ctx, offscreen, null, cs, colors, tool);
  });

  function getCellFromEvent(e) {
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return getPixelToSquareGrid(px, py, cellSize);
  }

  function isInBounds(cell) {
    return cell.x >= 0 && cell.x < W && cell.y >= 0 && cell.y < H;
  }

  // Returns true if the solve line may pass through this cell (in bounds, not a hedge).
  function isDrawable(cell) {
    if (!isInBounds(cell)) return false;
    return gridData[coordToIndex(cell.x, cell.y, W)] !== TOOL.HEDGE;
  }

  function renderAll(highlight = highlightCell) {
    if (!canvasEl || !offscreen) return;
    const ctx = canvasEl.getContext('2d');
    const colors = getThemeColors();
    renderFrame(ctx, offscreen, highlight, cellSize, colors, currentTool);
    renderSolvePath(ctx, solvePath, colors.solve);
  }

  function applyPaint(cell) {
    if (!isInBounds(cell)) return;
    const index = coordToIndex(cell.x, cell.y, W);
    paintCell(index, currentTool);

    // Update offscreen in-place for partial repaint (no full rebuild).
    const colors = getThemeColors();
    paintSingleCell(offscreen, cell.x, cell.y, cellSize, colors, currentTool);
    renderAll();
  }

  function getPixelFromEvent(e) {
    const rect = canvasEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e) {
    isPainting = true;
    canvasEl.setPointerCapture(e.pointerId);

    if (currentTool === TOOL.SOLVE) {
      const cell = getCellFromEvent(e);
      if (!isDrawable(cell)) return;
      // Separate strokes with a null pen-lift marker.
      if (solvePath.length > 0) solvePath.push(null);
      solvePath.push(getPixelFromEvent(e));
      renderAll(null);
      return;
    }

    const cell = getCellFromEvent(e);
    applyPaint(cell);
  }

  function handlePointerMove(e) {
    if (currentTool === TOOL.SOLVE) {
      if (isPainting) {
        const cell = getCellFromEvent(e);
        if (isDrawable(cell)) {
          solvePath.push(getPixelFromEvent(e));
        } else {
          // Lift the pen when crossing into a hedge or outside the maze.
          const last = solvePath[solvePath.length - 1];
          if (last !== null && solvePath.length > 0) solvePath.push(null);
        }
        renderAll(null);
      }
      // No hover highlight in solve mode.
      return;
    }

    const cell = getCellFromEvent(e);

    if (isPainting) {
      applyPaint(cell);
    } else {
      // Hover highlight only
      if (!isInBounds(cell)) {
        highlightCell = null;
      } else {
        highlightCell = cell;
      }
      renderAll(highlightCell);
    }
  }

  function handlePointerUp() {
    isPainting = false;
  }

  function handlePointerLeave() {
    isPainting = false;
    highlightCell = null;
    renderAll(null);
  }

  // Expose canvas element for ExportButton via a module-level store isn't needed;
  // ExportButton can query the DOM directly.
</script>

<main
  bind:this={containerEl}
  class="w-full aspect-square overflow-auto flex items-center justify-center bg-base-300 p-4 md:flex-1 md:aspect-auto"
>
  <canvas
    bind:this={canvasEl}
    class="cursor-crosshair rounded shadow-lg"
    style="image-rendering: pixelated; touch-action: none;"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerLeave}
  ></canvas>
</main>
