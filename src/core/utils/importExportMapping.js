import { getDefaultImportExportMapping, IMPORT_EXPORT_ENTITIES } from "../config/importExportDefaults";

function normalizeHeaderKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "");
}

export function mergeImportExportMapping(storedMapping) {
  const defaults = getDefaultImportExportMapping();
  const next = {
    ...defaults,
    ...(storedMapping || {}),
    entities: {
      ...defaults.entities,
      ...(storedMapping?.entities || {}),
    },
  };

  Object.keys(defaults.entities).forEach((entityKey) => {
    const defaultEntity = defaults.entities[entityKey];
    const storedEntity = storedMapping?.entities?.[entityKey] || {};

    next.entities[entityKey] = {
      import: {
        ...defaultEntity.import,
        ...(storedEntity.import || {}),
        fields: {
          ...defaultEntity.import.fields,
          ...(storedEntity.import?.fields || {}),
        },
      },
      export: {
        ...defaultEntity.export,
        ...(storedEntity.export || {}),
        columns:
          storedEntity.export?.columns?.length > 0
            ? storedEntity.export.columns
            : defaultEntity.export.columns,
      },
    };
  });

  return next;
}

export function getEntityMapping(mapping, entityKey) {
  return mergeImportExportMapping(mapping).entities[entityKey];
}

export function getEntityDefinition(entityKey) {
  return IMPORT_EXPORT_ENTITIES[entityKey];
}

export function resolveMappedValue({ row, rawRow, fieldConfig, fallbackAliases = [] }) {
  const mode = fieldConfig?.mode || "header";
  const value = fieldConfig?.value;

  if (mode === "index") {
    const index = Number(value) - 1;
    return index >= 0 ? String(rawRow?.[index] ?? "").trim() : "";
  }

  if (mode === "header" && value) {
    return String(row?.[normalizeHeaderKey(value)] ?? "").trim();
  }

  for (const alias of fallbackAliases) {
    const candidate = String(row?.[normalizeHeaderKey(alias)] ?? "").trim();
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

export function getMappedExportColumns(entityKey, mapping) {
  const entity = getEntityDefinition(entityKey);
  const resolved = getEntityMapping(mapping, entityKey);
  const allowedSources = new Set(entity.exportFields.map((field) => field.key));
  const columns = resolved.export.columns
    .filter((column) => column.enabled !== false && allowedSources.has(column.source))
    .map((column) => ({
      key: column.source,
      label: column.header || entity.exportFields.find((field) => field.key === column.source)?.label || column.source,
    }));

  return columns.length > 0
    ? columns
    : entity.exportFields.map((field) => ({ key: field.key, label: field.label }));
}

