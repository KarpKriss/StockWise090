import React, { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import { exportToCSV } from "../../utils/csvExport";
import {
  deleteProductRow,
  fetchProductRows,
  insertProducts,
  resetProducts,
} from "../../core/api/dataSectionApi";
import { buildProductsImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

const COPY = {
  pl: {
    loadError: "Blad pobierania produktow",
    loading: "Ladowanie produktow...",
    importSuccess:
      "Dodano {{inserted}} nowych produktow, zaktualizowano {{updated}}, pominieto {{skipped}}. Bledne rekordy nie zostaly zaimportowane.",
    deleteTitle: "Usun produkt",
    deleteMessage: "Czy na pewno chcesz usunac produkt {{sku}}? Operacji nie da sie cofnac.",
    deleteConfirm: "Tak, usun produkt",
    resetTitle: "Resetuj produkty",
    resetMessage:
      "Czy na pewno chcesz usunac cala liste produktow? Po tej operacji konieczne bedzie ponowne wgranie produktow od zera.",
    resetConfirm: "Tak, resetuj produkty",
    deleteSuccess: "Usunieto produkt {{sku}}.",
    resetSuccess:
      "Lista produktow zostala zresetowana. Aby pracowac dalej, wgraj nowy plik produktow.",
    actionError: "Nie udalo sie wykonac operacji na produktach",
    title: "Produkty",
    resetAction: "Resetuj produkty",
    searchPlaceholder: "Szukaj po SKU, EAN, kodzie lub nazwie...",
    previewTitle: "Podglad importu produktow",
    previewIntro:
      "Sprawdz najpierw podsumowanie danych, a szczegoly bledow rozwin tylko wtedy, gdy sa potrzebne.",
    close: "Zamknij",
    irreversible:
      "Ta operacja jest nieodwracalna. Jesli produkt ma powiazane dane referencyjne lub ceny, baza moze zablokowac usuniecie i pokazac odpowiedni komunikat.",
    cancel: "Anuluj",
    resetLoading: "Czyszcze produkty oraz powiazane ceny i stock...",
    deleteLoading: "Usuwam produkt i jego powiazane dane...",
    importLoading: "Analizuje plik produktow i buduje podglad importu...",
    processingMessage: "Importuje produkty i odswiezam kartoteke referencyjna...",
    columns: {
      sku: "SKU",
      ean: "EAN / kody",
      name: "Nazwa",
      status: "Status",
    },
  },
  en: {
    loadError: "Could not load products",
    loading: "Loading products...",
    importSuccess:
      "Added {{inserted}} new products, updated {{updated}}, skipped {{skipped}}. Invalid rows were not imported.",
    deleteTitle: "Delete product",
    deleteMessage: "Are you sure you want to delete product {{sku}}? This action cannot be undone.",
    deleteConfirm: "Yes, delete product",
    resetTitle: "Reset products",
    resetMessage:
      "Are you sure you want to remove the full product list? After this operation you will need to upload products again from scratch.",
    resetConfirm: "Yes, reset products",
    deleteSuccess: "Deleted product {{sku}}.",
    resetSuccess:
      "The product list has been reset. Upload a new product file to continue working.",
    actionError: "Could not complete the product action",
    title: "Products",
    resetAction: "Reset products",
    searchPlaceholder: "Search by SKU, EAN, code or name...",
    previewTitle: "Product import preview",
    previewIntro:
      "Check the summary first and expand error details only when you really need them.",
    close: "Close",
    irreversible:
      "This action is irreversible. If the product has linked reference data or prices, the database may block deletion and show an appropriate message.",
    cancel: "Cancel",
    resetLoading: "Clearing products together with linked prices and stock...",
    deleteLoading: "Deleting the product and its related data...",
    importLoading: "Analyzing the product file and building the import preview...",
    processingMessage: "Importing products and refreshing the reference catalog...",
    columns: {
      sku: "SKU",
      ean: "EAN / codes",
      name: "Name",
      status: "Status",
    },
  },
  de: {
    loadError: "Produkte konnten nicht geladen werden",
    loading: "Produkte werden geladen...",
    importSuccess:
      "{{inserted}} neue Produkte hinzugefugt, {{updated}} aktualisiert, {{skipped}} ubersprungen. Fehlerhafte Zeilen wurden nicht importiert.",
    deleteTitle: "Produkt loschen",
    deleteMessage: "Mochtest du das Produkt {{sku}} wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.",
    deleteConfirm: "Ja, Produkt loschen",
    resetTitle: "Produkte zurucksetzen",
    resetMessage:
      "Mochtest du die gesamte Produktliste wirklich entfernen? Danach musst du die Produkte erneut von Grund auf importieren.",
    resetConfirm: "Ja, Produkte zurucksetzen",
    deleteSuccess: "Produkt {{sku}} wurde geloscht.",
    resetSuccess:
      "Die Produktliste wurde zuruckgesetzt. Lade eine neue Produktdatei hoch, um weiterzuarbeiten.",
    actionError: "Die Produktaktion konnte nicht ausgefuhrt werden",
    title: "Produkte",
    resetAction: "Produkte zurucksetzen",
    searchPlaceholder: "Nach SKU, EAN, Code oder Name suchen...",
    previewTitle: "Importvorschau Produkte",
    previewIntro:
      "Prufe zuerst die Zusammenfassung und offne Fehlerdetails nur dann, wenn du sie wirklich brauchst.",
    close: "Schliessen",
    irreversible:
      "Diese Aktion ist irreversibel. Wenn das Produkt verknupfte Referenzdaten oder Preise hat, kann die Datenbank das Loschen blockieren und eine passende Meldung anzeigen.",
    cancel: "Abbrechen",
    resetLoading: "Produkte sowie verknupfte Preise und Bestande werden bereinigt...",
    deleteLoading: "Produkt und verknupfte Daten werden geloscht...",
    importLoading: "Produktdatei wird analysiert und Importvorschau wird vorbereitet...",
    processingMessage: "Produkte werden importiert und der Referenzkatalog wird aktualisiert...",
    columns: {
      sku: "SKU",
      ean: "EAN / Codes",
      name: "Name",
      status: "Status",
    },
  },
};

export default function ProductsPanel() {
  const { user } = useAuth();
  const { language } = useAppPreferences();
  const copy = COPY[language] || COPY.pl;
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sku");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [importPreparing, setImportPreparing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      setProducts(await fetchProductRows({ search, sortKey }));
      setError("");
    } catch (err) {
      setError(err.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [search, sortKey]);

  useEffect(() => {
    async function loadMapping() {
      try {
        setMapping(await fetchImportExportMapping(user?.site_id || null));
      } catch (err) {
        console.error("PRODUCT MAPPING LOAD ERROR:", err);
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
        setPreview(await buildProductsImportPreview(file, getEntityMapping(mapping, "products")?.import));
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
      const result = await insertProducts(preview.valid);
      alert(
        copy.importSuccess
          .replace("{{inserted}}", String(result.inserted || 0))
          .replace("{{updated}}", String(result.updated || 0))
          .replace("{{skipped}}", String(result.skipped || 0))
      );
      setPreview(null);
      loadProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const openDeleteConfirm = (row) => {
    setConfirmModal({
      mode: "delete",
      title: copy.deleteTitle,
      message: copy.deleteMessage.replace("{{sku}}", row.sku),
      confirmLabel: copy.deleteConfirm,
      row,
    });
  };

  const openResetConfirm = () => {
    setConfirmModal({
      mode: "reset",
      title: copy.resetTitle,
      message: copy.resetMessage,
      confirmLabel: copy.resetConfirm,
    });
  };

  const closeConfirm = () => {
    if (!processing) {
      setConfirmModal(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;

    try {
      setProcessing(true);

      if (confirmModal.mode === "delete" && confirmModal.row?.id) {
        await deleteProductRow(confirmModal.row.id);
        alert(copy.deleteSuccess.replace("{{sku}}", confirmModal.row.sku));
      }

      if (confirmModal.mode === "reset") {
        await resetProducts();
        setSearch("");
        setSortKey("sku");
        alert(copy.resetSuccess);
      }

      setConfirmModal(null);
      await loadProducts();
    } catch (err) {
      alert(err.message || copy.actionError);
    } finally {
      setProcessing(false);
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
          { key: "ean", label: copy.columns.ean },
          { key: "name", label: copy.columns.name },
          { key: "status", label: copy.columns.status },
        ]}
        data={products}
        onSearchChange={setSearch}
        onSortChange={setSortKey}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: products,
            columns: getMappedExportColumns("products", mapping),
            fileName: "products.csv",
          })
        }
        extraActions={
          <Button variant="secondary" onClick={openResetConfirm}>
            {copy.resetAction}
          </Button>
        }
        onDelete={openDeleteConfirm}
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
            { key: "ean", label: copy.columns.ean },
            { key: "name", label: copy.columns.name },
            { key: "status", label: copy.columns.status },
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

      {confirmModal ? (
        <div className="history-modal-overlay" onClick={closeConfirm}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <div className="history-modal__header">
              <div>
                <h2 className="process-panel__title" style={{ fontSize: 26, margin: 0 }}>
                  {confirmModal.title}
                </h2>
                <p className="process-panel__subtitle">{confirmModal.message}</p>
              </div>
              <Button variant="secondary" onClick={closeConfirm} disabled={processing}>
                {copy.close}
              </Button>
            </div>

            <div className="app-card" style={{ marginTop: 16, border: "1px solid rgba(210, 76, 76, 0.18)" }}>
              {copy.irreversible}
            </div>

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button loading={processing} onClick={handleConfirmAction}>
                {confirmModal.confirmLabel}
              </Button>
              <Button variant="secondary" onClick={closeConfirm} disabled={processing}>
                {copy.cancel}
              </Button>
            </div>
            <LoadingOverlay
              open={processing}
              message={
                confirmModal.mode === "reset"
                  ? copy.resetLoading
                  : copy.deleteLoading
              }
            />
          </div>
        </div>
      ) : null}
      <LoadingOverlay
        open={importPreparing}
        fullscreen
        message={copy.importLoading}
      />
    </>
  );
}
