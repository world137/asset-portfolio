/* TechnicalAnalysis.jsx — Google Finance-style confluence analysis */

// ── Indicator math ──────────────────────────────────────────────────────────

function taEma(data, period) {
  const k = 2 / (period + 1);
  const out = new Array(data.length).fill(null);
  let i = 0;
  while (i < data.length && data[i] == null) i++;
  if (i >= data.length) return out;
  out[i] = data[i];
  for (let j = i + 1; j < data.length; j++) {
    out[j] = data[j] != null ? data[j] * k + out[j - 1] * (1 - k) : out[j - 1];
  }
  return out;
}

function taRma(data, period) {
  const out = new Array(data.length).fill(null);
  let i = 0;
  while (i < data.length && data[i] == null) i++;
  let sum = 0, cnt = 0;
  for (let j = i; j < i + period && j < data.length; j++) {
    if (data[j] != null) { sum += data[j]; cnt++; }
  }
  if (cnt < period) return out;
  out[i + period - 1] = sum / period;
  for (let j = i + period; j < data.length; j++) {
    if (data[j] != null && out[j - 1] != null)
      out[j] = (data[j] + (period - 1) * out[j - 1]) / period;
  }
  return out;
}

function taSma(data, period) {
  const out = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let s = 0, c = 0;
    for (let j = i - period + 1; j <= i; j++) { if (data[j] != null) { s += data[j]; c++; } }
    if (c === period) out[i] = s / period;
  }
  return out;
}

function taStdev(data, period, mean) {
  const out = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    if (mean[i] == null) continue;
    let sq = 0, c = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (data[j] != null) { sq += (data[j] - mean[i]) ** 2; c++; }
    }
    if (c === period) out[i] = Math.sqrt(sq / period);
  }
  return out;
}

function taHighest(data, period) {
  const out = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let mx = -Infinity;
    for (let j = i - period + 1; j <= i; j++) { if (data[j] != null && data[j] > mx) mx = data[j]; }
    if (mx !== -Infinity) out[i] = mx;
  }
  return out;
}

function taLowest(data, period) {
  const out = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let mn = Infinity;
    for (let j = i - period + 1; j <= i; j++) { if (data[j] != null && data[j] < mn) mn = data[j]; }
    if (mn !== Infinity) out[i] = mn;
  }
  return out;
}

function taDonchian(high, low, period) {
  const h = taHighest(high, period);
  const l = taLowest(low, period);
  return h.map((v, i) => v != null && l[i] != null ? (v + l[i]) / 2 : null);
}

