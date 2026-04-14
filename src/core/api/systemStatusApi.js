import { supabase } from "./supabaseClient";
import { APP_VERSION } from "../config/appMeta";
import { checkAdminUsersBackendHealth, fetchAdminUsersList } from "./adminUsersApi";
import { fetchErrorLogs } from "./logsApi";

export async function fetchSystemStatus() {
  const summaryResult = await supabase.rpc("get_admin_system_health_summary");
  const alertsResult = await supabase.rpc("get_admin_system_health_alerts");

  const [importLogsResult, totalUsersResult, adminUsersEdgeHealth, errorLogs] = await Promise.all([
    supabase
      .from("import_logs")
      .select("id, user_id, type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    fetchAdminUsersList().catch(() => []),
    checkAdminUsersBackendHealth(),
    fetchErrorLogs({ limit: 8 }).catch(() => []),
  ]);

  const processStatuses = [
    {
      code: "rpc_summary",
      label: "RPC health summary",
      status: !summaryResult.error && !alertsResult.error ? "connected" : "degraded",
      description: !summaryResult.error && !alertsResult.error
        ? "Funkcje zdrowia systemu odpowiadaja poprawnie."
        : "Co najmniej jedna funkcja zdrowia systemu nie zwrocila danych.",
    },
    {
      code: "admin_users_backend",
      label: "Backend admin-users",
      status: adminUsersEdgeHealth.ok ? "connected" : "degraded",
      description: adminUsersEdgeHealth.ok
        ? "Edge function administratorska jest dostepna dla create/reset/delete."
        : "Edge function administratorska nie odpowiada lub nie ma pelnej konfiguracji.",
    },
    {
      code: "import_logs",
      label: "Logi importow",
      status: importLogsResult.error ? "degraded" : "connected",
      description: importLogsResult.error
        ? "Panel nie mogl pobrac ostatnich importow danych."
        : "Logi importow sa dostepne dla administratora.",
    },
    {
      code: "client_error_logs",
      label: "Log bledow klienta",
      status: Array.isArray(errorLogs) ? "connected" : "degraded",
      description: Array.isArray(errorLogs)
        ? "Panel ma dostep do zarejestrowanych bledow aplikacyjnych."
        : "Nie udalo sie pobrac logow bledow aplikacji.",
    },
  ];

  if (!summaryResult.error && !alertsResult.error) {
    const summaryRow = Array.isArray(summaryResult.data)
      ? summaryResult.data[0]
      : summaryResult.data;

    return {
      source: "rpc",
      summary: {
        ...(summaryRow || {}),
        app_version: APP_VERSION,
        total_users: Array.isArray(totalUsersResult) ? totalUsersResult.length : 0,
        api_status: adminUsersEdgeHealth.ok ? "connected" : "degraded",
      },
      alerts: Array.isArray(alertsResult.data) ? alertsResult.data : [],
      importLogs: importLogsResult.error ? [] : importLogsResult.data || [],
      errorLogs: errorLogs || [],
      processStatuses,
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
          api_status: adminUsersEdgeHealth.ok ? "connected" : "degraded",
          app_version: APP_VERSION,
          total_users: Array.isArray(totalUsersResult) ? totalUsersResult.length : 0,
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
    importLogs: importLogsResult.error ? [] : importLogsResult.data || [],
    errorLogs: errorLogs || [],
    processStatuses,
  };
}
