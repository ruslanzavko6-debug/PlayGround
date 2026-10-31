import { BLOCKS, INVENTORY_BLOCKS, DEFAULT_HOTBAR, faceTile } from './blocks.js';
import { blockIcon } from './textures.js';

const SETTINGS_KEY = 'voxelcraft.settings.v1';
export const DEFAULT_SETTINGS = {
  sensitivity: 1,
  volume: 0.7,
  fog: 150,
  showStats: true,
  invertY: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export class UI {
  constructor({ atlasCanvas, hotbar, callbacks }) {
    this.atlasCanvas = atlasCanvas;
    this.hotbar = hotbar.slice(0, 9);
    this.selected = 0;
    this.callbacks = callbacks;
    this.settings = loadSettings();
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || window.innerWidth < 720;
    if (this.touch) document.body.classList.add('touch');
    this.screens = {
      menu: document.getElementById('menu'),
      loading: document.getElementById('loading'),
      pause: document.getElementById('pause'),
      settings: document.getElementById('settings'),
      inventory: document.getElementById('inventory'),
    };
    this.hud = document.getElementById('hud');
    this.hotbarEl = document.getElementById('hotbar');
    this.invGrid = document.getElementById('inv-grid');
    this.toastEl = null;
    this.blockToastEl = document.getElementById('block-toast');
    this.breakRing = document.getElementById('break-ring');
    this.breakFill = document.getElementById('break-ring-fill');
    this.lastToast = 0;
    this.buildHotbar();
    this.buildInventory();
    this.bindSettings();
    this.bindButtons();
    this.setSettings(this.settings);
    this.touchControls = {
      joystick: document.getElementById('joystick'),
      knob: document.getElementById('joystick-knob'),
      fly: document.getElementById('t-fly'),
      jump: document.getElementById('t-jump'),
      mine: document.getElementById('t-mine'),
      place: document.getElementById('t-place'),
    };
    this.touchUI = document.getElementById('touch-ui');
  }

  get selectedBlock() { return this.hotbar[this.selected]; }
  get isTouch() { return this.touch; }

  buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.hotbar.forEach((id, i) => {
      const slot = document.createElement('button');
      slot.className = 'slot' + (i === this.selected ? ' active' : '');
      slot.dataset.index = i;
      slot.setAttribute('aria-label', `${i + 1}: ${BLOCKS[id].name}`);
      slot.innerHTML = `<span class="num">${i + 1}</span><img class="icon-img" alt="" draggable="false">`;
      slot.querySelector('img').src = blockIcon(id, this.atlasCanvas, 64);
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectSlot(i);
      });
      this.hotbarEl.appendChild(slot);
    });
  }

  updateHotbar() {
    [...this.hotbarEl.children].forEach((slot, i) => {
      slot.classList.toggle('active', i === this.selected);
      slot.setAttribute('aria-label', `${i + 1}: ${BLOCKS[this.hotbar[i]].name}`);
      slot.querySelector('img').src = blockIcon(this.hotbar[i], this.atlasCanvas, 64);
    });
    document.getElementById('inv-slot-num').textContent = this.selected + 1;
  }

  selectSlot(i) {
    if (i < 0 || i >= this.hotbar.length) return;
    this.selected = i;
    this.updateHotbar();
    this.showBlockToast(BLOCKS[this.hotbar[i]].name);
    this.callbacks.onSlot?.(i);
  }

  setSlotBlock(id) {
    this.hotbar[this.selected] = id;
    this.updateHotbar();
    this.showBlockToast(BLOCKS[id].name);
    const el = this.hotbarEl.children[this.selected];
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    this.callbacks.onHotbarChange?.(this.hotbar);
  }

  showBlockToast(name) {
    if (!this.blockToastEl) return;
    this.blockToastEl.textContent = name;
    this.blockToastEl.classList.add('on');
    clearTimeout(this.blockToastTimer);
    this.blockToastTimer = setTimeout(() => this.blockToastEl.classList.remove('on'), 1400);
  }

  buildInventory() {
    this.invGrid.innerHTML = '';
    INVENTORY_BLOCKS.forEach((id) => {
      const b = BLOCKS[id];
      const btn = document.createElement('button');
      btn.className = 'inv-item';
      btn.title = b.name;
      const img = document.createElement('img');
      img.src = blockIcon(id, this.atlasCanvas, 64);
      img.alt = b.name;
      img.draggable = false;
      const label = document.createElement('span');
      label.textContent = b.name;
      btn.append(img, label);
      btn.addEventListener('click', () => {
        this.setSlotBlock(id);
        this.callbacks.onInventoryPick?.(id);
        this.hideInventory();
      });
      this.invGrid.appendChild(btn);
    });
  }

  bindSettings() {
    const sens = document.getElementById('set-sens');
    const vol = document.getElementById('set-vol');
    const fog = document.getElementById('set-fog');
    const fps = document.getElementById('set-fps');
    const inv = document.getElementById('set-invert');
    sens.value = this.settings.sensitivity;
    vol.value = this.settings.volume;
    fog.value = this.settings.fog;
    fps.checked = this.settings.showStats;
    inv.checked = this.settings.invertY;
    document.getElementById('out-sens').textContent = Number(this.settings.sensitivity).toFixed(1);
    document.getElementById('out-vol').textContent = `${Math.round(this.settings.volume * 100)}%`;
    document.getElementById('out-fog').textContent = this.settings.fog;

    sens.addEventListener('input', () => {
      this.settings.sensitivity = Number(sens.value);
      document.getElementById('out-sens').textContent = this.settings.sensitivity.toFixed(1);
      this.emitSettings();
    });
    vol.addEventListener('input', () => {
      this.settings.volume = Number(vol.value);
      document.getElementById('out-vol').textContent = `${Math.round(this.settings.volume * 100)}%`;
      this.emitSettings();
    });
    fog.addEventListener('input', () => {
      this.settings.fog = Number(fog.value);
      document.getElementById('out-fog').textContent = this.settings.fog;
      this.emitSettings();
    });
    fps.addEventListener('change', () => {
      this.settings.showStats = fps.checked;
      this.emitSettings();
    });
    inv.addEventListener('change', () => {
      this.settings.invertY = inv.checked;
      this.emitSettings();
    });
  }

  emitSettings() {
    saveSettings(this.settings);
    this.callbacks.onSettings?.(this.settings);
  }

  setSettings(settings) {
    this.settings = settings;
    const stats = document.getElementById('stats');
    if (stats) stats.style.display = settings.showStats ? '' : 'none';
    this.callbacks.onSettings?.(settings);
  }

  bindButtons() {
    const on = (id, fn) => document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
    on('play-btn', () => this.callbacks.onPlay?.());
    on('new-btn', () => this.callbacks.onNewWorld?.());
    on('seed-rand', () => {
      document.getElementById('seed-input').value = String(Math.floor(Math.random() * 900000) + 100000);
      this.callbacks.onUiSound?.();
    });
    on('resume-btn', () => this.callbacks.onResume?.());
    on('pause-settings-btn', () => this.openSettings());
    on('pause-inv-btn', () => { this.hidePause(); this.showInventory(); });
    on('pause-new-btn', () => this.callbacks.onNewWorld?.());
    on('pause-menu-btn', () => this.callbacks.onMainMenu?.());
    on('settings-close', () => this.closeSettings());
    on('menu-btn', () => this.callbacks.onPause?.());
    on('inv-btn', () => this.showInventory());
    on('inv-close', () => this.hideInventory());
    on('mute-btn', () => this.callbacks.onMute?.());
    on('t-fly', () => this.callbacks.onFly?.());
    on('t-jump', () => this.callbacks.onJump?.());
    on('t-mine', () => this.callbacks.onTouchMine?.());
    on('t-place', () => this.callbacks.onTouchPlace?.());
    document.querySelectorAll('.screen').forEach((screen) => {
      screen.addEventListener('click', (e) => {
        if (e.target === screen) {
          if (screen.id === 'settings') this.closeSettings();
          if (screen.id === 'inventory') this.hideInventory();
        }
      });
    });
  }

  setSeed(seed) {
    const input = document.getElementById('seed-input');
    if (input) input.value = String(seed);
  }

  seedValue() {
    const input = document.getElementById('seed-input');
    const n = parseInt(input?.value, 10);
    return Number.isFinite(n) ? n : 1337;
  }

  setGeneration(progress, title, sub) {
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    document.getElementById('gen-fill').style.width = `${pct}%`;
    document.getElementById('gen-pct').textContent = `${pct}%`;
    if (title) document.getElementById('gen-title').textContent = title;
    if (sub) document.getElementById('gen-sub').textContent = sub;
  }

  setReady(info) {
    document.body.classList.add('world-ready');
    this.setGeneration(1, 'Світ готовий', info);
    const btn = document.getElementById('play-btn');
    btn.disabled = false;
    btn.querySelector('.btn-main').textContent = 'Грати';
    btn.querySelector('.btn-sub').textContent = info;
    this.setLoading(false);
  }

  setPlayEnabled(enabled) {
    const btn = document.getElementById('play-btn');
    if (btn) btn.disabled = !enabled;
  }

  setLoading(show, progress = 0) {
    if (show) {
      this.screens.loading.classList.remove('hidden');
      document.getElementById('load-fill').style.width = `${Math.round(progress * 100)}%`;
      document.getElementById('load-pct').textContent = `${Math.round(progress * 100)}%`;
    } else {
      this.screens.loading.classList.add('hidden');
    }
  }

  showMenu() {
    document.body.classList.add('is-menu');
    this.screens.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.touchUI.classList.add('hidden');
  }

  hideMenu() {
    document.body.classList.remove('is-menu');
    this.screens.menu.classList.add('hidden');
    this.hud.classList.remove('hidden');
    if (this.touch) this.touchUI.classList.remove('hidden');
  }

  showPause() {
    this.screens.pause.classList.remove('hidden');
    document.getElementById('pause-seed').textContent = document.getElementById('seed-input').value;
    if (this.touch) this.touchUI.classList.add('hidden');
  }
  hidePause() {
    this.screens.pause.classList.add('hidden');
    if (this.touch && !document.body.classList.contains('is-menu')) this.touchUI.classList.remove('hidden');
  }
  pauseOpen() { return !this.screens.pause.classList.contains('hidden'); }

  openSettings() { this.screens.settings.classList.remove('hidden'); }
  closeSettings() { this.screens.settings.classList.add('hidden'); }
  settingsOpen() { return !this.screens.settings.classList.contains('hidden'); }

  showInventory() {
    this.screens.inventory.classList.remove('hidden');
    document.getElementById('inv-slot-num').textContent = this.selected + 1;
    this.callbacks.onInventoryOpen?.(true);
  }
  hideInventory() {
    this.screens.inventory.classList.add('hidden');
    this.callbacks.onInventoryOpen?.(false);
  }
  inventoryOpen() { return !this.screens.inventory.classList.contains('hidden'); }

  setStats(fps, x, y, z) {
    document.getElementById('stat-fps').textContent = `${fps} FPS`;
    document.getElementById('stat-pos').textContent = `${Math.round(x)} ${Math.round(y)} ${Math.round(z)}`;
  }

  setClock(text, night) {
    document.getElementById('stat-time').textContent = text;
    document.body.classList.toggle('night', night);
  }

  setMuted(muted) {
    document.getElementById('mute-btn').classList.toggle('muted', muted);
  }

  setBreakProgress(p) {
    if (p <= 0) {
      this.breakRing.classList.remove('on');
      return;
    }
    this.breakRing.classList.add('on');
    this.breakFill.style.setProperty('--p', Math.round(p * 100));
  }

  setUnderwater(on) {
    document.getElementById('underwater').classList.toggle('on', on);
  }

  toast(text, duration = 2200) {
    if (!this.toastEl) {
      const el = document.createElement('div');
      el.id = 'toast';
      document.getElementById('app').appendChild(el);
      this.toastEl = el;
    }
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), duration);
  }

  flashHurt() {
    const el = document.getElementById('hurt-flash');
    el.style.opacity = '1';
    clearTimeout(this.hurtTimer);
    this.hurtTimer = setTimeout(() => { el.style.opacity = '0'; }, 220);
  }

  setFlyState(flying) {
    document.getElementById('t-fly').classList.toggle('on', flying);
  }

  showRotateHint() {
    if (!this.touch) return;
    if (window.innerHeight > window.innerWidth && window.innerWidth < 700) {
      const hint = document.getElementById('rotate-hint');
      hint.classList.remove('hidden');
      clearTimeout(this.rotateTimer);
      this.rotateTimer = setTimeout(() => hint.classList.add('hidden'), 4200);
    }
  }

  updateTouchHotbarWheel() { /* reserved */ }
}
