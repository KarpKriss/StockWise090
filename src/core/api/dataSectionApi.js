import { supabase } from "./supabaseClient";
import { createImportLog } from "./importLogsApi";
import { applySiteFilter, ensureRowsScoped, readActiveSiteId } from "../auth/siteScope";

function normalizeSort(sortKey, fallback = "sku") {
  return sortKey || fallback;
}

export async function fetchStockRows({ search = "", sortKey = "location", siteId = readActiveSiteId() } = {}) {
  const [{ data: stock, error }, { data: products }, { data: locations }] =
    await Promise.all([
      applySiteFilter(supabase.from("stock").select("id, location_id, product_id, quantity"), siteId),
      applySiteFilter(supabase.from("products").select("id, sku"), siteId),
      applySiteFilter(supabase.from("locations").select("id, code, zone"), siteId),
    ]);

  if (error) {
    console.error("FETCH STOCK ERROR:", error);
    throw new Error("Blad pobierania stocku");
  }

  const productMap = Object.fromEntries((products || []).map((item) => [item.id, item]));
  const locationMap = Object.fromEntries((locations || []).map((item) => [item.id, item]));

  let rows = (stock || []).map((row) => ({
    id: row.id,
    location: locationMap[row.location_id]?.code || "BRAK",
    zone: locationMap[row.location_id]?.zone || "",
    sku: productMap[row.product_id]?.sku || "BRAK",
    quantity: Number(row.quantity || 0),
  }));

  if (search.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.location.toLowerCase().includes(needle) ||
        row.sku.toLowerCase().includes(needle)
    );
  }

  const sort = normalizeSort(sortKey, "location");
  rows = [...rows].sort((left, right) => {
    if (sort === "quantity") {
      return left.quantity - right.quantity;
    }

    return String(left[sort] || "").localeCompare(String(right[sort] || ""));
  });

  return rows;
}

export async function replaceStock(validRows, siteId = readActiveSiteId()) {
  const mergedRows = Array.from(
    validRows.reduce((accumulator, row) => {
      const key = `${row.location_id}::${row.product_id}`;
      const existing = accumulator.get(key);

      if (existing) {
        existing.quantity += Number(row.quantity || 0);
      } else {
        accumulator.set(key, {
          location_id: row.location_id,
          product_id: row.product_id,
          quantity: Number(row.quantity || 0),
        });
      }

      return accumulator;
    }, new Map()).values()
  );

  const { error: deleteError } = await applySiteFilter(
    supabase.from("stock").delete(),
    siteId
  ).neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("DELETE STOCK ERROR:", deleteError);
    throw new Error(deleteError.message || "Blad czyszczenia stocku");
  }

  if (mergedRows.length > 0) {
    const { error: insertError } = await supabase
      .from("stock")
      .insert(ensureRowsScoped(mergedRows, siteId));

    if (insertError) {
      console.error("INSERT STOCK ERROR:", insertError);
      throw new Error(insertError.message || "Blad importu stocku");
    }
  }

  try {
    await createImportLog("stock");
  } catch (error) {
    console.error("CREATE STOCK IMPORT LOG ERROR:", error);
    throw new Error(
      error instanceof Error ? error.message : "Blad zapisu logu importu stocku"
    );
  }
}

