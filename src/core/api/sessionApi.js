import { supabase } from './supabaseClient';

/**
 * INTERNAL: cleanup inactive sessions
 */
async function cleanupSessions() {
  const { error } = await supabase.rpc('close_inactive_sessions');

  if (error) {
    console.error('CLEANUP ERROR:', error);

    // Nie blokujemy operatora, jesli globalny cleanup starych sesji timeoutuje.
    // Start procesu i tak zamyka aktywne sesje biezacego uzytkownika osobnym krokiem.
    if (
      error.code === '57014' ||
      error.message?.includes('statement timeout')
    ) {
      return;
    }

    throw new Error('Blad czyszczenia sesji');
  }
}

/**
 * START SESSION (DB-first, bez race condition)
 */
export async function startSession(payload) {
  await cleanupSessions();

  const { error: closeError } = await supabase
    .from('sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
    })
    .eq('user_id', payload.user_id)
    .in('status', ['active', 'ACTIVE', 'paused', 'PAUSED']);

  if (closeError) {
    console.error('CLOSE OLD SESSION ERROR:', closeError);
    throw new Error('Blad zamykania starej sesji');
  }

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
    throw new Error('Blad rozpoczecia sesji');
  }

  return data;
}

/**
 * END SESSION (safe)
 */
export async function endSession(session_id) {
  await cleanupSessions();

  const rpcResult = await supabase.rpc('end_work_session', {
    p_session_id: session_id,
  });

  if (!rpcResult.error) {
    return { success: true };
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', session_id)
    .in('status', ['active', 'ACTIVE', 'paused', 'PAUSED']);

  if (error) {
    console.error('END SESSION ERROR:', error);
    throw new Error('Blad zamkniecia sesji');
  }

  return { success: true };
}

export async function pauseSession(session_id) {
  const { data, error } = await supabase.rpc('pause_work_session', {
    p_session_id: session_id,
  });

  if (!error) {
    return data;
  }

  const fallback = await supabase
    .from('sessions')
    .update({
      status: 'paused',
      last_activity: new Date().toISOString(),
    })
    .eq('id', session_id)
    .in('status', ['active', 'ACTIVE'])
    .select()
    .maybeSingle();

  if (fallback.error) {
    console.error('PAUSE SESSION ERROR:', error || fallback.error);
    throw new Error('Blad pauzowania sesji');
  }

  return fallback.data;
}

export async function resumePausedSession(session_id) {
  const { data, error } = await supabase.rpc('resume_work_session', {
    p_session_id: session_id,
  });

  if (!error) {
    return data;
  }

  const fallback = await supabase
    .from('sessions')
    .update({
      status: 'active',
      last_activity: new Date().toISOString(),
    })
    .eq('id', session_id)
    .in('status', ['paused', 'PAUSED'])
    .select()
    .maybeSingle();

  if (fallback.error) {
    console.error('RESUME SESSION ERROR:', error || fallback.error);
    throw new Error('Blad wznawiania sesji');
  }

  return fallback.data;
}

/**
 * HEARTBEAT (tylko jesli session nadal active)
 */
export async function updateSessionHeartbeat(session_id) {
  const rpcResult = await supabase.rpc('touch_work_session', {
    p_session_id: session_id,
  });

  if (!rpcResult.error) {
    return { success: true };
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      last_activity: new Date().toISOString(),
    })
    .eq('id', session_id)
    .eq('status', 'active');

  if (error) {
    console.error('HEARTBEAT ERROR:', error);

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

      if (err.message === 'SESSION_TIMEOUT') {
        throw err;
      }

      if (attempt >= retries) {
        throw err;
      }

      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
}

/**
 * GET ACTIVE SESSION FROM DB (source of truth)
 */
export async function getActiveSession(user_id, site_id = null) {
  let query = supabase
    .from('sessions')
    .select('*')
    .eq('user_id', user_id)
    .in('status', ['active', 'ACTIVE', 'paused', 'PAUSED'])
    .order('started_at', { ascending: false })
    .limit(1);

  if (site_id) {
    query = query.eq('site_id', site_id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
