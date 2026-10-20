"""python -m mindreader [--camera N] {play,rps,reach,handover,measure,marker,train,check}"""
import argparse
import sys
import time

from .config import ROOT, CameraConfig

LEVEL_LABELS = {"rps": "第一关 读心猜拳", "reach": "第二关 拿哪个杯子", "handover": "第三关 助手递工具"}


def check(cam_cfg):
    """Headless self-test: camera, landmarks, YOLO and depth. Nothing is shown or saved."""
    import torch

    from .camera import Camera
    from .measure.depth import DepthWorker
    from .perception import Perception
    from .weights import yolo

    print(f"CUDA 可用：{torch.cuda.is_available()}")
    cam = Camera(cam_cfg).start()
    perception = Perception()
    frames = faces = hands = 0
    last, started, frame = -1, None, None
    deadline = time.time() + 8
    while time.time() < deadline:
        frame, ts, seq = cam.read()
        if frame is None or seq == last:
            time.sleep(0.005)
            continue
        last, started = seq, started or time.time()
        obs = perception.process(frame, ts)
        frames += 1
        faces += obs.face is not None
        hands += bool(obs.hands)
    cam.stop()
    perception.close()
    if frame is None:
        print("摄像头没有画面")
        return
    fps = frames / max(time.time() - started, 1e-6)
    print(f"摄像头 {frame.shape[1]}×{frame.shape[0]}，关键点处理 {fps:.1f} 帧/秒；"
          f"{frames} 帧里看到脸 {faces} 帧、看到手 {hands} 帧")

    from .measure.mode import MODEL
    for name in ("yolo26n.pt", MODEL):
        model = yolo(name)
        t = time.time()
        r = model.predict(frame, verbose=False)[0]
        names = sorted({r.names[int(c)] for c in r.boxes.cls}) if len(r.boxes) else []
        print(f"{name}：{(time.time() - t) * 1000:.0f} ms，检测到 {len(r.boxes)} 个物体 {names}")

    worker = DepthWorker()
    while worker.status == "loading":
        time.sleep(0.2)
    if worker.status != "ready":
        print(f"深度模型：{worker.status}")
        return
    worker.submit(frame)
    t = time.time()
    while worker.latest is None and time.time() - t < 30:
        time.sleep(0.02)
    if worker.latest is not None:
        depth = worker.latest[0]
        print(f"深度模型：画面中央约 {depth[depth.shape[0] // 2, depth.shape[1] // 2]:.2f} m，"
              f"范围 {depth.min():.2f}–{depth.max():.2f} m")


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):   # Chinese output on consoles that default to cp1252
        stream.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser(prog="mindreader", description="读心 AI：三关预测挑战 + 物体测量")
    p.add_argument("--camera", type=int, default=0, help="摄像头编号，默认 0")
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("play", help="AI 按顺序闯三关（默认）")
    for key, label in LEVEL_LABELS.items():
        s = sub.add_parser(key, help=f"只玩{label}")
        s.add_argument("--practice", action="store_true", help="练习模式：不计分，退出时自动训练")
    m = sub.add_parser("measure", help="自动识别画面里的物体，显示高、宽和距离")
    m.add_argument("--marker-mm", type=float, default=50.0, help="打印出来的标记黑色方块边长（毫米）")
    m.add_argument("--hfov", type=float, default=70.0, help="摄像头水平视角（度）；用标记校准后影响不大")
    mk = sub.add_parser("marker", help="生成可打印的 ArUco 标记")
    mk.add_argument("--marker-mm", type=float, default=50.0)
    t = sub.add_parser("train", help="用记录的数据训练某一关的预测模型")
    t.add_argument("level", choices=list(LEVEL_LABELS))
    sub.add_parser("check", help="不开窗口，检查摄像头和各个模型能不能用")
    args = p.parse_args(argv)

    cmd = args.cmd or "play"
    cam = CameraConfig(index=args.camera)

    if cmd == "check":
        check(cam)
    elif cmd == "train":
        from .learn import train
        print(train(args.level))
    elif cmd == "marker":
        from .measure import write_marker
        out = ROOT / "print"
        out.mkdir(exist_ok=True)
        path = write_marker(out / f"aruco_{args.marker_mm:g}mm.png", args.marker_mm)
        print(f"已生成 {path}\n用「实际大小 / 100%」打印，再用尺子量一下黑色方块；不是 {args.marker_mm:g} mm 的话，"
              f"测量时用 --marker-mm 填实际边长。")
    elif cmd == "measure":
        from .app import run
        from .measure import MeasureMode
        run([lambda: MeasureMode(args.marker_mm, args.hfov, cam.mirror)], cam)
    elif cmd == "play":
        from .app import run
        from .levels import LEVELS, ORDER
        run([lambda k=k: LEVELS[k]() for k in ORDER], cam)
    else:
        from .app import run
        from .learn import train
        from .levels import LEVELS
        shown = run([lambda: LEVELS[cmd](practice=args.practice)], cam)
        if args.practice and shown and shown[0].results:
            print(train(cmd))


if __name__ == "__main__":
    main()