export async function fetchLocationsPage({
  page = 1,
  limit = 50,
  search = "",
  zone = "all",
  sortKey = "code",
  siteId = readActiveSiteId(),
}) {
  const from = (page - 1) * limit;
  const to = from + limit;
  let query = applySiteFilter(supabase.from("locations").select("*"), siteId);

  if (search.trim()) {
    query = query.ilike("code", `%${search.trim()}%`);
  }

  if (zone !== "all") {
    query = query.eq("zone", zone);
  }

  query = query.order(sortKey || "code", { ascending: true }).range(from, to);

  const { data, error } = await query;

  if (error) {
    console.error("FETCH LOCATIONS ERROR:", error);
    throw new Error("Blad pobierania lokalizacji");
  }

  const rows = data || [];
  const hasMore = rows.length > limit;

  return {
    data: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

export async function fetchLocationZones(siteId = readActiveSiteId()) {
  const { data, error } = await applySiteFilter(
    supabase.from("locations").select("zone"),
    siteId
  );

  if (error) {
    console.error("FETCH LOCATION ZONES ERROR:", error);
    throw new Error("Blad pobierania stref magazynu");
  }

  return [...new Set((data || []).map((row) => row.zone).filter(Boolean))].sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}

export async function replaceLocations(rows, siteId = readActiveSiteId()) {
  const { error: deleteError } = await applySiteFilter(
    supabase.from("locations").delete(),
    siteId
  ).not("id", "is", null);

  if (deleteError) {
    console.error("DELETE LOCATIONS ERROR:", deleteError);
    throw new Error(deleteError.message || "Blad czyszczenia mapy magazynu");
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("locations")
      .insert(ensureRowsScoped(rows, siteId));

    if (insertError) {
      console.error("INSERT LOCATIONS ERROR:", insertError);
      throw new Error(insertError.message || "Blad importu mapy magazynu");
    }
  }

  await createImportLog("locations");
}

export async function addWarehouseLocation({ code, zone, status = "active", siteId = readActiveSiteId() }) {
  const { error } = await supabase.from("locations").insert([{ code, zone, status, site_id: siteId }]);

  if (error) {
    console.error("ADD LOCATION ERROR:", error);
    throw new Error(error.message || "Blad dodawania lokalizacji");
  }
}

export async function deleteWarehouseLocation(id, siteId = readActiveSiteId()) {
  const { error } = await applySiteFilter(
    supabase.from("locations").delete().eq("id", id),
    siteId
  );

  if (error) {
    console.error("DELETE LOCATION ERROR:", error);
    throw new Error(error.message || "Blad usuwania lokalizacji");
  }
}

export async function resetWarehouseMap(siteId = readActiveSiteId()) {
  const { error } = await applySiteFilter(
    supabase.from("locations").delete(),
    siteId
  ).not("id", "is", null);

  if (error) {
    console.error("RESET LOCATIONS ERROR:", error);
    throw new Error("Blad resetowania mapy magazynu");
  }
}

export async function fetchPriceRows({ search = "", sortKey = "sku", siteId = readActiveSiteId() } = {}) {
  const { data, error } = await applySiteFilter(
    supabase.from("prices").select("id, product_id, price, products:product_id(sku)"),
    siteId
  );

  if (error) {
    console.error("FETCH PRICES ERROR:", error);
    throw new Error("Blad pobierania cen");
  }

  let rows = (data || []).map((row) => ({
    id: row.id,
    product_id: row.product_id,
    sku: row.products?.sku || "BRAK",
    price: Number(row.price || 0),
  }));

  if (search.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.sku.toLowerCase().includes(needle) ||
        String(row.price).includes(needle)
    );
  }

  rows = [...rows].sort((left, right) => {
    if (sortKey === "price") {
      return left.price - right.price;
    }

    return left.sku.localeCompare(right.sku);
  });

  return rows;
}

export async function updatePriceRow(id, price, siteId = readActiveSiteId()) {
  const { error } = await applySiteFilter(
    supabase.from("prices").update({ price }).eq("id", id),
    siteId
  );

  if (error) {
    console.error("UPDATE PRICE ERROR:", error);
    throw new Error("Blad aktualizacji ceny");
  }
}

export async function deletePriceRow(id, siteId = readActiveSiteId()) {
  const { error } = await applySiteFilter(
    supabase.from("prices").delete().eq("id", id),
    siteId
  );

  if (error) {
    console.error("DELETE PRICE ERROR:", error);
    throw new Error("Blad usuwania ceny");
  }
}

export async function createPriceRow({ sku, price, siteId = readActiveSiteId() }) {
  const { data: product, error: productError } = await applySiteFilter(
    supabase.from("products").select("id").eq("sku", sku),
    siteId
  ).single();

  if (productError || !product) {
    throw new Error("Nie znaleziono SKU");
  }

  const { data: existing } = await applySiteFilter(
    supabase.from("prices").select("id").eq("product_id", product.id),
    siteId
  ).maybeSingle();

  if (existing?.id) {
    throw new Error("Cena dla tego SKU juz istnieje");
  }

  const { error } = await supabase
    .from("prices")
    .insert([{ product_id: product.id, price, site_id: siteId }]);

  if (error) {
    console.error("CREATE PRICE ERROR:", error);
    throw new Error("Blad dodawania ceny");
  }
}

export async function insertNewPrices(rows, siteId = readActiveSiteId()) {
  const { data: existing } = await applySiteFilter(
    supabase.from("prices").select("product_id"),
    siteId
  );
  const existingIds = new Set((existing || []).map((row) => row.product_id));
  const newRows = rows.filter((row) => !existingIds.has(row.product_id));

  if (newRows.length > 0) {
    const { error } = await supabase.from("prices").insert(ensureRowsScoped(newRows, siteId));

    if (error) {
      console.error("INSERT PRICES ERROR:", error);
      throw new Error(error.message || "Blad importu cen");
    }
  }

  await createImportLog("prices");
  return { inserted: newRows.length, skipped: rows.length - newRows.length };
}

export async function fetchProductRows({ search = "", sortKey = "sku", siteId = readActiveSiteId() } = {}) {
  const { data, error } = await applySiteFilter(
    supabase.from("products").select("id, sku, ean, name, status"),
    siteId
  );

  if (error) {
    console.error("FETCH PRODUCTS ERROR:", error);
    throw new Error("Blad pobierania produktow");
  }

  let rows = data || [];

  if (search.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        String(row.sku || "").toLowerCase().includes(needle) ||
        String(row.ean || "").toLowerCase().includes(needle) ||
        String(row.name || "").toLowerCase().includes(needle)
    );
  }

  return [...rows].sort((left, right) =>
    String(left[sortKey] || "").localeCompare(String(right[sortKey] || ""))
  );
}

