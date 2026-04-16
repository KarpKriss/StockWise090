import { supabase } from "./supabaseClient";
import { applySiteFilter, normalizeSiteId, readActiveSiteId } from "../auth/siteScope";

function sortByNewest(rows) {
  return [...rows].sort(
    (left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
  );
}

function normalizeProblemRow(row) {
  return {
    ...row,
    location_code: row.location_code || null,
    zone: row.zone || null,
    source_process: row.source_process || "unknown",
  };
}

export async function fetchProblemRows(siteId = readActiveSiteId()) {
  const safeSiteId = normalizeSiteId(siteId);
  let rpcRows = null;

  if (!safeSiteId) {
    const rpcResult = await supabase.rpc("get_problem_cases");

    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      rpcRows = rpcResult.data;
    } else if (rpcResult.error) {
      console.warn("FETCH PROBLEM CASES RPC ERROR:", rpcResult.error);
    }
  }

  if (Array.isArray(rpcRows)) {
    return sortByNewest(rpcRows.map(normalizeProblemRow));
  }

  const { data, error } = await applySiteFilter(
    supabase
      .from("empty_location_issues")
      .select("*")
      .order("created_at", { ascending: false }),
    safeSiteId
  );

  if (error) {
    console.error("FETCH PROBLEMS ERROR:", error);
    throw new Error(error.message || "Blad pobierania problemow");
  }

  const normalizedRows = (data || []).map(normalizeProblemRow);
  const locationIds = [...new Set(normalizedRows.map((row) => row.location_id).filter(Boolean))];

  if (locationIds.length === 0) {
    return normalizedRows;
  }

  const { data: locationsData, error: locationsError } = await applySiteFilter(
    supabase
      .from("locations")
      .select("id, code, zone")
      .in("id", locationIds),
    safeSiteId
  );

  if (locationsError) {
    console.warn("FETCH PROBLEM LOCATIONS LOOKUP ERROR:", locationsError);
    return normalizedRows;
  }

  const locationsById = new Map((locationsData || []).map((location) => [location.id, location]));

  return normalizedRows.map((row) => {
    const matchedLocation = locationsById.get(row.location_id);
    return {
      ...row,
      location_code: row.location_code || matchedLocation?.code || null,
      zone: row.zone || matchedLocation?.zone || null,
    };
  });
}

export async function resolveProblemCase({ issueId, locationId, releaseNote }) {
  const rpcResult = await supabase.rpc("resolve_problem_case", {
    p_issue_id: issueId,
    p_location_id: locationId,
    p_release_note: releaseNote || null,
  });

  if (rpcResult.error) {
    console.error("RESOLVE PROBLEM CASE RPC ERROR:", rpcResult.error);
    throw new Error(rpcResult.error.message || "Nie udalo sie zwolnic problemu");
  }

  return rpcResult.data;
}

export async function reportInventoryProblem({
  location,
  user,
  sessionId,
  zone,
  reason,
  note,
  sourceProcess,
}) {
  const { data, error } = await supabase.rpc("report_inventory_location_issue", {
    p_location_id: location.id,
    p_location_code: location.code || null,
    p_session_id: sessionId || null,
    p_user_id: user?.id || null,
    p_operator_email: user?.email || null,
    p_zone: zone || location.zone || null,
    p_issue_type: reason,
    p_note: note || null,
    p_source_process: sourceProcess || "unknown",
    p_previous_status: location.status || null,
  });

  if (error) {
    console.error("REPORT INVENTORY PROBLEM RPC ERROR:", error);
    if (String(error.message || "").includes("report_inventory_location_issue")) {
      throw new Error("Brakuje backendowej funkcji do zapisu problemu. Wdroz SQL dla report_inventory_location_issue.");
    }
    throw new Error(error.message || "Nie udalo sie zapisac problemu");
  }

  return data;
}
