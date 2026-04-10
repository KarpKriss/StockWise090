import { supabase } from "./supabaseClient";
import { getDefaultImportExportMapping } from "../config/importExportDefaults";
import { mergeImportExportMapping } from "../utils/importExportMapping";

async function fetchScopedRow(siteId) {
  let query = supabase.from("export_config").select("id, site_id, mapping");

  if (siteId) {
    query = query.eq("site_id", String(siteId));
  } else {
    query = query.is("site_id", null);
  }

  const { data, error } = await query.order("id", { ascending: true }).limit(1);

  if (error) {
    throw new Error(error.message || "Nie udalo sie pobrac konfiguracji import/export");
  }

  return data?.[0] || null;
}

export async function fetchImportExportMapping(siteId) {
  const scoped = await fetchScopedRow(siteId);

  if (scoped?.mapping) {
    return mergeImportExportMapping(scoped.mapping);
  }

  if (siteId) {
    const globalRow = await fetchScopedRow(null);
    if (globalRow?.mapping) {
      return mergeImportExportMapping(globalRow.mapping);
    }
  }

  return getDefaultImportExportMapping();
}

export async function saveImportExportMapping(siteId, mapping) {
  const current = await fetchScopedRow(siteId);
  const payload = {
    site_id: siteId ? String(siteId) : null,
    mapping: mergeImportExportMapping(mapping),
  };

  if (current?.id) {
    const { error } = await supabase.from("export_config").update(payload).eq("id", current.id);
    if (error) {
      throw new Error(error.message || "Nie udalo sie zapisac konfiguracji");
    }
    return payload.mapping;
  }

  const { error } = await supabase.from("export_config").insert([payload]);
  if (error) {
    throw new Error(error.message || "Nie udalo sie utworzyc konfiguracji");
  }

  return payload.mapping;
}
