/* eslint-disable */
/* Login.jsx — password gate; renders before App if not authenticated */

// SHA-256 hash of the access password. The plaintext password is never stored here.
// To change your password:
//   1. Run: node tools/hash-password.mjs your-new-password
//   2. Paste the printed hash below as LOGIN_HASH
//   3. Run: node tools/migrate-portfolio-id.mjs your-old-password your-new-password
const LOGIN_HASH = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7';
const AUTH_KEY  = 'ptf_auth';
const PTF_ID_KEY = 'ptf_id';

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
function setAuth(id)  {
  sessionStorage.setItem(AUTH_KEY, '1');
  sessionStorage.setItem(PTF_ID_KEY, id);
  if (window.Store) Store.setPrimaryId(id);
}
function clearAuth()  {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(PTF_ID_KEY);
}

window._ptfLogout = function () {
  clearAuth();
  window.location.reload();
};

function LoginPage({ onSuccess }) {
  const [pw,    setPw]    = React.useState('');
  const [error, setError] = React.useState('');
  const [busy,  setBusy]  = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const hash = await sha256Hex(pw);
      if (hash === LOGIN_HASH) {
        setAuth(hash.slice(0, 32));
        onSuccess();
      } else {
        setError('Wrong password. Try again.');
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
          <div className="login-title">Sign in</div>
          <div className="login-sub">to continue to Portfolio Tracker</div>
        </div>
        <form className="login-form" onSubmit={submit} autoComplete="off">
          <div className="login-field">
            <label className="login-label" htmlFor="ptf-pw">Password</label>
            <input
              id="ptf-pw"
              className={'login-input' + (error ? ' err' : '')}
              type="password"
              placeholder="Enter your password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(''); }}
              autoFocus
              required
            />
            {error && <div className="login-error">{error}</div>}
          </div>
          <button className="login-btn" type="submit" disabled={busy || !pw}>
            {busy ? 'Checking…' : 'Next'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthGate({ children }) {
  const [authed, setAuthed] = React.useState(checkAuth);
  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />;
  return children;
}
