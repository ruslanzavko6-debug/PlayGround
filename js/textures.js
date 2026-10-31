// Procedural pixel-art textures and terrorist sprites (no external assets).

const SIZE = 64;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rngFactory(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toImage(c) {
  return {
    w: c.width,
    h: c.height,
    data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
  };
}

function grain(ctx, w, h, rng, count, spread = 18) {
  for (let i = 0; i < count; i++) {
    const v = (rng() - 0.5) * spread;
    ctx.fillStyle = v > 0 ? `rgba(255,240,210,${v / 100})` : `rgba(20,12,4,${-v / 90})`;
    ctx.fillRect((rng() * w) | 0, (rng() * h) | 0, 1, rng() < 0.3 ? 2 : 1);
  }
}

function cracks(ctx, rng, count, color = 'rgba(55,38,22,0.5)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    let x = rng() * SIZE;
    let y = rng() * SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rng() - 0.5) * 12;
      y += rng() * 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function sandstone(rng) {
  const c = canvas(SIZE, SIZE);
  const x = c.getContext('2d');
  x.fillStyle = '#7c5f3d';
  x.fillRect(0, 0, SIZE, SIZE);
  const palette = ['#b18a5c', '#bb9465', '#a98255', '#c39d6d', '#ad875b', '#b68f60'];
  for (let row = 0; row < 8; row++) {
    const y = row * 8;
    const off = (row % 2) * 8;
    for (let i = -1; i < 5; i++) {
      const bx = i * 16 + off;
      x.fillStyle = palette[(rng() * palette.length) | 0];
      x.fillRect(bx + 1, y + 1, 14, 6);
      x.fillStyle = 'rgba(255,238,205,0.14)';
      x.fillRect(bx + 1, y + 1, 14, 1);
      x.fillStyle = 'rgba(46,28,12,0.2)';
      x.fillRect(bx + 1, y + 6, 14, 1);
      x.fillStyle = 'rgba(46,28,12,0.09)';
      x.fillRect(bx + 14, y + 1, 1, 6);
    }
  }
  grain(x, SIZE, SIZE, rng, 1400, 22);
  cracks(x, rng, 5);
  return c;
}

function crate(rng) {
  const c = canvas(SIZE, SIZE);
  const x = c.getContext('2d');
  x.fillStyle = '#7d4f26';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i % 2 ? '#96602e' : '#8a5628';
    x.fillRect(3 + i * 12, 3, 11, 58);
    x.fillStyle = 'rgba(255,220,160,0.12)';
    x.fillRect(3 + i * 12, 3, 2, 58);
  }
  x.strokeStyle = 'rgba(38,22,8,0.75)';
  x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, 61, 61);
  x.strokeStyle = 'rgba(196,140,74,0.85)';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(4, 6);
  x.lineTo(60, 58);
  x.stroke();
  x.fillStyle = '#494843';
  x.fillRect(0, 0, 8, 8);
  x.fillRect(56, 0, 8, 8);
  x.fillRect(0, 56, 8, 8);
  x.fillRect(56, 56, 8, 8);
  x.fillStyle = '#26251f';
  for (const [px, py] of [[3, 3], [59, 3], [3, 59], [59, 59]]) {
    x.beginPath();
    x.arc(px, py, 1.3, 0, Math.PI * 2);
    x.fill();
  }
  x.save();
  x.translate(32, 33);
  x.rotate(-Math.PI / 2);
  x.font = 'bold 9px monospace';
  x.fillStyle = 'rgba(30,18,8,0.55)';
  x.textAlign = 'center';
  x.fillText('7.62', 0, 3);
  x.restore();
  grain(x, SIZE, SIZE, rng, 700, 16);
  return c;
}

function door(rng) {
  const c = canvas(SIZE, SIZE);
  const x = c.getContext('2d');
  x.fillStyle = '#6b4726';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i % 2 ? '#7b5430' : '#714a28';
    x.fillRect(2 + i * 12, 2, 11, 60);
  }
  x.fillStyle = '#3c3a35';
  x.fillRect(0, 8, 64, 5);
  x.fillRect(0, 50, 64, 5);
  x.fillStyle = 'rgba(255,255,255,0.14)';
  x.fillRect(0, 8, 64, 1);
  x.fillStyle = '#2b2925';
  x.beginPath();
  x.arc(55, 31, 2.2, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#b9b3a5';
  x.fillRect(50, 29, 8, 2);
  x.strokeStyle = 'rgba(30,18,8,0.55)';
  x.lineWidth = 2;
  x.strokeRect(1.5, 1.5, 61, 61);
  grain(x, SIZE, SIZE, rng, 900, 18);
  return c;
}

