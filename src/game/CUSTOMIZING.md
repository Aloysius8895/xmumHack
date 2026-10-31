# 改造说明：加人物、改地图

这个文件夹是 Bruno Simon 的 Folio 2025 的源代码，可以直接修改。
来源：[brunosimon/folio-2025](https://github.com/brunosimon/folio-2025)，commit `41046b5`，MIT 授权，保留 `license.md`。
已经去掉上游的 `.git`，现在是我们 repo 的一部分。

`docs/reference/site/` 是原站的编译版镜像，只作对照用，不要在那里改。

## 运行

```bash
cd src/game
cp ../../.env.example .env  # 第一次；保留已有 .env
npm ci                     # 第一次
npm run dev                # 打开 http://localhost:5000
```

`.env` 里比较重要的几项：

| 变量 | 值 | 作用 |
| --- | --- | --- |
| `VITE_COMPRESSED` | 留空 | 直接读未压缩的 `.glb` / `.png`。改完地图导出后刷新就能看到，不用先压缩 |
| `VITE_GAME_PUBLIC` | `1` | 浏览器 console 里可以用 `game` 变量调试 |
| `VITE_SERVER_URL` | 留空 | 不连原作者的多人服务器，游戏进入自带的离线模式 |

改了 `.env` 要重启 `npm run dev` 才会生效。

## 职业平台

职业规划、职业宠物、道馆挑战等功能的说明见 [CAREER.md](CAREER.md)。

## 玩家角色（小新）

原来的卡车已换成可以走、跑、跳、蹲的小新。

| 按键 | 动作 |
| --- | --- |
| `WASD` / 方向键 | 走（方向相对镜头） |
| `Shift` | 跑 |
| `Space` | 跳 |
| `C` / 左 `Ctrl` | 蹲（蹲着移动 = 蹲走） |

被爆炸（炸药箱、火球、闪电）炸到时会飞上天、在空中挥手蹬腿并后空翻，然后屁股着地、头晕一下，最后爬起来摸摸屁股。这个过程中不能操作，结束后自动恢复。

### 骨骼和动作：`animation/`

动作和模型是分开的，所有模型共用一套标准骨骼和同一个动作库：

```text
animation/
  build.py               入口：给模型绑骨，并把所有动作烘焙进去
  rig.py                 标准骨骼（16 根）、蒙皮权重、导出
  pose.py                写动作用的工具（世界轴旋转、姿势混合、IK）
  actions/               动作库，一个文件一个动作
    idle / walk / run / jump / crouch / crouch_walk
    fall / knockdown / get_up      被炸飞 > 摔坐地上 > 爬起来摸屁股
    common.py            共用姿势（蹲、坐地、手扶膝盖）
  characters/            每个模型一个配置
    xinchan.py           模型路径 + 关节位置
```

在 `src/game` 下运行：

```bash
# 只生成小新
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python animation/build.py -- xinchan
# 所有模型
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python animation/build.py -- all
```

- **加新模型**：复制 `characters/xinchan.py` 改名，改 `SOURCE` / `OUTPUT`，再按新模型调整 `BONES` 里的关节位置（以身高为 1 的比例，X = 角色右边，-Y = 正前方，Z = 上）。运行后它就有全部动作。
- **加新动作**：在 `actions/` 里新建一个文件（`NAME`、`SECONDS`、`LOOP`、`pose(p, t)`），加进 `actions/__init__.py` 的列表，然后用 `all` 重跑。动作是按"世界方向"和骨骼长度写的（例如"大腿向前抬 30°"、"手伸到屁股的位置"），所以换了体型也能用。
- 游戏按名字找动画（`sources/Game/World/VisualCharacter.js`）。动画按真实时间播放，而游戏物理是 2 倍速（`Time.defaultScale`），所以动作文件里的秒数就是你在屏幕上看到的秒数。
- 物理：`sources/Game/Physics/PhysicsCharacter.js`（胶囊体，速度、跳跃高度等参数在构造函数里，`#debug` 面板的 Physics → Character 也能实时调）。为了让地图其他系统不用改，它仍然挂在 `game.physicalVehicle` 上。
- 外观和动画切换：`sources/Game/World/VisualCharacter.js`（同理挂在 `game.world.visualVehicle`）。`#debug` 面板的 “🧒 Player character” 可以手动播放每个动画。
- 原来的车辆代码 `PhysicsVehicle.js` / `VisualVehicle.js` 保留未删，不再使用。

## 加人物

代码在 `sources/Game/World/Characters.js`，人物列表在 `sources/data/characters.js`。

1. 把模型放到 `static/characters/<名字>/<名字>.glb`。这是 Mixamo 流程导出的 GLB，带动画。
2. 在 `sources/data/characters.js` 里加一项：

   ```js
   {
       name: 'kazama',
       model: 'characters/kazama/kazama.glb',
       position: { x: 52.3, z: 30.1 },   // 或者用 respawn + offset
       rotation: 45,                     // 度；45 = 面向默认镜头
       height: 1.3,                      // 米，模型会自动缩放到这个高度
       animation: 'walk',                // 循环播放的动画，名字部分匹配即可
       collider: true,                   // 车撞上去会被挡住
       placeholder: { shirt: '#3a6fd8', shorts: '#2b2b2b' },
   },
   ```

3. 还没有 GLB 的时候，会显示一个用 `placeholder` 颜色拼出来的占位小人。GLB 放进去后刷新，就会自动换成真正的模型。
4. **找坐标**：打开 `http://localhost:<端口>/#debug`，把车开到想放人物的位置，点右上角面板里 `🧍 Characters → log vehicle position`。坐标会复制到剪贴板，同时打印在 console 里，直接贴到 `position`。按 `H` 可以隐藏或显示面板。
5. **在 console 里切换动画**：`game.world.characters.play('shinchan', 'run')`

人物会自动贴到地面上，使用游戏自己的材质，所以也有日夜变化、阴影和雾。

## 改地图

地图的源文件是 `resources/folio-2025.blend`，用 Blender 5.2 可以打开。
每个 collection 对应 `static/` 里的一个 GLB，加载列表见 `sources/Game/Game.js`：

| Collection | 导出到 `static/` |
| --- | --- |
| `areas`（landing、career、projects、lab、bowling、circuit…） | `areas/areas.glb` |
| `benches` / `bricks` / `fences` / `lanterns` / `poleLights` / `explosiveCrates` | `<同名>/<同名>.glb` |
| `bushes` / `flowers` | `<同名>/<同名>References.glb` |
| 树：`visual.002` / `references`（birch）、`visual.004` / `references.002`（oak）、`visual.005` / `references.003`（cherry） | `<树>/<树>Visual.glb` / `<树>References.glb` |
| `scenery.002` | `scenery/scenery.glb` |
| `terrain` | `terrain/terrain.glb`（地形颜色在 `terrain.png`，源文件是 `resources/terrain.psd`） |
| `respawns` | `respawns/respawnsReferences.glb` |
| `tornado` | `tornado/tornadoPathReferences.glb` |

### 导出：用脚本（推荐）

在 Blender 里改完并**保存** `.blend`，然后在 `src/game` 下运行：

```bash
# 只导出改过的 collection
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background resources/folio-2025.blend --python scripts/export-map.py -- areas benches

# 全部导出
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background resources/folio-2025.blend --python scripts/export-map.py -- all
```

也可以在 Blender 里打开 Scripting 页签，打开 `scripts/export-map.py`，点 Run Script（会全部导出）。
导出后 `npm run dev` 会自动重启，刷新浏览器就能看到。

这个脚本已经验证过：用它把 19 个文件全部重新导出，结构和原版完全一致，游戏运行正常。
唯一的差别是 `respawnTest` 出生点，它已经从 `.blend` 里删掉了，只是开发测试用的。

### 如果要手动导出

**File → Export → glTF 2.0**，下面几项**必须**设对，否则游戏会崩溃或缺东西：

| 设置 | 值 | 原因 |
| --- | --- | --- |
| Limit to | **Active Collection** + **Visible Objects** | 碰撞体和 `ref…` 标记关闭了渲染，但游戏需要它们，所以**不能**勾 Renderable Objects |
| Custom Properties | **勾上** | 代码会读 `category`、`mass`、`friction`、`preventAutoAdd` 等属性 |
| Mesh → Loose Edges / Loose Points | **勾上** | 瀑布粒子等位置是用 2 个点的线段标记的，不勾会让游戏崩溃 |
| Skinning | **关掉** | 游戏需要普通网格 |
| Compression | **关掉** | 压缩由 `npm run compress` 负责 |
| Format / Transform | glTF Binary (.glb) / +Y Up | |

### 物体命名规则

代码是靠物体名字来识别功能的，改地图时要照着命名：

- 名字里有 `physical`：有碰撞。再加 `dynamic` 就能被撞飞，否则是固定的（`sources/Game/Objects.js`）。
- 碰撞形状用子物体的名字表示：`cuboid…`、`ball…`、`tube…`（圆柱）、`hull…`、`trimesh…`。大小取自子物体的 scale。
- `ref…` / `reference…` 开头：只是位置标记，不显示（`sources/Game/References.js`）。
- `respawns` 里的 `respawnXxx`：出生点，人物的 `respawn` 字段用的就是这些名字。

## 发布

1. 安装 [KTX-Software](https://github.com/KhronosGroup/KTX-Software/releases)，需要 `toktx` 命令。
2. 运行 `npm run compress`，生成 `-compressed.glb` 和 `.ktx`。
3. 在 `.env` 里设 `VITE_COMPRESSED=1`。
4. 运行 `npm run build`，结果在 `dist/`，部署这个文件夹即可。
