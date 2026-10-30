---
name: Python package installation on Replit
description: Basic Python modules may not provide writable pip package management in this environment.
---

Use a full Python Tools module when this project needs pip-installed dependencies; the basic interpreter module is insufficient here.

**Why:** installing declared dependencies with the basic Python module failed with missing pip/sitecustomize and an externally-managed Nix environment. Switching to the full Python Tools module allowed the managed package installer to populate `.pythonlibs`.

**How to apply:** if the managed package installer reports this combination of errors, inspect the installed Python module and use an available full Tools module. Do not bypass the restriction with `--break-system-packages` or introduce a virtual environment.
