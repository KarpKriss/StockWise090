import { supabase } from "./supabaseClient";
import { applySiteFilter, readActiveSiteId } from "../auth/siteScope";

const TRACKED_TYPES = [
  "brak",
  "shortage",
  "nadwyzka",
  "nadwyzka",
  "surplus",
  "problem",
  "checked_empty",
];

function normalizeTypeForFilter(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized || normalized === "all") {
    return null;
  }

  if (normalized === "shortage") {
    return ["brak", "shortage"];
  }

  if (normalized === "surplus") {
    return ["surplus", "nadwyzka", "nadwyzka"];
  }

  if (normalized === "problem") {
    return ["problem"];
  }

  if (normalized === "checked_empty") {
    return ["checked_empty"];
  }

  return [normalized];
}

function normalizeApprovalStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "pending";
  }

  return normalized;
}

function buildCorrectionMeta(rows) {
  const map = new Map();

  (rows || []).forEach((row) => {
    if (!row.entry_id) {
      return;
    }

    const current = map.get(row.entry_id);

    if (!current) {
      map.set(row.entry_id, {
        count: 1,
        lastCorrectionAt: row.created_at,
      });
      return;
    }

    map.set(row.entry_id, {
      count: current.count + 1,
      lastCorrectionAt: current.lastCorrectionAt || row.created_at,
    });
  });

  return map;
}

function normalizeHistoryEntry(entry, correctionMeta, profileMap) {
  const correction = correctionMeta.get(entry.id);
  const profile = profileMap.get(entry.user_id) || null;

  return {
    ...entry,
    operatorName: profile?.name || null,
    operatorEmail: profile?.email || entry.operator || null,
    userRole: profile?.role || null,
    approval_status: normalizeApprovalStatus(entry.approval_status),
    wasEdited: Boolean(correction),
    correctionCount: correction?.count || 0,
    correctionFlag: correction ? "TAK" : "NIE",
    lastCorrectionAt: correction?.lastCorrectionAt || null,
  };
}

export async function fetchInventoryHistoryEntries({
  page = 1,
  pageSize = 25,
  sortDirection = "desc",
  filters = {},
  siteId = readActiveSiteId(),
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 25);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("entries")
    .select("*", { count: "exact" })
    .in("type", TRACKED_TYPES)
    .order("timestamp", { ascending: sortDirection === "asc", nullsFirst: sortDirection === "asc" })
    .order("created_at", { ascending: sortDirection === "asc" })
    .range(from, to);

  query = applySiteFilter(query, siteId);

  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }

  if (filters.sku) {
    query = query.ilike("sku", `%${filters.sku}%`);
  }

  if (filters.operator) {
    query = query.or(`operator.ilike.%${filters.operator}%,user_id.eq.${filters.operator}`);
  }

  if (filters.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }

  const normalizedTypes = normalizeTypeForFilter(filters.type);
  if (normalizedTypes?.length) {
    query = query.in("type", normalizedTypes);
  }

  if (filters.searchText) {
    const escaped = String(filters.searchText).replace(/[%(),]/g, " ").trim();
    if (escaped) {
      query = query.or(
        `location.ilike.%${escaped}%,sku.ilike.%${escaped}%,ean.ilike.%${escaped}%,lot.ilike.%${escaped}%,operator.ilike.%${escaped}%`
      );
    }
  }

  const { data: entries, error: entriesError, count } = await query;

  if (entriesError) {
    console.error("HISTORY FETCH ERROR:", entriesError);
    throw new Error("Blad pobierania historii operacji");
  }

  const entryIds = (entries || []).map((entry) => entry.id).filter(Boolean);
  const userIds = [...new Set((entries || []).map((entry) => entry.user_id).filter(Boolean))];

  const [correctionsResult, profilesResult] = await Promise.all([
    entryIds.length
      ? supabase
          .from("correction_log")
          .select("entry_id, created_at")
          .in("entry_id", entryIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase
          .from("profiles")
          .select("user_id, email, name, role")
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (correctionsResult.error) {
    console.error("HISTORY CORRECTIONS FETCH ERROR:", correctionsResult.error);
    throw new Error("Blad pobierania oznaczen korekt");
  }

  if (profilesResult.error) {
    console.error("HISTORY PROFILES FETCH ERROR:", profilesResult.error);
    throw new Error("Blad pobierania operatorow historii");
  }

  const correctionMeta = buildCorrectionMeta(correctionsResult.data || []);
  const profileMap = new Map(
    (profilesResult.data || []).map((row) => [row.user_id, row])
  );

  return {
    rows: (entries || []).map((entry) => normalizeHistoryEntry(entry, correctionMeta, profileMap)),
    totalCount: count || 0,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: to + 1 < (count || 0),
  };
}

export async function updateInventoryHistoryEntry({
  entryId,
  reasonCode,
  comment,
  changes,
}) {
  const { data, error } = await supabase.rpc("update_inventory_history_entry", {
    p_entry_id: entryId,
    p_reason_code: reasonCode,
    p_comment: comment || null,
    p_changes: changes,
  });

  if (error) {
    console.error("UPDATE INVENTORY HISTORY ENTRY RPC ERROR:", error);

    if (String(error.message || "").includes("update_inventory_history_entry")) {
      throw new Error("Brakuje backendowej funkcji update_inventory_history_entry. Wdroz SQL dla historii operacji.");
    }

    throw new Error(error.message || "Nie udalo sie zapisac zmian");
  }

  return data;
}
