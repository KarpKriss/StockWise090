import React, { useEffect, useMemo, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import { exportToCSV } from "../../utils/csvExport";
import { fetchStockRows, replaceStock } from "../../core/api/dataSectionApi";
import { buildStockImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

export default function StockPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("location");
  const [locationFilter, setLocationFilter] = useState("all");
  const [skuFilter, setSkuFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);
  const [importPreparing, setImportPreparing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchStockRows({ search, sortKey }));
      setError("");
    } catch (err) {
      setError(err.message || "Blad pobierania stocku");
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
        console.error("STOCK MAPPING LOAD ERROR:", err);
      }
    }

    loadMapping();
  }, [user?.site_id]);

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
        setImportPreparing(true);
        setPreview(await buildStockImportPreview(file, getEntityMapping(mapping, "stock")?.import));
      } catch (err) {
        alert(err.message);
      } finally {
        setImportPreparing(false);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      setImporting(true);
      await replaceStock(preview.valid);
      alert(`Zaimportowano ${preview.valid.length} rekordow stocku.`);
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div>Ladowanie danych stock...</div>;
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
          { key: "quantity", label: "Ilosc" },
        ]}
        data={filteredRows}
        onSearchChange={setSearch}
        onSortChange={setSortKey}
        onLocationChange={setLocationFilter}
        locationsList={locationsList}
        locationValue={locationFilter}
        onSkuChange={setSkuFilter}
        skuList={skuList}
        skuValue={skuFilter}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: filteredRows,
            columns: getMappedExportColumns("stock", mapping),
            fileName: "stock.csv",
          })
        }
        pageSize={25}
        searchPlaceholder="Szukaj po lokalizacji lub SKU..."
      />

      {preview && (
        <ImportPreviewModal
          title="Podglad importu stocku"
          intro="Import załaduje tylko poprawne rekordy, a pozycje z bledami zostana pominięte."
          preview={preview}
          columns={[
            { key: "location_code", label: "Lokalizacja" },
            { key: "sku", label: "SKU" },
            { key: "quantity", label: "Ilosc" },
            { key: "zone", label: "Strefa" },
          ]}
          getRowKey={(row, index) => `${row.location_code || "loc"}-${row.sku || "sku"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) =>
            `${row.location_code || "(brak lokalizacji)"} / ${row.sku || "(brak SKU)"}`
          }
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
          processing={importing}
          processingMessage="Czyszcze poprzedni stock i importuje nowy stan magazynu..."
        />
      )}
      <LoadingOverlay
        open={importPreparing}
        fullscreen
        message="Analizuje plik stocku i buduje podglad importu..."
      />
    </>
  );
}
