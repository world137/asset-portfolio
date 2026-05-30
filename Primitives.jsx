/* eslint-disable */
// Primitives — Button, Input, Field, Toggle, Checkbox, Radio, Segmented, Badge, Tag, Banner, Modal, Icon

const Icon = ({ name, size = 16, stroke = 1.6, style }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'search':    return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
    case 'plus':      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check':     return <svg {...props}><path d="M20 6L9 17l-5-5"/></svg>;
    case 'x':         return <svg {...props}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'chev-d':    return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chev-r':    return <svg {...props}><path d="M9 18l6-6-6-6"/></svg>;
    case 'chev-l':    return <svg {...props}><path d="M15 18l-6-6 6-6"/></svg>;
    case 'more-h':    return <svg {...props}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>;
    case 'edit':      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'copy':      return <svg {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case 'archive':   return <svg {...props}><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>;
    case 'download':  return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
    case 'settings':  return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.96l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'list':      return <svg {...props}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case 'layers':    return <svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case 'sliders':   return <svg {...props}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
    case 'users':     return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'file':      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'workflow':  return <svg {...props}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3h12V9M12 12v3"/></svg>;
    case 'shield':    return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'bell':      return <svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
    case 'help':      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>;
    case 'dot':       return <svg {...props}><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>;
    case 'trash':     return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    case 'history':   return <svg {...props}><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>;
    case 'info':      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>;
    case 'warning':   return <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'success':   return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>;
    case 'filter':    return <svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case 'sun':       return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'moon':          return <svg {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>;
    case 'trending-down': return <svg {...props}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
    case 'log-out':       return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    default:              return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
};

const Button = ({ variant = 'secondary', size, icon, iconRight, children, onClick, disabled, style }) => (
  <button
    className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}`}
    onClick={onClick} disabled={disabled} style={style}
  >
    {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === 'sm' ? 13 : 14} />}
  </button>
);

const IconButton = ({ name, size = 16, onClick, title }) => (
  <button className="btn btn-ghost btn-icon" title={title} onClick={onClick}><Icon name={name} size={size}/></button>
);

const Field = ({ label, help, required, children, inline }) => (
  inline
    ? <div className="field-row">
        <div>
          <div className="field-label">{label}{required && <span className="req">*</span>}</div>
          {help && <div className="field-help">{help}</div>}
        </div>
        <div>{children}</div>
      </div>
    : <div className="field">
        <label className="field-label">{label}{required && <span className="req">*</span>}</label>
        {children}
        {help && <div className="field-help">{help}</div>}
      </div>
);

const Input = (props) => <input className="input" {...props} />;

const PrefixInput = ({ prefix, suffix, ...rest }) => (
  <div className={prefix ? 'with-prefix' : 'with-suffix'}>
    {prefix && <span className="adorn">{prefix}</span>}
    <input {...rest} />
    {suffix && <span className="adorn">{suffix}</span>}
  </div>
);

const Toggle = ({ on, onChange, label }) => (
  <span className={`toggle${on ? ' on' : ''}`} onClick={() => onChange && onChange(!on)}>
    <span className="track"><span className="thumb"/></span>
    {label && <span style={{ font: '400 13px/1.3 var(--font-sans)', color: 'var(--fg-1)' }}>{label}</span>}
  </span>
);

const Checkbox = ({ on, onChange, label }) => (
  <span className={`check${on ? ' on' : ''}`} onClick={() => onChange && onChange(!on)}>
    <span className="box">{on && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="square"/></svg>}</span>
    <span>{label}</span>
  </span>
);

const Radio = ({ on, onChange, label }) => (
  <span className={`radio${on ? ' on' : ''}`} onClick={() => onChange && onChange()}>
    <span className="dot"/>
    <span>{label}</span>
  </span>
);

const Segmented = ({ value, onChange, options }) => (
  <div className="segmented">
    {options.map(o => (
      <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    active:   { cls: 'badge-active',   dot: 'var(--green-600)', label: 'Active' },
    pending:  { cls: 'badge-pending',  dot: 'var(--amber-600)', label: 'Pending review' },
    declined: { cls: 'badge-declined', dot: 'var(--red-600)',   label: 'Declined' },
    draft:    { cls: 'badge-draft',    dot: 'var(--ink-400)',   label: 'Draft' },
    info:     { cls: 'badge-info',     dot: 'var(--blue-600)',  label: 'In review' },
    archived: { cls: 'badge-archived', dot: null,               label: 'Archived' },
  };
  const m = map[status] || map.draft;
  return (
    <span className={`badge ${m.cls}`}>
      {m.dot && <span className="d" style={{ background: m.dot }}/>}
      {m.label}
    </span>
  );
};

const Tag = ({ children, accent }) => <span className={`tag${accent ? ' tag-accent' : ''}`}>{children}</span>;

const Banner = ({ kind = 'info', title, children }) => {
  const iconName = { info: 'info', success: 'success', warning: 'warning', danger: 'x' }[kind];
  const stroke = { info: '#2962ab', success: '#1f7a4d', warning: '#b68a1f', danger: '#b43a3a' }[kind];
  return (
    <div className={`banner banner-${kind}`}>
      <span className="ic" style={{ color: stroke }}><Icon name={iconName} size={16}/></span>
      <div>
        <div className="b">{title}</div>
        {children && <div className="d">{children}</div>}
      </div>
    </div>
  );
};

const Modal = ({ open, onClose, title, subtitle, children, footer, width = 540 }) => {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="mh">
          <div>
            <div className="t">{title}</div>
            {subtitle && <div className="s">{subtitle}</div>}
          </div>
          <button className="x" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, action, children, padded = true }) => (
  <div className="panel">
    {(title || action) && (
      <div className="panel-h">
        <div>
          {title && <div className="t">{title}</div>}
          {subtitle && <div className="s">{subtitle}</div>}
        </div>
        {action}
      </div>
    )}
    <div className="panel-b" style={padded ? null : { padding: 0 }}>{children}</div>
  </div>
);

Object.assign(window, {
  Icon, Button, IconButton, Field, Input, PrefixInput,
  Toggle, Checkbox, Radio, Segmented,
  StatusBadge, Tag, Banner, Modal, Panel
});
