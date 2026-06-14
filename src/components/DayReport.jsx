/* eslint-disable */
/* DayReport.jsx — daily best/worst report per asset class, with Telegram send */

const REPORT_CLASSES = [
  { key: 'crypto',    label: 'Crypto' },
  { key: 'usaStock',  label: 'USA' },
  { key: 'etf',       label: 'ETF' },
  { key: 'thaiStock', label: 'Thai' },
  { key: 'fund',      label: 'Fund' },
  { key: 'gold',      label: 'Gold' },
];

function buildReportGroups() {
  const groups = [];
  for (const rc of REPORT_CLASSES) {
    const cls      = Store.classByKey(rc.key);
    if (!cls) continue;
    const positions = Store.positions(rc.key);
    if (!positions.length) continue;

    const assets = positions.map(p => ({
      name:   p.name.replace(/THB$/, ''),
      rawName: p.name,
      dayPct: Store.dayChangePct(rc.key, p.name),
      totalPct: p.pct,
      value:  Store.toDisplay(p.value, cls.ccy),
    })).filter(a => a.dayPct != null);

    if (!assets.length) continue;

    assets.sort((a, b) => b.dayPct - a.dayPct);
    const best  = assets[0];
    const worst = assets[assets.length - 1];

    groups.push({ key: rc.key, label: rc.label, assets, best, worst, single: assets.length === 1 });
  }
  return groups;
}

function formatTelegramText(groups) {
  const now   = new Date();
  const local = new Date(now.getTime() + 7 * 60 * 60000);
  const d     = local.toISOString().slice(0, 10).split('-');
  const date  = `${d[2]}-${d[1]}-${d[0]}`;
  const hh    = String(local.getUTCHours()).padStart(2, '0');
  const mm    = String(local.getUTCMinutes()).padStart(2, '0');
  const time  = `${hh}:${mm}`;
  const DIV   = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const CLASS_EMOJI_LOCAL = { crypto: '🪙', usaStock: '🇺🇸', etf: '📦', thaiStock: '🇹🇭', fund: '🏦', gold: '🥇' };

  const allAssets = groups.flatMap(g => g.assets);
  const gainers   = allAssets.filter(a => a.dayPct > 0).length;
  const losers    = allAssets.filter(a => a.dayPct < 0).length;
  const avgPct    = allAssets.length
    ? allAssets.reduce((s, a) => s + (a.dayPct || 0), 0) / allAssets.length
    : 0;
  const moodEmoji = avgPct >= 1 ? '🟢' : avgPct <= -1 ? '🔴' : '🟡';

  let msg = `${moodEmoji} Daily Portfolio Report\n`;
  msg    += `${date} · ${time} ICT\n`;
  msg    += `${DIV}\n`;
  msg    += `${gainers} up  ${losers} down  ${allAssets.length} tracked\n`;
  msg    += `${DIV}\n`;

  for (const g of groups) {
    const em    = CLASS_EMOJI_LOCAL[g.key] || '📁';
    const n     = g.assets.length;
    const bSign = g.best.dayPct >= 0 ? '+' : '';
    const wSign = g.worst ? (g.worst.dayPct >= 0 ? '+' : '') : '';
    if (g.single) {
      const arrow = g.best.dayPct >= 0 ? '▲' : '▼';
      msg += `${em} ${g.label}  ${arrow} ${g.best.name} ${bSign}${g.best.dayPct.toFixed(2)}%\n`;
    } else {
      msg += `${em} ${g.label} (${n})  ▲ ${g.best.name} ${bSign}${g.best.dayPct.toFixed(2)}%  ▼ ${g.worst.name} ${wSign}${g.worst.dayPct.toFixed(2)}%\n`;
    }
  }
  msg += `${DIV}\n`;

  const rows = buildDayRows();
  if (!rows.length) return msg;

  const ccySym = ccy => ccy === 'USD' ? '$' : '฿';

  function fmtChg(v, ccy) {
    const abs = Math.abs(v);
    let s;
    if (abs >= 10000)    s = Math.round(abs).toLocaleString('en');
    else if (abs >= 100) s = abs.toFixed(2);
    else if (abs >= 1)   s = abs.toFixed(3);
    else                 s = abs.toFixed(5);
    return (v >= 0 ? '+' : '-') + ccySym(ccy) + s;
  }
  function fmtPx(v, ccy) {
    if (v == null) return '—';
    const abs = Math.abs(v);
    let s;
    if (abs >= 1e6)       s = (abs / 1e6).toFixed(2) + 'M';
    else if (abs >= 1000) s = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    else if (abs >= 10)   s = abs.toFixed(2);
    else if (abs >= 0.01) s = abs.toFixed(4);
    else                  s = abs.toFixed(6);
    return (v < 0 ? '-' : '') + ccySym(ccy) + s;
  }

  const pctStr = pct => (pct >= 0 ? '▲+' : '▼') + pct.toFixed(2) + '%';
  const pad    = (s, n) => String(s).padEnd(n);
  const padR   = (s, n) => String(s).padStart(n);

  // group rows by class, preserving REPORT_CLASSES order
  const byClass = {};
  for (const r of rows) {
    if (!byClass[r.classKey]) byClass[r.classKey] = [];
    byClass[r.classKey].push(r);
  }
  const classOrder = REPORT_CLASSES.map(rc => rc.key);

  for (const key of classOrder) {
    const group = byClass[key];
    if (!group || !group.length) continue;

    const rc      = REPORT_CLASSES.find(r => r.key === key);
    const em      = CLASS_EMOJI_LOCAL[key] || '📁';
    const sorted  = [...group].sort((a, b) => b.dayPct - a.dayPct);

    const fmt = sorted.map((r, i) => ({
      rank:  String(i + 1) + '.',
      name:  r.name,
      pct:   pctStr(r.dayPct),
      price: fmtPx(r.cur, r.ccy),
      chg:   fmtChg(r.changeAbs, r.ccy),
    }));

    const rkW = Math.max(2, ...fmt.map(r => r.rank.length));
    const nW  = Math.max(4, ...fmt.map(r => r.name.length));
    const pW  = Math.max(5, ...fmt.map(r => r.pct.length));
    const prW = Math.max(5, ...fmt.map(r => r.price.length));
    const gW  = Math.max(3, ...fmt.map(r => r.chg.length));

    const header = pad('#', rkW) + ' ' + pad('Name', nW) + '  ' + padR('Day%', pW) + '  ' + padR('Price', prW) + '  ' + padR('Chg', gW);
    const sep    = '─'.repeat(header.length);
    const body   = fmt.map(r =>
      pad(r.rank, rkW) + ' ' + pad(r.name, nW) + '  ' + padR(r.pct, pW) + '  ' + padR(r.price, prW) + '  ' + padR(r.chg, gW)
    ).join('\n');

    msg += `${em} ${rc.label}\n${header}\n${sep}\n${body}\n${DIV}\n`;
  }

  return msg.trimEnd();
}

