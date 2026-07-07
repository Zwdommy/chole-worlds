import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { clone as skeletonClone } from './lib/SkeletonUtils.js';
import { EffectComposer } from './lib/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './lib/postprocessing/OutputPass.js';

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

// ============================================================
//  世界时间：一天 = dayLen 秒，t ∈ [0,1)
//  黎明→清晨→正午→午后→黄昏→夜→星夜→次日黎明
// ============================================================
const TIME = { t: 0.03, dayLen: 480, scale: 1, tlTarget: null };
const DAY_PHASES = [
  { name: 'dawn',      a: 0.02, b: 0.10, label: '黎明', icon: '🌅' },
  { name: 'morning',   a: 0.10, b: 0.32, label: '清晨', icon: '🌤️' },
  { name: 'noon',      a: 0.32, b: 0.48, label: '正午', icon: '☀️' },
  { name: 'afternoon', a: 0.48, b: 0.60, label: '午后', icon: '🌞' },
  { name: 'dusk',      a: 0.60, b: 0.70, label: '黄昏', icon: '🌆' },
  { name: 'night',     a: 0.70, b: 0.97, label: '夜晚', icon: '🌙' },
];
function phaseOf(t) {
  for (const p of DAY_PHASES) if (t >= p.a && t < p.b) return p;
  return { name: 'starry', a: 0.97, b: 1.02, label: '星夜', icon: '✨' };
}
// 光照/天空关键帧（设计师版：白日蜜桃奶蓝 / 黄昏两段式粉紫橙 / 夜晚温柔深蓝紫）
const DAY_STOPS = [
  { t: 0.00, top: '#232a52', mid: '#34395f', hor: '#4a4472', fog: '#3a3d63', sun: '#bcd0ff', sunI: 0.10, hemiI: 0.22, elev: -8,  star: 0.90, lamp: 1.00 },
  { t: 0.04, top: '#7d8fc4', mid: '#d8a9c0', hor: '#ffd9a0', fog: '#e8b7c0', sun: '#ffb98a', sunI: 0.70, hemiI: 0.45, elev: 2,   star: 0.35, lamp: 0.70 },
  { t: 0.10, top: '#8fb8e0', mid: '#c3e2e8', hor: '#ffe9c9', fog: '#dff0ea', sun: '#ffd7a6', sunI: 1.15, hemiI: 0.70, elev: 12,  star: 0.00, lamp: 0.25 },
  { t: 0.20, top: '#79b4ea', mid: '#aedcf2', hor: '#fff3d9', fog: '#e6f4f6', sun: '#fff0d2', sunI: 1.60, hemiI: 0.90, elev: 30,  star: 0.00, lamp: 0.00 },
  { t: 0.40, top: '#63aef0', mid: '#a5d8f7', hor: '#ffeed8', fog: '#eaf6fb', sun: '#fffbe8', sunI: 2.00, hemiI: 1.05, elev: 62,  star: 0.00, lamp: 0.00 },
  { t: 0.54, top: '#6fa9e8', mid: '#b7d6f0', hor: '#ffe2b8', fog: '#f3ecdd', sun: '#ffe9b8', sunI: 1.75, hemiI: 0.90, elev: 38,  star: 0.00, lamp: 0.00 },
  { t: 0.62, top: '#7f8fd0', mid: '#e8a8c0', hor: '#ffbe85', fog: '#f2c3b0', sun: '#ffab6e', sunI: 1.30, hemiI: 0.70, elev: 14,  star: 0.00, lamp: 0.35 },
  { t: 0.66, top: '#6a6ab8', mid: '#d888b8', hor: '#ff9a6a', fog: '#e0a3b8', sun: '#ff8f5e', sunI: 0.95, hemiI: 0.55, elev: 5,   star: 0.08, lamp: 0.75 },
  { t: 0.72, top: '#35386e', mid: '#5a4e94', hor: '#b06a92', fog: '#6b5e94', sun: '#ff9d7a', sunI: 0.25, hemiI: 0.32, elev: -4,  star: 0.55, lamp: 1.00 },
  { t: 0.84, top: '#1d2348', mid: '#2f3563', hor: '#4a4478', fog: '#3c3f66', sun: '#bcd0ff', sunI: 0.12, hemiI: 0.20, elev: -30, star: 1.00, lamp: 1.00 },
  { t: 0.97, top: '#262c55', mid: '#3a3f70', hor: '#5c5484', fog: '#454a70', sun: '#bcd0ff', sunI: 0.10, hemiI: 0.18, elev: -10, star: 0.85, lamp: 1.00 },
];
// 预解析颜色 + 首尾回环
const _stops = DAY_STOPS.map(s => ({
  ...s,
  topC: new THREE.Color(s.top), midC: new THREE.Color(s.mid), horC: new THREE.Color(s.hor),
  fogC: new THREE.Color(s.fog), sunC: new THREE.Color(s.sun),
}));
_stops.push({ ..._stops[0], t: 1.0 });
const _dayState = {
  top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(),
  fog: new THREE.Color(), sun: new THREE.Color(),
  sunI: 1, hemiI: 1, elev: 30, star: 0, lamp: 0,
};
function getDayState(t) {
  let i = 0;
  while (i < _stops.length - 2 && t > _stops[i + 1].t) i++;
  const a = _stops[i], b = _stops[i + 1];
  const k = THREE.MathUtils.clamp((t - a.t) / Math.max(b.t - a.t, 1e-5), 0, 1);
  _dayState.top.lerpColors(a.topC, b.topC, k);
  _dayState.mid.lerpColors(a.midC, b.midC, k);
  _dayState.hor.lerpColors(a.horC, b.horC, k);
  _dayState.fog.lerpColors(a.fogC, b.fogC, k);
  _dayState.sun.lerpColors(a.sunC, b.sunC, k);
  _dayState.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
  _dayState.hemiI = THREE.MathUtils.lerp(a.hemiI, b.hemiI, k);
  _dayState.elev = THREE.MathUtils.lerp(a.elev, b.elev, k);
  _dayState.star = THREE.MathUtils.lerp(a.star, b.star, k);
  _dayState.lamp = THREE.MathUtils.lerp(a.lamp, b.lamp, k);
  return _dayState;
}
function timelapseTo(phaseName) {
  const ph = DAY_PHASES.find(p => p.name === phaseName);
  if (!ph) return;
  TIME.tlTarget = (ph.a + 0.015) % 1;
  TIME.scale = 40;
}
let lastNightF = 0; // 供音频/逻辑读取的当前"夜色深度"

// ---------- 移动端检测 ----------
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  || new URLSearchParams(location.search).has('touch');
if (IS_TOUCH) {
  document.body.classList.add('touch');
  const loadingPs = document.querySelectorAll('#loading p');
  if (loadingPs[1]) loadingPs[1].textContent = '左摇杆移动 · 右侧拖动转视角 · ⬆ 跳跃';
}

// ---------- 设置 & 存档（本地持久化，为 Steam 云存档预留结构） ----------
const SETTINGS_KEY = 'chole-city-settings';
const SAVE_KEY = 'chole-city-save-v1';
const settings = { volume: 1, shadow: 'high', muted: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (_) { /* 隐私模式等 */ }
function persistSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {} }
let paused = false;

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

// ---------- Bloom 后处理（桌面端；夜晚的灯光会真正发光） ----------
let composer = null, bloomPass = null;
if (!IS_TOUCH) {
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.65, 0.85);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (err) {
    composer = null;
    window.__errors.push('bloom init failed: ' + err.message);
  }
}

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

