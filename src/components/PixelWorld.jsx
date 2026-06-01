/* eslint-disable */
/* PixelWorld.jsx — Pixel office: isometric virtual office */

// ── Flat pixel character (used in header / empty state / corridor) ─────────────
function PixelChar({ color, happy, tired, hairColor }) {
  const SK='#f5c99a', EY='#1a1a2e', HR=hairColor||'#3d2b1f',
        PN='#2d3561', BT='#111', BL='#fca5a5', MO='#d97706', T=null;
  const mR = happy ? [T,SK,BL,SK,SK,BL,SK,T] : [T,MO,SK,MO,MO,SK,MO,T];
  const cR = tired  ? [T,SK,SK,BL,BL,SK,SK,T] : [T,SK,SK,SK,SK,SK,SK,T];
  const rows = [
    [T,T,HR,HR,HR,HR,T,T],[T,HR,HR,SK,SK,HR,HR,T],[T,SK,EY,EY,SK,EY,EY,T],
    mR, cR,
    [T,color,color,color,color,color,color,T],
    [SK,color,color,color,color,color,color,SK],
    [T,color,color,color,color,color,color,T],
    [T,PN,PN,T,T,PN,PN,T],[T,BT,BT,T,T,BT,BT,T],
  ];
  const S = 4;
  return (
    <svg width={8*S} height={10*S} style={{imageRendering:'pixelated',shapeRendering:'crispEdges',display:'block'}}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}-${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill}/> : null
      ))}
    </svg>
  );
}

// ── GDS mood star ──────────────────────────────────────────────────────────────
function PixelStar({ mood }) {
  const C = mood==='good' ? '#fbbf24' : mood==='great' ? '#22c55e' : '#ef4444';
  const T=null, S=3;
  const rows=[[T,T,C,T,T],[T,C,C,C,T],[C,C,C,C,C],[T,C,C,C,T],[T,T,C,T,T]];
  return (
    <svg width={5*S} height={5*S} style={{imageRendering:'pixelated',shapeRendering:'crispEdges',display:'block'}}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill}/> : null
      ))}
    </svg>
  );
}

// ── ISO math ───────────────────────────────────────────────────────────────────
const TW = 40, TH = 20;

function ixy(col, row, e = 0) {
  return { x: (col - row) * TW / 2, y: (col + row) * TH / 2 - e * TH };
}

// Adjust hex brightness: f<1 → darker, f>1 → lighter
function hx(hex, f) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#888';
  const n = parseInt(hex.slice(1), 16);
  let r = (n>>16)&0xff, g = (n>>8)&0xff, b = n&0xff;
  if (f < 1) { r = r*f|0; g = g*f|0; b = b*f|0; }
  else {
    r = Math.min(255, r + ((255-r)*(f-1))|0);
    g = Math.min(255, g + ((255-g)*(f-1))|0);
    b = Math.min(255, b + ((255-b)*(f-1))|0);
  }
  return `rgb(${r},${g},${b})`;
}

// Diamond tile points at given elevation
function tilePts(col, row, e = 0) {
  const p = ixy(col, row, e);
  return `${p.x+TW/2},${p.y} ${p.x+TW},${p.y+TH/2} ${p.x+TW/2},${p.y+TH} ${p.x},${p.y+TH/2}`;
}
// Left face (viewer's left)
function lftPts(col, row, e, h) {
  const t = ixy(col,row,e+h), b = ixy(col,row,e);
  return `${t.x},${t.y+TH/2} ${t.x+TW/2},${t.y+TH} ${b.x+TW/2},${b.y+TH} ${b.x},${b.y+TH/2}`;
}
// Right face (viewer's right)
function rgtPts(col, row, e, h) {
  const t = ixy(col,row,e+h), b = ixy(col,row,e);
  return `${t.x+TW/2},${t.y+TH} ${t.x+TW},${t.y+TH/2} ${b.x+TW},${b.y+TH/2} ${b.x+TW/2},${b.y+TH}`;
}

// ── ISO cube ───────────────────────────────────────────────────────────────────
function IsoBox({ col, row, e=0, h=1, top, lft, rgt, stroke='#0002' }) {
  return (
    <g>
      <polygon points={lftPts(col,row,e,h)} fill={lft} stroke={stroke} strokeWidth="0.5"/>
      <polygon points={rgtPts(col,row,e,h)} fill={rgt} stroke={stroke} strokeWidth="0.5"/>
      <polygon points={tilePts(col,row,e+h)} fill={top} stroke={stroke} strokeWidth="0.5"/>
    </g>
  );
}

