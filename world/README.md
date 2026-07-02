# 《Chole 之境》— 造物主 Chole 的世界

一个特别幸福、特别美好的浏览器开放世界游戏。没有战斗、没有失败、没有时间压力——
只有 Chole 为你创造的草原、樱花、浮空岛，和她留给你的十二句温柔的话。

## 运行

```bash
cd chole-world
python3 -m http.server 8934
# 浏览器打开 http://localhost:8934
```

（Three.js 已本地化在 `lib/`，无需联网。）

## 玩法

- **WASD / 方向键** 移动，**空格** 跳跃，**拖动鼠标** 转动视角，**滚轮** 缩放
- 靠近发光的 **光之祝福** 自动收集，每一份都是 Chole 对你说的一句话
- 集齐 12 份 → Chole 降下彩虹 🌈
- 中央光柱处是 **Chole 的圣所**；靠近兔子它们会对你冒爱心
- 右上角 🔊 可静音（音乐为 WebAudio 程序化生成的五声音阶环境音）

## 美术资产（完整美术版，均为 CC0 可商用免署名）

| 内容 | 来源 |
|------|------|
| 松树/阔叶树、岩石、睡莲、云 | [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0)（Kay Lousberg） |
| 玩家（兜帽游侠，带 idle/走路/跳跃骨骼动画） | [KayKit Character Pack: Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) |
| 飞鸟（火烈鸟/鹦鹉/鹳，带飞行动画） | [three.js 官方示例模型](https://github.com/mrdoob/three.js)（mirada） |

樱花树、兔子、蝴蝶、圣所、浮空岛、光球、彩虹保留程序化建模——它们是这个世界的灵魂。
纯程序化旧版备份在 `main-procedural.js.bak`。

## 文件

- `DESIGN.md` — 调研结论 + 完整游戏/美术/验收设计
- `index.html` — 页面骨架与 HUD
- `main.js` — 世界生成、glTF 资产管线、生物 AI、收集系统、音频
