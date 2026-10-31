# Shared fantasy exhibit design

Approved direction: apply the second reference image's purple fantasy board design to every shared building panel (profile, careers, market, pet, roadmap, SDG, log, leaderboard and settings).

Use an illustrated purple wood frame with autumn leaves, lantern, gold fasteners and a purple mascot. Keep the title and brand live in the upper plaque. The reading surface uses pale parchment, navy text, lavender controls and dimensional purple primary buttons. Tables, forms, learning evidence, maps and all other page content remain live HTML.

The frame is decorative and cannot intercept input. The content scrolls independently. Previous/next room controls, close button and Escape remain functional. The camera/visit lifecycle remains unchanged. The shared board fits the viewport; narrow screens retain readable text and wrapping controls. Existing local AI/data work is outside this change.

User refinement: the original 3D game background must remain visible. Do not add a full-screen backdrop, tint, dimming layer or background blur around the board.

Verification: inspect the asset's alpha and layout, run the world-building interaction regression tests, build production assets, and visually verify the live page in Chrome, including switching panels and closing the board.

User refinement: remove the lantern from the frame, preserve the original world-space category arrow buttons, and keep their HTML hit regions updated while the fantasy frame is active. The remaining frame artwork stays unchanged.

User refinement: hide the retired 3D board and side signs while the new board is open; attach category arrows directly to the new purple frame. Expand the board to the viewport width and height, remove both bottom rock clusters, and slim the illustrated margins so the content opening gains width and height. Keep the mascot small on the lower wooden rail and retain background transparency.

Final user direction: remove the entire illustrated wooden frame and its ornaments. Show only the large live content panel with an integrated title, close button, section navigation and previous/next controls in normal document flow. Keep the original 3D background visible and the old display hidden during visits.

Latest sizing refinement: center the desktop panel at about 82% of the viewport width (maximum 1480px) and 86% of its height (maximum 900px). Reserve at least 80px on each side for prominent previous/next category buttons; compact screens keep these controls inside the panel. Use escaped arrow glyphs so they cannot become question marks through shell encoding.
