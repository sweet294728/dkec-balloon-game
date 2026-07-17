# Balloon Game Instructions

- Keep this app standalone under `balloon-game/`; do not couple it to `site/`.
- Use React 19, Vite 6, and JavaScript ES modules.
- Keep game rules pure and covered by `node:test` tests in `tests/`.
- Run `npm.cmd test` and `npm.cmd run build` before handing off changes.
- Do not add audio, login, multiplayer, or finished project images.
- Character-select artwork uses GPT-generated front views; in-game character sprites use GPT-generated back views facing the balloons, with D/K/E/C visible on the camouflage uniform back.
- D's front bow tie must never appear in the back-view gameplay sprite. K's back-view garment must be a continuous rear panel with no crossed front lapels or front buttons.
- C's camouflage top must fully cover the belly in both front and back views; place the C letter on the garment, not on exposed body.
