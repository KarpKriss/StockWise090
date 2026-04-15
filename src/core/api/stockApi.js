import { supabase } from "./supabaseClient";
import { applySiteFilter, readActiveSiteId } from "../auth/siteScope";

export async function fetchStock({ search = "", sort = null, siteId = readActiveSiteId() } = {}) {
 let query = applySiteFilter(supabase
  .from("stock")
  .select("location_id, product_id, quantity"), siteId);

 

  

  if (sort === "quantity") {
    query = query.order("quantity");
  }

  const { data, error } = await query;

  // 🔥 pobierz produkty
const { data: products } = await applySiteFilter(
  supabase.from("products").select("id, sku"),
  siteId
);

// 🔥 pobierz lokalizacje
const { data: locations } = await applySiteFilter(
  supabase.from("locations").select("id, code"),
  siteId
);

// 🔥 mapy
const productMap = Object.fromEntries(products.map(p => [p.id, p.sku]));
const locationMap = Object.fromEntries(locations.map(l => [l.id, l.code]));

  if (error) {
    console.error("FETCH ERROR:", error);
    throw new Error("Błąd pobierania stocku");
  }

  let result = data.map((row) => ({
  location: locationMap[row.location_id] || "BRAK",
  sku: productMap[row.product_id] || "BRAK",
  quantity: Number(row.quantity),
}));

  // 🔍 DRUGI ETAP – filtrowanie po location (frontend fallback)
  if (search) {
    const lower = search.toLowerCase();

    result = result.filter(
      (row) =>
        row.location.toLowerCase().includes(lower) ||
        row.sku.toLowerCase().includes(lower)
    );
  }

  return result;
}

export async function fetchPrices({ sort = null, search = "" } = {}) {
 let query = applySiteFilter(supabase
  .from("prices")
  .select("id, product_id, price, products:product_id(sku)"), readActiveSiteId());

const { data, error } = await query;

let result = data.map((row) => ({
  id: row.id,
  product_id: row.product_id,
  sku: row.products?.sku || "BRAK",
  price: Number(row.price)
}));

return result;
  console.log("RAW PRICES:", data);

  if (error) {
    console.error(error);
    throw new Error("Błąd pobierania cen");
  }

 return data.map((row) => ({
  sku: row.products?.sku || "BRAK",
  price: Number(row.price)
}));;
}

export async function updatePrice(id, price) {
  const { data, error } = await applySiteFilter(
    supabase.from("prices").update({ price }).eq("id", id).select(),
    readActiveSiteId()
  );

  if (error) {
    console.error(error);
    throw new Error("Błąd aktualizacji ceny");
  }

  return data;
}

export async function deletePrice(id) {
  const { error } = await applySiteFilter(
    supabase.from("prices").delete().eq("id", id),
    readActiveSiteId()
  );

  if (error) {
    console.error(error);
    throw new Error("Błąd usuwania ceny");
  }

  return { success: true };
}

export async function getProductBySku(sku) {
  const { data, error } = await applySiteFilter(
    supabase.from("products").select("id").eq("sku", sku),
    readActiveSiteId()
  ).single();

  if (error || !data) {
    throw new Error("Nie znaleziono SKU");
  }

  return data;
}
