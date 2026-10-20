# 夜画 Night Canvas · 交互式可视化

一台床头树莓派：夜里用红外视觉记录翻身和睡姿，用声音模型识别鼾声和环境噪音，第二天早上根据这些事件生成一幅画；原始画面不保存。本目录是这个作品集项目的电子部分 3D 模型和原理演示。

## 打开方式

- **入口：`index.html`**，双击即可用浏览器打开（Chrome / Edge 最佳）。
- 设备 3D 模型需要联网：three.js 0.170 来自 jsDelivr，字体来自 Google Fonts。原理图和引导插图可以离线运行。
- 设备页旁边的 `machine/night-canvas-parts.glb.js` 是 Blender 做的细节零件，要和页面放在一起；缺了它，页面会自动退回到代码拼的简化零件。
- 三个可视化都能单独打开：
  - `machine/night-canvas-device.html`：设备 3D 模型
  - `anatomy/night-recorder.html`：原理图（浅色版是 `night-recorder-light.html`）
  - `hairline/hairline-brush-pot.html`：引导插图（加 `?theme=dark` 用深色）
- 重新生成：
  - 原理图：`node anatomy/build.mjs`，浅色版加 `--light`
  - 引导插图：`node ../hairline/skills/hairline-create/build.mjs hairline/brush-pot.js`（在 `hairline/` 目录里运行）
  - 设备页：改完后运行 `node ../machine/scripts/inline.mjs machine/night-canvas-device.html`，把 kit 重新内联进去
  - 设备零件（Blender 5.2）：
    1. 改了布局或丝印时，先运行 `python blender/make_textures.py`，重画两张贴图（需要 Pillow）。
    2. 在 Blender 里打开 `blender/night-canvas-parts.blend`，在 Python 控制台运行：
       `import sys; sys.path.insert(0, r"<blender 目录的完整路径>"); import build_all; build_all.run()`
    3. 它会重建全部零件、保存 `.blend`、导出 `.glb`，并重新打包成 `machine/night-canvas-parts.glb.js`，约 5 秒。

## 目录

| 路径 | 内容 |
|---|---|
| `index.html` | 集成页：引导插图 → 设备 → 原理图（事件同步到设备）→ 示意画稿 → 参数表 |
| `machine/night-canvas-device.html` | Machine 技能：设备 3D 模型和热、功耗求解器（kit 已内联） |
| `machine/night-canvas-parts.glb.js` | Blender 零件的 GLB（base64），设备页用 `<script>` 加载，因为 file:// 下不能 fetch 本地 `.glb` |
| `blender/` | Blender 建模：`build_pi5.py`、`build_cooler.py`、`build_camera.py`，共用的 `nc_lib.py`、`pi5_layout.py`、`atlas_layout.py`，贴图脚本 `make_textures.py`，一键脚本 `build_all.py`，以及生成的 `.blend`、`.glb`、`tex/` |
| `anatomy/build.mjs`, `anatomy/model.mjs` | Anatomy 技能：原理图的构建脚本和纯函数模型 |
| `anatomy/night-recorder*.html` | 构建出的原理图页面（深色、浅色） |
| `hairline/brush-pot.js` | Hairline 技能：插图源码（引擎和页面未改动） |
| `hairline/hairline-brush-pot*.html/png` | 构建出的页面，以及 look 检查表、盲看图和动作序列图 |
| `shots/` | 各阶段的验证截图 |

## 每个技能做了什么

- **Machine**：真实尺寸（单位 m）的设备，约 460 个零件。包括 Pi 5 主板及端口、40 针 GPIO、Active Cooler（散热片、鼓风机叶轮、推钉）、Camera Module 3 NoIR、六颗 850 nm LED 的环形板、IR 透光窗、22 针转 15 针的 FPC 排线（扭转 90° 穿过立柱，进头部后加宽）、LED 恒流驱动、USB 麦克风、USB-C 供电线和外壳。
  - Pi 5、Active Cooler 和 Camera Module 3 在 Blender 里细化建模（见下一节）；外壳、立柱、头部、LED 环和线缆仍由页面代码生成。
  - 模式：环绕、爆炸、剖切（带截面）、X 光、标签、慢放，以及“风扇停转”故障。
  - 求解器：SoC 集总热模型、Pi 5 固件风扇曲线、80–85 °C 降频、整机功耗、枕头处红外照度、出图时间。
