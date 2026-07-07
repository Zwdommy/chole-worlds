# 《Chole 之城》Steam 上架调研报告

**制作人综合报告 | 2026-07 | 数据来源：三份专项调研（竞品/技术/流程）+ 本轮 8 次联网复核**

本轮复核已直接验证的关键数字：Steam Direct 每款 $100、$1,000 收入后可回收（[官方文档](https://partner.steamgames.com/doc/gettingstarted/appfee)）；缴费后 30 天等待期（[Steam Direct 页](https://partner.steamgames.com/steamdirect)）；Coming Soon 须挂满 2 周、商店页审核 3-5 个工作日（[官方文档](https://partner.steamgames.com/doc/store/releasing)）；首发折扣上限 40% 且须持续 7-14 天、发售后 30 天禁折（[官方文档](https://partner.steamgames.com/doc/marketing/discounts)）；Next Fest 一生一次（[官方文档](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest)）；steamworks.js 仍在维护（[GitHub](https://github.com/ceifa/steamworks.js/)）。

---

## 1. 竞品对标表与"特别好评及格线"

### 1.1 七款治愈系竞品对标（数据为 2026-07 抓取）

| 游戏 | 原价 | 主线时长 | 评价档位（好评率/条数） | 内容骨架 | 第一名差评 |
|---|---|---|---|---|---|
| [A Short Hike](https://store.steampowered.com/app/1055540/A_Short_Hike/) | $7.99 | 约 2.5h（100% 4-6h，[TheGamer](https://www.thegamer.com/a-short-hike-how-long-to-beat-completion-time/)） | 好评如潮 99% / 12,399 条（英文） | 单岛多区域；20 金羽+30 贝壳+4 藏宝图；十余 NPC 支线；招牌滑翔/攀爬 | 太短 |
| [Alba](https://store.steampowered.com/app/1337010/Alba_A_Wildlife_Adventure/) | $16.99（常年深折至 $3.39） | 约 3h | 好评如潮 97% / 3,149 条 | 单岛；62 种动物拍照图鉴；7 天结构任务线 | 太短；小 bug |
| [Lil Gator Game](https://store.steampowered.com/app/1586800/Lil_Gator_Game/) | $19.99 | 约 3.5h（100% 约 5h，[TheGamer](https://www.thegamer.com/lil-gator-game-how-long-does-to-beat/)） | 好评如潮 98% / 3,976 条 | 单岛多风格区；数十个可交友 NPC；攀爬/滑翔/盾滑 | 太简单；无地图 |
| [Townscaper](https://store.steampowered.com/app/1291340/Townscaper/) | $5.99 | 沙盒无尽头（单次 1-3h，未核实——不确定） | 好评如潮 95% / 约 19,994 条（近 30 天已跌至 88%） | 纯建造玩具，无任务无叙事；商店页明示"toy 而非 game" | 没有玩法/进度 |
| [Cloud Gardens](https://store.steampowered.com/app/1372320/Cloud_Gardens/) | $17.99 | 战役约 6h（[Hey Poor Player](https://www.heypoorplayer.com/2021/09/05/cloud-gardens-review-pc/)，早期版本实测） | 好评如潮 95% / 2,091 条 | 100+ 手工小关卡 + 沙盒 | 操作不精准；后期重复 |
| [Haven Park](https://store.steampowered.com/app/1549550/Haven_Park/) | $8.99 | 约 3.5h（完美 4.5h） | 好评如潮 95% / 881 条 | 单岛公园；营地建造+经营 lite；露营者支线 | **固定相机不能旋转** |
| [Smushi Come Home](https://store.steampowered.com/app/1740300/Smushi_Come_Home/) | $19.99 | 约 3.5h（[Deku Deals/HLTB](https://www.dekudeals.com/items/smushi-come-home)） | 好评如潮 98% / 1,757 条（英文） | 三大区域；水晶+皮肤+蘑菇图鉴；25 个成就 | **价格配时长偏贵** |

### 1.2 "特别好评"及格线结论

**评级机制**（社区公认标准，Valve 未官方公布——低不确定）：特别好评 = 好评率 ≥85% 且 ≥50 条评测；好评如潮 = ≥95% 且 ≥500 条（来源：[Steam Review Rescue](https://www.steamreviewrescue.com/blog/steam-review-score-tiers-explained)、[SteamDB](https://steamdb.info/blog/steamdb-rating/)，本轮搜索复核多个第三方来源口径一致）。评级门槛本身不高，**真正的门槛是内容量/打磨度/定价三者匹配**。

从 7 款竞品归纳的及格线：

- **内容量**：主线 ≥2.5 小时是付费治愈游戏的事实下限（7 款中 5 款落在 2.5-3.5h 带内），100% 路线撑到 4-6 小时。注意：即使达标，"太短"仍是这批游戏的头号差评——它们是靠其余方面 97-99% 的口碑硬压下去的。
- **结构标配**：一张手工感强的高密度地图（3+ 风格区域）；2-3 类收集品合计约 50-100 个点位；15-30 个 NPC 支线/互动；一个"走路本身就好玩"的招牌移动机制（滑翔/攀爬几乎是标配）。
- **打磨标配**：可旋转相机（Haven Park 的固定相机是其最大差评源）、手柄+键鼠双支持、成就+云存档、多语言、无卡场景 bug、强辨识度美术签名。
- **价格带**：≤4 小时内容的安全带是 $5.99-$9.99（A Short Hike/Townscaper/Haven Park 几乎零价格抱怨）；定 $14.99-$19.99 的三款要么被点名"贵"（Smushi），要么靠 50-80% 深折走量（Alba）。**我们这个体量的新作首发建议 $4.99-$7.99，上限 $9.99。**

---

## 2. 我们 vs 及格线：诚实差距评估

结论先行：**《Chole 之城》当前体量（25-40 分钟、无存档档位、无成就、无手柄、无英文）距付费上架及格线有系统性差距，直接付费上架大概率因"太短"落入多半好评或更低；但骨架方向正确，差距是可量化、可排期的。**

| 维度 | 及格线 | 我们现状 | 差距定性 |
|---|---|---|---|
| 主线时长 | ≥2.5h，100% 4-6h | 25-40 分钟 | **差 4-6 倍**。当前体量只够格做免费游戏或付费版的 Demo/序章。且 25-40 分钟完全落在 Steam 2 小时无条件退款窗口内，差评+退款双重风险 |
| 收集/任务密度 | 50-100 个收集点位 + 15-30 个 NPC 支线 | 幸福度/集光是正确雏形 | **差一个数量级**。八章结构是好骨架，每章需从"单一动作"扩成"一个区域+一组支线+一类收集" |
| 招牌移动机制 | 滑翔/攀爬类"移动本身好玩" | 纯走路+触发交互 | **缺位**。建议加滑翔（与天灯节/彩虹章节题材天然契合） |
| 相机 | 可旋转 | 待确认/需实现 | Haven Park 用最大差评源验证过这条红线 |
| 存档 | 存档+云存档 | 无存档档位 | 必须做。且要为 Steam Cloud 做文件化存档（见第 3 节） |
| 成就 | 标配（Smushi 25 个） | 无 | 八章主线+摸狗/集光天然对应 10-15 个成就，工作量小 |
| 手柄 | 双输入+Steam Deck 目标 | 仅键鼠+触屏 | 触屏输入抽象层是好基础，加一条 Gamepad 通道 |
| 语言 | 中英双语起步 | 纯中文 | 2024 年简中活跃账号占比 33.7% 首超英文 33.5%（Valve GDC 2025 披露，转引自 [GamingOnLinux](https://www.gamingonlinux.com/2026/03/steam-survey-for-february-2026-shows-a-big-swing-to-simplified-chinese/)），中英两项即覆盖约三分之二用户。我们无配音，只需翻 UI+八章旁白，勾"界面+字幕"两档即可（[本地化文档](https://partner.steamgames.com/doc/store/localization)） |
| 美术辨识度 | 7 款竞品全部有独一无二的视觉签名 | KayKit CC0 + 糖果色 + Bloom | **风险项**：KayKit 可能被识别为"素材包游戏"。糖果色+Bloom 方向正确，但主角/关键 NPC/地标建议原创或深度重制 |
| 评测数量 | 特别好评需 ≥50 条评测 | — | 约对应首月数百份销量，必须靠 Demo+愿望单积累（见第 4 节） |

**独有的额外工程量**：竞品全是原生引擎，我们是 Three.js 网页游戏，桌面打包（Electron 封装、离线运行、Overlay、帧率与内存稳定性）是别人没有的一整块工作，详见第 3 节。

**我们的优势**：中文文案原生（国区 cozy 需求大且竞品中文质量普遍一般）；WebAudio 程序化音乐无版权负担；网页版可保留为营销入口（Bitburner 验证过双轨发行可行）。

---

## 3. 推荐技术路径（明确选择）

### 3.1 选型结论

**主路线：Electron + steamworks.js（ceifa）+ electron-builder（GitHub Actions 出三平台包），首发以 Windows 为主。**

- **选 Electron，不选 Tauri**：Tauri 的致命伤是使用系统 WebView（Windows=WebView2），Steam Overlay 无法挂钩其渲染管线，官方 issue 与 Construct 团队实测均未解决，已有开发者因此放弃（[tauri#6196](https://github.com/tauri-apps/tauri/issues/6196)、[Construct 博客](https://www.construct.net/en/blogs/ashleys-blog-2/trying-show-steam-overlay-1861)）。Electron 自带固定版本 Chromium，Three.js/WebGL 渲染一致性和性能最好，是 web 游戏上 Steam 的事实标准（[webgamedev.com](https://www.webgamedev.com/publishing/desktop)、[Phaser 官方 2025 教程](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron)）。Electron 100MB+ 包体对本作体量完全可接受。NW.js 仅作备选（CrossCode/Melvor Idle 验证过，但社区弱且有[版本性能回退史](https://steamcommunity.com/app/368340/discussions/0/357287935540766273/)）。
- **选 steamworks.js，不选 Greenworks**：Greenworks 已停止维护（[其 README 与 ceifa 的说明](https://github.com/ceifa/steamworks.js/)）。**取舍说明**：本轮一条搜索摘要称 steamworks.js "不再维护"，经直接核对 GitHub 原文，该表述实为其 README 中对 Greenworks 的评价，steamworks.js 本身通过 npm 分发、含 TypeScript 定义、有持续构建——以 GitHub 一手来源为准，判定为活跃可用。注意它要求 `nodeIntegration: true` + `contextIsolation: false`，牺牲部分进程隔离（离线单机游戏可接受）。

### 3.2 落地顺序（工程 checklist）

1. **存档文件化**：localStorage 迁移为 Node fs 写文件，然后在 Steamworks 后台配 Auto-Cloud 路径即获云存档，零代码（[Steam Cloud 文档](https://partner.steamgames.com/doc/features/cloud)）。
2. **游戏循环改固定时间步长**：requestAnimationFrame 跟随显示器刷新率，144Hz 玩家的 8 分钟昼夜循环和幸福度累积会快 2.4 倍——必须改真实时间驱动（[参考](https://chriscourses.com/blog/standardize-your-javascript-games-framerate-for-different-monitors)）。这是网页游戏搬桌面最常见的实机 bug。
3. **接成就**：steamworks.js `client.achievement.activate()`，后台配置 10-15 个成就点位。
4. **调通 Windows Overlay**：`in-process-gpu` + `disable-direct-composition`，用 steamworks.js 的 `electronEnableSteamOverlay()`；锁定验证过的 Electron 版本，避开 Electron 35 的 overlay 回归报告（[electron#47662](https://github.com/electron/electron/issues/47662)，开放 issue）；暂停/结算等静态界面不停渲染循环，否则 overlay 冻结（[参考](https://jake.software/enabling-the-steam-overlay-in-an-electron-app)）。macOS/Linux overlay 有已知生态缺陷（[electron#42656](https://github.com/electron/electron/issues/42656)、[steamworks.js#195](https://github.com/ceifa/steamworks.js/issues/195)），首发商店页注明即可。
5. **手柄通道**：标准 Gamepad API + Xbox 布局映射；后台把 Steam Input 默认设为直通，规避 Electron 的 Steam Input 检测回归 bug（[electron#45989](https://github.com/electron/electron/issues/45989)）。
6. **软渲染检测降级**：启动时读 `WEBGL_debug_renderer_info`，检测到 SwiftShader 就自动关 Bloom/降分辨率并温柔提示（CrossCode "高配也卡"的教训，[来源](https://steamcommunity.com/app/368340/discussions/0/357287935540766273/)）；同时监听 `webglcontextlost`，严格 dispose Bloom 的 EffectComposer 资源（[three.js#11435](https://github.com/mrdoob/three.js/issues/11435)）。
7. **真机回归**：Windows 下 WebGL 经 ANGLE 转 D3D11，必须在真实低配 Windows 机上测试，不能只测浏览器。

---

## 4. 上架流程 Checklist（按时间顺序）

**总现金成本极低（约 $100 + 素材/翻译外包费）；总日历周期由内容扩充决定，流程本身的硬性等待约 6-8 周。**

### T-6 ~ T-4 个月：入驻与内容冲刺
- [ ] 注册 Steamworks 账号，签数字分销协议、税务问卷、银行信息（户名须与法定姓名一致；个人可以 sole proprietor 入驻；税务验证 2-7 个工作日）（[入驻文档](https://partner.steamgames.com/doc/gettingstarted/onboarding)）。中国大陆个人：税务问卷选非美国人，TIN 填身份证号，据中美税收协定预扣税 10%（不填则 30%）（[官方税务 FAQ](https://partner.steamgames.com/doc/finance/taxfaq?l=schinese)；结汇 5 万美元便利化额度等为[社区经验帖](https://zhuanlan.zhihu.com/p/390294658)，请自行复核）。
- [ ] 缴 **$100/款** Steam Direct 费（不可退，游戏收入达 $1,000 后返还，[已复核](https://partner.steamgames.com/doc/gettingstarted/appfee)）。**注意缴费即触发 30 天发售等待期，宜早缴**（[已复核](https://partner.steamgames.com/steamdirect)）。
- [ ] 并行推进第 2 节内容扩充（这是真正的排期主体）与第 3 节工程项。

### T-4 ~ T-3 个月：商店页上线攒愿望单
- [ ] 制作商店素材：Header 920x430、Small 462x174、Main 1232x706、Vertical 748x896（Capsule 上除标题/logo 外禁止任何文字）；Library 四件套 600x900 / 920x430 / 3840x1240 / 透明 logo（[资产规范](https://partner.steamgames.com/doc/store/assets/standard)、[Library 规范](https://partner.steamgames.com/doc/store/assets/libraryassets)）。
- [ ] ≥5 张 1920x1080 真实游玩截图（开桌面 Bloom 截）+ 至少 1 支预告片（≤1080p、30/60fps、5000+ Kbps，[规范](https://partner.steamgames.com/doc/store/trailer)）。
- [ ] 完成内容分级问卷（自动生成巴西/德国法定分级；**开发中用过生成式 AI 的美术/代码/文案必须如实勾选披露**，虚假填报有下架风险）（[问卷文档](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)、[AI 政策](https://store.steampowered.com/news/group/4145017/view/3862463747997849618)）。
- [ ] 提交商店页审核（3-5 个工作日，建议留 7 天，[已复核](https://partner.steamgames.com/doc/store/releasing)），以 Coming Soon 挂出——**至少满 2 周才能发售**，实际建议挂 2-4 个月攒愿望单。商店页描述的功能（八章、昼夜循环、旁白等）必须在 Build 中真实存在，语言只勾中文"界面+字幕"+英文"界面+字幕"。

### T-3 ~ T-1 个月：Demo 与 Next Fest
- [ ] 上线免费 Demo（独立 AppID）——把当前 25-40 分钟版本改造为 Demo 是最优复用。
- [ ] 报名一届 Next Fest（**一生一次，游戏须在该届结束后才发售，Demo 须提前 2 周提交审核**，[已复核](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest)）。Chris Zukowski 对 2025 年 2 月场 208 团队的调查显示带 ≥2,000 愿望单进场才有明显收益（[presskit.gg](https://presskit.gg/field-guides/how-to-build-steam-wishlist)）。
- [ ] 愿望单目标：首周销量中位数约为发售时愿望单数的 0.15 倍（GameDiscoverCo 2024-2025，>2.5 万样本，[来源](https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions)）。要拿"特别好评"所需的 ≥50 条评测，按常见评测率倒推首月需数百份销量，对应发售时数千愿望单。"热门即将推出"门槛约 7,000 愿望单（第三方估算，[presskit.gg](https://presskit.gg/field-guides/how-many-wishlists-to-launch)——不确定）。

### T-1 个月 ~ 发售
- [ ] 提交正式 Build 审核（须在所有勾选 OS 上正常启动；建议只勾 Windows 起步）（[审核文档](https://partner.steamgames.com/doc/store/review_process)）。
- [ ] 定价：美区 $4.99-$6.99（基于竞品价格带的推断，非官方结论）；国区用 Valve 区域定价建议工具。**发售后 30 天不可改基价。**
- [ ] 配置首发折扣：上限 40%、须发售前配好、须持续 7-14 天；发售后 30 天内无其他折扣（[已复核](https://partner.steamgames.com/doc/marketing/discounts)）。惯例折 10%-20%。
- [ ] Next Fest 结束后 1-3 个月内点击发售。

---

## 5. 风险清单

| # | 风险 | 概率 | 缓解 |
|---|---|---|---|
| 1 | **"太短"差评 + 2 小时退款窗口**：当前 25-40 分钟可在退款窗口内全程通关，付费上架直接触发"demo 卖钱"式差评 | 高（不扩内容则近乎必然） | 内容扩到主线 ≥2.5h 再谈付费；当前版本转为免费 Demo；低价+商店页明示"短篇治愈"管理预期（Townscaper 靠预期管理保住 95%） |
| 2 | **KayKit 素材被识别为"素材包游戏"** | 中 | CC0 商用完全合法（[KayKit 官方](https://kaylousberg.itch.io/kaykit-adventurers)），法律无风险但口碑有；主角/关键 NPC/地标原创重制，靠糖果色+Bloom+程序音乐建立签名；保留 credits 页 |
| 3 | **Electron 生态坑**：Overlay 回归（electron#47662）、Steam Input 手柄检测 bug（electron#45989）、macOS/Linux overlay 缺失 | 中 | 锁定验证过的 Electron 版本；Steam Input 默认直通；首发只上 Windows，mac/Linux 后补并在商店页注明；均为开放 issue，以自测为准 |
| 4 | **软件渲染/GPU 兼容**：部分玩家机器掉入 SwiftShader 导致"高配也卡"（CrossCode 实证） | 中低 | 启动时检测 renderer 字符串自动降级 Bloom；Chromium 已弃用 SwiftShader 自动回退（[来源](https://issues.chromium.org/issues/40277080)），还需处理 WebGL 创建直接失败的提示路径 |
| 5 | **帧率相关逻辑 bug**：高刷屏下昼夜循环/幸福度加速 | 高（不改必现） | 全部逻辑改 delta time/固定时间步长，属确定性工程项，尽早做 |
| 6 | **愿望单不足 → 评测数不足 → 拿不到"特别好评"标签**（需 ≥50 条） | 中高 | Coming Soon 早挂 + Demo + Next Fest 三件套；网页版导流；中文 cozy 社区（B站/小红书）是差异化渠道 |
| 7 | **英文本地化质量差招差评** | 中 | 文本量小（UI+八章旁白），预算内请母语者润色；只勾"界面+字幕"两档不勾 Full Audio，避免超承诺 |
| 8 | **AI 内容披露不实** | 低（但后果重） | 开发中任何 AI 生成的美术/代码/文案在 Content Survey 如实勾选；披露标签在 cozy 品类影响有限，隐瞒被发现才是下架级风险 |
| 9 | **国区可访问性政策变化**（Steam 国际版在大陆的可访问性存在政策不确定性——本次未查证到官方口径） | 不确定 | 无法主动缓解；收入预期不押注单一国区，中英双语对冲 |
| 10 | **个人收款/税务合规**（中国大陆个人开发者路径部分依据社区经验帖） | 低 | 按官方税务 FAQ 填 W-8BEN 等效信息享 10% 预扣；收入若上量再注册公司主体；经验帖内容发售前自行复核一遍 |

**制作人总结**：不建议按当前体量直接付费上架。现实路径 = 当前版本转 Demo → 内容扩 4-6 倍（每章一个区域+支线+收集，加滑翔）→ 补齐相机/存档/成就/手柄/英文 → Electron+steamworks.js 打包 → Next Fest 攒数千愿望单 → 以 $4.99-$6.99 首发冲特别好评。流程硬成本约 $100 与 6-8 周等待期，真正的成本在内容扩充这一项上。