function taRsi(close, period) {
  const out = new Array(close.length).fill(null);
  if (close.length <= period) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) { const d = close[i] - close[i-1]; if (d >= 0) g += d; else l -= d; }
  g /= period; l /= period;
  out[period] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = period + 1; i < close.length; i++) {
    const d = close[i] - close[i-1];
    g = (g * (period - 1) + Math.max(d,  0)) / period;
    l = (l * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

function taMacd(close, fast, slow, sig) {
  const ef = taEma(close, fast), es = taEma(close, slow);
  const line = ef.map((v, i) => v != null && es[i] != null ? v - es[i] : null);
  const signal = taEma(line, sig);
  return { line, signal };
}

function taObv(close, vol) {
  const out = new Array(close.length).fill(0);
  for (let i = 1; i < close.length; i++) {
    const v = vol[i] || 0;
    out[i] = close[i] > close[i-1] ? out[i-1] + v : close[i] < close[i-1] ? out[i-1] - v : out[i-1];
  }
  return out;
}

function taDmi(high, low, close, len, smooth) {
  const n = close.length;
  const tr = new Array(n).fill(null), pDM = new Array(n).fill(null), mDM = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(high[i]-low[i], Math.abs(high[i]-close[i-1]), Math.abs(low[i]-close[i-1]));
    const up = high[i]-high[i-1], dn = low[i-1]-low[i];
    pDM[i] = up > dn && up > 0 ? up : 0;
    mDM[i] = dn > up && dn > 0 ? dn : 0;
  }
  const smTR = taRma(tr, len), smP = taRma(pDM, len), smM = taRma(mDM, len);
  const plusDI  = smTR.map((v, i) => v && smP[i] != null && v !== 0 ? 100*smP[i]/v : null);
  const minusDI = smTR.map((v, i) => v && smM[i] != null && v !== 0 ? 100*smM[i]/v : null);
  const dx = plusDI.map((v, i) => {
    if (v == null || minusDI[i] == null) return null;
    const s = v + minusDI[i]; return s === 0 ? 0 : 100*Math.abs(v-minusDI[i])/s;
  });
  return { plusDI, minusDI, adx: taRma(dx, smooth) };
}

// ── Confluence computation ──────────────────────────────────────────────────

function computeConfluence(bars, cfg) {
  const {
    fastLen=12, slowLen=26,
    rsiLen=14, macdFastLen=12, macdSlowLen=26, macdSigLen=9,
    zLen=20, adxLen=14, adxSmooth=14, adxThresh=25, obvSigLen=20,
    gcFastLen=50, gcSlowLen=200,
    ichiConvLen=9, ichiBaseLen=26, ichiSpan2Len=52, ichiDisp=26,
    useCDC=true, useMacd=true, useAdx=true, useObv=true,
    useRsi=true, useZ=true, useIchi=true, useGC=true,
    buyThresh=4, sellThresh=4,
  } = cfg || {};

  const n = bars.length, last = n - 1;
  const close = bars.map(b => b.c), high = bars.map(b => b.h);
  const low   = bars.map(b => b.l), vol  = bars.map(b => b.v ?? 0);

  const emaFast = taEma(close, fastLen), emaSlow = taEma(close, slowLen);
  const lc = close[last], lef = emaFast[last], les = emaSlow[last];
  const green=lc>lef&&lef>les, yellow=lc>lef&&lef<les, blue=lc<lef&&lef>les, red=lc<lef&&lef<les;

  const rsiArr = taRsi(close, rsiLen);
  const lRsi = rsiArr[last];

  const { line: ml, signal: ms } = taMacd(close, macdFastLen, macdSlowLen, macdSigLen);
  const macdUp = ml[last] != null && ms[last] != null && ml[last] > ms[last];

  const zMean = taSma(close, zLen), zStd = taStdev(close, zLen, zMean);
  const lZ = zStd[last] && zStd[last] !== 0 ? (lc - zMean[last]) / zStd[last] : 0;

  const { plusDI, minusDI, adx } = taDmi(high, low, close, adxLen, adxSmooth);
  const lPDI=plusDI[last], lMDI=minusDI[last], lAdx=adx[last];
  const trendStrong = lAdx != null && lAdx >= adxThresh;

  const obvArr = taObv(close, vol), obvSig = taEma(obvArr, obvSigLen);
  const obvBull = obvArr[last] > obvSig[last];

  const gcFastArr = taSma(close, gcFastLen), gcSlowArr = taSma(close, gcSlowLen);
  const lGcF = gcFastArr[last], lGcS = gcSlowArr[last];
  const isGolden = lGcF != null && lGcS != null && lGcF > lGcS;

  const iConv = taDonchian(high, low, ichiConvLen);
  const iBase = taDonchian(high, low, ichiBaseLen);
  const iSpanA = iConv.map((v, i) => v != null && iBase[i] != null ? (v + iBase[i])/2 : null);
  const iSpanB = taDonchian(high, low, ichiSpan2Len);
  const di = last - (ichiDisp - 1);
  const spA = di >= 0 ? iSpanA[di] : null, spB = di >= 0 ? iSpanB[di] : null;
  const lConv = iConv[last], lBase = iBase[last];
  const ichiAbove = spA!=null && spB!=null && lc>spA && lc>spB && lConv>lBase;
  const ichiBelow = spA!=null && spB!=null && lc<spA && lc<spB && lConv<lBase;

  const cdcRaw  = green?1:red?-1:0;
  const macdRaw = macdUp?1:-1;
  const adxRaw  = trendStrong?(lPDI>lMDI?1:-1):0;
  const obvRaw  = obvBull?1:-1;
  const rsiRaw  = lRsi<=60?1:lRsi<=70?0:-1;
  const zRaw    = lZ<=1.75?1:lZ<=2.0?0:-1;
  const ichiRaw = ichiAbove?1:ichiBelow?-1:0;
  const gcRaw   = isGolden?1:-1;

  const scores = [
    useCDC ?cdcRaw:0, useMacd?macdRaw:0, useAdx?adxRaw:0, useObv?obvRaw:0,
    useRsi ?rsiRaw:0, useZ   ?zRaw   :0, useIchi?ichiRaw:0, useGC ?gcRaw:0,
  ];
  const totalScore  = scores.reduce((a, b) => a + b, 0);
  const activeCount = [useCDC,useMacd,useAdx,useObv,useRsi,useZ,useIchi,useGC].filter(Boolean).length;
  const rawVotes    = [cdcRaw,macdRaw,adxRaw,obvRaw,rsiRaw,zRaw,ichiRaw,gcRaw];
  const toggles     = [useCDC,useMacd,useAdx,useObv,useRsi,useZ,useIchi,useGC];
  const bullVotes   = rawVotes.filter((v,i) => toggles[i] && v>0).length;
  const bearVotes   = rawVotes.filter((v,i) => toggles[i] && v<0).length;
  const confidence  = activeCount>0 ? Math.round(Math.abs(totalScore)/activeCount*100) : 0;

  const obVeto = lRsi>70 && lZ>2.0;
  const isBuy  = totalScore>=buyThresh  && !obVeto;
  const isSell = totalScore<=-sellThresh;

  return {
    rows: [
      { label:'CDC Zone',     raw:cdcRaw,  active:useCDC,
        status: green?'Green Zone':yellow?'Yellow Zone':blue?'Blue Zone':'Red Zone',
        bull: cdcRaw>0, bear: cdcRaw<0 },
      { label:'Trend (ADX)',  raw:adxRaw,  active:useAdx,
        status: !trendStrong?'Sideways':lPDI>lMDI?'Bullish':'Bearish',
        bull: adxRaw>0, bear: adxRaw<0 },
      { label:'MACD',         raw:macdRaw, active:useMacd,
        status: macdUp?'Bullish':'Bearish', bull:macdRaw>0, bear:macdRaw<0 },
      { label:'OBV Volume',   raw:obvRaw,  active:useObv,
        status: obvBull?'Bullish':'Bearish', bull:obvRaw>0, bear:obvRaw<0 },
      { label:'RSI',          raw:rsiRaw,  active:useRsi,
        status: lRsi>70?`Overbought (${Math.round(lRsi)})`:lRsi>60?`Neutral (${Math.round(lRsi)})`:`Bullish (${Math.round(lRsi)})`,
        bull: rsiRaw>0, bear: rsiRaw<0 },
      { label:'Z-Score',      raw:zRaw,    active:useZ,
        status: lZ>2.0?`Overbought (${lZ.toFixed(2)})`:lZ>1.75?`Warning (${lZ.toFixed(2)})`:`Normal (${lZ.toFixed(2)})`,
        bull: zRaw>0, bear: zRaw<0 },
      { label:'Ichimoku',     raw:ichiRaw, active:useIchi,
        status: ichiAbove?'Above Cloud':ichiBelow?'Below Cloud':'In Cloud',
        bull: ichiRaw>0, bear: ichiRaw<0 },
      { label:'Golden Cross', raw:gcRaw,   active:useGC,
        status: isGolden?'Golden Cross':'Death Cross', bull:gcRaw>0, bear:gcRaw<0 },
    ],
    totalScore, activeCount, bullVotes, bearVotes, confidence,
    obVeto, isBuy, isSell,
    mktStatus: (lRsi>70&&lZ>2.0)?'Overbought (High Risk)':(lRsi>70||lZ>2.0)?'Overbought':(lRsi<=60&&lZ<=1.75)?'Healthy':'Normal',
    mktBull: lRsi<=60&&lZ<=1.75, mktBear: lRsi>70&&lZ>2.0,
    stats: {
      rsi: lRsi, z: lZ, adx: lAdx, gcFast: lGcF, gcSlow: lGcS,
      macdHist: ml[last]!=null&&ms[last]!=null ? ml[last]-ms[last] : null,
    },
  };
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function SignalBadge({ isBuy, isSell, obVeto }) {
  const [label, bg, color] = isBuy
    ? ['BUY',  'var(--green-50)',  'var(--green-600)']
    : isSell
    ? ['SELL', 'var(--red-50)',    'var(--red-600)']
    : obVeto
    ? ['OB VETO', 'rgba(255,159,10,0.12)', '#ff9f0a']
    : ['HOLD', 'var(--bg-sunken)', 'var(--fg-2)'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 14px', borderRadius: 999, fontWeight: 700,
      fontSize: 13, letterSpacing: 0.5, background: bg, color,
    }}>
      {isBuy ? '▲' : isSell ? '▼' : obVeto ? '⊘' : '—'} {label}
    </span>
  );
}