// ── ISO floor tiles ────────────────────────────────────────────────────────────
function IsoFloor({ C=4, R=3 }) {
  return (
    <g>
      {[...Array(R)].map((_,row) => [...Array(C)].map((_,col) =>
        <polygon key={`${col}${row}`}
          points={tilePts(col,row)}
          fill={(col+row)%2===0 ? '#1c1c2e' : '#141424'}
          stroke="#fff1" strokeWidth="0.5"/>
      ))}
    </g>
  );
}

// ── ISO walls (back-left + back-right, with wall-top ledge) ───────────────────
function IsoWalls({ C=4, R=3, wH=2, color='#2d3561' }) {
  // Back-right wall = left faces of virtual row=-1 tiles
  // Back-left wall  = right faces of virtual col=-1 tiles
  const lc  = hx(color, 0.60);  // back-left face (darker = less lit)
  const rc  = hx(color, 0.78);  // back-right face
  const ltc = hx(color, 0.82);  // back-left top ledge
  const rtc = hx(color, 0.92);  // back-right top ledge
  // Subtle wall detail stripe color
  const stripe = hx(color, 0.50);

  return (
    <g>
      {/* Back-left wall faces */}
      {[...Array(R)].map((_,row) =>
        <polygon key={`wl${row}`} points={rgtPts(-1,row,0,wH)} fill={lc} stroke="#0003" strokeWidth="0.5"/>
      )}
      {/* Back-left top ledge */}
      {[...Array(R)].map((_,row) =>
        <polygon key={`wlt${row}`} points={tilePts(-1,row,wH)} fill={ltc} stroke="#0003" strokeWidth="0.5"/>
      )}
      {/* Back-right wall faces */}
      {[...Array(C)].map((_,col) =>
        <polygon key={`wr${col}`} points={lftPts(col,-1,0,wH)} fill={rc} stroke="#0003" strokeWidth="0.5"/>
      )}
      {/* Back-right top ledge */}
      {[...Array(C)].map((_,col) =>
        <polygon key={`wrt${col}`} points={tilePts(col,-1,wH)} fill={rtc} stroke="#0003" strokeWidth="0.5"/>
      )}
      {/* Small decorative stripe at mid-wall height on back-right */}
      {[...Array(C)].map((_,col) => {
        const top = ixy(col,-1,wH*0.55), bot = ixy(col,-1,wH*0.45);
        const pts = `${top.x},${top.y+TH/2} ${top.x+TW/2},${top.y+TH} ${bot.x+TW/2},${bot.y+TH} ${bot.x},${bot.y+TH/2}`;
        return <polygon key={`ws${col}`} points={pts} fill={stripe} stroke="none"/>;
      })}
    </g>
  );
}

// ── Simple SVG plant for non-ISO contexts (lobby etc.) ────────────────────────
function PixelPlant() {
  const S=3, GR='#22c55e', DG='#15803d', BR='#92400e', PT='#78350f', T=null;
  const rows=[[T,GR,T],[GR,DG,GR],[T,BR,T],[PT,PT,PT]];
  return (
    <svg width={3*S} height={4*S} style={{imageRendering:'pixelated',shapeRendering:'crispEdges',display:'block'}}>
      {rows.map((row,y) => row.map((fill,x) =>
        fill ? <rect key={`${x}${y}`} x={x*S} y={y*S} width={S} height={S} fill={fill}/> : null
      ))}
    </svg>
  );
}

// ── ISO furniture ──────────────────────────────────────────────────────────────
function IsoDesk({ col, row, wide=true }) {
  const dh=0.42, tt='#b07540', tl='#8c5228', tr='#6b3818';
  return (
    <g>
      <IsoBox col={col}   row={row} h={dh} top={tt} lft={tl} rgt={tr}/>
      {wide && <IsoBox col={col+1} row={row} h={dh} top={tt} lft={tl} rgt={tr}/>}
    </g>
  );
}

