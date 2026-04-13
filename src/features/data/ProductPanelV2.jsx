import React, { useEffect, useState } from "react";
import DataTablePanel from "../../components/data/DataTablePanelModern";
import ImportPreviewModal from "../../components/data/ImportPreviewModal";
import { exportToCSV } from "../../utils/csvExport";
import { fetchProductRows, insertProducts } from "../../core/api/dataSectionApi";
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
      alert(
        `Dodano ${result.inserted} nowych produktow, pominieto ${result.skipped}. Bledne rekordy nie zostaly zaimportowane.`
      );
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
        />
      )}
    </>
  );
}
