export const ACTIVE_SITE_STORAGE_KEY = "stockwise-active-site";

export function normalizeSiteId(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function readActiveSiteId() {
  try {
    return normalizeSiteId(window.localStorage.getItem(ACTIVE_SITE_STORAGE_KEY));
  } catch (error) {
    console.error("ACTIVE SITE READ ERROR:", error);
    return null;
  }
}

export function writeActiveSiteId(siteId) {
  try {
    const normalized = normalizeSiteId(siteId);

    if (!normalized) {
      window.localStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, normalized);
  } catch (error) {
    console.error("ACTIVE SITE WRITE ERROR:", error);
  }
}

export function clearActiveSiteId() {
  writeActiveSiteId(null);
}

export function applySiteFilter(query, siteId, column = "site_id") {
  const normalized = normalizeSiteId(siteId);
  return normalized ? query.eq(column, normalized) : query;
}

export function ensureRowsScoped(rows, siteId) {
  const normalized = normalizeSiteId(siteId);
  return (rows || []).map((row) => ({
    ...row,
    site_id: normalized,
  }));
}
