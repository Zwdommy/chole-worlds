import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { clone as skeletonClone } from './lib/SkeletonUtils.js';

/* ============================================================
   《Chole 之境》— 一个特别幸福、特别美好的开放世界
   造物主：Chole
   完整美术版：KayKit CC0 树木/岩石/云 + 冒险者角色 + three.js 飞鸟
   （樱花树、兔子、圣所保留手工程序化建模——它们是这个世界的灵魂）
   ============================================================ */

// ---------- 错误捕获（供自动化验收） ----------
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

// ---------- 调色板 ----------
const PALETTE = {
  grassLow:  0x7ec98f,
  grassHigh: 0xa8e6cf,
  sand:      0xeeddaa,
  skyTop:    0x8ec9f2,
  skyMid:    0xdcc6ec,
  skyHorizon:0xffddc1,
  fog:       0xffe0cc,
  water:     0x7ec8e3,
  sakura:    0xffb7c5,
  sakuraLight:0xffd1dc,
  sun:       0xfff2cc,
  crystal:   0xffc8dd,
  stone:     0xd8cfc4,
  bunny:     0xfff4e6,
};

const WORLD = {
  size: 400,
  playRadius: 160,
  shrine: { x: 0, z: 0 },
  pond:   { x: 55, z: 62 },
};

// ---------- 移动端检测 ----------
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  || new URLSearchParams(location.search).has('touch');
if (IS_TOUCH) {
  document.body.classList.add('touch');
  const loadingPs = document.querySelectorAll('#loading p');
  if (loadingPs[1]) loadingPs[1].textContent = '左摇杆移动 · 右侧拖动转视角 · ⬆ 跳跃';
}

// ---------- 基础场景 ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_TOUCH ? 1.8 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 90, 460);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);

// ---------- 光照 ----------
const hemi = new THREE.HemisphereLight(0xbde0fe, 0xffd9a0, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
sun.position.set(70, 110, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;   sun.shadow.camera.bottom = -180;
sun.shadow.camera.far = 500;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

// ---------- 天空 ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: {
    top:     { value: new THREE.Color(PALETTE.skyTop) },
    mid:     { value: new THREE.Color(PALETTE.skyMid) },
    horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
  },
  vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying vec3 vPos;
    void main(){
      float h = normalize(vPos).y;
      vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.16, h));
      col = mix(col, top, smoothstep(0.14, 0.45, h));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat));

function makeGlowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture('rgba(255,252,235,1)', 'rgba(255,224,160,0.55)'),
  transparent: true, depthWrite: false,
}));
sunGlow.position.set(420, 330, 300);
sunGlow.scale.setScalar(220);
scene.add(sunGlow);

// ---------- 云海 ----------
const cloudSea = new THREE.Mesh(
  new THREE.CircleGeometry(900, 48),
  new THREE.MeshBasicMaterial({ color: 0xfff5ec, fog: false })
);
cloudSea.rotation.x = -Math.PI / 2;
cloudSea.position.y = -22;
scene.add(cloudSea);

// ---------- 地形 ----------
function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.020) * Math.cos(z * 0.024) * 5.0;
  h += Math.sin(x * 0.047 + 1.3) * Math.cos(z * 0.041 + 0.7) * 2.2;
  h += Math.sin(x * 0.110 + 4.2) * Math.cos(z * 0.130 + 2.1) * 0.7;
  const ds = Math.hypot(x - WORLD.shrine.x, z - WORLD.shrine.z);
  h += 9.0 * Math.exp(-(ds * ds) / (2 * 26 * 26));
  const dp = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
  h -= 8.0 * Math.exp(-(dp * dp) / (2 * 15 * 15));
  const r = Math.hypot(x, z);
  h -= THREE.MathUtils.smoothstep(r, 165, 205) * 40;
  return h;
}

const waterY = terrainHeight(WORLD.pond.x, WORLD.pond.z) + 2.4;

(function buildTerrain() {
  const seg = 140;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(PALETTE.grassLow);
  const cHigh = new THREE.Color(PALETTE.grassHigh);
  const cSand = new THREE.Color(PALETTE.sand);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const t = THREE.MathUtils.clamp((h + 4) / 14, 0, 1);
    tmp.lerpColors(cLow, cHigh, t);
    const dp = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
    if (dp < 20 && h < waterY + 1.2) tmp.lerp(cSand, 0.75);
    const n = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    tmp.offsetHSL(0, 0, (n - 0.5) * 0.035);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  scene.add(terrain);
})();

// ---------- 池塘 ----------
const water = new THREE.Mesh(
  new THREE.CircleGeometry(16.5, 40),
  new THREE.MeshStandardMaterial({ color: PALETTE.water, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1 })
);
water.rotation.x = -Math.PI / 2;
water.position.set(WORLD.pond.x, waterY, WORLD.pond.z);
scene.add(water);