function VoteChip({ raw, active }) {
  if (!active) return <span style={{ color:'var(--fg-3)', fontSize:11 }}>OFF</span>;
  const [label, color, bg] = raw > 0
    ? ['+1', 'var(--green-600)', 'var(--green-50)']
    : raw < 0
    ? ['−1', 'var(--red-600)',   'var(--red-50)']
    : ['0',  'var(--fg-3)',      'var(--bg-sunken)'];
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:999,
      fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums',
      color, background: bg,
    }}>
      {label}
    </span>
  );
}

function ScoreBar({ totalScore, activeCount }) {
  const max = activeCount || 8;
  const pct = max > 0 ? totalScore / max : 0;
  const center = 50;
  const width  = Math.abs(pct) * 50;
  const left   = pct >= 0 ? center : center - width;
  const fill   = pct > 0 ? 'var(--green-600)' : pct < 0 ? 'var(--red-600)' : 'var(--fg-3)';

  return (
    <div>
      <div style={{ position:'relative', height:8, borderRadius:999, background:'var(--bg-sunken)', overflow:'hidden', margin:'10px 0 6px' }}>
        <div style={{ position:'absolute', left:0, right:0, top:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:1, height:'100%', background:'var(--border-2)' }} />
        </div>
        {totalScore !== 0 && (
          <div style={{
            position:'absolute', top:0, bottom:0,
            left: `${left}%`, width:`${width}%`,
            background: fill, borderRadius:999, transition:'all 0.4s ease',
          }} />
        )}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--fg-3)' }}>
        <span style={{ color:'var(--red-600)', fontWeight:600 }}>Bear</span>
        <span style={{ color:'var(--fg-3)' }}>
          Score <span style={{ color: totalScore>0?'var(--green-600)':totalScore<0?'var(--red-600)':'var(--fg-2)', fontWeight:700 }}>
            {totalScore>0?'+':''}{totalScore}
          </span> / {activeCount}
        </span>
        <span style={{ color:'var(--green-600)', fontWeight:600 }}>Bull</span>
      </div>
    </div>
  );
}

function StatChip({ label, value, bull, bear }) {
  const color = bull ? 'var(--green-600)' : bear ? 'var(--red-600)' : 'var(--fg-2)';
  return (
    <div style={{
      padding:'8px 14px', borderRadius:10, background:'var(--bg-surface)',
      border:'1px solid var(--border-1)', minWidth:70,
    }}>
      <div style={{ fontSize:10, color:'var(--fg-3)', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:700, color, fontVariantNumeric:'tabular-nums' }}>{value ?? '—'}</div>
    </div>
  );
}

// ── Macro Dashboard ─────────────────────────────────────────────────────────

