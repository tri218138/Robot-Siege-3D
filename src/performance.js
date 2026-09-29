export function selectNearestIds(items, originX, originZ, limit) {
  if (limit <= 0 || items.length === 0) return new Set();

  return new Set(
    items
      .map((item, index) => ({
        id: item.id,
        index,
        distance:
          (item.x - originX) * (item.x - originX) +
          (item.z - originZ) * (item.z - originZ),
      }))
      .sort(
        (left, right) =>
          left.distance - right.distance || left.index - right.index,
      )
      .slice(0, limit)
      .map(({ id }) => id),
  );
}

function cellCoordinate(value, cellSize) {
  return Math.floor(value / cellSize);
}

function cellKey(x, z) {
  return `${x},${z}`;
}

export function buildSpatialGrid(items, cellSize) {
  const cells = new Map();

  for (const item of items) {
    const x = cellCoordinate(item.x, cellSize);
    const z = cellCoordinate(item.z, cellSize);
    const key = cellKey(x, z);
    const cell = cells.get(key);
    if (cell) cell.push(item);
    else cells.set(key, [item]);
  }

  return { cellSize, cells };
}

export function querySpatialGrid(grid, position, radius) {
  const centerX = cellCoordinate(position.x, grid.cellSize);
  const centerZ = cellCoordinate(position.z, grid.cellSize);
  const cellRadius = Math.ceil(radius / grid.cellSize);
  const items = [];

  for (let x = centerX - cellRadius; x <= centerX + cellRadius; x += 1) {
    for (let z = centerZ - cellRadius; z <= centerZ + cellRadius; z += 1) {
      const cell = grid.cells.get(cellKey(x, z));
      if (cell) items.push(...cell);
    }
  }

  return items;
}