- **Blender 细化零件**（`blender/`，用官方 Blender MCP 在 Blender 5.2 里实时建模）：
  - **Pi 5 主板**（58 个物体）：
    - PCB：带走线、过孔、焊盘、丝印的贴图，正反面都有，板边是 FR-4 色带。
    - 芯片：SoC 是金属顶盖加带小电容的基板，内存、RP1、PMIC、PHY 等芯片有激光刻字和侧面焊端，Flash 和三极管是鸥翼引脚。
    - 端口：USB-A、网口、USB-C、micro HDMI 都是真开口。里面有舌片和金触点，USB 3 是蓝色舌片，USB 口有弹片；网口有指示灯窗、8 根触点和侧面的接地弹片。
    - 插座：两个 MIPI 和一个 PCIe 排线座（带锁扣），JST 小插座，带 V 槽的 GPIO 排针座和尖头针（背面有焊点）。
    - 其他：182 个两端镀锡的贴片阻容，黄铜六角柱，十字盘头螺丝，背面的 microSD 卡座和卡。
  - **Active Cooler**（13 个物体）：铝底板和 13 片鳍片，蜗壳风道和进风口，27 片前弯叶片的叶轮（轮毂贴标签，转轴是原点，页面让它转起来），带弹簧和倒刺的推钉，三块导热垫，四色风扇线和 JST 插头。
  - **Camera Module 3 NoIR**（8 个物体）：正反面印刷的电路板和镀金安装孔，对焦马达方壳、多级镜筒和镜片，背面 15 针排线座、稳压器、晶振和电容，4 颗十字螺丝。
  - 全部零件都是封闭实体，页面的剖切截面照常工作。导出时网格用 MeshOptimizer 压缩，贴图存为 JPEG。
  - 页面按材质名把它们换成页面自己的金属和塑料预设，保持统一的观感，并按材质合并以减少绘制调用。
  - 爆炸、标签、X 光、风扇转动的挂接点都和原来一致。
- **Anatomy**：Fig 2「画就是数据」，一台条形图记录仪。
  - 笔 A 画运动能量（帧差 %），笔 B 画声级（dBA）；数值越过阈值，琥珀色的事件打点器才落下一个点。
  - 计数窗显示“已看过的帧”在走，“已保存的帧”始终为 0。
  - 支持按钮和键盘 1–4、空闲时自动演示、reduced-motion 静帧，以及深色和浅色两个主题。
- **Hairline**：笔筒里四支笔，分别是宽笔、点刷、勾线笔和排刷，各对应一类事件：翻身、鼾声、关门、安静。指针下的那支立起来，读数说出它在晨画里画哪一种笔触。

## 集成与同步

- 原理图每落下一笔，就向集成页发送 `{ ns: "night-canvas", type: "event", kind, count }`。
- 集成页核对来源窗口和字段后，转发给设备 iframe 一次。设备核对消息来自父页面后，更新事件数、状态灯和标签。
- 设备从不回发消息，所以不会形成回路；消息里带着 `count`，丢一条也能在下一条自动对齐。
- 示意画稿只根据同步来的事件做程序化绘制，页面上已注明它不是模型输出。

## 参数来源与假设

| 量 | 数值 | 出处 |
|---|---|---|
| Pi 5 整板功耗 | 空闲 2.7 W，满载 7.3 W | 公开实测约 2.7 W / 约 7 W；SoC 与其余部分的拆分是**假设** |
| 风扇曲线 | 50 / 60 / 67.5 / 75 °C → 75 / 125 / 175 / 250 (/255) | Pi 5 固件默认值；阶梯在模型里线性插值 |
| 降频 | 80 °C 起，85 °C 时 1.5 GHz | Raspberry Pi 文档；中间段线性处理 |
| 热阻、热容 | 13 K/W、0.10 W/K × 占空比、25 J/K | **假设**，调到让满载带风扇约 65 °C |
| 红外照度 | 0.12 W/m²（6 × 100 mA，1.2 m） | LED 光效 38 %、±45° 透镜为**假设**；限值 100 W/m² 来自 IEC 62471 IR-A |
| SDXL-Turbo 512² | 约 4 分钟 @ 2.4 GHz | **假设**，待实测 |
| 阈值 | 2 %（回差 1.5 %），45 dBA（回差 41 dBA） | **假设** |
| 安静卧室 | 30 dBA | WHO 夜间噪声指南 |
| 鼾声、关门 | 约 56 dBA、约 72 dBA | 取常见报道范围，**假设** |