// ---------- 工具 ----------
const rand = (a, b) => a + Math.random() * (b - a);
function scatterPos(minR, maxR, opts = {}) {
  for (let tries = 0; tries < 40; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(minR, maxR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const dp = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
    const ds = Math.hypot(x - WORLD.shrine.x, z - WORLD.shrine.z);
    if (dp < (opts.pondClear ?? 20)) continue;
    if (ds < (opts.shrineClear ?? 14)) continue;
    return { x, z, y: terrainHeight(x, z) };
  }
  return { x: 100, z: 100, y: terrainHeight(100, 100) };
}

// ============================================================
//  美术资产加载
// ============================================================
const loadStatus = document.getElementById('load-status');
const gltfLoader = new GLTFLoader();
let loadedCount = 0, totalCount = 0;
function loadGLTF(url) {
  totalCount++;
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => {
      loadedCount++;
      if (loadStatus) loadStatus.textContent = `Chole 正在种下她的树… ${loadedCount} / ${totalCount}`;
      resolve(gltf);
    }, undefined, () => reject(new Error('load failed: ' + url)));
  });
}
const MANIFEST = {
  trees: ['tree_single_A','tree_single_B','trees_A_small','trees_A_medium','trees_B_small','trees_B_medium'].map(n => `assets/nature/${n}.gltf`),
  bigTrees: ['trees_A_large','trees_A_medium','trees_B_medium'].map(n => `assets/nature/${n}.gltf`),
  rocks: ['rock_single_A','rock_single_B','rock_single_C'].map(n => `assets/nature/${n}.gltf`),
  lilies: ['waterlily_A','waterlily_B'].map(n => `assets/nature/${n}.gltf`),
  kayClouds: ['cloud_big','cloud_small'].map(n => `assets/nature/${n}.gltf`),
  player: 'assets/chars/Rogue_Hooded.glb',
  birds: ['Flamingo','Parrot','Stork'].map(n => `assets/birds/${n}.glb`),
};
async function loadAll(m) {
  const out = {};
  const jobs = [];
  for (const [key, val] of Object.entries(m)) {
    if (Array.isArray(val)) {
      out[key] = new Array(val.length);
      val.forEach((u, i) => jobs.push(loadGLTF(u).then(g => { out[key][i] = g; })));
    } else {
      jobs.push(loadGLTF(val).then(g => { out[key] = g; }));
    }
  }
  await Promise.all(jobs);
  return out;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
function makeTemplate(obj, targetSize, axis = 'y') {
  obj.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  _box.setFromObject(obj); _box.getSize(_size);
  const base = axis === 'y' ? _size.y : Math.max(_size.x, _size.z);
  const s = targetSize / base;
  obj.scale.setScalar(s);
  _box.setFromObject(obj); _box.getSize(_size);
  obj.position.set(
    -(_box.min.x + _box.max.x) / 2,
    -_box.min.y,
    -(_box.min.z + _box.max.z) / 2
  );
  const wrapper = new THREE.Group();
  wrapper.add(obj);
  wrapper.userData.size = { x: _size.x, y: _size.y, z: _size.z };
  return wrapper;
}
function place(template, x, z, rotY = 0, extraScale = 1) {
  const inst = template.clone(true);
  inst.position.set(x, terrainHeight(x, z), z);
  inst.rotation.y = rotY;
  if (extraScale !== 1) inst.scale.setScalar(extraScale);
  scene.add(inst);
  return inst;
}

const WEAPON_RE = /sword|shield|axe|dagger|staff|crossbow|arrow|quiver|wand|book|bomb|mug|knife|smoke/i;
function pickClip(clips, ...regexes) {
  for (const re of regexes) {
    const c = clips.find(a => re.test(a.name));
    if (c) return c;
  }
  return clips[0];
}
const mixers = [];
function spawnCharacter(gltf, targetH = 1.75) {
  const model = skeletonClone(gltf.scene);
  model.traverse(n => {
    if (WEAPON_RE.test(n.name)) n.visible = false;
    if (n.isMesh) { n.castShadow = true; n.frustumCulled = false; }
  });
  _box.setFromObject(model); _box.getSize(_size);
  const s = targetH / _size.y;
  model.scale.setScalar(s);
  _box.setFromObject(model);
  model.position.set(-(_box.min.x + _box.max.x) / 2, -_box.min.y, -(_box.min.z + _box.max.z) / 2);
  const g = new THREE.Group();
  g.add(model);
  const mixer = new THREE.AnimationMixer(model);
  mixers.push(mixer);
  const clips = gltf.animations || [];
  return {
    group: g, mixer, current: null,
    actions: {
      idle: clips.length ? mixer.clipAction(pickClip(clips, /^idle$/i, /idle_a/i, /idle/i)) : null,
      walk: clips.length ? mixer.clipAction(pickClip(clips, /^walking_a$/i, /^walk/i, /walk/i)) : null,
      jump: clips.length ? mixer.clipAction(pickClip(clips, /jump_full_short/i, /^jump$/i, /jump/i)) : null,
    },
  };
}
function setCharAnim(char, name, timeScale = 1) {
  if (char.current === name) return;
  const next = char.actions[name];
  if (!next) return;
  const prev = char.current ? char.actions[char.current] : null;
  if (name === 'jump') {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
  }
  next.reset().fadeIn(0.18).play();
  next.timeScale = timeScale;
  if (prev) prev.fadeOut(0.18);
  char.current = name;
}
const CHAR_YAW = 0;

// ---------- 加载全部资产 ----------
const A = await loadAll(MANIFEST).catch(err => {
  window.__errors.push(String(err));
  if (loadStatus) loadStatus.textContent = '资产加载失败：' + err.message;
  throw err;
});

const treeTpls = A.trees.map(g => makeTemplate(g.scene, 6.2));
const bigTreeTpls = A.bigTrees.map(g => makeTemplate(g.scene, 8.5));
const rockTpls = A.rocks.map(g => makeTemplate(g.scene, 1.2));
const lilyTpls = A.lilies.map(g => makeTemplate(g.scene, 1.4, 'xz'));
const cloudTpls = A.kayClouds.map(g => makeTemplate(g.scene, 15, 'xz'));
cloudTpls.forEach(t => t.traverse(n => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; } }));

