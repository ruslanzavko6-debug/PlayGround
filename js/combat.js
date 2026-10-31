// Weapons, hitscan combat and terrorist AI.

export const WEAPONS = {
  ak: {
    id: 'ak',
    name: 'AK-47',
    damage: 34,
    head: 130,
    rate: 0.102,
    mag: 30,
    reserve: 90,
    reload: 2.35,
    spread: 0.011,
    kick: 2.2,
    auto: true,
    range: 48,
    sound: 'ak',
    slot: '1',
  },
  usp: {
    id: 'usp',
    name: 'USP-S',
    damage: 27,
    head: 115,
    rate: 0.17,
    mag: 12,
    reserve: 48,
    reload: 1.9,
    spread: 0.017,
    kick: 1.5,
    auto: false,
    range: 36,
    sound: 'usp',
    slot: '2',
  },
  knife: {
    id: 'knife',
    name: 'НОЖ',
    damage: 62,
    head: 62,
    rate: 0.44,
    mag: Infinity,
    reserve: 0,
    reload: 0,
    spread: 0,
    kick: 0,
    auto: false,
    range: 2.2,
    sound: 'knife',
    slot: '3',
  },
};

export const WEAPON_ORDER = ['ak', 'usp', 'knife'];

export function makeLoadout() {
  return {
    ak: { ammo: WEAPONS.ak.mag, reserve: WEAPONS.ak.reserve },
    usp: { ammo: WEAPONS.usp.mag, reserve: WEAPONS.usp.reserve },
    knife: { ammo: Infinity, reserve: 0 },
  };
}

const rand = (a, b) => a + Math.random() * (b - a);

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function spawnParticle(game, p) {
  game.particles.push(p);
  if (game.particles.length > 260) game.particles.splice(0, game.particles.length - 260);
}

function bloodBurst(game, x, y, z, count = 10) {
  for (let i = 0; i < count; i++) {
    spawnParticle(game, {
      x,
      y,
      z,
      vx: rand(-1.7, 1.7),
      vy: rand(-1.7, 1.7),
      vz: rand(0.2, 2.4),
      life: rand(0.25, 0.55),
      maxLife: 0.55,
      size: rand(0.02, 0.05),
      color: [140 + ((Math.random() * 40) | 0), 18 + ((Math.random() * 18) | 0), 14],
    });
  }
}

function dustBurst(game, x, y, z, nx, ny) {
  for (let i = 0; i < 7; i++) {
    spawnParticle(game, {
      x,
      y,
      z,
      vx: -nx * rand(0.2, 0.9) + rand(-0.4, 0.4),
      vy: -ny * rand(0.2, 0.9) + rand(-0.4, 0.4),
      vz: rand(0.4, 1.6),
      life: rand(0.2, 0.45),
      maxLife: 0.45,
      size: rand(0.018, 0.04),
      color: [208, 188, 154],
    });
  }
}

function muzzlePuff(game, x, y, z, dx, dy, count = 4) {
  for (let i = 0; i < count; i++) {
    spawnParticle(game, {
      x,
      y,
      z,
      vx: dx * rand(0.2, 1) + rand(-0.3, 0.3),
      vy: dy * rand(0.2, 1) + rand(-0.3, 0.3),
      vz: rand(0.1, 0.6),
      life: rand(0.1, 0.3),
      maxLife: 0.3,
      size: rand(0.02, 0.045),
      color: [255, 202, 120],
    });
  }
}

export function startReload(game, audio) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'knife' || p.reloading > 0) return;
  const st = p.weapons[p.weapon];
  if (st.ammo >= w.mag || st.reserve <= 0) return;
  p.reloading = w.reload;
  p.reloadTotal = w.reload;
  audio.reload(w.reload);
}

export function switchWeapon(game, id, audio) {
  if (!WEAPONS[id] || game.player.weapon === id) return;
  game.player.weapon = id;
  game.player.reloading = 0;
  game.player.reloadTotal = 0;
  game.player.cooldown = Math.max(game.player.cooldown, 0.28);
  audio.click(480, 0.05, 0.08);
}

export function updateWeapon(game, dt) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.recoil = Math.max(0, p.recoil - dt * 2.7);
  p.flash = Math.max(0, p.flash - dt * 9);
  p.swing = Math.max(0, p.swing - dt * 3.1);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      p.reloading = 0;
      const st = p.weapons[p.weapon];
      const need = w.mag - st.ammo;
      const take = Math.min(need, st.reserve);
      st.ammo += take;
      st.reserve -= take;
    }
  }
}

export function alertNear(game, x, y, radius) {
  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) < radius) e.alerted = true;
  }
}