function IsoMonitor({ col, row, pct=0 }) {
  const de=0.42, mh=0.60;
  const gl = pct >= 0 ? '#00e676' : '#ff5252';
  const sc = pct >= 0 ? '#050f0a' : '#0f0505';
  const fr = '#2a2a48';
  // Screen content bars on left face
  const t = ixy(col, row, de+mh), b = ixy(col, row, de);
  const faceMidY = (t.y + b.y) / 2 + TH * 0.6;
  const faceX    = b.x + 5;
  return (
    <g>
      <IsoBox col={col} row={row} e={de} h={mh} top={hx(fr,1.3)} lft={sc} rgt={fr}/>
      <rect x={faceX}   y={faceMidY-7} width={7} height={2} fill={gl} opacity="0.75"/>
      <rect x={faceX}   y={faceMidY-4} width={10} height={2} fill={gl} opacity="0.50"/>
      <rect x={faceX}   y={faceMidY-1} width={8} height={2} fill={gl} opacity="0.30"/>
      {/* glow dot on screen top face */}
      <circle cx={t.x+TW/2} cy={t.y+TH/2} r={3} fill={gl} opacity="0.35"/>
    </g>
  );
}

function IsoLaptop({ col, row }) {
  const de=0.42, lh=0.28;
  const fr='#1a1a38', sc='#0d1117';
  const t = ixy(col, row, de+lh);
  const gl = '#22d3ee';
  return (
    <g>
      <IsoBox col={col} row={row} e={de} h={lh} top={fr} lft={sc} rgt={hx(fr,0.6)}/>
      <rect x={t.x+4}  y={t.y+TH/2-3} width={4} height={1} fill={gl} opacity="0.8"/>
      <rect x={t.x+4}  y={t.y+TH/2}   width={6} height={1} fill={gl} opacity="0.5"/>
    </g>
  );
}

function IsoWhiteboard({ col, row }) {
  const wh=1.3, top='#e5e7eb', lft='#9ca3af', rgt='#d1d5db';
  const t = ixy(col, row, wh);
  // Small chart marks on the right face
  const gx = t.x + TW*0.6, gy = t.y + TH*0.6;
  return (
    <g>
      <IsoBox col={col} row={row} e={0} h={wh} top={top} lft={lft} rgt={rgt}/>
      <rect x={gx}   y={gy-6} width={2} height={4} fill='#3b82f6' opacity="0.8"/>
      <rect x={gx+3} y={gy-9} width={2} height={7} fill='#ef4444' opacity="0.8"/>
      <rect x={gx+6} y={gy-4} width={2} height={2} fill='#3b82f6' opacity="0.8"/>
    </g>
  );
}

function IsoPlant({ col, row }) {
  const ph=0.22;
  const p = ixy(col, row, ph);
  const cx = p.x + TW/2, cy = p.y;
  return (
    <g>
      <IsoBox col={col} row={row} h={ph} top={hx('#92400e',1.15)} lft='#92400e' rgt={hx('#92400e',0.65)}/>
      <ellipse cx={cx}   cy={cy-4} rx={7} ry={5} fill='#15803d' opacity="0.92"/>
      <ellipse cx={cx-4} cy={cy-8} rx={5} ry={4} fill='#22c55e' opacity="0.88"/>
      <ellipse cx={cx+4} cy={cy-7} rx={5} ry={4} fill='#22c55e' opacity="0.88"/>
    </g>
  );
}

function IsoCoffee({ col, row, offX=0.72 }) {
  const de=0.42;
  const p = ixy(col, row, de);
  const cx = p.x + TW*offX, cy = p.y + TH*0.35;
  return (
    <g>
      <ellipse cx={cx}   cy={cy}   rx={4}  ry={3}  fill='#78350f'/>
      <ellipse cx={cx}   cy={cy-1} rx={3}  ry={2}  fill='#92400e'/>
      <ellipse cx={cx}   cy={cy-2} rx={2}  ry={1}  fill='#f0abfc' opacity="0.65"/>
    </g>
  );
}

// ── Mini pixel character (SVG <g>, S=2, 16×20px) ──────────────────────────────
function MiniChar({ x=0, y=0, color='#6366f1', happy=true, tired=false, hC }) {
  const SK='#f5c99a', EY='#1a1a2e', HR=hC||'#3d2b1f',
        PN='#2d3561', BT='#111', BL='#fca5a5', MO='#d97706', T=null;
  const S = 2;
  const mR = happy ? [T,SK,BL,SK,SK,BL,SK,T] : [T,MO,SK,MO,MO,SK,MO,T];
  const cR = tired  ? [T,SK,SK,BL,BL,SK,SK,T] : [T,SK,SK,SK,SK,SK,SK,T];
  const rows = [
    [T,T,HR,HR,HR,HR,T,T],[T,HR,HR,SK,SK,HR,HR,T],[T,SK,EY,EY,SK,EY,EY,T],
    mR, cR,
    [T,color,color,color,color,color,color,T],
    [SK,color,color,color,color,color,color,SK],
    [T,color,color,color,color,color,color,T],
    [T,PN,PN,T,T,PN,PN,T],[T,BT,BT,T,T,BT,BT,T],
  ];
  return (
    <g transform={`translate(${x},${y})`}>
      {rows.map((row,ry) => row.map((fill,rx) =>
        fill ? <rect key={`${rx}${ry}`} x={rx*S} y={ry*S} width={S} height={S} fill={fill}/> : null
      ))}
    </g>
  );
}

