import { supabase } from "./supabaseClient";
import { readActiveSiteId } from "../auth/siteScope";

export async function createImportLog(type) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const activeSiteId = readActiveSiteId();

  if (authError) {
    console.error("IMPORT LOG USER ERROR:", authError);
  }

  const { error } = await supabase.from("import_logs").insert({
    user_id: authData?.user?.id || null,
    site_id: activeSiteId,
    type,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("IMPORT LOG ERROR:", error);
  }
}