求解器的工作点：
- 夜间采集（30 % 负载）约 50 °C，风扇约 30 %，整机约 5.5 W。
- 满载生成约 65 °C。
- 风扇停转、满载时约 82 °C，主频降到 2.0 GHz，出图慢 20 %。

**模型简化**：
- 热过程以 20 倍速显示；风扇转速只是示意。
- 外壳内空气升温不建模。
- 风扇阶梯和降频都做了线性插值。
- 原理图的纸带按真实时间走，信号形状是演示用的。

## 已完成的检查

- **设备**：四轮截图审查，覆盖整体、剖切加标签、爆炸、X 光、头部和主板 4 倍近景、背面、满载和风扇停转。
  - 求解器在空闲、采集、满载、停转四个工作点对过数；读数、标签和状态文字保持一致。
  - 爆炸顺序检查过不穿插：立柱先走，顶板后走，USB-C 线先于后壁退出，枢轴销先侧向退出。
- **Blender 零件**（`shots/b-*.png`）：
  - 79 个物体逐个检查，非流形边都是 0（封闭实体）。
  - 在 Blender 里渲染检查了主板俯视、端口正面、HDMI 一侧、散热器和摄像头正反面。期间修正了丝印镜像，以及电源键和安装孔焊环重叠的问题。
  - 设备页在 GPU 无头 Chrome 里截了这些图：整体、剖切加标签（标签锚点对得上）、爆炸、端口和散热器近景、剖切俯视、头部剖切。
  - 结果：控制台只有 kit 自带的 X4000 警告；约 26–28 fps；三角面从改动前的约 26.6 万降到约 19.0 万。
  - 用 file:// 打开 `index.html`，设备 iframe 读到了 GLB，458 个零件，无报错。
- **原理图**：线端检查在深色和浅色版都是 0 个悬空端。
  - 桌面、390 px 手机、浅色、reduced-motion 截图都看过，控制台干净，没有横向滚动。
  - 按键和按钮驱动的结果：小动作不记；翻身在越过 2 % 时记一笔；鼾声每一声各记一笔。
- **引导插图**：validator 通过；look 检查的取景、读数、控制台、闪烁、响应都通过，盲看图和动作序列图都看过。
- **集成页**（file://，桌面 1440 px 和手机 390 px）：
  - 原理图、集成页、设备三处的事件计数一致。
  - 连续 10 次快速“关门”只记 1 笔，因为回差，属于预期行为。
  - 伪造的消息被忽略。
  - 没有横向滚动；reduced-motion 下设备不自动环绕，原理图不播放演示。

## 遗留限制

- 无头 Chrome（D3D11）编译设备页的 GTAO 着色器时，会输出一条 three.js 警告（X4000）。它不影响功能，来自 Machine kit 本身，没有修改 kit。
- 设备页在无头环境里约 25–30 fps（1920 × 1080）。有独立显卡的浏览器会更流畅。
- iframe 高度是按实测宽高表插值的：file:// 下各页面是不同源，无法读取内容高度。如果改了页面内容，需要重新测量高度表。
- 按你的要求没有录制视频。Machine 技能自带的成片流程（`record.mjs`）在 `machine/scripts/` 里，需要时可以再加。
- 所有标为“假设”的数值，都要等实物装好后实测替换。
- Blender 零件里，大部件的位置和尺寸来自 Pi 5 机械图和页面原有数值。以下内容是示意，不是 Pi 5 的真实布局：
  - PCB 走线、过孔、小元件的分布，以及芯片刻字。
  - BAT、UART 插座，电源键和指示灯的位置。电源键为了避开安装孔，从板角挪到了 PCIe 排线座旁边。
- 摄像头一侧的排线座按 15 针 1 mm 间距做，宽约 18 mm；排线在头部里从 11.4 mm 加宽到 16 mm。
- 设备页多加载约 3 MB 的 `night-canvas-parts.glb.js`。
