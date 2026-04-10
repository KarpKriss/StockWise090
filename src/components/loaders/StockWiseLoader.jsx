export default function StockWiseLoader() {
  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <div style={styles.spinner}></div>
        <span style={styles.text}>Logowanie...</span>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },

  box: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,246,255,0.96))',
    padding: '18px 24px',
    borderRadius: '22px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 20px 40px rgba(84, 98, 140, 0.18)',
    border: '1px solid rgba(84, 98, 140, 0.12)',
  },

  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(109, 94, 252, 0.22)',
    borderTop: '3px solid #6d5efc',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  text: {
    color: '#15244f',
    fontSize: '14px',
    fontWeight: 700,
  },
};
