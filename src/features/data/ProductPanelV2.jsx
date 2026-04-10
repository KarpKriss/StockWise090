import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import { exportToCSV } from "../../utils/csvExport";
import { fetchProductRows, insertProducts } from "../../core/api/dataSectionApi";
import { buildProductsImportPreview } from "../../core/upload/dataImports";
import { useAuth } from "../../core/auth/AppAuth";
import { fetchImportExportMapping } from "../../core/api/importExportConfigApi";
import { getEntityMapping, getMappedExportColumns } from "../../core/utils/importExportMapping";

function PreviewOverlay({ preview, onConfirm, onCancel }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Podglad importu produktow</h2>
        <p>Poprawne rekordy: {preview.valid.length}</p>
        <p>Bledne rekordy: {preview.invalid.length}</p>
        <pre style={preStyle}>{JSON.stringify(preview.parsed.slice(0, 20), null, 2)}</pre>
        {preview.invalid.length > 0 && (
          <div>
            {preview.invalid.map((row, index) => (
              <div key={index}>
                {row.sku || "(brak SKU)"} - {row.errors.join(", ")}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button disabled={preview.invalid.length > 0} onClick={onConfirm}>
            Zatwierdz import
          </button>
          <button onClick={onCancel}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPanel() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("sku");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState(null);

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
        setPreview(await buildProductsImportPreview(file, getEntityMapping(mapping, "products")?.import));
      } catch (err) {
        alert(err.message);
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    try {
      const result = await insertProducts(preview.valid);
      alert(`Dodano ${result.inserted} nowych produktow, pominieto ${result.skipped}.`);
      setPreview(null);
      loadProducts();
    } catch (err) {
      alert(err.message);
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
        searchPlaceholder="Szukaj po SKU, EAN lub nazwie..."
      />

      {preview && (
        <PreviewOverlay preview={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
    </>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalStyle = {
  width: "min(920px, 92vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  padding: 24,
  borderRadius: 12,
};

const preStyle = {
  maxHeight: 280,
  overflow: "auto",
  background: "#f5f5f5",
  padding: 12,
};
