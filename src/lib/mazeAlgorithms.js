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
// Uses directional momentum: X% chance to continue in the same direction, producing longer,
// straighter corridors instead of the dense zig-zag aesthetic of a fully random backtracker.
const STRAIGHT_BIAS = 0.6;

function carve(grid, W, H, startX, startY, visited) {
  // Each stack frame carries the cell coords and the direction we arrived from.
  // lastDir is {dx, dy} in cell-space (step of 2), or null for the start.
  const stack = [{ x: startX, y: startY, lastDir: null }];

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
      // Annotate each candidate with its direction from the current cell.
      const candidates = unvisited.map(({ cell, wall }) => ({
        cell,
        wall,
        dx: cell.x - current.x,
        dy: cell.y - current.y,
      }));

      let chosen;
      if (
        current.lastDir !== null &&
        Math.random() < STRAIGHT_BIAS
      ) {
        // Try to continue straight.
        const straight = candidates.find(
          c => c.dx === current.lastDir.dx && c.dy === current.lastDir.dy
        );
        chosen = straight ?? shuffle(candidates)[0];
      } else {
        chosen = shuffle(candidates)[0];
      }

      const { cell, wall, dx, dy } = chosen;
      // Carve through the wall cell
      grid[coordToIndex(wall.x, wall.y, W)] = TOOL.PATH;
      grid[coordToIndex(cell.x, cell.y, W)] = TOOL.PATH;
      visited[coordToIndex(wall.x, wall.y, W)] = 1;
      visited[coordToIndex(cell.x, cell.y, W)] = 1;
      stack.push({ x: cell.x, y: cell.y, lastDir: { dx, dy } });
    }
  }
}

// Braid the maze by removing dead ends. `amount` is the probability [0,1] that
// any given dead end gets a loop punched through it.
function braid(grid, W, H, amount) {
  for (let y = 1; y < H - 1; y += 2) {
    for (let x = 1; x < W - 1; x += 2) {
      if (grid[coordToIndex(x, y, W)] !== TOOL.PATH) continue;

      // Build the four direction descriptors: wx/wy = wall cell, cx/cy = passage cell beyond.
      const dirs = [
        { wx: x,     wy: y - 1, cx: x,     cy: y - 2 },
        { wx: x,     wy: y + 1, cx: x,     cy: y + 2 },
        { wx: x - 1, wy: y,     cx: x - 2, cy: y     },
        { wx: x + 1, wy: y,     cx: x + 2, cy: y     },
      ].filter(d => d.cx >= 1 && d.cx < W - 1 && d.cy >= 1 && d.cy < H - 1);

      const open   = dirs.filter(d => grid[coordToIndex(d.wx, d.wy, W)] === TOOL.PATH);
      if (open.length !== 1) continue; // not a dead end

      if (Math.random() > amount) continue;

      const closed = dirs.filter(d => grid[coordToIndex(d.wx, d.wy, W)] === TOOL.HEDGE);
      if (closed.length === 0) continue;

      // Prefer walls leading into another dead end so two dead ends cancel each other.
      // Score each candidate once, then sort on cached score.
      for (const d of closed) {
        const neighbDirs = [
          { wx: d.cx,     wy: d.cy - 1, cx: d.cx,     cy: d.cy - 2 },
          { wx: d.cx,     wy: d.cy + 1, cx: d.cx,     cy: d.cy + 2 },
          { wx: d.cx - 1, wy: d.cy,     cx: d.cx - 2, cy: d.cy     },
          { wx: d.cx + 1, wy: d.cy,     cx: d.cx + 2, cy: d.cy     },
        ].filter(n => n.cx >= 1 && n.cx < W - 1 && n.cy >= 1 && n.cy < H - 1);
        const neighbourOpen = neighbDirs.filter(n => grid[coordToIndex(n.wx, n.wy, W)] === TOOL.PATH);
        d._score = (neighbDirs.length > 0 && neighbourOpen.length === 1) ? 1 : 0;
      }
      closed.sort((a, b) => b._score - a._score);

      const pick = closed[0];
      grid[coordToIndex(pick.wx, pick.wy, W)] = TOOL.PATH;
    }
  }
}

// Find the nearest valid carved cell to a target coordinate.
function nearestPathCell(grid, W, H, targetX, targetY) {
  const startIdx = coordToIndex(targetX, targetY, W);
  if (grid[startIdx] === TOOL.PATH) return { x: targetX, y: targetY };

  const visited = new Uint8Array(W * H);
  const queue = [startIdx];
  visited[startIdx] = 1;
  let head = 0;

  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % W, y = (idx - x) / W;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (visited[ni]) continue;
      if (grid[ni] === TOOL.PATH) return { x: nx, y: ny };
      visited[ni] = 1;
      queue.push(ni);
    }
  }
  return null;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Multi-source BFS from an array of start indices.
