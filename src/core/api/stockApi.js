import { supabase } from "./supabaseClient";

export async function fetchStock({ search = "", sort = null } = {}) {
 let query = supabase
  .from("stock")
  .select("location_id, product_id, quantity");

 

  

  if (sort === "quantity") {
    query = query.order("quantity");
  }

  const { data, error } = await query;

  // 🔥 pobierz produkty
const { data: products } = await supabase
  .from("products")
  .select("id, sku");

// 🔥 pobierz lokalizacje
const { data: locations } = await supabase
  .from("locations")
  .select("id, code");

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
 let query = supabase
  .from("prices")
  .select("id, product_id, price, products:product_id(sku)");

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
  const { data, error } = await supabase
    .from("prices")
    .update({ price })
    .eq("id", id)
    .select();

  if (error) {
    console.error(error);
    throw new Error("Błąd aktualizacji ceny");
  }

  return data;
}

export async function deletePrice(id) {
  const { error } = await supabase.from("prices").delete().eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Błąd usuwania ceny");
  }

  return { success: true };
}

export async function getProductBySku(sku) {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("sku", sku)
    .single();

  if (error || !data) {
    throw new Error("Nie znaleziono SKU");
  }

  return data;
}