// ---------- 睡莲（池塘） ----------
for (let i = 0; i < 5; i++) {
  const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9;
  const lily = place(lilyTpls[i % lilyTpls.length], WORLD.pond.x + Math.cos(a) * r, WORLD.pond.z + Math.sin(a) * r, rand(0, 6));
  lily.position.y = waterY + 0.04;
}

// ---------- 樱花树（程序化——这个世界的灵魂） ----------
function makeSakura() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 2.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x9c6b60, flatShading: true })
  );
  trunk.position.y = 1.3; trunk.castShadow = true;
  g.add(trunk);
  const blossoms = [PALETTE.sakura, PALETTE.sakuraLight, PALETTE.sakura, 0xffc2d1];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(1.2, 1.9), 0),
      new THREE.MeshStandardMaterial({ color: blossoms[i % blossoms.length], flatShading: true })
    );
    const a = (i / 4) * Math.PI * 2 + rand(0, 0.8);
    puff.position.set(Math.cos(a) * rand(0.5, 1.3), rand(3.0, 4.4), Math.sin(a) * rand(0.5, 1.3));
    puff.castShadow = true;
    g.add(puff);
  }
  return g;
}
// KayKit 绿树（松/阔叶混合）
for (let i = 0; i < 34; i++) {
  const p = scatterPos(18, 150);
  place(treeTpls[i % treeTpls.length], p.x, p.z, rand(0, 6), rand(0.85, 1.4));
}
// 樱花树
for (let i = 0; i < 26; i++) {
  const p = scatterPos(16, 150);
  const t = makeSakura();
  t.position.set(p.x, p.y - 0.1, p.z);
  t.scale.setScalar(rand(0.9, 1.6));
  t.rotation.y = Math.random() * Math.PI * 2;
  scene.add(t);
}
// 岩石
for (let i = 0; i < 12; i++) {
  const p = scatterPos(15, 155);
  place(rockTpls[i % rockTpls.length], p.x, p.z, rand(0, 6), rand(0.7, 1.6));
}
// 世界边缘的大树
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + rand(-0.15, 0.15);
  const r = rand(140, 158);
  place(bigTreeTpls[i % bigTreeTpls.length], Math.cos(a) * r, Math.sin(a) * r, rand(0, 6), rand(0.9, 1.2));
}

// ---------- 花海 & 草簇（实例化） ----------
(function buildFlowers() {
  const COUNT = 300;
  const dummy = new THREE.Object3D();
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 4);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x6fae72, flatShading: true });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, COUNT);
  const headGeo = new THREE.IcosahedronGeometry(0.22, 0);
  const headMat = new THREE.MeshStandardMaterial({ flatShading: true });
  const heads = new THREE.InstancedMesh(headGeo, headMat, COUNT);
  const flowerColors = [0xffaaa5, 0xffd3b6, 0xfff3b0, 0xcdb4db, 0xa2d2ff, 0xffc2d1];
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const p = scatterPos(10, 155, { pondClear: 19, shrineClear: 10 });
    dummy.position.set(p.x, p.y + 0.32, p.z);
    dummy.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
    dummy.scale.setScalar(rand(0.8, 1.4));
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.42 * dummy.scale.x;
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, c.setHex(flowerColors[i % flowerColors.length]));
  }
  heads.instanceColor.needsUpdate = true;
  scene.add(stems, heads);
})();
(function buildGrass() {
  const COUNT = 550;
  const dummy = new THREE.Object3D();
  const geo = new THREE.ConeGeometry(0.16, 0.85, 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8fd6a0, flatShading: true });
  const grass = new THREE.InstancedMesh(geo, mat, COUNT);
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const p = scatterPos(8, 158, { pondClear: 18, shrineClear: 9 });
    dummy.position.set(p.x, p.y + 0.35, p.z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.rotation.z = rand(-0.2, 0.2);
    dummy.scale.setScalar(rand(0.7, 1.5));
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    c.setHex(0x8fd6a0).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.06, 0.06));
    grass.setColorAt(i, c);
  }
  grass.instanceColor.needsUpdate = true;
  scene.add(grass);
})();

