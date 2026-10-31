import * as THREE from 'three';
import { AIR, BLOCKS, WATER, DEFAULT_HOTBAR, faceTile, isCross, isSolid } from './blocks.js';
import { buildAtlas, createAtlasTexture, tileAverageColor } from './textures.js';
import { createMaterials, updateWaterMaterial } from './materials.js';
import { World, CHUNK } from './world.js';
import { Sky } from './sky.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { GameAudio } from './audio.js';
import { UI, loadSettings, saveSettings } from './ui.js';

const SAVE_KEY = 'voxelcraft.save.v2';
const SEED_KEY = 'voxelcraft.seed.v2';
const WORLD_CHUNKS = 12;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- storage
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || save.v !== 2 || !Number.isFinite(save.seed)) return null;
    return save;
  } catch { return null; }
}

function editsToObject(map) {
  const out = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}

function editsFromObject(obj) {
  const map = new Map();
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) if (Number.isFinite(v)) map.set(k, v);
  }
  return map;
}

// ---------------------------------------------------------------- startup params
const params = new URLSearchParams(location.search);
const fresh = params.get('fresh') === '1';
if (fresh) {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  params.delete('fresh');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
}
const existingSave = fresh ? null : readSave();
const urlSeed = Number.parseInt(params.get('seed') || '', 10);
const storedSeed = Number.parseInt(localStorage.getItem(SEED_KEY) || '', 10);
let seed = Number.isFinite(urlSeed) ? urlSeed : (existingSave?.seed ?? (Number.isFinite(storedSeed) ? storedSeed : 1337));
try { localStorage.setItem(SEED_KEY, String(seed)); } catch { /* ignore */ }

// ---------------------------------------------------------------- three boot
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
} catch (error) {
  $('error-box').classList.remove('hidden');
  $('error-text').textContent = String(error?.message || error);
  throw error;
}
const pixelRatio = Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 900);
camera.position.set(0, 55, 90);

const atlasCanvas = buildAtlas();
const atlasTexture = createAtlasTexture(THREE, atlasCanvas);
const materials = createMaterials(atlasTexture);
const sky = new Sky(scene, renderer);
const audio = new GameAudio();
const particles = new Particles(scene);

const settings = loadSettings();
let save = existingSave;

// saved world time / seed
if (existingSave && existingSave.seed === seed && Number.isFinite(existingSave.time)) {
  sky.time = ((existingSave.time % 1) + 1) % 1;
}

const state = {
  mode: 'menu',
  paused: false,
  inventory: false,
  ready: false,
  pendingStart: false,
  world: null,
  player: null,
  target: null,
  mining: false,
  miningProgress: 0,
  mineKey: '',
  mineSoundTimer: 0,
  rightHeld: false,
  rightCooldown: 0,
  swing: 0,
  dragging: false,
  locked: false,
  underwater: false,
  lastSave: 0,
  frames: 0,
  fpsTime: 0,
  fps: 60,
  lastSpace: 0,
  touchLookId: null,
  touchLook: { x: 0, y: 0 },
  joystickId: null,
  hotbar: DEFAULT_HOTBAR.slice(),
  heldId: null,
  saveDirty: false,
  lastTime: performance.now(),
};

// ---------------------------------------------------------------- UI
const ui = new UI({
  atlasCanvas,
  hotbar: state.hotbar,
  callbacks: {
    onPlay: () => playClicked(),
    onNewWorld: () => newWorld(true),
    onResume: () => resumeGame(),
    onPause: () => pauseGame(),
    onMainMenu: () => goToMenu(),
    onSettings: (s) => applySettings(s),
    onSlot: (i) => { state.hotbar = ui.hotbar; },
    onHotbarChange: (hotbar) => { state.hotbar = hotbar; },
    onInventoryOpen: (open) => { if (open) openInventory(); else closeInventory(); },
    onMute: () => toggleMute(),
    onUiSound: () => audio.ui(),
    onFly: () => toggleFly(),
    onJump: () => touchJump(),
    onInventoryPick: () => audio.ui(),
  },
});

