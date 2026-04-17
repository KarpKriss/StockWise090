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
import { useAppPreferences } from "../../core/preferences/AppPreferences";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

const COPY = {
  pl: {
    loadError: "Blad pobierania mapy magazynu",
    loading: "Ladowanie mapy magazynu...",
    importSuccess: "Zaimportowano {{count}} lokalizacji.",
    promptCode: "Kod lokalizacji",
    promptZone: "Strefa",
    title: "Mapa magazynu",
    resetAction: "Resetuj mape magazynu",
    addLabel: "Dodaj lokalizacje",
    searchPlaceholder: "Szukaj po kodzie lokalizacji...",
    previewTitle: "Podglad importu mapy magazynu",
    previewIntro: "Najpierw widzisz podsumowanie i probke lokalizacji. Import zapisze tylko poprawne rekordy, a duplikaty lub braki zostana pominiete.",
    deleteTitle: "Usun lokalizacje",
    deleteMessage: "Czy na pewno chcesz usunac lokalizacje {{code}}? Operacji nie da sie cofnac.",
    deleteConfirm: "Tak, usun lokalizacje",
    resetTitle: "Resetuj mape magazynu",
    resetMessage: "Czy na pewno chcesz zresetowac cala mape magazynu? Wszystkie lokalizacje zostana usuniete i konieczne bedzie ponowne wgranie mapy od zera.",
    resetConfirm: "Tak, resetuj mape",
    deleteSuccess: "Usunieto lokalizacje {{code}}.",
    resetSuccess: "Mapa magazynu zostala zresetowana. Aby pracowac dalej, wgraj nowy plik mapy.",
    actionError: "Nie udalo sie wykonac operacji na mapie magazynu",
    close: "Zamknij",
    cancel: "Anuluj",
    irreversible: "Ta operacja jest nieodwracalna. Przed potwierdzeniem upewnij sie, ze chcesz trwale usunac wskazane dane z mapy magazynu.",
    resetLoading: "Resetuje cala mape magazynu i czyszcze lokalizacje...",
    deleteLoading: "Usuwam wskazana lokalizacje z mapy magazynu...",
    importLoading: "Analizuje plik mapy magazynu i przygotowuje podglad importu...",
    processingMessage: "Resetuje mape i importuje nowy zestaw lokalizacji...",
    columns: { code: "Lokalizacja", zone: "Strefa", status: "Status" },
  },
  en: {
    loadError: "Could not load the warehouse map",
    loading: "Loading warehouse map...",
    importSuccess: "Imported {{count}} locations.",
    promptCode: "Location code",
    promptZone: "Zone",
    title: "Warehouse map",
    resetAction: "Reset warehouse map",
    addLabel: "Add location",
    searchPlaceholder: "Search by location code...",
    previewTitle: "Warehouse map import preview",
    previewIntro: "First you see the summary and sample locations. The import will save only valid records and skip duplicates or missing data.",
    deleteTitle: "Delete location",
    deleteMessage: "Are you sure you want to delete location {{code}}? This action cannot be undone.",
    deleteConfirm: "Yes, delete location",
    resetTitle: "Reset warehouse map",
    resetMessage: "Are you sure you want to reset the entire warehouse map? All locations will be removed and the map will need to be uploaded again from scratch.",
    resetConfirm: "Yes, reset map",
    deleteSuccess: "Deleted location {{code}}.",
    resetSuccess: "The warehouse map has been reset. Upload a new map file to continue working.",
    actionError: "Could not complete the warehouse map action",
    close: "Close",
    cancel: "Cancel",
    irreversible: "This action is irreversible. Before confirming, make sure you really want to permanently remove the selected data from the warehouse map.",
    resetLoading: "Resetting the full warehouse map and clearing locations...",
    deleteLoading: "Deleting the selected location from the warehouse map...",
    importLoading: "Analyzing the warehouse map file and preparing the import preview...",
    processingMessage: "Resetting the map and importing the new location set...",
    columns: { code: "Location", zone: "Zone", status: "Status" },
  },
  de: {
    loadError: "Lagerkarte konnte nicht geladen werden",
    loading: "Lagerkarte wird geladen...",
    importSuccess: "{{count}} Lokationen wurden importiert.",
    promptCode: "Lokationscode",
    promptZone: "Zone",
    title: "Lagerkarte",
    resetAction: "Lagerkarte zurucksetzen",
    addLabel: "Lokation hinzufugen",
    searchPlaceholder: "Nach Lokationscode suchen...",
    previewTitle: "Importvorschau Lagerkarte",
    previewIntro: "Zuerst siehst du die Zusammenfassung und eine Lokationsprobe. Der Import speichert nur gultige Datensatze und uberspringt Duplikate oder fehlende Werte.",
    deleteTitle: "Lokation loschen",
    deleteMessage: "Mochtest du die Lokation {{code}} wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.",
    deleteConfirm: "Ja, Lokation loschen",
    resetTitle: "Lagerkarte zurucksetzen",
    resetMessage: "Mochtest du die komplette Lagerkarte wirklich zurucksetzen? Alle Lokationen werden entfernt und die Karte muss anschliessend neu hochgeladen werden.",
    resetConfirm: "Ja, Karte zurucksetzen",
    deleteSuccess: "Lokation {{code}} wurde geloscht.",
    resetSuccess: "Die Lagerkarte wurde zuruckgesetzt. Lade eine neue Kartendatei hoch, um weiterzuarbeiten.",
    actionError: "Die Aktion fur die Lagerkarte konnte nicht ausgefuhrt werden",
    close: "Schliessen",
    cancel: "Abbrechen",
    irreversible: "Diese Aktion ist irreversibel. Vergewissere dich vor der Bestatigung, dass du die ausgewahlten Daten dauerhaft aus der Lagerkarte entfernen willst.",
    resetLoading: "Die gesamte Lagerkarte wird zuruckgesetzt und Lokationen werden entfernt...",
    deleteLoading: "Die ausgewahlte Lokation wird aus der Lagerkarte entfernt...",
    importLoading: "Datei der Lagerkarte wird analysiert und Importvorschau wird vorbereitet...",
    processingMessage: "Karte wird zuruckgesetzt und neuer Lokationssatz wird importiert...",
    columns: { code: "Lokation", zone: "Zone", status: "Status" },
  },
};

