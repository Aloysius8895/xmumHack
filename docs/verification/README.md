# Verification evidence

This directory contains existing screenshots and machine-readable verification
reports, grouped by feature. Their original contents and provenance are retained.
Relocation alone does not establish that those checks pass on the current build.

Current checks are documented in [`tests/README.md`](../../tests/README.md).
Optional browser verification utilities are in `src/tools/`, with world-building
checks in `src/game/world-building/`; their output paths now point here.

HTTP health checks do not verify that WebGPU/WebGL renders the scene. Run visual
checks in a supported hardware-accelerated browser and identify the browser/GPU
limitations when reporting results. Do not replace game captures with unrelated
rendered images or imply that recorded fixture data is a live user session.
