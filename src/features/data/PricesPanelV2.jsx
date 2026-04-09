import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanel";
import { exportToCSV } from "../../utils/csvExport";
import {
  createPriceRow,
  deletePriceRow,
  fetchPriceRows,
  insertNewPrices,
  updatePriceRow,
} from "../../core/api/dataSectionApi";
import { buildPricesImportPreview } from "../../core/upload/dataImports";

function ImportPreview({ preview, onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Podgląd importu cen</h2>
        <p>Poprawne rekordy: {preview.valid.length}</p>
        <p>Błędne rekordy: {preview.invalid.length}</p>
        <pre style={preStyle}>{JSON.stringify(preview.parsed.slice(0, 20), null, 2)}</pre>
        {preview.invalid.length > 0 && (
          <div>
            {preview.invalid.map((row, index) => (
              <div key={index}>
                {row.sku || "(brak SKU)"} - {row.errors.join(", ")}
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

export default function PricesPanel() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sku");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchPriceRows({ search, sortKey }));
      setError("");
    } catch (err) {
      setError(err.message || "Błąd pobierania cen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [search, sortKey]);

  const openImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setPreview(await buildPricesImportPreview(file));
      } catch (err) {
        alert(err.message);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      const result = await insertNewPrices(preview.valid);
      alert(`Dodano ${result.inserted} nowych cen, pominięto ${result.skipped} duplikatów.`);
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdd = async () => {
    const sku = window.prompt("Podaj SKU");
    const price = Number(window.prompt("Podaj cenę"));

    if (!sku || Number.isNaN(price)) {
      alert("Niepoprawne dane");
      return;
    }

    try {
      await createPriceRow({ sku, price });
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Usunąć cenę dla ${row.sku}?`)) return;

    try {
      await deletePriceRow(row.id);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = async (row, newPrice) => {
    if (Number.isNaN(newPrice) || newPrice < 0) {
      alert("Cena musi być poprawną liczbą");
      return;
    }

    try {
      await updatePriceRow(row.id, newPrice);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>Ładowanie cen...</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
      <DataTablePanel
        title="Ceny"
        columns={[
          { key: "sku", label: "SKU" },
          { key: "price", label: "Cena" },
        ]}
        data={rows}
        onSearchChange={setSearch}
        onSortChange={setSortKey}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: rows,
            columns: [
              { key: "sku", label: "SKU" },
              { key: "price", label: "Cena" },
            ],
            fileName: "prices.csv",
          })
        }
        onDelete={handleDelete}
        onEdit={handleEdit}
        onAdd={handleAdd}
        addLabel="Dodaj cenę"
        searchPlaceholder="Szukaj po SKU lub cenie..."
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
  width: "min(920px, 92vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  padding: 24,
  borderRadius: 12,
};

const preStyle = {
  maxHeight: 280,
  overflow: "auto",
  background: "#f5f5f5",
  padding: 12,
};
