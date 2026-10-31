import * as THREE from 'three';
import { isSolid } from './blocks.js';

const EPS = 1e-4;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 40, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.08;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.sprinting = false;
    this.sneaking = false;
    this.width = 0.6;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.bob = 0;
    this.bobAmount = 0;
    this.stepDistance = 0;
    this.onStep = null;
    this.sensitivity = 1;
    this.invertY = false;
    this.input = { forward: 0, strafe: 0, up: false, down: false, jump: false, sprint: false };
    this.moving = false;
    this.lastJumpTap = -10;
    this.camera.rotation.order = 'YXZ';
    this.fovTarget = 75;
    this.time = 0;
  }

  spawnAt(spawn) {
    this.pos.set(spawn.x + 0.5, spawn.y + 0.01, spawn.z + 0.5);
    this.yaw = spawn.yaw ?? 0;
    this.pitch = -0.06;
    this.vel.set(0, 0, 0);
    this.flying = false;
  }

  applySpawn(spawn) {
    this.spawnAt(spawn);
  }

  setSensitivity(value) { this.sensitivity = value; }

  look(dx, dy) {
    const s = 0.0022 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch -= dy * s * (this.invertY ? -1 : 1);
    this.pitch = Math.max(-1.54, Math.min(1.54, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  toggleFly() {
    this.flying = !this.flying;
    this.vel.y = 0;
    return this.flying;
  }

  forwardVector(target = new THREE.Vector3()) {
    return target.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();
  }

  eyePosition(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + (this.sneaking ? 1.45 : this.eyeHeight), this.pos.z);
  }

  isUnderwater() {
    const eye = this.eyePosition();
    return this.world.isWaterAt(eye.x, eye.y - 0.1, eye.z);
  }

  collides(x, y, z) {
    const hw = this.width / 2;
    const minX = Math.floor(x - hw + EPS), maxX = Math.floor(x + hw - EPS);
    const minY = Math.floor(y + EPS), maxY = Math.floor(y + this.height - EPS);
    const minZ = Math.floor(z - hw + EPS), maxZ = Math.floor(z + hw - EPS);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.18));
    const step = amount / steps;
    for (let i = 0; i < steps; i++) {
      const nx = this.pos.x + (axis === 'x' ? step : 0);
      const ny = this.pos.y + (axis === 'y' ? step : 0);
      const nz = this.pos.z + (axis === 'z' ? step : 0);
      if (this.collides(nx, ny, nz)) {
        if (axis === 'y') {
          if (step < 0) this.onGround = true;
          this.vel.y = 0;
        } else {
          this.vel[axis] = 0;
        }
        return;
      }
      this.pos.set(nx, ny, nz);
    }
  }

  update(dt, world) {
    this.time += dt;
    dt = Math.min(dt, 0.05);
    const feetBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const bodyWater = feetBlock === 40 || world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.0), Math.floor(this.pos.z)) === 40;
    this.inWater = bodyWater;
    const wish = new THREE.Vector3();
    const f = this.input.forward;
    const s = this.input.strafe;
    if (f !== 0 || s !== 0) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      wish.x += (-sin * f) + (cos * s);
      wish.z += (-cos * f) + (-sin * s);
      if (wish.lengthSq() > 1) wish.normalize();
      this.moving = true;
    } else this.moving = false;

    const wantSprint = this.input.sprint && f > 0;
    this.sprinting = wantSprint && !this.sneaking;
    this.sneaking = this.input.down && !this.flying;
    let speed;
    if (this.flying) speed = this.sprinting ? 17 : 9.5;
    else if (this.inWater) speed = 3.2;
    else if (this.sneaking) speed = 1.9;
    else speed = this.sprinting ? 6.3 : 4.4;
    const accel = this.flying ? 10 : this.onGround ? 16 : 6;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    if (this.flying) {
      const up = (this.input.jump ? 1 : 0) - (this.input.down ? 1 : 0);
      this.vel.y += (up * (this.sprinting ? 14 : 8) - this.vel.y) * Math.min(1, 12 * dt);
    } else if (this.inWater) {
      const up = this.input.jump ? 1 : 0;
      this.vel.y += (up * 4.2 - 1.6 - this.vel.y) * Math.min(1, 8 * dt);
      if (this.vel.y < -4) this.vel.y = -4;
    } else {
      this.vel.y -= 27 * dt;
      if (this.vel.y < -48) this.vel.y = -48;
    }

    if (this.input.jump && !this.flying) {
      if (this.inWater) {
        this.vel.y = Math.min(this.vel.y + 15 * dt, 3.8);
      } else if (this.onGround && !this.wasJumping) {
        this.vel.y = 8.4;
        this.onGround = false;
      }
    }
    this.wasJumping = this.input.jump;

    const beforeY = this.pos.y;
    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
    if (!this.onGround && this.vel.y <= 0 && this.collides(this.pos.x, this.pos.y - 0.06, this.pos.z)) {
      this.onGround = true;
    }
    if (this.pos.y < -10) {
      this.spawnAt(world.spawn);
    }
    // step audio
    const horizontalSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && horizontalSpeed > 0.6) {
      this.stepDistance += horizontalSpeed * dt;
      const stride = this.sprinting ? 1.9 : 2.4;
      if (this.stepDistance > stride) {
        this.stepDistance = 0;
        const under = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
        this.onStep?.(under);
      }
    }
    const targetBob = this.onGround && this.moving ? 1 : 0;
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, 8 * dt);
    this.bob += horizontalSpeed * dt * (this.sprinting ? 11 : 8.5);

    this.updateCamera();
  }

  updateCamera() {
    const eye = this.sneaking ? 1.45 : this.eyeHeight;
    const bobY = Math.sin(this.bob * 2) * 0.028 * this.bobAmount;
    const bobX = Math.cos(this.bob) * 0.03 * this.bobAmount;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.camera.position.set(
      this.pos.x + cos * bobX,
      this.pos.y + eye + bobY,
      this.pos.z - sin * bobX,
    );
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.006 * this.bobAmount);
    const fov = 75 + (this.sprinting ? 6 : 0) + (this.inWater ? -3 : 0);
    this.fovTarget = fov;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * 0.12;
      this.camera.updateProjectionMatrix();
    }
  }

  intersectsBlock(x, y, z) {
    const hw = this.width / 2;
    return (
      this.pos.x + hw > x + 0.001 && this.pos.x - hw < x + 0.999 &&
      this.pos.z + hw > z + 0.001 && this.pos.z - hw < z + 0.999 &&
      this.pos.y + this.height > y + 0.001 && this.pos.y < y + 0.999
    );
  }
}