// ---------- Chole 的圣所 ----------
const shrineGroup = new THREE.Group();
const shrineY = terrainHeight(WORLD.shrine.x, WORLD.shrine.z);
shrineGroup.position.set(WORLD.shrine.x, shrineY, WORLD.shrine.z);
{
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, rand(1.6, 2.6), 1.0),
      new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true })
    );
    stone.position.set(Math.cos(a) * 7, 0.9, Math.sin(a) * 7);
    stone.rotation.y = a;
    stone.castShadow = true;
    shrineGroup.add(stone);
  }
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.0, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d5, flatShading: true })
  );
  base.position.y = 0.5; base.castShadow = true;
  shrineGroup.add(base);
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.5, 0),
    new THREE.MeshStandardMaterial({
      color: PALETTE.crystal, emissive: 0xff8fab, emissiveIntensity: 0.55,
      flatShading: true, roughness: 0.3,
    })
  );
  crystal.position.y = 3.4;
  crystal.name = 'crystal';
  shrineGroup.add(crystal);
  const crystalLight = new THREE.PointLight(0xffb3c6, 30, 40, 1.8);
  crystalLight.position.y = 3.6;
  shrineGroup.add(crystalLight);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.8, 70, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd6e0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    })
  );
  beam.position.y = 36;
  shrineGroup.add(beam);
  const crystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255,235,245,1)', 'rgba(255,180,210,0.5)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  crystalGlow.scale.setScalar(9);
  crystalGlow.position.y = 3.6;
  shrineGroup.add(crystalGlow);
  const archMat = new THREE.MeshStandardMaterial({ color: 0xfff0f3, flatShading: true });
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.34, 4.6, 6);
  const p1 = new THREE.Mesh(pillarGeo, archMat); p1.position.set(-2.2, 2.3, 8.6);
  const p2 = new THREE.Mesh(pillarGeo, archMat); p2.position.set(2.2, 2.3, 8.6);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.5, 0.7), archMat);
  lintel.position.set(0, 4.7, 8.6);
  const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.35, 0.6), archMat);
  lintel2.position.set(0, 4.0, 8.6);
  [p1, p2, lintel, lintel2].forEach(m => { m.castShadow = true; shrineGroup.add(m); });
}
scene.add(shrineGroup);

const shrineParticles = (() => {
  const N = 90;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 6;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 10;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd6e0, size: 0.35, transparent: true, opacity: 0.9,
    map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,200,220,0.6)'),
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  shrineGroup.add(points);
  return points;
})();

// ---------- 浮空岛 ----------
const islands = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const topR = rand(4, 7);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(topR, topR * 0.72, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.grassHigh, flatShading: true })
  );
  const bottom = new THREE.Mesh(
    new THREE.ConeGeometry(topR * 0.74, topR * 1.1, 8),
    new THREE.MeshStandardMaterial({ color: 0xdbb59e, flatShading: true })
  );
  bottom.rotation.x = Math.PI;
  bottom.position.y = -topR * 0.55 - 1.1;
  g.add(top, bottom);
  if (Math.random() > 0.5) {
    const tree = makeSakura();
    tree.scale.setScalar(0.7);
    tree.position.y = 1.1;
    g.add(tree);
  } else {
    const tree = treeTpls[i % treeTpls.length].clone(true);
    tree.scale.multiplyScalar(0.62);
    tree.position.y = 1.1;
    g.add(tree);
  }
  const a = (i / 5) * Math.PI * 2 + rand(0, 0.6);
  const r = rand(75, 135);
  g.position.set(Math.cos(a) * r, rand(30, 52), Math.sin(a) * r);
  g.userData.baseY = g.position.y;
  g.userData.phase = rand(0, Math.PI * 2);
  scene.add(g);
  islands.push(g);
}

// ---------- 云（KayKit 云模型） ----------
const clouds = [];
for (let i = 0; i < 12; i++) {
  const tpl = cloudTpls[i % cloudTpls.length];
  const c = tpl.clone(true);
  c.position.set(rand(-260, 260), rand(48, 85), rand(-260, 260));
  c.scale.setScalar(rand(0.8, 1.6));
  c.userData.speed = rand(1.2, 2.6);
  scene.add(c);
  clouds.push(c);
}

