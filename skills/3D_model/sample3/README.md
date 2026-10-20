# 读心 AI · Mind Reader

一个用笔记本摄像头"读心"的 AI：它看你的手、视线和面部细微动作，在你做出动作**之前**预测你要做什么，要连闯三关来证明自己。另附一个测量工具，可以量出画面里物体的宽和高。

用到 `computer_vision/` 里的四个项目：MediaPipe（手和脸的关键点、52 个面部表情系数）、Ultralytics YOLO（找杯子、分割物体）、Supervision（画分割结果）、OpenCV（ArUco 标尺、几何计算）。深度估计用的是 Depth Anything V2（室内公制版）。

## 打开方式

在 `sample3/` 里运行（第一次运行会自动下载模型，大约 200 MB）：

```powershell
.venv\Scripts\python.exe -m mindreader              # AI 按顺序闯三关
.venv\Scripts\python.exe -m mindreader rps --practice   # 单独练某一关：不计分、只采集数据，退出时自动训练
.venv\Scripts\python.exe -m mindreader measure      # 测量模式：自动识别物体，显示高、宽和距离
.venv\Scripts\python.exe -m mindreader marker       # 生成可打印的 ArUco 标记（print/aruco_50mm.png）
.venv\Scripts\python.exe -m mindreader train reach  # 手动重新训练某一关
.venv\Scripts\python.exe -m mindreader check        # 不开窗口，自检摄像头和模型
```

关卡名：`rps`（第一关）、`reach`（第二关）、`handover`（第三关）。换摄像头用 `--camera 1`，要写在命令前面：`-m mindreader --camera 1 measure`。

重建环境（`.venv` 坏了或者换电脑时）：

```powershell
uv venv --python 3.12 --python-preference only-managed .venv
uv pip install --python .venv\Scripts\python.exe torch torchvision --index-url https://download.pytorch.org/whl/cu128
uv pip install --python .venv\Scripts\python.exe mediapipe scikit-learn pillow joblib transformers lap -e ..\..\computer_vision\02_detection_tracking\ultralytics -e ..\..\computer_vision\02_detection_tracking\supervision
```

## 三个关卡

AI 是闯关的一方，你是考官，可以正常玩，也可以故意使坏。

| 关卡 | AI 要预测什么 | AI 看的信号 | 怎么判定你真的做了 | 过关条件 |
|---|---|---|---|---|
| 第一关 读心猜拳 | 你这一拳出什么 | 最后一下摆拳时手指开始张开；你的出拳习惯（赢了不换、输了换，以及你自己的规律） | 手势稳定 3 帧（石头要手停下 5 帧） | 10 局猜中 ≥ 6，提前 ≥ 100 ms |
| 第二关 拿哪个杯子 | 你会伸手拿 3 个杯子里的哪一个 | 视线（开局前按人校准）、手的运动方向和距离 | 指尖进入杯子的框 2 帧 | 8 局猜中 ≥ 6，提前 ≥ 300 ms |
| 第三关 助手递工具 | 你要比划的动作（剪 / 写 / 敲 / 喝），助手递对应的工具 | 手型正在变成什么（握拳、两指、捏合）、手往哪去、喝水前张嘴、写字前低头看 | 动作做到不会认错的程度：手到嘴边、握拳上下敲两下、两指开合两下、捏合保持 0.4 秒 | 5 局猜中 ≥ 4，提前 ≥ 300 ms |

**怎么算"猜中"：** AI 每一帧都会给出一个判断。动作发生的那一刻，往回找 AI 最后一段连续、没改过口的正确判断（把握也要够），这段的起点到动作发生的时间就是**提前量**。AI 最后才改口猜对，提前量就很小，不算数。第一关闯关时 AI 的判断是藏起来的，出拳后才揭晓，免得你看到后临时换招。

**推荐流程：** 每关先用 `--practice` 玩 15–30 局。数据会自动带标签保存（动作最后是什么，标签就是什么），退出时自动训练，并打印"动作前 X 毫秒的准确率"。之后闯关时，AI 会把训练出的模型和手写规则一起用。没训练过的关卡只靠规则预测，顶栏会显示「规则（未训练）」。

**关于微表情：** 普通摄像头每秒只有 30 帧，真正的微表情（1/25–1/5 秒）拍不全，"看表情读心"在学术上也有争议。所以表情系数（张嘴、皱眉、眼睛往下看等）只当辅助信号，主要还是靠手和视线。

