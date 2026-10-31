import * as THREE from 'three';

export function createMaterials(atlas) {
  const solid = new THREE.MeshLambertMaterial({
    map: atlas,
    vertexColors: true,
    alphaTest: 0.3,
    side: THREE.FrontSide,
  });

  const plant = new THREE.MeshBasicMaterial({
    map: atlas,
    vertexColors: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    fog: true,
  });

  const glass = new THREE.MeshLambertMaterial({
    map: atlas,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const water = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color('#fff0c8') },
      uDay: { value: 1 },
      uFogColor: { value: new THREE.Color('#cfe9f7') },
      uFogNear: { value: 60 },
      uFogFar: { value: 150 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNrm;
      void main() {
        vec3 p = position;
        if (normal.y > 0.5) {
          p.y += sin(p.x * 0.55 + uTime * 1.15) * 0.045
               + sin(p.z * 0.7 - uTime * 0.9) * 0.035
               + sin((p.x + p.z) * 0.22 + uTime * 0.5) * 0.025;
        }
        vWorld = p;
        vNrm = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uDay;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;
      varying vec3 vNrm;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float w1 = sin(vWorld.x * 0.35 + uTime * 0.8);
        float w2 = cos(vWorld.z * 0.42 - uTime * 0.65);
        vec3 n = normalize(vec3(w1 * 0.075, 1.0, w2 * 0.075));
        if (abs(vNrm.y) < 0.5) n = normalize(vNrm);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
        vec3 deep = vec3(0.014, 0.10, 0.19) * (0.34 + uDay * 0.66);
        vec3 shallow = vec3(0.05, 0.30, 0.42) * (0.32 + uDay * 0.68);
        vec3 col = mix(deep, shallow, fres * 0.85 + 0.08);
        vec3 sunDir = normalize(uSunDir);
        float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 110.0);
        col += uSunColor * spec * (0.45 + uDay * 1.15);
        float horizon = pow(max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
        col += vec3(0.05, 0.1, 0.12) * horizon * uDay;
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
        col = mix(col, uFogColor, fogF);
        float alpha = mix(0.56, 0.84, fres);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return { solid, plant, glass, water };
}

export function updateWaterMaterial(material, time, sky) {
  const u = material.uniforms;
  u.uTime.value = time;
  u.uSunDir.value.copy(sky.sunDir);
  u.uSunColor.value.copy(sky.sunColor);
  u.uDay.value = Math.max(0.12, Math.min(1, sky.sunDir.y * 3 + 0.35));
  u.uFogColor.value.copy(sky.fog.color);
  u.uFogNear.value = sky.fog.near;
  u.uFogFar.value = sky.fog.far;
}
