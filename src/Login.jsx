/* eslint-disable */
/* Login.jsx — password gate; renders before App if not authenticated */

// Change this to whatever password you prefer.
const LOGIN_PASSWORD = 'world';
const AUTH_KEY = 'ptf_auth';

// Derive a stable, deterministic portfolio ID from the password so every device
// that knows the password always points to the same Supabase row.
(function () {
  const stableId = btoa('ptf:' + LOGIN_PASSWORD).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (window.Store) Store.setPrimaryId(stableId);
})();

function checkAuth() { return sessionStorage.getItem(AUTH_KEY) === '1'; }
function setAuth()   { sessionStorage.setItem(AUTH_KEY, '1'); }
function clearAuth() { sessionStorage.removeItem(AUTH_KEY); }

window._ptfLogout = function () {
  clearAuth();
  window.location.reload();
};

function LoginPage({ onSuccess }) {
  const [pw,    setPw]    = React.useState('');
  const [error, setError] = React.useState('');
  const [busy,  setBusy]  = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      if (pw === LOGIN_PASSWORD) {
        setAuth();
        onSuccess();
      } else {
        setError('Wrong password. Try again.');
        setPw('');
      }
      setBusy(false);
    }, 320);
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
