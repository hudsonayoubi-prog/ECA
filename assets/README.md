# Assets

The ECA ships with **no brand image files**. Everything visual is code:

- Colours, type and spacing: CSS custom properties at the top of `src/head.html` (see `copilot-handover/04-ui-design-system.md`).
- Icons: inline SVG paths in `src/app.js` (`const P = { … }`, rendered by `Icon`).
- Fonts: Barlow and Barlow Condensed from Google Fonts (link in `src/head.html`).
- University and TAFE logos: **not bundled**. Administrators and Managers upload each institution's official logo in the app
  (Universities & TAFEs → institution → Edit → Logo). The app resizes it to max 160 px and stores it as a data URL on the
  institution record. Until then, tiles show the institution code as a monogram. Do not redraw logos.

`screenshots/` holds reference captures of every screen, generated from `public/index.html` on 13 Oct 2026.
See `copilot-handover/FILE-MANIFEST.csv` for what each one shows.
