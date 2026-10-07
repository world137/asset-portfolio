# Plan: Candle chart drag-to-pan / zoom / rescale

**Goal:** The shared `CandleChart` (src/components/PriceChart.jsx) supports click-drag
panning through history, scroll/pinch zoom on candle count, drag-to-rescale on the
Y-axis, a visible-range high/low reference line, while keeping the existing
30/60/90/120-day quick-jump buttons in TechnicalAnalysis.jsx working as "jump to
last N and reset view".

## Steps
- [x] Read current CandleChart implementation (PriceChart.jsx) and its usage in
      TechnicalAnalysis.jsx to understand the fixed `daysBack` slicing.
- [x] Read ChartDrawings.jsx to confirm drawing tool drag/click handling won't
      conflict with new pan/zoom handlers (drawing handles call stopPropagation
      on mousedown, so chart-level pan listener is safe).
- [x] Add pan/zoom view state (`{count, end}` indices into `bars`) to CandleChart,
      replacing the fixed `bars.slice(-(daysBack||bars.length))`.
- [x] Reset view state to "last N" whenever `daysBack` prop changes (quick-jump
      buttons) or the symbol (`storageKey`) changes.
- [x] Implement click-drag panning (mousedown/mousemove/mouseup) on the main SVG,
      active only when the drawing tool is 'cursor', without breaking drawing
      tool interactions.
- [x] Implement wheel-based zoom (change visible candle count, anchored at cursor
      position) with sane min/max candle count clamps.
- [x] Implement Y-axis drag-to-rescale (manual zoom around price range), with
      double-click to reset to auto-fit.
- [x] Add a high/low reference line (dashed) for the currently visible candle
      range, with price labels.
- [x] Update cursor styling (grab/grabbing) to signal the chart is draggable.
- [x] Manual sanity pass reading the diff for correctness (no dev server/build
      step exists in this project per CLAUDE.md).

## Notes
- Project has no build/test/lint step — verification is by careful reading of
  the diff (browser JSX transpiled at runtime via Babel standalone).
- Drawings are stored in time/price data coordinates (ChartDrawings.jsx `cdFrac`/
  `cdToPx`), so they stay correctly anchored across pan/zoom automatically.
- User-confirmed scope (via clarifying question): pan + zoom + Y-axis rescale +
  keep day buttons + high/low reference line (not adjusted OHLC values).
