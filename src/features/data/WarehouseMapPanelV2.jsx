import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import { exportToCSV } from "../../utils/csvExport";
import {
  addWarehouseLocation,
  fetchLocationsPage,
  replaceLocations,
} from "../../core/api/dataSectionApi";
import { buildLocationsImportPreview } from "../../core/upload/dataImports";

function ImportPreview({ preview, onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Podgląd importu mapy</h2>
        <p>Rekordy do importu: {preview.valid.length}</p>
        <pre style={preStyle}>{JSON.stringify(preview.parsed.slice(0, 20), null, 2)}</pre>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={onConfirm}>Zatwierdź import</button>
          <button onClick={onCancel}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

export default function WarehouseMapPanel() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("code");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const limit = 50;

  async function loadRows() {
    try {
      setLoading(true);
      const response = await fetchLocationsPage({
        page,
        limit,
        search,
        zone: zoneFilter,
        sortKey,
      });
      setRows(response.data);
      setTotalCount(response.count);
      setError("");
    } catch (err) {
      setError(err.message || "Błąd pobierania mapy magazynu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [page, search, zoneFilter, sortKey]);

  const openImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setPreview(await buildLocationsImportPreview(file));
      } catch (err) {
        alert(err.message);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      await replaceLocations(preview.valid);
      alert(`Zaimportowano ${preview.valid.length} lokalizacji.`);
      setPreview(null);
      setPage(1);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdd = async () => {
    const code = window.prompt("Kod lokalizacji");
    const zone = window.prompt("Strefa");

    if (!code || !zone) return;

    try {
      await addWarehouseLocation({ code, zone, status: "active" });
      setPage(1);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>Ładowanie mapy magazynu...</div>;
  if (error) return <div>{error}</div>;

  const zones = [...new Set(rows.map((row) => row.zone).filter(Boolean))].sort();
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <>
      <DataTablePanel
        title="Mapa magazynu"
        columns={[
          { key: "code", label: "Lokalizacja" },
          { key: "zone", label: "Strefa" },
          { key: "status", label: "Status" },
        ]}
        data={rows}
        onSearchChange={(value) => {
          setPage(1);
          setSearch(value);
        }}
        onSortChange={setSortKey}
        onLocationChange={(value) => {
          setPage(1);
          setZoneFilter(value);
        }}
        locationsList={zones}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: rows,
            columns: [
              { key: "code", label: "Lokalizacja" },
              { key: "zone", label: "Strefa" },
              { key: "status", label: "Status" },
            ],
            fileName: "warehouse-map.csv",
          })
        }
        onAdd={handleAdd}
        addLabel="Dodaj lokalizację"
        searchPlaceholder="Szukaj po kodzie lokalizacji..."
      />

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
        <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Prev
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          Next
        </button>
      </div>

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
