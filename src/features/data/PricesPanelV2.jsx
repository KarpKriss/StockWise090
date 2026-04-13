import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import { exportToCSV } from "../../utils/csvExport";
import {
  createPriceRow,
  deletePriceRow,
  fetchPriceRows,
  insertNewPrices,
  updatePriceRow,
} from "../../core/api/dataSectionApi";
import { buildPricesImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

export default function PricesPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sku");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchPriceRows({ search, sortKey }));
      setError("");
    } catch (err) {
      setError(err.message || "Blad pobierania cen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [search, sortKey]);

  useEffect(() => {
    async function loadMapping() {
      try {
        setMapping(await fetchImportExportMapping(user?.site_id || null));
      } catch (err) {
        console.error("PRICES MAPPING LOAD ERROR:", err);
      }
    }

    loadMapping();
  }, [user?.site_id]);

  const openImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xlsx";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setPreview(await buildPricesImportPreview(file, getEntityMapping(mapping, "prices")?.import));
      } catch (err) {
        alert(err.message);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      const result = await insertNewPrices(preview.valid);
      alert(`Dodano ${result.inserted} nowych cen, pominieto ${result.skipped} duplikatow.`);
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdd = async () => {
    const sku = window.prompt("Podaj SKU");
    const price = Number(window.prompt("Podaj cene"));

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
    if (!window.confirm(`Usunac cene dla ${row.sku}?`)) return;

    try {
      await deletePriceRow(row.id);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = async (row, newPrice) => {
    if (Number.isNaN(newPrice) || newPrice < 0) {
      alert("Cena musi byc poprawna liczba");
      return;
    }

    try {
      await updatePriceRow(row.id, newPrice);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>Ladowanie cen...</div>;
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
            columns: getMappedExportColumns("prices", mapping),
            fileName: "prices.csv",
          })
        }
        onDelete={handleDelete}
        onEdit={handleEdit}
        onAdd={handleAdd}
        addLabel="Dodaj cene"
        pageSize={25}
        searchPlaceholder="Szukaj po SKU lub cenie..."
      />

      {preview && (
        <ImportPreviewModal
          title="Podglad importu cen"
          intro="Najpierw widzisz podsumowanie i probke danych. Po imporcie zapisane zostana tylko poprawne pozycje."
          preview={preview}
          columns={[
            { key: "sku", label: "SKU" },
            { key: "price", label: "Cena" },
          ]}
          getRowKey={(row, index) => `${row.sku || "sku"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) => row.sku || "(brak SKU)"}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
