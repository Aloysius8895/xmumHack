# Source of these files

Anthropic Economic Index, https://huggingface.co/datasets/Anthropic/EconomicIndex
Data licence: CC-BY (attribution required); code: MIT. Downloaded 2026-10-30, unchanged.

| File | Path in the dataset | Content |
|---|---|---|
| `task_penetration.csv` | `labor_market_impacts/task_penetration.csv` | O*NET task statements and their AI penetration (observed use of Claude for the task), 0–1 |
| `job_exposure.csv` | `labor_market_impacts/job_exposure.csv` | US occupations (SOC) and their observed exposure, 0–1 |
| `automation_vs_augmentation_by_task.csv` | `release_2025_03_27/automation_vs_augmentation_by_task.csv` | Per task, the share of each interaction pattern: directive, feedback_loop (automation); task_iteration, validation, learning (augmentation); filtered (too little data) |

These measure how people use Claude on US O*NET tasks. They are a signal of where AI is entering work, not a
measure of jobs lost, and not Malaysian employment data.
