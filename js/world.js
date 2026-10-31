// Dust II inspired grid map + raycasting helpers.

export const MAP_ROWS = [
  '################################',
  '#..............##..............#',
  '#..####..####..##..####..####..#',
  '#..#C....#..#......#..#....C#..#',
  '#..#.....#..#......#..#.....#..#',
  '#..####..#..########..#..####..#',
  '#........#............#........#',
  '####..####....####....####..####',
  '#.....C.......#..#.......C.....#',
  '#..####...##..#..#..##...####..#',
  '#..#......#C#......#C#......#..#',
  '#..#..##..#.#..##..#.#..##..#..#',
  '#.....##.....#..#.....##.....#.#',
  '##..####..C..#..#..C..####..##.#',
  '#......#.....#..#.....#......#.#',
  '#..##..#..####..####..#..##..#.#',
  '#..#...#.......P......#...#..#.#',
  '#..#...####..####..####...#..#.#',
  '#..#.......C.....C........#..#.#',
  '#..#...####..####..####...#..#.#',
  '#.......#....#....#....#.......#',
  '#..C....#..C.#....#..C.#....C..#',
  '#.......#....#....#....#.......#',
  '##########..##....##..##########',
  '#........#..#......#..#........#',
  '#..####..#..#..##..#..#..####..#',
  '#..#.........#....#.........#..#',
  '#..#..####...#....#...####..#..#',
  '#.....#..............#.....#...#',
  '#..C..#..C..#......#..C..#..C..#',
  '#.....#.....#......#.....#.....#',
  '################################',
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createWorld(rows = MAP_ROWS) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const grid = new Uint8Array(w * h);
  let spawn = { x: w / 2, y: h / 2, angle: Math.PI };

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '#';
      let tile = 0;
      if (ch === '#') tile = 1;
      else if (ch === 'C') tile = 2;
      else if (ch === 'D') tile = 3;
      else if (ch === '%') tile = 4;
      else if (ch === 'P') spawn = { x: x + 0.5, y: y + 0.5, angle: Math.PI };
      grid[y * w + x] = tile;
    }
  }

  const cell = (gx, gy) => (gx < 0 || gy < 0 || gx >= w || gy >= h ? 1 : grid[gy * w + gx]);

  const isSolidAt = (x, y) => cell(Math.floor(x), Math.floor(y)) > 0;

  const circleBlocked = (x, y, r) => {
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r);
    const y1 = Math.floor(y + r);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        if (cell(gx, gy) === 0) continue;
        const nx = clamp(x, gx, gx + 1);
        const ny = clamp(y, gy, gy + 1);
        const dx = x - nx;
        const dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  };

  // DDA raycast: distance to the first solid tile, its cell and impact point.
  const raycast = (px, py, dx, dy, maxDist = 64) => {
    let mapX = Math.floor(px);
    let mapY = Math.floor(py);
    const deltaX = dx === 0 ? 1e30 : Math.abs(1 / dx);
    const deltaY = dy === 0 ? 1e30 : Math.abs(1 / dy);
    const stepX = dx < 0 ? -1 : 1;
    const stepY = dy < 0 ? -1 : 1;
    let sideX = dx < 0 ? (px - mapX) * deltaX : (mapX + 1 - px) * deltaX;
    let sideY = dy < 0 ? (py - mapY) * deltaY : (mapY + 1 - py) * deltaY;
    let side = 0;
    let dist = 0;
    for (let i = 0; i < 256; i++) {
      if (sideX < sideY) {
        sideX += deltaX;
        mapX += stepX;
        side = 0;
        dist = sideX - deltaX;
      } else {
        sideY += deltaY;
        mapY += stepY;
        side = 1;
        dist = sideY - deltaY;
      }
      if (dist > maxDist) break;
      const t = cell(mapX, mapY);
      if (t > 0) {
        return {
          dist: Math.max(0.0001, dist),
          tile: t,
          gx: mapX,
          gy: mapY,
          side,
          x: px + dx * dist,
          y: py + dy * dist,
        };
      }
    }
    return null;
  };

  const lineOfSight = (ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    const hit = raycast(ax, ay, dx / len, dy / len, len);
    return !hit || hit.dist >= len - 0.02;
  };

  // Reachable open cells from spawn.
  const cells = [];
  const seen = new Uint8Array(w * h);
  const startX = Math.floor(spawn.x);
  const startY = Math.floor(spawn.y);
  const queue = [[startX, startY]];
  seen[startY * w + startX] = 1;
  while (queue.length) {
    const [cx, cy] = queue.shift();
    cells.push({ x: cx + 0.5, y: cy + 0.5, gx: cx, gy: cy });
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (seen[idx] || grid[idx] > 0) continue;
      seen[idx] = 1;
      queue.push([nx, ny]);
    }
  }

  const findPath = (sx, sy, tx, ty) => {
    const start = Math.floor(sy) * w + Math.floor(sx);
    const goal = Math.floor(ty) * w + Math.floor(tx);
    if (start === goal) return [];
    const prev = new Int32Array(w * h).fill(-1);
    const visited = new Uint8Array(w * h);
    const q = [start];
    visited[start] = 1;
    let head = 0;
    let found = false;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) {
        found = true;
        break;
      }
      const cx = cur % w;
      const cy = (cur / w) | 0;
      const neighbours = [
        cur + 1,
        cur - 1,
        cur + w,
        cur - w,
      ];
      const nx = [cx + 1, cx - 1, cx, cx];
      const ny = [cy, cy, cy + 1, cy - 1];
      for (let i = 0; i < 4; i++) {
        const n = neighbours[i];
        if (nx[i] < 0 || ny[i] < 0 || nx[i] >= w || ny[i] >= h) continue;
        if (visited[n] || grid[n] > 0) continue;
        visited[n] = 1;
        prev[n] = cur;
        q.push(n);
      }
    }
    if (!found) return [];
    const path = [];
    let cur = goal;
    while (cur !== start && cur >= 0) {
      path.push({ x: (cur % w) + 0.5, y: ((cur / w) | 0) + 0.5 });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  };

  return {
    w,
    h,
    grid,
    spawn,
    openCells: cells,
    cell,
    isSolidAt,
    circleBlocked,
    raycast,
    lineOfSight,
    findPath,
  };
}