// Returns Int32Array of distances (-1 = unreachable).
// Treats everything except TOOL.HEDGE as walkable (matches solveMaze rules).
function bfsDistances(grid, W, H, startIndices) {
  const dist = new Int32Array(W * H).fill(-1);
  const queue = [];
  for (const idx of startIndices) {
    if (dist[idx] === -1) {
      dist[idx] = 0;
      queue.push(idx);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const { x, y } = indexToCoord(idx, W);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = coordToIndex(nx, ny, W);
      if (dist[ni] !== -1 || grid[ni] === TOOL.HEDGE) continue;
      dist[ni] = dist[idx] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

// Return the inner-border PATH cell adjacent to a border candidate.
function innerCell(c, W, H) {
  if (c.y === 0)     return { x: c.x, y: 1 };
  if (c.y === H - 1) return { x: c.x, y: H - 2 };
  if (c.x === 0)     return { x: 1,     y: c.y };
                     return { x: W - 2,  y: c.y };
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

// Priority tier for a passage cell as a border entry point:
// 0 = dead end, 1 = corner, 2 = straight corridor or junction.
function borderEntryTier(grid, W, H, x, y) {
  const dirs = [[0, -1], [0, 1], [1, 0], [-1, 0]];
  const open = dirs.filter(([dx, dy]) => {
    const wx = x + dx, wy = y + dy;
    return wx >= 0 && wx < W && wy >= 0 && wy < H && grid[coordToIndex(wx, wy, W)] === TOOL.PATH;
  });
  if (open.length === 1) return 0; // dead end
  if (open.length === 2) {
    const [[dx0, dy0], [dx1, dy1]] = open;
    const opposite = dx0 + dx1 === 0 && dy0 + dy1 === 0;
    return opposite ? 2 : 1; // straight corridor vs corner
  }
  return 2; // junction
}

// Return border candidates at the best available tier (0→1→all fallback).
function preferredBorderCandidates(grid, W, H, edge) {
  const all = borderCandidates(grid, W, H, edge);
  for (const tier of [0, 1]) {
    const filtered = all.filter(c => {
      const ic = innerCell(c, W, H);
      return borderEntryTier(grid, W, H, ic.x, ic.y) === tier;
    });
    if (filtered.length > 0) return filtered;
  }
  return all;
}

// Pick randomly from the middle y% of candidates ranked by BFS distance
// (i.e. the 55th–70th percentile). Avoids both trivially short and
// suspiciously perfect extreme routes.
function farthestCandidate(candidates, dist, W) {
  const scored = candidates
    .map(c => ({ c, d: dist[coordToIndex(c.x, c.y, W)] }))
    .filter(s => s.d >= 0)
    .sort((a, b) => a.d - b.d);

  if (scored.length === 0) return pickRandom(candidates);
  const lo = Math.floor(scored.length * 0.55);
  const hi = Math.ceil(scored.length * 0.70);
  return pickRandom(scored.slice(lo, hi)).c;
}

function placeEndpoints(grid, W, H, endpointType) {
  if (endpointType === 'goal') {
    // Plaza is fixed at the centre. Place the entrance as far from it as possible.
    let plazaIdx = -1;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === TOOL.PLAZA) { plazaIdx = i; break; }
    }

    if (plazaIdx === -1) {
      // Fallback: random edge (shouldn't happen in normal flow)
      const edges = ['top', 'bottom', 'left', 'right'];
      shuffle(edges);
      for (const edge of edges) {
        const candidates = borderCandidates(grid, W, H, edge);
        if (candidates.length > 0) {
          const pick = pickRandom(candidates);
          grid[coordToIndex(pick.x, pick.y, W)] = TOOL.ENTRANCE;
          break;
        }
      }
      return;
    }

    const dist = bfsDistances(grid, W, H, [plazaIdx]);
    let best = null, bestD = -1;
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      for (const c of preferredBorderCandidates(grid, W, H, edge)) {
        const ic = innerCell(c, W, H);
        const d = dist[coordToIndex(ic.x, ic.y, W)];
        if (d > bestD) { bestD = d; best = c; }
      }
    }
    if (best) grid[coordToIndex(best.x, best.y, W)] = TOOL.ENTRANCE;

  } else {
    // 'exit': pick the entrance/exit pair (opposite sides) that maximises BFS distance.
    function bestPairForAxis(sideA, sideB) {
      const cA = preferredBorderCandidates(grid, W, H, sideA);
      const cB = preferredBorderCandidates(grid, W, H, sideB);
      if (!cA.length || !cB.length) return null;

      // Find the entrance (sideA) that is farthest from any exit (sideB).
      const distFromB = bfsDistances(grid, W, H,
        cB.map(c => { const ic = innerCell(c, W, H); return coordToIndex(ic.x, ic.y, W); })
      );
      const entrance = farthestCandidate(
        cA,
        Object.fromEntries(cA.map(c => {
          const ic = innerCell(c, W, H);
          return [coordToIndex(c.x, c.y, W), distFromB[coordToIndex(ic.x, ic.y, W)]];
        })),
        W
      );

      // Find the exit (sideB) that is farthest from the chosen entrance.
      const ic = innerCell(entrance, W, H);
      const distFromEntrance = bfsDistances(grid, W, H, [coordToIndex(ic.x, ic.y, W)]);
      const exit = farthestCandidate(
        cB,
        Object.fromEntries(cB.map(c => {
          const eic = innerCell(c, W, H);
          return [coordToIndex(c.x, c.y, W), distFromEntrance[coordToIndex(eic.x, eic.y, W)]];
        })),
        W
      );

      const eic = innerCell(exit, W, H);
      const pathLength = distFromEntrance[coordToIndex(eic.x, eic.y, W)];
      return { entrance, exit, pathLength };
    }

    const h = bestPairForAxis('top', 'bottom');
    const v = bestPairForAxis('left', 'right');
    let chosen;
    if (!h && !v) return;
    else if (!h) chosen = v;
    else if (!v) chosen = h;
    else chosen = h.pathLength >= v.pathLength ? h : v;

    grid[coordToIndex(chosen.entrance.x, chosen.entrance.y, W)] = TOOL.ENTRANCE;
    grid[coordToIndex(chosen.exit.x, chosen.exit.y, W)] = TOOL.EXIT;
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
  braid(grid, width, height, 0.3);
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
  let head = 0;

  while (head < queue.length) {
    const idx = queue[head++];

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
    path.push(indexToCoord(cur, W));
    cur = parent[cur];
  }
  path.reverse();

  return path;
}
