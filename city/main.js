import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { clone as skeletonClone } from './lib/SkeletonUtils.js';

/* ============================================================
   《Chole 之城》— 造物主 Chole 的云上糖果色小城
   完整美术版：KayKit CC0 资产（建筑/车辆/树木/角色）
   + three.js 官方动画飞鸟
   ============================================================ */

// ---------- 错误捕获（供自动化验收） ----------
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason)));

// ---------- 调色板 ----------
const PALETTE = {
  skyTop:    0x8ec9f2,
  skyMid:    0xdcc6ec,
  skyHorizon:0xffddc1,
  fog:       0xffe0cc,
  grass:     0x9ed9a8,
  road:      0xa89ba3,
  sidewalk:  0xe8ddcf,
  plaza:     0xf2e8dc,
  crystal:   0xffc8dd,
};

const CITY = {
  playRadius: 118,
  roads: [-72, -28, 28, 72],
  roadHalf: 3.5,
  plazaR: 24,
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
scene.fog = new THREE.Fog(PALETTE.fog, 100, 480);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);

// ---------- 光照 ----------
const hemi = new THREE.HemisphereLight(0xbde0fe, 0xffd9a0, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 1.55);
sun.position.set(70, 110, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;   sun.shadow.camera.bottom = -160;
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
cloudSea.position.y = -26;
scene.add(cloudSea);

// ---------- 地形 ----------
function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 0;
  h -= THREE.MathUtils.smoothstep(r, 122, 190) * 45;
  h += Math.sin(x * 0.05) * Math.cos(z * 0.05) * THREE.MathUtils.smoothstep(r, 110, 130) * 1.2;
  return h;
}

(function buildTerrain() {
  const seg = 120;
  const geo = new THREE.PlaneGeometry(420, 420, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(PALETTE.grass);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    tmp.copy(cGrass);
    const n = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    tmp.offsetHSL(0, 0, (n - 0.5) * 0.03);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);
})();

// ---------- 道路 & 人行道 & 广场 ----------
const ROAD_LEN = 200;
const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.9 });
const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 0.9 });
for (const c of CITY.roads) {
  const rx = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LEN, 0.1, CITY.roadHalf * 2), roadMat);
  rx.position.set(0, 0.02, c); rx.receiveShadow = true; scene.add(rx);
  const rz = new THREE.Mesh(new THREE.BoxGeometry(CITY.roadHalf * 2, 0.1, ROAD_LEN), roadMat);
  rz.position.set(c, 0.03, 0); rz.receiveShadow = true; scene.add(rz);
  for (const off of [-CITY.roadHalf - 1.1, CITY.roadHalf + 1.1]) {
    const sx = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LEN, 0.12, 2.0), sideMat);
    sx.position.set(0, 0.025, c + off); sx.receiveShadow = true; scene.add(sx);
    const sz = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, ROAD_LEN), sideMat);
    sz.position.set(c + off, 0.035, 0); sz.receiveShadow = true; scene.add(sz);
  }
}
const plaza = new THREE.Mesh(
  new THREE.CylinderGeometry(CITY.plazaR, CITY.plazaR, 0.16, 48),
  new THREE.MeshStandardMaterial({ color: PALETTE.plaza, roughness: 0.85 })
);
plaza.position.y = 0.08; plaza.receiveShadow = true;
scene.add(plaza);

// ---------- 碰撞体 ----------
const obstacles = []; // {x, z, r}
const rand = (a, b) => a + Math.random() * (b - a);

// ============================================================
//  美术资产加载（KayKit CC0 + three.js 官方示例模型）
// ============================================================
const loadStatus = document.getElementById('load-status');
const gltfLoader = new GLTFLoader();
let loadedCount = 0, totalCount = 0;

function loadGLTF(url) {
  totalCount++;
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => {
      loadedCount++;
      if (loadStatus) loadStatus.textContent = `Chole 正在搬来她的模型… ${loadedCount} / ${totalCount}`;
      resolve(gltf);
    }, undefined, (err) => reject(new Error('load failed: ' + url)));
  });
}

