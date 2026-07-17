# Character Wall Foreground Design QA

source visual truth path: `C:\Users\DK-EC-~1\AppData\Local\Temp\codex-clipboard-817774ab-1bbd-4d5f-8798-9dc83eb2db66.png`

implementation screenshot paths:

- `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-wall-foreground-mobile.png`
- `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-wall-foreground-desktop.png`
- normalized comparison: `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-wall-foreground-comparison.png`

viewport: source 475×917; implementation 390×844 mobile and 1280×900 desktop

state: E寶 active round with the back-view character horizontally centered over the visible wall and rendered above the wall layer

primary interactions tested:

- Selected E寶 and started a natural round on mobile and desktop.
- Fired one dart in the mobile round; score changed from 0 to 1, confirming the relocated pointer origin still produces working shots.
- Checked browser console after both responsive states; 0 warnings and 0 errors.

## Full-view comparison evidence

The combined comparison shows the annotated source on the left and the 390×844 implementation on the right at a normalized height. The character moved from the original wall-top position into the red-circle wall region. Its horizontal center remains aligned with the wall center. The character is now visibly in front of the complete wall surface, including the torso, legs, and raised dart hand.

The desktop capture extends the same proportional rule: the character is centered on the wall, the wall remains fully visible behind it, and no gameplay HUD or balloon area shifts occurred.

## Focused region comparison evidence

The lower comparison row crops the wall/character region from both images. The source red circle marks the intended target position; the implementation places the E寶 body center inside that region and confirms the wall no longer masks the sprite. A focused crop is sufficient because the requested change affects only this region; balloon positions are randomized and are not fidelity targets.

## Required fidelity surfaces

- Fonts and typography: unchanged from the approved game; HUD family, weight, size, line height, and hierarchy remain consistent. No new text was introduced.
- Spacing and layout rhythm: the only intentional spacing change is the character's vertical anchor. Horizontal centering, HUD height, wall width, and playfield proportions remain unchanged.
- Colors and visual tokens: background, wall, HUD, character, balloon, and heart colors are unchanged.
- Image quality and asset fidelity: the existing GPT-generated E寶 back-view and wall PNGs are reused at their prior scale. No stretching, replacement art, halo, or new compression artifact is visible.
- Copy and content: all game labels, score, health, timer, and character marking remain unchanged.

## Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none required for the requested annotation.

## Comparison history

- First pass: implementation matches the approved A layout. No actionable P0/P1/P2 difference was found, so no design-QA repair iteration was required.

## Implementation checklist

- Character center aligned with visible wall center: passed.
- Character rendered above wall: passed.
- Darts and effects remain above character and wall: passed by automated layer-order contract.
- Mobile 390×844: passed.
- Desktop 1280×900: passed.
- Browser warnings/errors: 0/0.

## Character Selection Target Rule Banner QA

source visual truth path: `C:\Users\DK-EC-~1\AppData\Local\Temp\codex-clipboard-aba8f7fa-612d-49f7-9f4a-dcb974b0e48f.png`

implementation screenshot paths:

- `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-select-rules-desktop.png`
- `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-select-rules-mobile.png`
- normalized comparison: `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\output\playwright\character-select-rules-comparison.png`

viewport: source 855 x 578; implementation 1280 x 900 desktop and 390 x 844 mobile

state: unselected character-selection screen, followed by a selected E寶 interaction check

primary interactions tested:

- Confirmed the target rule banner appears directly below the selection prompt and directly above the four character cards.
- Selected E寶 and confirmed the primary `開始任務` button changes from disabled to enabled.
- Started an E寶 round and clicked the live Canvas; the dart hit a disallowed balloon, changing score from 0 to -1 and health from 5 to 4 with 0 browser warnings/errors, confirming the extracted combat path is wired into gameplay.
- Confirmed the mobile page has no horizontal or vertical overflow at 390 x 844.
- Checked browser console after responsive and selected states; 0 warnings and 0 errors.

### Full-view comparison evidence

