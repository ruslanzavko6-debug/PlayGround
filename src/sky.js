import * as THREE from 'three';

const DAY_LENGTH = 600; // seconds for a full cycle

const C = (hex) => new THREE.Color(hex);
const mixColor = (a, b, t, target = new THREE.Color()) => target.copy(a).lerp(b, t);

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0.23;
    this.elapsed = 0;
    this.dayLength = DAY_LENGTH;

    this.zenith = new THREE.Color();
    this.horizon = new THREE.Color();
    this.sunColor = new THREE.Color();

    this.dayZenith = C('#3f86d0');
    this.dayHorizon = C('#cfe9f7');
    this.nightZenith = C('#050a18');
    this.nightHorizon = C('#0d1a2e');
    this.sunsetZenith = C('#2b3f66');
    this.sunsetHorizon = C('#ff9a5a');
    this.sunDir = new THREE.Vector3(0, 1, 0);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color('#3f86d0') },
        uHorizon: { value: new THREE.Color('#cfe9f7') },
        uSunColor: { value: new THREE.Color('#fff3d0') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uNight: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uNight;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -1.0, 1.0);
          float t = pow(clamp(h, 0.0, 1.0), 0.58);
          vec3 col = mix(uHorizon, uZenith, t);
          col = mix(col, uHorizon * 0.72, smoothstep(0.0, -0.28, h));
          vec3 sd = normalize(uSunDir);
          float sun = dot(d, sd);
          float disc = smoothstep(0.99915, 0.99975, sun);
          float glow = pow(max(sun, 0.0), 60.0) * 0.42 + pow(max(sun, 0.0), 7.0) * 0.1;
          col += uSunColor * (disc * 2.4 + glow);
          float moon = dot(d, -sd);
          float moonDisc = smoothstep(0.99935, 0.99985, moon);
          col += vec3(0.82, 0.88, 1.0) * moonDisc * (0.55 + 0.55 * uNight);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), this.skyMat);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    // stars
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = 0.04 + Math.random() * 0.96;
      const r = Math.sqrt(1 - v * v);
      positions[i * 3] = Math.cos(u) * r * 380;
      positions[i * 3 + 1] = v * 380;
      positions[i * 3 + 2] = Math.sin(u) * r * 380;
      sizes[i] = 1 + Math.random() * 2;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.7, sizeAttenuation: false, transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -90;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // clouds - clusters of soft, unlit puffs kept high above the island
    const cloudCount = 240;
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = cloudCanvas.height = 64;
    const cctx = cloudCanvas.getContext('2d');
    const crng = mulberry(911);
    for (let i = 0; i < 22; i++) {
      const cx = 12 + crng() * 40;
      const cy = 16 + crng() * 32;
      const r = 9 + crng() * 20;
      const g = cctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      cctx.fillStyle = g;
      cctx.fillRect(0, 0, 64, 64);
    }
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.82,
      depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    this.clouds = new THREE.InstancedMesh(cloudGeo, this.cloudMat, cloudCount);
    this.clouds.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const mat = new THREE.Matrix4();
    const PUFFS = 5;
    for (let i = 0; i < cloudCount; i++) {
      const cluster = Math.floor(i / PUFFS);
      const lr = mulberry(9000 + cluster * 977);
      const angle = (cluster / Math.ceil(cloudCount / PUFFS)) * Math.PI * 2 + lr() * 0.5;
      const radius = 24 + Math.sqrt(lr()) * 260;
      const bx = Math.cos(angle) * radius;
      const bz = Math.sin(angle) * radius;
      const by = 142 + lr() * 20;
      const w = 7 + lr() * 16;
      const d = 6 + lr() * 13;
      const h = 1.2 + lr() * 1.5;
      const ox = ((i % PUFFS) - (PUFFS - 1) / 2) * w * 0.3 + (lr() - 0.5) * w * 0.3;
      const oz = (lr() - 0.5) * d * 0.7;
      mat.compose(
        new THREE.Vector3(bx + ox, by + (i % PUFFS) * 0.16, bz + oz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lr() * 0.5, 0)),
        new THREE.Vector3(w * (0.85 + lr() * 0.3), h, d * (0.85 + lr() * 0.25)),
      );
      this.clouds.setMatrixAt(i, mat);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -20;
    scene.add(this.clouds);

    // lights
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x48563a, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3d6, 2.0);
    this.sun.position.set(60, 120, 40);
    scene.add(this.sun);
    this.moon = new THREE.DirectionalLight(0x93a9e8, 0.0);
    this.moon.position.set(-60, 80, -40);
    scene.add(this.moon);

    this.fog = new THREE.Fog(0xcfe9f7, 80, 150);
    scene.fog = this.fog;
    this.fogFar = 150;

    this.update(0, null);
  }

  get hours() {
    const h = (6 + ((this.time % 1) + 1) % 1 * 24) % 24;
    return h;
  }

  get clockString() {
    const h = this.hours;
    const hh = Math.floor(h).toString().padStart(2, '0');
    const mm = Math.floor((h % 1) * 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  setFogDistance(far) {
    this.fogFar = far;
    this.fog.near = far * 0.45;
    this.fog.far = far;
  }

  update(dt, camera) {
    this.elapsed += dt;
    this.time = (this.time + dt / this.dayLength) % 1;
    const t = this.time;
    const ang = t * Math.PI * 2;
    this.sunDir.set(Math.cos(ang) * 0.92, Math.sin(ang), 0.42).normalize();
    const elev = this.sunDir.y;
    const day = smoothThree(-0.08, 0.22, elev);
    const sunset = Math.exp(-Math.pow(elev / 0.17, 2)) * smoothThree(-0.35, -0.05, elev);
    const night = 1 - day;

    mixColor(this.nightZenith, this.dayZenith, day, this.zenith);
    this.zenith.lerp(this.sunsetZenith, sunset * 0.5);
    mixColor(this.nightHorizon, this.dayHorizon, day, this.horizon);
    this.horizon.lerp(this.sunsetHorizon, sunset * 0.8);
    mixColor(new THREE.Color('#ff6b30'), new THREE.Color('#fff4d6'), smoothThree(0.0, 0.3, elev), this.sunColor);

    this.skyMat.uniforms.uZenith.value.copy(this.zenith);
    this.skyMat.uniforms.uHorizon.value.copy(this.horizon);
    this.skyMat.uniforms.uSunColor.value.copy(this.sunColor);
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uNight.value = night;

    this.fog.color.copy(this.horizon);
    this.starMat.opacity = Math.pow(night, 1.4) * 0.95;
    this.stars.rotation.y = this.elapsed * 0.008;

    this.cloudMat.opacity = 0.35 + day * 0.45;
    this.cloudMat.color.copy(this.horizon).lerp(new THREE.Color('#ffffff'), 0.25 + day * 0.7);
    this.clouds.position.x = Math.sin(this.elapsed * 0.006) * 30;
    this.clouds.position.z = this.elapsed * 0.6 % 80;

    this.hemi.intensity = 0.24 + day * 0.72;
    this.hemi.color.copy(this.horizon).lerp(new THREE.Color('#bfe0ff'), 0.5);
    this.hemi.groundColor.setHex(0x3d4a32).lerp(new THREE.Color('#1a2018'), night);
    this.sun.intensity = Math.max(0, day) * 2.05;
    this.sun.color.copy(this.sunColor);
    this.sun.position.copy(this.sunDir).multiplyScalar(180);
    this.moon.intensity = Math.max(0, -elev) * 0.5;
    this.moon.position.copy(this.sunDir).multiplyScalar(-180);

    if (camera) {
      this.sky.position.copy(camera.position);
      this.stars.position.copy(camera.position);
    }
  }
}

function smoothThree(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
