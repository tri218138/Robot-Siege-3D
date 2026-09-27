export function syncInstanceStore(
  items,
  store,
  capacity,
  createInstance,
  updateInstance,
  onRemove,
) {
  const currentIds = new Set(items.map(({ id }) => id));

  for (const [id, instance] of store) {
    if (currentIds.has(id)) continue;
    onRemove?.(instance);
    store.delete(id);
  }

  for (const item of items) {
    let instance = store.get(item.id);

    if (!instance) {
      if (store.size >= capacity) continue;
      instance = createInstance(item);
      store.set(item.id, instance);
    } else {
      updateInstance(instance, item);
    }
  }
}
