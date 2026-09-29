import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSpatialGrid,
  querySpatialGrid,
  selectNearestIds,
} from "../src/performance.js";

test("nearest enemy selection is bounded and stable for equal distances", () => {
  const enemies = [
    { id: "far", x: 8, z: 8 },
    { id: "first-tie", x: 1, z: 0 },
    { id: "nearest", x: 0.25, z: 0.25 },
    { id: "second-tie", x: -1, z: 0 },
  ];

  assert.deepEqual(
    [...selectNearestIds(enemies, 0, 0, 3)],
    ["nearest", "first-tie", "second-tie"],
  );
  assert.deepEqual([...selectNearestIds(enemies, 0, 0, 0)], []);
  assert.deepEqual([...selectNearestIds([], 0, 0, 3)], []);
});

test("spatial grid only returns items from cells intersecting the query", () => {
  const nearLeft = { id: "near-left", x: -0.1, z: 0 };
  const nearRight = { id: "near-right", x: 1.1, z: 0.2 };
  const far = { id: "far", x: 8, z: 8 };
  const grid = buildSpatialGrid([nearLeft, nearRight, far], 1.25);

  assert.deepEqual(
    new Set(querySpatialGrid(grid, { x: 0, z: 0 }, 1.25)),
    new Set([nearLeft, nearRight]),
  );
});
