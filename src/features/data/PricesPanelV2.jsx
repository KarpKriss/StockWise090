import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
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
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

const COPY = {
  pl: {
    loadError: "Blad pobierania cen",
    loading: "Ladowanie cen...",
    importSuccess: "Dodano {{inserted}} nowych cen, pominieto {{skipped}} duplikatow.",
    invalidData: "Niepoprawne dane",
    confirmDelete: "Usunac cene dla {{sku}}?",
    invalidPrice: "Cena musi byc poprawna liczba",
    title: "Ceny",
    addLabel: "Dodaj cene",
    searchPlaceholder: "Szukaj po SKU lub cenie...",
    previewTitle: "Podglad importu cen",
    previewIntro: "Najpierw widzisz podsumowanie i probke danych. Po imporcie zapisane zostana tylko poprawne pozycje.",
    processingMessage: "Waliduje ceny i zapisuje nowe rekordy do bazy...",
    importLoading: "Analizuje plik cen i przygotowuje podglad importu...",
    promptSku: "Podaj SKU",
    promptPrice: "Podaj cene",
    columns: { sku: "SKU", price: "Cena" },
  },
  en: {
    loadError: "Could not load prices",
    loading: "Loading prices...",
    importSuccess: "Added {{inserted}} new prices, skipped {{skipped}} duplicates.",
    invalidData: "Invalid data",
    confirmDelete: "Delete price for {{sku}}?",
    invalidPrice: "Price must be a valid number",
    title: "Prices",
    addLabel: "Add price",
    searchPlaceholder: "Search by SKU or price...",
    previewTitle: "Price import preview",
    previewIntro: "First review the summary and sample rows. Only valid records will be saved.",
    processingMessage: "Validating prices and saving new records to the database...",
    importLoading: "Analyzing the price file and preparing the import preview...",
    promptSku: "Enter SKU",
    promptPrice: "Enter price",
    columns: { sku: "SKU", price: "Price" },
  },
  de: {
    loadError: "Preise konnten nicht geladen werden",
    loading: "Preise werden geladen...",
    importSuccess: "{{inserted}} neue Preise hinzugefugt, {{skipped}} Duplikate ubersprungen.",
    invalidData: "Ungultige Daten",
    confirmDelete: "Preis fur {{sku}} loschen?",
    invalidPrice: "Der Preis muss eine gultige Zahl sein",
    title: "Preise",
    addLabel: "Preis hinzufugen",
    searchPlaceholder: "Nach SKU oder Preis suchen...",
    previewTitle: "Importvorschau Preise",
    previewIntro: "Prufe zuerst die Zusammenfassung und Beispieldaten. Nur gultige Eintrage werden gespeichert.",
    processingMessage: "Preise werden validiert und neue Datensatze gespeichert...",
    importLoading: "Preisdatei wird analysiert und Importvorschau wird vorbereitet...",
    promptSku: "SKU eingeben",
    promptPrice: "Preis eingeben",
    columns: { sku: "SKU", price: "Preis" },
  },
};

export default function PricesPanel() {
  const { user } = useAuth();
  const { language } = useAppPreferences();
  const copy = COPY[language] || COPY.pl;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sku");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);
  const [importPreparing, setImportPreparing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadRows() {
    try {
      setLoading(true);
      setRows(await fetchPriceRows({ search, sortKey }));
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
        setImportPreparing(true);
        setPreview(await buildPricesImportPreview(file, getEntityMapping(mapping, "prices")?.import));
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
      const result = await insertNewPrices(preview.valid);
      alert(
        copy.importSuccess
          .replace("{{inserted}}", String(result.inserted || 0))
          .replace("{{skipped}}", String(result.skipped || 0))
      );
      setPreview(null);
      loadRows();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleAdd = async () => {
    const sku = window.prompt(copy.promptSku);
    const price = Number(window.prompt(copy.promptPrice));

    if (!sku || Number.isNaN(price)) {
      alert(copy.invalidData);
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
    if (!window.confirm(copy.confirmDelete.replace("{{sku}}", row.sku))) return;

    try {
      await deletePriceRow(row.id);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = async (row, newPrice) => {
    if (Number.isNaN(newPrice) || newPrice < 0) {
      alert(copy.invalidPrice);
      return;
    }

    try {
      await updatePriceRow(row.id, newPrice);
      loadRows();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>{copy.loading}</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
      <DataTablePanel
        title={copy.title}
        columns={[
          { key: "sku", label: copy.columns.sku },
          { key: "price", label: copy.columns.price },
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
        addLabel={copy.addLabel}
        pageSize={25}
        searchPlaceholder={copy.searchPlaceholder}
      />

      {preview && (
        <ImportPreviewModal
          title={copy.previewTitle}
          intro={copy.previewIntro}
          preview={preview}
          columns={[
            { key: "sku", label: copy.columns.sku },
            { key: "price", label: copy.columns.price },
          ]}
          getRowKey={(row, index) => `${row.sku || "sku"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) => row.sku || "(missing SKU)"}
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
