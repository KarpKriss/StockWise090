import { supabase } from "./supabaseClient";
import { createImportLog } from "./importLogsApi";

function normalizeSort(sortKey, fallback = "sku") {
  return sortKey || fallback;
}

export async function fetchStockRows({ search = "", sortKey = "location" } = {}) {
  const [{ data: stock, error }, { data: products }, { data: locations }] =
    await Promise.all([
      supabase.from("stock").select("id, location_id, product_id, quantity"),
      supabase.from("products").select("id, sku"),
      supabase.from("locations").select("id, code, zone"),
    ]);

  if (error) {
    console.error("FETCH STOCK ERROR:", error);
    throw new Error("Błąd pobierania stocku");
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

export async function replaceStock(validRows) {
  const { error: deleteError } = await supabase
    .from("stock")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("DELETE STOCK ERROR:", deleteError);
    throw new Error("Błąd czyszczenia stocku");
  }

  if (validRows.length > 0) {
    const { error: insertError } = await supabase.from("stock").insert(validRows);

    if (insertError) {
      console.error("INSERT STOCK ERROR:", insertError);
      throw new Error("Błąd importu stocku");
    }
  }

  await createImportLog("stock");
}

export async function fetchLocationsPage({
  page = 1,
  limit = 50,
  search = "",
  zone = "all",
  sortKey = "code",
}) {
  const from = (page - 1) * limit;
  const to = from + limit;
  let query = supabase.from("locations").select("*");

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
    throw new Error("Błąd pobierania lokalizacji");
  }

  const rows = data || [];
  const hasMore = rows.length > limit;

  return {
    data: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

export async function fetchLocationZones() {
  const { data, error } = await supabase.from("locations").select("zone");

  if (error) {
    console.error("FETCH LOCATION ZONES ERROR:", error);
    throw new Error("Blad pobierania stref magazynu");
  }

  return [...new Set((data || []).map((row) => row.zone).filter(Boolean))].sort((left, right) =>
    String(left).localeCompare(String(right))
  );
}

export async function replaceLocations(rows) {
  const { error: deleteError } = await supabase
    .from("locations")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    console.error("DELETE LOCATIONS ERROR:", deleteError);
    throw new Error("Błąd czyszczenia mapy magazynu");
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("locations").insert(rows);

    if (insertError) {
      console.error("INSERT LOCATIONS ERROR:", insertError);
      throw new Error("Błąd importu mapy magazynu");
    }
  }

  await createImportLog("locations");
}

export async function addWarehouseLocation({ code, zone, status = "active" }) {
  const { error } = await supabase.from("locations").insert([{ code, zone, status }]);

  if (error) {
    console.error("ADD LOCATION ERROR:", error);
    throw new Error(error.message || "Błąd dodawania lokalizacji");
  }
}

export async function deleteWarehouseLocation(id) {
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    console.error("DELETE LOCATION ERROR:", error);
    throw new Error(error.message || "Blad usuwania lokalizacji");
  }
}

export async function resetWarehouseMap() {
  const { error } = await supabase
    .from("locations")
    .delete()
    .not("id", "is", null);

  if (error) {
    console.error("RESET LOCATIONS ERROR:", error);
    throw new Error("Blad resetowania mapy magazynu");
  }
}

export async function fetchPriceRows({ search = "", sortKey = "sku" } = {}) {
  const { data, error } = await supabase
    .from("prices")
    .select("id, product_id, price, products:product_id(sku)");

  if (error) {
    console.error("FETCH PRICES ERROR:", error);
    throw new Error("Błąd pobierania cen");
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

export async function updatePriceRow(id, price) {
  const { error } = await supabase.from("prices").update({ price }).eq("id", id);

  if (error) {
    console.error("UPDATE PRICE ERROR:", error);
    throw new Error("Błąd aktualizacji ceny");
  }
}

export async function deletePriceRow(id) {
  const { error } = await supabase.from("prices").delete().eq("id", id);

  if (error) {
    console.error("DELETE PRICE ERROR:", error);
    throw new Error("Błąd usuwania ceny");
  }
}

export async function createPriceRow({ sku, price }) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("sku", sku)
    .single();

  if (productError || !product) {
    throw new Error("Nie znaleziono SKU");
  }

  const { data: existing } = await supabase
    .from("prices")
    .select("id")
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing?.id) {
    throw new Error("Cena dla tego SKU już istnieje");
  }

  const { error } = await supabase
    .from("prices")
    .insert([{ product_id: product.id, price }]);

  if (error) {
    console.error("CREATE PRICE ERROR:", error);
    throw new Error("Błąd dodawania ceny");
  }
}

