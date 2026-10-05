# Plan: Pine settings panel, full-page chart, per-symbol drawings everywhere

**Goal:** Every pine.cs input is editable (persisted), chart opens full page, and drawings save per symbol in every place the candle chart appears.

## Steps
- [x] PineOverlay.jsx: settings object S (all pine.cs inputs, defaults), computePine/renderPine take S
- [x] PineOverlay.jsx: declarative field list + PineSettingsPanel (groups, toggles, numbers, colors, reset)
- [x] CandleChart: replace layer chips with settings panel, persist S, memo on S
- [x] CandleChart: full-page mode (portal overlay, larger viewBox, range buttons, Esc/close)
- [x] Drawings: normalize symbol key, pass storageKey from price-chart modal too, show "saved for SYMBOL"
- [x] Verify in harness (settings change redraws, fullscreen, save/reload per symbol)

## Notes
Server (Supabase) sync of drawings NOT done: needs new table/migration on live DB -> ask user first.