function concrete(rng) {
  const c = canvas(SIZE, SIZE);
  const x = c.getContext('2d');
  x.fillStyle = '#57564f';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 3; i++) {
      x.fillStyle = ['#8b887d', '#848176', '#918e83', '#807d73'][(rng() * 4) | 0];
      x.fillRect(i * 24 + (row % 2) * 12 - 8, row * 16 + 1, 22, 14);
    }
  }
  grain(x, SIZE, SIZE, rng, 1200, 26);
  cracks(x, rng, 4, 'rgba(30,30,26,0.45)');
  return c;
}

function sandFloor(rng) {
  const c = canvas(SIZE, SIZE);
  const x = c.getContext('2d');
  x.fillStyle = '#c0a16c';
  x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 700; i++) {
    const v = rng();
    x.fillStyle = v > 0.6 ? 'rgba(232,210,160,0.5)' : 'rgba(110,84,48,0.32)';
    x.fillRect((rng() * SIZE) | 0, (rng() * SIZE) | 0, v > 0.92 ? 2 : 1, 1);
  }
  for (let i = 0; i < 18; i++) {
    x.fillStyle = 'rgba(96,74,44,0.45)';
    x.beginPath();
    x.ellipse(rng() * 64, rng() * 64, 0.8 + rng() * 1.6, 0.6 + rng() * 1.2, rng() * 3, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = 'rgba(120,92,52,0.28)';
  x.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let px = rng() * 64;
    let py = rng() * 64;
    x.beginPath();
    x.moveTo(px, py);
    for (let s = 0; s < 5; s++) {
      px += (rng() - 0.5) * 16;
      py += (rng() - 0.5) * 16;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return c;
}

// ---------- Terrorist sprites ----------

const PALETTES = [
  { vest: '#6d6947', vestDark: '#514e35', pants: '#454a37', hood: '#2f3229', boot: '#23231f', skin: '#b78a63', gun: '#26282a', accent: '#a33b2c' },
  { vest: '#79654a', vestDark: '#5b4c37', pants: '#3f4136', hood: '#2a2924', boot: '#1f1e1b', skin: '#a97b55', gun: '#2b2c2e', accent: '#8a6b2c' },
  { vest: '#565b4b', vestDark: '#40443a', pants: '#363a31', hood: '#252722', boot: '#211f1c', skin: '#c09268', gun: '#212325', accent: '#7a3c30' },
];

function drawStand(pal, pose) {
  const c = canvas(64, 96);
  const x = c.getContext('2d');
  const walk = pose === 'walk1' ? 1 : pose === 'walk2' ? 2 : 0;
  const bob = walk ? 1 : 0;
  const legShift = walk === 1 ? 2 : walk === 2 ? -2 : 0;

  // legs + boots
  x.fillStyle = pal.pants;
  x.fillRect(23 - legShift, 60, 8, 28 + legShift);
  x.fillRect(35 + legShift, 60, 8, 28 - legShift);
  x.fillStyle = pal.boot;
  x.fillRect(21 - legShift, 86 + legShift * 0.4, 11, 7);
  x.fillRect(34 + legShift, 86 - legShift * 0.4, 11, 7);
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(23 - legShift, 84, 8, 2);
  x.fillRect(35 + legShift, 84, 8, 2);

  // torso / vest
  x.fillStyle = pal.vest;
  x.beginPath();
  x.moveTo(19, 34 + bob);
  x.lineTo(45, 34 + bob);
  x.lineTo(48, 60 + bob);
  x.lineTo(16, 60 + bob);
  x.closePath();
  x.fill();
  x.fillStyle = pal.vestDark;
  x.fillRect(22, 38 + bob, 20, 15);
  x.fillStyle = 'rgba(0,0,0,0.22)';
  x.fillRect(22, 36 + bob, 20, 2);
  x.fillStyle = pal.accent;
  x.fillRect(19, 34 + bob, 5, 12);
  // pouches
  x.fillStyle = pal.vestDark;
  x.fillRect(24, 48 + bob, 6, 7);
  x.fillRect(33, 48 + bob, 6, 7);
  // belt
  x.fillStyle = '#26251f';
  x.fillRect(18, 59 + bob, 28, 4);

  // arms
  x.strokeStyle = pal.vest;
  x.lineWidth = 7;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(21, 39 + bob);
  x.lineTo(31, 51 + bob);
  x.stroke();
  x.beginPath();
  x.moveTo(44, 39 + bob);
  x.lineTo(47, 48 + bob);
  x.stroke();

  // head / balaclava
  x.fillStyle = pal.hood;
  x.beginPath();
  x.ellipse(32, 23 + bob, 9.5, 11, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.06)';
  x.beginPath();
  x.ellipse(29, 19 + bob, 4, 5, -0.4, 0, Math.PI * 2);
  x.fill();
  // goggles
  x.fillStyle = '#17181a';
  x.fillRect(24, 20 + bob, 16, 5);
  x.fillStyle = 'rgba(150,175,190,0.55)';
  x.fillRect(25, 21 + bob, 5, 2);
  x.fillRect(34, 21 + bob, 5, 2);
  x.fillStyle = pal.skin;
  x.fillRect(27, 27 + bob, 10, 3);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fillRect(28, 27 + bob, 8, 1);

  // rifle
  x.save();
  x.translate(37, 46 + bob);
  x.rotate(-0.22);
  x.strokeStyle = pal.gun;
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(24, 0);
  x.stroke();
  x.fillStyle = pal.gun;
  x.fillRect(6, 2, 9, 7);
  x.fillRect(14, -2, 8, 3);
  x.fillStyle = '#4a3a28';
  x.fillRect(0, -2, 7, 5);
  x.restore();
  // hands
  x.fillStyle = pal.skin;
  x.beginPath();
  x.arc(34, 49 + bob, 2.6, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.arc(47, 48 + bob, 2.4, 0, Math.PI * 2);
  x.fill();

  // muzzle flash
  if (pose === 'shoot') {
    x.save();
    x.translate(61, 41 + bob);
    x.fillStyle = '#ffd878';
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 3.5 : 10;
      const a = (i / 10) * Math.PI * 2;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    x.fillStyle = '#fff6d6';
    x.beginPath();
    x.arc(0, 0, 3.2, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }

  // silhouette outline
  x.strokeStyle = 'rgba(10,10,8,0.45)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(19, 34);
  x.lineTo(45, 34);
  x.lineTo(48, 60);
  x.lineTo(43, 62);
  x.stroke();
  return c;
}

function drawDead(pal) {
  const c = canvas(96, 40);
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(96,16,12,0.55)';
  x.beginPath();
  x.ellipse(48, 34, 34, 5, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = pal.pants;
  x.fillRect(10, 20, 28, 11);
  x.fillStyle = pal.boot;
  x.fillRect(4, 21, 10, 9);
  x.fillStyle = pal.vest;
  x.fillRect(34, 16, 30, 17);
  x.fillStyle = pal.vestDark;
  x.fillRect(38, 20, 22, 9);
  x.fillStyle = pal.hood;
  x.beginPath();
  x.ellipse(73, 24, 11, 9, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#17181a';
  x.fillRect(74, 21, 9, 4);
  x.fillStyle = pal.skin;
  x.fillRect(76, 27, 7, 2);
  x.strokeStyle = pal.gun;
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(50, 36);
  x.lineTo(70, 31);
  x.stroke();
  x.fillStyle = '#4a3a28';
  x.fillRect(66, 28, 10, 4);
  return c;
}

function enemySet(pal) {
  return {
    idle: { ...toImage(drawStand(pal, 'idle')), wH: 1.0 },
    walk1: { ...toImage(drawStand(pal, 'walk1')), wH: 1.0 },
    walk2: { ...toImage(drawStand(pal, 'walk2')), wH: 1.0 },
    shoot: { ...toImage(drawStand(pal, 'shoot')), wH: 1.0 },
    dead: { ...toImage(drawDead(pal)), wH: 0.42 },
  };
}

export function createTextures() {
  const rng = rngFactory(0x5eed);
  return {
    walls: [sandstone(rng), crate(rng), door(rng), concrete(rng)].map(toImage),
    floor: toImage(sandFloor(rng)),
    enemies: PALETTES.map(enemySet),
  };
}