const MANIFEST = {
  buildings: ['building_A','building_B','building_C','building_D','building_E','building_F','building_G','building_H'].map(n => `assets/city/${n}.gltf`),
  cars: ['car_sedan','car_hatchback','car_stationwagon','car_taxi'].map(n => `assets/city/${n}.gltf`),
  streetlight: 'assets/city/streetlight.gltf',
  bench: 'assets/city/bench.gltf',
  bush: 'assets/city/bush.gltf',
  firehydrant: 'assets/city/firehydrant.gltf',
  watertower: 'assets/city/watertower.gltf',
  trees: ['tree_single_A','tree_single_B','trees_A_small','trees_A_medium','trees_B_small','trees_B_medium'].map(n => `assets/nature/${n}.gltf`),
  bigTrees: ['trees_A_large','trees_A_medium','trees_B_medium'].map(n => `assets/nature/${n}.gltf`),
  rocks: ['rock_single_A','rock_single_B','rock_single_C'].map(n => `assets/nature/${n}.gltf`),
  lilies: ['waterlily_A','waterlily_B'].map(n => `assets/nature/${n}.gltf`),
  kayClouds: ['cloud_big','cloud_small'].map(n => `assets/nature/${n}.gltf`),
  player: 'assets/chars/Rogue_Hooded.glb',
  shiba: 'assets/chars/Shiba.glb',
  villagers: ['Knight','Mage','Rogue','Barbarian'].map(n => `assets/chars/${n}.glb`),
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

// —— 模板工具：归一化尺寸、贴地、居中，返回可克隆的包装组 ——
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

// —— 角色工厂：骨骼克隆 + 动画 ——
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
  const char = {
    group: g, mixer, current: null,
    actions: {
      idle: clips.length ? mixer.clipAction(pickClip(clips, /^idle$/i, /idle_a/i, /idle/i)) : null,
      walk: clips.length ? mixer.clipAction(pickClip(clips, /^walking_a$/i, /^walk/i, /walk/i)) : null,
      jump: clips.length ? mixer.clipAction(pickClip(clips, /jump_full_short/i, /^jump$/i, /jump/i)) : null,
    },
  };
  return char;
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
const CHAR_YAW = 0; // KayKit 角色模型原生朝 +Z，与 atan2(mx,mz) 朝向一致

// ============================================================
//  异步初始化：加载资产 → 建造城市 → 启动主循环
// ============================================================
const A = await loadAll(MANIFEST).catch(err => {
  window.__errors.push(String(err));
  if (loadStatus) loadStatus.textContent = '资产加载失败：' + err.message;
  throw err;
});

// ---------- 模板 ----------
const buildingTpls = A.buildings.map(g => makeTemplate(g.scene, 10.5, 'xz'));
const carTpls = A.cars.map(g => {
  _box.setFromObject(g.scene); _box.getSize(_size);
  const tpl = makeTemplate(g.scene, 3.6, 'xz');
  tpl.userData.yawOffset = _size.x > _size.z ? Math.PI / 2 : 0;
  return tpl;
});
const lampTpl = makeTemplate(A.streetlight.scene, 4.4);
const benchTpl = makeTemplate(A.bench.scene, 2.3, 'xz');
const bushTpl = makeTemplate(A.bush.scene, 1.5, 'xz');
const hydrantTpl = makeTemplate(A.firehydrant.scene, 0.95);
const watertowerTpl = makeTemplate(A.watertower.scene, 13);
const treeTpls = A.trees.map(g => makeTemplate(g.scene, 6.2));
const bigTreeTpls = A.bigTrees.map(g => makeTemplate(g.scene, 8.5));
const rockTpls = A.rocks.map(g => makeTemplate(g.scene, 1.1));
const lilyTpls = A.lilies.map(g => makeTemplate(g.scene, 1.3, 'xz'));
const cloudTpls = A.kayClouds.map(g => makeTemplate(g.scene, 15, 'xz'));
cloudTpls.forEach(t => t.traverse(n => { if (n.isMesh) { n.castShadow = false; n.receiveShadow = false; } }));

// ---------- 建筑（8 街块 × 4 栋 + 城郊小屋） ----------
const PARK = { x: 50, z: 50 };
const blockCenters = [];
for (const bx of [-50, 0, 50]) {
  for (const bz of [-50, 0, 50]) {
    if (bx === 0 && bz === 0) continue;
    if (bx === PARK.x && bz === PARK.z) continue;
    blockCenters.push({ bx, bz });
  }
}
let bIdx = 0;
for (const { bx, bz } of blockCenters) {
  for (const ox of [-9.5, 9.5]) {
    for (const oz of [-9.5, 9.5]) {
      const x = bx + ox + rand(-0.8, 0.8);
      const z = bz + oz + rand(-0.8, 0.8);
      const tpl = buildingTpls[bIdx % buildingTpls.length]; bIdx++;
      // 面向最近的道路（90° 对齐）
      const dxs = CITY.roads.map(r => Math.abs(x - r));
      const dzs = CITY.roads.map(r => Math.abs(z - r));
      let rotY;
      if (Math.min(...dzs) <= Math.min(...dxs)) {
        const nearZ = CITY.roads.reduce((a, b) => Math.abs(z - a) < Math.abs(z - b) ? a : b);
        rotY = z < nearZ ? 0 : Math.PI;
      } else {
        const nearX = CITY.roads.reduce((a, b) => Math.abs(x - a) < Math.abs(x - b) ? a : b);
        rotY = x < nearX ? -Math.PI / 2 : Math.PI / 2;
      }
      const inst = place(tpl, x, z, rotY);
      const fp = Math.max(tpl.userData.size.x, tpl.userData.size.z);
      obstacles.push({ x, z, r: fp / 2 + 0.7 });
    }
  }
}
// 城郊小屋
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + rand(-0.15, 0.15);
  const r = rand(92, 106);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.min(...CITY.roads.map(c => Math.abs(x - c))) < 6) continue;
  if (Math.min(...CITY.roads.map(c => Math.abs(z - c))) < 6) continue;
  const tpl = buildingTpls[(i * 3 + 1) % buildingTpls.length];
  place(tpl, x, z, Math.atan2(-x, -z), 0.8);
  obstacles.push({ x, z, r: Math.max(tpl.userData.size.x, tpl.userData.size.z) * 0.4 + 0.7 });
}
// 水塔（西南街块的地标）
place(watertowerTpl, -38, -38, 0.4);
obstacles.push({ x: -38, z: -38, r: 3.2 });

