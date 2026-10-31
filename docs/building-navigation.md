# Building navigation and display screens

The top navigation opens the workshop exhibit immediately, with a short camera dolly.
There is no player teleport, map stop, or Enter step. All categories share one large live content panel, with an integrated title, close button,
section navigation and previous/next controls. Decorative wooden frame artwork is no longer rendered. The original 3D workshop remains visible with no backdrop tint or blur. The frame fits the viewport;
live HTML controls and text are not scaled by the world-space camera projection.
Press **Esc**, gamepad **B**, or the close button to return to the current category's
corresponding entrance. Switching from Careers to Trends and then exiting leaves the
character at the Trends workshop; it does not restart the intro or reset saved progress.

The camera still faces the workshop display. The active interface uses a shared sans-serif
stack, navy text on pale parchment, and white text on purple for selected controls.
These styles only apply inside the exhibit. The transparent illustration cannot intercept input.

The display uses the original CareerUI renderers, forms, file inputs, filters, translations,
and API actions. Its section buttons jump to existing headings. Labelled footer controls
switch functional categories. Small arrows below the display browse careers or scroll the
current content. Internal links stay on the display.

The retired workshop board, title and side signs are hidden during a visit. Labelled left/right
category controls are integrated into the content panel and keep using the existing
`building-room` actions. Footer page controls browse careers or scroll the current content.
The surrounding game world stays visible. The display fills the available viewport instead
of constraining live content to the illustration's original aspect ratio.

The following walking entrances remain optional; they are not part of the menu flow:

| Menu | Building |
| --- | --- |
| Profile | Lab |
| Careers | Career |
| Trends | Projects workshop |
| Pet | Dedicated Pet stop beside the landing plaza (separate map pin and interaction) |
| Roadmap | Behind the Scene |
| SDGs | Altar |
| Log | Cookie stand |
| Leaderboard | Achievements lodge |
| Settings | Social |

## Windows development

Use Node.js **24 or newer**. From the repository root, in Command Prompt or PowerShell:

```text
npm ci --prefix src/game
npm --prefix src/game run dev -- --port 5174 --host 127.0.0.1
```

Open `http://127.0.0.1:5174/` in Chrome or Edge and keep the terminal running.
If PowerShell blocks the npm script shim, use `npm.cmd` for the same commands.
The new navigation/display code uses standard JavaScript, Three.js, GSAP and CSS transforms;
it does not require macOS utilities, Unix shell scripts, Python, or new packages.
AI features still require the project's usual server credentials/configuration.

Checks from the repository root:

```text
node --test tests/game/world-building/*.test.mjs
npm run build
```

Native Windows GPU/browser verification should cover: immediate menu entry without Enter,
large-arrow category switching without an intermediate map, editable form fields, file selection,
category jumps, career arrows, roadmap scrolling, resizing, and exiting back to movement. Unit tests/builds do
not replace this hardware check.
