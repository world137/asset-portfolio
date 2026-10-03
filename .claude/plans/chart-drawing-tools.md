# Plan: Chart drawing tools (TradingView-style)

**Goal:** On the Technical tab candle chart, user can draw trend lines, rays, horizontal/vertical lines, rectangles and Fib retracements, move/delete them, and they persist per symbol.

## Steps
- [x] Look at how TechnicalAnalysis passes data to CandleChart (symbol for persistence key)
- [x] Add drawing state + toolbar (cursor, trend, ray, hline, vline, rect, fib, magnet, color, undo, delete, clear) to CandleChart in PriceChart.jsx
- [x] Drawings stored in data coords (time, price) so they survive range/zoom changes; persisted in localStorage per symbol
- [x] SVG render layer: lines, ray, rect, fib levels + labels, handles on selected
- [x] Interaction: click-click to create, drag body/handles to edit, Esc cancels, Delete removes, magnet snap to OHLC
- [x] Pass `storageKey` from TechnicalAnalysis; verify in browser (local dev) and check console for errors

## Notes
No build step; Babel-in-browser JSX. Hooks must stay above CandleChart's early return.
- Verified in an isolated harness (real CandleChart + synthetic bars): fib draw/magnet, persistence across reload, drag, Delete key. Full app not run (needs Docker/login).
- Not done: measure tool, text notes, fib extension, drawings in the Price Chart modal (no storageKey passed there).