const MACRO_IMPACT_MATRIX = [
  { indicator: 'Fed Rate ↑', impacts: ['Tech ↓↓↓', 'Gold ↓',      'BTC ↓↓↓', 'USD ↑'   ] },
  { indicator: 'US10Y ↑',   impacts: ['Tech ↓↓↓', 'REIT ↓↓↓',   'Gold ↓',   'USD ↑'   ] },
  { indicator: 'CPI ↑',     impacts: ['Growth ↓',  'Energy ↑↑',  'Gold ↑',   'Mixed'   ] },
  { indicator: 'DXY ↑',     impacts: ['EM ↓↓↓',   'Gold ↓',     'BTC ↓↓',   'USD ↑'   ] },
  { indicator: 'VIX ↑',     impacts: ['Stocks ↓↓↓','Bonds ↑',   'Cash ↑',   'Risk Off'] },
  { indicator: 'M2 ↑',      impacts: ['Stocks ↑↑', 'BTC ↑↑↑',   'Gold ↑',   'Risk On' ] },
];

const MACRO_INFO = {
  fedRate: {
    title: 'Federal Funds Rate',
    description: 'The target interest rate set by the Fed\'s FOMC 8 times per year. Banks charge each other this rate for overnight lending — it cascades into all borrowing costs: mortgages, corporate bonds, credit cards.',
    levels: [
      { max: 1.5,      label: 'Very Low',    color: '#34c759', note: 'Ultra-accommodative. Cheap money era — strong tailwind for equities, real estate, and growth stocks.' },
      { max: 3.0,      label: 'Low',         color: '#34c759', note: 'Accommodative. Supportive for risk assets. Bond yields typically low, equity valuations elevated.' },
      { max: 4.5,      label: 'Elevated',    color: '#ff9f0a', note: 'Restrictive. Pressure on growth stocks, REITs, and bonds. USD tends to strengthen.' },
      { max: Infinity, label: 'High',        color: '#ff453a', note: 'Highly restrictive. Significant headwind for risk assets. Recession risk elevated. Cash/bonds attractive.' },
    ],
  },
  us10y: {
    title: 'US 10-Year Treasury Yield',
    description: 'Yield on 10-year US government bonds — the global benchmark "risk-free rate." It anchors mortgage rates, corporate borrowing costs, and equity valuations (P/E multiples) worldwide.',
    levels: [
      { max: 2.0,      label: 'Low',         color: '#34c759', note: 'Low cost of capital. Favorable for equities, especially growth/tech. Bond prices are high.' },
      { max: 3.5,      label: 'Normal',      color: '#8e8e93', note: 'Historically normal range. Balanced between growth and inflation expectations.' },
      { max: 5.0,      label: 'Elevated',    color: '#ff9f0a', note: 'High yields compress P/E multiples and pressure REITs. Bonds start competing with equities.' },
      { max: Infinity, label: 'High',        color: '#ff453a', note: 'Very high yields. Bonds become a strong competitor to stocks. Watch for equity outflows.' },
    ],
  },
  cpi: {
    title: 'CPI Inflation (Year-over-Year)',
    description: 'Consumer Price Index — the primary inflation gauge. The Fed targets ~2%. Persistent high CPI forces the Fed to keep rates high, hurting bond prices and growth stocks.',
    levels: [
      { max: 1.0,      label: 'Low',         color: '#ff9f0a', note: 'Below target. Deflation risk. Fed may cut rates aggressively to stimulate the economy.' },
      { max: 2.5,      label: 'Stable',      color: '#34c759', note: 'Near Fed\'s 2% target — ideal. Rate cuts possible, earnings forecasts stable, risk assets supported.' },
      { max: 4.0,      label: 'Elevated',    color: '#ff9f0a', note: 'Above target. Fed stays hawkish. Bond prices fall. Commodities and energy tend to outperform.' },
      { max: Infinity, label: 'High',        color: '#ff453a', note: 'High inflation. Rate cuts off the table. Real returns eroded. Gold, oil, and commodities favored.' },
    ],
  },
  vix: {
    title: 'VIX — Volatility Index',
    description: 'CBOE Volatility Index measuring implied 30-day volatility of S&P 500 options. Known as the "Fear Index." Spikes during selloffs and crashes, drops in calm trending markets.',
    levels: [
      { max: 15,       label: 'Low',         color: '#34c759', note: 'Markets calm. Low fear — possibly complacent. Good environment for carry trades and income.' },
      { max: 20,       label: 'Normal',      color: '#8e8e93', note: 'Normal volatility. Healthy risk environment with no extreme fear or greed.' },
      { max: 30,       label: 'Elevated',    color: '#ff9f0a', note: 'Fear rising. Selloff may be in progress. Consider reducing risk or adding hedges.' },
      { max: Infinity, label: 'High',        color: '#ff453a', note: 'High fear. Active selloff or crisis mode. Historically a contrarian buy signal near extreme peaks.' },
    ],
  },
  dxy: {
    title: 'DXY — US Dollar Index',
    description: 'Measures the USD against a basket of 6 major currencies (EUR, JPY, GBP, CAD, SEK, CHF). A strong dollar tightens global financial conditions and squeezes emerging markets.',
    levels: [
      { max: 90,       label: 'Weak',        color: '#ff9f0a', note: 'Weak dollar. Strong tailwind for gold, oil, emerging markets (EM), and commodity exporters like Thailand.' },
      { max: 100,      label: 'Normal',      color: '#8e8e93', note: 'Dollar in normal range. Balanced global currency flows. THB relatively stable.' },
      { max: 106,      label: 'Strong',      color: '#ff9f0a', note: 'Strong dollar. Pressure on EM stocks, gold, and commodities. THB may weaken vs USD.' },
      { max: Infinity, label: 'Very Strong', color: '#ff453a', note: 'Very strong dollar. Significant EM debt stress risk. THB under pressure, import costs rise.' },
    ],
  },
};

