import React, { useEffect, useMemo, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanel";
import { exportToCSV } from "../../utils/csvExport";
import { fetchStockRows, replaceStock } from "../../core/api/dataSectionApi";
import { buildStockImportPreview } from "../../core/upload/dataImports";

function ImportPreview({ preview, onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Podgląd importu stocku</h2>
        <p>Poprawne rekordy: {preview.valid.length}</p>
        <p>Błędne rekordy: {preview.invalid.length}</p>
        <table width="100%" border="1" cellPadding="6">
          <thead>
            <tr>
              <th>Lokalizacja</th>
              <th>SKU</th>
              <th>Ilość</th>
            </tr>
          </thead>
          <tbody>
            {preview.parsed.slice(0, 20).map((row, index) => {
              const invalid = preview.invalid.find(
                (item) => item.location_code === row.location_code && item.sku === row.sku
              );

              return (
                <tr key={`${row.location_code}-${row.sku}-${index}`} style={{ background: invalid ? "#ffe2e2" : "" }}>
                  <td>{row.location_code}</td>
                  <td>{row.sku}</td>
                  <td>{row.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {preview.invalid.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {preview.invalid.map((row, index) => (
              <div key={index}>
                {row.location_code || "(brak lokalizacji)"} / {row.sku || "(brak SKU)"} - {row.errors.join(", ")}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button disabled={preview.invalid.length > 0} onClick={onConfirm}>
            Zatwierdź import
          </button>
          <button onClick={onCancel}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

export default function StockPanel() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("location");
  const [locationFilter, setLocationFilter] = useState("all");
  const [skuFilter, setSkuFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchStockRows({ search, sortKey }));
      setError("");
    } catch (err) {
      setError(err.message || "Błąd pobierania stocku");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [search, sortKey]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesLocation = locationFilter === "all" || row.location === locationFilter;
        const matchesSku = skuFilter === "all" || row.sku === skuFilter;
        return matchesLocation && matchesSku;
      }),
    [rows, locationFilter, skuFilter]
  );

  const openImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setPreview(await buildStockImportPreview(file));
      } catch (err) {
        alert(err.message);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      await replaceStock(preview.valid);
      alert(`Zaimportowano ${preview.valid.length} rekordów stocku.`);
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>Ładowanie danych stock...</div>;
  if (error) return <div>{error}</div>;

  const locationsList = [...new Set(rows.map((row) => row.location))].sort();
  const skuList = [...new Set(rows.map((row) => row.sku))].sort();

  return (
    <>
      <DataTablePanel
        title="Stock"
        columns={[
          { key: "location", label: "Lokalizacja" },
          { key: "sku", label: "SKU" },
          { key: "quantity", label: "Ilość" },
        ]}
        data={filteredRows}
        onSearchChange={setSearch}
        onSortChange={setSortKey}
        onLocationChange={setLocationFilter}
        locationsList={locationsList}
        onSkuChange={setSkuFilter}
        skuList={skuList}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: filteredRows,
            columns: [
              { key: "location", label: "Lokalizacja" },
              { key: "sku", label: "SKU" },
              { key: "quantity", label: "Ilość" },
            ],
            fileName: "stock.csv",
          })
        }
        searchPlaceholder="Szukaj po lokalizacji lub SKU..."
      />

      {preview && (
        <ImportPreview preview={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
    </>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyle = {
  width: "min(980px, 92vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  padding: 24,
  borderRadius: 12,
};