function DayReportCard({ group }) {
  const isGreen = pct => pct >= 0;

  const PctBadge = ({ pct }) => (
    <span style={{
      fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums',
      color: pct >= 0 ? 'var(--green-600,#1a9e5c)' : 'var(--red-600,#d63b3b)',
    }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );

  return (
    <div className="card" style={{ flex: '1 1 220px', minWidth: 200 }}>
      <div className="card-h" style={{ paddingBottom: 10 }}>
        <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: window.CLASS_COLORS[group.key] || '#888', display: 'inline-block', flexShrink: 0 }} />
          {group.label}
        </div>
        <div className="s">{group.assets.length} with day data</div>
      </div>
      <div className="card-b" style={{ paddingTop: 0 }}>
        {group.single ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ fontWeight: 600 }}>{group.best.name}</span>
            <PctBadge pct={group.best.dayPct} />
          </div>
        ) : (
          <React.Fragment>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-1)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--green-600,#1a9e5c)', fontWeight: 600, marginBottom: 2 }}>Best</div>
                <div style={{ fontWeight: 700 }}>{group.best.name}</div>
              </div>
              <PctBadge pct={group.best.dayPct} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--red-600,#d63b3b)', fontWeight: 600, marginBottom: 2 }}>Worst</div>
                <div style={{ fontWeight: 700 }}>{group.worst.name}</div>
              </div>
              <PctBadge pct={group.worst.dayPct} />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function DayReportView() {
  useStore();
  const [sending,  setSending]  = React.useState(false);
  const [sendMsg,  setSendMsg]  = React.useState(null);
  const [preview,  setPreview]  = React.useState(false);

  const groups = buildReportGroups();
  const hasData = groups.length > 0;
  const reportText = hasData ? formatTelegramText(groups) : '';

  const now = new Date();
  const offset = 7 * 60;
  const local = new Date(now.getTime() + offset * 60000);
  const d = local.toISOString().slice(0, 10).split('-');
  const todayTH = `${d[2]}-${d[1]}-${d[0]}`;

  async function sendToTelegram() {
    setSending(true);
    setSendMsg(null);
    try {
      const r = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true, portfolioId: Store.getPortfolioId() }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setSendMsg({ ok: true, text: 'Report sent to Telegram!' });
      } else {
        setSendMsg({ ok: false, text: j.error || 'Failed to send' });
      }
    } catch (e) {
      setSendMsg({ ok: false, text: e.message });
    } finally {
      setSending(false);
      setTimeout(() => setSendMsg(null), 4000);
    }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="t-h1" style={{ margin: '0 0 2px' }}>Day Report</h1>
          <div className="t-small">Best &amp; worst performer per asset class today · {todayTH}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasData && (
            <button style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-2)', cursor: 'pointer', background: 'transparent', color: 'var(--fg-2)' }}
                    onClick={() => setPreview(p => !p)}>
              {preview ? 'Hide preview' : 'Preview text'}
            </button>
          )}
          <Button variant="accent" icon="send" onClick={sendToTelegram} disabled={!hasData || sending}>
            {sending ? 'Sending…' : 'Send to Telegram'}
          </Button>
        </div>
      </div>

      {sendMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10,
                      background: sendMsg.ok ? 'var(--green-50,rgba(48,209,88,0.12))' : 'rgba(255,69,58,0.12)',
                      color: sendMsg.ok ? 'var(--green-600,#1a9e5c)' : 'var(--red-600,#d63b3b)',
                      fontWeight: 600, fontSize: 13 }}>
          {sendMsg.text}
        </div>
      )}

      {!hasData && (
        <div className="card">
          <div className="empty" style={{ padding: '40px 20px' }}>
            No live price data available yet. Prices refresh every 12 hours — make sure you have holdings with live prices (stocks, ETF, crypto).
          </div>
        </div>
      )}

      {hasData && (
        <React.Fragment>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            {groups.map(g => <DayReportCard key={g.key} group={g} />)}
          </div>

          {preview && (
            <div className="card">
              <div className="card-h">
                <div className="t">Telegram message preview</div>
                <div className="s">This is what will be sent</div>
              </div>
              <div className="card-b">
                <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-1)', whiteSpace: 'pre-wrap', margin: 0, background: 'var(--bg-sunken)', borderRadius: 8, padding: '12px 16px', lineHeight: 1.6 }}>
                  {reportText}
                </pre>
              </div>
            </div>
          )}

          <DayChangeTable />
        </React.Fragment>
      )}
    </div>
  );
}

