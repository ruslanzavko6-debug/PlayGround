// CS:GO 1.6 — browser FPS built on a tiny raycasting engine.

import { Renderer } from './renderer.js';
import { createWorld } from './world.js';
import { AudioEngine } from './audio.js';
import {
  WEAPONS,
  WEAPON_ORDER,
  makeLoadout,
  startReload,
  switchWeapon,
  updateWeapon,
  tryShoot,
  updateEnemies,
  spawnEnemies,
} from './combat.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new Renderer(canvas);
const world = createWorld();
const audio = new AudioEngine();
const touchUI =
  window.matchMedia('(pointer: coarse)').matches ||
  navigator.maxTouchPoints > 0 ||
  window.innerWidth < 820;

function makePlayer() {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    angle: world.spawn.angle,
    pitch: 0,
    health: 100,
    armor: 100,
    weapon: 'ak',
    weapons: makeLoadout(),
    cooldown: 0,
    reloading: 0,
    reloadTotal: 0,
    recoil: 0,
    flash: 0,
    swing: 0,
    crouch: false,
    moving: false,
    bob: 0,
    sway: 0,
  };
}

const game = {
  state: 'menu',
  time: 0,
  round: 1,
  roundTime: 105,
  roundActive: false,
  transition: 0,
  roundStartDelay: 0,
  kills: 0,
  headshots: 0,
  shots: 0,
  hits: 0,
  money: 800,
  enemies: [],
  particles: [],
  viewH: renderer.H,
  player: makePlayer(),
  firing: false,
  fireEdge: false,
  shake: 0,
  hurt: 0,
  muzzle: 0,
  hitmarker: 0,
  hitmarkerHead: false,
  bobPhase: 0,
  stepTimer: 0,
  bannerTimer: 0,
  deathTimer: 0,
  hintTimer: 7,
  autoReload: 0,
  menuCam: { x: 20.5, y: 28.5, angle: Math.PI - 0.32, pan: 0.06 },
};

game.damagePlayer = (amount, source) => {
  if (game.state !== 'playing') return;
  const p = game.player;
  let dmg = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.5);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.health -= dmg;
  game.hurt = Math.min(1, game.hurt + 0.55);
  game.shake = Math.max(game.shake, 3.2);
  audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    die(source);
  }
};

game.onEnemyKilled = (enemy, head) => {
  addKillFeed(enemy, head);
  if (game.roundActive && game.enemies.every((e) => !e.alive)) roundWon();
};

// ---------- element refs ----------

const el = {
  hud: $('hud'),
  menu: $('menu'),
  pause: $('pause'),
  gameover: $('gameover'),
  touch: $('touch'),
  health: $('health'),
  armor: $('armor'),
  money: $('money'),
  ammoNow: $('ammoNow'),
  ammoReserve: $('ammoReserve'),
  weaponName: $('weaponName'),
  ammo: $('ammo'),
  vitals: $('vitals'),
  timer: $('timer'),
  roundLabel: $('roundLabel'),
  enemyCount: $('enemyCount'),
  crosshair: $('crosshair'),
  hitmarker: $('hitmarker'),
  damage: $('damage'),
  lowhp: $('lowhp'),
  banner: $('banner'),
  bannerTitle: $('bannerTitle'),
  bannerSub: $('bannerSub'),
  killfeed: $('killfeed'),
  radar: $('radar'),
  hint: $('hint'),
  goTitle: $('goTitle'),
  goReason: $('goReason'),
  goKills: $('goKills'),
  goHeads: $('goHeads'),
  goAcc: $('goAcc'),
  goRound: $('goRound'),
  goMoney: $('goMoney'),
  menuBestKills: $('menuBestKills'),
  menuBestRound: $('menuBestRound'),
  menuBestAcc: $('menuBestAcc'),
  soundBtn: $('soundBtn'),
  pauseSoundBtn: $('pauseSoundBtn'),
  roundstate: $('roundstate'),
};

const radarCtx = el.radar.getContext('2d');
const textCache = new Map();
const classCache = new Map();

