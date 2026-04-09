import { supabase } from "../api/supabaseClient";
import { parseTabularFile } from "../../utils/tabularFile";
import { validateLocations } from "../utils/validators";

function requireHeaders(headers, requiredHeaders) {
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`Brak wymaganych kolumn: ${missingHeaders.join(", ")}`);
  }
}

export async function buildStockImportPreview(file) {
  const { headers, data } = await parseTabularFile(file);
  requireHeaders(headers, ["location_code", "sku", "quantity"]);

  const parsed = data.map((row) => ({
    location_code: String(row.location_code || row.location || "").trim(),
    sku: String(row.sku || "").trim(),
    quantity: String(row.quantity || "").trim(),
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

export async function buildPricesImportPreview(file) {
  const { headers, data } = await parseTabularFile(file);
  requireHeaders(headers, ["sku", "price"]);

  const { data: products } = await supabase.from("products").select("id, sku");
  const productMap = Object.fromEntries((products || []).map((row) => [row.sku, row.id]));
  const parsed = data.map((row) => ({
    sku: String(row.sku || "").trim(),
    price: String(row.price || "").trim(),
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

export async function buildLocationsImportPreview(file) {
  const { headers, data } = await parseTabularFile(file);
  requireHeaders(headers, ["code", "zone"]);

  const parsed = data.map((row) => ({
    code: String(row.code || "").trim(),
    zone: String(row.zone || "").trim(),
    status: String(row.status || "active").trim() || "active",
  }));

  validateLocations(parsed);

  return {
    headers,
    parsed,
    valid: parsed,
    invalid: [],
  };
}

export async function buildProductsImportPreview(file) {
  const { headers, data } = await parseTabularFile(file);
  requireHeaders(headers, ["sku"]);

  const parsed = data.map((row) => ({
    sku: String(row.sku || "").trim(),
    ean: String(row.ean || "").trim() || null,
    name: String(row.name || "").trim() || null,
    status: String(row.status || "active").trim() || "active",
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
