import { supabase } from "../api/supabaseClient";

export async function importPricesFromCSV(file) {
  const text = await file.text();

  const rows = text.split("\n").map(r => r.trim()).filter(Boolean);

  const header = rows[0].split(",").map(h => h.trim().toLowerCase());

const expectedHeaders = ["sku", "price"];

const isValidHeader =
  expectedHeaders.every((h, i) => header[i] === h);

if (!isValidHeader) {
  throw new Error(
    "Niepoprawny format pliku. Oczekiwane kolumny: SKU, price"
  );
}

 const dataRows = rows.slice(1).map(row => {
  const values = row.split(",");

  return {
    sku: String(values[0] || "").trim(),
    price: values[1]
  };
});

  const { data: products } = await supabase
    .from("products")
    .select("id, sku");

  const productMap = Object.fromEntries(
    products.map(p => [p.sku, p.id])
  );

  const mapped = dataRows.map(row => ({
    product_id: productMap[row.sku],
    price: row.price
  }));

const valid = [];
const invalid = [];

dataRows.forEach((row, i) => {
  const mappedRow = mapped[i];
  const errors = [];

  const priceNumber = Number(row.price);

  if (!row.sku) {
    errors.push("Brak SKU");
  }

  if (!mappedRow.product_id) {
    errors.push("Nieznany SKU");
  }

  if (row.price === "" || row.price === null || row.price === undefined) {
    errors.push("Brak ceny");
  }

  if (isNaN(priceNumber)) {
    errors.push("Cena nie jest liczbą");
  }

  if (priceNumber > 100000) {
  errors.push("Cena podejrzanie wysoka");
}

  if (errors.length > 0) {
    invalid.push({
      ...row,
      errors
    });
  } else {
    valid.push({
      product_id: mappedRow.product_id,
      price: priceNumber
    });
  }
});

 return {
  parsed: dataRows,
  valid,
  invalid
};
}

export async function savePricesToDB(valid, invalid) {
  const { error } = await supabase
    .from("prices")
    .upsert(valid, {
      onConflict: "product_id"
    });

  if (invalid && invalid.length > 0) {
  throw new Error("Nie można zapisać – plik zawiera błędy");
}

  if (error) {
    console.error(error);
    throw new Error("Błąd zapisu cen");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

if (userError) {
  console.error("USER ERROR:", userError);
}

const { error: logError } = await supabase
  .from("import_logs")
  .insert({
    records_count: valid.length + (invalid?.length || 0),
  success_count: valid.length,
  failed_count: invalid?.length || 0,
  type: "prices",
    user_id: userData?.user?.id,
    created_at: new Date().toISOString()
  });

if (logError) {
  console.error("LOG ERROR:", logError);
}
  return true;
}