function setClass(key, node, name, on) {
  if (classCache.get(key) === on) return;
  classCache.set(key, on);
  node.classList.toggle(name, on);
  node.classList.toggle('off-' + name, !on);
}

function setOpacity(node, key, value) {
  const v = value.toFixed(2);
  if (classCache.get(key) === v) return;
  classCache.set(key, v);
  node.style.opacity = v;
}

// static radar map layer, drawn once
const radarBase = document.createElement('canvas');
radarBase.width = 160;
radarBase.height = 160;
const radarBaseCtx = radarBase.getContext('2d');
const radarScale = Math.min(148 / world.w, 148 / world.h);
const radarOx = (160 - world.w * radarScale) / 2;
const radarOy = (160 - world.h * radarScale) / 2;
(function bakeRadar() {
  const c = radarBaseCtx;
  c.fillStyle = 'rgba(22,24,18,0.55)';
  c.fillRect(0, 0, 160, 160);
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.grid[y * world.w + x];
      if (!t) continue;
      c.fillStyle = t === 2 ? 'rgba(168,124,64,0.85)' : 'rgba(120,108,82,0.7)';
      c.fillRect(radarOx + x * radarScale, radarOy + y * radarScale, Math.ceil(radarScale), Math.ceil(radarScale));
    }
  }
})();

function setText(key, node, value) {
  if (textCache.get(key) === value) return;
  textCache.set(key, value);
  node.textContent = value;
}

function show(node) {
  node.classList.remove('hidden');
}

function hide(node) {
  node.classList.add('hidden');
}

let soundMuted = false;
try {
  soundMuted = localStorage.getItem('cs16-muted') === '1';
} catch {}
audio.setMuted(soundMuted);

function updateSoundLabels() {
  const label = soundMuted ? 'ЗВУК: ВЫКЛ' : 'ЗВУК: ВКЛ';
  el.soundBtn.textContent = label;
  el.pauseSoundBtn.textContent = label;
}

function toggleSound() {
  soundMuted = !soundMuted;
  audio.init();
  audio.setMuted(soundMuted);
  try {
    localStorage.setItem('cs16-muted', soundMuted ? '1' : '0');
  } catch {}
  updateSoundLabels();
  if (!soundMuted) audio.ui();
}

function readBest() {
  try {
    return JSON.parse(localStorage.getItem('cs16-best') || '{}');
  } catch {
    return {};
  }
}

function saveBest() {
  const best = readBest();
  const acc = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
  best.kills = Math.max(best.kills || 0, game.kills);
  best.round = Math.max(best.round || 0, game.round);
  best.acc = Math.max(best.acc || 0, acc);
  try {
    localStorage.setItem('cs16-best', JSON.stringify(best));
  } catch {}
  updateMenuBest();
}

function updateMenuBest() {
  const best = readBest();
  setText('bk', el.menuBestKills, String(best.kills || 0));
  setText('br', el.menuBestRound, String(best.round || 0));
  setText('ba', el.menuBestAcc, `${best.acc || 0}%`);
}

function banner(title, sub, seconds = 2.2) {
  el.bannerTitle.textContent = title;
  el.bannerSub.textContent = sub;
  el.banner.classList.add('show');
  game.bannerTimer = seconds;
}

