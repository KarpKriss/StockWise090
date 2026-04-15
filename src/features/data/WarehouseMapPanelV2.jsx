import React, { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import LoadingOverlay from "../../components/loaders/LoadingOverlay";
import { exportToCSV } from "../../utils/csvExport";
import {
  addWarehouseLocation,
  deleteWarehouseLocation,
  fetchLocationZones,
  fetchLocationsPage,
  replaceLocations,
  resetWarehouseMap,
} from "../../core/api/dataSectionApi";
import { buildLocationsImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

export default function WarehouseMapPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("code");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [zones, setZones] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [importPreparing, setImportPreparing] = useState(false);
  const [importing, setImporting] = useState(false);
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
      setHasNextPage(Boolean(response.hasMore));
      setError("");
    } catch (err) {
      setError(err.message || "Blad pobierania mapy magazynu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [page, search, zoneFilter, sortKey]);

  useEffect(() => {
    async function loadZones() {
      try {
        setZones(await fetchLocationZones());
      } catch (err) {
        console.error("WAREHOUSE ZONES LOAD ERROR:", err);
      }
    }

    loadZones();
  }, []);

  async function refreshZones() {
    const nextZones = await fetchLocationZones();
    setZones(nextZones);
  }

  useEffect(() => {
    async function loadMapping() {
      try {
        setMapping(await fetchImportExportMapping(user?.site_id || null));
      } catch (err) {
        console.error("LOCATIONS MAPPING LOAD ERROR:", err);
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
        setPreview(await buildLocationsImportPreview(file, getEntityMapping(mapping, "locations")?.import));
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
      await replaceLocations(preview.valid);
      alert(`Zaimportowano ${preview.valid.length} lokalizacji.`);
      setPreview(null);
      setPage(1);
      await refreshZones();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleAdd = async () => {
    const code = window.prompt("Kod lokalizacji");
    const zone = window.prompt("Strefa");

    if (!code || !zone) return;

    try {
      await addWarehouseLocation({ code, zone, status: "active" });
      setPage(1);
      await refreshZones();
      if (page === 1) {
        await loadRows();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openDeleteConfirm = (row) => {
    setConfirmModal({
      mode: "delete",
      title: "Usun lokalizacje",
      message: `Czy na pewno chcesz usunac lokalizacje ${row.code}? Operacji nie da sie cofnac.`,
      confirmLabel: "Tak, usun lokalizacje",
      row,
    });
  };

  const openResetConfirm = () => {
    setConfirmModal({
      mode: "reset",
      title: "Resetuj mape magazynu",
      message:
        "Czy na pewno chcesz zresetowac cala mape magazynu? Wszystkie lokalizacje zostana usuniete i konieczne bedzie ponowne wgranie mapy od zera.",
      confirmLabel: "Tak, resetuj mape",
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
        await deleteWarehouseLocation(confirmModal.row.id);
        alert(`Usunieto lokalizacje ${confirmModal.row.code}.`);
        await refreshZones();
        if (page === 1) {
          await loadRows();
        }
      }

      if (confirmModal.mode === "reset") {
        await resetWarehouseMap();
        setPage(1);
        setSearch("");
        setZoneFilter("all");
        await refreshZones();
        alert("Mapa magazynu zostala zresetowana. Aby pracowac dalej, wgraj nowy plik mapy.");
      }

      setConfirmModal(null);
    } catch (err) {
      alert(err.message || "Nie udalo sie wykonac operacji na mapie magazynu");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Ladowanie mapy magazynu...</div>;
  if (error) return <div>{error}</div>;

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
        locationValue={zoneFilter}
        onImport={openImport}
        onExport={() =>
          exportToCSV({
            data: rows,
            columns: getMappedExportColumns("locations", mapping),
            fileName: "warehouse-map.csv",
          })
        }
        extraActions={
          <Button variant="secondary" onClick={openResetConfirm}>
            Resetuj mape magazynu
          </Button>
        }
        onDelete={openDeleteConfirm}
        onAdd={handleAdd}
        addLabel="Dodaj lokalizacje"
        page={page}
        onPageChange={setPage}
        hasNextPage={hasNextPage}
        pageSize={limit}
        searchPlaceholder="Szukaj po kodzie lokalizacji..."
      />

      {preview && (
        <ImportPreviewModal
          title="Podglad importu mapy magazynu"
          intro="Najpierw widzisz podsumowanie i probke lokalizacji. Import zapisze tylko poprawne rekordy, a duplikaty lub braki zostana pominiete."
          preview={preview}
          columns={[
            { key: "code", label: "Lokalizacja" },
            { key: "zone", label: "Strefa" },
            { key: "status", label: "Status" },
          ]}
          getRowKey={(row, index) => `${row.code || "code"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) => row.code || "(brak lokalizacji)"}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
          processing={importing}
          processingMessage="Resetuje mape i importuje nowy zestaw lokalizacji..."
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
              Ta operacja jest nieodwracalna. Przed potwierdzeniem upewnij sie, ze chcesz trwale
              usunac wskazane dane z mapy magazynu.
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
                  ? "Resetuje cala mape magazynu i czyszcze lokalizacje..."
                  : "Usuwam wskazana lokalizacje z mapy magazynu..."
              }
            />
          </div>
        </div>
      ) : null}
      <LoadingOverlay
        open={importPreparing}
        fullscreen
        message="Analizuje plik mapy magazynu i przygotowuje podglad importu..."
      />
    </>
  );
}
