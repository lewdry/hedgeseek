// Four orthogonal directions for square grids (step-2 carving).
export const SQUARE_DIRECTIONS = [
  [0, -2],
  [0, +2],
  [-2, 0],
  [+2, 0]
];

// --- Flat array helpers ---

export function coordToIndex(x, y, width) {
  return y * width + x;
}

export function indexToCoord(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

// --- Neighbor helpers (returns {cell, wall} pairs for carving) ---

export function getSquareNeighbors(x, y, W, H) {
  const neighbors = [];
  for (const [dx, dy] of SQUARE_DIRECTIONS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
      neighbors.push({
        cell: { x: nx, y: ny },
        wall: { x: x + dx / 2, y: y + dy / 2 }
      });
    }
  }
  return neighbors;
}

// --- Pixel-to-grid conversion ---

export function getPixelToSquareGrid(px, py, cellSize) {
  return {
    x: Math.floor(px / cellSize),
    y: Math.floor(py / cellSize)
  };
}


