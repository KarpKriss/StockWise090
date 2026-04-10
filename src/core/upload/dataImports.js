import { supabase } from "../api/supabaseClient";
import { parseTabularFile } from "../../utils/tabularFile";
import { validateLocations } from "../utils/validators";
import { resolveMappedValue } from "../utils/importExportMapping";

function requireHeaders(headers, requiredHeaders) {
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Brak wymaganych kolumn: ${missingHeaders.join(", ")}`);
  }
}

export async function buildStockImportPreview(file, mappingConfig) {
  const { headers, data, rawRows = [] } = await parseTabularFile(file);

  const parsed = data.map((row, index) => ({
    location_code: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.location_code,
      fallbackAliases: ["location_code", "location", "lokalizacja"],
    }),
    sku: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.sku,
      fallbackAliases: ["sku"],
    }),
    quantity: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.quantity,
      fallbackAliases: ["quantity", "ilosc", "qty"],
    }),
    zone: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.zone,
      fallbackAliases: ["zone", "strefa"],
    }),
  }));

  const [{ data: locations }, { data: products }] = await Promise.all([
    supabase.from("locations").select("id, code"),
    supabase.from("products").select("id, sku"),
  ]);

  const locationMap = Object.fromEntries((locations || []).map((row) => [row.code, row.id]));
  const productMap = Object.fromEntries((products || []).map((row) => [row.sku, row.id]));
  const valid = [];
  const invalid = [];

  parsed.forEach((row) => {
    const errors = [];
    const location_id = locationMap[row.location_code];
    const product_id = productMap[row.sku];
    const quantity = Number(row.quantity);

    if (!row.location_code) errors.push("Brak lokalizacji");
    else if (!location_id) errors.push("Nieznana lokalizacja");

    if (!row.sku) errors.push("Brak SKU");
    else if (!product_id) errors.push("Nieznany SKU");

    if (row.quantity === "") errors.push("Brak ilości");
    else if (Number.isNaN(quantity)) errors.push("Niepoprawna ilość");

    if (errors.length > 0) {
      invalid.push({ ...row, errors });
      return;
    }

    valid.push({ location_id, product_id, quantity });
  });

  return { headers, parsed, valid, invalid };
}

export async function buildPricesImportPreview(file, mappingConfig) {
  const { headers, data, rawRows = [] } = await parseTabularFile(file);

  const { data: products } = await supabase.from("products").select("id, sku");
  const productMap = Object.fromEntries((products || []).map((row) => [row.sku, row.id]));
  const parsed = data.map((row, index) => ({
    sku: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.sku,
      fallbackAliases: ["sku"],
    }),
    price: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.price,
      fallbackAliases: ["price", "cena"],
    }),
  }));
  const valid = [];
  const invalid = [];

  parsed.forEach((row) => {
    const errors = [];
    const price = Number(row.price);
    const product_id = productMap[row.sku];

    if (!row.sku) errors.push("Brak SKU");
    else if (!product_id) errors.push("Nieznany SKU");

    if (row.price === "") errors.push("Brak ceny");
    else if (Number.isNaN(price)) errors.push("Cena nie jest liczbą");

    if (errors.length > 0) {
      invalid.push({ ...row, errors });
      return;
    }

    valid.push({ sku: row.sku, product_id, price });
  });

  return { headers, parsed, valid, invalid };
}

export async function buildLocationsImportPreview(file, mappingConfig) {
  const { headers, data, rawRows = [] } = await parseTabularFile(file);

  const parsed = data.map((row, index) => ({
    code: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.code,
      fallbackAliases: ["code", "location", "lokalizacja"],
    }),
    zone: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.zone,
      fallbackAliases: ["zone", "strefa"],
    }),
    status:
      resolveMappedValue({
        row,
        rawRow: rawRows[index],
        fieldConfig: mappingConfig?.fields?.status,
        fallbackAliases: ["status"],
      }) || "active",
  }));

  validateLocations(parsed);

  return {
    headers,
    parsed,
    valid: parsed,
    invalid: [],
  };
}

export async function buildProductsImportPreview(file, mappingConfig) {
  const { headers, data, rawRows = [] } = await parseTabularFile(file);

  const parsed = data.map((row, index) => ({
    sku: resolveMappedValue({
      row,
      rawRow: rawRows[index],
      fieldConfig: mappingConfig?.fields?.sku,
      fallbackAliases: ["sku"],
    }),
    ean:
      resolveMappedValue({
        row,
        rawRow: rawRows[index],
        fieldConfig: mappingConfig?.fields?.ean,
        fallbackAliases: ["ean"],
      }) || null,
    name:
      resolveMappedValue({
        row,
        rawRow: rawRows[index],
        fieldConfig: mappingConfig?.fields?.name,
        fallbackAliases: ["name", "nazwa"],
      }) || null,
    status:
      resolveMappedValue({
        row,
        rawRow: rawRows[index],
        fieldConfig: mappingConfig?.fields?.status,
        fallbackAliases: ["status"],
      }) || "active",
  }));

  const valid = [];
  const invalid = [];
  const seen = new Set();

  parsed.forEach((row) => {
    const errors = [];

    if (!row.sku) {
      errors.push("Brak SKU");
    } else if (seen.has(row.sku)) {
      errors.push("Duplikat SKU w pliku");
    } else {
      seen.add(row.sku);
    }

    if (errors.length > 0) {
      invalid.push({ ...row, errors });
      return;
    }

    valid.push(row);
  });

  return { headers, parsed, valid, invalid };
}
