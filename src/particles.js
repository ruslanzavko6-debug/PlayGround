import * as THREE from 'three';

const MAX = 480;

export class Particles {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.items = [];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) {
      this.items.push({ life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.1, rot: new THREE.Euler(), spin: new THREE.Vector3(), color: new THREE.Color() });
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
  }

  burst(pos, color, count = 12, spread = 2.6, size = 0.11, life = 0.9) {
    for (let i = 0; i < count; i++) {
      const p = this.items[this.cursor];
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      p.life = p.maxLife = life * (0.55 + Math.random() * 0.7);
      p.pos.set(pos.x + (Math.random() - 0.5) * 0.7, pos.y + (Math.random() - 0.5) * 0.7, pos.z + (Math.random() - 0.5) * 0.7);
      p.vel.set((Math.random() - 0.5) * spread, Math.random() * spread * 0.9 + 1, (Math.random() - 0.5) * spread);
      p.size = size * (0.6 + Math.random() * 0.9);
      p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      p.color.setRGB(color[0], color[1], color[2]);
      this.mesh.setColorAt(idx, p.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const dummy = this.dummy;
    let changed = false;
    for (let i = 0; i < MAX; i++) {
      const p = this.items[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        changed = true;
        continue;
      }
      p.vel.y -= 22 * dt;
      p.vel.x *= 0.995;
      p.vel.z *= 0.995;
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const fade = Math.min(1, p.life / (p.maxLife * 0.35));
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.size * fade);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