function addKillFeed(enemy, head) {
  const row = document.createElement('div');
  row.className = 'kf';
  const you = document.createElement('b');
  you.textContent = 'ВЫ';
  const arrow = document.createElement('span');
  arrow.textContent = '▸';
  const name = document.createElement('span');
  name.textContent = enemy.name;
  row.append(you, arrow, name);
  if (head) {
    const hs = document.createElement('span');
    hs.className = 'hs';
    hs.textContent = '★ HS';
    row.append(hs);
  }
  el.killfeed.appendChild(row);
  while (el.killfeed.children.length > 5) el.killfeed.firstElementChild.remove();
  setTimeout(() => {
    row.classList.add('out');
    setTimeout(() => row.remove(), 420);
  }, 3800);
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateHUD() {
  const p = game.player;
  setText('hp', el.health, String(Math.max(0, Math.ceil(p.health))));
  setText('ap', el.armor, String(Math.max(0, Math.ceil(p.armor))));
  setText('money', el.money, '$' + game.money);
  setText('timer', el.timer, fmtTime(game.roundTime));
  setText('round', el.roundLabel, `РАУНД ${game.round}`);
  const alive = game.enemies.filter((e) => e.alive).length;
  setText('enemies', el.enemyCount, `T: ${alive}`);
  setText('weapon', el.weaponName, WEAPONS[p.weapon].name);
  const st = p.weapons[p.weapon];
  if (p.weapon === 'knife') {
    setText('ammo', el.ammoNow, '∞');
    setText('reserve', el.ammoReserve, '');
  } else {
    setText('ammo', el.ammoNow, String(st.ammo));
    setText('reserve', el.ammoReserve, String(st.reserve));
  }
  setClass('ammoLow', el.ammo, 'low', p.weapon !== 'knife' && st.ammo <= Math.ceil(WEAPONS[p.weapon].mag * 0.25));
  setClass('hpLow', el.health.parentElement, 'low', p.health <= 30);
  setClass('apLow', el.armor.parentElement, 'low', p.armor <= 0);
  setClass('timeLow', el.timer, 'low', game.roundTime <= 15 && game.roundActive);
  setClass('lowhpOn', el.lowhp, 'on', p.health > 0 && p.health <= 30);

  const spread = Math.round((5 + p.recoil * 13 + (p.moving ? 4 : 0) + (p.crouch ? -1 : 0)) * 2) / 2;
  if (classCache.get('gap') !== spread) {
    classCache.set('gap', spread);
    el.crosshair.style.setProperty('--gap', `${spread}px`);
  }

  setOpacity(el.hitmarker, 'hitop', Math.min(1, game.hitmarker * 7));
  setClass('hithead', el.hitmarker, 'head', game.hitmarkerHead);
  setOpacity(el.damage, 'dmgop', Math.min(0.85, game.hurt));
  setText('reloadText', el.roundstate, p.reloading > 0 ? 'ПЕРЕЗАРЯДКА…' : '');
  setClass('reloadHidden', el.roundstate, 'hidden', p.reloading <= 0);
}

function drawRadar() {
  const ctx = radarCtx;
  const S = 160;
  const scale = radarScale;
  const ox = radarOx;
  const oy = radarOy;
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(radarBase, 0, 0);

  const p = game.player;
  const px = ox + p.x * scale;
  const py = oy + p.y * scale;
  // fov wedge
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
  grad.addColorStop(0, 'rgba(245,165,36,0.22)');
  grad.addColorStop(1, 'rgba(245,165,36,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 24, -0.55, 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd37a';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, 4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-4, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const visible = d < 22 && (world.lineOfSight(p.x, p.y, e.x, e.y) || e.alerted);
    if (!visible) continue;
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(ox + e.x * scale, oy + e.y * scale, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,74,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox + e.x * scale, oy + e.y * scale, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function startGame() {
  audio.init();
  audio.setMuted(soundMuted);
  audio.resume();
  resetGame();
  hide(el.menu);
  hide(el.gameover);
  hide(el.pause);
  show(el.hud);
  if (touchUI) show(el.touch);
  document.body.classList.add('in-game');
  document.body.classList.remove('menu-open');
  el.hint.classList.remove('fade');
  game.hintTimer = 7;
  startRound(1);
  updateHUD();
  if (!touchUI) lockPointer();
}

function resetGame() {
  game.state = 'playing';
  game.round = 1;
  game.roundTime = 105;
  game.roundActive = false;
  game.transition = 0;
  game.kills = 0;
  game.headshots = 0;
  game.shots = 0;
  game.hits = 0;
  game.money = 800;
  game.player = makePlayer();
  game.enemies = [];
  game.particles = [];
  game.firing = false;
  game.fireEdge = false;
  game.shake = 0;
  game.hurt = 0;
  game.muzzle = 0;
  game.hitmarker = 0;
  game.bannerTimer = 0;
  game.deathTimer = 0;
  game.autoReload = 0;
  el.killfeed.innerHTML = '';
  el.banner.classList.remove('show');
}

function startRound(n) {
  const p = game.player;
  game.round = n;
  game.roundTime = 105;
  game.roundActive = false;
  game.roundStartDelay = 1.15;
  game.transition = 0;
  game.firing = false;
  game.fireEdge = false;
  game.particles = [];
  p.health = 100;
  p.armor = 100;
  p.weapons = makeLoadout();
  p.weapon = 'ak';
  p.x = world.spawn.x;
  p.y = world.spawn.y;
  p.angle = world.spawn.angle;
  p.pitch = 0;
  p.cooldown = 0;
  p.reloading = 0;
  p.reloadTotal = 0;
  p.recoil = 0;
  p.flash = 0;
  p.swing = 0;
  p.bob = 0;
  p.sway = 0;
  game.bobPhase = 0;
  game.enemies = spawnEnemies(world, p, Math.min(3 + n, 9), renderer.tex.enemies);
  banner(
    n === 1 ? 'РАУНД 1' : `РАУНД ${n}`,
    n === 1 ? 'УСТРАНИТЕ ВСЕХ ТЕРРОРИСТОВ' : `ТЕРРОРИСТОВ: ${game.enemies.length}`,
    2.1
  );
  audio.roundStart();
  updateHUD();
}

function roundWon() {
  game.roundActive = false;
  game.transition = 2.7;
  game.money += 2500;
  saveBest();
  banner('РАУНД ВЫИГРАН', '+$2500 · СЛЕДУЮЩИЙ РАУНД', 2.5);
  audio.win();
  game.firing = false;
}

function die() {
  if (game.state !== 'playing') return;
  game.state = 'dead';
  game.deathTimer = 0.9;
  game.roundActive = false;
  game.firing = false;
  saveBest();
  audio.lose();
  hide(el.touch);
  document.body.classList.remove('in-game');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function showGameOver(title, reason) {
  game.state = 'gameover';
  const acc = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
  el.goTitle.textContent = title;
  el.goReason.textContent = reason;
  el.goKills.textContent = String(game.kills);
  el.goHeads.textContent = String(game.headshots);
  el.goAcc.textContent = `${acc}%`;
  el.goRound.textContent = String(game.round);
  el.goMoney.textContent = `$${game.money}`;
  show(el.gameover);
  hide(el.hud);
  hide(el.touch);
  hide(el.banner);
  el.banner.classList.remove('show');
  document.body.classList.remove('in-game');
  saveBest();
}

function timeUp() {
  game.roundTime = 0;
  game.roundActive = false;
  game.state = 'gameover';
  hide(el.touch);
  showGameOver('ВРЕМЯ ВЫШЛО', 'Раунд не был зачищен вовремя.');
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  game.firing = false;
  show(el.pause);
  hide(el.touch);
  document.body.classList.remove('in-game');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function resumeGame() {
  if (game.state !== 'paused') return;
  hide(el.pause);
  game.state = 'playing';
  document.body.classList.add('in-game');
  if (touchUI) show(el.touch);
  audio.resume();
  if (!touchUI) lockPointer();
}

function toMenu() {
  game.state = 'menu';
  hide(el.pause);
  hide(el.gameover);
  hide(el.hud);
  hide(el.touch);
  show(el.menu);
  document.body.classList.remove('in-game');
  document.body.classList.add('menu-open');
  updateMenuBest();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  saveBest();
}

updateMenuBest();
updateSoundLabels();

// ---------- input ----------

const keys = Object.create(null);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
let joyX = 0;
let joyY = 0;
let lookId = null;
let lookX = 0;
let lookY = 0;
let lockWasActive = false;

function lockPointer() {
  if (touchUI) return;
  try {
    const p = canvas.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {}
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked && !lockWasActive) {
    lockWasActive = true;
  } else if (!locked && lockWasActive) {
    lockWasActive = false;
    if (game.state === 'playing') pauseGame();
  }
});

window.addEventListener('keydown', (e) => {
  const code = e.code;
  keys[code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
  if (code === 'Escape') {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
    return;
  }
  if (e.repeat) return;
  if (code === 'KeyR' && game.state === 'playing') {
    audio.init();
    startReload(game, audio);
  }
  if (game.state !== 'playing') return;
  if (code === 'Digit1') switchWeapon(game, 'ak', audio);
  if (code === 'Digit2') switchWeapon(game, 'usp', audio);
  if (code === 'Digit3') switchWeapon(game, 'knife', audio);
  if (code === 'KeyQ') {
    const i = WEAPON_ORDER.indexOf(game.player.weapon);
    switchWeapon(game, WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length], audio);
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

let dragLook = null;
let lockUnavailable = false;

document.addEventListener('mousemove', (e) => {
  if (game.state !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    const p = game.player;
    p.angle += e.movementX * 0.0023;
    p.pitch = clamp(p.pitch - e.movementY * 1.15, -renderer.H * 0.26, renderer.H * 0.26);
    p.sway = clamp(p.sway - e.movementX * 0.35, -16, 16);
    return;
  }
  // fallback for embedded previews where pointer lock is unavailable: drag to look
  if (dragLook && e.buttons !== 0) {
    const p = game.player;
    const dx = e.clientX - dragLook.x;
    const dy = e.clientY - dragLook.y;
    dragLook.x = e.clientX;
    dragLook.y = e.clientY;
    p.angle += dx * 0.0032;
    p.pitch = clamp(p.pitch - dy * 1.1, -renderer.H * 0.26, renderer.H * 0.26);
    p.sway = clamp(p.sway - dx * 0.35, -16, 16);
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'playing' || touchUI) return;
  audio.init();
  audio.resume();
  dragLook = { x: e.clientX, y: e.clientY };
  if (document.pointerLockElement !== canvas && !lockUnavailable) lockPointer();
  if (e.button === 0) {
    game.firing = true;
    game.fireEdge = true;
    if (game.hintTimer > 2) game.hintTimer = 2;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) game.firing = false;
  dragLook = null;
});

window.addEventListener('blur', () => {
  game.firing = false;
  dragLook = null;
});

canvas.addEventListener('pointerlockerror', () => {
  lockUnavailable = true;
  if (game.hintTimer <= 0) {
    game.hintTimer = 4;
    el.hint.classList.remove('fade');
    el.hint.textContent = 'Зажмите ЛКМ и ведите мышью, чтобы оборачиваться';
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ----- touch: look -----
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || game.state !== 'playing') return;
  if (lookId !== null) return;
  lookId = e.pointerId;
  lookX = e.clientX;
  lookY = e.clientY;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookId || game.state !== 'playing') return;
  const p = game.player;
  const dx = e.clientX - lookX;
  const dy = e.clientY - lookY;
  lookX = e.clientX;
  lookY = e.clientY;
  p.angle += dx * 0.0055;
  p.pitch = clamp(p.pitch - dy * 1.3, -renderer.H * 0.26, renderer.H * 0.26);
});

function endLook(e) {
  if (e.pointerId === lookId) lookId = null;
}
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', endLook);

// ----- touch: joystick -----
const joyEl = $('joy');
const knobEl = $('knob');
let joyId = null;
let joyRect = null;

function moveJoy(e) {
  if (!joyRect) return;
  const cx = joyRect.left + joyRect.width / 2;
  const cy = joyRect.top + joyRect.height / 2;
  const max = joyRect.width * 0.34;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const d = Math.hypot(dx, dy);
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
  }
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  joyX = dx / max;
  joyY = dy / max;
}

joyEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joyRect = joyEl.getBoundingClientRect();
  joyId = e.pointerId;
  try {
    joyEl.setPointerCapture(e.pointerId);
  } catch {}
  moveJoy(e);
});

joyEl.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyId) return;
  e.preventDefault();
  moveJoy(e);
});

function releaseJoy(e) {
  if (e.pointerId !== joyId) return;
  joyId = null;
  joyX = 0;
  joyY = 0;
  knobEl.style.transform = 'translate(0, 0)';
}
joyEl.addEventListener('pointerup', releaseJoy);
joyEl.addEventListener('pointercancel', releaseJoy);

function holdButton(node, onDown, onUp) {
  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onDown();
    try {
      node.setPointerCapture(e.pointerId);
    } catch {}
  });
  const up = (e) => {
    e.preventDefault();
    onUp?.();
  };
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
}