ui.setSeed(seed);
const saveNote = $('save-note');
if (save && save.seed === seed) {
  const when = save.savedAt ? new Date(save.savedAt).toLocaleDateString('uk-UA') : '';
  saveNote.innerHTML = `Знайдено збереження${when ? ` · <b>${when}</b>` : ''} — прогрес відновиться автоматично.`;
  $('play-sub') && ($('play-sub').textContent = 'продовжити світ');
} else {
  saveNote.textContent = `Сід ${seed} · генерація нового острова`;
}
$('save-note').dataset.seed = String(seed);

// ---------------------------------------------------------------- held item (overlay scene)
const heldScene = new THREE.Scene();
const heldCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 5);
heldScene.add(new THREE.HemisphereLight(0xffffff, 0x53614c, 1.5));
const heldLight = new THREE.DirectionalLight(0xfff4dd, 1.9);
heldLight.position.set(0.7, 1.1, 0.9);
heldScene.add(heldLight);
const heldRoot = new THREE.Group();
heldRoot.position.set(0.36, -0.34, -0.78);
heldRoot.rotation.set(0.12, -0.52, 0.08);
heldScene.add(heldRoot);
state.heldBase = { x: 0.48, y: -0.26, z: -0.82, scale: 1 };

function layoutHeld() {
  const aspect = window.innerWidth / window.innerHeight;
  const narrow = aspect < 0.8;
  state.heldBase = narrow
    ? { x: 0.12, y: -0.34, z: -0.9, scale: 0.9 }
    : { x: 0.48, y: -0.26, z: -0.82, scale: 1.0 };
  heldRoot.position.z = state.heldBase.z;
  heldRoot.scale.setScalar(state.heldBase.scale);
  updateHeldPose();
}
layoutHeld();

const armMat = new THREE.MeshLambertMaterial({ color: 0xd9a57d });
const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x3f7f9c });
const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), armMat);
arm.position.set(-0.13, -0.2, 0.1);
arm.rotation.set(0.45, 0, -0.42);
heldRoot.add(arm);
const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), sleeveMat);
sleeve.position.set(-0.08, -0.39, 0.14);
sleeve.rotation.set(0.45, 0, -0.42);
heldRoot.add(sleeve);
let heldBlockGroup = null;
let heldTextures = [];

function faceTiles(id) {
  const b = BLOCKS[id];
  return { side: b.side, top: b.top, bottom: b.bottom };
}

function rebuildHeldItem(id) {
  if (state.heldId === id) return;
  state.heldId = id;
  if (heldBlockGroup) {
    heldRoot.remove(heldBlockGroup);
    heldBlockGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    heldBlockGroup = null;
  }
  heldTextures.forEach((t) => t.dispose());
  heldTextures = [];
  const b = BLOCKS[id];
  if (!b) return;
  const group = new THREE.Group();
  const tiles = faceTiles(id);
  if (isCross(id)) {
    const tex = atlasTexture.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1 / 8, 1 / 8);
    tex.offset.set((tiles.side % 8) / 8, 1 - (Math.floor(tiles.side / 8) + 1) / 8);
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    for (let i = 0; i < 2; i++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
      plane.rotation.y = i * Math.PI / 2;
      plane.position.y = 0.08;
      group.add(plane);
    }
    heldTextures.push(tex);
  } else {
    const faceTilesOrder = [tiles.side, tiles.side, tiles.top, tiles.bottom, tiles.side, tiles.side];
    const mats = faceTilesOrder.map((tile) => {
      const tex = atlasTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / 8, 1 / 8);
      tex.offset.set((tile % 8) / 8, 1 - (Math.floor(tile / 8) + 1) / 8);
      heldTextures.push(tex);
      return new THREE.MeshLambertMaterial({
        map: tex,
        transparent: id === 10 || id === 17,
        opacity: id === 17 ? 0.85 : 1,
      });
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mats);
    mesh.rotation.set(0, 0.5, 0);
    group.add(mesh);
  }
  heldBlockGroup = group;
  heldRoot.add(group);
  updateHeldPose();
}

