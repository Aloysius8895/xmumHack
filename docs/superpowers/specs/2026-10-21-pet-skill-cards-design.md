# Pet skill cards and retirement of exams

The user requested career-list match indicators become affection indicators, skill rows adopt their supplied game-card reference, and exams/gym challenges be removed. They explicitly confirmed daily-report-based skill growth is for later, not this change.

Career cards display affinity with a pink heart bar. **Superseded on 2026-10-22 at the user's request:** affinity is no longer a saved pet value. It is computed per career (`server/game.js` `affinityOf`) as profile match + learning progress: for each required skill, the best of the profile level against the required level, the roadmap task progress of that skill and the daily-digest mastery, averaged with the career-match weights (required level × weight). With no learning yet it equals the profile match, which the career card also shows on its own ("profile match"). The pet level follows this affinity.

Each pet skill becomes a compact dark card with an original SVG skill icon, title, progress diamonds and existing progress percentage, two light stat rows labelled heat (market demand) and difficulty (1–5), and a concise localized skill description. Skill heat/difficulty are authored reference levels, not live market statistics. Cover every skill in the existing catalog and all three languages.

Remove gym menu, exam screens/actions/API endpoints, question generation/grading, challenge prompts in AI roadmap creation, NPC challenge choice, and gym-ready indicators. Retain career NPCs as mentors. Roadmap completion depends on task completion rather than an exam, including existing saved roadmaps. Retain legacy save data and existing profile/progress (the saved `pet.affinity` field is kept but no longer read, see above).

Validate server behavior with in-memory saves (no real-save mutation), API retirement, catalog coverage/localization, old-roadmap compatibility, and actual desktop/mobile skill-card rendering. Preserve the existing menu/corner layout and unrelated character/world edits.

Follow-up: the user requested heat as a percentage (e.g. 80%). Skill cards, career badges and mentor dialogue now use numeric heat scores. Existing reference categories map to high=80, medium=60, low=30; the reference-data note remains. These values are game reference scores, not measured market shares.

Correction confirmed by the user: career-detail skill requirements must use the same reference-style skill cards, not the old text/progress rows. Both career requirements and pet skills use exactly two columns, including phone layouts. Preserve current/required level comparisons within career cards. Widen skill-bearing desktop panels to 760px and use compact icons/typography on narrow cards. Verify the actual AI/ML Engineer requirements page plus all six career catalogs.
