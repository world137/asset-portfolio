/* eslint-disable */
/* PixelWorld.jsx — Pixel art office: your investments have a company */

// ── Pixel art character — Game Dev Story chibi style ─────────────────────────
// 8 wide × 10 tall grid: head:body = 1:1 = true chibi proportions
function PixelChar({ color, happy, tired, hairColor }) {
  const SK = '#f5c99a', EY = '#1a1a2e', HR = hairColor || '#3d2b1f',
        PN = '#2d3561', BT = '#111', BL = '#fca5a5', MO = '#d97706', T = null;

  // Big round eyes (2px wide) — GDS signature
  const eyeRow   = [T, SK, EY, EY, SK, EY, EY, T];
  // Mouth: smile dots vs sad corners
  const mouthRow = happy
    ? [T, SK, BL, SK, SK, BL, SK, T]  // rosy cheeks = happy blush
    : [T, MO, SK, MO, MO, SK, MO, T]; // corners down
  // Chin: slightly pink when happy (tired effect)
  const chinRow  = tired
    ? [T, SK, SK, BL, BL, SK, SK, T]
    : [T, SK, SK, SK, SK, SK, SK, T];

  const rows = [
    [T,  T,  HR, HR, HR, HR, T,  T ],  // 0 hair top
    [T,  HR, HR, SK, SK, HR, HR, T ],  // 1 hair sides
    eyeRow,                             // 2 big eyes
    mouthRow,                           // 3 expression
    chinRow,                            // 4 chin
    [T,  color,color,color,color,color,color,T ],  // 5 collar
    [SK, color,color,color,color,color,color,SK],  // 6 arms+body
    [T,  color,color,color,color,color,color,T ],  // 7 lower body
    [T,  PN,  PN, T,  T,  PN,  PN, T ],  // 8 legs
    [T,  BT,  BT, T,  T,  BT,  BT, T ],  // 9 boots
  ];

  const S = 4;
  return (
    <svg width={8*S} height={10*S} style={{ imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block' }}>
      {rows.map((row, y) => row.map((fill, x) =>
        fill ? <rect key={`${x}-${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill} /> : null
      ))}
    </svg>
  );
}

// ── GDS-style mood star ───────────────────────────────────────────────────────
function PixelStar({ mood }) {
  const C = mood === 'good' ? '#fbbf24' : mood === 'great' ? '#22c55e' : '#ef4444';
  const T = null, S = 3;
  const rows = [
    [T, T, C, T, T],
    [T, C, C, C, T],
    [C, C, C, C, C],
    [T, C, C, C, T],
    [T, T, C, T, T],
  ];
  return (
    <svg width={5*S} height={5*S} style={{ imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block' }}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill} /> : null
      ))}
    </svg>
  );
}

// ── Pixel art monitor with mini chart ────────────────────────────────────────
function PixelMonitor({ pct }) {
  const FR = '#3a3a3a';
  const SC = pct >= 0 ? '#051a0a' : '#1a0505';
  const GR = pct >= 0 ? '#00e676' : '#ff5252';
  const S = 3;

  // 5 bars showing a trend
  const bars = pct > 10 ? [2,3,4,5,6] : pct > 2 ? [3,3,4,5,5] : pct > -2 ? [4,4,4,4,4] : pct > -10 ? [6,5,4,3,3] : [6,5,3,2,1];

  // Monitor is 16 wide × 11 tall (+ 2 for stand)
  const W = 16*S, H = 13*S;
  return (
    <svg width={W} height={H} style={{ imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block' }}>
      {/* Frame border */}
      {[...Array(16)].map((_,x) => [
        <rect key={`ft${x}`} x={x*S} y={0}    width={S} height={S} fill={x===0||x===15?'none':FR} />,
        <rect key={`fb${x}`} x={x*S} y={9*S}  width={S} height={S} fill={x===0||x===15?'none':FR} />,
      ])}
      {[...Array(8)].map((_,y) => [
        <rect key={`fl${y}`} x={0}     y={(y+1)*S} width={S} height={S} fill={FR} />,
        <rect key={`fr${y}`} x={15*S}  y={(y+1)*S} width={S} height={S} fill={FR} />,
      ])}
      {/* Screen fill */}
      {[...Array(8)].map((_,y) => [...Array(14)].map((_,x) =>
        <rect key={`s${x}${y}`} x={(x+1)*S} y={(y+1)*S} width={S} height={S} fill={SC} />
      ))}
      {/* Chart bars */}
      {bars.map((h, i) =>
        [...Array(h)].map((_,j) =>
          <rect key={`b${i}${j}`} x={(2+i*2.4)*S} y={(8-j)*S} width={S} height={S} fill={GR} />
        )
      )}
      {/* Stand */}
      <rect x={7*S}  y={10*S} width={S}   height={S} fill={FR} />
      <rect x={6*S}  y={11*S} width={4*S} height={S} fill={FR} />
    </svg>
  );
}

// ── Pixel art plant ───────────────────────────────────────────────────────────
function PixelPlant({ big }) {
  const GR = '#22c55e', DG = '#15803d', BR = '#92400e', PT = '#78350f';
  const S = 3;
  const rows = big ? [
    [null, null, GR,  null, GR,  null],
    [null, GR,   GR,  GR,  GR,  GR  ],
    [GR,   GR,   DG,  GR,  DG,  GR  ],
    [null, null, DG,  null, null,null],
    [null, null, BR,  BR,  null, null],
    [null, PT,   PT,  PT,  PT,  null],
  ] : [
    [null, GR,  null],
    [GR,   GR,  GR  ],
    [null, BR,  null],
    [PT,   PT,  PT  ],
  ];
  const w = rows[0].length, h = rows.length;
  return (
    <svg width={w*S} height={h*S} style={{ imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block' }}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill} /> : null
      ))}
    </svg>
  );
}

// ── Pixel art coffee cup ──────────────────────────────────────────────────────
function PixelCoffee() {
  const CU = '#78350f', LQ = '#92400e', ST = '#f0abfc', WH = '#e5e7eb';
  const S = 3;
  const rows = [
    [null, ST,  ST,  null],
    [CU,   LQ,  LQ,  CU  ],
    [CU,   LQ,  LQ,  CU  ],
    [null, CU,  CU,  null],
    [WH,   WH,  WH,  WH  ],
  ];
  return (
    <svg width={4*S} height={5*S} style={{ imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block' }}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill} /> : null
      ))}
    </svg>
  );
}

// ── Speech bubble ─────────────────────────────────────────────────────────────
function SpeechBubble({ text }) {
  return (
    <div className="px-bubble">
      <span>{text}</span>
    </div>
  );
}

// ── Worker status badge ───────────────────────────────────────────────────────
function StatusBadge({ pct }) {
  const [label, cls] = pct > 15 ? ['🚀 MOON MODE', 'moon']
    : pct > 5  ? ['💪 GRINDING',  'grind']
    : pct > 0  ? ['😎 CHILLING',  'chill']
    : pct > -5 ? ['😓 STRUGGLING','struggle']
    : pct > -15? ['📉 IN RED',    'red']
    :            ['🚨 CRISIS',    'crisis'];
  return <span className={`px-badge px-badge-${cls}`}>{label}</span>;
}

// ── Department card ───────────────────────────────────────────────────────────
const SPEECH_HAPPY = ['BUY MORE!', 'TO THE MOON', 'BULLISH!', 'PROFIT!', 'HODL MORE', 'BRB BUYING'];
const SPEECH_SAD   = ['sell?...', 'hodl...', 'it is fine', 'just a dip', 'bruh...', 'WHY THO'];

function PixelDepartment({ cls, sym }) {
  const { value, cost, pct, color, positions } = cls;
  const profit  = value - cost;
  const happy   = pct >= 0;
  const tired   = pct < -5;

  const animClass = pct > 10 ? 'px-anim-jump'
    : pct > 0  ? 'px-anim-bob'
    : pct > -5 ? 'px-anim-idle'
    :            'px-anim-slouch';

  // Pick a speech bubble based on dept key (stable per dept)
  const speechIdx = cls.key.charCodeAt(0) % SPEECH_HAPPY.length;
  const speech = happy ? SPEECH_HAPPY[speechIdx] : SPEECH_SAD[speechIdx];

  // Top holding by value
  const topHolding = positions.length > 0
    ? [...positions].sort((a,b) => b.value - a.value)[0]
    : null;
  const workerName = topHolding
    ? topHolding.name.replace(/THB$/,'').slice(0,9)
    : cls.label.slice(0,9);

  return (
    <div className={`px-dept ${happy ? 'px-dept-up' : 'px-dept-down'}`} style={{ '--dept-clr': color }}>
      {/* Header */}
      <div className="px-dept-header">
        <span className="px-dept-label">{cls.label.toUpperCase()}</span>
        <span className="px-dept-count">{positions.length} holdings</span>
      </div>

      {/* Scene */}
      <div className="px-scene">
        {/* Background tiles */}
        <div className="px-floor-tiles" />

        {/* Plant in corner */}
        <div className="px-plant">
          <PixelPlant big={pct > 5} />
        </div>

        {/* Desk area */}
        <div className="px-desk-area">
          {/* Monitor */}
          <div className="px-monitor">
            <PixelMonitor pct={pct} />
          </div>

          {/* Coffee */}
          <div className="px-coffee">
            <PixelCoffee />
          </div>

          {/* Character with speech bubble */}
          <div className="px-worker-wrap">
            <SpeechBubble text={speech} />
            <div className={animClass}>
              <PixelChar color={color} happy={happy} tired={tired} hairColor={color} />
            </div>
          </div>
        </div>

        {/* Desk surface */}
        <div className="px-desk-surface" style={{ background: `linear-gradient(to bottom, #8b6340, #6b4c2a)` }} />
      </div>

      {/* Worker nameplate */}
      <div className="px-nametag">
        <span className="px-nametag-icon">👤</span>
        <span className="px-nametag-text">{workerName}</span>
      </div>

      {/* Status */}
      <StatusBadge pct={pct} />

      {/* Performance bar */}
      <div className="px-perfbar-wrap">
        <div
          className={`px-perfbar-fill ${happy ? 'up' : 'down'}`}
          style={{ width: `${Math.min(Math.abs(pct) * 6, 100)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="px-dept-stats">
        <span className="px-dept-value">{sym}{window.fmtBig(value)}</span>
        <span className={`px-dept-pct ${happy ? 'up' : 'down'}`}>
          {happy ? '+' : ''}{pct.toFixed(1)}%
        </span>
        <span className={`px-dept-profit ${happy ? 'up' : 'down'}`}>
          {happy ? '+' : '−'}{sym}{window.fmtBig(Math.abs(profit))}
        </span>
      </div>
    </div>
  );
}

// ── Scrolling ticker tape ─────────────────────────────────────────────────────
function PixelTicker({ classes, totals, sym }) {
  const items = classes.map(c => {
    const pct  = c.pct;
    const sign = pct >= 0 ? '▲' : '▼';
    return `${c.label.toUpperCase()}: ${sym}${window.fmtBig(c.value)} ${sign}${Math.abs(pct).toFixed(1)}%`;
  });
  const overall = `TOTAL: ${sym}${window.fmtBig(totals.value)} — P/L: ${totals.profit >= 0 ? '+' : '−'}${sym}${window.fmtBig(Math.abs(totals.profit))}`;
  const text = [overall, ...items, '◆ PORTFOLIO HQ ◆', overall, ...items].join('   ·   ');

  return (
    <div className="px-ticker-bar">
      <span className="px-ticker-tag">LIVE</span>
      <div className="px-ticker-track">
        <span className="px-ticker-text">{text}</span>
      </div>
    </div>
  );
}

// ── Company summary footer ────────────────────────────────────────────────────
function PixelSummary({ totals, sym, classes }) {
  const topDept = [...classes].sort((a,b) => b.value - a.value)[0];
  const topPct  = [...classes].sort((a,b) => b.pct   - a.pct  )[0];
  const botPct  = [...classes].sort((a,b) => a.pct   - b.pct  )[0];

  const mood = totals.pct > 10 ? '🎉 Bull run! Break out the confetti!'
    : totals.pct > 2  ? '💼 Strong quarter. Keep it up.'
    : totals.pct > 0  ? '📊 Slightly green. Coffee is on the house.'
    : totals.pct > -5 ? '😰 Rough week. Emergency memos distributed.'
    :                   '🚨 All-hands meeting. Donuts in the boardroom.';

  return (
    <div className="px-summary">
      <div className="px-summary-title">◆ COMPANY REPORT ◆</div>
      <div className="px-summary-row">
        <span className="px-sl">CEO MOOD</span>
        <span className="px-sv">{mood}</span>
      </div>
      <div className="px-summary-grid">
        <div className="px-skpi">
          <div className="px-skpi-lab">TOTAL ASSETS</div>
          <div className="px-skpi-val">{sym}{window.fmtBig(totals.value)}</div>
        </div>
        <div className="px-skpi">
          <div className="px-skpi-lab">COST BASIS</div>
          <div className="px-skpi-val">{sym}{window.fmtBig(totals.cost)}</div>
        </div>
        <div className={`px-skpi ${totals.profit >= 0 ? 'up' : 'down'}`}>
          <div className="px-skpi-lab">UNREALIZED P/L</div>
          <div className="px-skpi-val">{totals.profit >= 0 ? '+' : '−'}{sym}{window.fmtBig(Math.abs(totals.profit))}</div>
        </div>
        <div className="px-skpi">
          <div className="px-skpi-lab">DEPARTMENTS</div>
          <div className="px-skpi-val">{classes.length}</div>
        </div>
        {topDept && (
          <div className="px-skpi">
            <div className="px-skpi-lab">BIGGEST DEPT</div>
            <div className="px-skpi-val">{topDept.label}</div>
          </div>
        )}
        {topPct && (
          <div className="px-skpi up">
            <div className="px-skpi-lab">BEST DEPT</div>
            <div className="px-skpi-val">+{topPct.pct.toFixed(1)}% {topPct.label}</div>
          </div>
        )}
        {botPct && botPct.pct < 0 && (
          <div className="px-skpi down">
            <div className="px-skpi-lab">WORST DEPT</div>
            <div className="px-skpi-val">{botPct.pct.toFixed(1)}% {botPct.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pixel walking character (moves left→right in a room) ─────────────────────
function PixelWalker({ color, happy, direction, style }) {
  return (
    <div className="px-walker" style={{ transform: direction === 'left' ? 'scaleX(-1)' : 'none', ...style }}>
      <PixelChar color={color} happy={happy} />
    </div>
  );
}

// ── Pixel art desk with laptop ─────────────────────────────────────────────────
function PixelLaptop({ color }) {
  const S = 3, SC = '#0d1117', FR = color || '#4b5563', GN = '#22d3ee';
  const w = 12, h = 8;
  return (
    <svg width={w*S} height={h*S} style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}>
      {/* Screen */}
      {[...Array(4)].map((_,y) => [...Array(10)].map((_,x) =>
        <rect key={`s${x}${y}`} x={(x+1)*S} y={y*S} width={S} height={S} fill={SC} />
      ))}
      {/* Screen border */}
      {[...Array(12)].map((_,x) => [
        <rect key={`st${x}`} x={x*S} y={0} width={S} height={S} fill={x===0||x===11?'none':FR} />,
        <rect key={`sb${x}`} x={x*S} y={4*S} width={S} height={S} fill={FR} />,
      ])}
      <rect x={0} y={S} width={S} height={3*S} fill={FR} />
      <rect x={11*S} y={S} width={S} height={3*S} fill={FR} />
      {/* Cursor blink */}
      <rect x={2*S} y={S} width={S} height={S} fill={GN} className="px-cursor" />
      {/* Code lines */}
      <rect x={2*S} y={2*S} width={4*S} height={S} fill={GN} opacity="0.5" />
      <rect x={2*S} y={3*S} width={6*S} height={S} fill={GN} opacity="0.3" />
      {/* Base */}
      <rect x={4*S} y={5*S} width={4*S} height={S} fill={FR} />
      <rect x={2*S} y={6*S} width={8*S} height={S} fill={FR} />
      <rect x={S}   y={7*S} width={10*S} height={S} fill={FR} opacity="0.6" />
    </svg>
  );
}

// ── Pixel art whiteboard with chart ──────────────────────────────────────────
function PixelWhiteboard() {
  const S = 3, FR = '#374151', WH = '#f9fafb', BL = '#3b82f6', RD = '#ef4444';
  const w = 14, h = 10;
  const bars = [3, 5, 4, 6, 4, 5];
  return (
    <svg width={w*S} height={h*S} style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges', display: 'block' }}>
      {/* Frame */}
      {[...Array(w)].map((_,x) => [
        <rect key={`t${x}`} x={x*S} y={0} width={S} height={S} fill={FR} />,
        <rect key={`b${x}`} x={x*S} y={9*S} width={S} height={S} fill={FR} />,
      ])}
      {[...Array(8)].map((_,y) => [
        <rect key={`l${y}`} x={0} y={(y+1)*S} width={S} height={S} fill={FR} />,
        <rect key={`r${y}`} x={13*S} y={(y+1)*S} width={S} height={S} fill={FR} />,
      ])}
      {/* White board */}
      {[...Array(8)].map((_,y) => [...Array(12)].map((_,x) =>
        <rect key={`w${x}${y}`} x={(x+1)*S} y={(y+1)*S} width={S} height={S} fill={WH} />
      ))}
      {/* Chart bars */}
      {bars.map((h, i) => (
        [...Array(h)].map((_,j) =>
          <rect key={`b${i}${j}`} x={(2+i*1.8)*S} y={(8-j)*S} width={S} height={S} fill={i % 2 === 0 ? BL : RD} />
        )
      ))}
      {/* Stand */}
      <rect x={6*S} y={9*S} width={2*S} height={S} fill={FR} />
    </svg>
  );
}

// ── HQ room types — colors match Game Dev Story palette ──────────────────────
const HQ_ROOMS = [
  { id: 'ceo',    title: 'CEO OFFICE',    icon: '👔', color: '#f59e0b', charColor: '#fbbf24', hairColor: '#92400e' },
  { id: 'invest', title: 'INVESTOR DEPT', icon: '📈', color: '#10b981', charColor: '#34d399', hairColor: '#065f46' },
  { id: 'acct',   title: 'ACCOUNTING',    icon: '📊', color: '#3b82f6', charColor: '#60a5fa', hairColor: '#1e3a8a' },
  { id: 'dev',    title: 'DEV DEPT',      icon: '💻', color: '#8b5cf6', charColor: '#a78bfa', hairColor: '#4c1d95' },
  { id: 'ba',     title: 'BA & ANALYSIS', icon: '🔍', color: '#ec4899', charColor: '#f472b6', hairColor: '#831843' },
];

function PixelHQRoom({ room, totals, sym, classes }) {
  const { id, title, icon, color, charColor, hairColor } = room;

  // Per-room data + character action
  let items = [], charAnim = 'px-anim-idle', happy = totals.pct >= 0;
  switch (id) {
    case 'ceo': {
      charAnim = totals.pct >= 0 ? 'px-anim-bob' : 'px-anim-slouch';
      items = [
        { label: 'TOTAL AUM',  value: sym + window.fmtBig(totals.value) },
        { label: 'OVERALL',    value: (totals.profit >= 0 ? '+' : '') + totals.pct.toFixed(1) + '%', cls: totals.pct >= 0 ? 'up' : 'down' },
      ];
      break;
    }
    case 'invest': {
      const best = classes.length ? [...classes].sort((a,b) => b.pct - a.pct)[0] : null;
      charAnim = 'px-anim-jump';
      happy = true;
      items = best
        ? [
            { label: 'TOP PICK', value: best.label.slice(0,12).toUpperCase() },
            { label: 'RETURN',   value: '+' + best.pct.toFixed(1) + '%', cls: 'up' },
          ]
        : [{ label: 'STATUS', value: 'SCOUTING…' }];
      break;
    }
    case 'acct': {
      const pl = totals.profit;
      charAnim = 'px-anim-type';
      happy = pl >= 0;
      items = [
        { label: 'COST BASIS', value: sym + window.fmtBig(totals.cost) },
        { label: 'UNRLZD P/L', value: (pl >= 0 ? '+' : '−') + sym + window.fmtBig(Math.abs(pl)), cls: pl >= 0 ? 'up' : 'down' },
      ];
      break;
    }
    case 'dev': {
      const nItems = classes.reduce((a,c) => a + c.positions.length, 0);
      charAnim = 'px-anim-type';
      happy = true;
      items = [
        { label: 'ASSETS',  value: nItems + ' items' },
        { label: 'CLASSES', value: classes.length + ' types' },
      ];
      break;
    }
    case 'ba': {
      charAnim = 'px-anim-analyze';
      const secs = Store.sectorTotals();
      const topSec = secs.length ? [...secs].sort((a,b) => b.value - a.value)[0] : null;
      items = topSec
        ? [
            { label: 'TOP SECTOR', value: (topSec.sector || 'N/A').slice(0,11).toUpperCase() },
            { label: 'SECTORS',    value: secs.length + ' tracked' },
          ]
        : [{ label: 'STATUS', value: 'ANALYZING…' }];
      break;
    }
  }

  const Decoration = () => {
    if (id === 'dev' || id === 'acct') return <PixelLaptop color={color} />;
    if (id === 'ba') return <PixelWhiteboard />;
    return <PixelMonitor pct={id === 'ceo' ? totals.pct : id === 'invest' ? (classes[0] ? classes[0].pct : 0) : 0} />;
  };

  return (
    <div className="px-hq-room" style={{ '--room-clr': color }}>
      <div className="px-hq-room-header">
        <span className="px-hq-room-icon">{icon}</span>
        <span className="px-hq-room-title">{title}</span>
      </div>

      <div className="px-hq-room-scene" style={{ background: '#0f1018' }}>
        {/* GDS-style warm wood floor strip */}
        <div className="px-hq-floor-strip" />

        {/* Decoration on desk */}
        <div className="px-hq-deco">
          <Decoration />
        </div>

        {/* Mood star (GDS style) above character */}
        <div className="px-hq-star">
          <PixelStar mood={happy ? (totals.pct > 10 ? 'great' : 'good') : 'bad'} />
        </div>

        {/* Animated character */}
        <div className={'px-hq-worker ' + charAnim}>
          <PixelChar color={charColor} happy={happy} tired={id === 'dev' && totals.pct < -10} hairColor={hairColor} />
        </div>

        {/* Desk surface — warm GDS wood color */}
        <div className="px-hq-desk-bar" style={{ background: 'linear-gradient(to bottom, #a16207, #78350f)' }} />

        {/* Coffee always present */}
        <div className="px-hq-coffee"><PixelCoffee /></div>
      </div>

      <div className="px-hq-room-data">
        {items.map((it, i) => (
          <div key={i} className="px-hq-data-row">
            <span className="px-hq-data-label">{it.label}</span>
            <span className={'px-hq-data-value' + (it.cls ? ' ' + it.cls : '')}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PixelHQBuilding({ totals, sym, classes }) {
  const topRooms = HQ_ROOMS.slice(0, 3); // CEO · INVESTOR · ACCOUNTING
  const botRooms = HQ_ROOMS.slice(3);    // DEV · BA & ANALYSIS

  return (
    <div className="px-hq-building">
      {/* Building sign */}
      <div className="px-hq-sign">
        <span className="px-hq-sign-text">◆ PORTFOLIO INC. — CORPORATE FLOOR 1 ◆</span>
      </div>

      {/* Floor plan */}
      <div className="px-hq-floorplan">

        {/* Top row: 3 rooms */}
        <div className="px-hq-floor-row">
          {topRooms.map((room, i) => (
            <React.Fragment key={room.id}>
              {i > 0 && <div className="px-hq-room-wall" />}
              <PixelHQRoom room={room} totals={totals} sym={sym} classes={classes} />
            </React.Fragment>
          ))}
        </div>

        {/* Main corridor */}
        <div className="px-hq-corridor">
          <span className="px-hq-corridor-label">— MAIN CORRIDOR —</span>
          {/* Two characters walking in opposite directions */}
          <div className="px-hq-walker px-hq-walker-r">
            <PixelChar color="#6366f1" happy={true} />
          </div>
          <div className="px-hq-walker px-hq-walker-l">
            <PixelChar color="#f59e0b" happy={totals.pct >= 0} />
          </div>
        </div>

        {/* Bottom row: 2 rooms + empty fill */}
        <div className="px-hq-floor-row">
          {botRooms.map((room, i) => (
            <React.Fragment key={room.id}>
              {i > 0 && <div className="px-hq-room-wall" />}
              <PixelHQRoom room={room} totals={totals} sym={sym} classes={classes} />
            </React.Fragment>
          ))}
          {/* Empty lobby space — fills remaining width to match top row */}
          <div className="px-hq-room-wall" />
          <div className="px-hq-lobby">
            <div className="px-hq-lobby-sign">LOBBY</div>
            <div className="px-anim-idle" style={{ margin: '0 auto' }}>
              <PixelChar color="#4b5563" happy={true} />
            </div>
            <PixelPlant big={false} />
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
function PixelWorld() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => Store.subscribe(force), []);

  const settings = Store.settings();
  const totals   = Store.grandTotals();
  const sym      = window.ccySymbol(settings.displayCcy);

  const classes = window.ASSET_CLASSES.map(cls => {
    const cd  = totals.classes.find(c => c.key === cls.key) || {};
    const val = cd.value || 0, cst = cd.cost || 0;
    return {
      ...cls,
      positions: Store.positions(cls.key),
      value:  val,
      cost:   cst,
      profit: val - cst,
      pct:    cst > 0 ? ((val - cst) / cst) * 100 : 0,
      color:  window.CLASS_COLORS[cls.key],
    };
  }).filter(c => c.value > 0);

  return (
    <div className="page px-world">
      {/* Header */}
      <div className="px-header">
        <div className="px-header-left">
          <div className="px-logo-block">
            <svg width="28" height="28" viewBox="0 0 28 28" style={{ imageRendering:'pixelated', shapeRendering:'crispEdges' }}>
              <rect x="10" y="2"  width="8"  height="24" fill="#5e5ce6"/>
              <rect x="2"  y="8"  width="6"  height="18" fill="#bf5af2"/>
              <rect x="20" y="12" width="6"  height="14" fill="#30d158"/>
              <rect x="11" y="4"  width="2"  height="2"  fill="#fff" opacity="0.7"/>
              <rect x="15" y="4"  width="2"  height="2"  fill="#fff" opacity="0.7"/>
              <rect x="11" y="8"  width="2"  height="2"  fill="#fff" opacity="0.7"/>
              <rect x="15" y="8"  width="2"  height="2"  fill="#fff" opacity="0.7"/>
              <rect x="3"  y="10" width="2"  height="2"  fill="#fff" opacity="0.5"/>
              <rect x="3"  y="14" width="2"  height="2"  fill="#fff" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <div className="px-title">PORTFOLIO HQ</div>
            <div className="px-subtitle">your investments have an office now</div>
          </div>
        </div>
        <div className="px-header-kpis">
          <div className="px-hkpi">
            <div className="px-hkpi-lab">DEPTS</div>
            <div className="px-hkpi-val">{classes.length}</div>
          </div>
          <div className="px-hkpi">
            <div className="px-hkpi-lab">HOLDINGS</div>
            <div className="px-hkpi-val">{classes.reduce((a,c) => a + c.positions.length, 0)}</div>
          </div>
          <div className={`px-hkpi ${totals.pct >= 0 ? 'up' : 'down'}`}>
            <div className="px-hkpi-lab">PERFORMANCE</div>
            <div className="px-hkpi-val">{totals.pct >= 0 ? '+' : ''}{totals.pct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Ticker tape */}
      {classes.length > 0 && <PixelTicker classes={classes} totals={totals} sym={sym} />}

      {/* Corporate HQ departments */}
      <PixelHQBuilding totals={totals} sym={sym} classes={classes} />

      {/* Asset class office floor */}
      {classes.length > 0 && (
        <div className="px-hq-building-header" style={{ marginBottom: 0 }}>
          <span className="px-hq-building-title">◆ INVESTMENT DEPARTMENTS ◆</span>
          <span className="px-hq-building-sub">one department per asset class</span>
        </div>
      )}
      <div className="px-office">
        {classes.length === 0 ? (
          <div className="px-empty">
            <div className="px-anim-idle"><PixelChar color="#5e5ce6" happy={false} /></div>
            <div className="px-empty-msg">No holdings yet.<br />Add investments to populate your office.</div>
          </div>
        ) : (
          <div className="px-dept-grid">
            {classes.map(cls => (
              <PixelDepartment key={cls.key} cls={cls} sym={sym} />
            ))}
          </div>
        )}
      </div>

      {/* Company summary */}
      {classes.length > 0 && <PixelSummary totals={totals} sym={sym} classes={classes} />}
    </div>
  );
}