function updateHeldPose() {
  const swingPhase = 1 - state.swing;
  const s = Math.sin(swingPhase * Math.PI);
  const bobAmt = state.player?.bobAmount ?? 0;
  const bob = state.player?.bob ?? 0;
  const base = state.heldBase || { x: 0.36, y: -0.34 };
  heldRoot.position.x = base.x + Math.cos(bob) * 0.012 * bobAmt + s * 0.03;
  heldRoot.position.y = base.y + Math.sin(bob * 2) * 0.016 * bobAmt - s * 0.1;
  heldRoot.rotation.x = 0.12 + s * 0.62;
  heldRoot.rotation.z = 0.08 + Math.sin(bob) * 0.02 * bobAmt - s * 0.1;
}

// ---------------------------------------------------------------- selection
const selectionGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
const selectionMat = new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.55, depthWrite: false });
const selection = new THREE.LineSegments(selectionGeo, selectionMat);
selection.visible = false;
selection.renderOrder = 4;
scene.add(selection);

// ---------------------------------------------------------------- world generation
async function buildWorld(worldSeed, savedEdits, savedPlayer) {
  const world = new World(scene, {
    seed: worldSeed,
    chunks: WORLD_CHUNKS,
    materials,
    edits: editsFromObject(savedEdits),
  });
  state.world = world;
  ui.setGeneration(0.002, 'Генерація світу…', 'створюємо гори, ліси та океан');
  await world.generate((p) => {
    ui.setGeneration(p, undefined, undefined);
  });
  const player = new Player(world, camera);
  state.player = player;
  player.setSensitivity(settings.sensitivity);
  player.invertY = !!settings.invertY;
  let restored = false;
  if (savedPlayer && Number.isFinite(savedPlayer.x) && Number.isFinite(savedPlayer.z)) {
    const py = Number(savedPlayer.y);
    player.pos.set(savedPlayer.x, Number.isFinite(py) ? py : world.spawn.y, savedPlayer.z);
    player.yaw = Number(savedPlayer.yaw) || 0;
    player.pitch = Number(savedPlayer.pitch) || 0;
    player.flying = !!savedPlayer.flying;
    if (player.collides(player.pos.x, player.pos.y, player.pos.z) || player.pos.y < 1 || player.pos.y > 78) {
      player.spawnAt(world.spawn);
    } else {
      restored = true;
    }
  } else {
    player.spawnAt(world.spawn);
  }
  player.onStep = (blockId) => {
    const snd = BLOCKS[blockId]?.sound || (blockId === WATER ? 'water' : 'grass');
    audio.step(snd);
  };
  player.updateCamera();
  state.ready = true;
  ui.setReady(restored ? 'продовжити збережений світ' : `острів ${world.width} × ${world.width}`);
  if (state.pendingStart) startGame();
  window.__voxelcraft = { world, player, sky, state, ui, scene, camera, renderer, heldScene, heldRoot, heldCamera };
  return world;
}

const savedPlayer = save && save.seed === seed ? save.player : null;
const savedEdits = save && save.seed === seed ? save.edits : null;
buildWorld(seed, savedEdits, savedPlayer).catch((error) => {
  console.error(error);
  ui.setGeneration(0, 'Помилка генерації', 'спробуйте оновити сторінку');
  $('error-box').classList.remove('hidden');
  $('error-text').textContent = String(error?.message || error);
});

// ---------------------------------------------------------------- game flow
function playClicked() {
  audio.enable();
  const chosen = ui.seedValue();
  if (chosen !== seed) {
    newWorld(false, chosen);
    return;
  }
  if (!state.ready) { state.pendingStart = true; return; }
  startGame();
}

