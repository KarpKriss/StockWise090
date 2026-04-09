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
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  box: {
    background: '#020617',
    padding: '20px 30px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #334155',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  text: {
    color: 'white',
    fontSize: '14px',
  },
};
