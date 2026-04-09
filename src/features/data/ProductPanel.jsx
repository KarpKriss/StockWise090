import React, { useEffect, useState } from "react";
import { getProducts } from "../../core/api/productApi";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings } from "lucide-react";
import DataPanel from "../../components/data/DataPanel";
import { exportToCSV } from "../../utils/csvExport";
import { parseCSV } from "../../utils/csvImport";
import { validateImportData } from "../../utils/importValidators";
import { supabase } from "../../core/api/supabaseClient";

function ProductsPanel() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("sku");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importErrors, setImportErrors] = useState([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);

        const data = await getProducts();

        console.log("PRODUCTS:", data);

        setProducts(data || []);
      } catch (err) {
        console.error("PRODUCT LOAD ERROR:", err);
        setError("Nie udało się pobrać produktów");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  if (loading) return <div>Ładowanie produktów...</div>;
  if (error) return <div>{error}</div>;
  if (!products.length) return <div>Brak produktów</div>;

  const handleImport = async (file) => {
  try {
    const { data } = await parseCSV(file);

    const { validData, errors } = validateImportData({
      data,
      requiredFields: ["sku"],
      uniqueField: "sku"
    });

    console.log("IMPORT PREVIEW:", validData);
    console.log("IMPORT ERRORS:", errors);

    setImportPreview(validData);
    setImportErrors(errors);

  } catch (err) {
    alert("Błąd wczytywania pliku");
    console.error(err);
  }
};

const confirmImport = async () => {
  try {
    if (!importPreview?.length) return;

// 🔹 1. pobierz istniejące SKU z bazy
const { data: existingProducts, error: fetchError } = await supabase
  .from("products")
  .select("sku");

if (fetchError) throw fetchError;

const existingSkuSet = new Set(existingProducts.map(p => p.sku));

// 🔹 2. podziel dane
const newProducts = [];
const skipped = [];

importPreview.forEach(row => {
  if (existingSkuSet.has(row.sku)) {
    skipped.push(row.sku);
  } else {
    newProducts.push({
      sku: row.sku,
      ean: row.ean || null,
      status: "pending"
    });
  }
});

// 🔹 3. insert tylko nowych
if (newProducts.length > 0) {
  const { error } = await supabase
    .from("products")
    .insert(newProducts);

  if (error) throw error;
}

// 🔹 4. feedback
alert(`
Nowe produkty: ${newProducts.length}
Pominięte (duplikaty): ${skipped.length}
`);

    setImportPreview(null);
    setImportErrors([]);

    // reload
    const data = await getProducts();
    setProducts(data);

  } catch (err) {
    alert("Błąd zapisu");
    console.error(err);
  }
};
  
const handleExport = () => {
  exportToCSV({
    data: products,
    columns: [
      { key: "sku", label: "SKU" },
      { key: "ean", label: "EAN" }
    ],
    fileName: "products.csv"
  });
};
  if (importPreview) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Podgląd importu</h2>

      <p>Poprawne rekordy: {importPreview.length}</p>
      <p>Błędy: {importErrors.length}</p>

      <button onClick={confirmImport}>
        Zatwierdź import
      </button>

      <button onClick={() => setImportPreview(null)}>
        Anuluj
      </button>

      <pre style={{ marginTop: 20, maxHeight: 300, overflow: "auto" }}>
        {JSON.stringify(importPreview.slice(0, 20), null, 2)}
      </pre>
    </div>
  );
}
return (
  <DataPanel
    title="Produkty"
    columns={[
      { key: "sku", label: "SKU" },
      { key: "ean", label: "EAN" }
    ]}
    data={products}
   onImport={() => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.onchange = (e) => {
    const file = e.target.files[0];
    handleImport(file);
  };

  input.click();
}}
    onExport={handleExport}
  />
);
;}

export default ProductsPanel;
