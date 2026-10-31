import * as THREE from 'three';
import {
  AIR, WATER, BLOCKS, isOpaque, isSolid, isCross, faceTile, AO_LEVELS,
} from './blocks.js';
import { hash2, fbm2, ridge2, smooth, lerp } from './noise.js';

export const CHUNK = 16;
export const HEIGHT = 80;
export const SEA_LEVEL = 30;
export const BIOME = { BEACH: 0, PLAINS: 1, FOREST: 2, DESERT: 3, SNOW: 4, MOUNTAIN: 5 };

const ATLAS_TILES = 8;
const ATLAS_PX = 128;
const WATER_ID = WATER;

const FACES = [
  { name: 'px', dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[1, 0], [0, 0], [0, 1], [1, 1]], a1: 2, a2: 1 },
  { name: 'nx', dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], a1: 2, a2: 1 },
  { name: 'top', dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], a1: 0, a2: 2 },
  { name: 'bottom', dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], a1: 0, a2: 2 },
  { name: 'pz', dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], a1: 0, a2: 1 },
  { name: 'nz', dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[1, 0], [0, 0], [0, 1], [1, 1]], a1: 0, a2: 1 },
];

class GeometryBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  get empty() { return this.idx.length === 0; }
  build(material, position) {
    if (this.empty) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.position.copy(position);
    mesh.matrixAutoUpdate = true;
    return mesh;
  }
}

export class World {
  constructor(scene, { seed = 1337, chunks = 12, materials, edits = null } = {}) {
    this.scene = scene;
    this.seed = seed | 0;
    this.size = chunks;
    this.width = chunks * CHUNK;
    this.half = this.width / 2;
    this.materials = materials;
    this.chunks = new Map();
    this.edits = edits || new Map();
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);
    this.waterDirty = true;
    this.waterMesh = null;
    this.ready = false;
    this.tempVec = new THREE.Vector3();

