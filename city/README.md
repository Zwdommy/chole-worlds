# 《Chole 之城》— 造物主 Chole 的城市（完整美术版）

Chole 在云海之上造了一座糖果色小城。街灯永远提前为你点亮，车永远停下来让你先走，
长椅永远有你的位置。集齐 12 份光之祝福，她会用一道彩虹拥抱你。

## 运行

```bash
cd chole-city
python3 -m http.server 8935
# 浏览器打开 http://localhost:8935
```

（Three.js 与全部模型均已本地化，无需联网。）

## 玩法

- **WASD / 方向键** 移动，**空格** 跳跃，**拖动鼠标** 转视角，**滚轮** 缩放
- 收集 12 份 **光之祝福** → 彩虹横跨全城 🌈；靠近钟楼触发 Chole 的问候
- 小车会礼貌停下让你；居民（骑士/法师/游侠/野蛮人）散步时靠近会冒爱心
- 广场有鸽子和喷泉，天上有热气球、火烈鸟、鹦鹉和鹳绕城飞翔
- 右上角 🔊 静音

## 美术资产（均为 CC0，可商用免署名）

| 内容 | 来源 |
|------|------|
| 建筑 ×8、车 ×4、路灯/长椅/盆栽/消防栓/水塔 | [KayKit City Builder Bits](https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0)（Kay Lousberg） |
| 树木/岩石/睡莲/云 | [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) |
| 玩家（兜帽游侠）与居民角色（带骨骼动画） | [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) |
| 飞鸟（火烈鸟/鹦鹉/鹳，带飞行动画） | [three.js 官方示例模型](https://github.com/mrdoob/three.js)（mirada, CC 授权随 three.js 分发） |

钟楼、喷泉、彩虹、光球、热气球、鸽子为程序化建模（与资产风格统一的低多边形）。

## 技术

- glTF 管线：GLTFLoader + SkeletonUtils 骨骼克隆；角色动画混合（idle/walk 淡入淡出）
- 模板归一化系统：任意模型自动缩放到目标尺寸、贴地、居中，并生成碰撞半径
- 车辆让行 AI、居民巡路 AI、相机避障（视线射线 × 障碍圆求交自动拉近）
- 性能：约 325 draw calls / 13 万三角形，实测 500+ FPS
- `window.__game` 自动化验收钩子（benchmark / obstacleTest / 动画状态等）

旧的纯程序化版本保留在 `main-procedural.js.bak`。
