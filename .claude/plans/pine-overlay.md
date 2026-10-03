# Plan: Port pine.cs visuals onto the Technical candle chart

**Goal:** CandleChart can show the TradingView "CDC ActionZone V2 + Ichimoku + Confluence + Volume Profile" overlays (toggleable), matching pine.cs logic.

## Steps
- [x] New src/components/PineOverlay.jsx: computePine(bars) — per-bar zone, MA/EMA, Ichimoku, signals, confluence score, ATR TP/SL
- [x] renderPine(): back layer (zone ribbon, Ichimoku cloud, volume profile, TP/SL boxes) + front layer (lines, markers, labels)
- [x] Wire into CandleChart: layer toggle panel (persisted), right-side padding for Ichimoku forward span, memoized compute
- [x] Add script to index.html
- [x] Verify in harness (real TA math loaded) + console check, screenshot

## Notes
Reuses ta* math from TechnicalAnalysis.jsx (globals resolved at render time).
Confluence table not ported (Technical tab already has one).
Signal numbering counts from the start of the loaded window, not full history like TV.