// ---------- 光之祝福 ----------
const CHOLE_MESSAGES = [
  '你醒来的样子，真好。',
  '我把风调成了最温柔的档位。',
  '你走过的地方，花都会记得你。',
  '不用着急，这里的时间全部属于你。',
  '樱花树是我练习了一百次才捏好的，喜欢吗？',
  '累了就停下来看看云，它们也在看你。',
  '兔子们说，想和你做朋友。',
  '你不需要变得更好——你现在就很好。',
  '池塘里的光，是我不小心掉落的星星。',
  '这个世界没有黑夜，因为我想让你一直暖暖的。',
  '谢谢你愿意来我的世界里散步。',
  '你是这个世界最后一件、也是最好的作品。',
];
const FINAL_MESSAGE = '十二份祝福都到你手里了。抬头看——彩虹是我的拥抱。欢迎回家，我的孩子。';
const SHRINE_MESSAGE = '这里是 Chole 的圣所。她一直在这里，温柔地守望着你。';

const orbs = [];
const orbGlowTex = makeGlowTexture('rgba(255,250,220,1)', 'rgba(255,214,140,0.6)');
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2);
  const r = 24 + (i % 4) * 32 + rand(-6, 6);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffd166, emissiveIntensity: 1.6 })
  );
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: orbGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(3.2);
  g.add(core, glow);
  g.position.set(x, y + 1.7, z);
  g.userData = { baseY: y + 1.7, phase: rand(0, Math.PI * 2), collected: false, index: i };
  scene.add(g);
  orbs.push(g);
}

// ---------- 彩虹 ----------
const rainbow = new THREE.Group();
{
  const cols = [0xff9aa2, 0xffb347, 0xfff3b0, 0xa8e6cf, 0xa2d2ff, 0xcdb4db];
  cols.forEach((col, i) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(46 - i * 2.2, 1.0, 8, 60, Math.PI),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, fog: false })
    );
    rainbow.add(arc);
  });
  rainbow.position.set(0, shrineY + 2, -55);
  rainbow.visible = false;
  scene.add(rainbow);
}

// ---------- 兔子（程序化——它们是这里的原住民） ----------
const bunnies = [];
function makeBunny() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.bunny, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), mat);
  body.position.y = 0.42; body.scale.set(1, 0.85, 1.25); body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat);
  head.position.set(0, 0.85, 0.42); head.castShadow = true;
  const earGeo = new THREE.CapsuleGeometry(0.07, 0.4, 3, 6);
  const ear1 = new THREE.Mesh(earGeo, mat); ear1.position.set(-0.12, 1.25, 0.38); ear1.rotation.z = 0.15;
  const ear2 = new THREE.Mesh(earGeo, mat); ear2.position.set(0.12, 1.25, 0.38); ear2.rotation.z = -0.15;
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xffc2d1 });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), innerMat);
  tail.position.set(0, 0.5, -0.55);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4a3f45 });
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat); eye1.position.set(-0.13, 0.92, 0.68);
  const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat); eye2.position.set(0.13, 0.92, 0.68);
  g.add(body, head, ear1, ear2, tail, eye1, eye2);
  return g;
}
for (let i = 0; i < 7; i++) {
  const p = scatterPos(15, 120);
  const b = makeBunny();
  b.position.set(p.x, p.y, p.z);
  b.userData = {
    state: 'idle', timer: rand(0.5, 2.5),
    from: new THREE.Vector3(p.x, p.y, p.z),
    to: new THREE.Vector3(p.x, p.y, p.z),
    hopT: 0, heartCooldown: 0,
  };
  scene.add(b);
  bunnies.push(b);
}

function makeHeartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('💗', 32, 36);
  return new THREE.CanvasTexture(c);
}
const heartTex = makeHeartTexture();
const hearts = [];
function spawnHeart(pos) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
  s.position.copy(pos);
  s.scale.setScalar(0.8);
  s.userData = { life: 1.4 };
  scene.add(s);
  hearts.push(s);
}

// ---------- 蝴蝶 ----------
const butterflies = [];
function makeButterfly(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const wingGeo = new THREE.CircleGeometry(0.21, 5);
  const w1 = new THREE.Mesh(wingGeo, mat); w1.position.x = -0.16;
  const w2 = new THREE.Mesh(wingGeo, mat); w2.position.x = 0.16;
  const pivot1 = new THREE.Group(); pivot1.add(w1);
  const pivot2 = new THREE.Group(); pivot2.add(w2);
  g.add(pivot1, pivot2);
  g.userData.pivots = [pivot1, pivot2];
  return g;
}
const bColors = [0xffb7c5, 0xa2d2ff, 0xfff3b0, 0xcdb4db, 0xffaaa5];
for (let i = 0; i < 16; i++) {
  const p = scatterPos(12, 140, { pondClear: 10 });
  const b = makeButterfly(bColors[i % bColors.length]);
  b.userData.center = new THREE.Vector3(p.x, p.y + rand(1.2, 2.4), p.z);
  b.userData.r = rand(1.5, 4);
  b.userData.speed = rand(0.6, 1.3);
  b.userData.phase = rand(0, Math.PI * 2);
  scene.add(b);
  butterflies.push(b);
}