// ---------- Chole 的钟楼 ----------
const towerGroup = new THREE.Group();
{
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xf5ede2, flatShading: true, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8b4bc, flatShading: true });
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 7), stoneMat);
  base.position.y = 1.5; base.castShadow = true;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 5), stoneMat);
  shaft.position.y = 11; shaft.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 6), trimMat);
  cap.position.y = 19.6;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4.5, 4), trimMat);
  spire.rotation.y = Math.PI / 4;
  spire.position.y = 22.4; spire.castShadow = true;
  towerGroup.add(base, shaft, cap, spire);
  // 装饰：横向线脚 + 四角壁柱，让钟楼与精细建筑同档次
  for (const ty of [3.6, 8.0, 12.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 5.5), trimMat);
    band.position.y = ty;
    towerGroup.add(band);
  }
  const pillarGeo = new THREE.BoxGeometry(0.7, 16, 0.7);
  for (const [px, pz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    const pillar = new THREE.Mesh(pillarGeo, trimMat);
    pillar.position.set(px, 11, pz);
    pillar.castShadow = true;
    towerGroup.add(pillar);
  }
  const balcony = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 6.2), trimMat);
  balcony.position.y = 13.2;
  towerGroup.add(balcony);
  const faceGeo = new THREE.CircleGeometry(1.7, 24);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xfffdf6, emissive: 0xfff3d6, emissiveIntensity: 0.35 });
  const handMat = new THREE.MeshBasicMaterial({ color: 0x7a5c68 });
  window.__clockHands = [];
  const sides = [
    { pos: [0, 15.5, 2.56], rot: [0, 0, 0] },
    { pos: [0, 15.5, -2.56], rot: [0, Math.PI, 0] },
    { pos: [2.56, 15.5, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [-2.56, 15.5, 0], rot: [0, -Math.PI / 2, 0] },
  ];
  for (const s of sides) {
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(...s.pos); face.rotation.set(...s.rot);
    towerGroup.add(face);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.02), handMat);
    hand.geometry.translate(0, 0.55, 0);
    const pivot = new THREE.Group();
    pivot.position.set(...s.pos); pivot.rotation.set(...s.rot);
    pivot.add(hand);
    towerGroup.add(pivot);
    window.__clockHands.push(pivot);
  }
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.3, 0),
    new THREE.MeshStandardMaterial({ color: PALETTE.crystal, emissive: 0xff8fab, emissiveIntensity: 0.6, flatShading: true })
  );
  crystal.position.y = 26.5;
  crystal.name = 'crystal';
  towerGroup.add(crystal);
  const crystalLight = new THREE.PointLight(0xffb3c6, 40, 60, 1.8);
  crystalLight.position.y = 26.5;
  towerGroup.add(crystalLight);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.8, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd6e0, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    })
  );
  beam.position.y = 56;
  towerGroup.add(beam);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255,235,245,1)', 'rgba(255,180,210,0.5)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(10);
  glow.position.y = 26.5;
  towerGroup.add(glow);
}
scene.add(towerGroup);
obstacles.push({ x: 0, z: 0, r: 4.6 });

// ---------- 喷泉 ----------
const fountainGroup = new THREE.Group();
fountainGroup.position.set(0, 0, 14);
{
  const stone = new THREE.MeshStandardMaterial({ color: 0xe8e0d5, flatShading: true });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 1.0, 12), stone);
  basin.position.y = 0.5; basin.castShadow = true;
  const waterDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.85, roughness: 0.15 })
  );
  waterDisc.rotation.x = -Math.PI / 2; waterDisc.position.y = 1.02;
  const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.6, 10), stone);
  tier.position.y = 1.6;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 0.5, 10), stone);
  bowl.position.y = 2.6;
  fountainGroup.add(basin, waterDisc, tier, bowl);
  const N = 60;
  const positions = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    seeds.push({ a: Math.random() * Math.PI * 2, t: Math.random() });
    positions[i * 3 + 1] = 2.8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const drops = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xcfeffd, size: 0.28, transparent: true, opacity: 0.9,
    map: makeGlowTexture('rgba(255,255,255,1)', 'rgba(190,230,250,0.7)'),
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  drops.userData.seeds = seeds;
  fountainGroup.add(drops);
  fountainGroup.userData.drops = drops;
}
scene.add(fountainGroup);
obstacles.push({ x: 0, z: 14, r: 4.4 });