holdButton(
  $('btnFire'),
  () => {
    if (game.state !== 'playing') return;
    audio.init();
    audio.resume();
    game.firing = true;
    game.fireEdge = true;
    if (game.hintTimer > 2) game.hintTimer = 2;
  },
  () => {
    game.firing = false;
  }
);

$('btnReload').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  startReload(game, audio);
});

$('btnSwitch').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  const i = WEAPON_ORDER.indexOf(game.player.weapon);
  switchWeapon(game, WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length], audio);
});

$('btnPause').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pauseGame();
});

// ---------- menu + overlay buttons ----------

$('playBtn').addEventListener('click', () => {
  startGame();
});

$('howBtn').addEventListener('click', () => {
  const panel = $('howPanel');
  const isHidden = panel.classList.toggle('hidden');
  $('howBtn').setAttribute('aria-expanded', String(!isHidden));
  audio.init();
  audio.ui();
});

el.soundBtn.addEventListener('click', () => {
  audio.init();
  toggleSound();
});

el.pauseSoundBtn.addEventListener('click', () => {
  audio.init();
  toggleSound();
});

$('resumeBtn').addEventListener('click', () => {
  audio.init();
  resumeGame();
});

$('toMenuBtn').addEventListener('click', () => {
  audio.init();
  audio.ui();
  toMenu();
});