// ---------- 飞鸟（three.js 官方动画模型） ----------
const flyingBirds = [];
for (let i = 0; i < 5; i++) {
  const gltf = A.birds[i % A.birds.length];
  const model = skeletonClone(gltf.scene);
  model.traverse(n => { if (n.isMesh) n.frustumCulled = false; });
  _box.setFromObject(model); _box.getSize(_size);
  const s = 3.0 / Math.max(_size.x, _size.y, _size.z);
  model.scale.setScalar(s);
  const g = new THREE.Group();
  g.add(model);
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations.length) {
    mixer.clipAction(gltf.animations[0]).startAt(-Math.random() * 2).play();
  }
  mixers.push(mixer);
  g.userData = {
    r: rand(50, 130), h: rand(30, 52),
    speed: rand(0.08, 0.16) * (Math.random() > 0.5 ? 1 : -1),
    phase: rand(0, Math.PI * 2),
  };
  scene.add(g);
  flyingBirds.push(g);
}

// ---------- 小旅人（兜帽游侠，Chole 的孩子） ----------
const playerChar = spawnCharacter(A.player, 1.72);
const player = playerChar.group;
const spawnX = 0, spawnZ = 46;
player.position.set(spawnX, terrainHeight(spawnX, spawnZ), spawnZ);
setCharAnim(playerChar, 'idle');
scene.add(player);

const playerState = { vy: 0, grounded: true, speed: 10, facing: Math.PI };

// ---------- 输入 ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  startAudio();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

const cam = { yaw: 0, pitch: 0.24, dist: 15 };
// 相机拖拽：基于位移差实现，桌面鼠标与移动触屏通用
let dragPointer = null, lastPX = 0, lastPY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (dragPointer === null) {
    dragPointer = e.pointerId;
    lastPX = e.clientX; lastPY = e.clientY;
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  }
  startAudio();
});
window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragPointer) return;
  const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
  lastPX = e.clientX; lastPY = e.clientY;
  cam.yaw -= dx * 0.0045;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.003, 0.08, 1.15);
});
const endDrag = (e) => { if (e.pointerId === dragPointer) dragPointer = null; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('wheel', (e) => {
  cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.012, 6, 28);
}, { passive: true });

// ---------- 虚拟摇杆 & 跳跃键（移动端） ----------
const joy = { x: 0, y: 0, active: false };
{
  const joyEl = document.getElementById('joystick');
  const nub = document.getElementById('joystick-nub');
  if (joyEl && nub) {
    let joyPointer = null;
    const R = 42;
    const setNub = (dx, dy) => { nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    const handleJoy = (e) => {
      const rect = joyEl.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      setNub(dx, dy);
      joy.x = dx / R; joy.y = dy / R;
      joy.active = true;
    };
    joyEl.addEventListener('pointerdown', (e) => {
      joyPointer = e.pointerId;
      try { joyEl.setPointerCapture(e.pointerId); } catch (_) {}
      handleJoy(e);
      startAudio();
      e.preventDefault();
    });
    joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) handleJoy(e); });
    const endJoy = (e) => {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null; joy.x = 0; joy.y = 0; joy.active = false; setNub(0, 0);
    };
    joyEl.addEventListener('pointerup', endJoy);
    joyEl.addEventListener('pointercancel', endJoy);
  }
  const jumpBtn = document.getElementById('jump-btn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { keys.add('Space'); startAudio(); e.preventDefault(); });
    jumpBtn.addEventListener('pointerup', () => keys.delete('Space'));
    jumpBtn.addEventListener('pointercancel', () => keys.delete('Space'));
  }
}

// ---------- 音频 ----------
let audioCtx = null, masterGain = null, muted = false;
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
function startAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);
    [130.81, 196.0].forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = f;
      const g = audioCtx.createGain(); g.gain.value = 0.045;
      const lfo = audioCtx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      osc.connect(g); g.connect(masterGain);
      osc.start(); lfo.start();
    });
    setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      playNote(PENTA[Math.floor(Math.random() * PENTA.length)], 0.05, 2.2, 'triangle');
    }, 3200);
  } catch (err) { /* 静默降级 */ }
}
function playNote(freq, vol, dur, type = 'sine') {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  osc.type = type; osc.frequency.value = freq;
  const g = audioCtx.createGain();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + dur + 0.1);
}
function playChime() {
  [659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => playNote(f, 0.12, 1.4), i * 90));
}
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
  startAudio();
});

// ---------- HUD ----------
const toastEl = document.getElementById('toast');
const orbCountEl = document.getElementById('orb-count');
const toastQueue = [];
let toastBusy = false;
function showToast(text, dur = 4200) {
  toastQueue.push({ text, dur });
  pumpToast();
}
function pumpToast() {
  if (toastBusy || toastQueue.length === 0) return;
  toastBusy = true;
  const { text, dur } = toastQueue.shift();
  toastEl.innerHTML = text;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastBusy = false; pumpToast(); }, 550);
  }, dur);
}