// ---------- 路灯（KayKit 模型 + 暖光晕） ----------
const lampGlowTex = makeGlowTexture('rgba(255,244,214,1)', 'rgba(255,214,140,0.55)');
function addLamp(x, z, rotY = 0) {
  const inst = place(lampTpl, x, z, rotY);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lampGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(2.4);
  glow.position.y = lampTpl.userData.size.y * 0.94;
  inst.add(glow);
}
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  addLamp(Math.cos(a) * 20, Math.sin(a) * 20, -a + Math.PI / 2);
}
for (const c of CITY.roads) {
  for (let p = -84; p <= 84; p += 28) {
    if (Math.abs(p) < 26 && Math.abs(c) < 26) continue;
    addLamp(p, c + CITY.roadHalf + 1.1, Math.PI);
    addLamp(c - CITY.roadHalf - 1.1, p, Math.PI / 2);
  }
}

// ---------- 长椅 & 花坛 & 灌木 & 消防栓 ----------
addBenchAt(-10, 10, Math.PI / 4 + Math.PI);
addBenchAt(10, 10, -Math.PI / 4);
addBenchAt(-10, -12, Math.PI * 0.75 + Math.PI);
addBenchAt(10, -12, -Math.PI * 0.75);
function addBenchAt(x, z, rotY) {
  place(benchTpl, x, z, rotY);
}
function addFlowerBed(x, z) {
  const bed = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.8, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8cfc4, flatShading: true })
  );
  bed.position.set(x, 0.35, z);
  scene.add(bed);
  const cols = [0xffaaa5, 0xfff3b0, 0xcdb4db, 0xa2d2ff];
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 1.1;
    const f = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: cols[i % cols.length], flatShading: true })
    );
    f.position.set(x + Math.cos(a) * r, 0.75, z + Math.sin(a) * r);
    scene.add(f);
  }
  obstacles.push({ x, z, r: 2.0 });
}
addFlowerBed(-15, -2); addFlowerBed(15, -2);
// 广场外圈灌木
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  place(bushTpl, Math.cos(a) * 23.2, Math.sin(a) * 23.2, rand(0, 6), rand(0.8, 1.2));
}
// 街角消防栓
for (const [hx, hz] of [[-33, -22], [33, 22], [22, -33], [-22, 33]]) {
  place(hydrantTpl, hx, hz, rand(0, 6));
}

// ---------- 公园（KayKit 树木/岩石/睡莲） ----------
for (let i = 0; i < 11; i++) {
  let x, z;
  do {
    x = PARK.x + rand(-15, 15); z = PARK.z + rand(-15, 15);
  } while (Math.hypot(x - PARK.x, z - PARK.z) < 8);
  const tpl = treeTpls[i % treeTpls.length];
  place(tpl, x, z, rand(0, 6), rand(0.85, 1.25));
  obstacles.push({ x, z, r: 1.0 });
}
for (let i = 0; i < 6; i++) {
  const x = PARK.x + rand(-16, 16), z = PARK.z + rand(-16, 16);
  if (Math.hypot(x - PARK.x, z - PARK.z) < 7) continue;
  place(rockTpls[i % rockTpls.length], x, z, rand(0, 6), rand(0.7, 1.4));
}
const parkPond = new THREE.Mesh(
  new THREE.CircleGeometry(5.5, 24),
  new THREE.MeshStandardMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.85, roughness: 0.15 })
);
parkPond.rotation.x = -Math.PI / 2;
parkPond.position.set(PARK.x, 0.06, PARK.z);
scene.add(parkPond);
for (let i = 0; i < 4; i++) {
  const a = rand(0, Math.PI * 2), r = rand(1, 4);
  const lily = place(lilyTpls[i % lilyTpls.length], PARK.x + Math.cos(a) * r, PARK.z + Math.sin(a) * r, rand(0, 6));
  lily.position.y = 0.1;
}
// 公园花海（低多边形彩色花簇）
(function parkFlowers() {
  const COUNT = 90;
  const dummy = new THREE.Object3D();
  const headGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ flatShading: true }), COUNT);
  const cols = [0xffaaa5, 0xffd3b6, 0xfff3b0, 0xcdb4db, 0xa2d2ff];
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    let x, z;
    do {
      x = PARK.x + rand(-16, 16); z = PARK.z + rand(-16, 16);
    } while (Math.hypot(x - PARK.x, z - PARK.z) < 7);
    dummy.position.set(x, 0.35, z);
    dummy.scale.setScalar(rand(0.8, 1.5));
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, c.setHex(cols[i % cols.length]));
  }
  heads.instanceColor.needsUpdate = true;
  scene.add(heads);
})();
// 城外防风林
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + rand(-0.1, 0.1);
  const r = rand(100, 113);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.min(...CITY.roads.map(c => Math.abs(x - c))) < 5.5) continue;
  if (Math.min(...CITY.roads.map(c => Math.abs(z - c))) < 5.5) continue;
  place(bigTreeTpls[i % bigTreeTpls.length], x, z, rand(0, 6), rand(0.8, 1.2));
}

