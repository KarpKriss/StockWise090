import { supabase } from "./supabaseClient";
import { getDefaultImportExportMapping } from "../config/importExportDefaults";
import { getMappedExportColumns, mergeImportExportMapping } from "../utils/importExportMapping";

function mapSampleRow(entityKey, row) {
  if (!row) return null;

  switch (entityKey) {
    case "products":
      return {
        sku: row.sku || "",
        ean: row.ean || "",
        name: row.name || "",
        status: row.status || "",
      };
    case "stock":
      return {
        location: row.locations?.code || row.location || "",
        zone: row.locations?.zone || row.zone || "",
        sku: row.products?.sku || row.sku || "",
        quantity: Number(row.quantity || 0),
      };
    case "prices":
      return {
        sku: row.products?.sku || row.sku || "",
        price: Number(row.price || 0),
      };
    case "locations":
      return {
        code: row.code || "",
        zone: row.zone || "",
        status: row.status || "",
      };
    case "corrections":
      return {
        created_at: row.created_at || "",
        user_id: row.user_id || "",
        entry_id: row.entry_id || "",
        reason: row.reason || "",
        old_value: JSON.stringify(row.old_value || {}),
        new_value: JSON.stringify(row.new_value || {}),
      };
    default:
      return row;
  }
}

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

export function validateImportExportEntityMapping(entity, entityMapping) {
  const errors = [];

  if (entity.supportsImport) {
    entity.importFields
      .filter((field) => field.required)
      .forEach((field) => {
        const fieldConfig = entityMapping?.import?.fields?.[field.key];
        const value = String(fieldConfig?.value || "").trim();

        if (!value) {
          errors.push(`Pole importu "${field.label}" musi miec przypisana kolumne.`);
        }

        if (fieldConfig?.mode === "index" && (!Number.isFinite(Number(value)) || Number(value) < 1)) {
          errors.push(`Pole importu "${field.label}" musi wskazywac poprawny numer kolumny.`);
        }
      });
  }

  if (entity.supportsExport) {
    const enabledColumns = (entityMapping?.export?.columns || []).filter((column) => column.enabled !== false);
    const requiredSources = new Set(entity.exportFields.map((field) => field.key));

    if (!enabledColumns.length) {
      errors.push("Co najmniej jedna kolumna eksportu musi byc aktywna.");
    }

    requiredSources.forEach((source) => {
      if (!enabledColumns.some((column) => column.source === source)) {
        const field = entity.exportFields.find((item) => item.key === source);
        errors.push(`Brakuje mapowania eksportu dla pola "${field?.label || source}".`);
      }
    });

    const duplicateHeaders = enabledColumns.reduce((acc, column) => {
      const header = String(column.header || "").trim().toLowerCase();
      if (!header) {
        errors.push(`Aktywna kolumna eksportu "${column.source}" nie ma naglowka.`);
        return acc;
      }
      acc[header] = (acc[header] || 0) + 1;
      return acc;
    }, {});

    Object.entries(duplicateHeaders).forEach(([header, count]) => {
      if (count > 1) {
        errors.push(`Naglowek eksportu "${header}" wystepuje wielokrotnie.`);
      }
    });
  }

  return errors;
}

export async function fetchImportExportPreviewSample(entityKey, mapping) {
  let row = null;

  if (entityKey === "products") {
    const result = await supabase.from("products").select("sku, ean, name, status").limit(1).maybeSingle();
    if (result.error) throw new Error(result.error.message || "Nie udalo sie pobrac probki produktow");
    row = mapSampleRow(entityKey, result.data);
  } else if (entityKey === "stock") {
    const result = await supabase
      .from("stock")
      .select("quantity, locations:location_id(code, zone), products:product_id(sku)")
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message || "Nie udalo sie pobrac probki stocku");
    row = mapSampleRow(entityKey, result.data);
  } else if (entityKey === "prices") {
    const result = await supabase
      .from("prices")
      .select("price, products:product_id(sku)")
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message || "Nie udalo sie pobrac probki cen");
    row = mapSampleRow(entityKey, result.data);
  } else if (entityKey === "locations") {
    const result = await supabase.from("locations").select("code, zone, status").limit(1).maybeSingle();
    if (result.error) throw new Error(result.error.message || "Nie udalo sie pobrac probki mapy magazynu");
    row = mapSampleRow(entityKey, result.data);
  } else if (entityKey === "corrections") {
    const result = await supabase
      .from("correction_log")
      .select("created_at, user_id, entry_id, reason, old_value, new_value")
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message || "Nie udalo sie pobrac probki korekt");
    row = mapSampleRow(entityKey, result.data);
  }

  if (!row) {
    return [];
  }

  return getMappedExportColumns(entityKey, mapping).map((column) => ({
    header: column.label,
    value: row[column.key] ?? "",
  }));
}