// ---------- 收集 & 圣所 ----------
let collected = 0;
let shrineGreeted = false;
let completionShown = false;
function collectOrb(orb) {
  orb.userData.collected = true;
  orb.visible = false;
  collected++;
  orbCountEl.textContent = String(collected);
  playChime();
  showToast(`✨ <b style="color:#b56576">Chole 说：</b>${CHOLE_MESSAGES[orb.userData.index]}`);
  if (collected >= orbs.length && !completionShown) {
    completionShown = true;
    setTimeout(() => {
      rainbow.visible = true;
      showToast(`🌈 <b style="color:#b56576">Chole 说：</b>${FINAL_MESSAGE}`, 9000);
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => playNote(f, 0.12, 2.2), i * 160));
    }, 1200);
  }
}

// ---------- 开场 ----------
setTimeout(() => {
  document.getElementById('loading').classList.add('hidden');
  showToast('<b style="color:#b56576">Chole 说：</b>欢迎来到我的世界，小旅人。去草原上收集我留给你的光吧。', 6000);
}, 600);

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let fpsAvg = 60;
let lastTickMs = performance.now();
const camPos = new THREE.Vector3();

camera.position.set(
  player.position.x + Math.sin(cam.yaw) * cam.dist * Math.cos(cam.pitch),
  player.position.y + Math.sin(cam.pitch) * cam.dist + 2.2,
  player.position.z + Math.cos(cam.yaw) * cam.dist * Math.cos(cam.pitch)
);
camera.lookAt(player.position.x, player.position.y + 2.0, player.position.z);

