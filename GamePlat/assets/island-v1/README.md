# 职业海岛 · 第一版地形

使用本机 Blender 5.2.2 LTS 程序化制作，参考用户提供的同一座岛的六张视图重新规划。此版本交付可编辑地形与道路设施。

按用户要求读取 `skills/3D_model/README.md` 及其 Machine、Anatomy、Hairline 说明。当前在 Blender 工作流中采用 Machine 的比例、材质、部件衔接和多角度检查标准；使用 Blender Python 建模与渲染，没有运行 Machine 的网页引擎。Anatomy、Hairline 对应的网页说明图不在本轮 Blender 资产交付范围内，未生成。

## 文件

- `island.blend`：可编辑 Blender 工程；用 Blender 打开后可旋转、缩放和修改各个对象。
- `island.glb`：包含材质的游戏视觉资产，导出时已排除摄影机、灯光、预览海水、标签和导航辅助面。
- `navigation.glb`：单独的步行导航辅助表面，包括楼梯平滑坡面和桥面。
- `navigation.json`：17 条路线、六处建筑预留地、出生点、路线宽度和设计坡度。
- `preview-southwest.png`、`preview-overhead.png`、`preview-northeast.png`：静态预览图。
- `verification.json`：独立重新打开工程、重新导入 GLB 后的检查记录。
- `build.log`、`verification.log`：本地 Blender 制作与检查日志。

## 可编辑内容

| Blender 集合 | 内容 |
|---|---|
| `01_Terrain` | 连续岛屿地形、层叠高台、北侧山体、南侧休眠火山和独立观景小岛 |
| `02_Beaches_and_Reefs` | 沙滩、浅水沙底和外围礁石 |
| `03_Roads_and_Graded_Paths` | 城镇道路、铺装边缘、道路标线、分层步道与三段坡道 |
| `04_Bridge_and_Stairs` | 港口平台、观景楼梯及扶手、木桥及护栏 |
| `05_Six_Building_Sites` | 六块 13 × 13 米平整建筑预留地 |
| `06_Navigation_Surfaces` | 默认隐藏的导航辅助面；可在 Outliner 中打开显示 |
| `90_Preview_Only` | 预览海水、六处标签、灯光和三台摄影机 |

Blender 使用米、Z 轴向上。GLB 按标准自动转换为 Y 轴向上；JSON 中 Blender `(x, y, z)` 对应 glTF `(x, z, -y)`。

主路线最小净设计宽度为 3.6 米，三段上山坡道连接各层。楼梯有单独的平滑辅助面，不应直接拿视觉台阶作为角色导航面。

## 预留建筑

六处位置对应当前游戏的 data-analyst、frontend-developer、product-manager、backend-developer、ui-ux-designer、ml-engineer。平板与标签用于定位，实际建筑应替换平板上方的预留空间，并根据入口位置调整最后一段步道。

## 复现

在仓库根目录执行：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python 'GamePlat\game\world-building\build_island.py'
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python 'GamePlat\game\world-building\verify_island.py'
```

制作脚本为 [`build_island.py`](../../game/world-building/build_island.py)，几何工具为 [`island_geometry.py`](../../game/world-building/island_geometry.py)。重新运行制作脚本会更新本文件夹中的同名输出；修改现有场景前请另存副本。

## 范围

这是第一版地形资产，不是参考图的逐点重建。建筑、树木和花丛后续独立添加。海水目前是静态预览布景，游戏中需接入实时水面。现有游戏地图和用户原有 Blender 会话未被替换。

路线连通、宽度、设计坡度、实际网格支撑和导出文件由脚本检查；角色碰撞、镜头、运行时导航网格以及滑鼠点击移动尚未接入游戏，因此没有进行实际游戏行走测试。

## 本轮检查

- 六处建筑预留地与港口相连，路线图共 52 个节点。
- 普通路线最小设计宽度 3.6 米，最大设计坡度约 12.60°；楼梯独立处理。
- 对实际地形与导航辅助面进行 1,989 次采样；中心线高度误差最大约 0.057 米。
- 独立重新打开 `.blend` 并重新导入 `.glb`，检查材质、对象、模型边界及外部文件依赖。
- 视觉资产约 8.6 万三角面；未合并的桥梁、楼梯等对象保留可编辑性。接入游戏时可合并静态网格以减少绘制调用。
- 已检查西南、俯视和东北三个视角，并修正道路转角、相邻坡道、预留地支撑和预览阴影问题。
- 道路/步道薄面带有 `cast_shadow=false` 自定义属性，预览中关闭其投影；游戏导入时需显式采用该标记。