function startGame() {
  if (!state.ready || !state.player) { state.pendingStart = true; return; }
  state.pendingStart = false;
  state.mode = 'playing';
  state.paused = false;
  state.inventory = false;
  ui.hideMenu();
  ui.hidePause();
  ui.hideInventory();
  ui.setLoading(false);
  camera.fov = 75;
  camera.updateProjectionMatrix();
  state.player.updateCamera();
  ui.toast(`Сід ${seed} · ${state.world.width}×${state.world.width}`, 2400);
  ui.showRotateHint();
  audio.enable();
  audio.ui();
  ui.setMuted(audio.muted);
  ui.setFlyState(state.player.flying);
  requestPointerLock();
  state.lastSave = performance.now();
}

function pauseGame() {
  if (state.mode !== 'playing' || state.paused) return;
  state.paused = true;
  state.mining = false;
  state.rightHeld = false;
  state.dragging = false;
  resetMoveInput();
  ui.showPause();
  if (ui.inventoryOpen()) { state.inventory = false; ui.hideInventory(); }
  if (document.pointerLockElement) document.exitPointerLock?.();
  saveGame(true);
}

function resumeGame() {
  if (state.mode !== 'playing') return;
  if (ui.settingsOpen()) { ui.closeSettings(); }
  state.paused = false;
  state.inventory = false;
  ui.hidePause();
  ui.hideInventory();
  requestPointerLock();
  audio.ui();
}

function openInventory() {
  if (state.mode !== 'playing' || state.paused) {
    if (state.paused) {
      ui.hidePause();
      state.paused = false;
    }
  }
  if (state.mode !== 'playing') return;
  state.inventory = true;
  state.mining = false;
  state.rightHeld = false;
  resetMoveInput();
  if (ui.isTouch) ui.touchUI.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock?.();
}

function closeInventory() {
  if (!state.inventory) return;
  state.inventory = false;
  ui.hideInventory();
  if (state.mode === 'playing' && !state.paused) requestPointerLock();
}

function goToMenu() {
  saveGame(true);
  try { localStorage.setItem(SEED_KEY, String(seed)); } catch { /* ignore */ }
  location.href = location.pathname + `?seed=${seed}`;
}

function newWorld(randomSeed, explicitSeed) {
  if (state.mode === 'playing' && !window.confirm('Створити новий світ? Незбережені зміни буде втрачено.')) return;
  saveGame(true);
  let nextSeed = explicitSeed;
  if (!Number.isFinite(nextSeed)) {
    nextSeed = randomSeed ? Math.floor(Math.random() * 900000) + 100000 : ui.seedValue();
  }
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(SEED_KEY, String(nextSeed));
  } catch { /* ignore */ }
  location.href = `${location.pathname}?seed=${nextSeed}&fresh=1`;
}

function toggleFly() {
  if (!state.player || state.mode !== 'playing' || state.paused) return;
  const flying = state.player.toggleFly();
  ui.setFlyState(flying);
  ui.toast(flying ? 'Політ увімкнено' : 'Політ вимкнено', 1400);
  audio.ui();
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  ui.setMuted(audio.muted);
  ui.toast(audio.muted ? 'Звук вимкнено' : 'Звук увімкнено', 1200);
}

function applySettings(s) {
  Object.assign(settings, s);
  saveSettings(s);
  if (state.player) {
    state.player.setSensitivity(s.sensitivity);
    state.player.invertY = !!s.invertY;
  }
  audio.setVolume(s.volume);
  if (sky) sky.setFogDistance(s.fog);
  const stats = $('stats');
  if (stats) stats.style.display = s.showStats ? '' : 'none';
}

