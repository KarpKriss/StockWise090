import { supabase } from "./supabaseClient";
import { applySiteFilter, readActiveSiteId } from "../auth/siteScope";
import {
  buildDashboardData,
  collectDashboardYears,
} from "../utils/dashboardMetrics";

function normalizeYearMonth(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchPriceRows(siteId = readActiveSiteId()) {
  const { data, error } = await applySiteFilter(
    supabase.from("prices").select("price, products:product_id(sku)"),
    siteId
  );

  if (error) {
    throw new Error(error.message || "Blad pobierania cen");
  }

  return (data || []).map((row) => ({
    sku: row.products?.sku || null,
    price: Number(row.price || 0),
  }));
}

async function fetchDashboardBaseRows(siteId = readActiveSiteId()) {
  const [
    entriesResult,
    sessionsResult,
    locationsResult,
    issuesResult,
    priceRows,
  ] = await Promise.all([
    applySiteFilter(
      supabase
      .from("entries")
      .select("id, session_id, user_id, operator, site_id, location, sku, quantity, type, timestamp, created_at")
      .order("timestamp", { ascending: false }),
      siteId
    ),
    applySiteFilter(
      supabase
      .from("sessions")
      .select("id, user_id, operator, site_id, status, started_at, ended_at, last_activity, created_at")
      .order("started_at", { ascending: false }),
      siteId
    ),
    applySiteFilter(supabase.from("locations").select("code, zone"), siteId),
    applySiteFilter(
      supabase
      .from("empty_location_issues")
      .select("id, zone, created_at")
      .order("created_at", { ascending: false }),
      siteId
    ),
    fetchPriceRows(siteId),
  ]);

  if (entriesResult.error) {
    throw new Error(entriesResult.error.message || "Blad pobierania entries");
  }

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message || "Blad pobierania sesji");
  }

  if (locationsResult.error) {
    throw new Error(locationsResult.error.message || "Blad pobierania lokalizacji");
  }

  if (issuesResult.error) {
    throw new Error(issuesResult.error.message || "Blad pobierania problemow");
  }

  return {
    entries: entriesResult.data || [],
    sessions: sessionsResult.data || [],
    locations: locationsResult.data || [],
    issues: issuesResult.data || [],
    priceRows,
  };
}

export async function fetchDashboardFilters(siteId = readActiveSiteId()) {
  const [entriesResult, sessionsResult, issuesResult] = await Promise.all([
    applySiteFilter(supabase.from("entries").select("timestamp, created_at"), siteId),
    applySiteFilter(supabase.from("sessions").select("started_at, created_at"), siteId),
    applySiteFilter(supabase.from("empty_location_issues").select("created_at"), siteId),
  ]);

  if (entriesResult.error || sessionsResult.error || issuesResult.error) {
    throw new Error(
      entriesResult.error?.message ||
        sessionsResult.error?.message ||
        issuesResult.error?.message ||
        "Blad pobierania filtrow dashboardu"
    );
  }

  const baseRows = {
    entries: entriesResult.data || [],
    sessions: sessionsResult.data || [],
    issues: issuesResult.data || [],
  };

  return {
    years: collectDashboardYears(baseRows),
  };
}

async function fetchDashboardViaRpc(year, month) {
  const [summaryResult, zonesResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary", {
      p_year: year,
      p_month: month,
    }),
    supabase.rpc("get_dashboard_zone_stats", {
      p_year: year,
      p_month: month,
    }),
  ]);

  if (summaryResult.error || zonesResult.error) {
    throw new Error(
      summaryResult.error?.message ||
        zonesResult.error?.message ||
        "Blad pobierania dashboardu"
    );
  }

  const summary = Array.isArray(summaryResult.data)
    ? summaryResult.data[0] || {}
    : summaryResult.data || {};

  return {
    summary,
    zoneStats: Array.isArray(zonesResult.data) ? zonesResult.data : [],
    source: "rpc",
  };
}

async function fetchDashboardViaFallback(year, month, siteId = readActiveSiteId()) {
  const baseRows = await fetchDashboardBaseRows(siteId);
  const data = buildDashboardData({
    ...baseRows,
    year,
    month,
  });

  return {
    ...data,
    source: "fallback",
  };
}

export async function fetchDashboardData({ year = null, month = null } = {}) {
  const safeYear = normalizeYearMonth(year);
  const safeMonth = normalizeYearMonth(month);
  const activeSiteId = readActiveSiteId();

  if (activeSiteId) {
    return fetchDashboardViaFallback(safeYear, safeMonth, activeSiteId);
  }

  try {
    return await fetchDashboardViaRpc(safeYear, safeMonth);
  } catch (error) {
    console.warn("DASHBOARD RPC FALLBACK:", error);
    return fetchDashboardViaFallback(safeYear, safeMonth, activeSiteId);
  }
}

export async function fetchDashboardExportRows({ year = null, month = null } = {}) {
  const dashboard = await fetchDashboardData({ year, month });

  return {
    summaryRows: [
      { metric: "Liczba sprawdzonych lokalizacji", value: dashboard.summary.checked_locations },
      { metric: "Liczba operacji", value: dashboard.summary.operations_count },
      { metric: "Liczba brakow", value: dashboard.summary.shortages_count },
      { metric: "Liczba nadwyzek", value: dashboard.summary.surpluses_count },
      { metric: "Liczba zgloszonych problemow", value: dashboard.summary.problems_count },
      { metric: "Wartosc brakow", value: dashboard.summary.shortage_value },
      { metric: "Wartosc nadwyzek", value: dashboard.summary.surplus_value },
      { metric: "Laczna wartosc roznic", value: dashboard.summary.total_difference_value },
      { metric: "Sredni czas kontroli lokalizacji (min)", value: dashboard.summary.avg_location_control_minutes },
      { metric: "Liczba lokalizacji na godzine", value: dashboard.summary.locations_per_hour },
      { metric: "Srednia liczba operacji na sesje", value: dashboard.summary.avg_operations_per_session },
      { metric: "Liczba sesji", value: dashboard.summary.sessions_count },
      { metric: "Sredni czas sesji (min)", value: dashboard.summary.avg_session_minutes },
      { metric: "Najdluzsza sesja (min)", value: dashboard.summary.longest_session_minutes },
    ],
    financialRows: dashboard.zoneStats.map((row) => ({
      zone: row.zone,
      shortage_value: row.shortage_value,
      surplus_value: row.surplus_value,
      total_difference_value: row.total_difference_value,
    })),
    zoneRows: dashboard.zoneStats,
    meta: {
      year: year || "all",
      month: month || "all",
      source: dashboard.source,
    },
  };
}