// ---------- 月亮 ----------
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture('rgba(250,246,255,1)', 'rgba(200,205,255,0.5)'),
  transparent: true, depthWrite: false, opacity: 0,
}));
moonGlow.scale.setScalar(90);
scene.add(moonGlow);

// ---------- 星空 ----------
const stars = (() => {
  const N = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // 上半球均匀分布
    const u = Math.random(), v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(1 - v * 0.85); // 偏向天顶
    const r = 820;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) + 30;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff8e8, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -1;
  scene.add(pts);
  return pts;
})();

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

// ---------- 门前灯笼（夜晚点亮的暖橙纸灯，替代烘焙窗灯） ----------
const lanterns = []; // { mesh, glow }
const lanternGlowTex = makeGlowTexture('rgba(255,220,180,1)', 'rgba(255,160,100,0.5)');
function addLantern(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.6, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xff9e5e, emissive: 0xffb066, emissiveIntensity: 0.05 })
  );
  mesh.position.set(x, terrainHeight(x, z) + 2.3, z);
  scene.add(mesh);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lanternGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  glow.scale.setScalar(1.8);
  glow.position.copy(mesh.position);
  scene.add(glow);
  lanterns.push({ mesh, glow });
}

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
      // 门前灯笼（朝道路一侧）
      addLantern(x + Math.sin(rotY) * (fp / 2 + 0.55), z + Math.cos(rotY) * (fp / 2 + 0.55));
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
  beam.name = 'beam';
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

// ---------- 路灯（KayKit 模型 + 暖光晕，夜亮昼熄，支持"点灯人"任务） ----------
const lampGlowTex = makeGlowTexture('rgba(255,244,214,1)', 'rgba(255,214,140,0.55)');
const lamps = []; // { inst, glow, bulb, x, z, lit, plaza }
function addLamp(x, z, rotY = 0, isPlaza = false) {
  const inst = place(lampTpl, x, z, rotY);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lampGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  glow.scale.setScalar(2.4);
  glow.position.y = lampTpl.userData.size.y * 0.94;
  inst.add(glow);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffd88a, emissiveIntensity: 0 })
  );
  bulb.position.y = lampTpl.userData.size.y * 0.94;
  inst.add(bulb);
  lamps.push({ inst, glow, bulb, x, z, lit: true, plaza: isPlaza });
}
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  addLamp(Math.cos(a) * 20, Math.sin(a) * 20, -a + Math.PI / 2, true);
}
for (const c of CITY.roads) {
  for (let p = -84; p <= 84; p += 28) {
    if (Math.abs(p) < 26 && Math.abs(c) < 26) continue;
    addLamp(p, c + CITY.roadHalf + 1.1, Math.PI);
    addLamp(c - CITY.roadHalf - 1.1, p, Math.PI / 2);
  }
}

// ---------- 广场彩灯串（灯节氛围：8 根灯柱间的悬链彩灯） ----------
const stringLights = (() => {
  const group = new THREE.Group();
  const bulbGeo = new THREE.SphereGeometry(0.14, 6, 5);
  const cols = [0xffaaa5, 0xfff3b0, 0xa8e6cf, 0xa2d2ff, 0xcdb4db, 0xffd3b6];
  const posts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    posts.push(new THREE.Vector3(Math.cos(a) * 20, 4.1, Math.sin(a) * 20));
  }
  const bulbMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false });
  const wireMat = new THREE.LineBasicMaterial({ color: 0x6b5b73, transparent: true, opacity: 0.5 });
  const nPer = 9;
  const total = posts.length * nPer;
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, total);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  let bi = 0;
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i], b = posts[(i + 1) % posts.length];
    const wirePts = [];
    for (let k = 0; k <= nPer + 1; k++) {
      const s = k / (nPer + 1);
      const p = a.clone().lerp(b, s);
      p.y -= Math.sin(s * Math.PI) * 1.3; // 悬链下垂
      wirePts.push(p.clone());
      if (k >= 1 && k <= nPer) {
        dummy.position.copy(p);
        dummy.position.y -= 0.12;
        dummy.updateMatrix();
        bulbs.setMatrixAt(bi, dummy.matrix);
        bulbs.setColorAt(bi, c.setHex(cols[bi % cols.length]));
        bi++;
      }
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wirePts), wireMat));
  }
  bulbs.instanceColor.needsUpdate = true;
  group.add(bulbs);
  scene.add(group);
  return { group, bulbs, bulbMat, wireMat };
})();

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
  // 夜间车头灯（暖光晕，白天熄灭）
  const hlMat = new THREE.SpriteMaterial({
    map: lampGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  });
  const fwd = tpl.userData.yawOffset === 0 ? [0, 0, 1] : [1, 0, 0];
  const side = tpl.userData.yawOffset === 0 ? [1, 0, 0] : [0, 0, 1];
  const L = Math.max(tpl.userData.size.x, tpl.userData.size.z) / 2;
  const headlights = [];
  for (const sgn of [-1, 1]) {
    const s = new THREE.Sprite(hlMat.clone());
    s.scale.setScalar(0.7);
    s.position.set(
      fwd[0] * L + side[0] * 0.55 * sgn, 0.62, fwd[2] * L + side[2] * 0.55 * sgn
    );
    car.add(s);
    headlights.push(s);
  }
  car.userData.headlights = headlights;
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
  v.userData = { loop, wp: (wp + 1) % loop.length, speed: rand(1.3, 2.3), heartCooldown: 0, char, idx: i, festivalSpot: null };
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
function spawnBird() {
  const gltf = A.birds[flyingBirds.length % A.birds.length];
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
for (let i = 0; i < 5; i++) spawnBird();

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

// ---------- 萤火虫（夜晚的公园与广场边缘） ----------
const fireflies = (() => {
  const N = 46;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const inPark = i < 30;
    const cx = inPark ? PARK.x : 0, cz = inPark ? PARK.z : 0;
    const rr = inPark ? 16 : 22;
    seeds.push({
      x: cx + rand(-rr, rr), z: cz + rand(-rr, rr), y: rand(0.6, 2.6),
      p1: rand(0, 6), p2: rand(0, 6), s: rand(0.4, 1.1),
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8ffb0, size: 0.5, transparent: true, opacity: 0,
    map: makeGlowTexture('rgba(240,255,190,1)', 'rgba(190,230,120,0.6)'),
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.seeds = seeds;
  scene.add(pts);
  return pts;
})();

// ---------- 烟花引擎 ----------
const fireworks = [];
const fwGlowTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,220,240,0.7)');
const FW_COLORS = [0xffaaa5, 0xffd166, 0xa2d2ff, 0xcdb4db, 0xa8e6cf, 0xff8fab];
function launchFirework(x, z, colorHex = null, big = false) {
  const N = big ? 130 : 80;
  const col = colorHex ?? FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
  const y0 = rand(32, 46);
  const posArr = new Float32Array(N * 3);
  const vel = [];
  const speed = big ? 11 : 8;
  for (let i = 0; i < N; i++) {
    posArr[i * 3] = x; posArr[i * 3 + 1] = y0; posArr[i * 3 + 2] = z;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const sp = speed * (0.55 + Math.random() * 0.45);
    vel.push(new THREE.Vector3(
      Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp
    ));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.PointsMaterial({
    color: col, size: big ? 0.85 : 0.6, transparent: true, opacity: 1,
    map: fwGlowTex, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  fireworks.push({ pts, vel, age: 0, life: rand(1.5, 1.9) });
  playNote(rand(620, 880), 0.05, 0.5, 'triangle');
  playNote(98, 0.06, 0.5, 'sine');
}

// ---------- 天灯（天灯节：满城心愿升上星空） ----------
const skyLanterns = [];
function releaseSkyLanterns(n = 30) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.8, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0xffb066, emissive: 0xffa055, emissiveIntensity: 1.5, transparent: true,
      })
    );
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lanternGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85,
    }));
    glow.scale.setScalar(2.4);
    g.add(body, glow);
    const a = Math.random() * Math.PI * 2, r = rand(3, 18);
    g.position.set(Math.cos(a) * r, rand(1.2, 3.5), Math.sin(a) * r + rand(-4, 10));
    g.userData = {
      vy: rand(0.65, 1.25), dx: rand(-0.35, 0.35), dz: rand(-0.35, 0.15),
      sway: rand(0, 6), body, glow, delay: i * rand(0.35, 0.7),
    };
    g.visible = false;
    scene.add(g);
    skyLanterns.push(g);
  }
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
let orbsActive = false; // 光之祝福直到「第六章·星夜」才出现，避免提前收集导致任务卡死
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
  g.visible = false; // 星夜章开始前隐藏
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
const dogState = { facing: 0, trot: 0, moving: false, petWiggle: 0 };

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
let audioCtx = null, masterGain = null, muted = !!settings.muted;
function applyVolume() { if (masterGain) masterGain.gain.value = muted ? 0 : 0.5 * settings.volume; }
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
function startAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    applyVolume();
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
    // 随时间流转的旋律：白日明亮五声音阶，夜晚低八度更轻更慢
    setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running') return;
      const night = lastNightF > 0.6;
      const scale = night ? [196.0, 220.0, 261.63, 293.66, 329.63] : PENTA;
      playNote(scale[Math.floor(Math.random() * scale.length)], night ? 0.04 : 0.05, night ? 3.0 : 2.2, 'triangle');
      if (!night && phaseOf(TIME.t).name === 'morning' && Math.random() < 0.35) {
        setTimeout(() => playNote(1568, 0.025, 0.18), 300);
        setTimeout(() => playNote(1760, 0.02, 0.22), 480);
      }
    }, 3200);
    // 夜晚蟋蟀
    setInterval(() => {
      if (!audioCtx || audioCtx.state !== 'running' || lastNightF < 0.7) return;
      for (let i = 0; i < 3; i++) setTimeout(() => playNote(4200 + Math.random() * 400, 0.006, 0.07), i * 90);
    }, 1900);
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
muteBtn.textContent = muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  muted = !muted;
  settings.muted = muted;
  persistSettings();
  muteBtn.textContent = muted ? '🔇' : '🔊';
  applyVolume();
  startAudio();
});

