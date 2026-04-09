import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { logEvent } from '../api/auditApi';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * 🔥 INIT SESSION CHECK
   */
  useEffect(() => {
  console.log('🚀 AUTH INIT START');

 const fetchUserProfile = async (authUser) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), 5000)
  );

  try {
    const result = await Promise.race([
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single(),
      timeout,
    ]);

    const { data: profile, error } = result;

    console.log('📦 PROFILE RESULT:', { profile, error });

    if (error || !profile) {
      console.error('❌ PROFILE ERROR:', error);
      setUser(null);
      return;
    }
    // ⛔ BLOCK INACTIVE USER
      if (profile.status !== 'active') {
        console.error('⛔ USER INACTIVE');
      
        await supabase.auth.signOut();
      
        setUser(null);
        return;
      }

    // ⛔ CHECK LOCK
const now = Date.now();
const lockTime = profile.lock_until
  ? new Date(profile.lock_until).getTime()
  : null;

if (lockTime && lockTime > now) {
  console.error('⛔ USER LOCKED');

  await supabase.auth.signOut();

  setUser(null);
  return;
}

// ✅ OK
setUser({
  id: authUser.id,
  email: authUser.email,
  role: profile.role,
  site_id: profile.site_id,
  status: profile.status,
});

  } catch (err) {
    console.error('💥 PROFILE FETCH CRASH:', err);
    setUser(null);
  }
};

  const init = async () => {
    const { data } = await supabase.auth.getSession();

    if (data?.session?.user) {
      await fetchUserProfile(data.session.user);
    } else {
      setUser(null);
    }

    setLoading(false);
  };

  init();

const { data: listener } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    console.log('AUTH EVENT:', event);
// 🔥 SESSION LOST (TOKEN EXPIRED)
if (!session && event !== 'INITIAL_SESSION') {
  console.warn('AUTH SESSION LOST → TOKEN EXPIRED');

  setUser(null);

  window.location.href = '/login';

  return;
}
    if (event === 'SIGNED_OUT') {
  console.warn('AUTH SIGNED_OUT → FORCE LOGOUT');

  setUser(null);

  // 🔥 HARD RESET SYSTEMU
  window.location.href = '/login';

  return;
}

    if (session?.user) {
      await fetchUserProfile(session.user);
    } else {
      setUser(null);
    }
  }
);

// 🔥 CLEANUP
return () => {
  listener.subscription.unsubscribe();
};
}, []);

  /**
   * 🔥 LOGIN
   */
  const login = async (email, password) => {
    
    console.log('🚀 LOGIN FUNCTION START', { email });

    try {
      console.log('📡 CALLING SUPABASE SIGN IN');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('📡 SUPABASE RESPONSE:', { data, error });

  if (error) {
  const { data: failData } = await supabase.rpc('login_full', {
    p_email: email,
    p_success: false,
  });

  const failResult = Array.isArray(failData)
    ? failData[0]
    : failData?.login_full || failData;

  if (failResult?.code === 'LOCKED') {
    return {
      success: false,
      message: 'Konto zablokowane',
    };
  }

  return {
    success: false,
    message: `Nieprawidłowe dane. Pozostało prób: ${failResult?.remaining ?? '?'}`,
  };
}

      console.log('✅ LOGIN SUCCESS - SESSION:', data);

      await logEvent({
  user_id: data.user.id,
  session_id: null,
  event_type: 'LOGIN',
});

      await supabase
  .from('profiles')
  .update({
    login_attempts: 0,
    lock_until: null,
  })
  .eq('user_id', data.user.id);

      /**
       * 🔍 CHECK SESSION AFTER LOGIN
       */
      const { data: sessionData } = await supabase.auth.getSession();

      console.log('🔍 SESSION AFTER LOGIN:', sessionData);

return { success: true };

    } catch (err) {
      console.log('💥 LOGIN CRASH:', err);
      return {
        success: false,
        message: 'Błąd systemu',
      };
    }
  };

  /**
   * 🔥 LOGOUT
   */
  const logout = async () => {
    console.log('🚪 LOGOUT START');

    const currentUserId = user?.id;

await logEvent({
  user_id: currentUserId,
  session_id: null,
  event_type: 'LOGOUT',
});

await supabase.auth.signOut();

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