// ── ISO dept room scene (4×3 floor) ───────────────────────────────────────────
// viewBox covers: x -55→155, y -58→114
function IsoRoomScene({ color, pct, happy, roomType='default' }) {
  const C=4, R=3, wH=2;
  const hairC = hx(color, 0.32);

  // Character at (2,1) — one tile forward from desk
  const cp = ixy(2, 1, 0);
  const cw=16, ch=20;
  const charX = cp.x + TW/2 - cw/2;
  const charY = cp.y + TH/2 - ch;

  return (
    <svg viewBox="-55 -58 210 172" width="100%"
      style={{imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block', overflow:'visible'}}>

      {/* Walls first (deepest layer) */}
      <IsoWalls C={C} R={R} wH={wH} color={color}/>

      {/* Floor */}
      <IsoFloor C={C} R={R}/>

      {/* Plant at (0,0) — back-left corner */}
      <IsoPlant col={0} row={0}/>

      {/* Desk spanning (1,0)→(2,0) */}
      <IsoDesk col={1} row={0} wide={true}/>

      {/* Desk decoration by room type */}
      {roomType === 'laptop' || roomType === 'dev' || roomType === 'acct'
        ? <IsoLaptop col={1} row={0}/>
        : <IsoMonitor col={1} row={0} pct={pct}/>
      }
      {roomType === 'ba'
        ? <IsoWhiteboard col={3} row={0}/>
        : null
      }

      {/* Coffee on desk */}
      <IsoCoffee col={2} row={0}/>

      {/* Character */}
      <MiniChar x={charX} y={charY} color={color} happy={happy} tired={pct < -5} hC={hairC}/>
    </svg>
  );
}

// ── ISO HQ room scene (3×2 floor, smaller) ────────────────────────────────────
// viewBox covers: x -48→128, y -50→70
function IsoHQScene({ color, pct, happy, id }) {
  const C=3, R=2, wH=1.5;
  const hairC = hx(color, 0.32);

  const cp = ixy(1, 1, 0);
  const cw=16, ch=20;
  const charX = cp.x + TW/2 - cw/2;
  const charY = cp.y + TH/2 - ch;

  const Deco = () => {
    switch(id) {
      case 'invest': return <IsoMonitor col={1} row={0} pct={Math.abs(pct)}/>;
      case 'acct':   return <IsoLaptop col={1} row={0}/>;
      case 'dev':    return <IsoLaptop col={1} row={0}/>;
      case 'ba':     return <IsoWhiteboard col={2} row={0}/>;
      default:       return <IsoMonitor col={1} row={0} pct={pct}/>;
    }
  };

  return (
    <svg viewBox="-48 -50 176 120" width="100%"
      style={{imageRendering:'pixelated', shapeRendering:'crispEdges', display:'block', overflow:'visible'}}>
      <IsoWalls C={C} R={R} wH={wH} color={color}/>
      <IsoFloor C={C} R={R}/>
      <IsoPlant col={0} row={0}/>
      <IsoDesk col={0} row={0} wide={true}/>
      <Deco/>
      <IsoCoffee col={1} row={0} offX={0.78}/>
      <MiniChar x={charX} y={charY} color={color} happy={happy} tired={pct < -10} hC={hairC}/>
    </svg>
  );
}

// ── Speech bubble ──────────────────────────────────────────────────────────────
function SpeechBubble({ text }) {
  return <div className="px-bubble"><span>{text}</span></div>;
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ pct }) {
  const [label, cls] = pct > 15 ? ['🚀 MOON MODE','moon']
    : pct > 5  ? ['💪 GRINDING','grind']
    : pct > 0  ? ['😎 CHILLING','chill']
    : pct > -5 ? ['😓 STRUGGLING','struggle']
    : pct > -15? ['📉 IN RED','red']
    :            ['🚨 CRISIS','crisis'];
  return <span className={`px-badge px-badge-${cls}`}>{label}</span>;
}

// ── Department card ────────────────────────────────────────────────────────────
const SPEECH_HAPPY = ['BUY MORE!','TO THE MOON','BULLISH!','PROFIT!','HODL MORE','BRB BUYING'];
const SPEECH_SAD   = ['sell?...','hodl...','it is fine','just a dip','bruh...','WHY THO'];

// Map asset class key → room decoration type
const ROOM_TYPE = { usaStock:'default', etf:'default', thaiStock:'default', fund:'acct', crypto:'laptop', gold:'default', other:'default' };

function PixelDepartment({ cls, sym }) {
  const { value, cost, pct, color, positions } = cls;
  const profit = value - cost;
  const happy  = pct >= 0;

  const speechIdx = cls.key.charCodeAt(0) % SPEECH_HAPPY.length;
  const speech = happy ? SPEECH_HAPPY[speechIdx] : SPEECH_SAD[speechIdx];

  const topHolding = positions.length > 0
    ? [...positions].sort((a,b) => b.value - a.value)[0] : null;
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

      {/* Isometric scene */}
      <div className="px-iso-wrap">
        <IsoRoomScene color={color} pct={pct} happy={happy} roomType={ROOM_TYPE[cls.key]||'default'}/>
        <div className="px-iso-bubble">
          <SpeechBubble text={speech}/>
        </div>
      </div>

      {/* Worker nameplate */}
      <div className="px-nametag">
        <span className="px-nametag-icon">👤</span>
        <span className="px-nametag-text">{workerName}</span>
      </div>

      <StatusBadge pct={pct}/>

      <div className="px-perfbar-wrap">
        <div className={`px-perfbar-fill ${happy ? 'up' : 'down'}`}
          style={{ width: `${Math.min(Math.abs(pct) * 6, 100)}%` }}/>
      </div>

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

// ── Scrolling ticker tape ──────────────────────────────────────────────────────
function PixelTicker({ classes, totals, sym }) {
  const items = classes.map(c => {
    const sign = c.pct >= 0 ? '▲' : '▼';
    return `${c.label.toUpperCase()}: ${sym}${window.fmtBig(c.value)} ${sign}${Math.abs(c.pct).toFixed(1)}%`;
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

// ── Company summary footer ─────────────────────────────────────────────────────
function PixelSummary({ totals, sym, classes }) {
  const topDept = [...classes].sort((a,b) => b.value - a.value)[0];
  const topPct  = [...classes].sort((a,b) => b.pct - a.pct)[0];
  const botPct  = [...classes].sort((a,b) => a.pct - b.pct)[0];
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
        {topDept && <div className="px-skpi"><div className="px-skpi-lab">BIGGEST DEPT</div><div className="px-skpi-val">{topDept.label}</div></div>}
        {topPct  && <div className="px-skpi up"><div className="px-skpi-lab">BEST DEPT</div><div className="px-skpi-val">+{topPct.pct.toFixed(1)}% {topPct.label}</div></div>}
        {botPct && botPct.pct < 0 && <div className="px-skpi down"><div className="px-skpi-lab">WORST DEPT</div><div className="px-skpi-val">{botPct.pct.toFixed(1)}% {botPct.label}</div></div>}
      </div>
    </div>
  );
}

// ── Unified open-office floor plan ───────────────────────────────────────────
// Grid: C=9 cols × R=5 rows
//   Upper: CEO 0-2 | INVEST 3-5 | ACCT 6-8   (rows 0-1, desk/char at row 1)
//   Row 2: corridor
//   Lower: DEV 0-3 | BA 4-8                   (rows 3-4)
const OFC_ZONES = [
  { id:'ceo',    c:'#f59e0b', cols:[0,1,2],     rows:[0,1] },
  { id:'invest', c:'#10b981', cols:[3,4,5],     rows:[0,1] },
  { id:'acct',   c:'#3b82f6', cols:[6,7,8],     rows:[0,1] },
  { id:'dev',    c:'#8b5cf6', cols:[0,1,2,3],   rows:[3,4] },
  { id:'ba',     c:'#ec4899', cols:[4,5,6,7,8], rows:[3,4] },
];

function ofcFloor(col, row) {
  for (const z of OFC_ZONES) {
    if (z.cols.includes(col) && z.rows.includes(row)) {
      const n = parseInt(z.c.slice(1),16);
      const rf=((n>>16)&0xff)*0.20|0, gf=((n>>8)&0xff)*0.20|0, bf=(n&0xff)*0.20|0;
      const b = (col+row)%2===0 ? 16 : 10;
      return `rgb(${rf+b},${gf+b},${bf+b})`;
    }
  }
  return (col+row)%2===0 ? '#161626' : '#101018';
}

function IsoOpenOffice({ totals, sym, classes }) {
  const C=9, R=5, wH=1.0, happy = totals.pct >= 0;

  function cAt(col, row, color, hC, h) {
    const p = ixy(col, row, 0);
    return <MiniChar key={`oc${col}${row}`}
      x={p.x+TW/2-8} y={p.y+TH/2-20} color={color} happy={h!==undefined?h:happy}
      hC={hC||hx(color,0.35)}/>;
  }

  // Wall colors: back-right wall gets zone colors per column
  const wallFaceC = col => col<=2 ? hx('#f59e0b',0.52) : col<=5 ? hx('#10b981',0.52) : hx('#3b82f6',0.52);
  const wallTopC  = col => col<=2 ? hx('#f59e0b',0.70) : col<=5 ? hx('#10b981',0.70) : hx('#3b82f6',0.70);

  // Legend data
  const best = classes.length ? [...classes].sort((a,b)=>b.pct-a.pct)[0] : null;
  const secs = Store.sectorTotals ? Store.sectorTotals() : [];
  const topSec = secs.length ? [...secs].sort((a,b)=>b.value-a.value)[0] : null;
  const nAssets = classes.reduce((a,c)=>a+c.positions.length,0);

  const zones = [
    { id:'ceo',    c:'#f59e0b', icon:'👔', label:'CEO OFFICE',    items:[{ l:'AUM',v:sym+window.fmtBig(totals.value) },{ l:'P/L',v:(totals.profit>=0?'+':'−')+sym+window.fmtBig(Math.abs(totals.profit)),cls:totals.profit>=0?'up':'down' }] },
    { id:'invest', c:'#10b981', icon:'📈', label:'INVESTOR',       items: best?[{ l:'TOP',v:best.label.slice(0,10).toUpperCase() },{ l:'RET',v:'+'+best.pct.toFixed(1)+'%',cls:'up' }]:[{ l:'STATUS',v:'SCOUTING' }] },
    { id:'acct',   c:'#3b82f6', icon:'📊', label:'ACCOUNTING',     items:[{ l:'COST',v:sym+window.fmtBig(totals.cost) },{ l:'P/L',v:(totals.profit>=0?'+':'−')+sym+window.fmtBig(Math.abs(totals.profit)),cls:totals.profit>=0?'up':'down' }] },
    { id:'dev',    c:'#8b5cf6', icon:'💻', label:'DEV DEPT',        items:[{ l:'ASSETS',v:nAssets+' items' },{ l:'TYPES',v:classes.length+' cls' }] },
    { id:'ba',     c:'#ec4899', icon:'🔍', label:'BA & ANALYSIS',   items: topSec?[{ l:'TOP SEC',v:(topSec.sector||'N/A').slice(0,10).toUpperCase() },{ l:'SECTS',v:secs.length+' tracked' }]:[{ l:'STATUS',v:'ANALYZING' }] },
  ];

  return (
    <>
      <div className="px-hq-office-scroll">
        <svg viewBox="-88 -44 308 196"
          style={{width:'100%',height:'auto',minWidth:'520px',display:'block',imageRendering:'pixelated',shapeRendering:'crispEdges'}}>

          {/* Back-left wall — neutral */}
          {[...Array(R)].map((_,row) => [
            <polygon key={`wl${row}`}  points={rgtPts(-1,row,0,wH)} fill={hx('#22224a',0.65)} stroke="#0003" strokeWidth="0.5"/>,
            <polygon key={`wlt${row}`} points={tilePts(-1,row,wH)}  fill={hx('#22224a',0.82)} stroke="#0003" strokeWidth="0.5"/>,
          ])}

          {/* Back-right wall — zone-colored face + top */}
          {[...Array(C)].map((_,col) => [
            <polygon key={`wr${col}`}  points={lftPts(col,-1,0,wH)} fill={wallFaceC(col)} stroke="#0003" strokeWidth="0.5"/>,
            <polygon key={`wrt${col}`} points={tilePts(col,-1,wH)}  fill={wallTopC(col)}  stroke="#0003" strokeWidth="0.5"/>,
          ])}

          {/* Zone-tinted floor tiles */}
          {[...Array(R)].map((_,row) => [...Array(C)].map((_,col) => (
            <polygon key={`f${col}${row}`} points={tilePts(col,row)} fill={ofcFloor(col,row)} stroke="#fff1" strokeWidth="0.4"/>
          )))}

          {/* Zone marker pillars — h=1.3 (just above wH=1.0 wall) */}
          {[[0,0,'ceo'],[3,0,'invest'],[6,0,'acct'],[0,3,'dev'],[4,3,'ba']].map(([c,r,id]) => {
            const zc = OFC_ZONES.find(z=>z.id===id).c;
            return <IsoBox key={`zp${c}${r}`} col={c} row={r} h={1.3}
              top={hx(zc,1.0)} lft={hx(zc,0.72)} rgt={hx(zc,0.50)}/>;
          })}

          {/* ─ CEO ZONE — desks at row=1, visible above back wall ─ */}
          <IsoDesk col={0} row={1} wide={true}/>
          <IsoMonitor col={0} row={1} pct={totals.pct}/>
          <IsoCoffee col={1} row={1} offX={0.72}/>
          <IsoPlant col={2} row={1}/>

          {/* ─ INVEST ZONE ─ */}
          <IsoDesk col={3} row={1} wide={true}/>
          <IsoMonitor col={3} row={1} pct={best ? best.pct : 1}/>
          <IsoCoffee col={4} row={1} offX={0.72}/>
          <IsoPlant col={5} row={1}/>

          {/* ─ ACCT ZONE ─ */}
          <IsoDesk col={6} row={1} wide={true}/>
          <IsoLaptop col={6} row={1}/>
          <IsoCoffee col={7} row={1} offX={0.72}/>
          <IsoPlant col={8} row={1}/>

          {/* ─ DEV ZONE — two desk clusters ─ */}
          <IsoDesk col={0} row={3} wide={true}/>
          <IsoLaptop col={0} row={3}/>
          <IsoDesk col={2} row={3} wide={false}/>
          <IsoLaptop col={2} row={3}/>
          <IsoCoffee col={1} row={3} offX={0.72}/>
          <IsoPlant col={3} row={4}/>

          {/* ─ BA ZONE ─ */}
          <IsoDesk col={4} row={3} wide={true}/>
          <IsoWhiteboard col={7} row={3}/>
          <IsoCoffee col={5} row={3} offX={0.72}/>
          <IsoPlant col={8} row={4}/>

          {/* Characters rendered last */}
          {cAt(1, 1, '#fbbf24')}
          {cAt(4, 1, '#34d399', null, true)}
          {cAt(7, 1, '#60a5fa', null, totals.profit>=0)}
          {cAt(1, 4, '#a78bfa', null, true)}
          {cAt(6, 4, '#f472b6', null, happy)}
          {cAt(4, 2, '#6366f1', null, true)}
        </svg>
      </div>

      <div className="px-office-legend">
        {zones.map(z => (
          <div key={z.id} className="px-office-zone" style={{'--zc': z.c}}>
            <div className="px-oz-label">{z.icon} {z.label}</div>
            {z.items.map((it,i) => (
              <div key={i} className="px-oz-row">
                <span className="px-ozl">{it.l}</span>
                <span className={`px-ozv${it.cls?' '+it.cls:''}`}>{it.v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── HQ rooms ───────────────────────────────────────────────────────────────────
const HQ_ROOMS = [
  { id:'ceo',    title:'CEO OFFICE',    icon:'👔', color:'#f59e0b', charColor:'#fbbf24' },
  { id:'invest', title:'INVESTOR DEPT', icon:'📈', color:'#10b981', charColor:'#34d399' },
  { id:'acct',   title:'ACCOUNTING',    icon:'📊', color:'#3b82f6', charColor:'#60a5fa' },
  { id:'dev',    title:'DEV DEPT',      icon:'💻', color:'#8b5cf6', charColor:'#a78bfa' },
  { id:'ba',     title:'BA & ANALYSIS', icon:'🔍', color:'#ec4899', charColor:'#f472b6' },
];

function PixelHQRoom({ room, totals, sym, classes }) {
  const { id, title, icon, color, charColor } = room;
  const happy = totals.pct >= 0;

  let items = [];
  switch (id) {
    case 'ceo':
      items = [
        { label:'TOTAL AUM', value: sym + window.fmtBig(totals.value) },
        { label:'OVERALL',   value: (totals.profit>=0?'+':'') + totals.pct.toFixed(1)+'%', cls: totals.pct>=0?'up':'down' },
      ]; break;
    case 'invest': {
      const best = classes.length ? [...classes].sort((a,b)=>b.pct-a.pct)[0] : null;
      items = best
        ? [{ label:'TOP PICK', value: best.label.slice(0,12).toUpperCase() }, { label:'RETURN', value:'+'+best.pct.toFixed(1)+'%', cls:'up' }]
        : [{ label:'STATUS', value:'SCOUTING…' }];
      break;
    }
    case 'acct': {
      const pl = totals.profit;
      items = [
        { label:'COST BASIS', value: sym+window.fmtBig(totals.cost) },
        { label:'UNRLZD P/L', value: (pl>=0?'+':'−')+sym+window.fmtBig(Math.abs(pl)), cls:pl>=0?'up':'down' },
      ]; break;
    }
    case 'dev': {
      const nItems = classes.reduce((a,c)=>a+c.positions.length,0);
      items = [
        { label:'ASSETS',  value: nItems+' items' },
        { label:'CLASSES', value: classes.length+' types' },
      ]; break;
    }
    case 'ba': {
      const secs = Store.sectorTotals();
      const topSec = secs.length ? [...secs].sort((a,b)=>b.value-a.value)[0] : null;
      items = topSec
        ? [{ label:'TOP SECTOR', value:(topSec.sector||'N/A').slice(0,11).toUpperCase() }, { label:'SECTORS', value:secs.length+' tracked' }]
        : [{ label:'STATUS', value:'ANALYZING…' }];
      break;
    }
  }

  return (
    <div className="px-hq-room" style={{ '--room-clr': color }}>
      <div className="px-hq-room-header">
        <span className="px-hq-room-icon">{icon}</span>
        <span className="px-hq-room-title">{title}</span>
      </div>

      {/* Isometric HQ scene */}
      <div className="px-hq-iso-wrap">
        <IsoHQScene color={color} pct={totals.pct} happy={happy} id={id}/>
        <div className="px-hq-mood-star">
          <PixelStar mood={happy ? (totals.pct>10?'great':'good') : 'bad'}/>
        </div>
      </div>

      <div className="px-hq-room-data">
        {items.map((it,i) => (
          <div key={i} className="px-hq-data-row">
            <span className="px-hq-data-label">{it.label}</span>
            <span className={`px-hq-data-value${it.cls?' '+it.cls:''}`}>{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PixelHQBuilding({ totals, sym, classes }) {
  return (
    <div className="px-hq-building">
      <div className="px-hq-sign">
        <span className="px-hq-sign-text">◆ PORTFOLIO INC. — CORPORATE FLOOR 1 ◆</span>
      </div>
      <IsoOpenOffice totals={totals} sym={sym} classes={classes}/>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
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
      value:  val, cost: cst,
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
            <svg width="28" height="28" viewBox="0 0 28 28" style={{imageRendering:'pixelated',shapeRendering:'crispEdges'}}>
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
            <div className="px-hkpi-val">{classes.reduce((a,c) => a+c.positions.length, 0)}</div>
          </div>
          <div className={`px-hkpi ${totals.pct >= 0 ? 'up' : 'down'}`}>
            <div className="px-hkpi-lab">PERFORMANCE</div>
            <div className="px-hkpi-val">{totals.pct >= 0 ? '+' : ''}{totals.pct.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {classes.length > 0 && <PixelTicker classes={classes} totals={totals} sym={sym}/>}

      <PixelHQBuilding totals={totals} sym={sym} classes={classes}/>

      {classes.length > 0 && (
        <div className="px-hq-building-header" style={{ marginBottom:0 }}>
          <span className="px-hq-building-title">◆ INVESTMENT DEPARTMENTS ◆</span>
          <span className="px-hq-building-sub">one department per asset class</span>
        </div>
      )}

      <div className="px-office">
        {classes.length === 0 ? (
          <div className="px-empty">
            <div className="px-anim-idle"><PixelChar color="#5e5ce6" happy={false}/></div>
            <div className="px-empty-msg">No holdings yet.<br/>Add investments to populate your office.</div>
          </div>
        ) : (
          <div className="px-dept-grid">
            {classes.map(cls => (
              <PixelDepartment key={cls.key} cls={cls} sym={sym}/>
            ))}
          </div>
        )}
      </div>

      {classes.length > 0 && <PixelSummary totals={totals} sym={sym} classes={classes}/>}
    </div>
  );
}
