import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import { exportToCSV } from "../../utils/csvExport";
import {
  addWarehouseLocation,
  fetchLocationsPage,
  replaceLocations,
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
  const [totalCount, setTotalCount] = useState(0);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);
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
      setError(err.message || "Blad pobierania mapy magazynu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [page, search, zoneFilter, sortKey]);

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
        setPreview(await buildLocationsImportPreview(file, getEntityMapping(mapping, "locations")?.import));
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

  if (loading) return <div>Ladowanie mapy magazynu...</div>;
  if (error) return <div>{error}</div>;

  const zones = [...new Set(rows.map((row) => row.zone).filter(Boolean))].sort();
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
            columns: getMappedExportColumns("locations", mapping),
            fileName: "warehouse-map.csv",
          })
        }
        onAdd={handleAdd}
        addLabel="Dodaj lokalizacje"
        page={page}
        totalCount={totalCount}
        onPageChange={setPage}
        pageSize={limit}
        searchPlaceholder="Szukaj po kodzie lokalizacji..."
      />

      {preview && (
        <ImportPreviewModal
          title="Podglad importu mapy magazynu"
          intro="Mapa magazynu nie pokazuje tu bledow rekord po rekordzie, ale nadal dostajesz probke danych przed zatwierdzeniem."
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
        />
      )}
    </>
  );
}
