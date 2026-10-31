import { BLOCKS, TILES, faceTile } from './blocks.js';

const ATLAS_TILES = 8;      // 8 x 8 tiles
const TILE = 16;            // pixels per tile
export const ATLAS_SIZE = ATLAS_TILES * TILE;

// deterministic little RNG so every session gets identical textures
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const p = (ctx, x, y, color, alpha = 1) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
  ctx.globalAlpha = 1;
};

function sprinkle(ctx, ox, oy, colors, amount, rng, w = TILE, h = TILE) {
  for (let i = 0; i < amount; i++) {
    const x = ox + Math.floor(rng() * w);
    const y = oy + Math.floor(rng() * h);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(x, y, 1, 1);
  }
}

function fill(ctx, ox, oy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(ox, oy, TILE, TILE);
}

function drawTile(ctx, index, draw) {
  const ox = (index % ATLAS_TILES) * TILE;
  const oy = Math.floor(index / ATLAS_TILES) * TILE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, TILE, TILE);
  ctx.clip();
  draw(ctx, ox, oy, mulberry32(0x9e37 + index * 7919));
  ctx.restore();
}

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  const dirtCols = ['#8a5a33', '#946239', '#7c4f2c', '#9d6a3d', '#845530'];
  const grassCols = ['#6fae48', '#79ba50', '#649f40', '#82c45a', '#5d963a'];
  const stoneCols = ['#8b8b8b', '#808080', '#969696', '#777777', '#909090'];
  const sandCols = ['#e4d3a0', '#dcc994', '#ecdcad', '#d6c28b'];
  const snowCols = ['#f3f8fb', '#e8f0f6', '#dde8ef', '#ffffff'];

  // 0 grass top
  drawTile(ctx, TILES.grass_top, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#6aa845');
    sprinkle(c, ox, oy, grassCols, 130, rng);
    for (let i = 0; i < 9; i++) {
      const x = ox + 1 + Math.floor(rng() * 14);
      const y = oy + 2 + Math.floor(rng() * 11);
      c.fillStyle = rng() > 0.5 ? '#88c95f' : '#5b9638';
      c.fillRect(x, y, 1, 2);
    }
  });

  // 1 grass side
  drawTile(ctx, TILES.grass_side, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8a5a33');
    sprinkle(c, ox, oy, dirtCols, 150, rng);
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < depth; y++) {
        p(c, ox + x, oy + y, grassCols[Math.floor(rng() * grassCols.length)]);
      }
      if (rng() > 0.55) p(c, ox + x, oy + depth, '#5d963a');
    }
  });

  // 2 dirt
  drawTile(ctx, TILES.dirt, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8a5a33');
    sprinkle(c, ox, oy, dirtCols, 180, rng);
    for (let i = 0; i < 8; i++) {
      const x = ox + Math.floor(rng() * 15), y = oy + Math.floor(rng() * 15);
      c.fillStyle = '#6d4526';
      c.fillRect(x, y, 2, 1);
    }
  });

  // 3 stone
  drawTile(ctx, TILES.stone, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8b8b8b');
    sprinkle(c, ox, oy, stoneCols, 190, rng);
    for (let i = 0; i < 5; i++) {
      const x = ox + Math.floor(rng() * 13), y = oy + Math.floor(rng() * 15);
      c.fillStyle = '#6f6f6f';
      c.fillRect(x, y, 2 + Math.floor(rng() * 2), 1);
      c.fillStyle = '#a0a0a0';
      c.fillRect(x, y - 1, 2, 1);
    }
  });

  // 4 cobblestone
  drawTile(ctx, TILES.cobble, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#656565');
    const cells = [[0, 0, 7, 6], [8, 0, 8, 8], [0, 7, 6, 9], [7, 9, 9, 7], [7, 6, 4, 3], [11, 7, 5, 2]];
    cells.forEach(([x, y, w, h], i) => {
      const base = ['#9a9a9a', '#8d8d8d', '#a3a3a3', '#878787', '#959595', '#a8a8a8'][i % 6];
      c.fillStyle = base;
      c.fillRect(ox + x, oy + y, w, h);
      c.fillStyle = 'rgba(255,255,255,.2)';
      c.fillRect(ox + x, oy + y, w, 1);
      c.fillRect(ox + x, oy + y, 1, h);
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.fillRect(ox + x, oy + y + h - 1, w, 1);
      c.fillRect(ox + x + w - 1, oy + y, 1, h);
      sprinkle(c, ox + x, oy + y, ['#b0b0b0', '#7d7d7d'], Math.floor(w * h / 5), rng, w, h);
    });
  });

  // 5 sand
  drawTile(ctx, TILES.sand, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#e4d3a0');
    sprinkle(c, ox, oy, sandCols, 190, rng);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = '#cbb681';
      c.fillRect(ox + Math.floor(rng() * 14), oy + Math.floor(rng() * 15), 2, 1);
    }
  });

  // 6 log side
  drawTile(ctx, TILES.log_side, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#6d4a28');
    sprinkle(c, ox, oy, ['#75502c', '#664324', '#7d5831'], 100, rng);
    for (let x = 0; x < TILE; x += 3) {
      c.fillStyle = '#573a20';
      c.fillRect(ox + x, oy, 1, 16);
      c.fillStyle = '#825a33';
      c.fillRect(ox + x + 1, oy, 1, 16);
    }
    for (let i = 0; i < 6; i++) {
      c.fillStyle = '#4d331c';
      c.fillRect(ox + Math.floor(rng() * 14), oy + Math.floor(rng() * 13), 3, 1);
    }
  });

  // 7 log top
  drawTile(ctx, TILES.log_top, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#a97f4c');
    sprinkle(c, ox, oy, ['#b78a55', '#9c7342', '#c19460'], 100, rng);
    for (let r = 6; r > 0; r -= 2) {
      c.strokeStyle = r % 4 === 0 ? '#7d5a32' : '#8d6538';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(ox + 8, oy + 8, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = '#6f4f2b';
    c.fillRect(ox + 7, oy + 7, 2, 2);
  });

  // 8 leaves
  drawTile(ctx, TILES.leaves, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#3f7d2d');
    const cols = ['#4a8c35', '#356c25', '#579a3f', '#2f6122', '#63a84a'];
    sprinkle(c, ox, oy, cols, 220, rng);
    for (let i = 0; i < 16; i++) {
      const x = ox + Math.floor(rng() * 14), y = oy + Math.floor(rng() * 14);
      c.fillStyle = rng() > 0.5 ? '#63a84a' : '#2b5a1f';
      c.fillRect(x, y, 2, 1);
    }
  });

  // 9 planks
  drawTile(ctx, TILES.planks, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#b78a52');
    for (let y = 0; y < TILE; y += 4) {
      c.fillStyle = y % 8 === 0 ? '#a87c48' : '#bc8f57';
      c.fillRect(ox, oy + y, 16, 3);
      c.fillStyle = '#7d5a33';
      c.fillRect(ox, oy + y + 3, 16, 1);
      const seam = (y / 4) % 2 === 0 ? 5 : 11;
      c.fillRect(ox + seam, oy + y, 1, 3);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = 'rgba(120,82,44,.5)';
        c.fillRect(ox + Math.floor(rng() * 14), oy + y + Math.floor(rng() * 3), 2, 1);
      }
    }
  });

  // 10 brick
  drawTile(ctx, TILES.brick, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#c7b9a4');
    for (let row = 0; row < 4; row++) {
      const y = oy + row * 4;
      const offset = row % 2 === 0 ? 0 : -4;
      for (let x = offset; x < 16; x += 8) {
        c.fillStyle = ['#a64b3c', '#9b4235', '#b05543', '#943e31'][Math.floor(rng() * 4)];
        c.fillRect(ox + x, y, 7, 3);
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.fillRect(ox + x, y, 7, 1);
      }
    }
    sprinkle(c, ox, oy, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.08)'], 40, rng);
  });

  // 11 glass
  drawTile(ctx, TILES.glass, (c, ox, oy, rng) => {
    c.clearRect(ox, oy, 16, 16);
    c.fillStyle = 'rgba(208,240,246,.16)';
    c.fillRect(ox + 1, oy + 1, 14, 14);
    c.strokeStyle = 'rgba(226,250,255,.85)';
    c.lineWidth = 1;
    c.strokeRect(ox + 0.5, oy + 0.5, 15, 15);
    c.strokeStyle = 'rgba(255,255,255,.4)';
    c.beginPath();
    c.moveTo(ox + 3, oy + 12); c.lineTo(ox + 12, oy + 3);
    c.moveTo(ox + 7, oy + 13); c.lineTo(ox + 13, oy + 7);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.fillRect(ox + 4, oy + 4, 1, 1);
  });

  // 12 snow
  drawTile(ctx, TILES.snow, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#f1f7fa');
    sprinkle(c, ox, oy, snowCols, 150, rng);
    sprinkle(c, ox, oy, ['#d6e4ec', '#c8dae4'], 20, rng);
  });

  // 13 gravel
  drawTile(ctx, TILES.gravel, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#89827b');
    for (let i = 0; i < 26; i++) {
      const x = ox + Math.floor(rng() * 15), y = oy + Math.floor(rng() * 15);
      const w = 1 + Math.floor(rng() * 2), h = 1 + Math.floor(rng() * 2);
      c.fillStyle = ['#a29b93', '#6e6862', '#b3aaa1', '#7d766f', '#958d84'][Math.floor(rng() * 5)];
      c.fillRect(x, y, w, h);
    }
  });

  // 14 coal ore
  drawTile(ctx, TILES.coal_ore, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8b8b8b');
    sprinkle(c, ox, oy, stoneCols, 160, rng);
    for (let i = 0; i < 6; i++) {
      const x = ox + 2 + Math.floor(rng() * 11), y = oy + 2 + Math.floor(rng() * 11);
      c.fillStyle = '#2b2b2b';
      c.fillRect(x, y, 2, 2);
      c.fillStyle = '#454545';
      c.fillRect(x, y, 1, 1);
      c.fillStyle = '#1a1a1a';
      c.fillRect(x + 2, y + 1, 1, 1);
    }
  });

  // 15 bedrock
  drawTile(ctx, TILES.bedrock, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#4c4c4c');
    for (let i = 0; i < 30; i++) {
      const x = ox + Math.floor(rng() * 14), y = oy + Math.floor(rng() * 14);
      c.fillStyle = ['#333333', '#5e5e5e', '#282828', '#6a6a6a'][Math.floor(rng() * 4)];
      c.fillRect(x, y, 2 + Math.floor(rng() * 2), 2);
    }
  });

  // 16 sandstone side
  drawTile(ctx, TILES.sandstone_side, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#dfcd9a');
    for (let y = 0; y < TILE; y++) {
      c.fillStyle = y < 4 ? '#e9d9ab' : y > 12 ? '#d3c08b' : '#dcc995';
      c.fillRect(ox, oy + y, 16, 1);
    }
    for (let i = 0; i < 3; i++) {
      c.fillStyle = 'rgba(170,146,94,.4)';
      c.fillRect(ox, oy + 4 + i * 4, 16, 1);
    }
    sprinkle(c, ox, oy, ['#cdb987', '#e9d9ab', '#c6b07c'], 50, rng);
  });

  // 17 sandstone top
  drawTile(ctx, TILES.sandstone_top, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#e6d5a6');
    sprinkle(c, ox, oy, ['#dcc995', '#eedfb4', '#d5c08b'], 120, rng);
    c.strokeStyle = 'rgba(180,158,110,.4)';
    c.strokeRect(ox + 0.5, oy + 0.5, 15, 15);
  });

  // 18 cactus side
  drawTile(ctx, TILES.cactus_side, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#3f7d3a');
    sprinkle(c, ox, oy, ['#4a8f43', '#356d31', '#57a04e'], 110, rng);
    for (let x = 2; x < 16; x += 5) {
      c.fillStyle = '#2d5f2a';
      c.fillRect(ox + x, oy, 1, 16);
      c.fillStyle = '#5aa651';
      c.fillRect(ox + x + 1, oy, 1, 16);
      for (let y = 1; y < 16; y += 5) {
        p(c, ox + x - 1, oy + y, '#e8f5cf');
      }
    }
  });

  // 19 cactus top
  drawTile(ctx, TILES.cactus_top, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#3a7435');
    sprinkle(c, ox, oy, ['#4b8a43', '#31632d', '#55994c'], 90, rng);
    c.strokeStyle = '#2a5527';
    c.strokeRect(ox + 2.5, oy + 2.5, 11, 11);
    c.strokeStyle = '#5ba552';
    c.strokeRect(ox + 4.5, oy + 4.5, 7, 7);
  });

  // 20 ice
  drawTile(ctx, TILES.ice, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#9fd2ea');
    sprinkle(c, ox, oy, ['#b4dff2', '#8cc5e0', '#c6ebfa'], 120, rng);
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.moveTo(ox + 2, oy + 4); c.lineTo(ox + 6, oy + 9); c.lineTo(ox + 5, oy + 14);
    c.moveTo(ox + 10, oy + 1); c.lineTo(ox + 12, oy + 6); c.lineTo(ox + 15, oy + 8);
    c.stroke();
  });

  // 21 tall grass
  drawTile(ctx, TILES.tall_grass, (c, ox, oy, rng) => {
    c.clearRect(ox, oy, 16, 16);
    for (let i = 0; i < 8; i++) {
      const x = ox + 1 + Math.floor(rng() * 14);
      const h = 5 + Math.floor(rng() * 9);
      c.fillStyle = ['#4f8f3a', '#5fa545', '#3f762e', '#6cb150'][Math.floor(rng() * 4)];
      c.fillRect(x, oy + 16 - h, 1, h);
      if (rng() > 0.5) c.fillRect(x + (rng() > 0.5 ? 1 : -1), oy + 16 - h + 2, 1, 2);
    }
  });

  // 22 red poppy
  drawTile(ctx, TILES.flower_red, (c, ox, oy, rng) => {
    c.clearRect(ox, oy, 16, 16);
    c.fillStyle = '#3f7a2b';
    c.fillRect(ox + 8, oy + 7, 1, 9);
    c.fillStyle = '#4f9139';
    c.fillRect(ox + 5, oy + 11, 3, 1);
    c.fillRect(ox + 9, oy + 9, 2, 1);
    const petals = [[7, 4], [8, 3], [9, 4], [7, 5], [9, 5], [8, 6]];
    petals.forEach(([x, y]) => {
      c.fillStyle = '#d83a30'; c.fillRect(ox + x, oy + y, 2, 1);
    });
    c.fillStyle = '#7a1712'; c.fillRect(ox + 8, oy + 4, 1, 2);
    c.fillStyle = '#ffcf4a'; c.fillRect(ox + 8, oy + 5, 1, 1);
  });

  // 23 dandelion
  drawTile(ctx, TILES.flower_yellow, (c, ox, oy, rng) => {
    c.clearRect(ox, oy, 16, 16);
    c.fillStyle = '#3f7a2b';
    c.fillRect(ox + 8, oy + 8, 1, 8);
    c.fillStyle = '#4f9139';
    c.fillRect(ox + 5, oy + 12, 3, 1);
    c.fillRect(ox + 9, oy + 10, 3, 1);
    c.fillStyle = '#f5cf42';
    c.fillRect(ox + 7, oy + 4, 3, 3);
    c.fillStyle = '#ffe680';
    c.fillRect(ox + 8, oy + 4, 2, 2);
    c.fillStyle = '#d9a91f';
    c.fillRect(ox + 7, oy + 7, 3, 1);
  });

  // 24 stone bricks
  drawTile(ctx, TILES.stonebrick, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#6f6f6f');
    for (let row = 0; row < 4; row++) {
      const y = oy + row * 4;
      const offset = row % 2 === 0 ? 0 : -4;
      for (let x = offset; x < 16; x += 8) {
        c.fillStyle = ['#9a9a9a', '#8e8e8e', '#a4a4a4', '#929292'][Math.floor(rng() * 4)];
        c.fillRect(ox + x, y, 7, 3);
        c.fillStyle = 'rgba(255,255,255,.18)';
        c.fillRect(ox + x, y, 7, 1);
        c.fillStyle = 'rgba(0,0,0,.18)';
        c.fillRect(ox + x, y + 2, 7, 1);
      }
    }
  });

  // 25 glowstone
  drawTile(ctx, TILES.glowstone, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8a6a2e');
    for (let i = 0; i < 40; i++) {
      const x = ox + Math.floor(rng() * 15), y = oy + Math.floor(rng() * 15);
      c.fillStyle = ['#ffe9a3', '#f5c85a', '#fff6c8', '#d9a83f'][Math.floor(rng() * 4)];
      c.fillRect(x, y, 2, 2);
    }
    sprinkle(c, ox, oy, ['#8a6a2e', '#6e531f'], 25, rng);
  });

  // 26 snow side (snowy grass)
  drawTile(ctx, TILES.snow_side, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#8a5a33');
    sprinkle(c, ox, oy, dirtCols, 140, rng);
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < depth; y++) {
        p(c, ox + x, oy + y, snowCols[Math.floor(rng() * snowCols.length)]);
      }
    }
  });

  // 27 water (only used for icon / inventory)
  drawTile(ctx, TILES.water, (c, ox, oy, rng) => {
    fill(c, ox, oy, '#2f78a8');
    sprinkle(c, ox, oy, ['#3f8dbd', '#2a6b99', '#4a9ac9'], 120, rng);
  });

  // 28 dead bush
  drawTile(ctx, TILES.dead_bush, (c, ox, oy, rng) => {
    c.clearRect(ox, oy, 16, 16);
    c.strokeStyle = '#7a5a34';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(ox + 8, oy + 16); c.lineTo(ox + 8, oy + 7);
    c.moveTo(ox + 8, oy + 12); c.lineTo(ox + 4, oy + 8);
    c.moveTo(ox + 8, oy + 10); c.lineTo(ox + 12, oy + 6);
    c.moveTo(ox + 8, oy + 8); c.lineTo(ox + 6, oy + 4);
    c.moveTo(ox + 7, oy + 10); c.lineTo(ox + 3, oy + 12);
    c.stroke();
    c.fillStyle = '#94703f';
    c.fillRect(ox + 12, oy + 5, 1, 1);
    c.fillRect(ox + 5, oy + 3, 1, 1);
  });

  return canvas;
}

