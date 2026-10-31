# Direct scenario roadmap customisation

**User requirement:** Selecting Moderate or Extreme in the Roadmap learning panel immediately customises the route below, without a second preview/confirmation step.

**Design:** Treat the scenario click as authorization to adapt the route. Use a cloned save for generation and validation, applying only a successful result. Reuse initial roadmap generation when no roadmap exists; otherwise use protected-task adaptation and apply the validated result immediately. Retain weekly review previews as a separate flow. Update stage activity allocations for the selected scenario, preserve task progress, points, mastery, logs and artifacts, and avoid regenerating an already applied scenario.

**Verification:** API tests for existing and first-time routes, both scenarios, repeat selection and generation failure; renderer tests for direct-selection copy and preserved review controls; existing adaptive-learning checks and production build.

**Results:** 40 focused tests passed, covering first-time generation, both scenario selections, idempotent repeated clicks, rejected requests, protected progress and review previews. Production build passed with asset resolution, dependency eval and bundle size warnings. The UI keeps scenario selection visible and no longer displays an unrelated historical preview without a review.