export function tryShoot(game, world, audio) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.reloading > 0 || p.cooldown > 0) return false;

  if (p.weapon === 'knife') {
    p.cooldown = w.rate;
    p.swing = 1;
    p.flash = 0;
    audio.knife();
    alertNear(game, p.x, p.y, 7);
    let best = null;
    let bestD = Infinity;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > w.range + 0.4) continue;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - p.angle), Math.cos(Math.atan2(dy, dx) - p.angle)));
      if (diff > 1.1) continue;
      if (!world.lineOfSight(p.x, p.y, e.x, e.y)) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      bloodBurst(game, best.x, best.y, 0.55, 12);
      damageEnemy(game, best, w.damage, false, audio, 'НОЖ');
      audio.hit(false);
      game.shots++;
      game.hits++;
      game.hitmarker = 0.2;
      game.hitmarkerHead = false;
    }
    return true;
  }

  const st = p.weapons[p.weapon];
  if (st.ammo <= 0) {
    p.cooldown = 0.3;
    audio.empty();
    startReload(game, audio);
    return false;
  }

  st.ammo--;
  game.shots++;
  p.cooldown = w.rate;
  p.recoil = Math.min(1.3, p.recoil + 0.36);
  p.flash = 1;
  p.pitch += w.kick + Math.random() * 1.6;
  p.angle += (Math.random() - 0.5) * 0.012;
  game.muzzle = 0.07;
  game.shake = Math.max(game.shake, 2.6);
  audio.shoot(w.sound);
  alertNear(game, p.x, p.y, 14);

  const moveSpread = p.moving ? 2.2 : 1;
  const crouchSpread = p.crouch ? 0.7 : 1;
  const spread = w.spread * moveSpread * crouchSpread * (1 + p.recoil * 0.35);
  const shotAngle = p.angle + (Math.random() + Math.random() - 1) * spread;
  const dx = Math.cos(shotAngle);
  const dy = Math.sin(shotAngle);
  const wall = world.raycast(p.x, p.y, dx, dy, w.range);
  const maxT = wall ? wall.dist : w.range;

  let target = null;
  let targetT = Infinity;
  let head = false;
  const viewH = game.viewH || 360;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const ox = e.x - p.x;
    const oy = e.y - p.y;
    const t = ox * dx + oy * dy;
    if (t <= 0.25 || t > maxT) continue;
    const lateral = Math.abs(ox * dy - oy * dx);
    const aimY = 0.5 + (p.pitch * t) / viewH;
    if (aimY > 1.02 || aimY < 0.02) continue;
    const isHead = aimY > 0.63;
    const radius = isHead ? 0.18 : 0.3;
    if (lateral > radius) continue;
    if (t < targetT) {
      targetT = t;
      target = e;
      head = isHead;
    }
  }

  if (target) {
    game.hits++;
    const dmg = head ? w.head : w.damage;
    target.hitFlash = 0.14;
    target.alerted = true;
    bloodBurst(game, target.x, target.y, head ? 0.78 : 0.5, head ? 16 : 9);
    audio.hit(head);
    game.hitmarker = 0.2;
    game.hitmarkerHead = head;
    damageEnemy(game, target, dmg, head, audio, w.name);
  } else if (wall) {
    dustBurst(game, wall.x, wall.y, 0.45 + Math.random() * 0.35, dx, dy);
    muzzlePuff(game, p.x + dx * 0.6, p.y + dy * 0.6, 0.52, dx, dy, 2);
  }

  if (st.ammo === 0) game.autoReload = 0.35;
  return true;
}

export function damageEnemy(game, e, damage, head, audio, weaponName) {
  if (!e.alive) return;
  e.health -= damage;
  if (e.health > 0) return;
  e.alive = false;
  e.health = 0;
  e.deadTimer = 0;
  e.moving = false;
  e.fireTimer = 0;
  game.kills++;
  game.money += 300;
  if (head) game.headshots++;
  bloodBurst(game, e.x, e.y, 0.35, 14);
  audio.kill();
  game.onEnemyKilled?.(e, head, weaponName);
}

