import { supabase } from "./supabaseClient";

function normalizeCorrectionRow(row, profileMap) {
  const profile = profileMap.get(row.user_id) || null;

  return {
    ...row,
    user_name: profile?.name || profile?.email || row.user_id || "BRAK",
    user_email: profile?.email || null,
    comment: row.comment || null,
  };
}

export async function fetchCorrectionRowsWithProblems() {
  const correctionsResult = await supabase
    .from("correction_log")
    .select("id, entry_id, user_id, reason, comment, old_value, new_value, created_at")
    .order("created_at", { ascending: false });

  if (correctionsResult.error) {
    console.error("FETCH CORRECTIONS ERROR:", correctionsResult.error);
    throw new Error("Blad pobierania historii korekt");
  }

  const userIds = [...new Set((correctionsResult.data || []).map((row) => row.user_id).filter(Boolean))];

  const profilesResult = userIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, email, name")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    console.error("FETCH CORRECTION USERS ERROR:", profilesResult.error);
    throw new Error("Blad pobierania operatorow korekt");
  }

  const profileMap = new Map((profilesResult.data || []).map((row) => [row.user_id, row]));

  return (correctionsResult.data || []).map((row) => normalizeCorrectionRow(row, profileMap));
}