// ---------- 设置面板（暂停 / 音量 / 阴影 / 重新开始） ----------
const settingsOverlay = document.getElementById('settings-overlay');
function setPaused(p) {
  paused = p;
  settingsOverlay.classList.toggle('open', p);
}
document.getElementById('settings-btn').addEventListener('click', () => setPaused(!paused));
document.getElementById('set-resume').addEventListener('click', () => setPaused(false));
document.getElementById('set-restart').addEventListener('click', () => {
  if (confirm('从头开始新的一天？当前进度将清除。')) {
    window.__hardReset ? window.__hardReset() : location.reload();
  }
});
const volEl = document.getElementById('set-volume');
volEl.value = String(Math.round(settings.volume * 100));
volEl.addEventListener('input', () => {
  settings.volume = volEl.value / 100;
  applyVolume();
  persistSettings();
});
function applyShadowQuality() {
  const hi = settings.shadow === 'high' && !IS_TOUCH;
  const sz = hi ? 2048 : 1024;
  sun.shadow.mapSize.set(sz, sz);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
}
const shadowEl = document.getElementById('set-shadow');
shadowEl.value = settings.shadow;
shadowEl.addEventListener('change', () => {
  settings.shadow = shadowEl.value;
  applyShadowQuality();
  persistSettings();
});
applyShadowQuality();
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') setPaused(!paused); });

// ---------- HUD ----------
const toastEl = document.getElementById('toast');
const orbCountEl = document.getElementById('orb-count');
const toastQueue = [];
let toastBusy = false;
function showToast(text, dur = 4200, story = false) {
  toastQueue.push({ text, dur, story });
  // 防积压：超额时优先丢弃最旧的「非剧情」提示，Chole 的话一句都不能少
  while (toastQueue.length > 8) {
    const idx = toastQueue.findIndex(m => !m.story);
    if (idx === -1) break; // 全是剧情台词，宁可排队也不丢
    toastQueue.splice(idx, 1);
  }
  pumpToast();
}
function pumpToast() {
  if (toastBusy || toastQueue.length === 0) return;
  toastBusy = true;
  const { text, dur, story } = toastQueue.shift();
  toastEl.innerHTML = text;
  toastEl.classList.toggle('story', !!story);
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastBusy = false; pumpToast(); }, 550);
  }, dur);
}
// Chole 之声（剧情对话）
function showStory(text) {
  showToast(`<span class="speaker">— C H O L E —</span>${text}`, 5000, true);
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
  addHappiness(2);
  questEvent('collect');
  saveGame();
}

// ============================================================
//  幸福度系统：善意会让城市变得更美
// ============================================================
let happiness = 0;
let happyBloomBoost = 0, fireflyBoost = 1;
const happyFill = document.getElementById('happy-fill');
const happyVal = document.getElementById('happy-val');
const HAPPY_LINES = {
  25: '感觉到了吗？风变软了。这座城正在悄悄记下你做的每一件小事。',
  50: '喷泉跳得比昨天高了一些，鸽子也更爱落在人的肩上——这座城的笑容，有一半是你带来的。',
  75: '花开过了栅栏，灯光比星星还稠。居民们说，最近做的梦，都是甜的。',
  100: '满了。整座城的幸福像一杯到了杯沿也舍不得溢出的蜜。而这一切的开头，是那个黎明落在云上的你。',
};
const happyMilestones = new Set();
function addHappiness(n, silent = false) {
  const before = happiness;
  happiness = Math.min(100, happiness + n);
  if (happyFill) happyFill.style.width = happiness + '%';
  if (happyVal) happyVal.textContent = String(Math.round(happiness));
  for (const th of [25, 50, 75, 100]) {
    if (before < th && happiness >= th && !happyMilestones.has(th)) {
      happyMilestones.add(th);
      if (!silent) showStory(HAPPY_LINES[th]);
      if (!silent) launchFirework(player.position.x + rand(-15, 15), player.position.z - 20, null, th === 100);
      if (th === 25) { for (let i = 0; i < 3; i++) spawnBird(); }
      if (th === 50) plazaBloom();
      if (th === 75) { happyBloomBoost = 0.12; fireflyBoost = 1.5; }
      if (th === 100) {
        const beam = towerGroup.getObjectByName('beam');
        if (beam) beam.material.opacity = 0.3;
      }
    }
  }
}
// 50 分：广场绽放花环
let bloomFlowers = null;
function plazaBloom() {
  const N = 40;
  const geo = new THREE.IcosahedronGeometry(0.22, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ flatShading: true }), N);
  const cols = [0xffaaa5, 0xfff3b0, 0xcdb4db, 0xa2d2ff, 0xffd3b6];
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const seeds = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rand(-0.06, 0.06);
    const r = 21.8 + rand(-0.5, 0.5);
    seeds.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rand(0.8, 1.4) });
    dummy.position.set(seeds[i].x, 0.3, seeds[i].z);
    dummy.scale.setScalar(0.01);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, c.setHex(cols[i % cols.length]));
  }
  inst.instanceColor.needsUpdate = true;
  scene.add(inst);
  bloomFlowers = { inst, seeds, growth: 0 };
}

