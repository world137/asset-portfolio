/* eslint-disable */
/* Login.jsx — login gate; renders before App if not authenticated */

// Change this password to whatever you want.
const LOGIN_PASSWORD = 'world';
const AUTH_KEY = 'ptf_auth';

function checkAuth() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}
function setAuth() {
  sessionStorage.setItem(AUTH_KEY, '1');
}
function clearAuth() {
  sessionStorage.removeItem(AUTH_KEY);
}

// Expose so App can call clearAuth on logout
window._ptfLogout = function () {
  clearAuth();
  window.location.reload();
};

function LoginPage({ onSuccess }) {
  const [pw, setPw] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      if (pw === LOGIN_PASSWORD) {
        setAuth();
        onSuccess();
      } else {
        setError('Incorrect password.');
        setPw('');
      }
      setBusy(false);
    }, 320); // tiny delay feels more deliberate
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
            </svg>
          </span>
          <div>
            <div className="login-title">Portfolio</div>
            <div className="login-sub">Asset Tracker</div>
          </div>
        </div>

        <form className="login-form" onSubmit={submit} autoComplete="off">
          <label className="login-label" htmlFor="ptf-pw">Password</label>
          <input
            id="ptf-pw"
            className={'login-input' + (error ? ' err' : '')}
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(''); }}
            autoFocus
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button className="login-btn" type="submit" disabled={busy || !pw}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Root-level auth wrapper — replaces the direct ReactDOM.createRoot call in app.jsx
function AuthGate({ children }) {
  const [authed, setAuthed] = React.useState(checkAuth);
  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }
  return children;
}
