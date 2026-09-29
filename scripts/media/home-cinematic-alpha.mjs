import sharp from "sharp";

/** Conservative cleanup. It removes extraction noise, never shifts a subject. */
export async function cleanCinematicAlpha(source, family) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height, pixels = width * height;
  const alpha = new Uint8Array(pixels);
  let removedLowAlpha = 0, removedColorFringe = 0;
  for (let i = 0; i < pixels; i++) {
    const at = i * 4;
    const a = data[at + 3];
    // The sources have low-alpha matte ghosts; no legitimate actor is that faint.
    if (a < 72) { if (a) removedLowAlpha++; continue; }
    if (family === "box") {
      const r = data[at], g = data[at + 1], b = data[at + 2];
      // Cardboard has no saturated signal-red or neon-yellow pigment.
      if ((r > 160 && g < 88 && r > g * 1.7) || (r > 175 && g > 130 && b < 72 && r > b * 2.6)) {
        removedColorFringe++;
        continue;
      }
    }
    alpha[i] = a;
  }

  // Remove only small isolated islands. Large separate people, boxes, mirrors and
  // route branches remain, so no subject is recentered or independently cropped.
  const visited = new Uint8Array(pixels);
  const stack = new Int32Array(pixels);
  const minimumIsland = Math.max(18, Math.floor(pixels * .000025));
  let disconnectedComponents = 0, removedIslands = 0, removedIslandPixels = 0;
  for (let seed = 0; seed < pixels; seed++) {
    if (!alpha[seed] || visited[seed]) continue;
    let head = 0, tail = 1;
    stack[0] = seed;
    visited[seed] = 1;
    while (head < tail) {
      const pos = stack[head++], x = pos % width, y = (pos - x) / width;
      let next = pos - 1;
      if (x && !visited[next] && alpha[next]) { visited[next] = 1; stack[tail++] = next; }
      next = pos + 1;
      if (x < width - 1 && !visited[next] && alpha[next]) { visited[next] = 1; stack[tail++] = next; }
      next = pos - width;
      if (y && !visited[next] && alpha[next]) { visited[next] = 1; stack[tail++] = next; }
      next = pos + width;
      if (y < height - 1 && !visited[next] && alpha[next]) { visited[next] = 1; stack[tail++] = next; }
    }
    disconnectedComponents++;
    if (tail < minimumIsland) {
      removedIslands++;
      removedIslandPixels += tail;
      for (let i = 0; i < tail; i++) alpha[stack[i]] = 0;
    }
  }

  let left = width, right = -1, top = height, bottom = -1, visible = 0;
  for (let i = 0; i < pixels; i++) {
    const at = i * 4;
    data[at + 3] = alpha[i];
    if (!alpha[i]) { data[at] = 0; data[at + 1] = 0; data[at + 2] = 0; continue; }
    visible++;
    const x = i % width, y = (i - x) / width;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  if (!visible) throw new Error(`Alpha cleanup removed every pixel from ${source}`);
  const visibleBounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  return {
    buffer: data,
    width, height, visibleBounds,
    visibleAreaPercentage: Number((visible / pixels * 100).toFixed(3)),
    disconnectedComponents,
    removedIslands,
    removedIslandPixels,
    removedLowAlpha,
    removedColorFringe,
    edgeCleanupApplied: removedLowAlpha + removedColorFringe + removedIslandPixels > 0,
  };
}