// ---------------------------------------------------------------- saving
function saveGame(force = false) {
  if (!state.world || !state.player || !state.ready) return;
  if (!force && performance.now() - state.lastSave < 15000) return;
  const payload = {
    v: 2,
    seed,
    time: sky.time,
    edits: editsToObject(state.world.edits),
    player: {
      x: +state.player.pos.x.toFixed(3),
      y: +state.player.pos.y.toFixed(3),
      z: +state.player.pos.z.toFixed(3),
      yaw: +state.player.yaw.toFixed(4),
      pitch: +state.player.pitch.toFixed(4),
      flying: state.player.flying,
    },
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    state.lastSave = performance.now();
    state.saveDirty = false;
  } catch (error) {
    console.warn('save failed', error);
    ui.toast('Не вдалося зберегти світ (сховище переповнене)', 3000);
  }
}

window.addEventListener('beforeunload', () => saveGame(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(true);
});

// ---------------------------------------------------------------- input helpers
function resetMoveInput() {
  if (!state.player) return;
  state.player.input.forward = 0;
  state.player.input.strafe = 0;
  state.player.input.jump = false;
  state.player.input.sprint = false;
  state.player.input.down = false;
  resetJoystick();
}

function canControl() {
  return state.mode === 'playing' && !state.paused && !state.inventory && !ui.settingsOpen();
}

