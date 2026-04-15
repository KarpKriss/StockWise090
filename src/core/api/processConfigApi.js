import { supabase } from "./supabaseClient";
import {
  DEFAULT_MANUAL_PROCESS_CONFIG,
  normalizeManualProcessConfig,
  serializeManualProcessConfig,
} from "../config/manualProcessConfig";

function normalizeSiteId(siteId) {
  const normalized = String(siteId || "").trim();
  return normalized || null;
}

async function fetchProcessConfigRowDirect(normalizedSiteId) {
  let query = supabase
    .from("process_config")
    .select("id, site_id, validation_rules")
    .order("id", { ascending: false })
    .limit(1);

  if (normalizedSiteId) {
    query = query.eq("site_id", normalizedSiteId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function upsertProcessConfigDirect({ normalizedSiteId, payload }) {
  const existing = await fetchProcessConfigRowDirect(normalizedSiteId);

  if (existing?.id) {
    const updateResult = await supabase
      .from("process_config")
      .update({
        validation_rules: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, site_id, validation_rules")
      .maybeSingle();

    if (updateResult.error) {
      throw updateResult.error;
    }

    return updateResult.data || null;
  }

  const insertResult = await supabase
    .from("process_config")
    .insert({
      site_id: normalizedSiteId,
      validation_rules: payload,
      updated_at: new Date().toISOString(),
    })
    .select("id, site_id, validation_rules")
    .maybeSingle();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return insertResult.data || null;
}

export async function fetchManualProcessAdminConfig(siteId) {
  const normalizedSiteId = normalizeSiteId(siteId);
  try {
    const data = await fetchProcessConfigRowDirect(normalizedSiteId);

    return {
      source: data ? "table" : "default",
      id: data?.id || null,
      siteId: data?.site_id || normalizedSiteId,
      config: normalizeManualProcessConfig(data?.validation_rules || {}),
    };
  } catch (error) {
    console.error("PROCESS CONFIG ADMIN FETCH ERROR:", error);
    return {
      source: "default",
      id: null,
      siteId: normalizedSiteId,
      config: DEFAULT_MANUAL_PROCESS_CONFIG,
    };
  }
}

export async function saveManualProcessAdminConfig({ siteId, config }) {
  const normalizedSiteId = normalizeSiteId(siteId);
  const payload = serializeManualProcessConfig(config);
  try {
    const directRow = await upsertProcessConfigDirect({
      normalizedSiteId,
      payload,
    });

    return {
      source: "table",
      id: directRow?.id || null,
      siteId: directRow?.site_id || normalizedSiteId,
      config: normalizeManualProcessConfig(directRow?.validation_rules || payload),
    };
  } catch (directSaveError) {
    console.error("PROCESS CONFIG ADMIN SAVE ERROR:", directSaveError);
    throw new Error(
      directSaveError.message || "Nie udalo sie zapisac konfiguracji procesu",
    );
  }
}