export default function WarehouseMapPanel() {
  const { user } = useAuth();
  const { language } = useAppPreferences();
  const copy = COPY[language] || COPY.pl;
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
      setError(err.message || copy.loadError);
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
      alert(copy.importSuccess.replace("{{count}}", String(preview.valid.length)));
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
    const code = window.prompt(copy.promptCode);
    const zone = window.prompt(copy.promptZone);

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
      title: copy.deleteTitle,
      message: copy.deleteMessage.replace("{{code}}", row.code),
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
        await deleteWarehouseLocation(confirmModal.row.id);
        alert(copy.deleteSuccess.replace("{{code}}", confirmModal.row.code));
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
        alert(copy.resetSuccess);
      }

      setConfirmModal(null);
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
          { key: "code", label: copy.columns.code },
          { key: "zone", label: copy.columns.zone },
          { key: "status", label: copy.columns.status },
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
            {copy.resetAction}
          </Button>
        }
        onDelete={openDeleteConfirm}
        onAdd={handleAdd}
        addLabel={copy.addLabel}
        page={page}
        onPageChange={setPage}
        hasNextPage={hasNextPage}
        pageSize={limit}
        searchPlaceholder={copy.searchPlaceholder}
      />

      {preview && (
        <ImportPreviewModal
          title={copy.previewTitle}
          intro={copy.previewIntro}
          preview={preview}
          columns={[
            { key: "code", label: copy.columns.code },
            { key: "zone", label: copy.columns.zone },
            { key: "status", label: copy.columns.status },
          ]}
          getRowKey={(row, index) => `${row.code || "code"}-${index}`}
          getRowValue={(row, key) => row[key] || "-"}
          getInvalidLabel={(row) => row.code || "(missing location)"}
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
              message={confirmModal.mode === "reset" ? copy.resetLoading : copy.deleteLoading}
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