function requestPointerLock() {
  if (ui.isTouch) return;
  try {
    const result = canvas.requestPointerLock?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch { /* fall back to drag look */ }
}

document.addEventListener('pointerlockchange', () => {
  state.locked = document.pointerLockElement === canvas;
  if (!state.locked && state.mode === 'playing' && !state.paused && !state.inventory && !ui.settingsOpen()) {
    pauseGame();
  }
});

document.addEventListener('mousemove', (event) => {
  if (!canControl() || !state.player) return;
  if (state.locked) {
    state.player.look(event.movementX || 0, event.movementY || 0);
  } else if (state.dragging) {
    state.player.look(event.movementX || 0, event.movementY || 0);
  }
});

canvas.addEventListener('mousedown', (event) => {
  if (!canControl()) return;
  audio.enable();
  if (event.button === 0) {
    state.dragging = true;
    state.mining = true;
    if (!state.locked) requestPointerLock();
    if (!state.locked) swing();
  } else if (event.button === 2) {
    state.rightHeld = true;
    placeBlock();
    state.rightCooldown = 0.22;
  } else if (event.button === 1) {
    pickBlock();
    event.preventDefault();
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) { state.mining = false; state.dragging = false; }
  if (event.button === 2) state.rightHeld = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (event.code === 'F3') {
    event.preventDefault();
    settings.showStats = !settings.showStats;
    const box = $('set-fps');
    if (box) box.checked = settings.showStats;
    applySettings(settings);
    if (state.player) ui.toast(settings.showStats ? 'Статистика увімкнена' : 'Статистика вимкнена', 1200);
    return;
  }
  if (event.code === 'KeyM') { toggleMute(); return; }
  if (event.code === 'Escape') {
    event.preventDefault();
    if (state.mode === 'menu') return;
    if (ui.settingsOpen()) { ui.closeSettings(); return; }
    if (ui.inventoryOpen() || state.inventory) { closeInventory(); return; }
    if (state.paused) resumeGame();
    else pauseGame();
    return;
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    if (state.mode !== 'playing') return;
    if (ui.inventoryOpen()) closeInventory();
    else {
      if (state.paused) { state.paused = false; ui.hidePause(); }
      ui.showInventory();
    }
    return;
  }
  if (state.mode !== 'playing' || !state.player) return;
  if (ui.inventoryOpen() || state.paused) return;
  const player = state.player;
  switch (event.code) {
    case 'KeyW': case 'ArrowUp': player.input.forward = 1; break;
    case 'KeyS': case 'ArrowDown': player.input.forward = -1; break;
    case 'KeyA': case 'ArrowLeft': player.input.strafe = -1; break;
    case 'KeyD': case 'ArrowRight': player.input.strafe = 1; break;
    case 'ShiftLeft': case 'ShiftRight': player.input.sprint = true; break;
    case 'ControlLeft': case 'ControlRight': player.input.down = true; break;
    case 'Space':
      event.preventDefault();
      if (!event.repeat) {
        const now = performance.now();
        if (now - state.lastSpace < 260) {
          state.lastSpace = 0;
          toggleFly();
        } else {
          state.lastSpace = now;
          player.input.jump = true;
        }
      }
      break;
    case 'KeyF': if (!event.repeat) toggleFly(); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
    case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
      ui.selectSlot(Number(event.code.slice(-1)) - 1);
      audio.ui();
      break;
    default: break;
  }
  if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  if (!state.player) return;
  switch (event.code) {
    case 'KeyW': case 'ArrowUp': if (state.player.input.forward > 0) state.player.input.forward = 0; break;
    case 'KeyS': case 'ArrowDown': if (state.player.input.forward < 0) state.player.input.forward = 0; break;
    case 'KeyA': case 'ArrowLeft': if (state.player.input.strafe < 0) state.player.input.strafe = 0; break;
    case 'KeyD': case 'ArrowRight': if (state.player.input.strafe > 0) state.player.input.strafe = 0; break;
    case 'ShiftLeft': case 'ShiftRight': state.player.input.sprint = false; break;
    case 'ControlLeft': case 'ControlRight': state.player.input.down = false; break;
    case 'Space': state.player.input.jump = false; break;
    default: break;
  }
});

canvas.addEventListener('wheel', (event) => {
  if (!canControl()) return;
  event.preventDefault();
  const dir = event.deltaY > 0 ? 1 : -1;
  ui.selectSlot((ui.selected + dir + ui.hotbar.length) % ui.hotbar.length);
}, { passive: false });

// ---------------------------------------------------------------- touch
function touchJump() {
  if (!state.player) return;
  state.player.input.jump = true;
  setTimeout(() => { if (state.player) state.player.input.jump = false; }, 170);
  audio.enable();
}

function resetJoystick() {
  state.joystickId = null;
  const knob = $('joystick-knob');
  const joy = $('joystick');
  if (knob) knob.style.transform = 'translate(-50%,-50%)';
  if (joy) joy.classList.remove('active');
}

function updateJoystick(event) {
  const joy = $('joystick');
  const knob = $('joystick-knob');
  const rect = joy.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const max = rect.width * 0.33;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  if (state.player) {
    state.player.input.strafe = clamp(dx / max, -1, 1);
    state.player.input.forward = clamp(-dy / max, -1, 1);
  }
}

function setupTouch() {
  if (!ui.isTouch) return;
  const joy = $('joystick');
  joy.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    audio.enable();
    state.joystickId = event.pointerId;
    joy.setPointerCapture(event.pointerId);
    joy.classList.add('active');
    updateJoystick(event);
  });
  joy.addEventListener('pointermove', (event) => {
    if (state.joystickId !== event.pointerId) return;
    event.preventDefault();
    updateJoystick(event);
  });
  const end = (event) => {
    if (state.joystickId !== event.pointerId) return;
    resetJoystick();
    if (state.player) {
      state.player.input.forward = 0;
      state.player.input.strafe = 0;
    }
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  // look by dragging the world
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !canControl()) return;
    audio.enable();
    state.touchLookId = event.pointerId;
    state.touchLook.x = event.clientX;
    state.touchLook.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.touchLookId !== event.pointerId || !state.player) return;
    const dx = event.clientX - state.touchLook.x;
    const dy = event.clientY - state.touchLook.y;
    state.touchLook.x = event.clientX;
    state.touchLook.y = event.clientY;
    state.player.look(dx * 1.5, dy * 1.5);
  });
  const endLook = (event) => {
    if (state.touchLookId === event.pointerId) state.touchLookId = null;
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  const hold = (id, down, up) => {
    const el = $(id);
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      audio.enable();
      el.classList.add('held');
      down();
    });
    const release = (event) => {
      el.classList.remove('held');
      up?.();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  };
  hold('t-mine', () => { state.mining = true; }, () => { state.mining = false; });
  hold('t-place', () => { placeBlock(); state.rightHeld = true; }, () => { state.rightHeld = false; });
  hold('t-jump', () => {
    if (!state.player) return;
    state.player.input.jump = true;
  }, () => {
    if (state.player) state.player.input.jump = false;
  });
  hold('t-down', () => {
    if (state.player) state.player.input.down = true;
  }, () => {
    if (state.player) state.player.input.down = false;
  });
}
setupTouch();

