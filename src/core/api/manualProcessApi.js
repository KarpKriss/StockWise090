import { supabase } from "./supabaseClient";
import { saveEntry } from "./entriesApi";
import { markLocationOnWork, releaseLocationWork } from "./emptyLocationsApi";

const BUFFER_KEY = "stockwise-manual-buffer";
const DEFAULT_CONFIG = {
  lotPattern: "^[A-Za-z0-9._/-]{1,50}$",
  lotMessage: "Niepoprawny format LOT",
  quantityWarningThreshold: 999,
  locationTimeoutMs: 5 * 60 * 1000,
  saveTimeoutMs: 10000,
  saveRetries: 2,
  fetchRetries: 2,
};

function normalizeUuidLike(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return null;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(normalized) ? normalized : null;
}

function parseValidationRules(row) {
  const rules = row?.validation_rules || {};

  return {
    ...DEFAULT_CONFIG,
    lotPattern: rules.lotPattern || rules.lot_pattern || DEFAULT_CONFIG.lotPattern,
    lotMessage: rules.lotMessage || rules.lot_message || DEFAULT_CONFIG.lotMessage,
    quantityWarningThreshold:
      Number(rules.quantityWarningThreshold || rules.maxQuantityWarning) ||
      DEFAULT_CONFIG.quantityWarningThreshold,
    locationTimeoutMs:
      Number(rules.locationTimeoutMs || rules.locationTimeoutSeconds) > 0
        ? Number(rules.locationTimeoutMs || rules.locationTimeoutSeconds) *
          (String(rules.locationTimeoutMs || "").includes("000") ? 1 : 1000)
        : DEFAULT_CONFIG.locationTimeoutMs,
    saveTimeoutMs:
      Number(rules.saveTimeoutMs || rules.apiTimeoutMs) || DEFAULT_CONFIG.saveTimeoutMs,
    saveRetries: Number(rules.saveRetries) || DEFAULT_CONFIG.saveRetries,
    fetchRetries: Number(rules.fetchRetries) || DEFAULT_CONFIG.fetchRetries,
  };
}

export async function fetchManualProcessConfig(siteId) {
  let query = supabase
    .from("process_config")
    .select("validation_rules")
    .limit(1);

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("PROCESS CONFIG FETCH ERROR:", error);
    return DEFAULT_CONFIG;
  }

  return parseValidationRules(data);
}

async function withRetries(task, retries = 2) {
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  return null;
}

export async function validateManualLocation({
  code,
  siteId,
  expectedZone,
  currentUserId,
}) {
  const normalizedCode = String(code || "").trim();

  if (!normalizedCode) {
    throw new Error("Najpierw zeskanuj lub wpisz lokalizacje");
  }

  const safeSiteId = normalizeUuidLike(siteId);

  const location = await withRetries(async () => {
    let query = supabase
      .from("locations")
      .select("id, code, zone, status, locked_by, locked_at, session_id")
      .eq("code", normalizedCode)
      .limit(1);

    if (safeSiteId) {
      query = query.eq("site_id", safeSiteId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(error.message || "Blad pobierania lokalizacji");
    }

    return data;
  });

  if (!location) {
    throw new Error("Lokalizacja nie istnieje w mapie magazynu");
  }

  const normalizedStatus = String(location.status || "").toLowerCase();

  if (expectedZone && location.zone && location.zone !== expectedZone) {
    throw new Error(`Lokalizacja nalezy do innej strefy: ${location.zone}`);
  }

  if (normalizedStatus === "done") {
    throw new Error("Ta lokalizacja zostala juz sprawdzona");
  }

  if (
    normalizedStatus === "in_progress" &&
    location.locked_by &&
    location.locked_by !== currentUserId
  ) {
    throw new Error("Ta lokalizacja jest aktualnie sprawdzana przez innego operatora");
  }

  return location;
}

export async function lockManualLocation({ locationId, userId }) {
  return markLocationOnWork({ locationId, userId });
}

export async function releaseManualLocation({ locationId }) {
  return releaseLocationWork({ locationId });
}

export async function completeManualLocation({
  locationId,
  sessionId,
  userId,
  operatorEmail,
}) {
  const { error } = await supabase.rpc("complete_manual_location_check", {
    p_location_id: locationId,
    p_session_id: sessionId,
    p_user_id: userId,
    p_operator_email: operatorEmail || null,
  });

  if (error) {
    console.error("COMPLETE MANUAL LOCATION RPC ERROR:", error);
    throw new Error(error.message || "Nie udalo sie zakonczyc lokalizacji");
  }
}

export async function resolveManualProduct({ sku, ean }) {
  const normalizedSku = String(sku || "").trim();
  const normalizedEan = String(ean || "").trim();

  if (!normalizedSku && !normalizedEan) {
    throw new Error("SKU jest wymagane");
  }

  let query = supabase
    .from("products")
    .select("id, sku, ean")
    .limit(1);

  if (normalizedSku) {
    query = query.eq("sku", normalizedSku);
  } else {
    query = query.eq("ean", normalizedEan);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("RESOLVE MANUAL PRODUCT ERROR:", error);
    throw new Error(error.message || "Blad walidacji SKU");
  }

  if (!data) {
    throw new Error("Nieznane SKU lub EAN");
  }

  return data;
}

export async function fetchLocationStockSnapshot(locationId) {
  const { data, error } = await supabase
    .from("stock")
    .select("quantity, product_id, products:product_id(id, sku, ean)")
    .eq("location_id", locationId);

  if (error) {
    console.error("LOCATION STOCK SNAPSHOT ERROR:", error);
    throw new Error(error.message || "Blad pobierania stocku lokalizacji");
  }

  return (data || []).map((row) => ({
    productId: row.product_id,
    sku: row.products?.sku || null,
    ean: row.products?.ean || null,
    quantity: Number(row.quantity) || 0,
  }));
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT_SAVE")), timeoutMs);
    }),
  ]);
}

export function readManualBuffer() {
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("READ MANUAL BUFFER ERROR:", error);
    return [];
  }
}

function writeManualBuffer(items) {
  window.localStorage.setItem(BUFFER_KEY, JSON.stringify(items));
}

export function enqueueBufferedManualEntry(payload) {
  const buffer = readManualBuffer();
  writeManualBuffer([
    ...buffer,
    {
      id: crypto.randomUUID(),
      payload,
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function flushBufferedManualEntries() {
  const buffer = readManualBuffer();

  if (!buffer.length) {
    return { sent: 0, failed: 0 };
  }

  const remaining = [];
  let sent = 0;

  for (const item of buffer) {
    try {
      await saveEntry(item.payload);
      sent += 1;
    } catch (error) {
      remaining.push(item);
    }
  }

  writeManualBuffer(remaining);

  return {
    sent,
    failed: remaining.length,
  };
}

export async function saveManualEntryWithResilience(payload, config = DEFAULT_CONFIG) {
  const retries = Number(config.saveRetries) || DEFAULT_CONFIG.saveRetries;
  const timeoutMs = Number(config.saveTimeoutMs) || DEFAULT_CONFIG.saveTimeoutMs;

  try {
    const data = await withRetries(
      () => withTimeout(saveEntry(payload), timeoutMs),
      retries
    );

    return {
      status: "saved",
      data,
    };
  } catch (error) {
    const message = String(error?.message || "");
    const likelyOffline =
      !navigator.onLine ||
      message === "TIMEOUT_SAVE" ||
      message.includes("Failed to fetch") ||
      message.includes("Network");

    if (likelyOffline) {
      enqueueBufferedManualEntry(payload);
      return {
        status: "buffered",
      };
    }

    throw error;
  }
}
