/* ВІРА — a small game about what appears when you believe.
   Pure canvas + WebAudio, no assets, no dependencies. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- constants

  const STEP = 1 / 120;
  const GRAVITY = 2250;
  const MAX_FALL = 1150;
  const MOVE_SPEED = 335;
  const ACCEL_GROUND = 3000;
  const ACCEL_AIR = 1950;
  const FRICTION_GROUND = 3800;
  const FRICTION_AIR = 750;
  const JUMP_V = 745;
  const COYOTE = 0.11;
  const JUMP_BUFFER = 0.13;

  const FAITH_MAX = 100;
  const FAITH_COST = 22;
  const FAITH_REGEN_GROUND = 30;
  const FAITH_REGEN_AIR = 4.5;
  const PLATFORM_LIFE = 2.7;
  const MAX_FAITH_PLATFORMS = 4;

  const PLAYER_W = 20;
  const PLAYER_H = 30;
  const RESPAWN_Y = 860;

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  // ---------------------------------------------------------------- levels

  const LEVELS = [
    {
      name: 'Перший крок',
      quote: 'Спочатку була темрява. І ти вирішив, що світло — можливе.',
      hint: 'A / D або ← / → — рух. Пробіл або ↑ — стрибок.',
      width: 2600,
      start: { x: 120, y: 440 },
      platforms: [
        [-200, 470, 900, 200],
        [860, 470, 440, 200],
        [1400, 400, 230, 26],
        [1710, 470, 1000, 200],
      ],
      sparks: [[430, 400], [610, 410], [1000, 400], [1150, 350], [1470, 340], [1580, 345], [1900, 400], [2130, 400]],
      orbs: [],
      goal: { x: 2320, y: 400 },
    },
    {
      name: 'Прірва',
      quote: 'Віра не прибирає прірву. Вона дає на неї ступити.',
      hint: 'У повітрі утримуй ВІРУ (Shift або кнопка) — під ногами з’явиться опора.',
      width: 3120,
      start: { x: 120, y: 440 },
      platforms: [
        [-200, 470, 760, 200],
        [800, 470, 150, 26],
        [1110, 400, 150, 26],
        [1420, 440, 150, 26],
        [1700, 470, 340, 200],
        [2140, 420, 130, 26],
        [2380, 470, 900, 200],
      ],
      sparks: [[350, 400], [500, 395], [900, 370], [1180, 320], [1500, 380], [1800, 410], [2050, 410], [2200, 360], [2500, 400], [2700, 400]],
      orbs: [
        { x: 1010, y: 340, r: 20, amp: 34, speed: 0.9, phase: 0 },
        { x: 1610, y: 330, r: 18, amp: 40, speed: 1.1, phase: 2 },
        { x: 2300, y: 340, r: 22, amp: 26, speed: 0.7, phase: 1 },
      ],
      goal: { x: 2850, y: 400 },
    },
    {
      name: 'Сумнів',
      quote: 'Сумнів приходить першим. Але він не має останнього слова.',
      hint: 'Темні згустки забирають віру. Падіння — лише ще один крок.',
      width: 3320,
      start: { x: 100, y: 440 },
      platforms: [
        [-200, 470, 640, 200],
        [660, 420, 120, 24],
        [900, 370, 120, 24],
        [1140, 420, 120, 24],
        [1380, 350, 120, 24],
        [1620, 430, 120, 24],
        [1860, 470, 440, 200],
        [2360, 410, 120, 24],
        [2560, 470, 920, 200],
      ],
      sparks: [[300, 400], [640, 365], [950, 310], [1190, 360], [1430, 290], [1670, 370], [1950, 410], [2250, 410], [2420, 350], [2700, 400]],
      orbs: [
        { x: 800, y: 370, r: 18, amp: 30, speed: 1.0, phase: 0.5 },
        { x: 1270, y: 340, r: 20, amp: 36, speed: 1.2, phase: 2.2 },
        { x: 1760, y: 360, r: 18, amp: 28, speed: 0.9, phase: 4.0 },
        { x: 2500, y: 390, r: 22, amp: 34, speed: 1.1, phase: 1.4 },
      ],
      goal: { x: 3130, y: 400 },
    },
    {
      name: 'Світло',
      quote: 'Світло не приходить ззовні. Воно починається з тебе.',
      hint: 'Останній стрибок — це завжди стрибок у невідоме.',
      width: 3300,
      start: { x: 120, y: 440 },
      platforms: [
        [-200, 470, 720, 200],
        [760, 430, 140, 26],
        [980, 360, 130, 26],
        [1200, 300, 130, 26],
        [1420, 240, 130, 26],
        [1640, 300, 130, 26],
        [1860, 360, 130, 26],
        [2080, 430, 620, 200],
        [2980, 430, 380, 26],
      ],
      sparks: [[300, 400], [800, 370], [1030, 300], [1250, 240], [1470, 180], [1690, 240], [1910, 300], [2160, 370], [2500, 410], [3050, 360]],
      orbs: [
        { x: 860, y: 330, r: 18, amp: 26, speed: 1.0, phase: 0 },
        { x: 1350, y: 210, r: 20, amp: 30, speed: 1.15, phase: 2 },
        { x: 2000, y: 310, r: 18, amp: 34, speed: 0.9, phase: 4 },
        { x: 2850, y: 340, r: 24, amp: 40, speed: 0.85, phase: 1 },
      ],
      goal: { x: 3080, y: 365 },
    },
  ];

  // ---------------------------------------------------------------- utils

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, delta) => {
    if (v < target) return Math.min(v + delta, target);
    if (v > target) return Math.max(v - delta, target);
    return target;
  };
  const mod = (n, m) => ((n % m) + m) % m;
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(x, y, w, h, r) {
    const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- dom

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('overlay');
  const overlayPanel = document.getElementById('overlayPanel');
  const hud = document.getElementById('hud');
  const touchUi = document.getElementById('touch');
  const faithFill = document.getElementById('faithFill');
  const faithValue = document.getElementById('faithValue');
  const sparkCountEl = document.getElementById('sparkCount');
  const sparkIcon = document.querySelector('.stat-ico');
  const levelMark = document.getElementById('levelMark');
  const toastEl = document.getElementById('toast');
  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  // ---------------------------------------------------------------- audio

  const Sound = {
    ac: null,
    master: null,
    drone: null,
    ready: false,
    muted: false,

    init() {
      if (this.ready) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ac.destination);
        this.ready = true;
      } catch (e) {
        this.ready = false;
      }
    },

    unlock() {
      this.init();
      if (this.ac && this.ac.state === 'suspended') this.ac.resume();
      this.startDrone();
    },

    startDrone() {
      if (!this.ready || this.drone) return;
      try {
        const ac = this.ac;
        const g = ac.createGain();
        g.gain.value = 0.0001;
        g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 3);
        g.connect(this.master);

        const osc1 = ac.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 55;
        const osc2 = ac.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 82.5;
        osc2.detune.value = 6;

        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 380;

        const lfo = ac.createOscillator();
        lfo.frequency.value = 0.045;
        const lfoGain = ac.createGain();
        lfoGain.gain.value = 120;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(g);

        osc1.start();
        osc2.start();
        lfo.start();
        this.drone = { g, osc1, osc2, lfo };
      } catch (e) {
        this.drone = null;
      }
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) {
        const now = this.ac.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(m ? 0 : 0.55, now, 0.05);
      }
    },

    blip(freq, dur, type, vol, slide, delay = 0) {
      if (!this.ready || this.muted) return;
      const ac = this.ac;
      const now = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), now + dur);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    },

    jump() { this.blip(360, 0.16, 'triangle', 0.1, 620); },
    land() { this.blip(150, 0.1, 'sine', 0.09, 90); },
    believe() {
      this.blip(523.25, 0.24, 'sine', 0.09, 523.25);
      this.blip(783.99, 0.3, 'sine', 0.06, 783.99, 0.03);
    },
    spark() {
      this.blip(880, 0.12, 'triangle', 0.08, 880);
      this.blip(1318.5, 0.22, 'sine', 0.06, 1318.5, 0.05);
    },
    hurt() { this.blip(190, 0.35, 'sawtooth', 0.055, 60); },
    respawn() {
      this.blip(220, 0.35, 'sine', 0.06, 110);
      this.blip(330, 0.4, 'sine', 0.04, 440, 0.1);
    },
    complete() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.blip(f, 0.7, 'sine', 0.07, f, i * 0.13));
    },
    win() {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) =>
        this.blip(f, 1.5, 'sine', 0.06, f, i * 0.18));
    },
    ui() { this.blip(680, 0.07, 'sine', 0.045, 760); },
  };

  // ---------------------------------------------------------------- state

  const game = {
    state: 'menu', // menu | intro | play | pause | complete | win
    levelIndex: 0,
    level: LEVELS[0],
    player: null,
    solids: [],
    faithPlats: [],
    sparks: [],
    orbs: [],
    particles: [],
    motes: [],
    goal: { x: 0, y: 0 },
    checkpoint: { x: 0, y: 0 },
    camX: 0,
    camY: 0,
    faith: FAITH_MAX,
    believeCd: 0,
    invuln: 0,
    flash: 0,
    flashColor: [255, 220, 150],
    shake: 0,
    time: 0,
    runSparks: 0,
    levelSparks: 0,
    runDeaths: 0,
    deaths: 0,
    hintFaithShown: false,
  };

  const input = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpBuffer: 0,
    believe: false,
  };

  let DPR = 1;
  let CSSW = 1;
  let CSSH = 1;
  let scale = 1;
  let viewW = 960;
  let viewH = 540;
  let stars = [];
  let skyCanvas = null;
  const glowCache = {};

  // ---------------------------------------------------------------- cached sprites

  function glowSprite(rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(0.22, `rgba(${rgb},0.62)`);
    grd.addColorStop(0.5, `rgba(${rgb},0.2)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    glowCache[rgb] = c;
    return c;
  }

  function drawGlow(rgb, x, y, radius, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  function buildPlatformSprite(s) {
    const pad = 26;
    const bodyH = Math.min(s.h, 210);
    const sc = 2;
    const worldW = s.w + pad * 2;
    const worldH = bodyH + pad + 16;
    const c = document.createElement('canvas');
    c.width = Math.ceil(worldW * sc);
    c.height = Math.ceil(worldH * sc);
    const g = c.getContext('2d');
    g.scale(sc, sc);
    g.translate(pad, pad);

    const grad = g.createLinearGradient(0, 0, 0, Math.min(bodyH, 160));
    grad.addColorStop(0, '#1d2848');
    grad.addColorStop(0.22, '#121a31');
    grad.addColorStop(0.7, '#0a0e1d');
    grad.addColorStop(1, '#060812');
    g.fillStyle = grad;
    const rrPath = (ctx2, x, y, w, h, r) => {
      const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx2.beginPath();
      ctx2.moveTo(x + rad, y);
      ctx2.arcTo(x + w, y, x + w, y + h, rad);
      ctx2.arcTo(x + w, y + h, x, y + h, rad);
      ctx2.arcTo(x, y + h, x, y, rad);
      ctx2.arcTo(x, y, x + w, y, rad);
      ctx2.closePath();
    };
    rrPath(g, 0, 0, s.w, bodyH, 7);
    g.fill();

    g.strokeStyle = 'rgba(255,255,255,0.045)';
    g.lineWidth = 1;
    rrPath(g, 0.5, 0.5, s.w - 1, bodyH - 1, 7);
    g.stroke();

    // glowing rim of reality
    g.save();
    g.shadowColor = 'rgba(105,175,255,0.6)';
    g.shadowBlur = 16;
    g.strokeStyle = 'rgba(165,215,255,0.55)';
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(12, 1);
    g.lineTo(s.w - 12, 1);
    g.stroke();
    g.restore();

    // faint crystals rising from the surface
    const n = Math.min(7, Math.floor(s.w / 95));
    for (let i = 0; i < n; i += 1) {
      const hx = 26 + hash(s.x * 0.13 + i * 37.7) * Math.max(1, s.w - 52);
      const hh = 4 + hash(s.x * 0.71 + i * 11.3) * 12;
      const a = 0.06 + 0.07 * hash(i * 3.1 + s.y);
      g.strokeStyle = `rgba(140,200,255,${a})`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(hx, 0);
      g.lineTo(hx, -hh);
      g.stroke();
    }

    // deep edge shadow
    const shade = g.createLinearGradient(0, 20, 0, Math.min(bodyH, 130));
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = shade;
    rrPath(g, 0, 20, s.w, Math.min(bodyH, 130) - 20, 6);
    g.fill();

    s.sprite = c;
    s.spritePad = pad;
    s.spriteW = worldW;
    s.spriteH = worldH;
  }

  // ---------------------------------------------------------------- levels

  function makeMotes(def, seed) {
    const rnd = mulberry32(seed);
    const motes = [];
    const count = Math.min(90, Math.round(def.width / 34));
    for (let i = 0; i < count; i += 1) {
      motes.push({
        x: rnd() * def.width,
        y: 40 + rnd() * 560,
        r: 0.7 + rnd() * 2.1,
        a: 0.06 + rnd() * 0.22,
        vy: -4 - rnd() * 12,
        drift: 0.4 + rnd() * 1.6,
        ph: rnd() * Math.PI * 2,
        front: rnd() > 0.72,
        warm: rnd() > 0.5,
      });
    }
    return motes;
  }

  function loadLevel(index) {
    const def = LEVELS[index];
    game.levelIndex = index;
    game.level = def;
    game.solids = def.platforms.map(([x, y, w, h]) => ({ x, y, w, h, solid: true, static: true }));
    game.solids.forEach(buildPlatformSprite);
    game.faithPlats = [];
    game.sparks = def.sparks.map(([x, y], i) => ({ x, y, got: false, ph: i * 1.7 }));
    game.orbs = def.orbs.map((o) => ({ ...o, baseX: o.x, t: o.phase }));
    game.particles = [];
    game.motes = makeMotes(def, index * 977 + 13);
    game.goal = { x: def.goal.x, y: def.goal.y };
    game.checkpoint = { x: def.start.x, y: def.start.y };
    game.player = {
      x: def.start.x,
      y: def.start.y,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: 0,
      facing: 1,
      invuln: 0,
      squash: 1,
      trail: [],
    };
    game.faith = FAITH_MAX;
    game.believeCd = 0;
    game.invuln = 0;
    game.shake = 0;
    game.deaths = 0;
    game.levelSparks = 0;
    game.hintFaithShown = false;
    game.camX = cameraTarget().x;
    game.camY = cameraTarget().y;
    clampCamera();
    updateHud(true);
    updateLevelMark();
  }

  // ---------------------------------------------------------------- camera

  function cameraTarget() {
    const p = game.player;
    return {
      x: p.x + p.w / 2 - viewW * 0.44 + p.facing * 26,
      y: p.y + p.h / 2 - viewH * 0.56,
    };
  }

  function clampCamera() {
    const maxX = Math.max(-80, game.level.width - viewW + 80);
    game.camX = clamp(game.camX, -80, maxX);
    game.camY = clamp(game.camY, -420, 420);
  }

  function updateCamera(dt) {
    const target = cameraTarget();
    const kx = 1 - Math.exp(-7 * dt);
    const ky = 1 - Math.exp(-5 * dt);
    game.camX = lerp(game.camX, target.x, kx);
    game.camY = lerp(game.camY, target.y, ky);
    clampCamera();
  }

  // ---------------------------------------------------------------- resize

  function resize() {
    CSSW = Math.max(1, window.innerWidth);
    CSSH = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CSSW * DPR);
    canvas.height = Math.round(CSSH * DPR);
    canvas.style.width = `${CSSW}px`;
    canvas.style.height = `${CSSH}px`;

    let s = Math.min(CSSW / 900, CSSH / 560);
    s = Math.max(s, Math.min(CSSW / 460, CSSH / 1000));
    s = Math.min(s, 3);
    scale = s;
    viewW = CSSW / s;
    viewH = CSSH / s;

    // cached screen-space backgrounds
    buildSkyCanvas();
    makeStars();
    if (game.level) {
      clampCamera();
    }
  }

  function buildSkyCanvas() {
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = Math.round(CSSW * DPR);
    skyCanvas.height = Math.round(CSSH * DPR);
    const g = skyCanvas.getContext('2d');
    g.scale(DPR, DPR);

    const sky = g.createLinearGradient(0, 0, 0, CSSH);
    sky.addColorStop(0, '#080c1e');
    sky.addColorStop(0.5, '#050714');
    sky.addColorStop(1, '#020309');
    g.fillStyle = sky;
    g.fillRect(0, 0, CSSW, CSSH);

    // baked nebulae
    g.globalCompositeOperation = 'lighter';
    const blobs = [
      { x: 0.22, y: 0.3, r: 0.62, c: '90,120,230', a: 0.11 },
      { x: 0.82, y: 0.18, r: 0.5, c: '150,90,230', a: 0.09 },
      { x: 0.55, y: 0.85, r: 0.7, c: '40,100,180', a: 0.07 },
    ];
    for (let i = 0; i < blobs.length; i += 1) {
      const b = blobs[i];
      const bx = b.x * CSSW;
      const by = b.y * CSSH;
      const rad = b.r * Math.max(CSSW, CSSH) * 0.7;
      const rg = g.createRadialGradient(bx, by, 0, bx, by, rad);
      rg.addColorStop(0, `rgba(${b.c},${b.a})`);
      rg.addColorStop(0.4, `rgba(${b.c},${b.a * 0.35})`);
      rg.addColorStop(1, `rgba(${b.c},0)`);
      g.fillStyle = rg;
      g.fillRect(0, 0, CSSW, CSSH);
    }
    g.globalCompositeOperation = 'source-over';

    // bottom haze
    const haze = g.createLinearGradient(0, CSSH * 0.68, 0, CSSH);
    haze.addColorStop(0, 'rgba(8,11,26,0)');
    haze.addColorStop(1, 'rgba(5,7,16,0.92)');
    g.fillStyle = haze;
    g.fillRect(0, CSSH * 0.6, CSSW, CSSH * 0.4);
  }

  function makeStars() {
    const count = clamp(Math.round((CSSW * CSSH) / 8500), 50, 230);
    const rnd = mulberry32(12345);
    stars = [];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rnd() * (CSSW + 400),
        y: rnd() * (CSSH + 400),
        r: 0.4 + rnd() * 1.5,
        a: 0.16 + rnd() * 0.6,
        p: 0.015 + rnd() * 0.09,
        tw: 0.4 + rnd() * 2.2,
        ph: rnd() * Math.PI * 2,
      });
    }
  }

  // ---------------------------------------------------------------- particles

  function burst(x, y, n, color, power, opts = {}) {
    const spread = opts.spread === undefined ? Math.PI * 2 : opts.spread;
    const base = opts.dir === undefined ? 0 : opts.dir;
    for (let i = 0; i < n; i += 1) {
      if (game.particles.length > 520) game.particles.shift();
      const a = base + (Math.random() - 0.5) * spread;
      const sp = power * (0.18 + Math.random() * 0.85);
      const life = (opts.life || 0.7) * (0.55 + Math.random() * 0.9);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.up || 0),
        life,
        max: life,
        size: (opts.size || 2) * (0.5 + Math.random()),
        color,
        g: opts.g === undefined ? 620 : opts.g,
        drag: opts.drag === undefined ? 1.6 : opts.drag,
      });
    }
  }

  function updateParticles(dt) {
    const arr = game.particles;
    for (let i = arr.length - 1; i >= 0; i -= 1) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * 0.35 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function updateMotes(dt) {
    const width = game.level.width;
    for (let i = 0; i < game.motes.length; i += 1) {
      const m = game.motes[i];
      m.y += m.vy * dt;
      m.x += Math.sin(game.time * 0.6 + m.ph) * m.drift * dt;
      if (m.y < -30) {
        m.y = 620;
        m.x = Math.random() * width;
      }
      if (m.x < -20) m.x += width;
      if (m.x > width) m.x -= width;
    }
  }

  // ---------------------------------------------------------------- gameplay

  function solidList() {
    const list = game.solids;
    const faith = game.faithPlats;
    if (!faith.length) return list;
    return list.concat(faith);
  }

  function overlaps(p, s) {
    return p.x + p.w > s.x && p.x < s.x + s.w && p.y + p.h > s.y && p.y < s.y + s.h;
  }

  function tryBelieve() {
    if (game.believeCd > 0) return;
    const p = game.player;
    if (p.onGround) return;
    if (game.faith < FAITH_COST) {
      if (!game.hintFaithShown) {
        game.hintFaithShown = true;
        toast('Віри замало. Збери іскри або торкнись землі.');
      }
      return;
    }
    const w = 98;
    const h = 14;
    const x = p.x + p.w / 2 - w / 2;
    const y = p.y + p.h + 4;

    game.faith = Math.max(0, game.faith - FAITH_COST);
    game.believeCd = 0.27;
    game.faithPlats.push({
      x, y, w, h,
      solid: true,
      static: false,
      age: 0,
      life: PLATFORM_LIFE,
      maxLife: PLATFORM_LIFE,
      ph: Math.random() * 10,
    });
    if (game.faithPlats.length > MAX_FAITH_PLATFORMS) game.faithPlats.shift();

    burst(x + w / 2, y + h / 2, 20, [255, 216, 140], 190, { up: 40, life: 0.75, size: 2.2 });
    burst(x + w / 2, y + h / 2, 8, [255, 250, 230], 80, { up: 20, life: 0.5, size: 1.4 });
    game.shake = Math.max(game.shake, 2.4);
    game.flash = Math.max(game.flash, 0.08);
    game.flashColor = [255, 216, 150];
    Sound.believe();
  }

  function respawn() {
    const p = game.player;
    game.faithPlats.length = 0;
    p.x = game.checkpoint.x;
    p.y = game.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.trail.length = 0;
    game.faith = FAITH_MAX;
    game.invuln = 1.1;
    game.deaths += 1;
    game.runDeaths += 1;
    game.shake = 9;
    game.flash = 0.25;
    game.flashColor = [120, 90, 200];
    burst(p.x + p.w / 2, p.y + p.h / 2, 26, [180, 150, 255], 180, { life: 0.8 });
    Sound.respawn();
    game.camX = cameraTarget().x;
    game.camY = cameraTarget().y;
    clampCamera();
  }

  function damageOrb(orb) {
    const p = game.player;
    if (game.invuln > 0) return;
    p.invuln = 1.25;
    game.invuln = 1.25;
    game.faith = Math.max(0, game.faith - 20);
    const dir = p.x + p.w / 2 < orb.x ? -1 : 1;
    p.vx = dir * 290;
    p.vy = -300;
    p.onGround = false;
    game.shake = 8;
    game.flash = 0.3;
    game.flashColor = [130, 80, 220];
    game.hintFaithShown = false;
    burst(orb.x, orb.y, 22, [150, 100, 255], 200, { life: 0.7 });
    Sound.hurt();
    if (game.faith <= 0) toast('Сумнів забирає віру. Але не тебе.');
  }

  function updatePlay(dt) {
    const p = game.player;

    game.believeCd = Math.max(0, game.believeCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.squash = lerp(p.squash, 1, Math.min(1, dt * 12));

    // input -> horizontal movement
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      p.facing = dir;
      p.vx = approach(p.vx, dir * MOVE_SPEED, (p.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt);
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? FRICTION_GROUND : FRICTION_AIR) * dt);
    }

    // jump
    input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
    if (p.onGround) p.coyote = COYOTE;
    else p.coyote = Math.max(0, p.coyote - dt);

    if (input.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_V - Math.abs(p.vx) * 0.05;
      p.onGround = false;
      p.coyote = 0;
      input.jumpBuffer = 0;
      p.squash = 0.72;
      Sound.jump();
      burst(p.x + p.w / 2, p.y + p.h, 8, [180, 215, 255], 70, { up: 20, life: 0.45, size: 1.6, spread: 1.6, dir: -Math.PI / 2 });
    }

    // faith - manifests a platform under your feet
    if (input.believe) tryBelieve();

    // gravity with a shorter hop when the jump key is released
    let g = GRAVITY;
    if (p.vy < 0 && !input.jumpHeld) g *= 1.85;
    p.vy = Math.min(p.vy + g * dt, MAX_FALL);

    const wasGround = p.onGround;
    const colliders = solidList();

    // move X
    p.x += p.vx * dt;
    for (let i = 0; i < colliders.length; i += 1) {
      const s = colliders[i];
      if (!overlaps(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      p.vx = 0;
    }

    // move Y
    p.y += p.vy * dt;
    p.onGround = false;
    for (let i = 0; i < colliders.length; i += 1) {
      const s = colliders[i];
      if (!overlaps(p, s)) continue;
      if (p.vy > 0) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.onGround = true;
        if (s.static) {
          game.checkpoint.x = p.x;
          game.checkpoint.y = p.y;
        }
      } else if (p.vy < 0) {
        p.y = s.y + s.h;
        p.vy = 0;
      }
    }

    if (!wasGround && p.onGround) {
      p.squash = 1.24;
      Sound.land();
      burst(p.x + p.w / 2, p.y + p.h, 7, [160, 200, 255], 55, { spread: 2.2, dir: -Math.PI / 2, life: 0.5, size: 1.5 });
      game.shake = Math.max(game.shake, 1.4);
    }

    // trail
    p.trail.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, a: 1 });
    if (p.trail.length > 16) p.trail.shift();
    for (let i = 0; i < p.trail.length; i += 1) p.trail[i].a *= 0.9;

    // regenerate faith
    game.faith = Math.min(
      FAITH_MAX,
      game.faith + (p.onGround ? FAITH_REGEN_GROUND : FAITH_REGEN_AIR) * dt
    );

    // faith platforms age
    for (let i = game.faithPlats.length - 1; i >= 0; i -= 1) {
      const f = game.faithPlats[i];
      f.age += dt;
      f.life -= dt;
      if (f.life <= 0) {
        game.faithPlats.splice(i, 1);
        continue;
      }
      if (Math.random() < dt * 9) {
        burst(f.x + Math.random() * f.w, f.y - 2, 1, [255, 220, 160], 22, {
          up: 26, life: 0.85, size: 1.3, g: -18, drag: 0.4,
        });
      }
    }

    // sparks
    for (let i = 0; i < game.sparks.length; i += 1) {
      const s = game.sparks[i];
      if (s.got) continue;
      const bob = Math.sin(game.time * 2 + s.ph) * 4;
      if (dist2(p.x + p.w / 2, p.y + p.h / 2, s.x, s.y + bob) < 34 * 34) {
        s.got = true;
        game.faith = Math.min(FAITH_MAX, game.faith + 11);
        game.runSparks += 1;
        game.levelSparks += 1;
        game.flash = Math.max(game.flash, 0.12);
        game.flashColor = [255, 226, 160];
        burst(s.x, s.y + bob, 16, [255, 226, 160], 160, { life: 0.7 });
        Sound.spark();
        updateHud();
        if (sparkIcon) {
          sparkIcon.classList.remove('pop');
          void sparkIcon.offsetWidth;
          sparkIcon.classList.add('pop');
        }
      }
    }

    // doubt orbs
    for (let i = 0; i < game.orbs.length; i += 1) {
      const o = game.orbs[i];
      o.t += dt;
      o.x = o.baseX + Math.sin(o.t * o.speed) * o.amp;
      const r = o.r + 9;
      if (dist2(p.x + p.w / 2, p.y + p.h / 2, o.x, o.y) < r * r) {
        damageOrb(o);
      }
    }

    // goal
    const gx = p.x + p.w / 2;
    const gy = p.y + p.h / 2;
    if (Math.abs(gx - game.goal.x) < 58 && Math.abs(gy - game.goal.y) < 92) {
      completeLevel();
      return;
    }

    // fell into the void
    if (p.y > RESPAWN_Y) respawn();

    if (game.faith < FAITH_COST && !game.hintFaithShown && !p.onGround) {
      // only nag once per dive into empty faith
      game.hintFaithShown = true;
      toast('Віри замало — шукай іскри або землю.');
    }
  }

  function updateHud(force) {
    if (!force && game.state !== 'play' && game.state !== 'pause') return;
    const faith = Math.round(game.faith);
    faithFill.style.width = `${clamp(game.faith, 0, 100)}%`;
    faithFill.classList.toggle('low', game.faith < 30);
    faithValue.textContent = String(faith);
    sparkCountEl.textContent = String(game.runSparks);
  }

  function updateLevelMark() {
    levelMark.textContent = `Розділ ${ROMAN[game.levelIndex] || game.levelIndex + 1}`;
  }

  let toastTimer = 0;
  function toast(msg, duration = 2600) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  // ---------------------------------------------------------------- flow

  function showPanel(html) {
    overlayPanel.innerHTML = html;
    overlay.classList.remove('hidden');
    overlayPanel.style.animation = 'none';
    void overlayPanel.offsetWidth;
    overlayPanel.style.animation = '';
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function setHudVisible(on) {
    hud.classList.toggle('hidden', !on);
  }

  function setTouchVisible(on) {
    touchUi.classList.toggle('hidden', !(on && isTouch));
  }

  function resetInput() {
    input.left = false;
    input.right = false;
    input.jumpHeld = false;
    input.jumpBuffer = 0;
    input.believe = false;
    document.querySelectorAll('#touch .tbtn').forEach((b) => b.classList.remove('on'));
  }

  function showMenu() {
    game.state = 'menu';
    resetInput();
    loadLevel(0);
    setHudVisible(false);
    setTouchVisible(false);
    showPanel(`
      <div class="eyebrow">маленька гра про велику віру</div>
      <h1 class="title">ВІРА</h1>
      <div class="orn"></div>
      <p class="tagline">Світло не приходить ззовні.<br>Воно з’являється, коли ти ступаєш.</p>
      <div class="rules">
        <div class="rule"><span class="keys"><kbd>A</kbd><kbd>D</kbd></span> рух</div>
        <div class="rule"><span class="keys"><kbd>SPACE</kbd></span> стрибок</div>
        <div class="rule"><span class="keys"><kbd>SHIFT</kbd></span> утримуй у повітрі — віра стане опорою</div>
      </div>
      <div class="btn-row">
        <button class="btn primary" type="button" data-action="start">Почати</button>
        <p class="foot">На телефоні — кнопки внизу екрана</p>
      </div>
    `);
  }

  function beginLevel(index) {
    game.state = 'intro';
    resetInput();
    loadLevel(index);
    setHudVisible(false);
    setTouchVisible(false);
    updateLevelMark();
    const def = LEVELS[index];
    showPanel(`
      <div class="eyebrow">розділ ${ROMAN[index] || index + 1} · ${def.sparks.length} іскор</div>
      <h2>${def.name}</h2>
      <blockquote>${def.quote}</blockquote>
      <p class="hint-line">${def.hint}</p>
      <div class="btn-row">
        <button class="btn primary" type="button" data-action="next">Далі</button>
      </div>
    `);
  }

  function startPlay() {
    game.state = 'play';
    resetInput();
    hideOverlay();
    setHudVisible(true);
    setTouchVisible(true);
    updateHud(true);
    Sound.unlock();
    game.camX = cameraTarget().x;
    game.camY = cameraTarget().y;
    clampCamera();
  }

  function completeLevel() {
    game.state = 'complete';
    resetInput();
    setTouchVisible(false);
    game.shake = 6;
    game.flash = 0.35;
    game.flashColor = [255, 230, 170];
    burst(game.goal.x, game.goal.y, 40, [255, 226, 160], 240, { life: 1.4, size: 2.4 });
    Sound.complete();
    const def = LEVELS[game.levelIndex];
    const total = def.sparks.length;
    const got = game.levelSparks;
    const last = game.levelIndex >= LEVELS.length - 1;
    setTimeout(() => {
      showPanel(`
        <div class="eyebrow">розділ пройдено</div>
        <h2>${def.name}</h2>
        <div class="orn"></div>
        <p class="tagline">${got >= total ? 'Усі іскри цього розділу — твої.' : 'Не всі іскри зібрано. Але шлях — пройдено.'}</p>
        <div class="stats">
          <span>іскри <b>${got}/${total}</b></span>
          <span>падіння <b>${game.deaths}</b></span>
        </div>
        <div class="btn-row">
          <button class="btn primary" type="button" data-action="next">${last ? 'До світла' : 'Далі'}</button>
        </div>
      `);
    }, 700);
  }

  function showWin() {
    game.state = 'win';
    resetInput();
    setTouchVisible(false);
    setHudVisible(false);
    Sound.win();
    const totalSparks = LEVELS.reduce((n, l) => n + l.sparks.length, 0);
    showPanel(`
      <div class="eyebrow">кінець шляху</div>
      <h1 class="title small">СВІТЛО</h1>
      <div class="orn"></div>
      <p class="tagline">Ти дійшов не тому, що шлях був легким.<br>А тому, що вірив, що він є.</p>
      <div class="stats">
        <span>іскри <b>${game.runSparks}/${totalSparks}</b></span>
        <span>падіння <b>${game.runDeaths}</b></span>
      </div>
      <div class="btn-row">
        <button class="btn primary" type="button" data-action="restart">Пройти знову</button>
        <button class="btn ghost" type="button" data-action="menu">У меню</button>
      </div>
    `);
  }

  function showPause() {
    if (game.state !== 'play') return;
    game.state = 'pause';
    resetInput();
    setTouchVisible(false);
    showPanel(`
      <div class="eyebrow">тиша</div>
      <h2>Пауза</h2>
      <p class="tagline">Навіть світло іноді зупиняється, щоб зібратися.</p>
      <div class="btn-row">
        <button class="btn primary" type="button" data-action="resume">Продовжити</button>
        <button class="btn ghost" type="button" data-action="restart">Спочатку розділу</button>
        <button class="btn ghost" type="button" data-action="menu">У меню</button>
      </div>
    `);
  }

  function resumePlay() {
    if (game.state !== 'pause') return;
    game.state = 'play';
    resetInput();
    hideOverlay();
    setTouchVisible(true);
    updateHud(true);
  }

  function nextFromOverlay() {
    if (game.state === 'intro') {
      startPlay();
      return;
    }
    if (game.state === 'complete') {
      const next = game.levelIndex + 1;
      if (next < LEVELS.length) beginLevel(next);
      else showWin();
    }
  }

  function restartRun() {
    game.runSparks = 0;
    game.runDeaths = 0;
    beginLevel(0);
  }

  function restartLevel() {
    beginLevel(game.levelIndex);
  }

  // ---------------------------------------------------------------- overlay events

  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    Sound.unlock();
    Sound.ui();
    const action = btn.dataset.action;
    if (action === 'start') {
      game.runSparks = 0;
      game.runDeaths = 0;
      beginLevel(0);
    } else if (action === 'next') {
      nextFromOverlay();
    } else if (action === 'resume') {
      resumePlay();
    } else if (action === 'restart') {
      restartRun();
    } else if (action === 'menu') {
      showMenu();
    }
  });

  muteBtn.addEventListener('click', toggleMute);
  pauseBtn.addEventListener('click', () => {
    if (game.state === 'play') showPause();
    else if (game.state === 'pause') resumePlay();
  });

  function toggleMute() {
    Sound.unlock();
    Sound.setMuted(!Sound.muted);
    muteBtn.classList.toggle('off', Sound.muted);
    muteBtn.textContent = Sound.muted ? '×' : '♪';
    try { localStorage.setItem('vira-muted', Sound.muted ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  try {
    if (localStorage.getItem('vira-muted') === '1') {
      Sound.muted = true;
      muteBtn.classList.add('off');
      muteBtn.textContent = '×';
    }
  } catch (e) { /* ignore */ }

  // ---------------------------------------------------------------- input

  const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  const KEY_ACTION = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    Space: 'jump',
    ArrowUp: 'jump',
    KeyW: 'jump',
    ShiftLeft: 'believe',
    ShiftRight: 'believe',
  };

  function setAction(action, on) {
    if (action === 'left') input.left = on;
    else if (action === 'right') input.right = on;
    else if (action === 'believe') input.believe = on;
    else if (action === 'jump') {
      if (on && !input.jumpHeld) input.jumpBuffer = JUMP_BUFFER;
      input.jumpHeld = on;
    }
  }

  window.addEventListener('keydown', (e) => {
    const action = KEY_ACTION[e.code];
    if (action) {
      e.preventDefault();
      if (e.repeat) return;
      Sound.unlock();
      setAction(action, true);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'play') showPause();
      else if (game.state === 'pause') resumePlay();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const primary = overlay.querySelector('[data-action]');
      if (primary && !overlay.classList.contains('hidden')) primary.click();
    }
  });

  window.addEventListener('keyup', (e) => {
    const action = KEY_ACTION[e.code];
    if (!action) return;
    e.preventDefault();
    setAction(action, false);
  });

  document.querySelectorAll('#touch .tbtn').forEach((btn) => {
    const action = btn.dataset.act;
    const down = (e) => {
      e.preventDefault();
      Sound.unlock();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      btn.classList.add('on');
      setAction(action, true);
    };
    const up = (e) => {
      if (e) e.preventDefault();
      btn.classList.remove('on');
      setAction(action, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  });

  window.addEventListener('blur', () => {
    resetInput();
    if (game.state === 'play') showPause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'play') showPause();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------------------------------------------------------------- update

  function update(dt) {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 26);
    game.flash = Math.max(0, game.flash - dt * 1.4);
    updateParticles(dt);
    updateMotes(dt);
    updateHud();

    if (game.state === 'play') {
      updatePlay(dt);
    } else if (game.state === 'menu') {
      // gentle idle breathing for the spirit on the menu
      const p = game.player;
      if (p) {
        p.trail.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, a: 1 });
        if (p.trail.length > 12) p.trail.shift();
        for (let i = 0; i < p.trail.length; i += 1) p.trail[i].a *= 0.92;
      }
    }

    if (game.state === 'play' || game.state === 'complete' || game.state === 'win') {
      updateCamera(dt);
    } else if (game.state === 'menu') {
      updateCamera(dt);
    }
  }

  // ---------------------------------------------------------------- render

  function drawSky(t) {
    if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0, CSSW, CSSH);

    const camSX = game.camX * scale;
    const camSY = game.camY * scale;

    // stars with a touch of parallax
    const spanX = CSSW + 400;
    const spanY = CSSH + 400;
    ctx.fillStyle = '#d6e4ff';
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const sx = mod(s.x - camSX * s.p, spanX) - 200;
      const sy = mod(s.y - camSY * s.p * 0.6, spanY) - 200;
      if (sx < -10 || sx > CSSW + 10 || sy < -10 || sy > CSSH + 10) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
      ctx.globalAlpha = s.a * tw;
      const size = s.r * 1.9;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayerGlow(p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,190,110', cx, cy, 270, 0.12);
    drawGlow('255,225,170', cx, cy, 92, 0.3);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMotes(front) {
    const t = game.time;
    for (let i = 0; i < game.motes.length; i += 1) {
      const m = game.motes[i];
      if (!!m.front !== front) continue;
      const alpha = m.a * (0.6 + 0.4 * Math.sin(t * 0.9 + m.ph));
      ctx.fillStyle = m.warm
        ? `rgba(255,216,150,${alpha})`
        : `rgba(150,195,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStaticPlatform(s) {
    if (!s.sprite) return;
    ctx.drawImage(s.sprite, s.x - s.spritePad, s.y - s.spritePad, s.spriteW, s.spriteH);
  }

  function drawFaithPlatform(f) {
    const fadeIn = clamp(f.age / 0.14, 0, 1);
    const fadeOut = clamp(f.life / 0.55, 0, 1);
    const a = fadeIn * fadeOut;
    if (a <= 0.01) return;

    const cx = f.x + f.w / 2;
    const pulse = 0.75 + 0.25 * Math.sin(game.time * 5 + f.ph);

    ctx.save();
    ctx.globalAlpha = a;

    // warm aura
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,200,110', cx, f.y + 4, f.w * 0.85, 0.4);
    drawGlow('255,240,200', cx, f.y + 3, f.w * 0.45, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;

    const grad = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
    grad.addColorStop(0, 'rgba(255,244,214,0.92)');
    grad.addColorStop(0.35, 'rgba(255,205,120,0.62)');
    grad.addColorStop(1, 'rgba(255,165,60,0.12)');
    ctx.fillStyle = grad;
    roundRect(f.x, f.y, f.w, f.h, 7);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,238,196,0.9)';
    ctx.lineWidth = 1.1;
    roundRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1, 7);
    ctx.stroke();

    // rising shimmer
    for (let i = 0; i < 3; i += 1) {
      const sx = f.x + (f.w / 4) * (i + 0.5) + Math.sin(game.time * 2 + i + f.ph) * 6;
      const sy = f.y - ((game.time * 22 + i * 17 + f.ph * 10) % 26);
      ctx.fillStyle = `rgba(255,226,160,${0.22 * a})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawSpark(s) {
    if (s.got) return;
    const bob = Math.sin(game.time * 2 + s.ph) * 4;
    const x = s.x;
    const y = s.y + bob;
    const rot = game.time * 1.1 + s.ph;

    ctx.save();
    ctx.translate(x, y);

    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,205,120', 0, 0, 46, 0.5);
    drawGlow('255,240,200', 0, 0, 22, 0.55);
    ctx.globalCompositeOperation = 'source-over';

    ctx.rotate(rot);
    ctx.fillStyle = '#fff8e4';
    ctx.beginPath();
    const spikes = 4;
    const outer = 9.5;
    const inner = 2.6;
    for (let i = 0; i < spikes * 2; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawOrb(o) {
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + o.phase);
    const r = o.r + pulse * 1.6;

    ctx.save();
    ctx.translate(o.x, o.y);

    ctx.globalCompositeOperation = 'lighter';
    drawGlow('120,70,210', 0, 0, r * 3, 0.55);
    ctx.globalCompositeOperation = 'source-over';

    const core = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 1, 0, 0, r);
    core.addColorStop(0, 'rgba(150,120,220,0.9)');
    core.addColorStop(0.45, 'rgba(46,22,84,0.95)');
    core.addColorStop(1, 'rgba(8,4,18,1)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(160,120,255,${0.25 + 0.35 * pulse})`;
    ctx.lineWidth = 1.4;
    ctx.rotate(t * 0.7 + o.phase);
    for (let i = 0; i < 5; i += 1) {
      const a0 = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5 + Math.sin(t * 1.7 + i) * 2, a0, a0 + 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGoal() {
    const t = game.time;
    const x = game.goal.x;
    const y = game.goal.y;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);

    ctx.save();

    // beam
    const beam = ctx.createLinearGradient(0, y - 260, 0, y + 40);
    beam.addColorStop(0, 'rgba(255,214,150,0)');
    beam.addColorStop(0.55, 'rgba(255,214,150,0.06)');
    beam.addColorStop(1, 'rgba(255,226,170,0.16)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 10);
    ctx.lineTo(x - 74, y - 260);
    ctx.lineTo(x + 74, y - 260);
    ctx.lineTo(x + 26, y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.translate(x, y);

    // halo
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,200,110', 0, 0, 150, 0.45 + 0.1 * pulse);
    drawGlow('255,235,190', 0, 0, 52, 0.5);
    ctx.globalCompositeOperation = 'source-over';

    // ring
    ctx.strokeStyle = `rgba(255,232,190,${0.7 + 0.25 * pulse})`;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, 38 + pulse * 2.5, 0, Math.PI * 2);
    ctx.stroke();

    // inner core
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    core.addColorStop(0, 'rgba(255,255,248,0.95)');
    core.addColorStop(0.4, 'rgba(255,225,165,0.55)');
    core.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    // orbiting motes
    for (let i = 0; i < 3; i += 1) {
      const a = t * 0.8 + (i / 3) * Math.PI * 2;
      const rad = 54 + Math.sin(t * 1.2 + i) * 5;
      ctx.fillStyle = 'rgba(255,236,190,0.85)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad * 0.7, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    if (!p) return;
    const t = game.time;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;

    // trail
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.trail.length; i += 1) {
      const tr = p.trail[i];
      const k = i / p.trail.length;
      ctx.fillStyle = `rgba(255,196,110,${0.16 * k * tr.a})`;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 5 + 9 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const flick = 0.94 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.3) * 0.03;
    const hurt = p.invuln > 0 && Math.floor(t * 16) % 2 === 0;

    ctx.save();
    ctx.translate(cx, cy);

    // outer aura
    ctx.globalCompositeOperation = 'lighter';
    drawGlow('255,210,150', 0, 0, 62, 0.5);
    ctx.globalCompositeOperation = 'source-over';

    if (!hurt) {
      // flame body
      const grad = ctx.createLinearGradient(0, -24, 0, 16);
      grad.addColorStop(0, 'rgba(255,252,240,0.98)');
      grad.addColorStop(0.45, 'rgba(255,220,150,0.95)');
      grad.addColorStop(1, 'rgba(255,168,70,0.25)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -25 * flick);
      ctx.bezierCurveTo(11, -12, 10, 8, 0, 15);
      ctx.bezierCurveTo(-10, 8, -11, -12, 0, -25 * flick);
      ctx.closePath();
      ctx.fill();

      // inner core
      ctx.fillStyle = 'rgba(255,255,248,0.95)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 3.4, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,170,120,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // shadow on the ground
    if (p.onGround) {
      const sg = ctx.createRadialGradient(cx, p.y + p.h + 2, 0, cx, p.y + p.h + 2, 26);
      sg.addColorStop(0, 'rgba(255,200,120,0.22)');
      sg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(cx, p.y + p.h + 2, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    const arr = game.particles;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      const a = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = rgba(p.color, a * 0.9);
      const size = p.size * (0.35 + 0.65 * a);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.restore();
  }

  function drawWorld() {
    const t = game.time;
    const p = game.player;

    if (p) drawPlayerGlow(p);
    drawMotes(false);

    for (let i = 0; i < game.solids.length; i += 1) drawStaticPlatform(game.solids[i]);
    for (let i = 0; i < game.faithPlats.length; i += 1) drawFaithPlatform(game.faithPlats[i]);

    drawGoal();

    for (let i = 0; i < game.sparks.length; i += 1) drawSpark(game.sparks[i]);
    for (let i = 0; i < game.orbs.length; i += 1) drawOrb(game.orbs[i]);

    drawPlayer();
    drawParticles();
    drawMotes(true);
  }

  function drawFlash() {
    if (game.flash <= 0.001) return;
    const c = game.flashColor;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${game.flash * 0.3})`;
    ctx.fillRect(0, 0, CSSW, CSSH);
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(game.time);

    const shakeX = (Math.random() * 2 - 1) * game.shake;
    const shakeY = (Math.random() * 2 - 1) * game.shake;
    const cx = game.camX + shakeX;
    const cy = game.camY + shakeY;

    ctx.setTransform(DPR * scale, 0, 0, DPR * scale, -cx * DPR * scale, -cy * DPR * scale);
    drawWorld();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawFlash();
  }

  // ---------------------------------------------------------------- loop

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (game.state === 'play') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 12) {
        update(STEP);
        acc -= STEP;
        steps += 1;
        if (game.state !== 'play') break;
      }
      if (steps >= 12) acc = 0;
    } else {
      acc = 0;
      update(dt);
    }

    updateHud();
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  window.__vira = { game, LEVELS, loadLevel, beginLevel, startPlay, respawn, input };

  resize();
  loadLevel(0);
  showMenu();
  updateHud(true);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
})();
