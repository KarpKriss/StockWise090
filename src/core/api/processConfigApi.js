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

function hasScanningConfig(rawRules) {
  return Boolean(rawRules && typeof rawRules === "object" && rawRules.scanning);
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

  const rpcResult = await supabase.rpc("get_manual_process_admin_config", {
    p_site_id: normalizedSiteId,
  });

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (!hasScanningConfig(row?.validation_rules)) {
      try {
        const directRow = await fetchProcessConfigRowDirect(normalizedSiteId);
        if (directRow) {
          return {
            source: "fallback",
            id: directRow.id || null,
            siteId: directRow.site_id || normalizedSiteId,
            config: normalizeManualProcessConfig(directRow.validation_rules || {}),
          };
        }
      } catch (directFetchError) {
        console.error("PROCESS CONFIG DIRECT FETCH AFTER RPC ERROR:", directFetchError);
      }
    }

    return {
      source: "rpc",
      id: row?.id || null,
      siteId: row?.site_id || normalizedSiteId,
      config: normalizeManualProcessConfig(row?.validation_rules || {}),
    };
  }

  let query = supabase
    .from("process_config")
    .select("id, site_id, validation_rules")
    .limit(1);

  if (normalizedSiteId) {
    query = query.eq("site_id", normalizedSiteId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("PROCESS CONFIG ADMIN FETCH ERROR:", error);
    return {
      source: "default",
      id: null,
      siteId: normalizedSiteId,
      config: DEFAULT_MANUAL_PROCESS_CONFIG,
    };
  }

  return {
    source: "fallback",
    id: data?.id || null,
    siteId: data?.site_id || normalizedSiteId,
    config: normalizeManualProcessConfig(data?.validation_rules || {}),
  };
}

export async function saveManualProcessAdminConfig({ siteId, config }) {
  const normalizedSiteId = normalizeSiteId(siteId);
  const payload = serializeManualProcessConfig(config);

  const rpcResult = await supabase.rpc("save_manual_process_admin_config", {
    p_site_id: normalizedSiteId,
    p_validation_rules: payload,
  });

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    const rpcConfig = normalizeManualProcessConfig(row?.validation_rules || payload);
    const rpcSavedScanning = hasScanningConfig(row?.validation_rules);

    if (rpcSavedScanning) {
      return {
        source: "rpc",
        id: row?.id || null,
        siteId: row?.site_id || normalizedSiteId,
        config: rpcConfig,
      };
    }

    try {
      const directRow = await upsertProcessConfigDirect({
        normalizedSiteId,
        payload,
      });

      return {
        source: "fallback",
        id: directRow?.id || row?.id || null,
        siteId: directRow?.site_id || row?.site_id || normalizedSiteId,
        config: normalizeManualProcessConfig(directRow?.validation_rules || payload),
      };
    } catch (directSaveError) {
      console.error("PROCESS CONFIG DIRECT SAVE AFTER RPC ERROR:", directSaveError);
    }

    return {
      source: "rpc",
      id: row?.id || null,
      siteId: row?.site_id || normalizedSiteId,
      config: rpcConfig,
    };
  }

  console.error("PROCESS CONFIG ADMIN RPC SAVE ERROR:", rpcResult.error);
  try {
    const directRow = await upsertProcessConfigDirect({
      normalizedSiteId,
      payload,
    });

    return {
      source: "fallback",
      id: directRow?.id || null,
      siteId: directRow?.site_id || normalizedSiteId,
      config: normalizeManualProcessConfig(directRow?.validation_rules || payload),
    };
  } catch (directSaveError) {
    console.error("PROCESS CONFIG ADMIN DIRECT UPSERT ERROR:", directSaveError);
    throw new Error(
      rpcResult.error?.message ||
        directSaveError.message ||
        "Nie udalo sie zapisac konfiguracji procesu",
    );
  }
}