// ---------- 云（KayKit 云模型漂在城市上空） ----------
const clouds = [];
for (let i = 0; i < 10; i++) {
  const tpl = cloudTpls[i % cloudTpls.length];
  const c = tpl.clone(true);
  c.position.set(rand(-260, 260), rand(55, 90), rand(-260, 260));
  c.scale.setScalar(rand(0.8, 1.6));
  c.userData.speed = rand(1.2, 2.6);
  scene.add(c);
  clouds.push(c);
}

// ---------- 小车（KayKit 车辆，礼貌让行） ----------
const cars = [];
const carLoops = [
  [[-72, -28], [-28, -28], [-28, -72], [-72, -72]],
  [[28, -28], [72, -28], [72, -72], [28, -72]],
  [[-72, 72], [-28, 72], [-28, 28], [-72, 28]],
  [[-28, 28], [-28, -28], [28, -28], [28, 28]],
  [[-72, 28], [-72, -28], [-28, -28], [-28, 28]],
  [[28, 72], [28, 28], [72, 28], [72, 72]],
];
for (let i = 0; i < 8; i++) {
  const tpl = carTpls[i % carTpls.length];
  const car = tpl.clone(true);
  const loop = carLoops[i % carLoops.length].map(([x, z]) => new THREE.Vector3(x + 1.8, 0, z + 1.8));
  const wp = i % loop.length;
  car.position.copy(loop[wp]);
  car.userData = { ...car.userData, loop, wp, speed: 0, cruise: rand(5, 7.5), yawOffset: tpl.userData.yawOffset };
  scene.add(car);
  cars.push(car);
}

// ---------- 居民（KayKit 冒险者，散步 + 冒爱心） ----------
const villagers = [];
const sidewalkOff = CITY.roadHalf + 1.1;
const villagerLoops = [
  [[-72, -28], [-28, -28], [-28, -72], [-72, -72]],
  [[28, 28], [72, 28], [72, 72], [28, 72]],
  [[-28, 28], [-28, -28], [28, -28], [28, 28]],
  [[28, -28], [72, -28], [72, -72], [28, -72]],
];
for (let i = 0; i < 8; i++) {
  const gltf = A.villagers[i % A.villagers.length];
  const char = spawnCharacter(gltf, 1.7);
  const v = char.group;
  const loop = villagerLoops[i % villagerLoops.length].map(([x, z]) => new THREE.Vector3(x + sidewalkOff + (i % 2) * 1.2, 0.1, z + sidewalkOff));
  const wp = (i * 3 + Math.floor(i / 4)) % loop.length;
  v.position.copy(loop[wp]);
  v.userData = { loop, wp: (wp + 1) % loop.length, speed: rand(1.3, 2.3), heartCooldown: 0, char };
  setCharAnim(char, 'walk', rand(0.9, 1.1));
  scene.add(v);
  villagers.push(v);
}

// 爱心
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

// ---------- 广场鸽（程序化，小而可爱） ----------
const pigeons = [];
function makePigeon() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd7d3e8, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  body.position.y = 0.2; body.scale.set(1, 0.9, 1.3);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
  head.position.set(0, 0.42, 0.22);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0xe0a458 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.42, 0.36);
  g.add(body, head, beak);
  return g;
}
for (let i = 0; i < 5; i++) {
  const p = makePigeon();
  const a = Math.random() * Math.PI * 2, r = rand(4, 17);
  p.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r + 2);
  p.userData = { state: 'idle', timer: rand(0.5, 2), from: p.position.clone(), to: p.position.clone(), hopT: 0 };
  scene.add(p);
  pigeons.push(p);
}

// ---------- 飞鸟（three.js 官方动画模型，绕城飞翔） ----------
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
    const act = mixer.clipAction(gltf.animations[0]);
    act.startAt(-Math.random() * 2).play();
  }
  mixers.push(mixer);
  g.userData = {
    r: rand(45, 95), h: rand(30, 52),
    speed: rand(0.08, 0.16) * (Math.random() > 0.5 ? 1 : -1),
    phase: rand(0, Math.PI * 2),
  };
  scene.add(g);
  flyingBirds.push(g);
}

