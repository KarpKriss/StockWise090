import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { logEvent } from '../api/auditApi';
import {
  startSession as apiStartSession,
  endSession as apiEndSession,
  updateSessionHeartbeat,
  getActiveSession,
} from '../api/sessionApi';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState(null);
  const [processType, setProcessType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [pendingSession, setPendingSession] = useState(null);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const resumeSession = () => {
  if (!pendingSession) return;

  setSession({
    session_id: pendingSession.id,
    ...pendingSession,
  });

  setPendingSession(null);
};

  const forceLogout = async (reason = 'UNKNOWN') => {
  console.warn('FORCE LOGOUT:', reason);

  try {
    await endSession();
  } catch (e) {
    console.error('FORCE LOGOUT ERROR:', e);
  }

  window.location.href = '/login';
};
  const discardSession = async () => {
  if (!pendingSession) return;

  try {
    await apiEndSession(pendingSession.id);
  } catch (e) {
    console.error('DISCARD ERROR:', e);
  }

  setPendingSession(null);

  await startSession();
};
   const resolveConflict = async () => {
  setSessionConflict(false);
  await startSession();
  console.warn('SESSION CONFLICT RESOLVED → NEW SESSION');
};

const logoutAfterConflict = async () => {
  setSessionConflict(false);
  await forceLogout('CONFLICT');
};
  
  
  
  const handleSessionError = async (error) => {
  if (!error) return false;

  const message = error.message || '';

  if (
    message.includes('SESSION_TIMEOUT') ||
    message.includes('SESSION_NOT_ACTIVE') ||
    message.includes('SESSION_NOT_FOUND')
  ) {
    console.warn('SESSION INVALID → AUTO LOGOUT');

await forceLogout('INACTIVITY');

    return true;
  }

  return false;
};

  /**
   * 🔥 INIT (WAIT FOR FULL USER + RECOVERY + AUTO START)
   */
  useEffect(() => {
    // 🛑 czekamy aż auth się załaduje
    if (authLoading) return;
    if (initialized) return;

    // 🛑 brak usera → brak sesji
    if (!user || !user.id || !user.site_id) {
  console.warn('NO USER → CLEAR SESSION');

  setSession(null);
  setLoading(false);

  return;
}

    const initSession = async () => {
      try {
        console.log('SESSION INIT FOR USER:', user);

        let activeSession;

try {
  activeSession = await getActiveSession(user.id);
} catch (err) {
  const handled = await handleSessionError(err);
  if (handled) return;

  console.error('SYNC SESSION ERROR:', err);
  return;
}

        // ✅ RECOVERY
     if (activeSession && !session && !initialized) {
  console.warn('SESSION RECOVERY DETECTED');

  setPendingSession(activeSession);
  setLoading(false);
  setInitialized(true);

  return;
}


        // ✅ AUTO START
        const newSession = await apiStartSession({
          operator: user.email,
          user_id: user.id,
          role: user.role,
          site_id: user.site_id,
          device: navigator.userAgent,
        });

        setSession({
          session_id: newSession.id,
          ...newSession,
        });

        await logEvent({
        user_id: user.id,
        session_id: newSession.id,
        event_type: 'SESSION_START',
      });
      } catch (err) {
        console.error('SESSION INIT ERROR:', err);
        setSession(null);
      } finally {
  setLoading(false);
  setInitialized(true);
}
    };

    initSession();
  }, [user, authLoading]);

  useEffect(() => {
  if (!user && session) {
  console.warn('USER LOST BUT SESSION EXISTS → FORCE CLEAN');

  setSession(null);
}
}, [user]);

  /**
   * 🔥 SYNC SESSION (DB = SOURCE OF TRUTH)
   */
  const syncSession = async () => {
    if (!user || !user.id) return;

    try {
     let activeSession;

try {
  activeSession = await getActiveSession(user.id);
} catch (err) {
  const handled = await handleSessionError(err);
  if (handled) return;

  console.error('SESSION INIT ERROR:', err);
  setSession(null);
  return;
}

     if (!activeSession) {
  console.warn('SESSION INVALID → FORCE LOGOUT');

  await forceLogout('SESSION_LOST');
  return;

}

      // 🔁 takeover
     if (!pendingSession && activeSession.id !== session?.session_id) {
  console.warn('SESSION CONFLICT DETECTED');

  setSession(null);
  setSessionConflict(true);

  return;
}
    } catch (err) {
      console.error('SYNC SESSION ERROR:', err);
    }
  };

  /**
   * 🔥 HEARTBEAT
   */
  useEffect(() => {
   const activeSessionId = session?.session_id || pendingSession?.id;

if (!activeSessionId) return;

    const interval = setInterval(async () => {
      try {
        try {
 await updateSessionHeartbeat(activeSessionId);
setLastActivity(Date.now());
  await syncSession();
} catch (err) {
  const handled = await handleSessionError(err);
  if (!handled) {
    console.error('HEARTBEAT ERROR:', err);
  }
}
      } catch (err) {
        console.error('HEARTBEAT ERROR:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
 }, [session?.session_id, pendingSession?.id]);

  useEffect(() => {
  const updateActivity = () => {
    setLastActivity(Date.now());
  };

  window.addEventListener('click', updateActivity);
  window.addEventListener('keydown', updateActivity);
  window.addEventListener('touchstart', updateActivity);

  return () => {
    window.removeEventListener('click', updateActivity);
    window.removeEventListener('keydown', updateActivity);
    window.removeEventListener('touchstart', updateActivity);
  };
}, []);
  useEffect(() => {
  console.log('INACTIVITY CHECK:', {
  lastActivity,
  inactivityTime: Date.now() - lastActivity,
});
  const activeSessionId = session?.session_id || pendingSession?.id;

if (!activeSessionId) return;

  const interval = setInterval(async () => {
    const now = Date.now();
    const inactivityTime = now - lastActivity;

    const MAX_INACTIVITY = 5 * 60 * 1000; // 5 min

  if (inactivityTime > MAX_INACTIVITY) {
  console.warn('AUTO LOGOUT - INACTIVITY');

  await forceLogout('INACTIVITY');
}
  }, 10000);

  return () => clearInterval(interval);
}, [session?.session_id, pendingSession?.id, lastActivity]);

  useEffect(() => {
  const handleVisibility = async () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      const inactivityTime = now - lastActivity;

      const MAX_INACTIVITY = 5 * 60 * 1000;

      console.warn('TAB RETURN CHECK:', inactivityTime);

      if (inactivityTime > MAX_INACTIVITY) {
        await forceLogout('TAB_INACTIVE_TIMEOUT');
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [lastActivity]);
  /**
   * 🔥 MANUAL START
   */
  const startSession = async (type = null) => {
    setProcessType(type);
    if (!user || !user.id) return;

    try {
      const newSession = await apiStartSession({
        operator: user.email,
        user_id: user.id,
        role: user.role,
        site_id: user.site_id,
        device: navigator.userAgent,
      });

      setSession({
  session_id: newSession.id,
  ...newSession,
});

await logEvent({
  user_id: user.id,
  session_id: newSession.id,
  event_type: 'SESSION_START',
});
      
    } catch (err) {
      console.error('START SESSION ERROR:', err);
    }
  };

  /**
   * 🔥 END SESSION
   */
  const endSession = async () => {
    if (!session) return;

    try {
      await apiEndSession(session.session_id);
       await logEvent({
      user_id: user.id,
      session_id: session.session_id,
      event_type: 'SESSION_END',
    });
      setSession(null);
      setProcessType(null);
    } 
    
    catch (err) {
      console.error('END SESSION ERROR:', err);
    }
  };

  const isActive = !!session;

  return (
    <SessionContext.Provider
      value={{
  session,
  startSession,
  endSession,
  isActive,
  loading,

  pendingSession,
  setPendingSession,

  sessionConflict,
  setSessionConflict,

  resumeSession,
  discardSession,

  resolveConflict,
  logoutAfterConflict,

  processType,
  setProcessType,
}}
    >
      {children}
    </SessionContext.Provider>
  );

  
}



export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}
