import { supabase } from "./supabaseClient";
import { applySiteFilter, readActiveSiteId } from "../auth/siteScope";
import { APP_VERSION } from "../config/appMeta";
import { checkAdminUsersBackendHealth, fetchAdminUsersList } from "./adminUsersApi";
import { fetchErrorLogs } from "./logsApi";

const DETAIL_PAGE_SIZE = 1000;
const STALE_SESSION_MINUTES = 15;

async function fetchAllRows(buildQuery, { pageSize = DETAIL_PAGE_SIZE } = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

function toTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
}

function diffMinutes(fromValue, toValue = Date.now()) {
  const timestamp = toTimestamp(fromValue);
  if (!timestamp) return null;
  return Math.max(0, Math.round((toValue - timestamp) / 60000));
}

async function fetchProfileMap(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, name, role")
    .in("user_id", ids);

  if (error) {
    console.warn("SYSTEM STATUS PROFILE LOOKUP ERROR:", error);
    return new Map();
  }

  return new Map((data || []).map((row) => [row.user_id, row]));
}

async function fetchLocationMap(locationIds = [], siteId = readActiveSiteId()) {
  const ids = [...new Set((locationIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const data = await fetchAllRows(() =>
    applySiteFilter(
      supabase
        .from("locations")
        .select("id, code, zone, status, locked_by, locked_at, session_id")
        .in("id", ids),
      siteId
    )
  );

  return new Map((data || []).map((row) => [row.id, row]));
}

export async function fetchSystemStatus() {
  const activeSiteId = readActiveSiteId();
  const summaryResult = await supabase.rpc("get_admin_system_health_summary");
  const alertsResult = await supabase.rpc("get_admin_system_health_alerts");

  const [importLogsResult, totalUsersResult, adminUsersEdgeHealth, errorLogs] = await Promise.all([
    applySiteFilter(
      supabase
      .from("import_logs")
      .select("id, user_id, type, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
      activeSiteId
    ),
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

export async function fetchSystemStatusDetails(metricKey, siteId = readActiveSiteId()) {
  const activeSiteId = siteId;
  const now = Date.now();

  if (metricKey === "locations_in_progress" || metricKey === "stale_locations") {
    const locations = await fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("locations")
          .select("id, code, zone, status, locked_by, locked_at, session_id")
          .eq("status", "in_progress")
          .order("locked_at", { ascending: true, nullsFirst: false }),
        activeSiteId
      )
    );

    const userIds = locations.map((row) => row.locked_by).filter(Boolean);
    const sessionIds = locations.map((row) => row.session_id).filter(Boolean);
    const [profileMap, sessions] = await Promise.all([
      fetchProfileMap(userIds),
      sessionIds.length
        ? fetchAllRows(() =>
            applySiteFilter(
              supabase
                .from("sessions")
                .select("id, status, started_at, ended_at, last_activity, operator, user_id")
                .in("id", sessionIds),
              activeSiteId
            )
          )
        : Promise.resolve([]),
    ]);
    const sessionMap = new Map((sessions || []).map((row) => [row.id, row]));

    const rows = (locations || []).map((row) => {
      const session = sessionMap.get(row.session_id) || null;
      const profile = profileMap.get(row.locked_by) || profileMap.get(session?.user_id) || null;
      const lastSignal = session?.last_activity || row.locked_at || session?.started_at;
      const minutesOpen = diffMinutes(row.locked_at || session?.started_at, now);
      const minutesSinceSignal = diffMinutes(lastSignal, now);
      const isStale = !session || (minutesSinceSignal !== null && minutesSinceSignal >= STALE_SESSION_MINUTES);

      return {
        id: row.id,
        location_code: row.code || "-",
        zone: row.zone || "-",
        status: row.status || "-",
        operator_name: profile?.name || session?.operator || "-",
        operator_email: profile?.email || session?.operator || "-",
        session_status: session?.status || "-",
        minutes_open: minutesOpen,
        minutes_since_signal: minutesSinceSignal,
        locked_at: row.locked_at || null,
        last_activity: session?.last_activity || null,
        is_stale: isStale,
      };
    });

    return {
      metricKey,
      rows:
        metricKey === "stale_locations"
          ? rows.filter((row) => row.is_stale)
          : rows,
    };
  }

  if (metricKey === "active_sessions" || metricKey === "paused_sessions" || metricKey === "stale_sessions") {
    const sessions = await fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("sessions")
          .select("id, user_id, operator, status, started_at, ended_at, last_activity, created_at")
          .in(
            "status",
            metricKey === "paused_sessions" ? ["paused", "PAUSED"] : ["active", "ACTIVE", "paused", "PAUSED"]
          )
          .order("started_at", { ascending: false }),
        activeSiteId
      )
    );

    const profileMap = await fetchProfileMap((sessions || []).map((row) => row.user_id));

    const rows = (sessions || [])
      .map((row) => {
        const profile = profileMap.get(row.user_id) || null;
        const minutesOpen = diffMinutes(row.started_at || row.created_at, now);
        const minutesSinceSignal = diffMinutes(row.last_activity || row.started_at || row.created_at, now);
        return {
          id: row.id,
          status: row.status || "-",
          operator_name: profile?.name || row.operator || "-",
          operator_email: profile?.email || row.operator || "-",
          started_at: row.started_at || row.created_at || null,
          last_activity: row.last_activity || null,
          ended_at: row.ended_at || null,
          minutes_open: minutesOpen,
          minutes_since_signal: minutesSinceSignal,
          is_stale: ["active", "ACTIVE"].includes(String(row.status || "")) && (minutesSinceSignal !== null && minutesSinceSignal >= STALE_SESSION_MINUTES),
        };
      })
      .filter((row) => {
        if (metricKey === "paused_sessions") return String(row.status).toLowerCase() === "paused";
        if (metricKey === "stale_sessions") return row.is_stale;
        return ["active", "paused"].includes(String(row.status).toLowerCase());
      });

    return { metricKey, rows };
  }

  if (metricKey === "open_problems") {
    const { data, error } = await supabase
      .from("empty_location_issues")
      .select("id, location_id, issue_type, note, status, operator_email, created_at, source_process")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SYSTEM STATUS PROBLEMS DETAIL ERROR:", error);
      throw new Error(error.message || "Nie udalo sie pobrac szczegolow problemow");
    }

    const locationMap = await fetchLocationMap((data || []).map((row) => row.location_id), activeSiteId);

    return {
      metricKey,
      rows: (data || [])
        .filter((row) => locationMap.has(row.location_id))
        .map((row) => {
          const location = locationMap.get(row.location_id);
          return {
            id: row.id,
            location_code: location?.code || "-",
            zone: location?.zone || "-",
            issue_type: row.issue_type || "-",
            source_process: row.source_process || "-",
            operator_email: row.operator_email || "-",
            status: row.status || "-",
            created_at: row.created_at || null,
            note: row.note || "",
          };
        }),
    };
  }

  if (metricKey === "entries_last_hour") {
    const oneHourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();
    const rows = await fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("entries")
          .select("id, session_id, user_id, operator, location, sku, ean, lot, quantity, type, timestamp, created_at")
          .gte("timestamp", oneHourAgoIso)
          .order("timestamp", { ascending: false }),
        activeSiteId
      )
    );

    const profileMap = await fetchProfileMap((rows || []).map((row) => row.user_id));

    return {
      metricKey,
      rows: (rows || []).map((row) => {
        const profile = profileMap.get(row.user_id) || null;
        return {
          id: row.id,
          timestamp: row.timestamp || row.created_at || null,
          location: row.location || "-",
          sku: row.sku || "-",
          ean: row.ean || "-",
          lot: row.lot || "-",
          quantity: row.quantity ?? "-",
          type: row.type || "-",
          operator_name: profile?.name || row.operator || "-",
          operator_email: profile?.email || row.operator || "-",
          session_id: row.session_id || "-",
        };
      }),
    };
  }

  if (metricKey === "active_users") {
    const sessions = await fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("sessions")
          .select("id, user_id, operator, status, started_at, last_activity, created_at")
          .in("status", ["active", "ACTIVE"])
          .order("started_at", { ascending: false }),
        activeSiteId
      )
    );
    const groupedByUser = new Map();
    (sessions || []).forEach((row) => {
      const key = row.user_id || row.operator || row.id;
      if (!groupedByUser.has(key)) groupedByUser.set(key, []);
      groupedByUser.get(key).push(row);
    });
    const profileMap = await fetchProfileMap((sessions || []).map((row) => row.user_id));

    return {
      metricKey,
      rows: [...groupedByUser.entries()].map(([key, items]) => {
        const first = items[0];
        const profile = profileMap.get(first.user_id) || null;
        return {
          id: key,
          operator_name: profile?.name || first.operator || "-",
          operator_email: profile?.email || first.operator || "-",
          active_sessions: items.length,
          last_activity: items[0]?.last_activity || items[0]?.started_at || null,
        };
      }),
    };
  }

  if (metricKey === "locked_accounts") {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, name, role, lock_until, failed_attempts, login_attempts")
      .not("lock_until", "is", null)
      .order("lock_until", { ascending: false });

    if (error) {
      console.error("SYSTEM STATUS LOCKED ACCOUNTS DETAIL ERROR:", error);
      throw new Error(error.message || "Nie udalo sie pobrac szczegolow zablokowanych kont");
    }

    return { metricKey, rows: data || [] };
  }

  return { metricKey, rows: [] };
}
