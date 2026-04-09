import React, { useState, useEffect } from "react";
import { fetchLocations } from "../../core/api/locationApi";
import DataPanel from "../../components/data/DataPanel";
import { handleLocationsUpload } from "../../core/upload/locationsUploadHandler";
import { exportToCSV } from "../../utils/csvExport";
import { addLocation } from "../../core/api/locationApi";


function WarehouseMapPanel() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [sortKey, setSortKey] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;
  

  useEffect(() => {
    const loadLocations = async () => {
  try {
    setLoading(true);

   const response = await fetchLocations({
  page,
  limit,
  search,
  zone: zoneFilter,
  sortKey,
  sortOrder: "asc"
});

    console.log("LOCATIONS PAGE:", response);

    setLocations(response.data || []);
    setTotalCount(response.count || 0);

  } catch (err) {
    console.error(err);
    setError("Błąd pobierania lokalizacji");
  } finally {
    setLoading(false);
  }
};

    loadLocations();
    
  }, [page, search, zoneFilter, sortKey]);

  const handleAddLocation = async () => {
  const code = prompt("Kod lokalizacji:");
  const zone = prompt("Strefa:");

  if (!code || !zone) return;

  try {
    await addLocation({ code, zone, status: "active" });

    const response = await fetchLocations({ page: 1, limit });
setLocations(response.data);
setTotalCount(response.count);
  } catch (err) {
    alert(err.message);
  }
};
  
const handleExport = () => {
  exportToCSV({
    data: locations,
    columns: [
      { key: "code", label: "Lokalizacja" },
      { key: "zone", label: "Strefa" },
      { key: "status", label: "Status" }
    ],
    fileName: "locations.csv"
  });
};
  
  const handleImport = async (file) => {
    try {
      const count = await handleLocationsUpload(file);
      alert(`Zaimportowano ${count} lokalizacji`);
  
      // reload
      const response = await fetchLocations({ page: 1, limit });
setLocations(response.data);
setTotalCount(response.count);
    } catch (err) {
      alert(err.message);
    }
  };
  
const zones = [...new Set(locations.map(l => l.zone).filter(Boolean))];
  
  if (loading) return <div>Ładowanie lokalizacji...</div>;
  if (error) return <div>{error}</div>;
  if (!locations.length) return <div>Brak lokalizacji</div>;

const totalPages = Math.ceil(totalCount / limit);
  
  return (
  <>
    <DataPanel
      title="Mapa magazynu"
      columns={[
        { key: "code", label: "Lokalizacja" },
        { key: "zone", label: "Strefa" },
        { key: "status", label: "Status" }
      ]}
      data={locations}
      onSearchChange={setSearch}
      onSortChange={setSortKey}
      onLocationChange={setZoneFilter}
      locationsList={zones}
      onAdd={handleAddLocation}
      onImport={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";

        input.onchange = (e) => {
          const file = e.target.files[0];
          handleImport(file);
        };

        input.click();
      }}
      onExport={handleExport}
    />

   <div style={{ marginTop: 20 }}>
  <button
    onClick={() => setPage((p) => Math.max(p - 1, 1))}
    disabled={page === 1}
  >
    Prev
  </button>

  <span style={{ margin: "0 10px" }}>
    {page} / {totalPages}
  </span>

  <button
    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
    disabled={page === totalPages}
  >
    Next
  </button>
</div>
  </>
);
}

export default WarehouseMapPanel;
