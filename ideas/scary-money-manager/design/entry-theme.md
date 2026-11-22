# Entry screens: "The Crypt"

The look of every screen before the main app: the model loader, the password screen, the "Opening the crypt…" wait and Setup. Code: `src/theme/Crypt.tsx` and `src/theme/crypt.css`. Screenshots: `shots/` (regenerate with `npm run build; node e2e/shots.mjs`).

## Design philosophy

**Lantern Hour.** The moment before the books open is a vigil at night. Everything outside the slab of stone is dusk: a blue-black sky, a low moon, fog moving at the pace of breathing, a ridge of graves along the horizon. The graveyard is the setting, never the subject. It sits low and quiet so the one lit object, the card in the middle, reads as the only warm thing in the cold.

**Light comes from two sources only.** Spectral green belongs to the ghosts' world: the rim of the card, the title's glow, the ectoplasm in the progress bar, the "balanced" state. Pumpkin orange belongs to the living: buttons, the current step, embers rising from the ground, the candle inside the pumpkin. Danger is a separate red, and it appears only when the books do not balance. There is no third accent. The palette deliberately leaves out the purple of the main app's dark theme, so the two worlds never blur.

**The ghosts are characters, not decoration.** One ghost guards each card from its top corner and reacts to what you do. It carries a lantern while the model loads, covers its eyes while you type a password, shakes its head and worries at a wrong one, and loops in delight when your books balance. The other ghosts drift across the sky on their own slow paths. One even loops the loop. Each ghost blinks, wobbles and bobs on its own clock, so the motion never syncs into a pattern.

**Motion is constant but slow at the edges and quick at the centre.** The background moves on 20- to 30-second cycles (fog, flight paths, embers). The card moves only in answer to the user: it rises once on arrival, buttons lift on hover and press on click, the current step spins, and the imbalance pulses until it reaches zero. The user asked for animations to be always on.

**Type is a quiet serif for the title, with a faint candle flicker, and the system font for everything you read or type.** The card is nearly opaque, so text stays easy to read over a moving scene. It is the one surface that never moves while you use it.

## Rules for changes
- Entry screens use `data-theme="crypt"` (set by `EntryStage`, and on `<html>` in `index.html` so there is no flash). The main app's `AppShell` replaces it with its net-worth theme.
- Use the crypt variables (`--accent` orange, `--accent2` and `--good` green, `--bad` red). Never use the main app's purple.
- The ghost is an original drawing in the spirit of Kiro's mascot, not the official logo. If you have the right to use the official Kiro ghost artwork, replace the drawing in `KiroGhost` and keep the `mood-*` classes.
- Decoration stays `aria-hidden` and never takes pointer events.

## The ghost's hand (the note under the title)
The same restraint applies inside the main app. One line of handwriting sits under the title, written by a small ghost whose quill scratches at the tip of the ink. Each new letter lands with a brief bleed, as if it were soaking into paper. When the line is finished the quill disappears and the ghost bobs and waits. Minutes later the ink lifts away and a new line takes its place. The joke is always true: every line names a real figure from the books, so the humour stays honest. Ink takes the theme's accent colour, glowing only after dark.
