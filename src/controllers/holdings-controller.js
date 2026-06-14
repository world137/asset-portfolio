/* controllers/holdings-controller.js — Squarified treemap layout algorithm.
   Extracted from HoldingsView.jsx — pure math, no UI dependency.
   Exposed as window.squarifiedTreemap for use in the BentoView component. */

function _tmAspect(row, rowArea, layoutLen) {
  let worst = 0;
  for (const item of row) {
    const iLong  = rowArea > 0 ? (item.norm / rowArea) * layoutLen : 0;
    const iCross = layoutLen > 0 ? rowArea / layoutLen : 0;
    if (iLong > 0 && iCross > 0) worst = Math.max(worst, Math.max(iLong / iCross, iCross / iLong));
  }
  return worst;
}

function _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out) {
  if (isWide) {
    const stripH = w > 0 ? rowArea / w : 0;
    let cx = x;
    for (const item of row) {
      const iw = rowArea > 0 ? (item.norm / rowArea) * w : 0;
      out.push({ data: item.data, x: cx, y, w: iw, h: stripH });
      cx += iw;
    }
  } else {
    const stripW = h > 0 ? rowArea / h : 0;
    let cy = y;
    for (const item of row) {
      const ih = rowArea > 0 ? (item.norm / rowArea) * h : 0;
      out.push({ data: item.data, x, y: cy, w: stripW, h: ih });
      cy += ih;
    }
  }
}

function _tmSquarify(items, x, y, w, h, out) {
  if (!items.length || w <= 0 || h <= 0) return;
  if (items.length === 1) { out.push({ data: items[0].data, x, y, w, h }); return; }

  const isWide    = w >= h;
  const layoutLen = isWide ? w : h;
  let row = [], rowArea = 0, prevWorst = Infinity;

  for (let i = 0; i < items.length; i++) {
    const testRow   = [...row, items[i]];
    const testArea  = rowArea + items[i].norm;
    const testWorst = _tmAspect(testRow, testArea, layoutLen);

    if (row.length > 0 && testWorst > prevWorst) {
      _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out);
      if (isWide) {
        const stripH = rowArea / w;
        _tmSquarify(items.slice(i), x, y + stripH, w, Math.max(0, h - stripH), out);
      } else {
        const stripW = rowArea / h;
        _tmSquarify(items.slice(i), x + stripW, y, Math.max(0, w - stripW), h, out);
      }
      return;
    }
    row.push(items[i]);
    rowArea   = testArea;
    prevWorst = testWorst;
  }
  _tmPlaceRow(row, rowArea, x, y, w, h, isWide, out);
}

function squarifiedTreemap(dataItems, totalW, totalH) {
  if (!dataItems.length || totalW <= 0 || totalH <= 0) return [];
  const total = dataItems.reduce((s, i) => s + i.value, 0);
  if (!total) return [];
  const area   = totalW * totalH;
  const normed = [...dataItems]
    .sort((a, b) => b.value - a.value)
    .map(d => ({ data: d, norm: (d.value / total) * area }));
  const out = [];
  _tmSquarify(normed, 0, 0, totalW, totalH, out);
  return out;
}
