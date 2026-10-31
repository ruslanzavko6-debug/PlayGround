// Block registry. Tile indices point into the 8x8 procedural texture atlas.
export const AIR = 0;
export const WATER = 40;

export const TILES = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  cobble: 4,
  sand: 5,
  log_side: 6,
  log_top: 7,
  leaves: 8,
  planks: 9,
  brick: 10,
  glass: 11,
  snow: 12,
  gravel: 13,
  coal_ore: 14,
  bedrock: 15,
  sandstone_side: 16,
  sandstone_top: 17,
  cactus_side: 18,
  cactus_top: 19,
  ice: 20,
  tall_grass: 21,
  flower_red: 22,
  flower_yellow: 23,
  stonebrick: 24,
  glowstone: 25,
  snow_side: 26,
  water: 27,
  dead_bush: 28,
};

const def = (name, tiles, hardness, sound, extra = {}) => ({
  name,
  top: tiles[0],
  side: tiles[1] ?? tiles[0],
  bottom: tiles[2] ?? tiles[1] ?? tiles[0],
  hardness,
  sound,
  ...extra,
});

export const BLOCKS = {
  1: def('Трава', [TILES.grass_top, TILES.grass_side, TILES.dirt], 0.45, 'grass'),
  2: def('Земля', [TILES.dirt], 0.4, 'dirt'),
  3: def('Камінь', [TILES.stone], 0.9, 'stone'),
  4: def('Кругляк', [TILES.cobble], 0.85, 'stone'),
  5: def('Пісок', [TILES.sand], 0.35, 'sand'),
  6: def('Дерево', [TILES.log_top, TILES.log_side, TILES.log_top], 0.7, 'wood'),
  7: def('Листя', [TILES.leaves], 0.2, 'leaves'),
  8: def('Дошки', [TILES.planks], 0.6, 'wood'),
  9: def('Цегла', [TILES.brick], 0.9, 'stone'),
  10: def('Скло', [TILES.glass], 0.3, 'glass', { transparent: true }),
  11: def('Сніг', [TILES.snow, TILES.snow_side, TILES.dirt], 0.3, 'snow'),
  12: def('Гравій', [TILES.gravel], 0.5, 'gravel'),
  13: def('Вугільна руда', [TILES.coal_ore], 1.1, 'stone'),
  14: def('Корінна порода', [TILES.bedrock], 999, 'stone'),
  15: def('Пісковик', [TILES.sandstone_top, TILES.sandstone_side, TILES.sandstone_top], 0.7, 'stone'),
  16: def('Кактус', [TILES.cactus_top, TILES.cactus_side, TILES.cactus_top], 0.4, 'plant', { plantLike: true }),
  17: def('Лід', [TILES.ice], 0.5, 'glass', { transparent: true }),
  18: def('Висока трава', [TILES.tall_grass], 0.04, 'plant', { cross: true, noCollide: true }),
  19: def('Мак', [TILES.flower_red], 0.04, 'plant', { cross: true, noCollide: true }),
  20: def('Кульбаба', [TILES.flower_yellow], 0.04, 'plant', { cross: true, noCollide: true }),
  21: def('Кам\'яна цегла', [TILES.stonebrick], 1.0, 'stone'),
  22: def('Світлокамінь', [TILES.glowstone], 0.6, 'glass', { emissive: true }),
  23: def('Сухий кущ', [TILES.dead_bush], 0.04, 'plant', { cross: true, noCollide: true }),
  40: def('Вода', [TILES.water], 999, 'water', { liquid: true, transparent: true }),
};

export const isCross = (id) => !!(BLOCKS[id]?.cross);
export const isLiquid = (id) => id === WATER;
export const isTransparentBlock = (id) =>
  id === AIR || id === WATER || !!BLOCKS[id]?.transparent || !!BLOCKS[id]?.cross || id === 7;
export const isSolid = (id) => id !== AIR && id !== WATER && !BLOCKS[id]?.noCollide;
export const isOpaque = (id) => id !== AIR && id !== WATER && !BLOCKS[id]?.cross && !BLOCKS[id]?.transparent;

// Blocks offered in the inventory. Ordered by "progression" feel.
export const INVENTORY_BLOCKS = [
  1, 2, 3, 4, 5, 15, 6, 7, 8, 9, 21, 10, 11, 12, 17, 16, 22, 18, 19, 20, 23,
];
export const DEFAULT_HOTBAR = [1, 3, 4, 6, 8, 5, 10, 7, 9];

export function faceTile(id, face) {
  const b = BLOCKS[id];
  if (!b) return 0;
  if (face === 'top') return b.top;
  if (face === 'bottom') return b.bottom;
  return b.side;
}

export const FACE_SHADE = { top: 1.0, bottom: 0.5, px: 0.8, nx: 0.8, pz: 0.72, nz: 0.72 };
export const AO_LEVELS = [0.48, 0.66, 0.84, 1.0];