The side-by-side comparison keeps the supplied selection screen as the source and shows the implemented desktop screen beside it. The existing title, character-card order, card styling, primary button, and background composition remain intact. The only intentional addition is the compact two-line rule banner in the selected A position.

### Focused region comparison evidence

The new banner sits in the visual gap between `選擇你的出戰角色` and the card grid. Its centered two-line copy preserves the screen hierarchy, uses the existing warm yellow accent for team letters, and does not compete with the title or character images. On mobile, the same content remains two concise lines above the 2 x 2 card grid and leaves the primary action fully visible.

### Required fidelity surfaces

- Fonts and typography: the banner reuses the existing game font stack and bold hierarchy; team letters receive the existing warm yellow accent.
- Spacing and layout rhythm: desktop and mobile retain the approved title, card, and button rhythm; the banner uses a compact 12 px bottom gap before the cards.
- Colors and visual tokens: the banner uses the current dark-green panel language, white border/text, and yellow accent. Character-card top accents now match the approved identity colors: D sky blue, K mint green, E bright yellow, and C coral red.
- Image quality and asset fidelity: all four existing GPT-generated front-view character assets remain unchanged, uncropped, and sharp.
- Copy and content: both target rules are explicit and exact—D寶/K寶 target E/C; E寶/C寶 target D/K.

### Findings

- P0: none.
- P1: none.
- P2: none.
- P3: none required for the requested addition.

### Comparison history

- First pass: the A-position banner matched the requested location and fit both responsive targets. No actionable P0/P1/P2 issue was found, so no visual repair iteration was required.

### Implementation checklist

- Banner below selection prompt and above cards: passed.
- Exact two-line shooting rules: passed.
- Character-card accents match D/K/E/C identity colors: passed.
- Desktop 1280 x 900: passed.
- Mobile 390 x 844: passed.
- Mobile overflow: 0 px horizontally and vertically.
- E寶 selection enables start button: passed.
- Browser warnings/errors: 0/0.

final result: passed

## Grades, Rules Dialog, Spawn Line, Target Badge, and Rewards QA — 2026-07-17

### Automated evidence

- Full Node test suite: 72 passed, 0 failed, 0 skipped.
- Grade boundaries verified at 55/54, 40/39, 25/24, 10/9, zero, and negative scores.
- Reward records verified exactly: D/NT$10/NVPF9V7Q, C/NT$20/U7V5XBWU, B/NT$50/CGWDFXPW, A/NT$100/9FYCZR38, and S/NT$300/SVHCDEKK.
- Spawn-line collision tests confirm partially hidden ordinary and heart balloons cannot be hit.
- Speed regression confirms later balloons retain the original `55 + 25 * random` speed calculation and existing difficulty multiplier; no entry-speed multiplier exists.
- Production verification: 2 bundles, 2 index references, and 12 generated game assets.

### Browser evidence

- Desktop 1280 x 900: rules dialog opened automatically, was fully visible, and had no horizontal or vertical overflow.
- Mobile 390 x 844: rules dialog fit the viewport with `scrollWidth = 390`, matching `innerWidth = 390`.
- Closing the dialog exposed selection; selecting D enabled the start action.
- The first game frame showed six staggered balloons above the wall area without an entry-speed boost.
- D gameplay displayed the target badge immediately left of the character with E and C target balloons.
- Returning from results through `更換角色` reopened the blocking rules dialog.
- D result showed exactly one reward action: `領取 D 級獎勵｜官網購物金 NT$10`.
- The D reward action used the exact `NVPF9V7Q` URL, `target="_blank"`, and `rel="noopener noreferrer"`.
- Mobile result overflow: 0 px.
- Browser warnings/errors after the complete flow: 0.

### Single-file artifact

- File: `C:\Users\DK-EC-PC3\Desktop\小精靈ip\balloon-game\export\DKEC氣球特攻隊-單檔版.html`
- Size: 17,781,956 bytes.
- Unique embedded PNGs: 12.
- Remaining `/assets/` paths: 0.
- SHA-256: `0AC68934D286704716F9DFA9EE25B2FFDF82B78892AEACE70CEAFBE5BD44981E`.

final result: passed
