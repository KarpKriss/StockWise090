import React, { useEffect, useState } from "react";
import { fetchStock } from "../../core/api/stockApi";
import DataPanel from "../../components/data/DataPanel";
import { importStockFromCSV } from "../../core/upload/uploadHandlers";
import { saveStockToDB } from "../../core/upload/uploadHandlers";

function StockPanel() {
  const [previewData, setPreviewData] = useState(null);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationsList, setLocationsList] = useState([]);
  const [skuFilter, setSkuFilter] = useState("all");
  const [skuList, setSkuList] = useState([]);

  // 🔥 LOAD DATA
useEffect(() => {
  const timeout = setTimeout(() => {
    setDebouncedSearch(search);
  }, 400); // możesz zmienić na 300–500

  return () => clearTimeout(timeout);
}, [search]);
  
useEffect(() => {
  const loadStock = async () => {
    try {
      setLoading(true);

   const effectiveSearch =
  debouncedSearch.length >= 2 ? debouncedSearch : "";

const data = await fetchStock({ search: effectiveSearch, sort });
    const uniqueSkus = [...new Set(data.map(row => row.sku))];
      setSkuList(uniqueSkus);
    const uniqueLocations = [...new Set(data.map(row => row.location))];
    setLocationsList(uniqueLocations);
      setStock(data || []);
    } catch (err) {
      setError("Nie udało się pobrać danych");
    } finally {
      setLoading(false);
    }
  };

  loadStock();
}, [debouncedSearch, sort]);

  // 🔄 LOADING
  if (loading) {
    return <div>Ładowanie danych stock...</div>;
  }

  // ❌ ERROR
  if (error) {
    return <div>{error}</div>;
  }

  // 📭 EMPTY
  if (!stock.length) {
    return <div>Brak danych stock</div>;
  }

  const filteredStock = stock.filter((row) => {
  const matchLocation =
    locationFilter === "all" || row.location === locationFilter;

  const matchSku =
    skuFilter === "all" || row.sku === skuFilter;

  return matchLocation && matchSku;
});
return (
  <>
    <DataPanel
      title="Stock"
      columns={[
        { key: "location", label: "Lokalizacja" },
        { key: "sku", label: "SKU" },
        { key: "quantity", label: "Ilość" }
      ]}
      data={filteredStock}
      onSearchChange={setSearch}
      onSortChange={setSort}
      onLocationChange={setLocationFilter}
      locationsList={locationsList}
      onSkuChange={setSkuFilter}
      skuList={skuList}
      onImport={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";

        input.onchange = async (e) => {
          const file = e.target.files[0];

          try {
            const result = await importStockFromCSV(file);
            setPreviewData(result);
          } catch (err) {
            alert(err.message);
          }
        };

        input.click();
      }}
      onExport={() => console.log("export stock")}
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
          <h2>Podgląd importu</h2>

          <p>Błędne rekordy: {previewData.invalid?.length || 0}</p>

          <table border="1" cellPadding="5" width="100%">
            <thead>
              <tr>
                <th>Location</th>
                <th>SKU</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
             {previewData.parsed.slice(0, 20).map((row, i) => {
  const errorRow = previewData.invalid.find(
    (r) => r.location_code === row.location_code && r.sku === row.sku
  );

  return (
    <tr key={i} style={{ background: errorRow ? "#ffcccc" : "white" }}>
      <td>{row.location_code}</td>
      <td>{row.sku}</td>
      <td>{row.quantity}</td>
    </tr>
  );
})}
            </tbody>
          </table>
          {previewData.invalid.length > 0 && (
  <div>
    <h3>Błędy:</h3>
    {previewData.invalid.map((row, i) => (
      <div key={i}>
        {row.location_code} / {row.sku} → {row.errors.join(", ")}
      </div>
    ))}
  </div>
)}

          <br />

          <button
            onClick={async () => {
              try {
                await saveStockToDB(previewData.mapped, previewData.invalid);
                alert("Zapisano dane");
                setPreviewData(null);

                // 🔄 odśwież dane bez reloadu
                const refreshed = await fetchStock();
                setStock(refreshed);
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

export default StockPanel;
