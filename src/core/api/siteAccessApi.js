import { supabase } from "./supabaseClient";
import { normalizeSiteId } from "../auth/siteScope";

function normalizeSiteOption(row = {}) {
  const id = normalizeSiteId(row.id || row.site_id || row.code || row.siteCode);

  if (!id) {
    return null;
  }

  const code = String(row.code || id).trim();
  const name = String(row.name || row.site_name || code).trim();
  const status = String(row.status || "active").trim().toLowerCase();

  return {
    id,
    code,
    name,
    status,
    label: name || code || id,
    isDefault: Boolean(row.is_default),
  };
}

function uniqueSites(rows) {
  const map = new Map();

  (rows || []).forEach((row) => {
    const normalized = normalizeSiteOption(row);
    if (!normalized?.id) return;

    if (!map.has(normalized.id) || normalized.isDefault) {
      map.set(normalized.id, normalized);
    }
  });

  return Array.from(map.values()).sort((left, right) =>
    String(left.label || left.id).localeCompare(String(right.label || right.id), "pl")
  );
}

export async function fetchLoginSiteOptions() {
  const { data, error } = await supabase
    .from("sites")
    .select("id, code, name, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.warn("FETCH LOGIN SITE OPTIONS ERROR:", error);
    return [];
  }

  return uniqueSites(data);
}

export async function fetchUserSiteAccess({ userId, fallbackSiteId = null } = {}) {
  const normalizedFallback = normalizeSiteId(fallbackSiteId);

  const { data, error } = await supabase
    .from("user_site_access")
    .select("site_id, status, is_default, sites:site_id(id, code, name, status)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!error) {
    const rows = (data || []).map((row) => ({
      site_id: row.site_id,
      is_default: row.is_default,
      ...(row.sites || {}),
    }));

    const sites = uniqueSites(rows);

    if (sites.length > 0) {
      return sites;
    }
  } else {
    console.warn("FETCH USER SITE ACCESS ERROR:", error);
  }

  if (!normalizedFallback) {
    return [];
  }

  const { data: siteRow } = await supabase
    .from("sites")
    .select("id, code, name, status")
    .eq("id", normalizedFallback)
    .maybeSingle();

  const fallbackSite = normalizeSiteOption(siteRow || { id: normalizedFallback, code: normalizedFallback, name: normalizedFallback });
  return fallbackSite ? [fallbackSite] : [];
}

export function resolvePreferredSite(preferredSiteId, availableSites, fallbackSiteId = null) {
  const sites = Array.isArray(availableSites) ? availableSites : [];
  const normalizedPreferred = normalizeSiteId(preferredSiteId);

  const byToken = (token) =>
    sites.find(
      (site) =>
        normalizeSiteId(site.id) === token ||
        String(site.code || "").trim().toLowerCase() === String(token || "").trim().toLowerCase() ||
        String(site.name || "").trim().toLowerCase() === String(token || "").trim().toLowerCase()
    ) || null;

  if (normalizedPreferred) {
    const preferred = byToken(normalizedPreferred);
    if (preferred) return preferred;
  }

  const normalizedFallback = normalizeSiteId(fallbackSiteId);
  if (normalizedFallback) {
    const fallback = byToken(normalizedFallback);
    if (fallback) return fallback;
  }

  return sites.find((site) => site.isDefault) || sites[0] || null;
}
