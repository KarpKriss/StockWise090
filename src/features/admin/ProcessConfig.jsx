export const processConfig = {
  location: {
    enabled: true,
    mandatory: true,
    label: "Lokalizacja",
  },

  ean: {
    enabled: true,
    mandatory: false,
    label: "EAN",
  },

  sku: {
    enabled: true,
    mandatory: true,
    label: "SKU",
  },

  lot: {
    enabled: true,
    mandatory: false,
    label: "LOT",
  },

  type: {
    enabled: true,
    mandatory: true,
    label: "Typ operacji",
  },

  quantity: {
    enabled: true,
    mandatory: true,
    label: "Ilość",
  },

  confirmation: {
    enabled: true,
    mandatory: false,
    label: "Potwierdzenie",
  },
};