// hide orientation hint on rotate
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  heldCamera.aspect = window.innerWidth / window.innerHeight;
  heldCamera.updateProjectionMatrix();
  layoutHeld();
  if (window.innerWidth > window.innerHeight) $('rotate-hint').classList.add('hidden');
});

// ---------------------------------------------------------------- interactions
function targetBlock() {
  if (!state.player || !state.world) return null;
  const origin = state.player.eyePosition();
  const dir = state.player.forwardVector();
  return state.world.raycast(origin, dir, 7);
}

function particlesFor(id, x, y, z, count = 12, spread = 2.2) {
  const tile = faceTile(id, 'side');
  const color = tileAverageColor(atlasCanvas, tile);
  particles.burst({ x, y, z }, color, count, spread, 0.105, 0.9);
}

function swing() {
  state.swing = 1;
}

function breakBlock(hit) {
  if (!hit || !state.world) return;
  const def = BLOCKS[hit.id];
  if (!def || hit.id === 14) return;
  const ok = state.world.setBlock(hit.x, hit.y, hit.z, AIR);
  if (!ok) return;
  particlesFor(hit.id, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 16, 2.6);
  audio.breakBlock(def.sound);
  state.saveDirty = true;
  state.target = null;
  state.miningProgress = 0;
  state.mineKey = '';
  selection.visible = false;
  swing();
}

function placeBlock() {
  if (!canControl() || !state.world || !state.player) return;
  const hit = state.target;
  if (!hit) return;
  const id = ui.selectedBlock;
  if (!BLOCKS[id]) return;
  const x = hit.x + hit.normal[0];
  const y = hit.y + hit.normal[1];
  const z = hit.z + hit.normal[2];
  if (!state.world.inBounds(x, z) || y < 1 || y >= 78) return;
  const existing = state.world.getBlock(x, y, z);
  if (existing !== AIR && existing !== WATER && !isCross(existing)) return;
  if (isSolid(id) && state.player.intersectsBlock(x, y, z)) return;
  if (state.world.setBlock(x, y, z, id)) {
    audio.place(BLOCKS[id].sound);
    particlesFor(id, x + 0.5, y + 0.5, z + 0.5, 6, 1.2);
    state.saveDirty = true;
    swing();
  }
}

function pickBlock() {
  const hit = state.target;
  if (!hit) return;
  if (BLOCKS[hit.id] && hit.id !== 14 && hit.id !== WATER) {
    ui.setSlotBlock(hit.id);
    audio.ui();
  }
}

function updateInteraction(dt) {
  state.target = targetBlock();
  const hit = state.target;
  if (hit) {
    selection.visible = true;
    selection.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  } else {
    selection.visible = false;
  }

  if (state.rightHeld && canControl()) {
    state.rightCooldown -= dt;
    if (state.rightCooldown <= 0) {
      placeBlock();
      state.rightCooldown = 0.2;
    }
  } else {
    state.rightCooldown = 0;
  }

  const canMine = state.mining && canControl() && hit && hit.id !== 14;
  if (canMine) {
    const key = `${hit.x},${hit.y},${hit.z}`;
    if (key !== state.mineKey) {
      state.mineKey = key;
      state.miningProgress = 0;
    }
    const def = BLOCKS[hit.id];
    const hardness = Math.max(0.045, def?.hardness ?? 0.5);
    state.miningProgress += dt / hardness;
    state.mineSoundTimer -= dt;
    if (state.mineSoundTimer <= 0) {
      audio.dig(def?.sound || 'stone');
      state.mineSoundTimer = 0.16;
      if (Math.random() < 0.5) particlesFor(hit.id, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 1, 0.8);
      swing();
    }
    if (state.miningProgress >= 1) breakBlock(hit);
    ui.setBreakProgress(Math.min(1, state.miningProgress));
  } else {
    state.miningProgress = Math.max(0, state.miningProgress - dt * 2.5);
    if (!state.mining) state.mineKey = '';
    ui.setBreakProgress(state.miningProgress > 0.02 ? Math.min(1, state.miningProgress) : 0);
  }
}

