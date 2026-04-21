import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AppAuth";
import { logEvent } from "../api/auditApi";
import {
  startSession as apiStartSession,
  endSession as apiEndSession,
  pauseSession as apiPauseSession,
  resumePausedSession as apiResumePausedSession,
  updateSessionHeartbeat,
  getActiveSession,
} from "../api/sessionApi";

const SessionContext = createContext(null);
const MAX_INACTIVITY = 5 * 60 * 1000;

export function SessionProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState(null);
  const [processType, setProcessType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [pendingSession, setPendingSession] = useState(null);
  const [sessionConflict, setSessionConflict] = useState(false);

  const activeSessionId = session?.session_id || null;

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      if (authLoading) return;

      if (!user?.id || !user?.site_id) {
        setSession(null);
        setPendingSession(null);
        setProcessType(null);
        setSessionConflict(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
          const active = await getActiveSession(user.id, user.site_id);

        if (cancelled) return;

        if (active) {
          setPendingSession(active);
          setSession(null);
        } else {
          setPendingSession(null);
          setSession(null);
        }
      } catch (error) {
        console.error("SESSION INIT ERROR:", error);
        if (!cancelled) {
          setSession(null);
          setPendingSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      initSession();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id, user?.site_id, authLoading]);

  useEffect(() => {
    const markActivity = () => setLastActivity(Date.now());

    window.addEventListener("click", markActivity);
    window.addEventListener("keydown", markActivity);
    window.addEventListener("touchstart", markActivity);

    return () => {
      window.removeEventListener("click", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("touchstart", markActivity);
    };
  }, []);

  const endSession = async () => {
    if (!session?.session_id) return;

    try {
      await apiEndSession(session.session_id);
      await logEvent({
        user_id: user?.id || null,
        session_id: session.session_id,
        event_type: "SESSION_END",
      });
    } catch (error) {
      console.error("END SESSION ERROR:", error);
    } finally {
      setSession(null);
      setProcessType(null);
    }
  };

  const forceLogout = async (reason = "UNKNOWN") => {
    console.warn("FORCE LOGOUT:", reason);
    await endSession();
    window.location.href = "/login";
  };

  const startSession = async (type = null) => {
    setProcessType(type);

    if (!user?.id) return null;

    if (session?.session_id) {
      return session;
    }

    try {
      const newSession = await apiStartSession({
        operator: user.email,
        user_id: user.id,
        role: user.role,
        site_id: user.site_id,
        device: navigator.userAgent,
      });

      const normalized = {
        session_id: newSession.id,
        operations: [],
        ...newSession,
      };

      setSession(normalized);
      setPendingSession(null);

      await logEvent({
        user_id: user.id,
        session_id: newSession.id,
        event_type: "SESSION_START",
      });

      return normalized;
    } catch (error) {
      console.error("START SESSION ERROR:", error);
      throw error;
    }
  };

  const resumeSession = async () => {
    if (!pendingSession) return;

    try {
      const shouldResumeInDb =
        String(pendingSession.status || "").toLowerCase() === "paused";

      const nextSession = shouldResumeInDb
        ? await apiResumePausedSession(pendingSession.id)
        : pendingSession;

      setSession({
        session_id: nextSession.id,
        operations: [],
        ...nextSession,
      });
      setPendingSession(null);
    } catch (error) {
      console.error("RESUME SESSION ERROR:", error);
      throw error;
    }
  };

  const discardSession = async () => {
    if (!pendingSession) return;

    try {
      await apiEndSession(pendingSession.id);
    } catch (error) {
      console.error("DISCARD SESSION ERROR:", error);
    } finally {
      setPendingSession(null);
      setSession(null);
      setProcessType(null);
    }
  };

  const resolveConflict = async () => {
    setSessionConflict(false);
    setSession(null);
    setPendingSession(null);
    await startSession(processType);
  };

  const logoutAfterConflict = async () => {
    setSessionConflict(false);
    await forceLogout("CONFLICT");
  };

  const pauseSession = async () => {
    if (!session?.session_id) return;

    try {
      const paused = await apiPauseSession(session.session_id);

      setPendingSession(paused || {
        ...session,
        id: session.session_id,
        status: "paused",
      });
      setSession(null);
      setProcessType(null);
    } catch (error) {
      console.error("PAUSE SESSION FLOW ERROR:", error);
      throw error;
    }
  };

  const addOperation = (operation) => {
    setSession((current) => {
      if (!current) return current;

      return {
        ...current,
        operations: [...(current.operations || []), operation],
      };
    });
  };

  useEffect(() => {
    if (!activeSessionId || !user?.id) return undefined;

    const interval = setInterval(async () => {
      try {
        await updateSessionHeartbeat(activeSessionId);

        const latest = await getActiveSession(user.id, user.site_id);

        if (!latest) {
          await forceLogout("SESSION_LOST");
          return;
        }

        if (session?.session_id && latest.id !== session.session_id) {
          setSession(null);
          setSessionConflict(true);
        }
      } catch (error) {
        console.error("HEARTBEAT ERROR:", error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeSessionId, user?.id, session?.session_id]);

  useEffect(() => {
    if (!activeSessionId) return undefined;

    const interval = setInterval(async () => {
      if (Date.now() - lastActivity > MAX_INACTIVITY) {
        await forceLogout("INACTIVITY");
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeSessionId, lastActivity]);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible" || !activeSessionId) return;

      if (Date.now() - lastActivity > MAX_INACTIVITY) {
        await forceLogout("TAB_TIMEOUT");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeSessionId, lastActivity]);

  const value = useMemo(
    () => ({
      session,
      startSession,
      endSession,
      pauseSession,
      isActive: Boolean(session?.session_id),
      loading,
      pendingSession,
      sessionConflict,
      resumeSession,
      discardSession,
      resolveConflict,
      logoutAfterConflict,
      processType,
      setProcessType,
      addOperation,
    }),
    [session, loading, pendingSession, sessionConflict, processType]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }

  return context;
}