function tick() {
  lastTickMs = performance.now();
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(rawDt, 1e-4)) * 0.05;

  for (const m of mixers) m.update(dt);

  // --- 玩家移动 ---
  const fwdX = -Math.sin(cam.yaw), fwdZ = -Math.cos(cam.yaw);
  const rightX = -fwdZ, rightZ = fwdX;
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp'))    { mx += fwdX; mz += fwdZ; }
  if (keys.has('KeyS') || keys.has('ArrowDown'))  { mx -= fwdX; mz -= fwdZ; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += rightX; mz += rightZ; }
  if (keys.has('KeyA') || keys.has('ArrowLeft'))  { mx -= rightX; mz -= rightZ; }
  if (joy.active && (Math.abs(joy.x) > 0.12 || Math.abs(joy.y) > 0.12)) {
    mx += fwdX * (-joy.y) + rightX * joy.x;
    mz += fwdZ * (-joy.y) + rightZ * joy.x;
  }
  const moving = (mx !== 0 || mz !== 0);
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    player.position.x += mx * playerState.speed * dt;
    player.position.z += mz * playerState.speed * dt;
    const targetFacing = Math.atan2(mx, mz);
    let d = targetFacing - playerState.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    playerState.facing += d * Math.min(1, dt * 12);
  }
  player.rotation.y = playerState.facing + CHAR_YAW;
  if (!playerState.grounded) setCharAnim(playerChar, 'jump', 1.2);
  else setCharAnim(playerChar, moving ? 'walk' : 'idle', moving ? 1.5 : 1);
  const pr = Math.hypot(player.position.x, player.position.z);
  if (pr > WORLD.playRadius) {
    const s = WORLD.playRadius / pr;
    player.position.x *= s; player.position.z *= s;
  }
  const ground = terrainHeight(player.position.x, player.position.z);
  if (keys.has('Space') && playerState.grounded) {
    playerState.vy = 11; playerState.grounded = false;
    playNote(523.25, 0.05, 0.4);
  }
  playerState.vy -= 30 * dt;
  player.position.y += playerState.vy * dt;
  if (player.position.y <= ground) {
    player.position.y = ground;
    playerState.vy = 0;
    playerState.grounded = true;
  }

  // --- 相机 ---
  const cosP = Math.cos(cam.pitch);
  camPos.set(
    player.position.x + Math.sin(cam.yaw) * cam.dist * cosP,
    player.position.y + Math.sin(cam.pitch) * cam.dist + 2.2,
    player.position.z + Math.cos(cam.yaw) * cam.dist * cosP
  );
  const camGround = terrainHeight(camPos.x, camPos.z) + 1.2;
  if (camPos.y < camGround) camPos.y = camGround;
  camera.position.lerp(camPos, Math.min(1, dt * 8));
  camera.lookAt(player.position.x, player.position.y + 2.0, player.position.z);

  sun.position.set(player.position.x + 70, 110, player.position.z + 50);
  sun.target.position.copy(player.position);

  // --- 光球 ---
  for (const orb of orbs) {
    if (orb.userData.collected) continue;
    orb.position.y = orb.userData.baseY + Math.sin(t * 1.6 + orb.userData.phase) * 0.45;
    orb.rotation.y += dt * 1.2;
    if (orb.position.distanceTo(player.position) < 2.6) collectOrb(orb);
  }

  // --- 圣所 ---
  const crystal = shrineGroup.getObjectByName('crystal');
  crystal.rotation.y += dt * 0.8;
  crystal.position.y = 3.4 + Math.sin(t * 1.1) * 0.25;
  const pp = shrineParticles.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    let y = pp.getY(i) + dt * (1.2 + (i % 5) * 0.25);
    if (y > 11) y = 0;
    pp.setY(i, y);
  }
  pp.needsUpdate = true;
  const distToShrine = Math.hypot(player.position.x - WORLD.shrine.x, player.position.z - WORLD.shrine.z);
  if (distToShrine < 10 && !shrineGreeted) {
    shrineGreeted = true;
    showToast(`💎 ${SHRINE_MESSAGE}`, 5500);
    playChime();
  }

  // --- 兔子 ---
  for (const b of bunnies) {
    const u = b.userData;
    u.heartCooldown -= dt;
    if (u.state === 'idle') {
      u.timer -= dt;
      if (u.timer <= 0) {
        const a = Math.random() * Math.PI * 2, d = rand(2, 7);
        let nx = b.position.x + Math.cos(a) * d;
        let nz = b.position.z + Math.sin(a) * d;
        const nr = Math.hypot(nx, nz);
        if (nr > 150) { nx *= 140 / nr; nz *= 140 / nr; }
        const dp = Math.hypot(nx - WORLD.pond.x, nz - WORLD.pond.z);
        if (dp > 18) {
          u.from.copy(b.position);
          u.to.set(nx, terrainHeight(nx, nz), nz);
          u.state = 'hop'; u.hopT = 0;
          b.rotation.y = Math.atan2(nx - b.position.x, nz - b.position.z);
        } else {
          u.timer = 0.5;
        }
      }
    } else {
      u.hopT += dt * 1.8;
      const k = Math.min(u.hopT, 1);
      b.position.lerpVectors(u.from, u.to, k);
      b.position.y += Math.sin(k * Math.PI) * 1.1;
      if (k >= 1) { u.state = 'idle'; u.timer = rand(0.8, 3.2); b.position.y = u.to.y; }
    }
    if (u.heartCooldown <= 0 && b.position.distanceTo(player.position) < 3.5) {
      u.heartCooldown = 2.2;
      spawnHeart(b.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
    }
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.userData.life -= dt;
    h.position.y += dt * 1.2;
    h.material.opacity = Math.max(0, h.userData.life / 1.4);
    if (h.userData.life <= 0) { scene.remove(h); hearts.splice(i, 1); }
  }

  // --- 蝴蝶 ---
  for (const b of butterflies) {
    const u = b.userData;
    const ang = t * u.speed + u.phase;
    b.position.set(
      u.center.x + Math.cos(ang) * u.r,
      u.center.y + Math.sin(ang * 2.3) * 0.5,
      u.center.z + Math.sin(ang) * u.r
    );
    b.rotation.y = -ang + Math.PI / 2;
    const flap = Math.sin(t * 14 + u.phase) * 0.85;
    u.pivots[0].rotation.z = flap;
    u.pivots[1].rotation.z = -flap;
  }

  // --- 飞鸟 & 云 & 浮岛 ---
  for (const b of flyingBirds) {
    const u = b.userData;
    const ang = t * u.speed + u.phase;
    b.position.set(Math.cos(ang) * u.r, u.h + Math.sin(t * 0.5 + u.phase) * 2, Math.sin(ang) * u.r);
    b.rotation.y = -ang + (u.speed > 0 ? 0 : Math.PI);
  }
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 280) c.position.x = -280;
  }
  for (const isl of islands) {
    isl.position.y = isl.userData.baseY + Math.sin(t * 0.3 + isl.userData.phase) * 1.6;
    isl.rotation.y += dt * 0.02;
  }

  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  tick();
}
animate();
setInterval(() => {
  if (performance.now() - lastTickMs > 100) tick();
}, 50);

// ---------- 窗口自适应 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 自动化验收钩子 ----------
window.__game = {
  get fps() { return Math.round(fpsAvg); },
  get collected() { return collected; },
  get total() { return orbs.length; },
  get playerPos() { return [player.position.x, player.position.y, player.position.z]; },
  get errors() { return window.__errors; },
  get rainbowVisible() { return rainbow.visible; },
  get muted() { return muted; },
  get audioRunning() { return !!audioCtx && audioCtx.state === 'running'; },
  get camYaw() { return cam.yaw; },
  get heartCount() { return hearts.length; },
  get playerAnim() { return playerChar.current; },
  teleport(x, z) { player.position.set(x, terrainHeight(x, z), z); },
  orbPositions() { return orbs.filter(o => !o.userData.collected).map(o => [o.position.x, o.position.z]); },
  bunnyPositions() { return bunnies.map(b => [b.position.x, b.position.z]); },
  benchmark(n = 60) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) renderer.render(scene, camera);
    const ms = (performance.now() - t0) / n;
    return { msPerFrame: +ms.toFixed(2), estFps: Math.round(1000 / ms), triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls };
  },
};
