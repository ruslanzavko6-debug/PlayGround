// Raycasting renderer: textured walls, sky, sand floor, billboard sprites,
// particles and a vector weapon viewmodel. Zero dependencies.

import { createTextures } from './textures.js';

const HAZE = [206, 184, 145];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function glove(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(-0.25);
  ctx.fillStyle = '#b98a63';
  rr(ctx, -15, -11, 30, 23, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(92,60,38,0.55)';
  for (let i = -2; i <= 2; i++) ctx.fillRect(-10 + i * 5, -9, 1, 7);
  ctx.fillStyle = 'rgba(255,230,200,0.18)';
  rr(ctx, -13, -9, 26, 5, 3);
  ctx.fill();
  ctx.restore();
}

function flashStar(ctx, x, y, size, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * Math.PI);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#ffd263';
  ctx.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 ? size * 0.34 : size * (0.8 + Math.random() * 0.35);
    const a = (i / (spikes * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff7d8';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.tex = createTextures();
    this.plane = 0.88;
    this.W = 640;
    this.H = 360;
    this.image = null;
    this.zbuf = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const aspect =
      rect.width > 4 && rect.height > 4
        ? rect.width / rect.height
        : window.innerWidth / Math.max(1, window.innerHeight);
    const target = window.innerWidth < 900 ? 240000 : 330000;
    let W = Math.round(Math.sqrt(target * aspect));
    W = clamp(W, 320, 860);
    if (W % 2) W++;
    let H = Math.round(W / aspect);
    H = clamp(H, 180, 940);
    if (H % 2) H++;
    if (W === this.W && H === this.H && this.image) return;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.image = this.ctx.createImageData(W, H);
    this.zbuf = new Float32Array(W);
  }

  frameFor(e) {
    if (!e.alive) return e.frames.dead;
    if (e.fireTimer > 0) return e.frames.shoot;
    if (e.moving) return e.frames[Math.floor(e.walkPhase * 5) % 2 ? 'walk2' : 'walk1'];
    return e.frames.idle;
  }

  render(state) {
    const { player, world, enemies = [], particles = [], anim = null, hideWeapon = false } = state;
    const W = this.W;
    const H = this.H;
    const buf = this.image.data;
    const zbuf = this.zbuf;
    const px = player.x;
    const py = player.y;
    const horizon = Math.round(H / 2 + (player.pitch || 0));
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const planeX = -dirY * this.plane;
    const planeY = dirX * this.plane;
    const skyEnd = clamp(horizon, 0, H);

    // ----- sky -----
    const sunX = W * 0.7;
    const sunY = horizon - H * 0.58;
    const sunR = H * 0.42;
    for (let y = 0; y < skyEnd; y++) {
      const t = y / Math.max(1, horizon);
      const e = t * t;
      let r = lerp(72, 227, e);
      let g = lerp(104, 207, e);
      let b = lerp(136, 168, e);
      const band = Math.max(0, (t - 0.82) / 0.18);
      r = lerp(r, 238, band * 0.5);
      g = lerp(g, 219, band * 0.5);
      b = lerp(b, 182, band * 0.5);
      for (let x = 0; x < W; x++) {
        let cr = r;
        let cg = g;
        let cb = b;
        const dx = (x - sunX) / sunR;
        const dy = (y - sunY) / sunR;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const glow = (1 - d2) * (1 - d2) * 58;
          cr = Math.min(255, cr + glow);
          cg = Math.min(255, cg + glow * 0.9);
          cb = Math.min(255, cb + glow * 0.6);
        }
        const o = (y * W + x) * 4;
        buf[o] = cr;
        buf[o + 1] = cg;
        buf[o + 2] = cb;
        buf[o + 3] = 255;
      }
    }

    // ----- floor -----
    const floorTex = this.tex.floor;
    const fdata = floorTex.data;
    const stepXBase = (rowDist) => (rowDist * (planeX * 2)) / W;
    const stepYBase = (rowDist) => (rowDist * (planeY * 2)) / W;
    for (let y = Math.max(0, horizon + 1); y < H; y++) {
      const p = y - horizon;
      const rowDist = (0.5 * H) / p;
      let fx = px + rowDist * (dirX - planeX);
      let fy = py + rowDist * (dirY - planeY);
      const stepX = stepXBase(rowDist);
      const stepY = stepYBase(rowDist);
      const fog = Math.min(0.72, rowDist * 0.045);
      const light = Math.max(0.34, 1 - rowDist * 0.03);
      const fr = HAZE[0] * fog;
      const fg = HAZE[1] * fog;
      const fb = HAZE[2] * fog;
      let o = (y * W) * 4;
      for (let x = 0; x < W; x++) {
        const tx = ((fx * 64) | 0) & 63;
        const ty = ((fy * 64) | 0) & 63;
        const to = (ty * 64 + tx) * 4;
        const shade = light;
        buf[o] = fdata[to] * shade * (1 - fog) + fr;
        buf[o + 1] = fdata[to + 1] * shade * (1 - fog) + fg;
        buf[o + 2] = fdata[to + 2] * shade * (1 - fog) + fb;
        buf[o + 3] = 255;
        fx += stepX;
        fy += stepY;
        o += 4;
      }
    }

    // ----- walls (DDA) -----
    const grid = world.grid;
    const mw = world.w;
    const mh = world.h;
    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rx = dirX + planeX * cameraX;
      const ry = dirY + planeY * cameraX;
      let mapX = Math.floor(px);
      let mapY = Math.floor(py);
      const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx);
      const ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      const stepX = rx < 0 ? -1 : 1;
      const stepY = ry < 0 ? -1 : 1;
      let sideX = rx < 0 ? (px - mapX) * ddx : (mapX + 1 - px) * ddx;
      let sideY = ry < 0 ? (py - mapY) * ddy : (mapY + 1 - py) * ddy;
      let tile = 0;
      let side = 0;
      for (let i = 0; i < 96; i++) {
        if (sideX < sideY) {
          mapX += stepX;
          sideX += ddx;
          side = 0;
          tile = mapX < 0 || mapX >= mw || mapY < 0 || mapY >= mh ? 1 : grid[mapY * mw + mapX];
        } else {
          mapY += stepY;
          sideY += ddy;
          side = 1;
          tile = mapX < 0 || mapX >= mw || mapY < 0 || mapY >= mh ? 1 : grid[mapY * mw + mapX];
        }
        if (tile > 0) break;
      }
      const perp = Math.max(
        0.0001,
        side === 0 ? sideX - ddx : sideY - ddy
      );
      zbuf[x] = perp;
      const lineHeight = H / perp;
      const drawStart = horizon - lineHeight / 2;
      const drawEnd = drawStart + lineHeight;
      let wallX = side === 0 ? py + perp * ry : px + perp * rx;
      wallX -= Math.floor(wallX);
      let texX = (wallX * 64) | 0;
      if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) texX = 63 - texX;
      texX = clamp(texX, 0, 63);
      const tex = this.tex.walls[(tile - 1) % this.tex.walls.length];
      const tdata = tex.data;
      const fog = Math.min(0.7, perp * 0.042);
      const sideShade = side === 1 ? 0.7 : 1;
      const light = sideShade * Math.max(0.56, 1 - perp * 0.021);
      const y0 = Math.max(0, Math.floor(drawStart));
      const y1 = Math.min(H, Math.ceil(drawEnd));
      const step = 64 / lineHeight;
      let texPos = (y0 - drawStart) * step;
      const fr = HAZE[0] * fog;
      const fg = HAZE[1] * fog;
      const fb = HAZE[2] * fog;
      let o = (y0 * W + x) * 4;
      for (let y = y0; y < y1; y++) {
        let ty = texPos | 0;
        if (ty < 0) ty = 0;
        else if (ty > 63) ty = 63;
        const to = (ty * 64 + texX) * 4;
        const v = texPos * 0.015625;
        const ao = v > 0.84 ? 1 - (v - 0.84) * 1.7 : 1;
        const shade = light * ao;
        buf[o] = tdata[to] * shade * (1 - fog) + fr;
        buf[o + 1] = tdata[to + 1] * shade * (1 - fog) + fg;
        buf[o + 2] = tdata[to + 2] * shade * (1 - fog) + fb;
        buf[o + 3] = 255;
        texPos += step;
        o += W * 4;
      }
    }

    // ----- sprites -----
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const ordered = enemies.slice().sort((a, b) => {
      const da = (a.x - px) ** 2 + (a.y - py) ** 2;
      const db = (b.x - px) ** 2 + (b.y - py) ** 2;
      return db - da;
    });
    for (const e of ordered) {
      const sx = e.x - px;
      const sy = e.y - py;
      const tx = invDet * (dirY * sx - dirX * sy);
      const ty = invDet * (-planeY * sx + planeX * sy);
      if (ty < 0.2) continue;
      const frame = this.frameFor(e);
      const screenX = (W / 2) * (1 + tx / ty);
      const spriteH = (H / ty) * frame.wH;
      const spriteW = spriteH * (frame.w / frame.h);
      const bottom = horizon + H / (2 * ty);
      const top = bottom - spriteH;
      const left = screenX - spriteW / 2;
      const x0 = Math.max(0, Math.floor(left));
      const x1 = Math.min(W - 1, Math.ceil(left + spriteW));
      if (x1 < 0 || x0 >= W) continue;
      const fog = Math.min(0.72, ty * 0.045);
      const light = Math.max(0.42, 1 - ty * 0.024);
      const fr = HAZE[0] * fog;
      const fg = HAZE[1] * fog;
      const fb = HAZE[2] * fog;
      const flash = e.hitFlash > 0 ? 0.55 : 0;
      const data = frame.data;
      const fw = frame.w;
      const fh = frame.h;
      for (let x = x0; x <= x1; x++) {
        if (ty > zbuf[x] + 0.05) continue;
        const u = ((x - left) / spriteW) * fw;
        const ux = u | 0;
        if (ux < 0 || ux >= fw) continue;
        for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, Math.ceil(bottom)); y++) {
          const v = ((y - top) / spriteH) * fh;
          const vy = v | 0;
          if (vy < 0 || vy >= fh) continue;
          const to = (vy * fw + ux) * 4;
          const a = data[to + 3];
          if (a < 70) continue;
          const o = (y * W + x) * 4;
          let r = data[to] * light * (1 - fog) + fr;
          let g = data[to + 1] * light * (1 - fog) + fg;
          let b = data[to + 2] * light * (1 - fog) + fb;
          if (flash > 0) {
            r += (255 - r) * flash;
            g += (230 - g) * flash;
            b += (220 - b) * flash;
          }
          buf[o] = r;
          buf[o + 1] = g;
          buf[o + 2] = b;
          buf[o + 3] = 255;
        }
      }
    }

    // ----- particles -----
    for (const p of particles) {
      const sx = p.x - px;
      const sy = p.y - py;
      const tx = invDet * (dirY * sx - dirX * sy);
      const ty = invDet * (-planeY * sx + planeX * sy);
      if (ty < 0.25) continue;
      const screenX = (W / 2) * (1 + tx / ty);
      const screenY = horizon + H / (2 * ty) - (p.z * H) / ty;
      const size = Math.max(1, ((H / ty) * (p.size || 0.03)) | 0);
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      const x0 = clamp((screenX - size / 2) | 0, 0, W - 1);
      const x1 = clamp(x0 + size, 0, W);
      const y0 = clamp((screenY - size / 2) | 0, 0, H - 1);
      const y1 = clamp(y0 + size, 0, H);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const o = (y * W + x) * 4;
          buf[o] = buf[o] * (1 - alpha) + p.color[0] * alpha;
          buf[o + 1] = buf[o + 1] * (1 - alpha) + p.color[1] * alpha;
          buf[o + 2] = buf[o + 2] * (1 - alpha) + p.color[2] * alpha;
        }
      }
    }

    this.ctx.putImageData(this.image, 0, 0);

    if (!hideWeapon && anim) {
      this.drawWeapon(anim);
    }
  }

  drawWeapon(anim) {
    const { ctx, W, H } = this;
    const portrait = H > W * 1.15;
    const s = Math.max(0.68, Math.min(1.45, Math.min(W / 640, H / 360))) * (portrait ? 0.8 : 1.02);
    const recoil = anim.recoil || 0;
    const reload = anim.reload || 0;
    const swing = anim.swing || 0;
    const bobX = Math.sin(anim.bob || 0) * 4 * s;
    const bobY = Math.abs(Math.cos(anim.bob || 0)) * 3 * s;
    const mx = W * (portrait ? 0.54 : 0.57) + bobX + (anim.sway || 0);
    const my = H * (portrait ? 0.59 : 0.63) + bobY;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(0.29 + reload * 0.6 + recoil * 0.05 - swing * 1.35);
    ctx.scale(s, s);
    if (anim.weapon === 'knife') this.drawKnife(ctx, anim);
    else if (anim.weapon === 'usp') this.drawPistol(ctx, anim);
    else this.drawRifle(ctx, anim);
    ctx.restore();

    if (anim.flash > 0) {
      const g = ctx.createRadialGradient(mx, my - 10, 0, mx, my - 10, H * 0.55);
      g.addColorStop(0, `rgba(255,198,96,${0.24 * anim.flash})`);
      g.addColorStop(0.45, `rgba(255,158,52,${0.09 * anim.flash})`);
      g.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  drawRifle(ctx, anim) {
    const rec = anim.recoil || 0;
    ctx.save();
    ctx.translate(-rec * 14, rec * 10);

    // forearm
    ctx.fillStyle = '#6a6a4b';
    ctx.beginPath();
    ctx.moveTo(300, 34);
    ctx.lineTo(470, 150);
    ctx.lineTo(430, 230);
    ctx.lineTo(250, 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b98a63';
    rr(ctx, 250, 30, 70, 48, 18);
    ctx.fill();

    // stock
    ctx.fillStyle = '#5d3d21';
    ctx.beginPath();
    ctx.moveTo(292, -15);
    ctx.lineTo(424, -23);
    ctx.lineTo(432, 1);
    ctx.lineTo(300, 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,160,0.14)';
    ctx.fillRect(300, -13, 118, 4);

    // barrel + gas tube
    ctx.fillStyle = '#1d1f21';
    rr(ctx, -8, -6, 158, 11, 4);
    ctx.fill();
    ctx.fillStyle = '#26282b';
    rr(ctx, 44, -14, 88, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#151618';
    rr(ctx, 4, 4, 134, 5, 2);
    ctx.fill();

    // front sight
    ctx.fillStyle = '#1a1b1d';
    ctx.fillRect(16, -23, 4, 16);
    ctx.fillRect(10, -19, 16, 5);
    ctx.fillStyle = '#3a3d40';
    ctx.fillRect(17, -23, 2, 8);

    // wooden handguard
    ctx.fillStyle = '#7c5228';
    ctx.beginPath();
    ctx.moveTo(58, -11);
    ctx.lineTo(146, -12);
    ctx.lineTo(154, 12);
    ctx.lineTo(58, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,160,0.16)';
    ctx.fillRect(64, -9, 76, 3);
    ctx.fillStyle = 'rgba(40,22,8,0.4)';
    ctx.fillRect(64, 7, 82, 2);

    // receiver
    ctx.fillStyle = '#2d2f32';
    rr(ctx, 146, -17, 116, 33, 5);
    ctx.fill();
    ctx.fillStyle = '#1f2123';
    rr(ctx, 154, -11, 88, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#4d5256';
    ctx.fillRect(212, -11, 28, 4);
    ctx.fillRect(238, -16, 14, 8);

    // magazine
    ctx.fillStyle = '#3a2a1b';
    ctx.beginPath();
    ctx.moveTo(190, 13);
    ctx.lineTo(254, 13);
    ctx.quadraticCurveTo(276, 58, 252, 97);
    ctx.lineTo(226, 93);
    ctx.quadraticCurveTo(220, 48, 202, 34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,165,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // grip
    ctx.fillStyle = '#232527';
    ctx.beginPath();
    ctx.moveTo(256, 10);
    ctx.lineTo(288, 14);
    ctx.lineTo(300, 74);
    ctx.lineTo(268, 82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(264, 22, 5, 42);

    // trigger guard
    ctx.strokeStyle = '#1c1e20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(272, 28, 14, 0.2, Math.PI - 0.3);
    ctx.stroke();

    // hands
    glove(ctx, 268, 42, 1.05);
    glove(ctx, 114, 6, 0.92);

    // muzzle flash
    flashStar(ctx, -12, -1, 34 * (0.75 + Math.random() * 0.35), anim.flash);

    ctx.restore();
  }

  drawPistol(ctx, anim) {
    const rec = anim.recoil || 0;
    ctx.save();
    ctx.translate(-rec * 9, rec * 12);

    ctx.fillStyle = '#6a6a4b';
    ctx.beginPath();
    ctx.moveTo(120, 38);
    ctx.lineTo(260, 132);
    ctx.lineTo(226, 202);
    ctx.lineTo(86, 86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b98a63';
    rr(ctx, 82, 34, 62, 44, 16);
    ctx.fill();

    // slide
    ctx.fillStyle = '#8f979b';
    rr(ctx, -6, -16, 154, 27, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(0, -13, 132, 4);
    ctx.fillStyle = '#565d61';
    for (let i = 0; i < 6; i++) ctx.fillRect(130 + i * 3, -9, 2, 13);
    ctx.fillStyle = '#2b2d2f';
    rr(ctx, -10, -8, 26, 12, 3);
    ctx.fill();

    // frame
    ctx.fillStyle = '#33373a';
    rr(ctx, 26, 9, 118, 18, 4);
    ctx.fill();
    // grip
    ctx.fillStyle = '#24272a';
    ctx.beginPath();
    ctx.moveTo(108, 22);
    ctx.lineTo(148, 24);
    ctx.lineTo(160, 100);
    ctx.lineTo(116, 106);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 4; i++) ctx.fillRect(120 + i * 8, 40, 4, 52);

    // trigger guard
    ctx.strokeStyle = '#1b1d1f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(112, 32, 14, 0.4, Math.PI - 0.2);
    ctx.stroke();

    glove(ctx, 126, 56, 0.9);
    flashStar(ctx, -14, -2, 20 * (0.7 + Math.random() * 0.4), anim.flash);
    ctx.restore();
  }

  drawKnife(ctx, anim) {
    const swing = anim.swing || 0;
    if (swing > 0.15) {
      ctx.save();
      ctx.strokeStyle = `rgba(230,240,245,${0.16 * swing})`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(40, 0, 130, -1.1, 0.6);
      ctx.stroke();
      ctx.restore();
    }
    // blade
    const grad = ctx.createLinearGradient(-150, -18, 20, 16);
    grad.addColorStop(0, '#dfe7ea');
    grad.addColorStop(0.5, '#a9b2b7');
    grad.addColorStop(1, '#7a848a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-152, -14);
    ctx.quadraticCurveTo(-40, -24, 0, -16);
    ctx.lineTo(8, 8);
    ctx.quadraticCurveTo(-60, 18, -118, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,48,52,0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(-140, -10);
    ctx.quadraticCurveTo(-50, -17, -4, -12);
    ctx.lineTo(-6, -7);
    ctx.quadraticCurveTo(-60, -10, -136, -4);
    ctx.closePath();
    ctx.fill();
    // guard + handle
    ctx.fillStyle = '#2a2d2f';
    rr(ctx, 2, -20, 10, 38, 3);
    ctx.fill();
    ctx.fillStyle = '#25211d';
    rr(ctx, 10, -14, 74, 28, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,170,120,0.18)';
    for (let i = 0; i < 5; i++) ctx.fillRect(20 + i * 12, -11, 4, 22);
    // hand
    glove(ctx, 52, 4, 1.0);
    // hand guard details
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(4, -17, 3, 30);
  }
}
