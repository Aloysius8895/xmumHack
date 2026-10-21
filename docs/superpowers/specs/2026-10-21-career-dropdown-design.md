# Career dropdown menu

Confirmed with the user: replace the upper-right legacy menu with a click-to-expand dropdown containing the seven career shortcuts shown in their first reference. Remove the always-visible left rail. Keep the existing icons, localized labels, panel actions and gym notification dot.

The trigger sits at the upper right and shows a menu icon, localized Menu label and chevron. The rounded narrow list drops down beneath it with vertically stacked icon-and-label buttons. Use the second reference's warm white (#fffbf8), dark gray (#383340) and pink (#ff659b), scoped to the menu. Other panels retain their current colors.

Follow-up layout confirmed by the user: remove the separate red upper-right map trigger, move the circular minimap from the lower right to the upper left, and move the original upper-left HUD beneath the upper-right menu. The HUD follows the dropdown in document flow so expansion pushes it down instead of overlapping it. Keep mobile minimap at 112px and limit the HUD/menu width so the two corners do not overlap. Keep opening the full map through the minimap or M key.

The list starts collapsed, toggles on click and closes on outside pointer press, Escape, focus leaving the menu, selecting a shortcut, or opening a panel/dialogue. Closed items are inert. Return focus to the trigger on Escape. Preserve native button keyboard activation, support arrow navigation, constrain dropdown height to the viewport, and respect reduced motion. Pause world input while the dropdown owns focus, then restore it when dismissed.

Retain internal legacy menu content used by unrelated game features; remove its visible trigger and route the normal pause shortcut to the new dropdown. Verify actual desktop/mobile rendering, seven panel routes, dismissal methods, focus, language changes and a production build. Preserve existing workspace changes.