// ============================================================
//  任务引擎：一整天的八个章节，每一章都通向幸福
// ============================================================
const QUESTS = [
  { id: 'q0-dawn-arrival', chapter: '序章 · 黎明', title: '落在云上的羽毛', timeHint: 'dawn',
    intro: ['醒了吗，小旅人？你落在云上的样子，像一片终于找到枝头的羽毛。',
      '我是 Chole，这座城是我造的——而今天早上天空的粉色，是特意为你调的。',
      '去钟楼下的喷泉广场吧。喷泉听说你要来，练习了一整晚。'],
    objective: { type: 'visit', count: 1, hud: '前往钟楼喷泉广场', loc: { x: 0, z: 10, r: 7 } },
    outro: ['看，钟楼的针刚好走到你抵达的这一刻。我把它记下来了——从现在起，这座城的时间里，有你。',
      '先别急着做什么，深呼吸一下。云的味道，是不是比你想象的甜一点？'], happiness: 5 },
  { id: 'q1-morning-greet', chapter: '第一章 · 清晨', title: '五声早安', timeHint: 'morning',
    intro: ['居民们醒来了，面包的香气正沿着街道散步。',
      '去和他们打个招呼吧。不用想该说什么——在这里，只要走近一点，心就会自己开口。'],
    objective: { type: 'greet', count: 5, hud: '向 5 位居民道早安' },
    outro: ['看到他们头顶冒出的小心心了吗？那不是魔法，是你本来就带着的温度。',
      '五声早安，换来五个笑。这笔账，是全世界最划算的。'], happiness: 10 },
  { id: 'q2-noon-deliver', chapter: '第二章 · 正午', title: '阳光邮差', timeHint: 'noon',
    intro: ['正午的阳光把所有影子都收得短短的，正是说心里话的好时候。',
      '有三封信在等一位邮差。它们会发光，是因为写信的人写着写着，就笑了。',
      '可以拜托你吗？我猜，你的口袋正好装得下三份心意。'],
    objective: { type: 'deliver', count: 3, hud: '送出 3 封发光的信' },
    outro: ['信送到的那一刻，你的手心是不是暖暖的？那是别人的心意路过你时，顺便说的谢谢。',
      '被人需要的感觉——这是小城送你的第二份礼物。'], happiness: 12 },
  { id: 'q3-afternoon-pet', chapter: '第三章 · 午后', title: '毛茸茸的时光', timeHint: 'afternoon',
    intro: ['忙了一上午，午后是用来浪费的——请理直气壮地浪费。',
      '那只小柴犬跟了你一路啦，尾巴摇得像在鼓掌。去蹲下来，好好摸摸它吧。'],
    objective: { type: 'pet', count: 3, hud: '摸摸小柴犬 ×3' },
    outro: ['它把肚皮翻过来给你，就是把全部的信任都交给你了。',
      '你看，幸福有时候就这么简单：一只狗，一个下午，和一双愿意停下来的手。'], happiness: 12 },
  { id: 'q4-dusk-lamps', chapter: '第四章 · 黄昏', title: '点灯人', timeHint: 'dusk',
    intro: ['抬头看，天空正调成我最喜欢的颜色——橘子味的粉。',
      '今晚的路灯，想请你来点。轻轻碰一碰就好。',
      '每一盏灯亮起来，就有一个晚归的人，不用摸黑回家。'],
    objective: { type: 'lamps', count: 7, hud: '点亮 7 盏路灯' },
    outro: ['七盏灯，七条被照亮的小路。以前是我为你点灯——今晚，是你为整座城点的。',
      '现在你懂了吧，温柔这件事，是会传染的。'], happiness: 13 },
  { id: 'q5-night-lantern-festival', chapter: '第五章 · 夜', title: '天灯节', timeHint: 'night',
    intro: ['嘘——今晚有惊喜。收到你问候和信的居民们，偷偷准备了一整个下午。',
      '去广场吧。今夜的天空，会替所有人说谢谢。'],
    objective: { type: 'watch', count: 1, hud: '在广场观看天灯节' },
    outro: ['每一盏天灯里都写着一个愿望，其中好几盏，写的是你的名字。',
      '抬了这么久的头，脖子酸了吧？酸酸的脖子和亮亮的眼睛——这就是过节的证据。'], happiness: 15 },
  { id: 'q6-starnight-collect', chapter: '第六章 · 星夜', title: '十二道光', timeHint: null,
    intro: ['天灯飞远了，星星接了它们的班。星夜的城最安静，也最适合寻找。',
      '我在城里藏了十二句想对你说的话，每一句都装在一小团光里。',
      '把它们都找回来吧——那是我写给你的、完整的一天。'],
    objective: { type: 'collect', count: 12, hud: '集齐 12 个光之祝福' },
    outro: ['十二团光都在你怀里了，暖吗？那是我从见到你的第一眼起，一句一句攒下来的。',
      '接下来的事，我想让天空亲自告诉你。走吧，往樱花公园去。'], happiness: 18 },
  { id: 'q7-finale-rainbow', chapter: '终章 · 新的黎明', title: '彩虹的方向', timeHint: null,
    intro: ['这一次，我们不快进了，好吗？就这样走着，看夜色一点一点变薄。',
      '往樱花公园的山坡走。我把这一整天的幸福，都酿在了天上。'],
    objective: { type: 'visit', count: 1, hud: '前往樱花公园', loc: { x: 48, z: 46, r: 7 } },
    outro: ['看啊，彩虹。十二个祝福、七盏路灯、五声早安、三封信、一只狗，和一个你——全都在里面。',
      '新的一天开始了，小旅人。这一次，不是你抵达了这座城，是这座城，终于完整地拥有了你。'], happiness: 15 },
];
const LETTERS = [
  { from: '面包师·茉莉', to: '花匠·老栗', text: '窗台上的雏菊开了，揉面时一抬头就能看见。所以今天的面包格外松软——谢谢你呀。' },
  { from: '小画家·豆豆', to: '守塔人·星野', text: '我画了你擦亮钟面的样子！挂在床头，这样每晚睡前，都能准时梦见星星。' },
  { from: '花匠·老栗', to: '面包师·茉莉', text: '今天有位小旅人帮我扶起了被风吹倒的花。这座城越来越暖了，分你半份好心情。' },
];
const LETTER_TARGETS = [0, 1, 2];
const FESTIVAL_LINES = [
  '看，第一盏天灯升起来了——它有点摇晃，像每一个鼓起勇气的开始。',
  '居民们把愿望写得很小很小，字却描了一遍又一遍。灯飞得有多高，心意就有多认真。',
  '满天的灯里，总有一盏会替你亮到最后。今晚不许许愿别的——只许你，一直这样幸福下去。',
];
const FESTIVAL_LINE_AT = [6, 26, 46];

const questEls = {
  card: document.getElementById('quest-card'),
  chapter: document.getElementById('quest-chapter'),
  title: document.getElementById('quest-title'),
  obj: document.getElementById('quest-obj'),
  prog: document.getElementById('quest-prog'),
};
let questIdx = -1, questProg = 0;
const questState = {};
const festival = { active: false, t: 0, watchT: 0, lineIdx: 0, fwTimer: 0 };
let simTime = 0;                 // 模拟时钟（不受浏览器节流影响）
let pendingQuest = null;         // { i, at } 完成后延迟开启下一章
let rainbowAt = null;            // 终章彩虹出现的模拟时刻

