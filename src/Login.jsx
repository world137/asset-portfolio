/* eslint-disable */
/* Login.jsx — password gate; renders before App if not authenticated */

// Authentication is handled by POST /api/auth which checks username + password_hash
// against the users table in Supabase. Run database/auth_migration.sql first,
// then use tools/register-user.mjs to add users.
const AUTH_KEY     = 'ptf_auth';
const PTF_ID_KEY   = 'ptf_id';
const PTF_USER_KEY = 'ptf_username';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// On page load, restore the portfolio ID from session so already-authenticated
// users don't lose their store binding on refresh.
(function () {
  const id = sessionStorage.getItem(PTF_ID_KEY);
  if (id && window.Store) Store.setPrimaryId(id);
})();

function checkAuth()  { return sessionStorage.getItem(AUTH_KEY) === '1'; }
function getUsername(){ return sessionStorage.getItem(PTF_USER_KEY) || 'User'; }
function setAuth(id, username) {
  sessionStorage.setItem(AUTH_KEY, '1');
  sessionStorage.setItem(PTF_ID_KEY, id);
  sessionStorage.setItem(PTF_USER_KEY, username.trim() || 'User');
  if (window.Store) Store.setPrimaryId(id);
}
function clearAuth()  {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(PTF_ID_KEY);
  sessionStorage.removeItem(PTF_USER_KEY);
}

window._ptfLogout   = function () { clearAuth(); window.location.reload(); };
window._ptfUsername = getUsername;

function LoginPage({ onSuccess }) {
  const [username, setUsername] = React.useState('');
  const [pw,    setPw]    = React.useState('');
  const [error, setError] = React.useState('');
  const [busy,  setBusy]  = React.useState(false);
  const [step,  setStep]  = React.useState('username'); // 'username' | 'password'

  const goToPassword = (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setStep('password');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const passwordHash = await sha256Hex(pw);
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), passwordHash }),
      });
      const data = await res.json();
      if (data.ok && data.portfolioId) {
        setAuth(data.portfolioId, username);
        fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'login', username: username.trim() }),
        }).catch(() => {});
        onSuccess();
      } else {
        setError('Wrong username or password.');
        setPw('');
      }
    } catch (_) {
      setError('Authentication error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
            </svg>
          </div>
          <div className="login-title">
            {step === 'username' ? 'Sign in' : `Welcome, ${username}`}
          </div>
          <div className="login-sub">
            {step === 'username' ? 'to continue to Portfolio Tracker' : 'Enter your password to continue'}
          </div>
        </div>

        {step === 'username' ? (
          <form className="login-form" onSubmit={goToPassword} autoComplete="off">
            <div className="login-field">
              <label className="login-label" htmlFor="ptf-user">Username</label>
              <input
                id="ptf-user"
                className={'login-input' + (error ? ' err' : '')}
                type="text"
                placeholder="Your name"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                autoFocus
                autoComplete="username"
                required
              />
              {error && <div className="login-error">{error}</div>}
            </div>
            <button className="login-btn" type="submit" disabled={!username.trim()}>
              Next
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submit} autoComplete="off">
            <div className="login-field">
              {/* Username display chip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                padding: '8px 12px', borderRadius: 10, background: 'var(--bg-sunken)',
                border: '1px solid var(--border-2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>
                  {username.slice(0, 1).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{username}</span>
                <button type="button"
                  onClick={() => { setStep('username'); setError(''); setPw(''); }}
                  style={{ fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Change
                </button>
              </div>

              <label className="login-label" htmlFor="ptf-pw">Password</label>
              <input
                id="ptf-pw"
                className={'login-input' + (error ? ' err' : '')}
                type="password"
                placeholder="Enter your password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(''); }}
                autoFocus
                autoComplete="current-password"
                required
              />
              {error && <div className="login-error">{error}</div>}
            </div>
            <button className="login-btn" type="submit" disabled={busy || !pw}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AuthGate({ children }) {
  const [authed, setAuthed] = React.useState(checkAuth);
  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />;
  return children;
}