// ---------- 热气球 ----------
const balloons = [];
const B_COLORS = [0xffaaa5, 0xa2d2ff, 0xfff3b0, 0xcdb4db];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 10, 8),
    new THREE.MeshStandardMaterial({ color: B_COLORS[i], flatShading: true })
  );
  envelope.scale.y = 1.15;
  const basket = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.0, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xc9976b, flatShading: true })
  );
  basket.position.y = -4.6;
  for (const [rx, rz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.8, 3),
      new THREE.MeshStandardMaterial({ color: 0x8a7f8f })
    );
    rope.position.set(rx, -3.6, rz);
    g.add(rope);
  }
  g.add(envelope, basket);
  g.position.set(rand(-90, 90), rand(42, 68), rand(-90, 90));
  g.userData = { speed: rand(1.0, 2.0), baseY: g.position.y, phase: rand(0, 6) };
  scene.add(g);
  balloons.push(g);
}

// ---------- 光之祝福 ----------
const CHOLE_MESSAGES = [
  '这座城的每一盏路灯，都是我提前为你点亮的。',
  '面包房的香气飘到街角时，记得深呼吸。',
  '广场的喷泉会替我记住你今天的样子。',
  '慢慢走。在我的城里，所有的灯都会等你。',
  '屋顶的颜色是我一栋一栋挑的，像不像糖果盒？',
  '车会自己停下来让你——在我的城里，你最重要。',
  '公园的长椅，永远有你的位置。',
  '迷路也没关系，每条街的尽头都是好风景。',
  '钟楼的钟声，是我在对你说早安和晚安。',
  '热气球上看到的你，小小的，亮亮的。',
  '谢谢你走进我造的这座城。',
  '这座城缺的最后一块拼图，就是你。',
];
const FINAL_MESSAGE = '十二份祝福都到你手里了。抬头——彩虹横跨了整座城。欢迎回家，我的孩子。';
const TOWER_MESSAGE = '这里是 Chole 的钟楼。整座城的时间，都以你的脚步为准。';

const orbs = [];
const orbGlowTex = makeGlowTexture('rgba(255,250,220,1)', 'rgba(255,214,140,0.6)');
const ORB_SPOTS = [
  [0, -19], [14, 8], [-50, -6], [50, -50], [-50, -50], [6, -50],
  [-50, 44], [50, 34], [78, 0], [-78, -4], [4, 78], [-6, -78],
];
ORB_SPOTS.forEach(([x, z], i) => {
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
  g.position.set(x, 1.8, z);
  g.userData = { baseY: 1.8, phase: rand(0, Math.PI * 2), collected: false, index: i };
  scene.add(g);
  orbs.push(g);
});

// ---------- 彩虹 ----------
const rainbow = new THREE.Group();
{
  const cols = [0xff9aa2, 0xffb347, 0xfff3b0, 0xa8e6cf, 0xa2d2ff, 0xcdb4db];
  cols.forEach((col, i) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(60 - i * 2.4, 1.2, 8, 60, Math.PI),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, fog: false })
    );
    rainbow.add(arc);
  });
  rainbow.position.set(0, 0, -40);
  rainbow.visible = false;
  scene.add(rainbow);
}

// ---------- 小旅人（兜帽流浪者，Chole 的孩子） ----------
const playerChar = spawnCharacter(A.player, 1.72);
const player = playerChar.group;
player.position.set(9, 0, 16);
setCharAnim(playerChar, 'idle');
scene.add(player);

const playerState = { vy: 0, grounded: true, speed: 10, facing: Math.PI, walkPhase: 0 };

// ---------- 小狗（柴犬，Chole 送给小旅人的伙伴） ----------
// 注：poly.pizza 的 GLB 经过 gltfpack 量化，蒙皮路径下会丢失反量化缩放，
// 故将绑定姿态烘焙为静态网格 + 程序化小跑，稳定可靠。
const dog = (() => {
  const src = A.shiba.scene;
  src.updateMatrixWorld(true);
  const raw = new THREE.Group();
  src.traverse(n => {
    if (n.isSkinnedMesh || (n.isMesh && !n.isSkinnedMesh)) {
      const m = new THREE.Mesh(n.geometry, n.material);
      m.applyMatrix4(n.matrixWorld);
      m.castShadow = true;
      raw.add(m);
    }
  });
  return makeTemplate(raw, 0.95);
})();
dog.position.set(player.position.x - 1.5, 0, player.position.z + 1.5);
scene.add(dog);
const dogState = { facing: 0, trot: 0, moving: false };

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
    setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      [523.25, 392.0].forEach((f, i) => setTimeout(() => playNote(f, 0.08, 2.8), i * 700));
    }, 45000);
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