const markerTex = makeGlowTexture('rgba(255,240,180,1)', 'rgba(255,200,80,0.55)');
function makeMarker(scale = 2.4) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: markerTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  s.scale.setScalar(scale);
  return s;
}
function makeEmojiSprite(emoji, scale = 1.1) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 32, 36);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
  }));
  s.scale.setScalar(scale);
  return s;
}

function currentQuest() { return questIdx >= 0 ? QUESTS[questIdx] : null; }
function updateQuestHUD() {
  const q = currentQuest();
  if (!q) { questEls.card.style.display = 'none'; return; }
  questEls.card.style.display = 'block';
  questEls.chapter.textContent = q.chapter;
  questEls.title.textContent = q.title;
  questEls.obj.textContent = q.objective.hud;
  const val = q.objective.type === 'collect' ? collected : questProg;
  questEls.prog.textContent = `${Math.min(val, q.objective.count)} / ${q.objective.count}`;
}

let letterPickup = null, letterMarker = null, visitBeacon = null;
const LETTER_SPOTS = [[-10, 10], [10, 10], [-10, -12]];
function spawnLetter(idx) {
  letterPickup = new THREE.Group();
  letterPickup.add(makeMarker(2.0), makeEmojiSprite('✉️'));
  const [x, z] = LETTER_SPOTS[idx % LETTER_SPOTS.length];
  letterPickup.position.set(x, 1.7, z);
  scene.add(letterPickup);
  if (!letterMarker) {
    letterMarker = makeMarker(1.8);
    scene.add(letterMarker);
  }
  letterMarker.visible = false;
}

function setupObjective(q) {
  const o = q.objective;
  if (o.type === 'greet') questState.greeted = new Set();
  if (o.type === 'deliver') { questState.letterIdx = 0; questState.carrying = false; spawnLetter(0); }
  if (o.type === 'lamps') {
    questState.lampTargets = lamps.filter(l => l.plaza).slice(0, o.count);
    for (const l of questState.lampTargets) l.lit = false;
  }
  if (o.type === 'pet') { questState.petT = 0; questState.petCd = 0; }
  if (o.type === 'collect') {
    orbsActive = true;
    orbs.forEach(orb => { if (!orb.userData.collected) orb.visible = true; });
  }
  if (o.type === 'watch') startFestival();
  if (o.type === 'visit' && o.loc) {
    visitBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.6, 40, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      })
    );
    visitBeacon.position.set(o.loc.x, 20, o.loc.z);
    scene.add(visitBeacon);
  }
}
function cleanupObjective(q) {
  if (q.objective.type === 'deliver') {
    if (letterPickup) { scene.remove(letterPickup); letterPickup = null; }
    if (letterMarker) { scene.remove(letterMarker); letterMarker = null; }
  }
  if (q.objective.type === 'lamps') for (const l of questState.lampTargets || []) l.lit = true;
  if (visitBeacon) { scene.remove(visitBeacon); visitBeacon = null; }
}

// ---------- 存档（章节检查点：完成一章 / 收集一光即存） ----------
let journeyDone = false;
let suppressSave = false; // 重新开始时置位，防止 beforeunload 兜底保存把刚清掉的进度写回去
function saveGame() {
  if (suppressSave) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      t: +TIME.t.toFixed(4),
      quest: pendingQuest ? pendingQuest.i : questIdx,
      done: journeyDone,
      collected: orbs.filter(o => o.userData.collected).map(o => o.userData.index),
      happiness: Math.round(happiness),
    }));
  } catch (_) { /* 存储不可用时静默降级 */ }
}
window.__hardReset = () => {
  suppressSave = true;
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  location.reload();
};

function startQuest(i) {
  if (i >= QUESTS.length) { journeyDone = true; questIdx = -1; updateQuestHUD(); saveGame(); return; }
  questIdx = i; questProg = 0;
  const q = QUESTS[i];
  if (q.timeHint) timelapseTo(q.timeHint);
  for (const l of q.intro) showStory(l);
  setupObjective(q);
  updateQuestHUD();
}
function questEvent(type, n = 1) {
  const q = currentQuest();
  if (!q || q.objective.type !== type) return;
  questProg += n;
  updateQuestHUD();
  const val = type === 'collect' ? collected : questProg;
  if (val >= q.objective.count) completeQuest();
}
function completeQuest() {
  const q = currentQuest();
  if (!q) return;
  playChime();
  for (const l of q.outro) showStory(l);
  cleanupObjective(q);
  addHappiness(q.happiness);
  const next = questIdx + 1;
  questIdx = -1;
  questEls.card.classList.add('done');
  if (q.id === 'q7-finale-rainbow') {
    // 终章：缓慢迎来黎明 + 彩虹
    TIME.scale = 12;
    TIME.tlTarget = 0.06;
    rainbowAt = simTime + 4;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => playNote(f, 0.12, 2.2), i * 160));
  }
  pendingQuest = { i: next, at: simTime + 6 };
  saveGame();
}

// ---------- 天灯节 ----------
function startFestival() {
  festival.active = true; festival.t = 0; festival.watchT = 0; festival.lineIdx = 0; festival.fwTimer = 2;
  releaseSkyLanterns(30);
  villagers.forEach((v, i) => {
    const a = (i / villagers.length) * Math.PI * 2 + 0.3;
    v.userData.festivalSpot = new THREE.Vector3(Math.cos(a) * 13, 0.1, Math.sin(a) * 13 + 2);
    v.visible = true;
  });
}
function endFestival() {
  festival.active = false;
  villagers.forEach(v => { v.userData.festivalSpot = null; });
}

// ---------- 长椅小憩 & 脚印开花（幸福的副产品） ----------
const BENCH_SPOTS = [[-10, 10], [10, 10], [-10, -12], [10, -12]];
let benchRestT = 0, benchCd = 0;
const footFlowers = [];
const footGeo = new THREE.IcosahedronGeometry(0.09, 0);
const FOOT_COLS = [0xffaaa5, 0xfff3b0, 0xcdb4db, 0xa2d2ff, 0xa8e6cf];
let footCd = 0;
function dropFootFlower() {
  const m = new THREE.Mesh(footGeo, new THREE.MeshStandardMaterial({
    color: FOOT_COLS[Math.floor(Math.random() * FOOT_COLS.length)], flatShading: true, transparent: true,
  }));
  m.position.set(player.position.x + rand(-0.35, 0.35), terrainHeight(player.position.x, player.position.z) + 0.07, player.position.z + rand(-0.35, 0.35));
  m.scale.setScalar(0.01);
  scene.add(m);
  footFlowers.push({ m, age: 0 });
  if (footFlowers.length > 46) {
    const old = footFlowers.shift();
    scene.remove(old.m);
    old.m.material.dispose(); // footGeo 共享，仅释放各自材质
  }
}

// ---------- 流星（星夜限定的小确幸） ----------
let meteor = null, meteorCd = 25;

