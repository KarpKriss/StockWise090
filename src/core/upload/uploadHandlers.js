import { supabase } from "../api/supabaseClient";
import { logStockImport } from "../logs/stockLogs";

export async function importStockFromCSV(file) {
  const text = await file.text();

  const rows = text.split("\n").map(r => r.trim()).filter(Boolean);

  const dataRows = rows.slice(1).map(row => {
    const values = row.split(",");
    return {
      location_code: values[0],
      sku: values[1],
      quantity: Number(values[2])
    };
  });

  const { data: locations } = await supabase.from("locations").select("id, code");
  const { data: products } = await supabase.from("products").select("id, sku");

  const locationMap = Object.fromEntries(locations.map(l => [l.code, l.id]));
  const productMap = Object.fromEntries(products.map(p => [p.sku, p.id]));

  const mapped = dataRows.map(row => ({
    location_id: locationMap[row.location_code],
    product_id: productMap[row.sku],
    quantity: row.quantity
  }));

  const invalid = dataRows.map((row, i) => {
  const mappedRow = mapped[i];

  const errors = [];

  if (!mappedRow.location_id) {
    errors.push("Nieznana lokalizacja");
  }

  if (!mappedRow.product_id) {
    errors.push("Nieznany SKU");
  }

  if (mappedRow.quantity === null || isNaN(mappedRow.quantity)) {
    errors.push("Niepoprawna ilość");
  }

  return {
    ...row,
    errors
  };
}).filter(r => r.errors.length > 0);

  return {
  parsed: dataRows,
  mapped,
  invalid
};
}

export async function saveStockToDB(mapped, invalid) {
  console.log("IMPORT START", mapped.length);
  // ❌ blokada jeśli są błędy
  if (invalid && invalid.length > 0) {
    throw new Error("Nie można zapisać – plik zawiera błędy");
  }

  // 🔒 UPSERT zamiast delete + insert
 // 🧹 KROK 1: usuń cały stock
const { error: deleteError } = await supabase
  .from("stock")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000"); // hack aby usunąć wszystko

if (deleteError) {
  console.error(deleteError);
  throw new Error("Błąd czyszczenia stock");
}
  console.log("STOCK WYCZYSZCZONY");

// 📥 KROK 2: insert nowych danych
const { error: insertError } = await supabase
  .from("stock")
  .insert(mapped);

if (insertError) {
  console.error(insertError);
  throw new Error("Błąd zapisu stock");
}
  console.log("STOCK ZAPISANY");

  if (error) {
    console.error(error);
    throw new Error("Błąd zapisu stock");
  }

  await logStockImport(mapped.length);
  
  return true;
}
