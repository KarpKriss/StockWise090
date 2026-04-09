import { supabase } from './supabaseClient';

/**
 * 🔍 FETCH PROFILE BY ID (po loginie)
 */
export async function fetchUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('FETCH PROFILE:', { data, error });

    if (error) {
      console.error('FETCH ERROR:', error);
      return null;
    }

    return data;

  } catch (err) {
    console.error('FETCH CRASH:', err);
    return null;
  }
}

/**
 * 🔍 BACKEND LOGIN CHECK
 */
export const loginCheck = async (email) => {
  const { data, error } = await supabase.rpc('login_check', {
    user_email: email,
  });

  if (error) {
    console.error('LOGIN CHECK ERROR:', error);
    return null;
  }

  return data?.[0];
};

/**
 * ➕ INCREMENT ATTEMPTS (atomic)
 */
export const incrementAttempts = async (email) => {
  const { data, error } = await supabase.rpc(
    'increment_login_attempts',
    {
      user_email: email,
    }
  );

  if (error) {
    console.error('INCREMENT ERROR:', error);
    return null;
  }

  return data?.[0];
};

/**
 * 🔄 RESET ATTEMPTS
 */
export const resetAttempts = async (email) => {
  const { error } = await supabase.rpc('reset_login_attempts', {
    user_email: email,
  });

  if (error) {
    console.error('RESET ERROR:', error);
  }
};