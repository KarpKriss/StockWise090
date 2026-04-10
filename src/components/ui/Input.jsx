import { useState } from 'react';

export default function Input({ label, error, ...props }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="app-field">
      {label ? <label className="app-field__label">{label}</label> : null}
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`app-input ${focused ? 'is-focused' : ''} ${error ? 'is-error' : ''}`.trim()}
      />

      {error && <span className="app-field__error">{error}</span>}
    </div>
  );
}