$('retryBtn').addEventListener('click', () => {
  audio.init();
  audio.resume();
  resetGame();
  hide(el.gameover);
  hide(el.menu);
  hide(el.pause);
  show(el.hud);
  if (touchUI) show(el.touch);
  document.body.classList.add('in-game');
  document.body.classList.remove('menu-open');
  startRound(1);
  if (!touchUI) lockPointer();
});

$('goMenuBtn').addEventListener('click', () => {
  audio.init();
  audio.ui();
  toMenu();
});

// ---------- update ----------

function updateEffects(dt) {
  game.shake *= Math.exp(-dt * 9);
  if (game.shake < 0.05) game.shake = 0;
  game.hurt = Math.max(0, game.hurt - dt * 1.45);
  game.hitmarker = Math.max(0, game.hitmarker - dt);
  game.muzzle = Math.max(0, game.muzzle - dt);
  if (game.hintTimer > 0) {
    game.hintTimer -= dt;
    if (game.hintTimer <= 0) el.hint.classList.add('fade');
  }
}

function updateParticles(dt) {
  const list = game.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vz -= 7 * dt;
    p.z += p.vz * dt;
    if (p.z < 0.02) {
      p.z = 0.02;
      p.vz *= -0.25;
      p.vx *= 0.55;
      p.vy *= 0.55;
    }
  }
}

