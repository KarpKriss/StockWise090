import { supabase } from './supabaseClient';

/**
 * 🔥 ATOMIC ENTRY SAVE (DB controlled)
 */
export async function saveEntry(payload) {
  if (!payload.session_id) {
    throw new Error('Brak session_id');
  }

  const { data, error } = await supabase.rpc('insert_entry', {
    payload, // 🔥 kluczowa zmiana
  });

  if (error) {
    console.error('ENTRY ERROR:', error);

    if (error.message.includes('SESSION_NOT_ACTIVE')) {
      throw new Error('Sesja wygasła');
    }

    throw new Error('Błąd zapisu operacji');
  }

  return data;
}

/**
 * 🔥 FETCH (bez zmian – read-only)
 */
export async function fetchEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}
