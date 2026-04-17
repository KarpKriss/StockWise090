import { supabase } from "./supabaseClient";
import { applySiteFilter, normalizeSiteId, readActiveSiteId } from "../auth/siteScope";
import {
  buildDashboardData,
  collectDashboardYears,
} from "../utils/dashboardMetrics";

function normalizeYearMonth(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchAllRows(buildQuery, { pageSize = 1000 } = {}) {
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

function chunkArray(items, size = 500) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchPriceRows(siteId = readActiveSiteId()) {
  const data = await fetchAllRows(() =>
    applySiteFilter(supabase.from("prices").select("price, products:product_id(sku)"), siteId)
  );

  return data.map((row) => ({
    sku: row.products?.sku || null,
    price: Number(row.price || 0),
  }));
}

async function fetchSiteScopedIssueRows(siteId = readActiveSiteId()) {
  const safeSiteId = normalizeSiteId(siteId);
  const rows = await fetchAllRows(() =>
    supabase
      .from("empty_location_issues")
      .select("id, location_id, zone, created_at")
      .order("created_at", { ascending: false })
  );

  if (!safeSiteId) {
    return rows;
  }

  const locationIds = [...new Set(rows.map((row) => row.location_id).filter(Boolean))];

  if (!locationIds.length) {
    return [];
  }

  const locationChunks = chunkArray(locationIds, 500);
  const scopedLocations = [];

  for (const chunk of locationChunks) {
    const data = await fetchAllRows(() =>
      applySiteFilter(supabase.from("locations").select("id, zone").in("id", chunk), safeSiteId)
    );
    scopedLocations.push(...data);
  }

  const locationsById = new Map(scopedLocations.map((location) => [location.id, location]));

  return rows
    .filter((row) => locationsById.has(row.location_id))
    .map((row) => ({
      ...row,
      zone: row.zone || locationsById.get(row.location_id)?.zone || null,
    }));
}

async function fetchDashboardBaseRows(siteId = readActiveSiteId()) {
  const [
    entries,
    sessions,
    locations,
    issuesRows,
    priceRows,
  ] = await Promise.all([
    fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("entries")
          .select("id, session_id, user_id, operator, site_id, location, sku, quantity, type, timestamp, created_at")
          .order("timestamp", { ascending: false }),
        siteId
      )
    ),
    fetchAllRows(() =>
      applySiteFilter(
        supabase
          .from("sessions")
          .select("id, user_id, operator, site_id, status, started_at, ended_at, last_activity, created_at")
          .order("started_at", { ascending: false }),
        siteId
      )
    ),
    fetchAllRows(() => applySiteFilter(supabase.from("locations").select("code, zone, status"), siteId)),
    fetchSiteScopedIssueRows(siteId),
    fetchPriceRows(siteId),
  ]);

  return {
    entries: entries || [],
    sessions: sessions || [],
    locations: locations || [],
    issues: issuesRows || [],
    priceRows,
  };
}

export async function fetchDashboardFilters(siteId = readActiveSiteId()) {
  const [entries, sessions, issuesRows] = await Promise.all([
    fetchAllRows(() => applySiteFilter(supabase.from("entries").select("timestamp, created_at"), siteId)),
    fetchAllRows(() => applySiteFilter(supabase.from("sessions").select("started_at, created_at"), siteId)),
    fetchSiteScopedIssueRows(siteId),
  ]);

  const baseRows = {
    entries: entries || [],
    sessions: sessions || [],
    issues: issuesRows || [],
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
