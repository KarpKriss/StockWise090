import React, { useEffect, useMemo, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import { exportToCSV } from "../../utils/csvExport";
import { fetchStockRows, replaceStock } from "../../core/api/dataSectionApi";
import { buildStockImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

const COPY = {
  pl: {
    loadError: "Blad pobierania stocku",
    loading: "Ladowanie danych stock...",
    importSuccess: "Zaimportowano {{count}} rekordow stocku.",
    title: "Stock",
    searchPlaceholder: "Szukaj po lokalizacji, SKU, EAN lub LOT...",
    previewTitle: "Podglad importu stocku",
    previewIntro: "Import zaladuje tylko poprawne rekordy, a pozycje z bledami zostana pominiete.",
    processingMessage: "Czyszcze poprzedni stock i importuje nowy stan magazynu...",
    importLoading: "Analizuje plik stocku i buduje podglad importu...",
    columns: {
      location: "Lokalizacja",
      sku: "SKU",
      ean: "EAN",
      lot: "LOT",
      expiry: "Data waznosci",
      quantity: "Ilosc",
      zone: "Strefa",
    },
  },
  en: {
    loadError: "Could not load stock",
    loading: "Loading stock data...",
    importSuccess: "Imported {{count}} stock rows.",
    title: "Stock",
    searchPlaceholder: "Search by location, SKU, EAN or LOT...",
    previewTitle: "Stock import preview",
    previewIntro: "Only valid rows will be imported and rows with errors will be skipped.",
    processingMessage: "Clearing previous stock and importing the new warehouse state...",
    importLoading: "Analyzing the stock file and building the import preview...",
    columns: {
      location: "Location",
      sku: "SKU",
      ean: "EAN",
      lot: "LOT",
      expiry: "Expiry date",
      quantity: "Quantity",
      zone: "Zone",
    },
  },
  de: {
    loadError: "Bestand konnte nicht geladen werden",
    loading: "Bestandsdaten werden geladen...",
    importSuccess: "{{count}} Bestandszeilen wurden importiert.",
    title: "Bestand",
    searchPlaceholder: "Nach Lokation, SKU, EAN oder LOT suchen...",
    previewTitle: "Importvorschau Bestand",
    previewIntro: "Nur gultige Zeilen werden importiert, fehlerhafte Positionen werden ubersprungen.",
    processingMessage: "Vorheriger Bestand wird bereinigt und neuer Lagerbestand wird importiert...",
    importLoading: "Bestandsdatei wird analysiert und Importvorschau wird vorbereitet...",
    columns: {
      location: "Lokation",
      sku: "SKU",
      ean: "EAN",
      lot: "LOT",
      expiry: "Verfallsdatum",
      quantity: "Menge",
      zone: "Zone",
    },
  },
};

export default function StockPanel() {
  const { user } = useAuth();
  const { language } = useAppPreferences();
  const copy = COPY[language] || COPY.pl;
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
      setError(err.message || copy.loadError);
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
      alert(copy.importSuccess.replace("{{count}}", String(preview.valid.length)));
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div>{copy.loading}</div>;
  if (error) return <div>{error}</div>;

  const locationsList = [...new Set(rows.map((row) => row.location))].sort();
  const skuList = [...new Set(rows.map((row) => row.sku))].sort();

  return (
    <>
      <DataTablePanel
        title={copy.title}
        columns={[
          { key: "location", label: copy.columns.location },
          { key: "sku", label: copy.columns.sku },
          { key: "ean", label: copy.columns.ean },
          { key: "lot", label: copy.columns.lot },
          { key: "expiry_date", label: copy.columns.expiry },
          { key: "quantity", label: copy.columns.quantity },
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
        searchPlaceholder={copy.searchPlaceholder}
      />

      {preview && (
        <ImportPreviewModal
          title={copy.previewTitle}
          intro={copy.previewIntro}
          preview={preview}
          columns={[
            { key: "location_code", label: copy.columns.location },
            { key: "sku", label: copy.columns.sku },
            { key: "ean", label: copy.columns.ean },
            { key: "lot", label: copy.columns.lot },
            { key: "expiry_date", label: copy.columns.expiry },
            { key: "quantity", label: copy.columns.quantity },
            { key: "zone", label: copy.columns.zone },
          ]}
          getRowKey={(row, index) => `${row.location_code || "loc"}-${row.sku || "sku"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) =>
            `${row.location_code || "-"} / ${row.sku || "-"}`
          }
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
          processing={importing}
          processingMessage={copy.processingMessage}
        />
      )}
      <LoadingOverlay
        open={importPreparing}
        fullscreen
        message={copy.importLoading}
      />
    </>
  );
}