function update(dt) {
  game.viewH = renderer.H;
  const p = game.player;

  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    if (game.bannerTimer <= 0) el.banner.classList.remove('show');
  }

  if (game.state === 'dead') {
    game.deathTimer -= dt;
    updateParticles(dt);
    updateEffects(dt);
    if (game.deathTimer <= 0) {
      showGameOver('ЛИКВИДИРОВАН', 'Террористы оказались быстрее. Цельте в голову и не стойте на месте.');
    }
    return;
  }

  if (game.state !== 'playing') return;

  if (game.transition > 0) {
    game.transition -= dt;
    updateParticles(dt);
    updateEffects(dt);
    updateHUD();
    if (game.transition <= 0) startRound(game.round + 1);
    return;
  }

  if (game.roundStartDelay > 0) {
    game.roundStartDelay -= dt;
    if (game.roundStartDelay <= 0) game.roundActive = true;
  }

  if (game.roundActive) {
    game.roundTime -= dt;
    if (game.roundTime <= 0) {
      timeUp();
      return;
    }
  }

  // movement
  let fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - joyY;
  let strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joyX;
  const mag = Math.hypot(fwd, strafe);
  if (mag > 1) {
    fwd /= mag;
    strafe /= mag;
  }
  p.crouch = !!(keys.ControlLeft || keys.ControlRight || keys.KeyC);
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && fwd > 0.1;
  const speed = (p.crouch ? 1.55 : 3.0) * (sprint ? 1.5 : 1);
  if (fwd !== 0 || strafe !== 0) {
    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const rightX = -dirY;
    const rightY = dirX;
    const vx = (dirX * fwd + rightX * strafe) * speed;
    const vy = (dirY * fwd + rightY * strafe) * speed;
    const nx = vx * dt;
    const ny = vy * dt;
    if (nx && !world.circleBlocked(p.x + nx, p.y, 0.27)) p.x += nx;
    if (ny && !world.circleBlocked(p.x, p.y + ny, 0.27)) p.y += ny;
    p.moving = true;
    game.bobPhase += dt * (sprint ? 11 : 7.5);
    game.stepTimer -= dt;
    if (game.stepTimer <= 0) {
      audio.step(0);
      game.stepTimer = sprint ? 0.3 : p.crouch ? 0.6 : 0.44;
    }
  } else {
    p.moving = false;
    game.stepTimer = 0;
  }

  p.sway *= Math.exp(-dt * 7);
  p.pitch = clamp(p.pitch, -renderer.H * 0.26, renderer.H * 0.26);

  updateWeapon(game, dt);

  if (game.autoReload > 0) {
    game.autoReload -= dt;
    if (game.autoReload <= 0) startReload(game, audio);
  }

  if (game.fireEdge) {
    game.fireEdge = false;
    tryShoot(game, world, audio);
  } else if (game.firing) {
    const w = WEAPONS[p.weapon];
    if (w.auto) tryShoot(game, world, audio);
  }

  updateEnemies(game, world, dt, audio);
  updateParticles(dt);
  updateEffects(dt);
  updateHUD();

  if (game.state === 'playing') {
    game.radarClock = (game.radarClock || 0) + dt;
    if (game.radarClock > 0.07) {
      game.radarClock = 0;
      drawRadar();
    }
  }
}

