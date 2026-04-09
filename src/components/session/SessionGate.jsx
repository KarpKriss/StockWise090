import { useSession } from '../../core/session/AppSession';

export default function SessionGate({ children }) {
  const {
    pendingSession,
    sessionConflict,
    resumeSession,
    discardSession,
    resolveConflict,
    logoutAfterConflict,
  } = useSession();

  // 🔵 RECOVERY SCREEN
  if (pendingSession) {
    return (
      <div style={styles.fullscreen}>
        <h2>Wykryto niedokończoną sesję</h2>

        <p>
          Sesja rozpoczęta: {new Date(pendingSession.created_at).toLocaleString()}
        </p>

        <p>
          Urządzenie: {pendingSession.device}
        </p>

        <div style={styles.actions}>
          <button onClick={resumeSession}>
            Wznów sesję
          </button>

          <button onClick={discardSession}>
            Zamknij i rozpocznij nową
          </button>
        </div>
      </div>
    );
  }

  // 🔴 CONFLICT MODAL
  if (sessionConflict) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <h2>Sesja aktywna na innym urządzeniu</h2>

          <p>
            Twoje konto zostało użyte gdzie indziej.
          </p>

          <div style={styles.actions}>
            <button onClick={resolveConflict}>
              Przejmij sesję
            </button>

            <button onClick={logoutAfterConflict}>
              Wyloguj
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

const styles = {
  fullscreen: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    background: 'white',
    padding: '24px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
};