// ---------- 开场（有存档则从章节检查点继续） ----------
let restoredSave = null;
try { restoredSave = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) {}
setTimeout(() => {
  document.getElementById('loading').classList.add('hidden');
  if (restoredSave && restoredSave.v === 1) {
    TIME.t = ((restoredSave.t % 1) + 1) % 1;
    for (const idx of restoredSave.collected || []) {
      const orb = orbs[idx];
      if (orb && !orb.userData.collected) {
        orb.userData.collected = true;
        orb.visible = false;
        collected++;
      }
    }
    orbCountEl.textContent = String(collected);
    addHappiness(restoredSave.happiness || 0, true);
    if (restoredSave.done || restoredSave.quest >= QUESTS.length) {
      journeyDone = true;
      rainbow.visible = true;
      showStory('欢迎回来，我的孩子。城和彩虹，都在原地等你。');
    } else {
      showStory('欢迎回来，小旅人。我们接着走这一天。');
      setTimeout(() => startQuest(Math.max(0, restoredSave.quest | 0)), 1800);
    }
  } else {
    setTimeout(() => startQuest(0), 900);
  }
}, 600);
// 切后台 / 关页前兜底保存
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('beforeunload', saveGame);

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let fpsAvg = 60;
let lastTickMs = performance.now();
const camPos = new THREE.Vector3();
const timeChipEl = document.getElementById('time-chip');
let lastPhaseLabel = '';
const _cloudSeaBase = new THREE.Color(0xfff5ec);

camera.position.set(
  player.position.x + Math.sin(cam.yaw) * cam.dist * Math.cos(cam.pitch),
  player.position.y + Math.sin(cam.pitch) * cam.dist + 2.2,
  player.position.z + Math.cos(cam.yaw) * cam.dist * Math.cos(cam.pitch)
);
camera.lookAt(player.position.x, player.position.y + 2.0, player.position.z);

