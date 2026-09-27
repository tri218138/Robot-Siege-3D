import assert from "node:assert/strict";
import test from "node:test";

import { syncInstanceStore } from "../src/instance-store.js";

test("instance store reuses entries, removes missing IDs, and respects capacity", () => {
  const store = new Map();
  const removed = [];
  const create = ({ x }) => ({ x });
  const update = (instance, { x }) => {
    instance.x = x;
  };

  syncInstanceStore(
    [
      { id: "a", x: 1 },
      { id: "b", x: 2 },
      { id: "c", x: 3 },
    ],
    store,
    2,
    create,
    update,
  );
  assert.deepEqual([...store.keys()], ["a", "b"]);

  const originalB = store.get("b");
  syncInstanceStore(
    [
      { id: "b", x: 20 },
      { id: "c", x: 3 },
    ],
    store,
    2,
    create,
    update,
    (instance) => removed.push(instance),
  );

  assert.equal(store.get("b"), originalB);
  assert.equal(store.get("b").x, 20);
  assert.equal(store.has("a"), false);
  assert.equal(store.get("c").x, 3);
  assert.deepEqual(removed, [{ x: 1 }]);
});
