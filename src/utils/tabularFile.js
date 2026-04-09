const XML_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "");
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

async function parseCsvFile(file) {
  const text = await file.text();
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { headers: [], data: [] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const data = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").replace(/^"|"$/g, "").trim();
    });

    return row;
  });

  return { headers, data };
}

function getTextFromXmlNode(node) {
  if (!node) return "";
  return Array.from(node.childNodes || [])
    .map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return child.textContent || "";
      }

      return getTextFromXmlNode(child);
    })
    .join("");
}

function getColumnIndex(reference) {
  const letters = String(reference || "").replace(/\d/g, "");
  let index = 0;

  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }

  return index - 1;
}

async function inflateRaw(buffer) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ta przeglądarka nie obsługuje importu XLSX");
  }

  const stream = new Blob([buffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readUInt16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function readUInt32(data, offset) {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let eocdOffset = -1;

  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Nie udało się odczytać pliku XLSX");
  }

  const centralDirectorySize = readUInt32(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(bytes, eocdOffset + 16);
  const decoder = new TextDecoder("utf-8");
  const files = new Map();
  let pointer = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (pointer < end) {
    if (
      bytes[pointer] !== 0x50 ||
      bytes[pointer + 1] !== 0x4b ||
      bytes[pointer + 2] !== 0x01 ||
      bytes[pointer + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = readUInt16(bytes, pointer + 10);
    const compressedSize = readUInt32(bytes, pointer + 20);
    const fileNameLength = readUInt16(bytes, pointer + 28);
    const extraLength = readUInt16(bytes, pointer + 30);
    const commentLength = readUInt16(bytes, pointer + 32);
    const localHeaderOffset = readUInt32(bytes, pointer + 42);
    const fileName = decoder.decode(
      bytes.slice(pointer + 46, pointer + 46 + fileNameLength)
    );

    const localFileNameLength = readUInt16(bytes, localHeaderOffset + 26);
    const localExtraLength = readUInt16(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

    let contentBytes;
    if (compressionMethod === 0) {
      contentBytes = compressedData;
    } else if (compressionMethod === 8) {
      contentBytes = await inflateRaw(compressedData);
    } else {
      throw new Error("Nieobsługiwany format kompresji XLSX");
    }

    files.set(fileName, decoder.decode(contentBytes));
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function getCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  const valueNode = cell.getElementsByTagNameNS(XML_NS, "v")[0];

  if (!valueNode) {
    const inlineNode = cell.getElementsByTagNameNS(XML_NS, "is")[0];
    return inlineNode ? getTextFromXmlNode(inlineNode) : "";
  }

  const value = valueNode.textContent || "";

  if (type === "s") {
    return sharedStrings[Number(value)] || "";
  }

  return value;
}

function parseWorksheetRows(xmlText, sharedStrings) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const rowNodes = Array.from(xml.getElementsByTagNameNS(XML_NS, "row"));

  if (!rowNodes.length) {
    return { headers: [], data: [] };
  }

  const matrix = rowNodes.map((rowNode) => {
    const row = [];
    const cellNodes = Array.from(rowNode.getElementsByTagNameNS(XML_NS, "c"));

    cellNodes.forEach((cellNode) => {
      const ref = cellNode.getAttribute("r") || "";
      const columnIndex = getColumnIndex(ref);
      row[columnIndex] = getCellValue(cellNode, sharedStrings);
    });

    return row.map((value) => String(value || "").trim());
  });

  const headers = (matrix[0] || []).map(normalizeHeader).filter(Boolean);
  const data = matrix.slice(1).filter((row) => row.some((value) => String(value || "").trim() !== "")).map((row) => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = String(row[index] ?? "").trim();
    });

    return record;
  });

  return { headers, data };
}

async function parseXlsxFile(file) {
  const files = await unzipEntries(await file.arrayBuffer());
  const parser = new DOMParser();

  const sharedStringsXml = files.get("xl/sharedStrings.xml");
  const sharedStrings = [];

  if (sharedStringsXml) {
    const sharedXml = parser.parseFromString(sharedStringsXml, "application/xml");
    const stringItems = Array.from(sharedXml.getElementsByTagNameNS(XML_NS, "si"));

    stringItems.forEach((item) => {
      sharedStrings.push(getTextFromXmlNode(item));
    });
  }

  const workbookXml = parser.parseFromString(
    files.get("xl/workbook.xml") || "",
    "application/xml"
  );
  const relsXml = parser.parseFromString(
    files.get("xl/_rels/workbook.xml.rels") || "",
    "application/xml"
  );

  const firstSheet = workbookXml.getElementsByTagNameNS(XML_NS, "sheet")[0];
  if (!firstSheet) {
    return { headers: [], data: [] };
  }

  const relationId = firstSheet.getAttributeNS(REL_NS, "id") || firstSheet.getAttribute("r:id");
  const relations = Array.from(
    relsXml.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/package/2006/relationships",
      "Relationship"
    )
  );
  const relation = relations.find((item) => item.getAttribute("Id") === relationId);
  const target = relation?.getAttribute("Target");

  if (!target) {
    throw new Error("Nie udało się odczytać arkusza XLSX");
  }

  const sheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
  const worksheetXml = files.get(sheetPath.replace(/^\/+/, ""));

  if (!worksheetXml) {
    throw new Error("Nie udało się odczytać danych XLSX");
  }

  return parseWorksheetRows(worksheetXml, sharedStrings);
}

export async function parseTabularFile(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseCsvFile(file);
  }

  if (extension === "xlsx") {
    return parseXlsxFile(file);
  }

  throw new Error("Obsługiwane formaty plików: CSV i XLSX");
}

