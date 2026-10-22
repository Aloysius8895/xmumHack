---
name: Browser graphics verification
description: Distinguish workspace headless GPU failures from application verification.
---

The workspace's headless Chromium has failed graphics initialization, including
GPU-process crashes, under both default and explicit software-rendering options.
The game cannot be considered visually verified from a blank canvas alone.

**Why:** Browser checks during import setup reached the page but failed to obtain
a WebGL context; build and backend checks passed independently. This evidence
does not establish whether gameplay works in a user's hardware-accelerated browser.

**How to apply:** Report graphics verification limits plainly. Do not rewrite the
game renderer to work around a test-browser GPU crash without evidence that the
same failure occurs in supported user browsers.
