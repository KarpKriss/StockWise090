export const IMPORT_EXPORT_ENTITIES = {
  products: {
    key: "products",
    title: "Produkty",
    description: "Mapowanie plikow z indeksami SKU, EAN i nazwami referencyjnymi.",
    supportsImport: true,
    supportsExport: true,
    importFields: [
      { key: "sku", label: "SKU", required: true, aliases: ["sku"] },
      { key: "ean", label: "EAN", required: false, aliases: ["ean"] },
      { key: "name", label: "Nazwa", required: false, aliases: ["name", "nazwa"] },
      { key: "status", label: "Status", required: false, aliases: ["status"] },
    ],
    exportFields: [
      { key: "sku", label: "SKU" },
      { key: "ean", label: "EAN" },
      { key: "name", label: "Nazwa" },
      { key: "status", label: "Status" },
    ],
  },
  stock: {
    key: "stock",
    title: "Stock",
    description: "Mapowanie stanów magazynowych po lokalizacji, SKU i ilości.",
    supportsImport: true,
    supportsExport: true,
    importFields: [
      { key: "location_code", label: "Lokalizacja", required: true, aliases: ["location_code", "location", "lokalizacja"] },
      { key: "sku", label: "SKU", required: true, aliases: ["sku"] },
      { key: "quantity", label: "Ilosc", required: true, aliases: ["quantity", "ilosc", "qty"] },
      { key: "zone", label: "Strefa", required: false, aliases: ["zone", "strefa"] },
    ],
    exportFields: [
      { key: "location", label: "Lokalizacja" },
      { key: "zone", label: "Strefa" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Ilosc" },
    ],
  },
  prices: {
    key: "prices",
    title: "Ceny",
    description: "Mapowanie cen wykorzystywanych w raportach finansowych.",
    supportsImport: true,
    supportsExport: true,
    importFields: [
      { key: "sku", label: "SKU", required: true, aliases: ["sku"] },
      { key: "price", label: "Cena", required: true, aliases: ["price", "cena"] },
    ],
    exportFields: [
      { key: "sku", label: "SKU" },
      { key: "price", label: "Cena" },
    ],
  },
  locations: {
    key: "locations",
    title: "Mapa magazynu",
    description: "Mapowanie kodow lokalizacji, stref i statusow operacyjnych.",
    supportsImport: true,
    supportsExport: true,
    importFields: [
      { key: "code", label: "Kod lokalizacji", required: true, aliases: ["code", "location", "lokalizacja"] },
      { key: "zone", label: "Strefa", required: true, aliases: ["zone", "strefa"] },
      { key: "status", label: "Status", required: false, aliases: ["status"] },
    ],
    exportFields: [
      { key: "code", label: "Lokalizacja" },
      { key: "zone", label: "Strefa" },
      { key: "status", label: "Status" },
    ],
  },
  corrections: {
    key: "corrections",
    title: "Historia",
    description: "Mapowanie naglowkow eksportu dla historii korekt i problemow.",
    supportsImport: false,
    supportsExport: true,
    importFields: [],
    exportFields: [
      { key: "created_at", label: "Data" },
      { key: "user_id", label: "Operator" },
      { key: "entry_id", label: "Entry ID" },
      { key: "reason", label: "Powod" },
      { key: "old_value", label: "Stara wartosc" },
      { key: "new_value", label: "Nowa wartosc" },
    ],
  },
};

function buildDefaultImportFields(entity) {
  return entity.importFields.reduce((acc, field) => {
    acc[field.key] = {
      mode: "header",
      value: field.aliases?.[0] || field.key,
    };
    return acc;
  }, {});
}

function buildDefaultExportColumns(entity) {
  return entity.exportFields.map((field, index) => ({
    id: `${entity.key}-${field.key}-${index}`,
    enabled: true,
    header: field.label,
    source: field.key,
  }));
}

export function getDefaultImportExportMapping() {
  return {
    version: 1,
    entities: Object.values(IMPORT_EXPORT_ENTITIES).reduce((acc, entity) => {
      acc[entity.key] = {
        import: {
          fields: buildDefaultImportFields(entity),
        },
        export: {
          columns: buildDefaultExportColumns(entity),
        },
      };
      return acc;
    }, {}),
  };
}

