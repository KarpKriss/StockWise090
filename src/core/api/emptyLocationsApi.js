import { supabase } from "./supabaseClient";

function normalizeUuidLike(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return null;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(normalized) ? normalized : null;
}

function unwrapRpcRows(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data) {
    return [];
  }

  return Array.isArray(data.data) ? data.data : [];
}

function isLocationReadyStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "active" || normalized === "pending";
}

export async function fetchEmptyLocationZones({ siteId } = {}) {
  const safeSiteId = normalizeUuidLike(siteId);
  let zonesResult = await supabase.rpc("get_empty_location_zones", {
    p_site_id: safeSiteId,
  });

  if (zonesResult.error) {
    console.warn("FETCH EMPTY ZONES RPC ERROR:", zonesResult.error);

    let fallbackQuery = supabase.from("locations").select("zone, status");

    if (safeSiteId) {
      fallbackQuery = fallbackQuery.eq("site_id", safeSiteId);
    }

    zonesResult = await fallbackQuery;
  }

  if (zonesResult.error) {
    console.error("FETCH EMPTY ZONES ERROR:", zonesResult.error);
    throw new Error(zonesResult.error.message || "Blad pobierania stref");
  }

  const rows = unwrapRpcRows(zonesResult.data);
  const zones = rows
    .filter((row) => isLocationReadyStatus(row.status) || !("status" in row))
    .map((row) => String(row.zone || "").trim())
    .filter(Boolean);

  return [...new Set(zones)].sort((left, right) => left.localeCompare(right));
}

export async function fetchEmptyLocationsForZone({ zone, siteId } = {}) {
  if (!zone) {
    return { locations: [], totalCount: 0 };
  }

  const safeSiteId = normalizeUuidLike(siteId);
  const pageSize = 1000;
  const allLocations = [];
  let offset = 0;

  const { data: stockRows, error: stockError } = await supabase
    .from("stock")
    .select("location_id");

  if (stockError) {
    console.error("FETCH STOCK FOR EMPTY LOCATIONS ERROR:", stockError);
    throw new Error(stockError.message || "Blad pobierania stocku");
  }

  while (true) {
    let query = supabase
      .from("locations")
      .select("id, code, zone, status, locked_by, locked_at, site_id")
      .eq("zone", zone)
      .in("status", ["active", "pending"])
      .order("code", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (safeSiteId) {
      query = query.eq("site_id", safeSiteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("FETCH EMPTY LOCATIONS PAGE ERROR:", error);
      throw new Error(error.message || "Blad pobierania lokalizacji");
    }

    if (!data?.length) {
      break;
    }

    allLocations.push(...data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  const occupiedIds = new Set((stockRows || []).map((row) => row.location_id).filter(Boolean));
  const emptyLocations = allLocations.filter((row) => !occupiedIds.has(row.id));

  return {
    locations: emptyLocations,
    totalCount: emptyLocations.length,
  };
}

export async function markLocationOnWork({ locationId, userId }) {
  const { data, error } = await supabase.rpc("start_empty_location_work", {
    p_location_id: locationId,
    p_user_id: userId,
  });

  if (error) {
    console.error("MARK LOCATION ON WORK RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie zablokowac lokalizacji");
  }

  return data;
}

export async function releaseLocationWork({ locationId }) {
  const { error } = await supabase.rpc("release_empty_location_work", {
    p_location_id: locationId,
  });

  if (error) {
    console.error("RELEASE LOCATION WORK RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie odblokowac lokalizacji");
  }
}

export async function confirmEmptyLocation({
  location,
  user,
  sessionId,
  zone,
}) {
  const { error } = await supabase.rpc("confirm_empty_location", {
    p_location_id: location.id,
    p_session_id: sessionId,
    p_user_id: user?.id || null,
    p_operator_email: user?.email || null,
    p_zone: zone || null,
  });

  if (error) {
    console.error("CONFIRM EMPTY LOCATION RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie potwierdzic pustej lokalizacji");
  }
}

export async function reportLocationProblem({
  location,
  user,
  sessionId,
  zone,
  reason,
  note,
}) {
  const { error } = await supabase.rpc("report_empty_location_issue", {
    p_location_id: location.id,
    p_session_id: sessionId,
    p_user_id: user?.id || null,
    p_operator_email: user?.email || null,
    p_zone: zone || null,
    p_issue_type: reason,
    p_note: note || null,
  });

  if (error) {
    console.error("REPORT EMPTY LOCATION ISSUE RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie zapisac problemu");
  }
}

export async function reportLocationSurplus({
  location,
  user,
  sessionId,
  zone,
  ean,
  sku,
  lot,
  quantity,
}) {
  const { data, error } = await supabase.rpc("report_empty_location_surplus", {
    p_location_id: location.id,
    p_session_id: sessionId,
    p_user_id: user?.id || null,
    p_operator_email: user?.email || null,
    p_zone: zone || null,
    p_ean: ean || null,
    p_sku: sku || null,
    p_lot: lot || null,
    p_quantity: quantity,
  });

  if (error) {
    console.error("REPORT EMPTY LOCATION SURPLUS RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie zapisac nadwyzki");
  }

  return data;
}

export async function resolveProductForSurplus({ sku, ean }) {
  const normalizedSku = String(sku || "").trim();
  const normalizedEan = String(ean || "").trim();
  let query = supabase.from("products").select("id, sku, ean").limit(1);

  if (normalizedSku) {
    query = query.eq("sku", normalizedSku);
  } else if (normalizedEan) {
    query = query.eq("ean", normalizedEan);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("RESOLVE PRODUCT FOR SURPLUS ERROR:", error);
    throw new Error(error.message || "Blad walidacji produktu");
  }

  return data || null;
}
