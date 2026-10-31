# Building navigation and display screens

The top navigation opens the workshop exhibit immediately, with a short camera dolly.
There is no player teleport, map stop, or Enter step. Existing career UI is projected onto
the original wooden display, retaining the workshop title, subtitle and surrounding frame.
The two wooden side signs and their arrows are smaller and sit forward of the frame posts,
so their lettering and navigation remain visible without covering the content.
Press **Esc**, gamepad **B**, or the close button to return to the current category's
corresponding entrance. Switching from Careers to Trends and then exiting leaves the
character at the Trends workshop; it does not restart the intro or reset saved progress.

The camera faces the display straight on for a flat rectangular layout. Sign lettering
uses the face's two actual dimensions (including Blender's XZ planes), avoiding stretched
Chinese text. Display fonts use a shared sans-serif stack, dark text on white, and white
text on purple for selected controls. These styles only apply inside the exhibit.

The display uses the original CareerUI renderers, forms, file inputs, filters, translations,
and API actions. Its section buttons jump to existing headings. The compact wooden side controls
switch functional categories. Small arrows below the display browse careers or scroll the
current content. Square markers jump to sections/careers. Internal links stay on the display.

The following walking entrances remain optional; they are not part of the menu flow:

| Menu | Building |
| --- | --- |
| Profile | Lab |
| Careers | Career |
| Trends | Projects workshop |
| Pet | Landing kiosk |
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