function getMacroLevel(key, value) {
  if (value == null) return null;
  const info = MACRO_INFO[key];
  if (!info) return null;
  return info.levels.find(l => value < l.max) || info.levels[info.levels.length - 1];
}

function macroImpactColor(text) {
  if (text.includes('↑↑') || text === 'Risk On')  return 'var(--green-600)';
  if (text.includes('↑'))                          return 'var(--green-600)';
  if (text.includes('↓↓') || text === 'Risk Off') return 'var(--red-600)';
  if (text.includes('↓'))                          return 'var(--red-600)';
  return 'var(--fg-2)';
}

function MacroCard({ indKey, label, value, unit, change, active, onClick }) {
  const isUp = change > 0, isDown = change < 0;
  const level = getMacroLevel(indKey, value);
  return (
    <div
      onClick={value != null ? onClick : undefined}
      style={{
        padding: '12px 14px', borderRadius: 10,
        background: active ? 'var(--bg-selected)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-1)'}`,
        flex: '1 1 80px', minWidth: 80,
        cursor: value != null ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      {value == null
        ? <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-3)' }}>—</div>
        : <React.Fragment>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
              {typeof value === 'number' ? value.toFixed(2) : value}{unit}
            </div>
            {change != null && (
              <div style={{ fontSize: 11, marginTop: 2, fontWeight: 500,
                color: isUp ? 'var(--green-600)' : isDown ? 'var(--red-600)' : 'var(--fg-3)' }}>
                {isUp ? '▲' : isDown ? '▼' : '→'} {Math.abs(change).toFixed(2)}%
              </div>
            )}
            {level && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  color: level.color, background: level.color + '25',
                  padding: '2px 7px', borderRadius: 999,
                }}>
                  {level.label}
                </span>
              </div>
            )}
          </React.Fragment>
      }
    </div>
  );
}

function MacroInfoPanel({ indKey, value, onClose }) {
  const info = MACRO_INFO[indKey];
  const level = getMacroLevel(indKey, value);
  if (!info) return null;
  return (
    <div style={{
      background: 'var(--bg-sunken)', borderRadius: 10, padding: '14px 16px',
      border: '1px solid var(--border-1)', marginTop: 8, position: 'relative',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
        cursor: 'pointer', color: 'var(--fg-3)', padding: 4, lineHeight: 1,
      }}>
        <Icon name="x" size={14} />
      </button>

      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-1)', marginBottom: 6, paddingRight: 28, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {info.title}
        {level && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
            color: level.color, background: level.color + '25', padding: '2px 8px', borderRadius: 999,
          }}>
            {level.label}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.65, marginBottom: 10 }}>
        {info.description}
      </div>

      {level && (
        <div style={{
          background: level.color + '15', border: `1px solid ${level.color}50`,
          borderRadius: 8, padding: '8px 12px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: level.color, marginBottom: 3 }}>
            Current level — {level.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            {level.note}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {info.levels.map((l, i) => (
          <span key={i} style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 600, letterSpacing: 0.3,
            background: l === level ? l.color + '22' : 'var(--bg-surface)',
            color: l === level ? l.color : 'var(--fg-3)',
            border: `1px solid ${l === level ? l.color + '60' : 'var(--border-1)'}`,
          }}>
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MacroDashboard() {
  const [data,       setData]       = React.useState(null);
  const [loading,    setLoading]    = React.useState(true);
  const [showMatrix, setShowMatrix] = React.useState(false);
  const [activeCard, setActiveCard] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/macro')
      .then(r => r.json())
      .then(j => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const ind = data?.indicators || {};
  const cards = [
    { key: 'fedRate', label: 'Fed Rate', unit: '%', value: ind.fedRate?.value, change: ind.fedRate?.change },
    { key: 'us10y',   label: 'US 10Y',  unit: '%', value: ind.us10y?.value,   change: ind.us10y?.change   },
    { key: 'cpi',     label: 'CPI YoY', unit: '%', value: ind.cpi?.value,     change: ind.cpi?.change     },
    { key: 'vix',     label: 'VIX',     unit: '',  value: ind.vix?.value,     change: ind.vix?.change     },
    { key: 'dxy',     label: 'DXY',     unit: '',  value: ind.dxy?.value,     change: ind.dxy?.change     },
  ];

  const toggleCard = (key) => setActiveCard(v => v === key ? null : key);

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg-1)' }}>Macro Environment</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>Live indicators · 15 min cache · tap any card for details</div>
        </div>
        <button onClick={() => setShowMatrix(v => !v)} style={{
          fontSize: 12, color: 'var(--fg-3)', background: 'none',
          border: '1px solid var(--border-2)', padding: '4px 10px',
          borderRadius: 8, cursor: 'pointer', fontWeight: 500,
        }}>
          {showMatrix ? 'Hide Matrix' : 'Impact Matrix'}
        </button>
      </div>

      {loading
        ? <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flex: '1 1 80px', height: 72, borderRadius: 10, background: 'var(--bg-sunken)', animation: 'pulse 1s infinite' }} />
            ))}
          </div>
        : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cards.map(c => (
              <MacroCard key={c.key} indKey={c.key} label={c.label} value={c.value} unit={c.unit} change={c.change}
                active={activeCard === c.key} onClick={() => toggleCard(c.key)} />
            ))}
          </div>
      }

      {activeCard && !loading && (
        <MacroInfoPanel indKey={activeCard} value={ind[activeCard]?.value} onClose={() => setActiveCard(null)} />
      )}

      {showMatrix && (
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Market Impact Matrix
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)' }}>
                {['Trigger', 'Impact 1', 'Impact 2', 'Impact 3', 'Impact 4'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--fg-3)', borderBottom: '1px solid var(--border-1)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MACRO_IMPACT_MATRIX.map((row, i) => (
                <tr key={row.indicator} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-sunken)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--fg-1)', borderBottom: '1px solid var(--border-1)', whiteSpace: 'nowrap' }}>
                    {row.indicator}
                  </td>
                  {row.impacts.map((imp, j) => (
                    <td key={j} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-1)', color: macroImpactColor(imp), fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {imp}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const LAYER_CFG = [
  { key:'useCDC',  label:'CDC'      },
  { key:'useMacd', label:'MACD'     },
  { key:'useAdx',  label:'ADX'      },
  { key:'useObv',  label:'OBV'      },
  { key:'useRsi',  label:'RSI'      },
  { key:'useZ',    label:'Z-Score'  },
  { key:'useIchi', label:'Ichimoku' },
  { key:'useGC',   label:'GC'       },
];

const CANDLE_DAYS_OPTS = [30, 60, 90, 120];

// ── Core analysis content (shared by page and modal) ────────────────────────

function TechnicalAnalysisCore({ initSymbol, compact }) {
  const [inputVal, setInputVal] = React.useState(initSymbol || '');
  const [symbol,   setSymbol]   = React.useState('');
  const [bars,     setBars]     = React.useState(null);
  const [meta,     setMeta]     = React.useState(null);
  const [loading,  setLoading]  = React.useState(false);
  const [err,      setErr]      = React.useState(null);
  const [showCfg,  setShowCfg]  = React.useState(false);
  const [candleDays, setCandleDays] = React.useState(60);
  const [cfg, setCfg] = React.useState({
    fastLen:12, slowLen:26, rsiLen:14,
    macdFastLen:12, macdSlowLen:26, macdSigLen:9,
    zLen:20, adxLen:14, adxSmooth:14, adxThresh:25, obvSigLen:20,
    gcFastLen:50, gcSlowLen:200,
    ichiConvLen:9, ichiBaseLen:26, ichiSpan2Len:52, ichiDisp:26,
    useCDC:true, useMacd:true, useAdx:true, useObv:true,
    useRsi:true, useZ:true, useIchi:true, useGC:true,
    buyThresh:4, sellThresh:4,
  });

  const analyze = React.useCallback(async (sym) => {
    const s = (sym || inputVal).trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
    setLoading(true);
    setErr(null);
    setBars(null);
    try {
      const r = await fetch(`/api/technical?symbol=${encodeURIComponent(s)}&range=2y`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (!j.bars || j.bars.length < 60) throw new Error(`Not enough data (got ${j.bars?.length ?? 0} bars, need 60+)`);
      setBars(j.bars);
      setMeta({ name: j.name, currency: j.currency, symbol: j.symbol });
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }, [inputVal]);

  // Auto-analyze when initiated with a symbol
  React.useEffect(() => {
    if (initSymbol) analyze(initSymbol);
  }, []);

  const result = React.useMemo(() => {
    if (!bars || bars.length < 60) return null;
    try { return computeConfluence(bars, cfg); } catch (e) { return null; }
  }, [bars, cfg]);

  const lastBar = bars && bars.length ? bars[bars.length - 1] : null;
  const prevBar = bars && bars.length > 1 ? bars[bars.length - 2] : null;
  const priceChange = lastBar && prevBar ? lastBar.c - prevBar.c : null;
  const pricePct    = prevBar && prevBar.c ? priceChange / prevBar.c * 100 : null;
  const priceUp     = priceChange > 0;
  const ccy = meta?.currency === 'USD' ? '$' : meta?.currency === 'THB' ? '฿' : '';

  // Convert bars from seconds to ms for CandleChart
  const candleBars = React.useMemo(() =>
    bars ? bars.map(b => ({ ...b, t: b.t * 1000 })) : [],
  [bars]);

  const outerStyle = compact
    ? { display: 'flex', flexDirection: 'column', gap: 14 }
    : { maxWidth: 680, margin: '0 auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 16 };

  return (
    <div style={outerStyle}>

      {/* ── Macro Environment (page only, not modal) ── */}
      {!compact && <MacroDashboard />}

      {/* ── Search ── */}
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--fg-3)', pointerEvents:'none' }}>
            <Icon name="search" size={15} />
          </span>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="Ticker — AAPL · BTC-USD · ADVANC.BK"
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'9px 12px 9px 36px', borderRadius:10, fontSize:14,
              background:'var(--bg-surface)', border:'1px solid var(--border-2)',
              color:'var(--fg-1)', fontFamily:'var(--font-sans)', outline:'none',
            }}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => analyze()} disabled={loading || !inputVal.trim()}>
          {loading ? 'Loading…' : 'Analyse'}
        </Button>
        <button
          onClick={() => setShowCfg(v => !v)}
          title="Settings"
          style={{
            width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:10, cursor:'pointer', flexShrink:0,
            background: showCfg ? 'var(--bg-selected)' : 'var(--bg-surface)',
            border: '1px solid var(--border-2)',
            color: showCfg ? 'var(--accent)' : 'var(--fg-2)',
          }}
        >
          <Icon name="sliders" size={15} />
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showCfg && (
        <div className="card" style={{ padding:16 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--fg-1)', marginBottom:12 }}>Layer Toggles</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {LAYER_CFG.map(l => {
              const on = cfg[l.key];
              return (
                <button key={l.key} onClick={() => setCfg(c => ({ ...c, [l.key]: !c[l.key] }))}
                  style={{
                    padding:'5px 14px', borderRadius:999, fontSize:12, cursor:'pointer',
                    fontWeight:600, border:'1.5px solid',
                    borderColor: on ? 'var(--accent)' : 'var(--border-2)',
                    background:  on ? 'var(--bg-selected)' : 'transparent',
                    color:       on ? 'var(--accent-light, var(--accent))' : 'var(--fg-3)',
                  }}>
                  {l.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--fg-1)', marginBottom:10 }}>Signal Thresholds</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'BUY min score',  k:'buyThresh',  min:1, max:8 },
              { label:'SELL min score', k:'sellThresh', min:1, max:8 },
              { label:'ADX threshold',  k:'adxThresh',  min:10, max:50 },
            ].map(({ label, k, min, max }) => (
              <label key={k} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--fg-2)' }}>
                <span style={{ width:120, flexShrink:0, fontWeight:500 }}>{label}</span>
                <input type="range" min={min} max={max} value={cfg[k]}
                  onChange={e => setCfg(c => ({ ...c, [k]: Number(e.target.value) }))}
                  style={{ flex:1 }} />
                <span style={{ width:20, textAlign:'right', fontWeight:700, color:'var(--fg-1)', fontVariantNumeric:'tabular-nums' }}>{cfg[k]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {err && (
        <div style={{ background:'var(--red-50)', border:'1px solid var(--red-600)', borderRadius:10, padding:'10px 14px', color:'var(--red-600)', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="alert-circle" size={15} /> {err}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="card" style={{ padding:compact ? 24 : 48, textAlign:'center', color:'var(--fg-3)' }}>
          <div style={{ fontSize:13 }}>Fetching {symbol} data…</div>
        </div>
      )}

      {/* ── Results ── */}
      {result && meta && lastBar && (
        <React.Fragment>

          {/* Stock header card */}
          <div className="card" style={{ padding:'20px 20px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
                  <span style={{ fontWeight:800, fontSize:22, letterSpacing:-0.5, color:'var(--fg-1)', fontFamily:'var(--font-sans)' }}>
                    {meta.symbol}
                  </span>
                  <SignalBadge isBuy={result.isBuy} isSell={result.isSell} obVeto={result.obVeto} />
                </div>
                <div style={{ fontSize:12, color:'var(--fg-3)', marginBottom:12 }}>{meta.name}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <span style={{ fontSize:28, fontWeight:700, letterSpacing:-1, fontVariantNumeric:'tabular-nums', color:'var(--fg-1)' }}>
                    {ccy}{lastBar.c.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}
                  </span>
                  {priceChange != null && (
                    <span style={{ fontSize:14, fontWeight:600, color: priceUp ? 'var(--green-600)' : 'var(--red-600)' }}>
                      {priceUp ? '+' : ''}{priceChange.toFixed(2)} ({priceUp ? '+' : ''}{pricePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <div style={{ fontSize:11, color:'var(--fg-3)', marginTop:4 }}>
                  {meta.currency} · last daily close · {bars.length} bars
                </div>
              </div>

              <div style={{ textAlign:'center', minWidth:90 }}>
                <div style={{ fontSize:32, fontWeight:800, letterSpacing:-1, fontVariantNumeric:'tabular-nums',
                  color: result.confidence>=57 ? (result.isBuy?'var(--green-600)':result.isSell?'var(--red-600)':'var(--fg-1)') : 'var(--fg-2)' }}>
                  {result.confidence}%
                </div>
                <div style={{ fontSize:11, color:'var(--fg-3)', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', marginTop:2 }}>
                  {result.confidence>=86 ? 'Strong' : result.confidence>=57 ? 'Moderate' : 'Mixed'}
                </div>
              </div>
            </div>

            <ScoreBar totalScore={result.totalScore} activeCount={result.activeCount} />

            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, background:'var(--green-50)', color:'var(--green-600)' }}>
                {result.bullVotes} Bull
              </span>
              <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, background:'var(--red-50)', color:'var(--red-600)' }}>
                {result.bearVotes} Bear
              </span>
              <span style={{ padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, background:'var(--bg-sunken)', color:'var(--fg-3)' }}>
                {result.activeCount - result.bullVotes - result.bearVotes} Neutral
              </span>
            </div>
          </div>

          {/* ── Candle Chart ── */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="card-h" style={{ padding:'12px 18px' }}>
              <div>
                <div className="t">Price Chart (Daily)</div>
                <div className="s">{candleDays}D · {candleBars.slice(-candleDays).length} candles</div>
              </div>
              <div className="layoutseg" style={{ flexShrink: 0 }}>
                {CANDLE_DAYS_OPTS.map(d => (
                  <button key={d} className={candleDays === d ? 'on' : ''} onClick={() => setCandleDays(d)}>
                    {d}D
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '0 8px 12px' }}>
              <CandleChart bars={candleBars} daysBack={candleDays} />
            </div>
          </div>

          {/* Indicator table */}
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="card-h" style={{ padding:'14px 18px' }}>
              <div>
                <div className="t">Confluence Indicators</div>
                <div className="s" style={{ marginTop:2 }}>8 independent layers · toggle in settings</div>
              </div>
              <button onClick={() => setShowCfg(v => !v)} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--fg-3)', padding:4 }}>
                <Icon name="sliders" size={14} />
              </button>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--font-sans)' }}>
              <thead>
                <tr style={{ background:'var(--bg-sunken)' }}>
                  <th style={{ padding:'8px 18px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:'var(--fg-3)', borderBottom:'1px solid var(--border-1)' }}>Indicator</th>
                  <th style={{ padding:'8px 18px', textAlign:'left', fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:'var(--fg-3)', borderBottom:'1px solid var(--border-1)' }}>Status</th>
                  <th style={{ padding:'8px 14px', textAlign:'center', fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:'var(--fg-3)', borderBottom:'1px solid var(--border-1)', width:60 }}>Vote</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={row.label}
                    style={{ background: i%2===0 ? 'transparent' : 'var(--bg-sunken, rgba(0,0,0,0.02))', opacity: row.active ? 1 : 0.4 }}>
                    <td style={{ padding:'11px 18px', fontSize:13, fontWeight:500, color:'var(--fg-1)', borderBottom:'1px solid var(--border-1)' }}>
                      {row.label}
                    </td>
                    <td style={{
                      padding:'11px 18px', fontSize:13,
                      color: row.active ? (row.bull?'var(--green-600)':row.bear?'var(--red-600)':'var(--fg-3)') : 'var(--fg-3)',
                      borderBottom:'1px solid var(--border-1)', fontWeight: (row.bull||row.bear) && row.active ? 500 : 400,
                    }}>
                      {row.active && row.bull ? '▲ ' : row.active && row.bear ? '▼ ' : row.active ? '→ ' : ''}{row.status}
                    </td>
                    <td style={{ padding:'11px 14px', textAlign:'center', borderBottom:'1px solid var(--border-1)' }}>
                      <VoteChip raw={row.raw} active={row.active} />
                    </td>
                  </tr>
                ))}
                <tr style={{ background:'var(--bg-sunken)' }}>
                  <td style={{ padding:'11px 18px', fontSize:13, fontWeight:500, color:'var(--fg-2)' }}>Market Condition</td>
                  <td colSpan={2} style={{
                    padding:'11px 18px', fontSize:13, fontWeight:600,
                    color: result.mktBull?'var(--green-600)':result.mktBear?'var(--red-600)':'var(--fg-2)',
                  }}>
                    {result.mktStatus}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Stats row */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <StatChip label="RSI"
              value={result.stats.rsi?.toFixed(1)}
              bull={result.stats.rsi<=60} bear={result.stats.rsi>70} />
            <StatChip label="Z-Score"
              value={result.stats.z?.toFixed(2)}
              bull={result.stats.z<=1.75} bear={result.stats.z>2.0} />
            <StatChip label="ADX"
              value={result.stats.adx?.toFixed(1)}
              bull={result.stats.adx>=cfg.adxThresh} />
            <StatChip label="MA 50"
              value={result.stats.gcFast?.toFixed(2)}
              bull={result.stats.gcFast>result.stats.gcSlow}
              bear={result.stats.gcFast<result.stats.gcSlow} />
            <StatChip label="MA 200"
              value={result.stats.gcSlow?.toFixed(2)} />
          </div>

          {/* Refresh row */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Button variant="secondary" size="sm" icon="refresh-cw" onClick={() => analyze(symbol)}>
              Refresh
            </Button>
            <span style={{ fontSize:11, color:'var(--fg-3)' }}>Daily timeframe · {bars.length} bars</span>
          </div>

        </React.Fragment>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !err && (
        <div className="card" style={{ padding: compact ? '32px 20px' : '60px 20px', textAlign:'center' }}>
          <div style={{ width:48, height:48, borderRadius:14, background:'var(--bg-selected)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', color:'var(--accent)' }}>
            <Icon name="activity" size={24} />
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--fg-1)', marginBottom:6 }}>Technical Analysis</div>
          <div style={{ fontSize:13, color:'var(--fg-3)', maxWidth:380, margin:'0 auto', lineHeight:1.6 }}>
            Enter any Yahoo Finance symbol to see a multi-indicator confluence score —
            CDC Zone, MACD, ADX, OBV, RSI, Z-Score, Ichimoku, Golden Cross.
          </div>
        </div>
      )}

    </div>
  );
}

// ── Page wrapper ─────────────────────────────────────────────────────────────

function TechnicalAnalysis() {
  return <TechnicalAnalysisCore initSymbol="" compact={false} />;
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function TechnicalModal({ symbol, onClose }) {
  return (
    <Modal open onClose={onClose}
           title={`Technical Analysis${symbol ? ' — ' + symbol : ''}`}
           width={740}>
      <div style={{ maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden' }}>
        <TechnicalAnalysisCore initSymbol={symbol || ''} compact={true} />
      </div>
    </Modal>
  );
}

window.TechnicalModal = TechnicalModal;
