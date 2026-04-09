import { useState } from 'react';

export default function Button({ children, loading, ...props }) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...styles.button,
        ...(pressed ? styles.pressed : {}),
        ...(loading ? styles.disabled : {}),
      }}
    >
      {loading ? 'Logowanie...' : children}
    </button>
  );
}

const styles = {
  button: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#2563eb',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '14px',
    letterSpacing: '-0.3px',
  },

  pressed: {
    transform: 'scale(0.98)',
    opacity: 0.9,
  },

  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