function tick(forcedDt) {
  lastTickMs = performance.now();
  if (paused && forcedDt === undefined) {
    clock.getDelta(); // 暂停时丢弃流逝的时间，恢复时不会跳帧
    if (composer) composer.render();
    else renderer.render(scene, camera);
    return;
  }
  const rawDt = clock.getDelta();
  const dt = forcedDt ?? Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  fpsAvg = fpsAvg * 0.95 + (1 / Math.max(rawDt, 1e-4)) * 0.05;

  // --- 世界时间与光照氛围 ---
  const timeStep = dt * TIME.scale / TIME.dayLen;
  TIME.t = (TIME.t + timeStep) % 1;
  if (TIME.tlTarget != null) {
    const distT = (TIME.tlTarget - TIME.t + 1) % 1;
    // 按实际步长判定到站（后台大步长时也不会跳过目标时刻）
    if (distT <= timeStep * 1.5 || distT > 1 - timeStep * 1.5) {
      TIME.t = TIME.tlTarget; TIME.scale = 1; TIME.tlTarget = null;
    }
  }
  simTime += dt;
  if (pendingQuest && simTime >= pendingQuest.at) {
    const i = pendingQuest.i;
    pendingQuest = null;
    questEls.card.classList.remove('done');
    startQuest(i);
  }
  if (rainbowAt !== null && simTime >= rainbowAt) {
    rainbowAt = null;
    rainbow.visible = true;
  }
  const L = getDayState(TIME.t);
  const nightF = L.star;
  lastNightF = nightF;
  const ph = phaseOf(TIME.t);
  if (ph.label !== lastPhaseLabel) {
    lastPhaseLabel = ph.label;
    if (timeChipEl) timeChipEl.textContent = `${ph.icon} ${ph.label}`;
    if (['黄昏', '夜晚', '黎明'].includes(ph.label)) playChime();
  }
  skyMat.uniforms.top.value.copy(L.top);
  skyMat.uniforms.mid.value.copy(L.mid);
  skyMat.uniforms.horizon.value.copy(L.hor);
  scene.fog.color.copy(L.fog);
  cloudSea.material.color.copy(_cloudSeaBase).lerp(L.fog, 0.55);
  hemi.intensity = L.hemiI;
  sun.color.copy(L.sun);
  sun.intensity = Math.max(L.sunI, nightF * 0.12);
  const az = TIME.t * Math.PI * 2 - Math.PI / 2;
  const elevR = THREE.MathUtils.degToRad(L.elev);
  const lightElevR = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(Math.max(L.elev, 4), 48, nightF));
  sun.position.set(
    player.position.x + Math.cos(az) * Math.cos(lightElevR) * 130,
    Math.sin(lightElevR) * 130 + 15,
    player.position.z + Math.sin(az) * Math.cos(lightElevR) * 130
  );
  sun.target.position.copy(player.position);
  sunGlow.position.set(
    player.position.x + Math.cos(az) * Math.cos(elevR) * 600,
    Math.sin(elevR) * 600 + 10,
    player.position.z + Math.sin(az) * Math.cos(elevR) * 600
  );
  sunGlow.material.opacity = THREE.MathUtils.clamp((L.sunI - 0.2) * 1.1, 0, 1);
  const mAz = az + Math.PI;
  moonGlow.position.set(
    player.position.x + Math.cos(mAz) * 480,
    260,
    player.position.z + Math.sin(mAz) * 480
  );
  moonGlow.visible = nightF > 0.02;
  stars.visible = nightF > 0.02;
  moonGlow.material.opacity = nightF * 0.85;
  stars.material.opacity = nightF;
  stars.rotation.y += dt * 0.004;
  if (bloomPass) bloomPass.strength = 0.22 + nightF * 0.45 + happyBloomBoost;

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

  // --- 光球（仅星夜章激活后） ---
  if (orbsActive) for (const orb of orbs) {
    if (orb.userData.collected) continue;
    orb.position.y = orb.userData.baseY + Math.sin(t * 1.6 + orb.userData.phase) * 0.45;
    orb.rotation.y += dt * 1.2;
    if (orb.position.distanceTo(player.position) < 2.6) collectOrb(orb);
  }

  // --- 钟楼 ---
  const crystal = towerGroup.getObjectByName('crystal');
  crystal.rotation.y += dt * 0.8;
  crystal.position.y = 26.5 + Math.sin(t * 1.1) * 0.3;
  for (const pivot of window.__clockHands) pivot.rotation.z = -TIME.t * Math.PI * 4;
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

  // --- 居民（散步 / 天灯节聚集 / 深夜归家） ---
  const _vq = currentQuest();
  const questNeedsVillagers = _vq && (_vq.objective.type === 'greet' || _vq.objective.type === 'deliver');
  const deepNight = nightF > 0.85 && !festival.active && !questNeedsVillagers;
  for (const v of villagers) {
    const u = v.userData;
    u.heartCooldown -= dt;
    v.visible = !deepNight || u.idx < 2;
    if (!v.visible) continue;
    let target = null;
    if (festival.active && u.festivalSpot) {
      const dd0 = Math.hypot(u.festivalSpot.x - v.position.x, u.festivalSpot.z - v.position.z);
      if (dd0 < 0.6) {
        setCharAnim(u.char, 'idle');
        v.rotation.y = Math.atan2(-v.position.x, -v.position.z) + CHAR_YAW; // 面向广场中心看天灯
      } else {
        setCharAnim(u.char, 'walk', 1);
        target = u.festivalSpot;
      }
    } else {
      setCharAnim(u.char, 'walk', 1);
      target = u.loop[u.wp];
    }
    if (target) {
      const dx = target.x - v.position.x, dz = target.z - v.position.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 0.5) {
        if (!festival.active) u.wp = (u.wp + 1) % u.loop.length;
      } else {
        v.position.x += (dx / dd) * u.speed * dt;
        v.position.z += (dz / dd) * u.speed * dt;
        v.rotation.y = Math.atan2(dx, dz) + CHAR_YAW;
      }
    }
    if (u.heartCooldown <= 0 && v.position.distanceTo(player.position) < 3.2) {
      u.heartCooldown = 2.5;
      spawnHeart(v.position.clone().add(new THREE.Vector3(0, 2.1, 0)));
      addHappiness(0.5);
      const gq = currentQuest();
      if (gq && gq.objective.type === 'greet' && !questState.greeted.has(u.idx)) {
        questState.greeted.add(u.idx);
        questEvent('greet');
      }
    }
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.userData.life -= dt;
    h.position.y += dt * 1.2;
    h.material.opacity = Math.max(0, h.userData.life / 1.4);
    if (h.userData.life <= 0) { scene.remove(h); hearts.splice(i, 1); }
  }

  // --- 鸽子（夜晚归巢） ---
  for (const p of pigeons) {
    p.visible = nightF < 0.8 || festival.active;
    if (!p.visible) continue;
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

  // ============================================================
  //  时间 × 任务 × 夜之美学
  // ============================================================
  // 路灯 / 灯笼 / 彩灯串 / 车灯
  const lampsQuestActive = currentQuest()?.objective.type === 'lamps';
  const lampsOn = L.lamp > 0.01 || lampsQuestActive; // 白天彻底隐藏夜景装饰，省透明 draw call
  for (const l of lamps) {
    let f = l.lit ? L.lamp : 0;
    if (!l.lit && lampsQuestActive) f = 0.12 + 0.08 * Math.sin(t * 4 + l.x); // 待点亮的灯轻轻呼吸
    l.glow.visible = l.bulb.visible = f > 0.01;
    if (f > 0.01) { l.glow.material.opacity = f; l.bulb.material.emissiveIntensity = 1.6 * f; }
  }
  for (const ln of lanterns) {
    ln.glow.visible = ln.mesh.visible = lampsOn;
    if (lampsOn) {
      ln.glow.material.opacity = L.lamp * 0.9;
      ln.mesh.material.emissiveIntensity = 0.05 + L.lamp * 1.3;
    }
  }
  stringLights.group.visible = lampsOn;
  if (lampsOn) stringLights.bulbMat.opacity = L.lamp * (0.72 + 0.28 * Math.sin(t * 3.2));
  for (const car of cars) {
    for (const h of car.userData.headlights) {
      h.visible = lampsOn;
      if (lampsOn) h.material.opacity = L.lamp * 0.8;
    }
  }
  // 萤火虫（会亲近玩家，白天隐藏）
  fireflies.visible = nightF > 0.02;
  if (fireflies.visible) {
    const pos = fireflies.geometry.attributes.position;
    const seeds = fireflies.userData.seeds;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      let fx = s.x + Math.sin(t * 0.4 * s.s + s.p1) * 2.2 + Math.sin(t * 0.9 + s.p2) * 0.8;
      let fz = s.z + Math.cos(t * 0.33 * s.s + s.p2) * 2.2 + Math.cos(t * 0.7 + s.p1) * 0.8;
      let fy = s.y + Math.sin(t * 0.8 + s.p1 * 2) * 0.5;
      const pd = Math.hypot(player.position.x - fx, player.position.z - fz);
      if (pd < 2.5) {
        const oa = t * 1.2 + i;
        fx = player.position.x + Math.cos(oa) * 1.4;
        fz = player.position.z + Math.sin(oa) * 1.4;
        fy = player.position.y + 1.2 + Math.sin(t * 2 + i) * 0.4;
      }
      pos.setXYZ(i, fx, fy, fz);
    }
    pos.needsUpdate = true;
    fireflies.material.opacity = nightF * 0.9 * fireflyBoost * (0.7 + 0.3 * Math.sin(t * 2.4));
  }
  // 天灯
  for (let i = skyLanterns.length - 1; i >= 0; i--) {
    const sl = skyLanterns[i];
    const u = sl.userData;
    if (u.delay > 0) { u.delay -= dt; continue; }
    sl.visible = true;
    sl.position.y += u.vy * dt;
    sl.position.x += (u.dx + Math.sin(t * 0.8 + u.sway) * 0.2) * dt;
    sl.position.z += u.dz * dt;
    sl.rotation.z = Math.sin(t * 1.1 + u.sway) * 0.07;
    u.body.material.emissiveIntensity = 1.3 + Math.sin(t * 8 + u.sway) * 0.25;
    if (sl.position.y > 70) {
      const fade = Math.max(0, 1 - (sl.position.y - 70) / 8);
      u.body.material.opacity = fade;
      u.glow.material.opacity = fade * 0.85;
      if (sl.position.y > 78) {
        scene.remove(sl);
        u.body.geometry.dispose(); u.body.material.dispose(); u.glow.material.dispose();
        skyLanterns.splice(i, 1);
      }
    }
  }
  // 烟花
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const fw = fireworks[i];
    fw.age += dt;
    const pos = fw.pts.geometry.attributes.position;
    for (let k = 0; k < fw.vel.length; k++) {
      fw.vel[k].y -= 5.5 * dt;
      pos.setXYZ(k, pos.getX(k) + fw.vel[k].x * dt, pos.getY(k) + fw.vel[k].y * dt, pos.getZ(k) + fw.vel[k].z * dt);
    }
    pos.needsUpdate = true;
    fw.pts.material.opacity = Math.max(0, 1 - fw.age / fw.life);
    if (fw.age >= fw.life) {
      scene.remove(fw.pts);
      fw.pts.geometry.dispose(); fw.pts.material.dispose();
      fireworks.splice(i, 1);
    }
  }
  // 天灯节进程
  if (festival.active) {
    festival.t += dt;
    if (festival.lineIdx < FESTIVAL_LINES.length && festival.t > FESTIVAL_LINE_AT[festival.lineIdx]) {
      showStory(FESTIVAL_LINES[festival.lineIdx]);
      festival.lineIdx++;
    }
    festival.fwTimer -= dt;
    if (festival.fwTimer <= 0) {
      festival.fwTimer = rand(3.5, 5.5);
      launchFirework(rand(-40, 40), rand(-55, -25));
    }
    if (Math.hypot(player.position.x, player.position.z) < 26) {
      festival.watchT += dt;
      if (festival.watchT > 18) questEvent('watch');
    }
    if (festival.t > 85) {
      const wq = currentQuest();
      if (wq && wq.objective.type === 'watch') {
        // 玩家还没看够——天灯节不散场，继续放烟花等你回广场
        festival.t = 62;
      } else {
        endFestival();
      }
    }
  }
  // 任务对象逻辑
  const aq = currentQuest();
  if (aq) {
    const o = aq.objective;
    if (o.type === 'visit' && o.loc) {
      if (visitBeacon) visitBeacon.rotation.y += dt * 0.5;
      if (Math.hypot(player.position.x - o.loc.x, player.position.z - o.loc.z) < o.loc.r) questEvent('visit');
    }
    if (o.type === 'lamps') {
      for (const l of questState.lampTargets) {
        if (!l.lit && Math.hypot(player.position.x - l.x, player.position.z - l.z) < 2.6) {
          l.lit = true;
          playNote(1046.5, 0.09, 0.9);
          spawnHeart(new THREE.Vector3(l.x, 4.6, l.z));
          questEvent('lamps');
        }
      }
    }
    if (o.type === 'pet') {
      questState.petCd -= dt;
      const dDog = player.position.distanceTo(dog.position);
      if (dDog < 2.6 && questState.petCd <= 0) {
        questState.petT += dt;
        if (questState.petT > 0.7) {
          questState.petT = 0; questState.petCd = 2.2;
          spawnHeart(dog.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
          playNote(880, 0.07, 0.5);
          dogState.petWiggle = 1;
          addHappiness(1);
          questEvent('pet');
        }
      } else if (dDog >= 2.6) questState.petT = 0;
    }
    if (o.type === 'deliver' && letterPickup) {
      letterPickup.rotation.y += dt * 1.5;
      letterPickup.position.y = 1.7 + Math.sin(t * 2) * 0.2;
      if (!questState.carrying && player.position.distanceTo(letterPickup.position) < 2.3) {
        questState.carrying = true;
        letterPickup.visible = false;
        const Lt = LETTERS[questState.letterIdx];
        showToast(`✉️ 拾起了${Lt.from}的信：「${Lt.text}」`, 5600);
      }
      if (letterMarker) {
        const tv = villagers[LETTER_TARGETS[questState.letterIdx % LETTER_TARGETS.length]];
        letterMarker.position.set(tv.position.x, tv.position.y + 2.7, tv.position.z);
        letterMarker.visible = questState.carrying;
        if (questState.carrying && player.position.distanceTo(tv.position) < 2.8) {
          const Lt = LETTERS[questState.letterIdx];
          showToast(`💌 ${Lt.to}收到了信，笑得眼睛弯成了月牙。`);
          spawnHeart(tv.position.clone().add(new THREE.Vector3(0, 2.3, 0)));
          playChime();
          addHappiness(1);
          questState.letterIdx++;
          questState.carrying = false;
          questEvent('deliver');
          if (currentQuest()?.objective.type === 'deliver') {
            scene.remove(letterPickup);
            spawnLetter(questState.letterIdx);
          }
        }
      }
    }
  }
  // 长椅小憩
  benchCd -= dt;
  if (!moving && playerState.grounded) {
    let nearBench = false;
    for (const [bx, bz] of BENCH_SPOTS) {
      if (Math.hypot(player.position.x - bx, player.position.z - bz) < 2.0) { nearBench = true; break; }
    }
    if (nearBench) {
      benchRestT += dt;
      if (benchRestT > 2.5 && benchCd <= 0) {
        benchCd = 40;
        addHappiness(2);
        showStory('坐一会儿吧。云在走，你不用。');
        [392.0, 523.25].forEach((f, i) => setTimeout(() => playNote(f, 0.06, 2.6), i * 400));
      }
    } else benchRestT = 0;
  } else benchRestT = 0;
  // 脚印开花（幸福度 50 之后，走过的路会留下花）
  if (happiness >= 50 && moving && playerState.grounded) {
    footCd -= dt;
    if (footCd <= 0) { footCd = 0.5; dropFootFlower(); }
  }
  for (let i = footFlowers.length - 1; i >= 0; i--) {
    const ff = footFlowers[i];
    ff.age += dt;
    if (ff.age < 0.4) ff.m.scale.setScalar(ff.age / 0.4);
    if (ff.age > 12) {
      ff.m.material.opacity = Math.max(0, 1 - (ff.age - 12) / 2);
      if (ff.age > 14) { scene.remove(ff.m); footFlowers.splice(i, 1); }
    }
  }
  // 广场花环生长（幸福度 50 里程碑）
  if (bloomFlowers && bloomFlowers.growth < 1) {
    bloomFlowers.growth = Math.min(1, bloomFlowers.growth + dt * 0.5);
    const bfDummy = new THREE.Object3D();
    for (let i = 0; i < bloomFlowers.seeds.length; i++) {
      const s = bloomFlowers.seeds[i];
      bfDummy.position.set(s.x, 0.3, s.z);
      bfDummy.scale.setScalar(0.01 + bloomFlowers.growth * s.s);
      bfDummy.updateMatrix();
      bloomFlowers.inst.setMatrixAt(i, bfDummy.matrix);
    }
    bloomFlowers.inst.instanceMatrix.needsUpdate = true;
  }
  // 流星（星夜限定）
  if (nightF > 0.85 && !meteor) {
    meteorCd -= dt;
    if (meteorCd <= 0) {
      meteorCd = rand(30, 55);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
      }));
      s.scale.set(9, 0.7, 1);
      s.position.set(player.position.x + rand(-60, 60), rand(90, 130), player.position.z - rand(80, 140));
      meteor = { s, age: 0 };
      scene.add(s);
    }
  }
  if (meteor) {
    meteor.age += dt;
    meteor.s.position.x += 55 * dt;
    meteor.s.position.y -= 26 * dt;
    meteor.s.material.opacity = Math.max(0, 0.9 - meteor.age * 0.75);
    if (meteor.age > 1.3) { scene.remove(meteor.s); meteor = null; }
  }
  // 小狗被摸时开心地摇
  if (dogState.petWiggle > 0) {
    dog.rotation.z = Math.sin(t * 26) * 0.14 * dogState.petWiggle;
    dogState.petWiggle = Math.max(0, dogState.petWiggle - dt * 1.1);
  } else {
    dog.rotation.z = 0;
  }

  if (forcedDt === undefined) {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }
}