// ── All-holdings day-change table ─────────────────────────────────────────────

function buildDayRows() {
  const rows = [];
  for (const cls of window.ASSET_CLASSES) {
    if (!cls.live) continue;
    const positions = Store.positions(cls.key);
    const settings  = Store.settings();
    for (const p of positions) {
      const dayPct = Store.dayChangePct(cls.key, p.name);
      if (dayPct == null) continue;
      // derive prev close from current price + pct
      const cur        = p.cur;
      const prevClose  = cur / (1 + dayPct / 100);
      const changeAbs  = cur - prevClose;
      rows.push({
        name:      p.name.replace(/THB$/, ''),
        classKey:  cls.key,
        classLabel: cls.short || cls.label,
        ccy:       cls.ccy,
        cur,
        prevClose,
        changeAbs,
        dayPct,
        value:     Store.toDisplay(p.value, cls.ccy),
      });
    }
  }
  return rows;
}

function DayChangeClassTable({ classKey, classLabel, rows }) {
  const { sortBy, sortDir, handleSort } = useSortState('dayPct');
  const settings = Store.settings();
  const sym      = window.ccySymbol(settings.displayCcy);

  const ccy = rows[0]?.ccy ?? 'THB';
  const ccySym = c => c === 'USD' ? '$' : '฿';
  const fmtPrice = (v, c) => {
    if (v == null) return '—';
    const abs = Math.abs(v);
    const s   = abs >= 1000 ? abs.toLocaleString('en', { maximumFractionDigits: 2 })
              : abs >= 10   ? abs.toFixed(2)
              : abs >= 0.1  ? abs.toFixed(4)
              : abs.toFixed(6);
    return (v < 0 ? '-' : '') + ccySym(c) + s;
  };

  const sorted = [...rows].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * ((bv ?? -Infinity) - (av ?? -Infinity));
  });

  const color = window.CLASS_COLORS[classKey] || '#888';

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-h">
        <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          {classLabel} — Day Change
        </div>
        <div className="s">{sorted.length} asset{sorted.length !== 1 ? 's' : ''} with live price data</div>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
              <SortTh col="name"      label="Asset"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="cur"       label="Price"   right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="changeAbs" label="Change"  right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="dayPct"    label="Day %"   right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortTh col="value"     label="Value"   right sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const pctColor = r.dayPct >= 0 ? 'var(--green-600,#1a9e5c)' : 'var(--red-600,#d63b3b)';
              const absSign  = r.changeAbs >= 0 ? '+' : '';
              const pctSign  = r.dayPct   >= 0 ? '+' : '';
              return (
                <tr key={r.name} style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.name}</td>
                  <td className="num" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPrice(r.cur, r.ccy)}
                  </td>
                  <td className="num" style={{ padding: '8px 12px', color: pctColor, fontVariantNumeric: 'tabular-nums' }}>
                    {absSign}{fmtPrice(r.changeAbs, r.ccy)}
                  </td>
                  <td className="num" style={{ padding: '8px 12px', color: pctColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {pctSign}{r.dayPct.toFixed(2)}%
                  </td>
                  <td className="num" style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
                    {sym}{window.fmtBig(r.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayChangeTable() {
  const rows = buildDayRows();
  if (!rows.length) return null;

  const byClass = {};
  for (const r of rows) {
    if (!byClass[r.classKey]) byClass[r.classKey] = { classKey: r.classKey, classLabel: r.classLabel, rows: [] };
    byClass[r.classKey].rows.push(r);
  }

  const order = window.ASSET_CLASSES.map(c => c.key);
  const groups = order.map(k => byClass[k]).filter(Boolean);

  return (
    <React.Fragment>
      {groups.map(g => (
        <DayChangeClassTable key={g.classKey} classKey={g.classKey} classLabel={g.classLabel} rows={g.rows} />
      ))}
    </React.Fragment>
  );
}

window.DayReportView = DayReportView;
