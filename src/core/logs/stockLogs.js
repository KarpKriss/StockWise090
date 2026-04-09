import { supabase } from "../api/supabaseClient";

export async function logStockImport(recordsCount) {
  const { data: userData, error: userError } = await supabase.auth.getUser();

if (userError) {
  console.error("USER ERROR:", userError);
}

const { error: insertError } = await supabase
  .from("import_logs")
  .insert({
    records_count: recordsCount,
    user_id: userData?.user?.id,
    created_at: new Date().toISOString()
  });

if (insertError) {
  console.error("LOG ERROR:", insertError);
}
  }