export async function insertProducts(rows, siteId = readActiveSiteId()) {
  const { data: existing } = await applySiteFilter(
    supabase.from("products").select("sku"),
    siteId
  );
  const existingSkus = new Set((existing || []).map((row) => row.sku));
  const newRows = rows.filter((row) => !existingSkus.has(row.sku));

  if (newRows.length > 0) {
    const { error } = await supabase.from("products").insert(ensureRowsScoped(newRows, siteId));

    if (error) {
      console.error("INSERT PRODUCTS ERROR:", error);
      throw new Error(error.message || "Blad importu produktow");
    }
  }

  await createImportLog("products");
  return { inserted: newRows.length, skipped: rows.length - newRows.length };
}

export async function deleteProductRow(id, siteId = readActiveSiteId()) {
  const { error: deletePricesError } = await applySiteFilter(
    supabase.from("prices").delete().eq("product_id", id),
    siteId
  );

  if (deletePricesError) {
    console.error("DELETE PRODUCT PRICES ERROR:", deletePricesError);
    throw new Error(deletePricesError.message || "Blad usuwania cen powiazanych z produktem");
  }

  const { error: deleteStockError } = await applySiteFilter(
    supabase.from("stock").delete().eq("product_id", id),
    siteId
  );

  if (deleteStockError) {
    console.error("DELETE PRODUCT STOCK ERROR:", deleteStockError);
    throw new Error(deleteStockError.message || "Blad usuwania stocku powiazanego z produktem");
  }

  const { error } = await applySiteFilter(
    supabase.from("products").delete().eq("id", id),
    siteId
  );

  if (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    throw new Error(error.message || "Blad usuwania produktu");
  }
}

export async function resetProducts(siteId = readActiveSiteId()) {
  const { error: deletePricesError } = await applySiteFilter(
    supabase.from("prices").delete(),
    siteId
  ).not("id", "is", null);

  if (deletePricesError) {
    console.error("RESET PRODUCT PRICES ERROR:", deletePricesError);
    throw new Error(deletePricesError.message || "Blad resetowania cen produktow");
  }

  const { error: deleteStockError } = await applySiteFilter(
    supabase.from("stock").delete(),
    siteId
  ).not("id", "is", null);

  if (deleteStockError) {
    console.error("RESET PRODUCT STOCK ERROR:", deleteStockError);
    throw new Error(deleteStockError.message || "Blad resetowania stocku powiazanego z produktami");
  }

  const { error } = await applySiteFilter(
    supabase.from("products").delete(),
    siteId
  ).not("id", "is", null);

  if (error) {
    console.error("RESET PRODUCTS ERROR:", error);
    throw new Error(error.message || "Blad resetowania listy produktow");
  }
}

export async function fetchCorrectionRows(siteId = readActiveSiteId()) {
  const { data, error } = await applySiteFilter(
    supabase
      .from("correction_log")
      .select("id, entry_id, user_id, reason, old_value, new_value, created_at")
      .order("created_at", { ascending: false }),
    siteId
  );

  if (error) {
    console.error("FETCH CORRECTIONS ERROR:", error);
    throw new Error("Blad pobierania historii korekt");
  }

  return data || [];
}
