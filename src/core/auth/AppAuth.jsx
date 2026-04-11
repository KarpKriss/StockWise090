import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { logEvent } from "../api/auditApi";

const AuthContext = createContext(null);
const AUTH_CACHE_KEY = "stockwise-auth-user";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfileWithRetry(authUser, attempt = 1) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), 12000)
  );

  try {
    const result = await Promise.race([
      supabase
        .from("profiles")
        .select("user_id, role, site_id, status, lock_until")
        .eq("user_id", authUser.id)
        .maybeSingle(),
      timeout,
    ]);

    if (result.error || !result.data) {
      throw result.error || new Error("PROFILE_NOT_FOUND");
    }

    return result.data;
  } catch (error) {
    if (attempt >= 4) {
      throw error;
    }

    await sleep(750 * attempt);
    return fetchProfileWithRetry(authUser, attempt + 1);
  }
}

function buildUser(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    role: profile.role,
    site_id: profile.site_id,
    status: profile.status,
  };
}

function readCachedUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("AUTH CACHE READ ERROR:", error);
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("AUTH CACHE WRITE ERROR:", error);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(true);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
    writeCachedUser(user);
  }, [user]);

  const applyAuthUser = async (authUser) => {
    try {
      const profile = await fetchProfileWithRetry(authUser);

      if (profile.status !== "active") {
        await supabase.auth.signOut();
        setUser(null);
        writeCachedUser(null);
        return false;
      }

      const lockUntil = profile.lock_until
        ? new Date(profile.lock_until).getTime()
        : null;

      if (lockUntil && lockUntil > Date.now()) {
        await supabase.auth.signOut();
        setUser(null);
        writeCachedUser(null);
        return false;
      }

      const nextUser = buildUser(authUser, profile);
      setUser(nextUser);
      return true;
    } catch (error) {
      console.error("PROFILE FETCH ERROR:", error);

      const currentUser = userRef.current;
      const cachedUser = readCachedUser();
      const safeFallback =
        (currentUser && currentUser.id === authUser?.id && currentUser.status === "active"
          ? currentUser
          : null) ||
        (cachedUser && cachedUser.id === authUser?.id && cachedUser.status === "active"
          ? cachedUser
          : null);

      if (safeFallback) {
        setUser(safeFallback);
        return true;
      }

      return false;
    }
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!active) return;

        if (data?.session?.user) {
          const applied = await applyAuthUser(data.session.user);

          if (!applied) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return;

        if (!session && event !== "INITIAL_SESSION") {
          setUser(null);
          window.location.href = "/login";
          return;
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          window.location.href = "/login";
          return;
        }

        if (session?.user) {
          const applied = await applyAuthUser(session.user);

          if (!applied && !userRef.current) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const { data: failData } = await supabase.rpc("login_full", {
          p_email: email,
          p_success: false,
        });

        const failResult = Array.isArray(failData)
          ? failData[0]
          : failData?.login_full || failData;

        if (failResult?.code === "LOCKED") {
          return { success: false, message: "Konto zablokowane" };
        }

        return {
          success: false,
          message: `Nieprawidłowe dane. Pozostało prób: ${failResult?.remaining ?? "?"}`,
        };
      }

      await logEvent({
        user_id: data.user.id,
        session_id: null,
        event_type: "LOGIN",
      });

      await supabase
        .from("profiles")
        .update({
          login_attempts: 0,
          lock_until: null,
        })
        .eq("user_id", data.user.id);

      const applied = await applyAuthUser(data.user);

      if (!applied) {
        return {
          success: false,
          message: "Konto nieaktywne lub zablokowane",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      return { success: false, message: "Błąd systemu" };
    }
  };

  const logout = async () => {
    try {
      await logEvent({
        user_id: user?.id || null,
        session_id: null,
        event_type: "LOGOUT",
      });
    } catch (error) {
      console.error("LOGOUT AUDIT ERROR:", error);
    } finally {
      await supabase.auth.signOut();
      setUser(null);
      writeCachedUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
