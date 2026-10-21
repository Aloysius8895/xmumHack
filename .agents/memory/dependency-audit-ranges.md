---
name: Dependency audit ranges
description: Observed discrepancy between Python dependency audit results and installed versions.
---

The dependency audit has reported old vulnerable versions for comma-separated Python ranges even when installed metadata satisfied the safe lower bound. Simple minimum-version requirements produced accurate results.

**Why:** During remediation, bounded requirements such as `>=2.16.0,<3` still returned findings for an older release; changing only the range syntax to a simple minimum cleared those findings.

**How to apply:** If a finding contradicts installed package metadata, check the requirement syntax before repeatedly reinstalling. Preserve necessary compatibility limits; do not assume an audit finding is accurate or remove a required upper bound merely to clear it.
