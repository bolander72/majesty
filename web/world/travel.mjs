// Commit the visible scene before optional camera metadata is persisted.
// A camera-write error must not pair the old view with newly loaded terrain.
export async function travel(stream, target, width, height, present) {
  const camera = await stream.move(target.x, target.y, width, height);
  present(camera);
  try {
    await stream.store.write('camera-v1', camera);
    return null;
  } catch (error) { return error; }
}