function animate() {
  requestAnimationFrame(animate);
  tick();
}
animate();
// 兜底：rAF 被节流时补帧，但隐藏标签页不渲染（省电、不做无人可见的绘制）
setInterval(() => {
  if (document.hidden) return;
  if (performance.now() - lastTickMs > 100) tick();
}, 50);

// ---------- 窗口自适应 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
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
  // —— 时间 / 任务 / 幸福度（新系统钩子） ——
  get worldTime() { return +TIME.t.toFixed(4); },
  setTime(v) { TIME.t = ((v % 1) + 1) % 1; TIME.tlTarget = null; TIME.scale = 1; },
  get timeScale() { return TIME.scale; },
  get phase() { return phaseOf(TIME.t).name; },
  get nightF() { return +lastNightF.toFixed(2); },
  get questIndex() { return questIdx; },
  get questId() { return currentQuest()?.id ?? null; },
  get questProgress() {
    const q = currentQuest();
    if (!q) return null;
    return [Math.min(q.objective.type === 'collect' ? collected : questProg, q.objective.count), q.objective.count];
  },
  get happiness() { return Math.round(happiness); },
  get festivalActive() { return festival.active; },
  get skyLanternCount() { return skyLanterns.length; },
  get fireworkCount() { return fireworks.length; },
  lampsLit() { return lamps.filter(l => l.lit).length; },
  get orbsActive() { return orbsActive; },
  // —— 存档 / 暂停 / 设置（Steam 化基建） ——
  get paused() { return paused; },
  get journeyDone() { return journeyDone; },
  saveNow() { saveGame(); },
  clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} },
  hardReset() { window.__hardReset(); },
  savedState() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { return null; } },
  setPausedCheat(p) { setPaused(p); },
  get settingsState() { return { ...settings }; },
  lampTargetPositions() { return (questState.lampTargets || []).filter(l => !l.lit).map(l => [l.x, l.z]); },
  letterInfo() {
    const tv = villagers[LETTER_TARGETS[questState.letterIdx % LETTER_TARGETS.length]];
    return {
      idx: questState.letterIdx, carrying: questState.carrying,
      pickup: letterPickup && letterPickup.visible ? [letterPickup.position.x, letterPickup.position.z] : null,
      target: tv ? [tv.position.x, tv.position.z] : null,
    };
  },
  get starOpacity() { return +stars.material.opacity.toFixed(2); },
  get bloomOn() { return !!composer; },
  completeQuestCheat() { if (currentQuest()) completeQuest(); },
  // 确定性步进：绕过浏览器后台节流，逐帧推进游戏逻辑（结束后渲染一帧）
  step(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) tick(dt);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  },
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
