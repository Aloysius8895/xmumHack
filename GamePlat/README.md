# Bruno Simon Folio 2025 本地复刻

本目录是 https://bruno-simon.com/ 的前端本地镜像。它直接使用原站编译后的
HTML、JavaScript（Three.js WebGPU/WebGL、Rapier 物理、Howler 音频）、CSS、字体、
3D 模型（GLB/Draco）、KTX 纹理和全部音效/音乐，保留原站的开场动画、驾驶、
物理碰撞、菜单、地图、成就、昼夜/天气循环与各个彩蛋。

原站源代码以 MIT 许可公开：https://github.com/brunosimon/folio-2025 。
本镜像只用于本地学习与研究；如果要做成你自己的作品对外发布，请替换
Bruno Simon 的姓名、头像、经历与项目内容，并保留原 MIT 许可声明。

## 启动

需要 Python 3.10 或更高版本；运行网站不需要 npm 或第三方 Python 包。

双击 **start.cmd**（会自动打开浏览器），或在本目录运行：

```powershell
python serve.py
```

然后打开 **http://127.0.0.1:8083**。端口被占用时可以换一个：`python serve.py --port 8090`。

不要用 `file://` 直接双击 `site/index.html`：WebAssembly、模型和纹理必须通过 HTTP 加载。
推荐使用桌面版 Chrome/Edge（支持 WebGPU 时画质最好，否则自动退回 WebGL）。

操作与原站相同：点击开始；方向键 / WASD 驾驶，`Shift` 加速，`B` 刹车，`H` 鸣笛，
`R` 重生，`E` / `Enter` 互动，`M` 地图，`L` 静音，`Esc` 关闭窗口；菜单和地图也可点击屏幕上的按钮。
同样支持手柄和触屏。

## 与原站的差异

- **多人服务器离线**：原站会连接作者的实时服务器（留言 whispers、排行榜、在线计数）。
  本地镜像用 `site/local-runtime.js` 拦截这一个连接，游戏进入原站自带的
  “server offline” 状态，不会向作者的服务器发送任何数据。其余玩法完全在本地运行。
- **统计已移除**：删除了 Google Analytics。
- **字体本地化**：Google Fonts（Nunito、Amatic SC）已下载到 `site/vendor/google-fonts/`。
- 进度、成就、国旗等存档保存在浏览器 localStorage 中，与原站互不影响。
- 外部链接（作者社交账号、项目网站、YouTube 等）仍然指向外网。

除 `index.html` 的上述三处修改外，`site/` 中所有文件与原站字节一致（SHA-256 记录在
`asset-manifest.json`）。

## 文件结构

```text
template3/
  start.cmd                      Windows 启动入口
  serve.py                       本地 HTTP 服务，仅监听 127.0.0.1，不代理外网
  site/                          可运行的网站（971 个文件，约 74 MB）
    local-runtime.js             离线运行时：屏蔽生产环境多人服务器
  asset-manifest.json            每个文件的来源 URL、发现方式、大小、SHA-256
  tools/mirror.py                可重复运行的资源下载工具
  tools/verify.py                离线浏览器验证（桌面 + 手机，可选对比原站）
  tools/static-listing.json      开源仓库 static/ 文件清单（用于发现运行时拼接的路径）
  tools/original-index.html      原站未修改的 index.html
  analysis/                      REA 技能的静态 JS 分析证据与结论
  verification/                  截图、results.json、compare.html 并排对比
  bruno-simon_20261020_093901/   爬虫（main.py）的原始抓取结果
  IMPLEMENTATION.md              实施记录与证据
```

## 验证结果（2026-10-20）

`tools/verify.py` 用 GPU 无头 Chromium（AMD Radeon / D3D11，约 80–90 fps）离线测试，
本地运行时阻断所有非 127.0.0.1 请求：

| 场景 | 结果 |
| --- | --- |
| 桌面 1440×1000：开场 → 点击开始（约 18 秒）→ 驾驶 → 菜单 → 地图 | 全部通过，状态与原站一致 |
| 手机 390×844 触屏：开场 → 触摸开始，进入触屏模式 | 通过 |
| 外网请求 / HTTP 错误 / 请求失败 / JS 错误 / 控制台错误 | 全部为 0 |
| 本地服务器 4xx/5xx | 0 |

原站同样流程的截图（`original-desktop-*.png`）与本地内容一致；颜色不同是因为游戏的
昼夜循环按真实时间计算（240 秒一圈），两次截图拍摄时间不同。
注意：默认的 Playwright 无头模式使用软件渲染（约 1 fps），所以验证脚本使用 GPU 模式。

## 重新下载或验证

需要项目已有的 Playwright；重新下载需要联网。

```powershell
python tools/mirror.py            # 增量下载（已有文件跳过），--force 全部重新下载
python tools/verify.py            # 离线验证本地镜像
python tools/verify.py --original # 同时截取原站做对比
```

打开 `verification/compare.html` 可以并排查看原站和本地截图。场景含随机天气、
昼夜循环、粒子与物理，因此不同时刻的截图不会逐像素一致。
