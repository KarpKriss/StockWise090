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
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

export default function ProductsPanel() {
  const { user } = useAuth();
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
      setError(err.message || "Blad pobierania produktow");
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
        `Dodano ${result.inserted} nowych produktow, pominieto ${result.skipped}. Bledne rekordy nie zostaly zaimportowane.`
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
      title: "Usun produkt",
      message: `Czy na pewno chcesz usunac produkt ${row.sku}? Operacji nie da sie cofnac.`,
      confirmLabel: "Tak, usun produkt",
      row,
    });
  };

  const openResetConfirm = () => {
    setConfirmModal({
      mode: "reset",
      title: "Resetuj produkty",
      message:
        "Czy na pewno chcesz usunac cala liste produktow? Po tej operacji konieczne bedzie ponowne wgranie produktow od zera.",
      confirmLabel: "Tak, resetuj produkty",
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
        alert(`Usunieto produkt ${confirmModal.row.sku}.`);
      }

      if (confirmModal.mode === "reset") {
        await resetProducts();
        setSearch("");
        setSortKey("sku");
        alert("Lista produktow zostala zresetowana. Aby pracowac dalej, wgraj nowy plik produktow.");
      }

      setConfirmModal(null);
      await loadProducts();
    } catch (err) {
      alert(err.message || "Nie udalo sie wykonac operacji na produktach");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Ladowanie produktow...</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
      <DataTablePanel
        title="Produkty"
        columns={[
          { key: "sku", label: "SKU" },
          { key: "ean", label: "EAN" },
          { key: "name", label: "Nazwa" },
          { key: "status", label: "Status" },
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
            Resetuj produkty
          </Button>
        }
        onDelete={openDeleteConfirm}
        pageSize={25}
        searchPlaceholder="Szukaj po SKU, EAN lub nazwie..."
      />

      {preview && (
        <ImportPreviewModal
          title="Podglad importu produktow"
          intro="Sprawdz najpierw podsumowanie danych, a szczegoly bledow rozwin tylko wtedy, gdy sa potrzebne."
          preview={preview}
          columns={[
            { key: "sku", label: "SKU" },
            { key: "ean", label: "EAN" },
            { key: "name", label: "Nazwa" },
            { key: "status", label: "Status" },
          ]}
          getRowKey={(row, index) => `${row.sku || "sku"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) => row.sku || "(brak SKU)"}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
          processing={importing}
          processingMessage="Importuje produkty i odswiezam kartoteke referencyjna..."
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
                Zamknij
              </Button>
            </div>

            <div className="app-card" style={{ marginTop: 16, border: "1px solid rgba(210, 76, 76, 0.18)" }}>
              Ta operacja jest nieodwracalna. Jesli produkt ma powiazane dane referencyjne lub ceny,
              baza moze zablokowac usuniecie i pokazac odpowiedni komunikat.
            </div>

            <div className="process-actions" style={{ marginTop: 20 }}>
              <Button loading={processing} onClick={handleConfirmAction}>
                {confirmModal.confirmLabel}
              </Button>
              <Button variant="secondary" onClick={closeConfirm} disabled={processing}>
                Anuluj
              </Button>
            </div>
            <LoadingOverlay
              open={processing}
              message={
                confirmModal.mode === "reset"
                  ? "Czyszcze produkty oraz powiazane ceny i stock..."
                  : "Usuwam produkt i jego powiazane dane..."
              }
            />
          </div>
        </div>
      ) : null}
      <LoadingOverlay
        open={importPreparing}
        fullscreen
        message="Analizuje plik produktow i buduje podglad importu..."
      />
    </>
  );
}
