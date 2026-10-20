# Interactive Visualization Workflow

## Trigger Rules

We will first discuss the idea, goals, object, features, and visual effects.

During the discussion, help me clarify the requirements. Enter the creation phase only when I explicitly say “start building,” “go,” or “follow the README.”

Whenever we enter the creation phase:

1. Re-read this project’s README.md.
2. Extract the final requirements from our current discussion. Use my latest explicit decisions and exclude abandoned ideas.
3. Fill in the execution template below.
4. If a critical requirement is unclear, ask me instead of guessing. Make reasonable implementation decisions for minor details and briefly explain them.
5. Show the complete filled-in execution prompt in one code block.
6. If I only requested the prompt, stop after showing it. If I explicitly requested implementation, show it and proceed without asking again whether to start.
7. Complete the creation, integration, verification, and delivery stages in the specified order.

Generate a fresh execution prompt for each project. Keep this reusable README template intact; do not replace it with project-specific requirements.

## Execution Template

Use Machine, Anatomy, and Hairline to build a complete interactive visualization based on the following final requirements.

### Final Requirements

- Final idea: {{FINAL_IDEA}}
- Object or system to visualize: {{SUBJECT}}
- Target audience and purpose: {{AUDIENCE_AND_PURPOSE}}
- Core principle the viewer should understand: {{CORE_CONCEPT}}
- Required parts or content: {{REQUIRED_CONTENT}}
- Required interactions: {{INTERACTIONS}}
- Visual style and theme: {{VISUAL_STYLE}}
- Existing assets, models, and references: {{ASSETS_AND_REFERENCES}}
- Confirmed parameters and data requiring verification: {{PARAMETERS}}
- Output format: {{OUTPUT_FORMAT}}
- Existing technology stack and project location: {{PROJECT_CONTEXT}}
- Video requirements: {{VIDEO_REQUIREMENTS}}
- Time, device performance, and other constraints: {{CONSTRAINTS}}
- Explicit exclusions: {{EXCLUSIONS}}

Write “Not applicable” for fields that do not apply. Ask me about unresolved critical fields. Do not begin execution with unfilled placeholders.

### Skills

1. Machine
   - Repository: AirsupHQ/machine-skill
   - Skill name: machine
   - Responsibility: the main realistic 3D machine visualization, operating interactions, and appropriate simplified physics calculations.

2. Anatomy
   - Repository: wheresryan22/anatomy
   - Skill name: anatomy
   - Responsibility: a separate interactive figure explaining the core principle.

3. Hairline
   - Repository: lucasmarkes/hairline
   - Skill name: hairline-create
   - Responsibility: a minimal interactive illustration for supporting explanations or interaction guidance.

### General Requirements

- Inspect the project and read each skill’s SKILL.md before using it. Read referenced documentation and examples as needed.
- If a skill is unavailable, identify what is missing. Do not claim to have used it.
- Load detailed references when their stage requires them, rather than reading every unrelated file upfront.
- Give each skill a separate visualization to own. Do not assume they automatically convert models or share rendering engines.
- Follow each skill’s execution requirements. When a requirement conflicts with my explicit project instructions, explain the adaptation and follow my project instructions.
- Provide sources for factual data and clearly identify demonstration assumptions. Keep numbers, units, motion, and explanations consistent.
- Preserve the existing project structure and conventions. Avoid unrelated changes.
- Deliver working results, not just plans or screenshots.
- Complete the necessary verification for each stage before proceeding.

### Stage 1: Define the Plan

Turn the final requirements into a concise implementation plan covering:

- The main object, controls, and readouts.
- The single core concept explained by the Anatomy figure.
- The purpose and placement of the Hairline illustration.
- Layout, colors, terminology, and interaction hints.
- Which visualizations need synchronized state and which remain independent.
- Implementation scope, factual references, and demonstration assumptions.

Do not reopen decisions already settled in our discussion. If a technical limitation appears, explain it and propose an adaptation that preserves the core goal.

### Stage 2: Use Machine

Follow the machine skill to build the main visualization:

- Establish the main structure, proportions, components, and materials.
- Implement the requested viewing, explosion, cutaway, or operating controls.
- Drive suitable physical behavior with an explicit simplified model. Show units and explain the model’s limitations.
- Do not force irrelevant features, such as inventing a failure mode for a product with no operating mechanism.
- Preserve a separately runnable visualization and its source.
- Follow the skill’s checks for appearance, motion, cutaways, joints, and performance.
- Record and inspect a video only if this project requires one.

### Stage 3: Use Anatomy

Follow the anatomy skill to build a separate explanatory figure:

- Focus on the core principle without duplicating the entire main visualization.
- Choose a real mechanism or a physical analogy suitable for the target audience.
- Clearly connect “user action → component change → meaning of the principle.”
- Use terminology, units, and confirmed parameters consistent with the main visualization.
- If using an analogy, explain its correspondence to the real system and its limitations.
- Deliver standalone HTML or components appropriate for the project.
- Complete the skill’s geometry, interaction, and visual checks.

### Stage 4: Use Hairline

Follow the hairline-create skill to build a supporting illustration:

- Express one clear concept.
- Use it for an introduction, guidance, or an empty state without duplicating the previous visualizations.
- Choose the object and pointer interaction from the confirmed requirements.
- Follow Hairline’s line style, engine constraints, and validation process.
- Match the page’s background and line colors.
- Do not present decorative readouts as real equipment measurements.
- Preserve a separately runnable illustration.

### Stage 5: Integrate

Integrate the three visualizations into the final page:

- Follow the existing technology stack. For a new project, choose a simple approach that satisfies the requirements.
- Use each visualization’s supported embedding or component approach and keep clear module boundaries.
- Where synchronization is required, implement explicit shared state or communication interfaces with consistent parameter ranges and units.
- Validate message sources and data structures for iframe communication. Prevent update loops.
- Handle responsive layouts, loading failures, and external resource dependencies.
- Control simultaneous animation work. Check mobile presentation, keyboard interaction, and reduced-motion behavior.
- Explain whether an internet connection is required.

### Stage 6: Verify and Deliver

Run the project and check:

- Core resources load successfully, with no errors blocking functionality.
- All required interactions work.
- There are no obvious intersections, floating parts, or incorrect explosion paths.
- Calculations, readouts, units, and explanations agree.
- Desktop and mobile layouts are readable.
- Synchronized interactions work at boundary values and under repeated input.
- If a video is required, the finished video is complete and contains no corrupted frames.

Deliver:

1. The finished entry point and source locations.
2. Instructions for opening or running the project.
3. The actual contribution of each skill.
4. Parameter sources, demonstration assumptions, and model simplifications.
5. Completed checks and remaining limitations.
6. The requested video, if applicable.