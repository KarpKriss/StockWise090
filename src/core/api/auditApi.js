import { supabase } from './supabaseClient';

export const logEvent = async ({
  user_id,
  session_id,
  event_type,
}) => {
  try {
    await supabase.rpc('log_event', {
      p_user_id: user_id,
      p_session_id: session_id || null,
      p_event_type: event_type,
      p_device: navigator.platform,
      p_user_agent: navigator.userAgent,
    });
  } catch (err) {
    console.error('AUDIT LOG ERROR:', err);
  }
};
