import { TOOL } from './constants.js';
import {
  coordToIndex,
  indexToCoord,
  getSquareNeighbors
} from './gridMath.js';

// Shuffle an array in-place using Fisher-Yates.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Iterative recursive backtracker (stack-based to avoid call-stack overflow on large grids).
// `visited` is passed in so the caller can pre-mark cells (e.g. a plaza) before carving starts.
function carve(grid, W, H, startX, startY, visited) {
  const stack = [{ x: startX, y: startY }];

  grid[coordToIndex(startX, startY, W)] = TOOL.PATH;
  visited[coordToIndex(startX, startY, W)] = 1;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getSquareNeighbors(current.x, current.y, W, H);

    const unvisited = neighbors.filter(
      ({ cell }) => !visited[coordToIndex(cell.x, cell.y, W)]
    );

    if (unvisited.length === 0) {
      stack.pop();
    } else {
      const { cell, wall } = shuffle(unvisited)[0];
      // Carve through the wall cell
      grid[coordToIndex(wall.x, wall.y, W)] = TOOL.PATH;
      grid[coordToIndex(cell.x, cell.y, W)] = TOOL.PATH;
      visited[coordToIndex(wall.x, wall.y, W)] = 1;
      visited[coordToIndex(cell.x, cell.y, W)] = 1;
      stack.push(cell);
    }
  }
}

// Find the nearest valid carved cell to a target coordinate.
function nearestPathCell(grid, W, H, targetX, targetY) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[coordToIndex(x, y, W)] === TOOL.PATH) {
        const d = (x - targetX) ** 2 + (y - targetY) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = { x, y };
        }
      }
    }
  }
  return best;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// PATH cells live at odd coords; the border row/col is always wall.
// Scan one row/column inward to collect openable border positions.
function borderCandidates(grid, W, H, edge) {
  const candidates = [];
  if (edge === 'top') {
    for (let x = 1; x < W - 1; x += 2) {
      if (grid[coordToIndex(x, 1, W)] === TOOL.PATH)
        candidates.push({ x, y: 0 });
    }
  } else if (edge === 'bottom') {
    for (let x = 1; x < W - 1; x += 2) {
      if (grid[coordToIndex(x, H - 2, W)] === TOOL.PATH)
        candidates.push({ x, y: H - 1 });
    }
  } else if (edge === 'left') {
    for (let y = 1; y < H - 1; y += 2) {
      if (grid[coordToIndex(1, y, W)] === TOOL.PATH)
        candidates.push({ x: 0, y });
    }
  } else if (edge === 'right') {
    for (let y = 1; y < H - 1; y += 2) {
      if (grid[coordToIndex(W - 2, y, W)] === TOOL.PATH)
        candidates.push({ x: W - 1, y });
    }
  }
  return candidates;
}

function placeEndpoints(grid, W, H, endpointType) {
  if (endpointType === 'goal') {
    // Plaza is already seeded in generateMaze; just punch a single entrance on a random border edge.
    const edges = ['top', 'bottom', 'left', 'right'];
    shuffle(edges);
    for (const edge of edges) {
      const candidates = borderCandidates(grid, W, H, edge);
      if (candidates.length > 0) {
        const entry = pickRandom(candidates);
        grid[coordToIndex(entry.x, entry.y, W)] = TOOL.ENTRANCE;
        break;
      }
    }
  } else {
    // 'exit': ENTRANCE top/left boundary, EXIT bottom/right boundary.
    const pair = Math.random() < 0.5 ? ['top', 'bottom'] : ['left', 'right'];
    const entranceCandidates = borderCandidates(grid, W, H, pair[0]);
    const exitCandidates = borderCandidates(grid, W, H, pair[1]);

    if (entranceCandidates.length > 0) {
      const entry = pickRandom(entranceCandidates);
      grid[coordToIndex(entry.x, entry.y, W)] = TOOL.ENTRANCE;
    }
    if (exitCandidates.length > 0) {
      const ex = pickRandom(exitCandidates);
      grid[coordToIndex(ex.x, ex.y, W)] = TOOL.EXIT;
    }
  }
}

export function generateMaze(width, height, endpointType) {
  const grid = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  grid.fill(TOOL.HEDGE);

  let startX = 1;
  let startY = 1;

  if (endpointType === 'goal') {
    // Find the nearest odd-coordinate center cell.
    let cx = Math.floor(width / 2);
    if (cx % 2 === 0) cx++;
    let cy = Math.floor(height / 2);
    if (cy % 2 === 0) cy++;

    // Seed a single-tile plaza (1×1). The even-coordinate hedge cells
    // surrounding it stay intact, keeping it fully enclosed.
    if (cy + 2 < height - 1 && cx >= 1 && cx <= width - 2) {
      grid[coordToIndex(cx, cy, width)] = TOOL.PLAZA;
      visited[coordToIndex(cx, cy, width)] = 1;

      // Open a single doorway in the wall immediately below the plaza.
      grid[coordToIndex(cx, cy + 1, width)] = TOOL.PATH;
      visited[coordToIndex(cx, cy + 1, width)] = 1;

      // Seed the backtracker from just outside the doorway so the rest of
      // the maze grows outward from that one opening.
      startX = cx;
      startY = cy + 2;
    }
  }

  carve(grid, width, height, startX, startY, visited);
  placeEndpoints(grid, width, height, endpointType);

  return grid;
}

/**
 * BFS shortest-path solver.
 * Returns an ordered array of {x, y} grid-cell coordinates from ENTRANCE to the
 * first EXIT or PLAZA found, or null if no solution exists.
 */
export function solveMaze(gridData, W, H) {
  let entrance = null;
  const targetSet = new Set();

  for (let i = 0; i < gridData.length; i++) {
    if (gridData[i] === TOOL.ENTRANCE) entrance = indexToCoord(i, W);
    if (gridData[i] === TOOL.EXIT || gridData[i] === TOOL.PLAZA) targetSet.add(i);
  }

  if (!entrance || targetSet.size === 0) return null;

  const startIdx = coordToIndex(entrance.x, entrance.y, W);
  const visited = new Uint8Array(W * H);
  const parent = new Int32Array(W * H).fill(-1);
  const queue = [startIdx];
  visited[startIdx] = 1;

  let found = -1;

  while (queue.length > 0) {
    const idx = queue.shift();

    if (targetSet.has(idx)) {
      found = idx;
      break;
    }

    const { x, y } = indexToCoord(idx, W);

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const nIdx = coordToIndex(nx, ny, W);
      if (visited[nIdx] || gridData[nIdx] === TOOL.HEDGE) continue;
      visited[nIdx] = 1;
      parent[nIdx] = idx;
      queue.push(nIdx);
    }
  }

  if (found === -1) return null;

  // Reconstruct path from goal back to start.
  const path = [];
  let cur = found;
  while (cur !== -1) {
    path.unshift(indexToCoord(cur, W));
    cur = parent[cur];
  }

  return path;
}