// ---------- render ----------

function renderGame() {
  const p = game.player;
  const bob = p.moving ? Math.sin(game.bobPhase * 2) * 2.4 : Math.sin(game.time * 1.6) * 0.7;
  const crouchDip = p.crouch ? renderer.H * 0.045 : 0;
  const anim = {
    weapon: p.weapon,
    recoil: p.recoil,
    reload: p.reloading > 0 ? Math.sin((1 - p.reloading / Math.max(0.01, p.reloadTotal)) * Math.PI) : 0,
    flash: p.flash,
    swing: p.swing,
    bob: game.bobPhase,
    sway: p.sway,
  };
  renderer.render({
    player: { ...p, pitch: p.pitch + bob - crouchDip },
    world,
    enemies: game.enemies,
    particles: game.particles,
    anim,
    hideWeapon: false,
  });
}

function renderMenu() {
  const t = game.time;
  const cam = game.menuCam;
  renderer.render({
    player: {
      x: cam.x,
      y: cam.y,
      angle: cam.angle + Math.sin(t * 0.1) * cam.pan,
      pitch: Math.sin(t * 0.16) * 2.5,
    },
    world,
    enemies: [],
    particles: [],
    anim: null,
    hideWeapon: true,
  });
}

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  game.time += dt;

  if (game.state === 'menu') {
    renderMenu();
  } else if (game.state === 'playing' || game.state === 'dead') {
    update(dt);
    renderGame();
  } else {
    renderGame();
  }

  if (game.shake > 0.05) {
    const s = game.shake;
    canvas.style.transform = `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)`;
  } else if (canvas.style.transform) {
    canvas.style.transform = '';
  }

  requestAnimationFrame(frame);
}

// ---------- boot ----------

document.body.classList.toggle('touch-ui', touchUI);
if (touchUI) hide(el.touch);
window.addEventListener('resize', () => {
  renderer.resize();
  game.viewH = renderer.H;
  game.player.pitch = clamp(game.player.pitch, -renderer.H * 0.26, renderer.H * 0.26);
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    renderer.resize();
    game.viewH = renderer.H;
  }, 220);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame();
});

window.__cs = { game, world, renderer, audio, startGame, startRound, tryShoot };

requestAnimationFrame(frame);