export async function insertNewPrices(rows) {
  const { data: existing } = await supabase.from("prices").select("product_id");
  const existingIds = new Set((existing || []).map((row) => row.product_id));
  const newRows = rows.filter((row) => !existingIds.has(row.product_id));

  if (newRows.length > 0) {
    const { error } = await supabase.from("prices").insert(newRows);

    if (error) {
      console.error("INSERT PRICES ERROR:", error);
      throw new Error("Błąd importu cen");
    }
  }

  await createImportLog("prices");
  return { inserted: newRows.length, skipped: rows.length - newRows.length };
}

export async function fetchProductRows({ search = "", sortKey = "sku" } = {}) {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, ean, name, status");

  if (error) {
    console.error("FETCH PRODUCTS ERROR:", error);
    throw new Error("Błąd pobierania produktów");
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

export async function insertProducts(rows) {
  const { data: existing } = await supabase.from("products").select("sku");
  const existingSkus = new Set((existing || []).map((row) => row.sku));
  const newRows = rows.filter((row) => !existingSkus.has(row.sku));

  if (newRows.length > 0) {
    const { error } = await supabase.from("products").insert(newRows);

    if (error) {
      console.error("INSERT PRODUCTS ERROR:", error);
      throw new Error("Błąd importu produktów");
    }
  }

  await createImportLog("products");
  return { inserted: newRows.length, skipped: rows.length - newRows.length };
}

export async function deleteProductRow(id) {
  const { error: deletePricesError } = await supabase.from("prices").delete().eq("product_id", id);

  if (deletePricesError) {
    console.error("DELETE PRODUCT PRICES ERROR:", deletePricesError);
    throw new Error(deletePricesError.message || "Blad usuwania cen powiazanych z produktem");
  }

  const { error: deleteStockError } = await supabase.from("stock").delete().eq("product_id", id);

  if (deleteStockError) {
    console.error("DELETE PRODUCT STOCK ERROR:", deleteStockError);
    throw new Error(deleteStockError.message || "Blad usuwania stocku powiazanego z produktem");
  }

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    throw new Error(error.message || "Blad usuwania produktu");
  }
}

export async function resetProducts() {
  const { error: deletePricesError } = await supabase
    .from("prices")
    .delete()
    .not("id", "is", null);

  if (deletePricesError) {
    console.error("RESET PRODUCT PRICES ERROR:", deletePricesError);
    throw new Error(deletePricesError.message || "Blad resetowania cen produktow");
  }

  const { error: deleteStockError } = await supabase
    .from("stock")
    .delete()
    .not("id", "is", null);

  if (deleteStockError) {
    console.error("RESET PRODUCT STOCK ERROR:", deleteStockError);
    throw new Error(deleteStockError.message || "Blad resetowania stocku powiazanego z produktami");
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .not("id", "is", null);

  if (error) {
    console.error("RESET PRODUCTS ERROR:", error);
    throw new Error(error.message || "Blad resetowania listy produktow");
  }
}

export async function fetchCorrectionRows() {
  const { data, error } = await supabase
    .from("correction_log")
    .select("id, entry_id, user_id, reason, old_value, new_value, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("FETCH CORRECTIONS ERROR:", error);
    throw new Error("Błąd pobierania historii korekt");
  }

  return data || [];
}
