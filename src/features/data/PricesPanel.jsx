import React, { useEffect, useState } from "react";
import { fetchPrices } from "../../core/api/stockApi";
import DataPanel from "../../components/data/DataPanel";
import { importPricesFromCSV, savePricesToDB } from "../../core/upload/pricesUploadHandler";
import { updatePrice, deletePrice, getProductBySku } from "../../core/api/stockApi";


function PricesPanel() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [sort, setSort] = useState(null);
  const [search, setSearch] = useState("");

  const handleDelete = async (row) => {
  if (!window.confirm(`Usunąć ${row.sku}?`)) return;

  try {
    await deletePrice(row.id);

    setPrices(prev => prev.filter(p => p.id !== row.id));
  } catch (err) {
    alert("Błąd usuwania");
  }
};

  const handleEdit = async (row, newPrice) => {
  if (isNaN(newPrice) || newPrice < 0) {
    alert("Niepoprawna cena");
    return;
  }

  try {
    await updatePrice(row.id, newPrice);

    setPrices(prev =>
      prev.map(p =>
        p.id === row.id ? { ...p, price: newPrice } : p
      )
    );
  } catch (err) {
    alert("Błąd zapisu");
  }
};

  useEffect(() => {
    const loadPrices = async () => {
      try {
        setLoading(true);

       const data = await fetchPrices();

        console.log("PRICES:", data);

        let result = data || [];

// 🔍 SEARCH
if (search) {
  const lower = search.toLowerCase();

  result = result.filter(
    (row) =>
      row.sku.toLowerCase().includes(lower) ||
      String(row.price).includes(lower)
  );
}

// 🔽 SORT
if (sort === "price") {
  result = [...result].sort((a, b) => a.price - b.price);
}

if (sort === "sku") {
  result = [...result].sort((a, b) =>
    a.sku.localeCompare(b.sku)
  );
}

setPrices(result);
      } catch (err) {
        console.error(err);
        setError("Błąd pobierania cen");
      } finally {
        setLoading(false);
      }
    };

    loadPrices();
}, [sort, search]);

  if (loading) return <div>Ładowanie cen...</div>;
  if (error) return <div>{error}</div>;
  if (!prices.length) {
  console.log("Brak cen, ale panel działa");
}

  return (
  <>
    <button
  onClick={async () => {
    const sku = prompt("Podaj SKU");
    const price = Number(prompt("Podaj cenę"));

    if (!sku || isNaN(price)) {
      alert("Niepoprawne dane");
      return;
    }

    try {
      const product = await getProductBySku(sku);

        await updatePrice({
          product_id: product.id,
          price
        });
      setSort(null);
      setSearch("");
    } catch (err) {
      alert(err.message || "Błąd dodawania");
    }
  }}
>
  Dodaj cenę
</button>
    <DataPanel
      title="Ceny"
      columns={[
        { key: "sku", label: "SKU" },
        { key: "price", label: "Cena" }
      ]}
      data={prices}
      onSortChange={setSort}
      onSearchChange={setSearch}
      searchPlaceholder="Szukaj SKU lub ceny..."
      onDelete={handleDelete}
      onEdit={handleEdit}
      onImport={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";

        input.onchange = async (e) => {
          const file = e.target.files[0];

          try {
            const result = await importPricesFromCSV(file);
            setPreviewData(result);
          } catch (err) {
            alert(err.message);
          }
        };

        input.click();
      }}
      onExport={() => console.log("export prices")}
    />

    {previewData && (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000
      }}>
        <div style={{
          background: "white",
          width: "90%",
          height: "90%",
          padding: "20px",
          overflow: "auto"
        }}>
          <h2>Podgląd importu cen</h2>

            <p>
              Poprawne: {previewData.valid?.length || 0} | 
              Błędne: {previewData.invalid?.length || 0}
            </p>

          <table border="1" cellPadding="5" width="100%">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Cena</th>
              </tr>
            </thead>
            <tbody>
              {previewData.parsed.slice(0, 20).map((row, i) => {
                const errorRow = previewData.invalid?.find(
                  (r) => r.sku === row.sku
                );

                return (
                  <tr key={i} style={{ background: errorRow ? "#ffcccc" : "white" }}>
                    <td>{row.sku}</td>
                    <td>{row.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {previewData.invalid?.length > 0 && (
            <div>
              <h3>Błędy:</h3>
              {previewData.invalid.map((row, i) => (
                <div key={i}>
                  {row.sku} → {row.errors.join(", ")}
                </div>
              ))}
            </div>
          )}

          <br />

          <button
            disabled={previewData.invalid?.length > 0}
            onClick={async () => {
              try {
                await savePricesToDB(previewData.valid, previewData.invalid);
                alert(
                  `Zapisano: ${previewData.valid.length} | Błędy: ${previewData.invalid.length}`
                );
                
                setPreviewData(null);
                
                // 🔥 odśwież dane bez reloadu
                setSort(null);
                setSearch("");
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            Zatwierdź import
          </button>

          <button onClick={() => setPreviewData(null)}>
            Anuluj
          </button>
        </div>
      </div>
    )}
  </>
);
}
export default PricesPanel;