export function updateEnemies(game, world, dt, audio) {
  const p = game.player;
  for (const e of game.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.fireTimer = Math.max(0, e.fireTimer - dt);
    if (!e.alive) {
      e.deadTimer += dt;
      continue;
    }
    e.cooldown -= dt;
    e.strafeTimer -= dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.max(0.001, Math.hypot(dx, dy));
    const angTo = Math.atan2(dy, dx);
    const los = dist < 24 && world.lineOfSight(e.x, e.y, p.x, p.y);
    if (los && dist < 19) e.alerted = true;

    if (!e.alerted) {
      e.moving = false;
      e.angle += Math.sin(game.time * 0.6 + e.id) * dt * 0.35;
      continue;
    }

    e.angle = angleLerp(e.angle, angTo, 1 - Math.exp(-dt * 7));
    let mx = 0;
    let my = 0;
    e.moving = false;

    if (los) {
      if (dist > 7) {
        mx = dx / dist;
        my = dy / dist;
      } else if (dist < 2.4) {
        mx = -dx / dist;
        my = -dy / dist;
      } else {
        mx = (-dy / dist) * e.strafe;
        my = (dx / dist) * e.strafe;
        if (e.strafeTimer <= 0) {
          e.strafe *= -1;
          e.strafeTimer = rand(1.1, 2.7);
        }
      }

      if (dist < 17 && e.cooldown <= 0 && game.roundActive) {
        e.cooldown = rand(0.78, 1.6);
        e.fireTimer = 0.14;
        const pan = Math.sin(angTo - p.angle) * 0.7;
        audio.enemyShot(pan, dist);
        muzzlePuff(game, e.x + (dx / dist) * 0.45, e.y + (dy / dist) * 0.45, 0.55, dx / dist, dy / dist, 3);
        const chance = Math.max(
          0.15,
          Math.min(0.8, 0.86 - dist * 0.034 - (p.moving ? 0.12 : 0) - (p.crouch ? 0.08 : 0))
        );
        if (Math.random() < chance) {
          game.damagePlayer(rand(8, 17), e);
        }
      }
    } else {
      e.pathTimer -= dt;
      if (e.pathTimer <= 0 || !e.path.length) {
        e.path = world.findPath(e.x, e.y, p.x, p.y);
        e.pathTimer = rand(0.55, 0.95);
      }
      const node = e.path[0];
      if (node) {
        const ndx = node.x - e.x;
        const ndy = node.y - e.y;
        const nd = Math.hypot(ndx, ndy);
        if (nd < 0.22) e.path.shift();
        else {
          mx = ndx / nd;
          my = ndy / nd;
        }
      }
    }

    if (mx !== 0 || my !== 0) {
      const speed = (los ? 1.45 : 2.2) * (e.fireTimer > 0 ? 0.4 : 1);
      const nx = mx * speed * dt;
      const ny = my * speed * dt;
      let moved = false;
      if (!world.circleBlocked(e.x + nx, e.y, 0.3)) {
        e.x += nx;
        moved = true;
      }
      if (!world.circleBlocked(e.x, e.y + ny, 0.3)) {
        e.y += ny;
        moved = true;
      }
      if (moved) {
        e.moving = true;
        e.walkPhase += dt * speed * 2.1;
      } else if (e.strafeTimer <= 0) {
        e.strafe *= -1;
        e.strafeTimer = 1.2;
      }
    }

    if (dist < 1.15) {
      const push = (1.15 - dist) * dt * 2.2;
      if (!world.circleBlocked(e.x - (dx / dist) * push, e.y, 0.3)) e.x -= (dx / dist) * push;
      if (!world.circleBlocked(e.x, e.y - (dy / dist) * push, 0.3)) e.y -= (dy / dist) * push;
    }
  }

  // soft separation so terrorists do not stack in a doorway
  for (let i = 0; i < game.enemies.length; i++) {
    const a = game.enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < game.enemies.length; j++) {
      const b = game.enemies[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001 && d < 0.62) {
        const push = (0.62 - d) * 0.5;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

export function spawnEnemies(world, player, count, frameSets) {
  const candidates = world.openCells
    .filter((c) => {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < 7.5 || d > 27) return false;
      return !world.lineOfSight(player.x, player.y, c.x, c.y);
    })
    .sort(() => Math.random() - 0.5);

  const fallback = world.openCells
    .filter((c) => Math.hypot(c.x - player.x, c.y - player.y) > 6.5)
    .sort(() => Math.random() - 0.5);

  const picked = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 2.6)) picked.push(c);
  }
  for (const c of fallback) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 1.6)) picked.push(c);
  }

  return picked.map((c, i) => ({
    id: i,
    name: 'T-' + String(i + 1).padStart(2, '0'),
    x: c.x,
    y: c.y,
    angle: Math.random() * Math.PI * 2,
    health: 100,
    alive: true,
    variant: i % frameSets.length,
    frames: frameSets[i % frameSets.length],
    alerted: false,
    cooldown: 0.8 + Math.random() * 0.9,
    fireTimer: 0,
    hitFlash: 0,
    walkPhase: Math.random() * 6,
    moving: false,
    path: [],
    pathTimer: 0,
    strafe: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 1 + Math.random() * 2,
    deadTimer: 0,
  }));
}