// ---------- 收集 & 钟楼 ----------
let collected = 0;
let towerGreeted = false;
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
  showToast('<b style="color:#b56576">Chole 说：</b>欢迎来到我的城市，小旅人。灯都亮了，就等你了。', 6000);
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

  // --- 动画混合器 ---
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
  // 建筑碰撞
  for (const o of obstacles) {
    const dx = player.position.x - o.x, dz = player.position.z - o.z;
    const dd = Math.hypot(dx, dz);
    if (dd < o.r && dd > 1e-4) {
      player.position.x = o.x + (dx / dd) * o.r;
      player.position.z = o.z + (dz / dd) * o.r;
    }
  }
  // 世界边界
  const pr = Math.hypot(player.position.x, player.position.z);
  if (pr > CITY.playRadius) {
    const s = CITY.playRadius / pr;
    player.position.x *= s; player.position.z *= s;
  }
  // 跳跃 & 贴地
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

  // --- 小狗跟随 ---
  {
    const behind = 2.0;
    const fx = Math.sin(playerState.facing), fz = Math.cos(playerState.facing);
    const tx = player.position.x - fx * behind + fz * 0.9;
    const tz = player.position.z - fz * behind - fx * 0.9;
    const dx = tx - dog.position.x, dz = tz - dog.position.z;
    const dd = Math.hypot(dx, dz);
    if (dd > 25) {
      // 落太远就瞬移跟上（比如玩家被传送时）
      dog.position.set(tx, terrainHeight(tx, tz), tz);
    } else if (dd > 0.35) {
      const sp = Math.min(11, dd * 3.2);
      dog.position.x += (dx / dd) * sp * dt;
      dog.position.z += (dz / dd) * sp * dt;
      const targetFacing = Math.atan2(dx, dz);
      let dr = targetFacing - dogState.facing;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      dogState.facing += dr * Math.min(1, dt * 10);
      dogState.trot += sp * dt * 2.4;
      dogState.moving = true;
    } else {
      dogState.facing += (playerState.facing - dogState.facing) * Math.min(1, dt * 2);
      dogState.moving = false;
    }
    dog.rotation.y = dogState.facing + CHAR_YAW;
    // 程序化小跑：起伏 + 轻微前后摇
    const trotBob = dogState.moving ? Math.abs(Math.sin(dogState.trot)) * 0.09 : 0;
    dog.position.y = terrainHeight(dog.position.x, dog.position.z) + trotBob;
    dog.rotation.x = dogState.moving ? Math.sin(dogState.trot) * 0.06 : 0;
  }

  // --- 相机（避障） ---
  const cosP = Math.cos(cam.pitch);
  let effDist = cam.dist;
  {
    const dirX = Math.sin(cam.yaw), dirZ = Math.cos(cam.yaw);
    const wantXZ = cam.dist * cosP;
    let allowedXZ = wantXZ;
    for (const o of obstacles) {
      const ox = o.x - player.position.x, oz = o.z - player.position.z;
      const tStar = ox * dirX + oz * dirZ;
      if (tStar <= 0 || tStar > allowedXZ + o.r) continue;
      const perp = Math.hypot(ox - dirX * tStar, oz - dirZ * tStar);
      const rr = o.r + 0.6;
      if (perp < rr) {
        const entry = tStar - Math.sqrt(rr * rr - perp * perp);
        if (entry < allowedXZ) allowedXZ = Math.max(3.0, entry);
      }
    }
    effDist = cam.dist * (allowedXZ / wantXZ);
  }
  camPos.set(
    player.position.x + Math.sin(cam.yaw) * effDist * cosP,
    player.position.y + Math.sin(cam.pitch) * effDist + 2.2,
    player.position.z + Math.cos(cam.yaw) * effDist * cosP
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

  // --- 钟楼 ---
  const crystal = towerGroup.getObjectByName('crystal');
  crystal.rotation.y += dt * 0.8;
  crystal.position.y = 26.5 + Math.sin(t * 1.1) * 0.3;
  for (const pivot of window.__clockHands) pivot.rotation.z = -t * 0.15;
  const distToTower = Math.hypot(player.position.x, player.position.z);
  if (distToTower < 12 && !towerGreeted) {
    towerGreeted = true;
    showToast(`🕰️ ${TOWER_MESSAGE}`, 5500);
    playChime();
  }

  // --- 喷泉水花 ---
  {
    const drops = fountainGroup.userData.drops;
    const pos = drops.geometry.attributes.position;
    const seeds = drops.userData.seeds;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      s.t += dt * 0.9;
      if (s.t > 1) { s.t = 0; s.a = Math.random() * Math.PI * 2; }
      const k = s.t;
      const r = k * 2.4;
      pos.setX(i, Math.cos(s.a) * r);
      pos.setZ(i, Math.sin(s.a) * r);
      pos.setY(i, 2.9 + (k * 3.2 - k * k * 4.8));
    }
    pos.needsUpdate = true;
  }

  // --- 小车 ---
  for (const car of cars) {
    const u = car.userData;
    const target = u.loop[u.wp];
    const dx = target.x - car.position.x, dz = target.z - car.position.z;
    const dd = Math.hypot(dx, dz);
    const playerDist = car.position.distanceTo(player.position);
    const wantSpeed = playerDist < 7 ? 0 : u.cruise;
    u.speed += (wantSpeed - u.speed) * Math.min(1, dt * 4);
    if (dd < 0.8) {
      u.wp = (u.wp + 1) % u.loop.length;
    } else if (u.speed > 0.05) {
      car.position.x += (dx / dd) * u.speed * dt;
      car.position.z += (dz / dd) * u.speed * dt;
      const targetRot = Math.atan2(dx, dz) + u.yawOffset;
      let dr = targetRot - car.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      car.rotation.y += dr * Math.min(1, dt * 6);
    }
  }

  // --- 居民 ---
  for (const v of villagers) {
    const u = v.userData;
    u.heartCooldown -= dt;
    const target = u.loop[u.wp];
    const dx = target.x - v.position.x, dz = target.z - v.position.z;
    const dd = Math.hypot(dx, dz);
    if (dd < 0.5) {
      u.wp = (u.wp + 1) % u.loop.length;
    } else {
      v.position.x += (dx / dd) * u.speed * dt;
      v.position.z += (dz / dd) * u.speed * dt;
      v.rotation.y = Math.atan2(dx, dz) + CHAR_YAW;
    }
    if (u.heartCooldown <= 0 && v.position.distanceTo(player.position) < 3.2) {
      u.heartCooldown = 2.5;
      spawnHeart(v.position.clone().add(new THREE.Vector3(0, 2.1, 0)));
    }
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.userData.life -= dt;
    h.position.y += dt * 1.2;
    h.material.opacity = Math.max(0, h.userData.life / 1.4);
    if (h.userData.life <= 0) { scene.remove(h); hearts.splice(i, 1); }
  }

  // --- 鸽子 ---
  for (const p of pigeons) {
    const u = p.userData;
    if (u.state === 'idle') {
      u.timer -= dt;
      if (u.timer <= 0) {
        const a = Math.random() * Math.PI * 2, d = rand(1, 4);
        let nx = p.position.x + Math.cos(a) * d;
        let nz = p.position.z + Math.sin(a) * d;
        const nr = Math.hypot(nx, nz - 2);
        if (nr > 18) { nx = p.position.x - Math.cos(a) * d; nz = p.position.z - Math.sin(a) * d; }
        u.from.copy(p.position);
        u.to.set(nx, 0.16, nz);
        u.state = 'hop'; u.hopT = 0;
        p.rotation.y = Math.atan2(nx - p.position.x, nz - p.position.z);
      }
    } else {
      u.hopT += dt * 2.4;
      const k = Math.min(u.hopT, 1);
      p.position.lerpVectors(u.from, u.to, k);
      p.position.y += Math.sin(k * Math.PI) * 0.35;
      if (k >= 1) { u.state = 'idle'; u.timer = rand(0.6, 2.4); p.position.y = 0.16; }
    }
  }

  // --- 飞鸟 & 热气球 & 云 ---
  for (const b of flyingBirds) {
    const u = b.userData;
    const ang = t * u.speed + u.phase;
    b.position.set(Math.cos(ang) * u.r, u.h + Math.sin(t * 0.5 + u.phase) * 2, Math.sin(ang) * u.r);
    b.rotation.y = -ang + (u.speed > 0 ? 0 : Math.PI);
  }
  for (const b of balloons) {
    b.position.x += b.userData.speed * dt;
    b.position.y = b.userData.baseY + Math.sin(t * 0.4 + b.userData.phase) * 2;
    if (b.position.x > 160) b.position.x = -160;
  }
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 280) c.position.x = -280;
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
  get dogPos() { return [dog.position.x, dog.position.z]; },
  get dogMoving() { return dogState.moving; },
  dogInfo() {
    const box = new THREE.Box3().setFromObject(dog);
    const size = new THREE.Vector3(); box.getSize(size);
    return { size: size.toArray().map(v => +v.toFixed(2)), groupPos: dog.position.toArray().map(x => +x.toFixed(2)) };
  },
  get playerClips() { return (A.player.animations || []).map(c => c.name); },
  teleport(x, z) { player.position.set(x, terrainHeight(x, z), z); },
  orbPositions() { return orbs.filter(o => !o.userData.collected).map(o => [o.position.x, o.position.z]); },
  villagerPositions() { return villagers.map(v => [v.position.x, v.position.z]); },
  carPositions() { return cars.map(c => [c.position.x, c.position.z]); },
  carSpeeds() { return cars.map(c => +c.userData.speed.toFixed(2)); },
  benchmark(n = 60) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) renderer.render(scene, camera);
    const ms = (performance.now() - t0) / n;
    return { msPerFrame: +ms.toFixed(2), estFps: Math.round(1000 / ms), triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls };
  },
  obstacleTest() {
    let worst = Infinity;
    for (const o of obstacles) {
      const d = Math.hypot(player.position.x - o.x, player.position.z - o.z) - o.r;
      if (d < worst) worst = d;
    }
    return +worst.toFixed(2);
  },
};