// ---------------------------------------------------------------- main loop
function updateMenuCamera(dt) {
  const t = performance.now() * 0.00004;
  if (state.ready) {
    camera.position.set(Math.cos(t) * 132, 84 + Math.sin(t * 0.7) * 3, Math.sin(t) * 132);
    camera.lookAt(0, 36, 0);
  } else {
    camera.position.set(Math.cos(t) * 110, 66, Math.sin(t) * 110);
    camera.lookAt(0, 36, 0);
  }
  if (Math.abs(camera.fov - 55) > 0.05) {
    camera.fov = 55;
    camera.updateProjectionMatrix();
  }
}

function updateClock(force = false) {
  const text = sky.clockString;
  const night = sky.sunDir.y < 0.02;
  ui.setClock(text, night);
}

function animate(now) {
  const dt = Math.min(0.08, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (state.mode === 'menu') {
    updateMenuCamera(dt);
  } else {
    if (state.player && state.world) {
      if (!state.paused && !state.inventory) {
        state.player.update(dt, state.world);
        const lim = state.world.half - 1.2;
        state.player.pos.x = clamp(state.player.pos.x, -lim, lim);
        state.player.pos.z = clamp(state.player.pos.z, -lim, lim);
        updateInteraction(dt);
        if (state.player.isUnderwater() !== state.underwater) {
          state.underwater = !state.underwater;
          ui.setUnderwater(state.underwater);
        }
        if (state.inWorldCheck !== true) { state.inWorldCheck = true; }
      }
      if (state.swing > 0) state.swing = Math.max(0, state.swing - dt * 3.4);
      updateHeldPose();
      if (state.heldId !== ui.selectedBlock) rebuildHeldItem(ui.selectedBlock);
    }
  }

  sky.update(dt, camera);
  state.world?.update();

  // unlit plant billboards need a manual day/night tint so they don't glow at night
  const plantDay = Math.max(0, Math.min(1, sky.sunDir.y * 2.6 + 0.35));
  materials.plant.color.setScalar(0.34 + plantDay * 0.66);

  // fog + underwater tint
  if (state.world) {
    if (state.underwater && state.mode === 'playing') {
      sky.fog.color.setHex(0x0d4058);
      sky.fog.near = 0.4;
      sky.fog.far = 26;
    } else if (state.mode === 'menu') {
      sky.fog.near = 190;
      sky.fog.far = 430;
    } else {
      sky.fog.near = settings.fog * 0.45;
      sky.fog.far = settings.fog;
    }
  }
  updateWaterMaterial(materials.water, sky.elapsed, sky);
  particles.update(dt);
  audio.update(dt, sky);

  // HUD
  state.frames++;
  state.fpsTime += dt;
  if (state.fpsTime >= 0.5) {
    state.fps = Math.round(state.frames / state.fpsTime);
    state.frames = 0;
    state.fpsTime = 0;
    if (state.mode === 'playing' && state.player) {
      ui.setStats(state.fps, state.player.pos.x, state.player.pos.y, state.player.pos.z);
    }
    updateClock();
  }

  if (state.mode === 'playing' && !state.paused) {
    saveGame(false);
  }

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  if (state.mode === 'playing' && !state.paused && !state.inventory) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(heldScene, heldCamera);
    renderer.autoClear = true;
  }

  requestAnimationFrame(animate);
}

updateClock(true);
ui.showMenu();
requestAnimationFrame(animate);
