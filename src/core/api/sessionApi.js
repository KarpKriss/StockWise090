import { supabase } from './supabaseClient';

/**
 * 🔥 INTERNAL: cleanup inactive sessions
 */
async function cleanupSessions() {
  const { error } = await supabase.rpc('close_inactive_sessions');

  if (error) {
    console.error('CLEANUP ERROR:', error);
    throw new Error('Błąd czyszczenia sesji');
  }
}

/**
 * 🔥 START SESSION (DB-first, bez race condition)
 */
export async function startSession(payload) {
  // 1. zamknij martwe sesje
  await cleanupSessions();

  // 2. zamknij aktywne sesje usera (TAKEOVER)
  const { error: closeError } = await supabase
    .from('sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
    })
    .eq('user_id', payload.user_id)
    .eq('status', 'active');

  if (closeError) {
    console.error('CLOSE OLD SESSION ERROR:', closeError);
    throw new Error('Błąd zamykania starej sesji');
  }

  // 3. utwórz nową sesję
  const { data, error } = await supabase
    .from('sessions')
    .insert([
      {
        ...payload,
        status: 'active',
        started_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('START SESSION ERROR:', error);
    throw new Error('Błąd rozpoczęcia sesji');
  }

  return data;
}

/**
 * 🔥 END SESSION (safe)
 */
export async function endSession(session_id) {
  await cleanupSessions();

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('status', 'active'); // 🔥 tylko aktywna

  if (error) {
    console.error('END SESSION ERROR:', error);
    throw new Error('Błąd zamknięcia sesji');
  }

  return { success: true };
}

/**
 * 🔥 HEARTBEAT (tylko jeśli session nadal active)
 */
export async function updateSessionHeartbeat(session_id) {
  const { error } = await supabase
    .from('sessions')
    .update({
      last_activity: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('status', 'active'); // 🔥 kluczowe

  if (error) {
  console.error('HEARTBEAT ERROR:', error);

  // 🔥 rozróżniamy typ błędu
  if (error.message?.includes('SESSION_TIMEOUT')) {
    throw new Error('SESSION_TIMEOUT');
  }

  throw new Error('HEARTBEAT_FAILED');
}

  return { success: true };
}

export async function heartbeatWithRetry(session_id, retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await updateSessionHeartbeat(session_id);
    } catch (err) {
      attempt++;

      console.warn(`HEARTBEAT RETRY ${attempt}`, err.message);

      // 🔥 jeśli session padła → NIE retry
      if (err.message === 'SESSION_TIMEOUT') {
        throw err;
      }

      // 🔥 ostatnia próba → wywalamy
      if (attempt >= retries) {
        throw err;
      }

      // 🔥 backoff (1s, 2s, 3s)
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
}
/**
 * 🔥 GET ACTIVE SESSION FROM DB (source of truth)
 */
export async function getActiveSession(user_id) {
  await cleanupSessions();

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    return null; // brak aktywnej sesji = OK
  }

  return data;
}
