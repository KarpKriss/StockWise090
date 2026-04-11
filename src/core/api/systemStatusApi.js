import { supabase } from "./supabaseClient";

export async function fetchSystemStatus() {
  const summaryResult = await supabase.rpc("get_admin_system_health_summary");
  const alertsResult = await supabase.rpc("get_admin_system_health_alerts");

  if (!summaryResult.error && !alertsResult.error) {
    const summaryRow = Array.isArray(summaryResult.data)
      ? summaryResult.data[0]
      : summaryResult.data;

    return {
      source: "rpc",
      summary: summaryRow || null,
      alerts: Array.isArray(alertsResult.data) ? alertsResult.data : [],
    };
  }

  const { data, error } = await supabase
    .from("system_status")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("SYSTEM STATUS RPC ERROR:", summaryResult.error || alertsResult.error);
    console.error("SYSTEM STATUS FALLBACK ERROR:", error);
    throw new Error("Nie udalo sie pobrac statusu systemu");
  }

  return {
    source: "fallback",
    summary: data
      ? {
          overall_status: String(data.overall_status || data.status || "warning").toLowerCase(),
          overall_label: data.overall_label || data.label || "Status niepelny",
          database_status: data.database_status || "connected",
          active_users: Number(data.active_users || 0),
          active_sessions: Number(data.active_sessions || 0),
          paused_sessions: Number(data.paused_sessions || 0),
          in_progress_locations: Number(data.in_progress_locations || 0),
          stale_sessions: Number(data.stale_sessions || 0),
          stale_locations: Number(data.stale_locations || 0),
          unresolved_issues: Number(data.unresolved_issues || 0),
          recent_entries_1h: Number(data.recent_entries_1h || 0),
          locked_accounts: Number(data.locked_accounts || 0),
          users_without_role: Number(data.users_without_role || 0),
          generated_at: data.generated_at || new Date().toISOString(),
        }
      : null,
    alerts: [],
  };
}