## 测量模式

打开后自动找出画面里的所有物体，在每个物体旁边显示：**名称、高 × 宽（厘米）、离镜头的距离（米）**。不用点、不用画线。

- **认物体：** YOLOE-26m 免提示版，自带 4,585 个类别。常见物品显示中文名（约 400 多类），其他的显示英文原名。人默认也会识别和测量，各种职业、身份的叫法都统一显示成「人」，按 P 可以隐藏；人离镜头很近、占满半个画面也能认出来，不过只能量到画面里露出来的那部分身体。脸、手、头发这些身体部位，以及墙、天花板、房间这类描述场景的词不显示。同一个东西被起了两个名字（比如 cup 和 mug）时，只保留把握更高的那个。
- **量尺寸：** 用 Depth Anything V2 估计每个物体离镜头多远，再按它在画面里占多大换算成高和宽。高和宽都是正对镜头方向的尺寸，不含前后的厚度。从上往下看的物体（比如桌上的杯子）会把顶面也算进高度里，会偏高一点。
- **数字不乱跳：** 每个物体都有跟踪编号，显示的是它最近 1 秒测量值的中位数。物体移动后，大约 1 秒内会更新。
- **标记校准：** 不放标记也能用，但误差大约 15%。把 `print/aruco_50mm.png` 按实际大小打印出来，拿到镜头前一两秒，程序会用它算出一个校正系数，之后所有物体（不管远近）都会按这个系数校正，标记拿走后照样有效。校正系数会存进 `models/measure_calibration.json`，下次打开自动沿用；摄像头换了或者觉得不准，就按 K 清掉重新校准。打印出来的黑色方块不是 50 mm 的话，用 `--marker-mm` 填实际边长。

## 按键

| 按键 | 作用 |
|---|---|
| 空格 | 开始关卡 / 确认杯子位置 / 关卡结束后进入下一关 |
| D | 显示或隐藏手和脸的关键点、调试数值（练习模式默认显示） |
| C | 第二关：重新校准，或者用鼠标点选杯子 |
| A | 第二关：重新自动找杯子 |
| R / N | 关卡结束后：再来一次 / 跳过这一关 |
| P / K | 测量模式：隐藏或显示人 / 清除标记校准 |
| ESC | 退出 |

## 第三关换成 3D

助手的画法和关卡逻辑是分开的。`mindreader/levels/handover.py` 每帧只生成一个 `AssistantState`（工具列表、AI 对每个工具的把握、现在递的是哪个、阶段、判定结果），交给 `mindreader/assistant/` 里的显示类去画。换成 3D 时，只要写一个新类实现同样的 `render(canvas, hud, state)`，再用 `Handover(view=新类())` 传进去，预测和判定的代码都不用改。

## 目录

| 路径 | 内容 |
|---|---|
| `mindreader/__main__.py` | 命令行入口和 `check` 自检 |
| `mindreader/app.py` | 窗口主循环：读摄像头 → 关键点 → 关卡更新 → 画面 |
| `mindreader/camera.py` | 后台线程读摄像头（优先 Media Foundation：这台电脑的摄像头用它 720p 能跑 30 帧，用 DirectShow 只有 10 帧） |
| `mindreader/perception.py` | MediaPipe 手和脸的关键点、表情系数 |
| `mindreader/features.py` | 手指伸直程度、捏合、视线向量、来回摆动计数等几何特征 |
| `mindreader/timeline.py` | 记录 AI 每一帧的判断，动作发生后算提前量 |
| `mindreader/learn.py` | 保存每一局的数据，训练和加载"提前预测"模型 |
| `mindreader/levels/` | `base.py` 关卡流程和计分；`rps.py`、`reach.py`、`handover.py` 三个关卡 |
| `mindreader/assistant/` | 第三关助手：`base.py` 是接口，`view2d.py` 是现在的 2D 版 |
| `mindreader/measure/` | `mode.py` 测量界面（识别、跟踪、尺寸、校准）；`depth.py` 深度模型；`names.py` 中文名和过滤规则；`ruler.py` ArUco 标记 |
| `mindreader/config.py` | 过关规则（局数、提前量、把握）、摄像头设置 |
| `models/` | 下载的模型和训练出的 `<关卡>.joblib` |
| `data/<关卡>/` | 每一局一个 `.npz`：逐帧特征、时间戳、真实动作 |
| `print/` | 可打印的 ArUco 标记 |