export function createAtlasTexture(THREE, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

const iconCache = new Map();
export function blockIcon(id, atlasCanvas, size = 64) {
  const key = `${id}:${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  if (!BLOCKS[id]) return '';
  const tile = faceTile(id, 'side');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureCanvas.height = TILE;
  const tctx = textureCanvas.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(atlasCanvas, (tile % ATLAS_TILES) * TILE, Math.floor(tile / ATLAS_TILES) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(textureCanvas, 0, 0, size, size);
  // subtle 3D bevel for a chunkier inventory icon
  if (!BLOCKS[id].cross) {
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fillRect(0, 0, size, Math.max(1, size * 0.06));
    ctx.fillRect(0, 0, Math.max(1, size * 0.05), size);
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.fillRect(0, size - Math.max(1, size * 0.06), size, Math.max(1, size * 0.06));
    ctx.fillRect(size - Math.max(1, size * 0.05), 0, Math.max(1, size * 0.05), size);
  }
  const url = canvas.toDataURL();
  iconCache.set(key, url);
  return url;
}

const colorCache = new Map();
export function tileAverageColor(atlasCanvas, tileIndex) {
  if (colorCache.has(tileIndex)) return colorCache.get(tileIndex);
  const c = atlasCanvas.getContext('2d');
  const ox = (tileIndex % ATLAS_TILES) * TILE;
  const oy = Math.floor(tileIndex / ATLAS_TILES) * TILE;
  const data = c.getImageData(ox, oy, TILE, TILE).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  const out = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.6, 0.6, 0.6];
  colorCache.set(tileIndex, out);
  return out;
}