    // endless-looking ocean: a wide ring just under the voxel water surface so
    // the finite 192x192 world never shows a hard edge against the sky
    const oceanShape = new THREE.Shape();
    oceanShape.moveTo(-1600, -1600);
    oceanShape.lineTo(1600, -1600);
    oceanShape.lineTo(1600, 1600);
    oceanShape.lineTo(-1600, 1600);
    oceanShape.lineTo(-1600, -1600);
    const oceanHole = new THREE.Path();
    oceanHole.moveTo(-this.half, -this.half);
    oceanHole.lineTo(-this.half, this.half);
    oceanHole.lineTo(this.half, this.half);
    oceanHole.lineTo(this.half, -this.half);
    oceanHole.lineTo(-this.half, -this.half);
    oceanShape.holes.push(oceanHole);
    const oceanGeo = new THREE.ShapeGeometry(oceanShape);
    oceanGeo.rotateX(-Math.PI / 2);
    oceanGeo.translate(0, SEA_LEVEL + 0.88, 0);
    this.ocean = new THREE.Mesh(oceanGeo, materials.water);
    this.ocean.renderOrder = 2;
    this.ocean.frustumCulled = false;
    this.group.add(this.ocean);
  }

  key(cx, cz) { return (cx + 64) * 256 + (cz + 64); }
  inBounds(x, z) { return x >= -this.half && x < this.half && z >= -this.half && z < this.half; }

  chunkAt(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  getBlock(x, y, z) {
    if (y < 0) return 14;
    if (y >= HEIGHT) return AIR;
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return AIR;
    return chunk.data[((y * CHUNK) + (z & 15)) * CHUNK + (x & 15)];
  }

  setRaw(x, y, z, id) {
    if (y < 0 || y >= HEIGHT || !this.inBounds(x, z)) return false;
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.chunks.get(this.key(cx, cz));
    if (!chunk) return false;
    chunk.data[((y * CHUNK) + (z & 15)) * CHUNK + (x & 15)] = id;
    return true;
  }

  isSolidAt(x, y, z) {
    return isSolid(this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }
  isWaterAt(x, y, z) {
    return this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === WATER_ID;
  }

  // ------------------------------------------------------------------ terrain
  terrainHeight(x, z) {
    const seed = this.seed;
    const nx = x / this.half;
    const nz = z / this.half;
    const d = Math.sqrt(nx * nx + nz * nz);
    const raw = fbm2(x * 0.009, z * 0.009, seed + 101, 5);
    const continent = Math.max(0, Math.min(1, (raw - 0.33) / 0.34));
    const hills = fbm2(x * 0.032, z * 0.032, seed + 211, 4);
    const ridge = ridge2(x * 0.019, z * 0.019, seed + 307, 3);
    let h = 30 + continent * 28 + hills * 8;
    h += smooth(0.48, 1.0, continent) * ridge * 34;
    const shore = smooth(0.72, 1.02, d);
    h = lerp(h, SEA_LEVEL - 10, shore);
    return Math.max(4, Math.min(HEIGHT - 6, Math.round(h)));
  }

  biomeAt(x, z, h) {
    if (h <= SEA_LEVEL + 2) return BIOME.BEACH;
    if (h > 57) return BIOME.MOUNTAIN;
    const temp = fbm2(x * 0.009 + 100, z * 0.009 - 50, this.seed + 401, 3);
    const moist = fbm2(x * 0.012 - 70, z * 0.012 + 30, this.seed + 503, 3);
    if (temp < 0.35) return BIOME.SNOW;
    if (temp > 0.63 && moist < 0.47) return BIOME.DESERT;
    if (moist > 0.55) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  surfaceTypes(biome, h, x, z) {
    const wet = h <= SEA_LEVEL - 1;
    if (h > 64) return { top: 11, sub: 3 };
    if (h > 59) return { top: 3, sub: 3 };
    if (biome === BIOME.SNOW) return { top: 11, sub: 2 };
    if (biome === BIOME.DESERT) return { top: 5, sub: 15 };
    if (biome === BIOME.BEACH || wet) {
      const g = hash2(x, z, this.seed + 71);
      return { top: g > 0.45 ? 5 : 12, sub: 5 };
    }
    if (h > 55) return { top: 3, sub: 3 };
    return { top: 1, sub: 2 };
  }

  async generate(onProgress = () => {}) {
    const n = this.size;
    const total = n * n;
    let done = 0;
    let phase = 0;
    const phaseWeights = [0.44, 0.16, 0.4];
    const phaseBase = [0, 0.44, 0.6];
    const tick = async (force = false) => {
      const p = phaseBase[phase] + (done / total) * phaseWeights[phase];
      onProgress(Math.min(0.995, p));
      if (force || done % 6 === 0) await new Promise((r) => setTimeout(r, 0));
    };

    // allocate
    const cn = Math.floor(n / 2);
    for (let cz = -cn; cz < cn; cz++) {
      for (let cx = -cn; cx < cn; cx++) {
        const gx = cx * CHUNK;
        const gz = cz * CHUNK;
        this.chunks.set(this.key(cx, cz), {
          cx, cz, gx, gz,
          data: new Uint8Array(CHUNK * CHUNK * HEIGHT),
          heights: new Uint8Array(CHUNK * CHUNK),
          biomes: new Uint8Array(CHUNK * CHUNK),
          opaque: null, plants: null, glass: null,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 0));

    // terrain
    for (let cz = -cn; cz < cn; cz++) {
      for (let cx = -cn; cx < cn; cx++) {
        const chunk = this.chunkAt(cx, cz);
        const data = chunk.data;
        for (let lz = 0; lz < CHUNK; lz++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            const wx = chunk.gx + lx;
            const wz = chunk.gz + lz;
            const h = this.terrainHeight(wx, wz);
            const biome = this.biomeAt(wx, wz, h);
            const types = this.surfaceTypes(biome, h, wx, wz);
            chunk.heights[lx + lz * CHUNK] = h;
            chunk.biomes[lx + lz * CHUNK] = biome;
            for (let y = 0; y <= h; y++) {
              let id = 3;
              if (y === 0) id = 14;
              else if (y < h - 3) {
                id = 3;
                if (y < 34 && hash2(wx * 7 + y * 31, wz * 13 + y * 17, this.seed + 909) > 0.986) id = 13;
              } else if (y < h) {
                id = types.sub;
              } else {
                id = types.top;
              }
              data[((y * CHUNK) + lz) * CHUNK + lx] = id;
            }
            // ocean / lakes
            if (h < SEA_LEVEL) {
              const ice = biome === BIOME.SNOW && h < SEA_LEVEL - 1;
              for (let y = h + 1; y <= SEA_LEVEL; y++) {
                data[((y * CHUNK) + lz) * CHUNK + lx] = (ice && y === SEA_LEVEL) ? 17 : WATER_ID;
              }
            }
          }
        }
        done++;
        await tick();
      }
    }

    // decorations (trees, plants)
    phase = 1;
    done = 0;
    for (let cz = -cn; cz < cn; cz++) {
      for (let cx = -cn; cx < cn; cx++) {
        const chunk = this.chunkAt(cx, cz);
        for (let lz = 0; lz < CHUNK; lz++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            const wx = chunk.gx + lx;
            const wz = chunk.gz + lz;
            const h = chunk.heights[lx + lz * CHUNK];
            const biome = chunk.biomes[lx + lz * CHUNK];
            if (h <= SEA_LEVEL) continue;
            const surface = this.getBlock(wx, h, wz);
            const r = hash2(wx, wz, this.seed + 1229);
            if (surface === 1 || surface === 11) {
              const treeChance = biome === BIOME.FOREST ? 0.0115 : biome === BIOME.SNOW ? 0.005 : biome === BIOME.PLAINS ? 0.003 : 0;
              if (r < treeChance) this.placeTree(wx, h + 1, wz, biome);
              else if (r < treeChance + 0.075) {
                const pr = hash2(wx, wz, this.seed + 4241);
                const plant = pr > 0.72 ? 19 : pr > 0.55 ? 20 : 18;
                if (this.getBlock(wx, h + 1, wz) === AIR) this.setRaw(wx, h + 1, wz, plant);
              }
            } else if (biome === BIOME.DESERT && surface === 5) {
              if (r < 0.006) {
                const ch = 2 + Math.floor(hash2(wx, wz, this.seed + 8) * 3);
                for (let i = 0; i < ch; i++) if (this.getBlock(wx, h + 1 + i, wz) === AIR) this.setRaw(wx, h + 1 + i, wz, 16);
              } else if (r < 0.012) {
                if (this.getBlock(wx, h + 1, wz) === AIR) this.setRaw(wx, h + 1, wz, 23);
              }
            }
          }
        }
        done++;
        await tick();
      }
    }

    // saved modifications
    this.applyEdits();

    phase = 2;
    done = 0;
    const meshTotal = total * 2;
    for (let cz = -cn; cz < cn; cz++) {
      for (let cx = -cn; cx < cn; cx++) {
        this.meshChunk(this.chunkAt(cx, cz));
        done++;
        await tick();
      }
    }
    this.buildWater();
    onProgress(1);

    // spawn point
    this.spawn = this.findSpawn();
    this.ready = true;
    return this;
  }

  placeTree(x, baseY, z, biome) {
    const seed = this.seed;
    const height = 4 + Math.floor(hash2(x, z, seed + 55) * 4);
    const top = baseY + height;
    if (top + 2 >= HEIGHT || !this.inBounds(x - 2, z - 2) || !this.inBounds(x + 2, z + 2)) return;
    const spruce = biome === BIOME.SNOW;
    if (spruce) {
      for (let i = 0; i < height; i++) this.setRaw(x, baseY + i, z, 6);
      for (let layer = 0; layer < 4; layer++) {
        const y = top - layer * 2;
        const radius = layer === 0 ? 0 : layer === 1 ? 1 : 2;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
            if (this.getBlock(x + dx, y, z + dz) === AIR) this.setRaw(x + dx, y, z + dz, 7);
          }
        }
      }
      this.setRaw(x, top + 1, z, 7);
    } else {
      for (let i = 0; i < height; i++) this.setRaw(x, baseY + i, z, 6);
      for (let dy = -2; dy <= 2; dy++) {
        const radius = dy <= 0 ? 2 : (dy === 1 ? 2 : 1);
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.abs(dx) + Math.abs(dz);
            if (dy >= 1 && dist > radius + 1) continue;
            if (dist === 0 && dy <= 0) continue;
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash2(x + dx, z + dz, seed + dy * 31) > 0.45) continue;
            const yy = top + dy - 1;
            if (yy < 1 || yy >= HEIGHT) continue;
            if (this.getBlock(x + dx, yy, z + dz) === AIR) this.setRaw(x + dx, yy, z + dz, 7);
          }
        }
      }
    }
  }

  findSpawn() {
    const half = this.half - 16;
    let best = null;
    // Look for an open, grassy vantage point with a clear line of sight and a
    // view of either the sea or the highlands. Dense forest interiors make a
    // claustrophobic first impression, so they are penalised.
    for (let i = 0; i < 2200; i++) {
      const a = i * 2.399963;
      const r = 12 + Math.sqrt(i / 2200) * (half - 12);
      const x = Math.round(Math.cos(a) * r);
      const z = Math.round(Math.sin(a) * r);
      if (!this.inBounds(x, z)) continue;
      const h = this.terrainHeight(x, z);
      if (h <= SEA_LEVEL + 4 || h > 52) continue;
      const top = this.getBlock(x, h, z);
      if (top !== 1 && top !== 11) continue;
      if (this.getBlock(x, h + 1, z) !== AIR || this.getBlock(x, h + 2, z) !== AIR) continue;
      if (this.getBlock(x, h + 3, z) !== AIR) continue;

      let trees = 0;
      for (let dz = -8; dz <= 8; dz += 2) {
        for (let dx = -8; dx <= 8; dx += 2) {
          for (let yy = h + 1; yy <= h + 7; yy++) {
            const id = this.getBlock(x + dx, yy, z + dz);
            if (id === 6 || id === 7) { trees++; break; }
          }
        }
      }
      if (trees > 2) continue;

      const eye = Math.floor(h + 2.7);
      let openDirs = 0, bestClear = 0;
      for (let k = 0; k < 24; k++) {
        const ca = Math.cos((k / 24) * Math.PI * 2);
        const sa = Math.sin((k / 24) * Math.PI * 2);
        let clear = 0;
        for (let d = 1.5; d <= 20; d += 1.5) {
          const idA = this.getBlock(Math.floor(x + ca * d), eye, Math.floor(z + sa * d));
          const idB = this.getBlock(Math.floor(x + ca * d), eye + 1, Math.floor(z + sa * d));
          if ((idA !== AIR && !isCross(idA)) || (idB !== AIR && !isCross(idB))) break;
          clear = d;
        }
        if (clear >= 10) openDirs++;
        if (clear > bestClear) bestClear = clear;
      }
      if (bestClear < 9) continue;

      let water = 0;
      for (let k = 0; k < 12; k++) {
        const ca = Math.cos((k / 12) * Math.PI * 2);
        const sa = Math.sin((k / 12) * Math.PI * 2);
        for (const rad of [26, 44]) {
          const hh = this.terrainHeight(Math.round(x + ca * rad), Math.round(z + sa * rad));
          if (hh <= SEA_LEVEL) { water++; break; }
        }
      }

      const score = Math.abs(h - 40) * 1.1 + r * 0.035 + trees * 4
        - Math.min(openDirs, 12) * 0.8 - Math.min(bestClear, 16) * 0.5
        - Math.min(water, 4) * 0.8;
      if (!best || score < best.score) best = { x, y: h + 1, z, score };
    }
    if (!best) {
      const x = 0, z = 0;
      const h = Math.max(SEA_LEVEL + 1, this.terrainHeight(x, z));
      best = { x, y: h + 1, z, score: 0 };
    }

    // Face the most scenic open direction: highlands silhouette or open water.
    let bestYaw = 0, bestView = -Infinity;
    const eye = Math.floor(best.y + 2.7);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let clear = 0;
      for (let d = 1; d <= 30; d += 1) {
        const id = this.getBlock(
          Math.floor(best.x + ca * d), eye, Math.floor(best.z + sa * d),
        );
        if (id !== AIR && !isCross(id)) break;
        clear = d;
      }
      const fx = Math.round(best.x + ca * 60);
      const fz = Math.round(best.z + sa * 60);
      const fh = this.terrainHeight(fx, fz);
      let scenic = 0;
      if (fh > best.y + 4) scenic += 3.4;
      if (fh <= SEA_LEVEL + 1) scenic += 2.6;
      const view = clear * 0.5 + scenic;
      if (view > bestView) { bestView = view; bestYaw = Math.atan2(-ca, -sa); }
    }
    best.yaw = bestYaw;
    return best;
  }

  applyEdits() {
    if (!this.edits || !this.edits.size) return;
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(',').map(Number);
      this.setRaw(x, y, z, id);
    }
  }

  // ------------------------------------------------------------------ editing
  setBlock(x, y, z, id) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y <= 0 || y >= HEIGHT || !this.inBounds(x, z)) return false;
    const old = this.getBlock(x, y, z);
    if (old === id) return false;
    if (old === 14) return false;
    this.setRaw(x, y, z, id);
    this.edits.set(`${x},${y},${z}`, id);
    const cx = x >> 4, cz = z >> 4;
    this.remesh(cx, cz);
    if ((x & 15) === 0) this.remesh(cx - 1, cz);
    if ((x & 15) === 15) this.remesh(cx + 1, cz);
    if ((z & 15) === 0) this.remesh(cx, cz - 1);
    if ((z & 15) === 15) this.remesh(cx, cz + 1);
    if (old === WATER_ID || id === WATER_ID || this.touchesWater(x, y, z)) this.waterDirty = true;
    return true;
  }

  touchesWater(x, y, z) {
    return this.getBlock(x + 1, y, z) === WATER_ID || this.getBlock(x - 1, y, z) === WATER_ID ||
      this.getBlock(x, y + 1, z) === WATER_ID || this.getBlock(x, y - 1, z) === WATER_ID ||
      this.getBlock(x, y, z + 1) === WATER_ID || this.getBlock(x, y, z - 1) === WATER_ID;
  }

  remesh(cx, cz) {
    const chunk = this.chunkAt(cx, cz);
    if (chunk) this.meshChunk(chunk);
  }

  update() {
    if (this.waterDirty) {
      this.waterDirty = false;
      this.buildWater();
    }
  }

  // ------------------------------------------------------------------ meshing
  meshChunk(chunk) {
    if (!chunk) return;
    const solid = new GeometryBuilder();
    const plants = new GeometryBuilder();
    const glass = new GeometryBuilder();
    const data = chunk.data;
    const gx = chunk.gx, gz = chunk.gz;

    for (let y = 0; y < HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const id = data[((y * CHUNK) + lz) * CHUNK + lx];
          if (id === AIR || id === WATER_ID) continue;
          const wx = gx + lx, wz = gz + lz;
          if (isCross(id)) {
            this.addCross(plants, wx, y, wz, faceTile(id, 'side'), gx, gz);
            continue;
          }
          const builder = (id === 10 || id === 17) ? glass : solid;
          for (const f of FACES) {
            const nx = wx + f.dir[0], ny = y + f.dir[1], nz = wz + f.dir[2];
            const nid = this.getBlock(nx, ny, nz);
            if (nid === id || isOpaque(nid)) continue;
            this.addFace(builder, wx, y, wz, f, id, gx, gz);
          }
        }
      }
    }

    this.replaceMesh(chunk, 'opaque', solid, this.materials.solid);
    this.replaceMesh(chunk, 'plants', plants, this.materials.plant);
    this.replaceMesh(chunk, 'glass', glass, this.materials.glass);
  }

  replaceMesh(chunk, slot, builder, material) {
    const old = chunk[slot];
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
      chunk[slot] = null;
    }
    if (builder.empty) return;
    const mesh = builder.build(material, new THREE.Vector3(chunk.gx, 0, chunk.gz));
    if (!mesh) return;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    if (slot === 'glass') mesh.renderOrder = 2;
    chunk[slot] = mesh;
    this.group.add(mesh);
  }

  addFace(builder, wx, wy, wz, face, id, gx, gz) {
    const tile = faceTile(id, face.name);
    const base = builder.pos.length / 3;
    const color = faceColor(face.name);
    const tu = tile % ATLAS_TILES;
    const tv = Math.floor(tile / ATLAS_TILES);
    const padU = 0.35 / ATLAS_PX;
    const padV = 0.35 / ATLAS_PX;
    const u0 = (tu * 16) / ATLAS_PX + padU;
    const u1 = ((tu + 1) * 16) / ATLAS_PX - padU;
    const vTop = 1 - (tv * 16) / ATLAS_PX - padV;
    const vBottom = 1 - ((tv + 1) * 16) / ATLAS_PX + padV;

    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      const x = wx + c[0] - gx, y = wy + c[1], z = wz + c[2] - gz;
      builder.pos.push(x, y, z);
      builder.nor.push(face.dir[0], face.dir[1], face.dir[2]);
      const [uu, vv] = face.uv[i];
      builder.uv.push(uu ? u1 : u0, vv ? vTop : vBottom);
      // ambient occlusion
      const s1 = c[face.a1] === 1 ? 1 : -1;
      const s2 = c[face.a2] === 1 ? 1 : -1;
      const o1 = [face.dir[0], face.dir[1], face.dir[2]]; o1[face.a1] += s1;
      const o2 = [face.dir[0], face.dir[1], face.dir[2]]; o2[face.a2] += s2;
      const oc = [face.dir[0], face.dir[1], face.dir[2]];
      oc[face.a1] += s1; oc[face.a2] += s2;
      const op1 = isOpaque(this.getBlock(wx + o1[0], wy + o1[1], wz + o1[2]));
      const op2 = isOpaque(this.getBlock(wx + o2[0], wy + o2[1], wz + o2[2]));
      const opc = isOpaque(this.getBlock(wx + oc[0], wy + oc[1], wz + oc[2]));
      const ao = (op1 && op2) ? 0 : 3 - (op1 ? 1 : 0) - (op2 ? 1 : 0) - (opc ? 1 : 0);
      let br = AO_LEVELS[ao] * color;
      if (id === 7) br *= 0.86 + hash2(wx, wz, this.seed + 31) * 0.24;
      if (id === 1) br *= 0.96 + hash2(wx, wz, this.seed + 41) * 0.08;
      builder.col.push(br, br, br);
    }
    builder.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addCross(builder, wx, wy, wz, tile, gx, gz) {
    const tu = tile % ATLAS_TILES;
    const tv = Math.floor(tile / ATLAS_TILES);
    const padU = 0.35 / ATLAS_PX;
    const u0 = (tu * 16) / ATLAS_PX + padU;
    const u1 = ((tu + 1) * 16) / ATLAS_PX - padU;
    const vTop = 1 - (tv * 16) / ATLAS_PX - padU;
    const vBottom = 1 - ((tv + 1) * 16) / ATLAS_PX + padU;
    const h = hash2(wx, wz, 77);
    const ox = (h - 0.5) * 0.18;
    const oz = (hash2(wx, wz, 78) - 0.5) * 0.18;
    const x = wx + 0.5 + ox - gx, z = wz + 0.5 + oz - gz;
    const r = 0.44;
    const quads = [
      [[-r, -r], [r, r]],
      [[-r, r], [r, -r]],
    ];
    const shade = 0.88 + h * 0.12;
    for (const q of quads) {
      const base = builder.pos.length / 3;
      const corners = [
        [x + q[0][0], wy, z + q[0][1], u0, vBottom],
        [x + q[1][0], wy, z + q[1][1], u1, vBottom],
        [x + q[1][0], wy + 0.96, z + q[1][1], u1, vTop],
        [x + q[0][0], wy + 0.96, z + q[0][1], u0, vTop],
      ];
      for (const c of corners) {
        builder.pos.push(c[0], c[1], c[2]);
        builder.nor.push(0, 1, 0);
        builder.uv.push(c[3], c[4]);
        builder.col.push(shade, shade, shade);
      }
      builder.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  buildWater() {
    if (this.waterMesh) {
      this.group.remove(this.waterMesh);
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    const b = new GeometryBuilder();
    for (const chunk of this.chunks.values()) {
      const data = chunk.data;
      for (let y = 0; y < HEIGHT; y++) {
        for (let lz = 0; lz < CHUNK; lz++) {
          for (let lx = 0; lx < CHUNK; lx++) {
            if (data[((y * CHUNK) + lz) * CHUNK + lx] !== WATER_ID) continue;
            const wx = chunk.gx + lx, wz = chunk.gz + lz;
            const top = this.getBlock(wx, y + 1, wz);
            if (top === AIR || isCross(top)) this.addWaterFace(b, wx, y, wz, FACES[2]);
            for (const f of [FACES[0], FACES[1], FACES[4], FACES[5]]) {
              const nid = this.getBlock(wx + f.dir[0], y + f.dir[1], wz + f.dir[2]);
              if (nid === AIR || isCross(nid)) this.addWaterFace(b, wx, y, wz, f);
            }
            const below = this.getBlock(wx, y - 1, wz);
            if (below === AIR) this.addWaterFace(b, wx, y, wz, FACES[3]);
          }
        }
      }
    }
    if (b.empty) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setIndex(new THREE.Uint32BufferAttribute(b.idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.materials.water);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    this.waterMesh = mesh;
    this.group.add(mesh);
  }

  addWaterFace(b, wx, wy, wz, face) {
    const base = b.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const c = face.corners[i];
      // top faces sit slightly below the block top so block edges show
      const y = wy + c[1] * 0.92;
      b.pos.push(wx + c[0], y, wz + c[2]);
      b.nor.push(face.dir[0], face.dir[1], face.dir[2]);
      b.uv.push(0, 0);
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // ------------------------------------------------------------------ queries
  raycast(origin, dir, maxDistance = 7) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const invX = Math.abs(1 / dir.x), invY = Math.abs(1 / dir.y), invZ = Math.abs(1 / dir.z);
    let tMaxX = dir.x === 0 ? Infinity : ((stepX > 0 ? x + 1 - origin.x : origin.x - x) * invX);
    let tMaxY = dir.y === 0 ? Infinity : ((stepY > 0 ? y + 1 - origin.y : origin.y - y) * invY);
    let tMaxZ = dir.z === 0 ? Infinity : ((stepZ > 0 ? z + 1 - origin.z : origin.z - z) * invZ);
    let normal = [0, 0, 0];
    let t = 0;
    while (t <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== WATER_ID) {
        return { x, y, z, id, normal, distance: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += invX; normal = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += invY; normal = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += invZ; normal = [0, 0, -stepZ];
      }
    }
    return null;
  }

  highestAt(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (id !== AIR && id !== WATER_ID) return y;
    }
    return 0;
  }
}

function faceColor(face) {
  switch (face) {
    case 'top': return 1.0;
    case 'bottom': return 0.62;
    case 'px':
    case 'nx': return 0.86;
    default: return 0.78;
  }
}

export function packEdits(map) {
  const out = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}
