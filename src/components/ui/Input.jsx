import { useState } from 'react';

export default function Input({ label, error, ...props }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={styles.wrapper}>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...styles.input,
          ...(focused ? styles.focus : {}),
          ...(error ? styles.errorInput : {}),
        }}
      />

      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    background: 'white',
    color: '#1f2937',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },

  focus: {
    border: '1px solid #2563eb',
    boxShadow: '0 0 0 3px rgba(37,99,235,0.1)',
  },

  errorInput: {
    border: '1px solid #dc2626',
  },

  error: {
    fontSize: '12px',
    color: '#dc2626',
    fontWeight: '500',
  },
};
