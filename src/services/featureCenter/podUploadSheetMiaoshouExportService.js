const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {
  getSelectedDescriptionImageItems
} = require('./podUploadSheetMiaoshouExportMaterialUtils');

const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const ROW_TWO_NOTE = '字段说明（请勿删除第一列和第二行）';
const FALLBACK_HEADER_ROW_NUMBER = 1;
const FALLBACK_NOTE_ROW_NUMBER = 2;
const MIN_TEMPLATE_HEADER_MATCH_COUNT = 3;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const templateHeaderRowCache = new Map();
const DELIVERY_OPTION_VALUES = Object.freeze(['1', '2', '9']);
const PRODUCT_CODE_HASH_BASE = 1000000000000;
const PRODUCT_CODE_HASH_RANGE = 9000000000000;
const TITLE_MAX_LENGTH = 255;

function createPodUploadSheetMiaoshouExportService({
  app,
  dialog,
  runtimeLogger,
  templateService,
  categoryService,
  imageUploadService
}) {
  const COS_IMAGE_SOURCE_DOMAIN = 'chunagtao-1251234463.cos.ap-guangzhou.myqcloud.com';
  const COS_IMAGE_EXPORT_DOMAIN = 'chunagtao-1251234463.file.myqcloud.com';

  function normalizeText(value) {
    return String(value || '').trim();
  }

  async function fileExists(filePath) {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function resolveTemplateFilePath(templateId, { required = false } = {}) {
    const normalizedTemplateId = normalizeText(templateId);
    const fallbackTemplateFilePath =
      templateService && typeof templateService.getTemplateLocalFilePath === 'function'
        ? normalizeText(templateService.getTemplateLocalFilePath(normalizedTemplateId))
        : '';

    if (fallbackTemplateFilePath && (await fileExists(fallbackTemplateFilePath))) {
      return fallbackTemplateFilePath;
    }

    if (templateService && typeof templateService.ensureTemplateFile === 'function') {
      try {
        const ensuredFilePath = normalizeText(await templateService.ensureTemplateFile(normalizedTemplateId));

        if (ensuredFilePath && (await fileExists(ensuredFilePath))) {
          return ensuredFilePath;
        }
      } catch (_error) {
        if (required) {
          throw new Error('\u5bfc\u51fa\u6a21\u677f\u672a\u540c\u6b65\u6210\u529f\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u5bfc\u51fa\u3002');
        }
      }
    }

    if (required) {
      throw new Error('\u5bfc\u51fa\u6a21\u677f\u4e0d\u5b58\u5728\uff0c\u8bf7\u5148\u91cd\u542f\u8f6f\u4ef6\u6216\u91cd\u8bd5\u5bfc\u51fa\u3002');
    }

    return fallbackTemplateFilePath;
  }

  function trimTitleTail(value) {
    let result = normalizeText(value).replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    const tailMatch = result.match(/([A-Za-z]{1,2})$/u);
    const previousCharacter = tailMatch ? result.slice(0, -tailMatch[1].length).slice(-1) : '';

    if (tailMatch && /[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]/u.test(previousCharacter)) {
      result = result.slice(0, -tailMatch[1].length)
        .replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    }

    return result.trim();
  }

  function rewriteExportImageDomain(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    return text.replaceAll(COS_IMAGE_SOURCE_DOMAIN, COS_IMAGE_EXPORT_DOMAIN);
  }

  function normalizeTitleValue(value) {
    const normalizedValue = normalizeText(value);
    const characters = Array.from(normalizedValue);

    if (characters.length <= TITLE_MAX_LENGTH) {
      return normalizedValue;
    }

    return trimTitleTail(characters.slice(0, TITLE_MAX_LENGTH).join(''));
  }

  function normalizeDigitsOnlyText(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizeDeliveryValue(value) {
    const text = normalizeText(value);

    if (DELIVERY_OPTION_VALUES.includes(text)) {
      return text;
    }

    if (/24\s*小时|24h|1\s*天|一天/.test(text)) {
      return '1';
    }

    if (/48\s*小时|48h|2\s*天|两天/.test(text)) {
      return '2';
    }

    if (/9\s*天/.test(text)) {
      return '9';
    }

    const digits = normalizeDigitsOnlyText(text);
    return DELIVERY_OPTION_VALUES.includes(digits) ? digits : '2';
  }

  function normalizeProductCodeValue(value) {
    return normalizeDigitsOnlyText(value);
  }

  function buildStableNumericProductCode(seedText) {
    const normalizedSeed = normalizeText(seedText);

    if (!normalizedSeed) {
      return '';
    }

    let hash = 0;

    for (const character of normalizedSeed) {
      hash = (hash * 131 + character.codePointAt(0)) % PRODUCT_CODE_HASH_RANGE;
    }

    return String(Math.trunc(hash) + PRODUCT_CODE_HASH_BASE);
  }


  function buildFolderMainNumber(sourceFolder, fallbackName) {
    const parts = normalizeText(sourceFolder)
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    if (parts.length >= 2) {
      return parts.slice(-2).join('-');
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return normalizeText(fallbackName);
  }

  function getMainNumberValue(product) {
    return buildFolderMainNumber(
      product && product.sourceFolder,
      product && product.localName
    );
  }

  function getMasterSkuValue(product) {
    return buildFolderMainNumber(
      product && product.sourceFolder,
      product && product.localName
    );
  }

  function getProductCodeValue(product) {
    const rawCodeValue = normalizeText(product && product.codeValue);
    const normalizedCodeValue = normalizeProductCodeValue(rawCodeValue);

    if (normalizedCodeValue) {
      return normalizedCodeValue;
    }

    if (!rawCodeValue) {
      return '';
    }

    return buildStableNumericProductCode(
      getMainNumberValue(product)
      || rawCodeValue
      || getMasterSkuValue(product)
      || normalizeText(product && product.sourceFolder)
      || normalizeText(product && product.localName)
    );
  }

  function normalizeSkuMultilineValue(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[，,]+/g, '\n')
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n');
  }

  async function getCategoryOptions() {
    if (!categoryService || typeof categoryService.getSnapshot !== 'function') {
      return [];
    }

    const snapshot = await categoryService.getSnapshot();

    return Array.isArray(snapshot && snapshot.categories) ? snapshot.categories : [];
  }

  function getCategoryOptionById(categoryOptions, categoryId) {
    const normalizedCategoryId = normalizeText(categoryId);
    return categoryOptions.find((option) => option.id === normalizedCategoryId) || null;
  }

  function getCategoryOptionByLabel(categoryOptions, categoryLabel) {
    const normalizedCategoryLabel = normalizeText(categoryLabel);
    return categoryOptions.find((option) => {
      return (
        option.label === normalizedCategoryLabel
        || normalizedCategoryLabel.includes(option.label)
        || option.label.includes(normalizedCategoryLabel)
      );
    }) || null;
  }

  function getCategoryId(value, categoryOptions) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    if (getCategoryOptionById(categoryOptions, normalizedValue)) {
      return normalizedValue;
    }

    const leadingIdMatch = normalizedValue.match(/^(\d{4,})\s+/);

    if (leadingIdMatch && getCategoryOptionById(categoryOptions, leadingIdMatch[1])) {
      return leadingIdMatch[1];
    }

    const matchedByLabel = getCategoryOptionByLabel(categoryOptions, normalizedValue);

    if (matchedByLabel) {
      return matchedByLabel.id;
    }

    return normalizedValue;
  }

  function normalizePositiveInteger(value) {
    const text = normalizeText(value);

    if (!text || !/^\d+$/.test(text)) {
      return 0;
    }

    return Number.parseInt(text, 10) || 0;
  }

  function normalizePositiveIntegerString(value) {
    const numericValue = normalizePositiveInteger(value);

    return numericValue > 0 ? String(numericValue) : '';
  }

  function normalizeSequenceSelection(value) {
    const values = String(value || '')
      .replace(/\r\n/g, '\n')
      .split(/[\n,，、\s]+/)
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return Array.from(new Set(values)).join(',');
  }

  function normalizeSkuConfigMap(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return {};
    }

    return Object.entries(source).reduce((result, [key, value]) => {
      const normalizedKey = normalizeText(key);

      if (!normalizedKey || !value || typeof value !== 'object' || Array.isArray(value)) {
        return result;
      }

      result[normalizedKey] = value;
      return result;
    }, {});
  }

  function getSkuValueItems(value) {
    return normalizeSkuMultilineValue(value)
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function buildSkuRowKey(specValueOne, specValueTwo) {
    return `${normalizeText(specValueOne)}${SKU_ROW_KEY_SEPARATOR}${normalizeText(specValueTwo)}`;
  }

  function parseSkuRowKey(rowKey) {
    const normalizedRowKey = normalizeText(rowKey);
    const separatorIndex = normalizedRowKey.indexOf(SKU_ROW_KEY_SEPARATOR);

    if (separatorIndex < 0) {
      return {
        specValueOne: normalizedRowKey,
        specValueTwo: ''
      };
    }

    return {
      specValueOne: normalizedRowKey.slice(0, separatorIndex),
      specValueTwo: normalizedRowKey.slice(separatorIndex + SKU_ROW_KEY_SEPARATOR.length)
    };
  }

  function getProductSkuRows(product) {
    const skuConfigMap = normalizeSkuConfigMap(product && product.skuConfigMap);
    const specValueOneItems = getSkuValueItems(product && product.specValueOne);
    const specValueTwoItems = getSkuValueItems(product && product.specValueTwo);
    const leftItems = specValueOneItems.length ? specValueOneItems : [''];
    const rightItems = specValueTwoItems.length ? specValueTwoItems : [''];
    const rows = [];

    leftItems.forEach((specValueOne) => {
      rightItems.forEach((specValueTwo) => {
        const key = buildSkuRowKey(specValueOne, specValueTwo);
        rows.push({
          key,
          specValueOne,
          specValueTwo,
          ...(skuConfigMap[key] || {})
        });
      });
    });

    if (rows.length) {
      return rows;
    }

    const fallbackRows = Object.entries(skuConfigMap).map(([key, value]) => {
      const parsed = parseSkuRowKey(key);

      return {
        key,
        specValueOne: parsed.specValueOne,
        specValueTwo: parsed.specValueTwo,
        ...value
      };
    });

    return fallbackRows.length
      ? fallbackRows
      : [{
        key: '',
        specValueOne: '',
        specValueTwo: ''
      }];
  }

  function getMaterialItems(product, sectionId) {
    return product && product.materials && Array.isArray(product.materials[sectionId])
      ? product.materials[sectionId].map((item) => normalizeText(item)).filter(Boolean)
      : [];
  }

  function getCarouselItems(product) {
    return getMaterialItems(product, 'carousel');
  }

  function getCarouselJoinedValue(product) {
    return rewriteExportImageDomain(getCarouselItems(product).join(';'));
  }

  function getFirstCarouselItem(product) {
    return rewriteExportImageDomain(getCarouselItems(product)[0] || '');
  }

  function getProductDescriptionValue(product) {
    const descriptionText = normalizeText(product && product.description);
    const selectedItems = getSelectedDescriptionImageItems(product);
    const descriptionImageValue = selectedItems.length
      ? rewriteExportImageDomain(selectedItems.join('\n'))
      : '';

    if (descriptionText && descriptionImageValue) {
      return `${descriptionText}\n${descriptionImageValue}`;
    }

    return descriptionText || descriptionImageValue;
  }

  function getSkuImageValue(product, skuRow) {
    const carouselItems = getCarouselItems(product);
    const selectedOrder = normalizePositiveInteger(skuRow && skuRow.skuImage);

    if (selectedOrder > 0 && carouselItems[selectedOrder - 1]) {
      return rewriteExportImageDomain(carouselItems[selectedOrder - 1]);
    }

    return rewriteExportImageDomain(carouselItems[0] || '');
  }

  function getUniqueItems(items) {
    const itemSet = new Set();

    return (Array.isArray(items) ? items : []).reduce((result, item) => {
      const normalizedItem = normalizeText(item);

      if (!normalizedItem || itemSet.has(normalizedItem)) {
        return result;
      }

      itemSet.add(normalizedItem);
      result.push(normalizedItem);
      return result;
    }, []);
  }

  function getFashionColorImageValue(product, skuRow) {
    const selectedSkuImage = getSkuImageValue(product, skuRow);
    const orderedItems = getUniqueItems([
      selectedSkuImage,
      ...getCarouselItems(product)
    ]).slice(0, 10);

    return rewriteExportImageDomain(orderedItems.join('\n'));
  }

  function csvEscape(value) {
    const text = String(value == null ? '' : value).replace(/\r\n/g, '\n');

    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function buildCsvContent(rows) {
    return `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
  }

  function formatExportTimestamp() {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hour}${minute}${second}`;
  }

  function normalizeTemplateHeader(value) {
    return String(value == null ? '' : value)
      .replace(/\uFEFF/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function getTemplateColumnHeaderKeys(column) {
    return [
      column && column.header,
      ...(Array.isArray(column && column.aliases) ? column.aliases : [])
    ].map((header) => normalizeTemplateHeader(header)).filter(Boolean);
  }

  function buildTemplateColumnMap(columns) {
    const columnMap = new Map();

    (Array.isArray(columns) ? columns : []).forEach((column) => {
      getTemplateColumnHeaderKeys(column).forEach((headerKey) => {
        if (!columnMap.has(headerKey)) {
          columnMap.set(headerKey, column);
        }
      });
    });

    return columnMap;
  }

  function padRow(row, targetLength) {
    const normalizedRow = Array.isArray(row) ? row.slice(0, targetLength) : [];

    while (normalizedRow.length < targetLength) {
      normalizedRow.push('');
    }

    return normalizedRow;
  }

  function decodeXmlEntities(value) {
    return String(value == null ? '' : value)
      .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10) || 0))
      .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16) || 0))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, '\'')
      .replace(/&amp;/g, '&');
  }

  function extractXmlTextValue(xmlSource) {
    const matches = String(xmlSource || '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g);
    let result = '';

    for (const match of matches) {
      result += decodeXmlEntities(match[1]);
    }

    return result;
  }

  function getColumnNumberFromCellReference(reference) {
    const columnLabel = String(reference || '').replace(/\d+/g, '');
    let result = 0;

    for (const character of columnLabel) {
      const code = character.toUpperCase().charCodeAt(0);

      if (code < 65 || code > 90) {
        continue;
      }

      result = result * 26 + (code - 64);
    }

    return result;
  }

  function findZipEndOfCentralDirectoryOffset(buffer) {
    const minimumOffset = Math.max(0, buffer.length - 0x10000 - 22);

    for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
      if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
        return offset;
      }
    }

    return -1;
  }

  function readZipEntries(buffer) {
    const endOffset = findZipEndOfCentralDirectoryOffset(buffer);

    if (endOffset < 0) {
      throw new Error('Failed to locate zip central directory.');
    }

    const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
    const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
    const endBoundary = centralDirectoryOffset + centralDirectorySize;
    const entries = new Map();
    let offset = centralDirectoryOffset;

    while (offset < endBoundary) {
      if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
        throw new Error('Invalid zip central directory header.');
      }

      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const fileNameLength = buffer.readUInt16LE(offset + 28);
      const extraFieldLength = buffer.readUInt16LE(offset + 30);
      const fileCommentLength = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);
      const fileNameStart = offset + 46;
      const fileNameEnd = fileNameStart + fileNameLength;
      const fileName = buffer.toString('utf8', fileNameStart, fileNameEnd);

      entries.set(fileName, {
        compressionMethod,
        compressedSize,
        localHeaderOffset
      });

      offset = fileNameEnd + extraFieldLength + fileCommentLength;
    }

    return entries;
  }

  function readZipEntryText(buffer, entries, entryName) {
    return readZipEntryBuffer(buffer, entries, entryName).toString('utf8');
  }

  function parseSharedStringsXml(xmlText) {
    const sharedStrings = [];
    const matches = String(xmlText || '').matchAll(/<si\b[\s\S]*?<\/si>/g);

    for (const match of matches) {
      sharedStrings.push(extractXmlTextValue(match[0]));
    }

    return sharedStrings;
  }

  function parseSheetRow(xmlText, rowNumber, sharedStrings) {
    const rowMatch = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*>([\\s\\S]*?)<\\/row>`).exec(String(xmlText || ''));

    if (!rowMatch) {
      return [];
    }

    const rowSource = rowMatch[1];
    const cellValues = new Map();
    let maxColumn = 0;
    const cellMatches = rowSource.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g);

    for (const match of cellMatches) {
      const attributes = match[1] || match[3] || '';
      const body = match[2] || '';
      const referenceMatch = /\br="([^"]+)"/.exec(attributes);
      const typeMatch = /\bt="([^"]+)"/.exec(attributes);
      const columnNumber = getColumnNumberFromCellReference(referenceMatch && referenceMatch[1]);

      if (!columnNumber) {
        continue;
      }

      let value = '';

      if (typeMatch && typeMatch[1] === 's') {
        const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
        const sharedStringIndex = Number.parseInt(valueMatch && valueMatch[1], 10);

        value = Number.isFinite(sharedStringIndex) ? (sharedStrings[sharedStringIndex] || '') : '';
      } else if (typeMatch && typeMatch[1] === 'inlineStr') {
        value = extractXmlTextValue(body);
      } else {
        const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(body);
        value = valueMatch ? decodeXmlEntities(valueMatch[1]) : '';
      }

      cellValues.set(columnNumber, value);
      maxColumn = Math.max(maxColumn, columnNumber);
    }

    return Array.from({ length: maxColumn }, (_item, index) => cellValues.get(index + 1) || '');
  }

  function getWorksheetRowNumbers(sheetXml) {
    const rowNumberSet = new Set();
    const rowMatches = String(sheetXml || '').matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/gi);

    for (const match of rowMatches) {
      const attributes = match[1] || match[3] || '';
      const rowNumberMatch = /\br="(\d+)"/i.exec(attributes);
      const rowNumber = rowNumberMatch ? Number.parseInt(rowNumberMatch[1], 10) : 0;

      if (rowNumber > 0) {
        rowNumberSet.add(rowNumber);
      }
    }

    return Array.from(rowNumberSet).sort((left, right) => left - right);
  }

  function scoreTemplateHeaderRow(rowValues, columnMap) {
    const matchedKeys = new Set();
    let score = 0;

    (Array.isArray(rowValues) ? rowValues : []).forEach((value) => {
      const headerKey = normalizeTemplateHeader(value);

      if (!headerKey || matchedKeys.has(headerKey) || !columnMap.has(headerKey)) {
        return;
      }

      matchedKeys.add(headerKey);
      score += 1;
    });

    return score;
  }

  function findTemplateHeaderRowInfo(sheetXml, sharedStrings, columns) {
    const columnMap = buildTemplateColumnMap(columns);
    const rowNumbers = getWorksheetRowNumbers(sheetXml);
    let bestRowNumber = 0;
    let bestHeaderRow = [];
    let bestScore = 0;

    rowNumbers.forEach((rowNumber) => {
      const headerRow = parseSheetRow(sheetXml, rowNumber, sharedStrings);
      const score = scoreTemplateHeaderRow(headerRow, columnMap);

      if (score > bestScore) {
        bestScore = score;
        bestRowNumber = rowNumber;
        bestHeaderRow = headerRow;
      }
    });

    if (bestScore >= MIN_TEMPLATE_HEADER_MATCH_COUNT && bestHeaderRow.length) {
      return {
        headerRowNumber: bestRowNumber,
        headerRow: bestHeaderRow
      };
    }

    const fallbackHeaderRow = parseSheetRow(sheetXml, FALLBACK_HEADER_ROW_NUMBER, sharedStrings);

    return {
      headerRowNumber: FALLBACK_HEADER_ROW_NUMBER,
      headerRow: fallbackHeaderRow.length
        ? fallbackHeaderRow
        : (Array.isArray(columns) ? columns.map((column) => column.header) : [])
    };
  }

  function getColumnLabelFromNumber(columnNumber) {
    let currentNumber = Number.parseInt(columnNumber, 10) || 0;
    let label = '';

    while (currentNumber > 0) {
      const remainder = (currentNumber - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      currentNumber = Math.floor((currentNumber - 1) / 26);
    }

    return label;
  }

  function readZipEntryBuffer(buffer, entries, entryName) {
    const entry = entries.get(entryName);

    if (!entry) {
      return Buffer.alloc(0);
    }

    if (buffer.readUInt32LE(entry.localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Invalid zip local header: ${entryName}`);
    }

    const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
    const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
    const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
    const compressedBuffer = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

    if (entry.compressionMethod === 8) {
      return zlib.inflateRawSync(compressedBuffer);
    }

    if (entry.compressionMethod !== 0) {
      throw new Error(`Unsupported zip compression method: ${entry.compressionMethod}`);
    }

    return Buffer.from(compressedBuffer);
  }

  async function readTemplateHeaderRowsFromFile(templateFilePath, fallbackColumns) {
    const fileStat = await fs.promises.stat(templateFilePath);
    const columnCacheKey = (Array.isArray(fallbackColumns) ? fallbackColumns : [])
      .map((column) => getTemplateColumnHeaderKeys(column).join('|'))
      .join('||');
    const cacheKey = `${templateFilePath}:${fileStat.size}:${fileStat.mtimeMs}:${columnCacheKey}`;

    if (templateHeaderRowCache.has(cacheKey)) {
      return templateHeaderRowCache.get(cacheKey);
    }

    const fileBuffer = await fs.promises.readFile(templateFilePath);
    const zipEntries = readZipEntries(fileBuffer);
    const sharedStrings = parseSharedStringsXml(readZipEntryText(fileBuffer, zipEntries, 'xl/sharedStrings.xml'));
    const sheetXml = readZipEntryText(fileBuffer, zipEntries, 'xl/worksheets/sheet1.xml');
    const headerInfo = findTemplateHeaderRowInfo(sheetXml, sharedStrings, fallbackColumns);
    const noteRowNumber = headerInfo.headerRowNumber + 1;
    const templateRows = {
      templateFilePath,
      headerRowNumber: headerInfo.headerRowNumber,
      noteRowNumber,
      headerRow: headerInfo.headerRow,
      noteRow: parseSheetRow(sheetXml, noteRowNumber, sharedStrings)
    };

    templateHeaderRowCache.set(cacheKey, templateRows);
    return templateRows;
  }

  async function resolveTemplateHeaderRows(templateId, fallbackColumns) {
    const fallbackHeaderRow = fallbackColumns.map((column) => column.header);
    const fallbackNoteRow = fallbackColumns.map((_column, index) => (index === 0 ? ROW_TWO_NOTE : ''));
    const templateFilePath = await resolveTemplateFilePath(templateId);

    if (!templateFilePath) {
      return {
        templateFilePath: '',
        headerRowNumber: FALLBACK_HEADER_ROW_NUMBER,
        noteRowNumber: FALLBACK_NOTE_ROW_NUMBER,
        headerRow: fallbackHeaderRow,
        noteRow: fallbackNoteRow
      };
    }

    try {
      const templateRows = await readTemplateHeaderRowsFromFile(templateFilePath, fallbackColumns);

      if (!Array.isArray(templateRows.headerRow) || !templateRows.headerRow.length) {
        return {
          templateFilePath,
          headerRowNumber: FALLBACK_HEADER_ROW_NUMBER,
          noteRowNumber: FALLBACK_NOTE_ROW_NUMBER,
          headerRow: fallbackHeaderRow,
          noteRow: fallbackNoteRow
        };
      }

      return {
        templateFilePath,
        headerRowNumber: templateRows.headerRowNumber || FALLBACK_HEADER_ROW_NUMBER,
        noteRowNumber: templateRows.noteRowNumber || ((templateRows.headerRowNumber || FALLBACK_HEADER_ROW_NUMBER) + 1),
        headerRow: templateRows.headerRow.slice(),
        noteRow: padRow(templateRows.noteRow, templateRows.headerRow.length)
      };
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError('pod_upload_sheet_template_header_read_failed', error, {
          templateId,
          templateFilePath
        });
      }

      return {
        templateFilePath,
        headerRowNumber: FALLBACK_HEADER_ROW_NUMBER,
        noteRowNumber: FALLBACK_NOTE_ROW_NUMBER,
        headerRow: fallbackHeaderRow,
        noteRow: fallbackNoteRow
      };
    }
  }

  function extractSheetRowXml(sheetXml, rowNumber) {
    const match = new RegExp(
      `<row\\b[^>]*\\br="${rowNumber}"[^>]*>([\\s\\S]*?)<\\/row>|<row\\b[^>]*\\br="${rowNumber}"[^>]*/>`,
      'i'
    ).exec(String(sheetXml || ''));

    return match ? match[0] : '';
  }

  function extractRowAttributes(rowXml) {
    const match = /^<row\b([^>]*)>/i.exec(String(rowXml || '')) || /^<row\b([^>]*)\/>/i.exec(String(rowXml || ''));
    return match ? normalizeText(match[1]) : '';
  }

  function updateRowAttributes(attributes, rowNumber, lastColumnNumber) {
    let nextAttributes = String(attributes || '');

    if (/\br="[^"]*"/.test(nextAttributes)) {
      nextAttributes = nextAttributes.replace(/\br="[^"]*"/, `r="${rowNumber}"`);
    } else {
      nextAttributes += ` r="${rowNumber}"`;
    }

    if (/\bspans="[^"]*"/.test(nextAttributes)) {
      nextAttributes = nextAttributes.replace(/\bspans="[^"]*"/, `spans="1:${lastColumnNumber}"`);
    } else {
      nextAttributes += ` spans="1:${lastColumnNumber}"`;
    }

    return nextAttributes.trim();
  }

  function parseRowCellTemplates(rowXml) {
    const cellTemplates = new Map();
    const cellMatches = String(rowXml || '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g);

    for (const match of cellMatches) {
      const attributes = match[1] || match[3] || '';
      const referenceMatch = /\br="([^"]+)"/.exec(attributes);
      const styleMatch = /\bs="([^"]+)"/.exec(attributes);
      const typeMatch = /\bt="([^"]+)"/.exec(attributes);
      const columnNumber = getColumnNumberFromCellReference(referenceMatch && referenceMatch[1]);

      if (!columnNumber) {
        continue;
      }

      cellTemplates.set(columnNumber, {
        styleId: styleMatch ? normalizeText(styleMatch[1]) : '',
        valueType: typeMatch ? normalizeText(typeMatch[1]) : 'n'
      });
    }

    return cellTemplates;
  }

  function buildColumnCellTemplateMap(sampleRowXmlList, columnCount) {
    const templateMap = new Map();

    (Array.isArray(sampleRowXmlList) ? sampleRowXmlList : []).forEach((rowXml) => {
      parseRowCellTemplates(rowXml).forEach((template, columnNumber) => {
        if (!templateMap.has(columnNumber)) {
          templateMap.set(columnNumber, template);
        }
      });
    });

    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      if (!templateMap.has(columnNumber)) {
        templateMap.set(columnNumber, {
          styleId: '',
          valueType: 'inlineStr'
        });
      }
    }

    return templateMap;
  }

  function escapeXmlText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function isNumericCellValue(value) {
    const text = normalizeText(value);

    if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
      return false;
    }

    const signlessText = text.replace(/^-/, '');

    if (/^0\d+$/.test(signlessText)) {
      return false;
    }

    return true;
  }

  function buildWorksheetCellXml(cellReference, styleId, value, valueType) {
    const text = String(value == null ? '' : value).replace(/\r\n/g, '\n');

    if (!text) {
      return styleId
        ? `<c r="${cellReference}" s="${styleId}"/>`
        : `<c r="${cellReference}"/>`;
    }

    if (valueType === 'n' && isNumericCellValue(text)) {
      return styleId
        ? `<c r="${cellReference}" s="${styleId}"><v>${text}</v></c>`
        : `<c r="${cellReference}"><v>${text}</v></c>`;
    }

    const preserveSpace = /^[\s]|[\s]$|\n/.test(text) ? ' xml:space="preserve"' : '';

    return styleId
      ? `<c r="${cellReference}" s="${styleId}" t="inlineStr"><is><t${preserveSpace}>${escapeXmlText(text)}</t></is></c>`
      : `<c r="${cellReference}" t="inlineStr"><is><t${preserveSpace}>${escapeXmlText(text)}</t></is></c>`;
  }

  function buildWorksheetDataRowsXml(dataRows, rowTemplateAttributes, columnTemplateMap, columnCount, dataStartRowNumber) {
    return (Array.isArray(dataRows) ? dataRows : []).map((row, rowIndex) => {
      const rowNumber = rowIndex + dataStartRowNumber;
      const rowAttributes = updateRowAttributes(rowTemplateAttributes, rowNumber, columnCount);
      const cellXmlList = [];

      for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
        const cellReference = `${getColumnLabelFromNumber(columnNumber)}${rowNumber}`;
        const cellTemplate = columnTemplateMap.get(columnNumber) || {
          styleId: '',
          valueType: 'inlineStr'
        };
        const value = Array.isArray(row) ? row[columnNumber - 1] : '';

        cellXmlList.push(
          buildWorksheetCellXml(
            cellReference,
            cellTemplate.styleId,
            value,
            cellTemplate.valueType === 'n' ? 'n' : 'inlineStr'
          )
        );
      }

      return `<row ${rowAttributes}>${cellXmlList.join('')}</row>`;
    }).join('');
  }

  function replaceWorksheetDimension(sheetXml, columnCount, lastRowNumber, preservedLastRowNumber) {
    const lastColumnLabel = getColumnLabelFromNumber(columnCount);
    const nextDimension = `A1:${lastColumnLabel}${Math.max(preservedLastRowNumber, lastRowNumber)}`;

    if (/<dimension\b[^>]*ref="[^"]*"[^/]*\/>/.test(sheetXml)) {
      return sheetXml.replace(/<dimension\b([^>]*)ref="[^"]*"([^/]*)\/>/, `<dimension$1ref="${nextDimension}"$2/>`);
    }

    return sheetXml;
  }

  function buildWorksheetXmlFromTemplate(sheetXml, dataRows, columnCount, templateLayout) {
    const headerRowNumber = normalizePositiveInteger(templateLayout && templateLayout.headerRowNumber)
      || FALLBACK_HEADER_ROW_NUMBER;
    const noteRowNumber = normalizePositiveInteger(templateLayout && templateLayout.noteRowNumber)
      || (headerRowNumber + 1);
    const preservedLastRowNumber = Math.max(headerRowNumber, noteRowNumber);
    const dataStartRowNumber = preservedLastRowNumber + 1;
    const rowNumbers = getWorksheetRowNumbers(sheetXml);
    const preservedRowsXml = rowNumbers
      .filter((rowNumber) => rowNumber <= preservedLastRowNumber)
      .map((rowNumber) => extractSheetRowXml(sheetXml, rowNumber))
      .join('');
    const sampleRowXmlList = rowNumbers
      .filter((rowNumber) => rowNumber > preservedLastRowNumber)
      .slice(0, 4)
      .map((rowNumber) => extractSheetRowXml(sheetXml, rowNumber))
      .filter(Boolean);
    const headerRowXml = extractSheetRowXml(sheetXml, headerRowNumber);
    const noteRowXml = extractSheetRowXml(sheetXml, noteRowNumber);
    const rowTemplateAttributes = extractRowAttributes(sampleRowXmlList[0] || noteRowXml || headerRowXml);
    const columnTemplateMap = buildColumnCellTemplateMap(
      sampleRowXmlList.concat([noteRowXml, headerRowXml]).filter(Boolean),
      columnCount
    );
    const dataRowsXml = buildWorksheetDataRowsXml(
      dataRows,
      rowTemplateAttributes,
      columnTemplateMap,
      columnCount,
      dataStartRowNumber
    );
    let nextSheetXml = String(sheetXml || '').replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${preservedRowsXml}${dataRowsXml}</sheetData>`
    );

    nextSheetXml = nextSheetXml.replace(/<mergeCells[\s\S]*?<\/mergeCells>/g, '');
    nextSheetXml = replaceWorksheetDimension(
      nextSheetXml,
      columnCount,
      dataRows.length + preservedLastRowNumber,
      preservedLastRowNumber
    );
    return nextSheetXml;
  }

  function createCrc32Table() {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
      let crc = index;

      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }

      table[index] = crc >>> 0;
    }

    return table;
  }

  const CRC32_TABLE = createCrc32Table();

  function calculateCrc32(buffer) {
    let crc = 0xffffffff;

    for (const byte of Buffer.from(buffer || Buffer.alloc(0))) {
      crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  function getDosDateTimeParts(date = new Date()) {
    const year = Math.min(2107, Math.max(1980, date.getFullYear()));
    const month = Math.max(1, date.getMonth() + 1);
    const day = Math.max(1, date.getDate());
    const hours = Math.max(0, date.getHours());
    const minutes = Math.max(0, date.getMinutes());
    const seconds = Math.floor(Math.max(0, date.getSeconds()) / 2);

    return {
      time: (hours << 11) | (minutes << 5) | seconds,
      date: ((year - 1980) << 9) | (month << 5) | day
    };
  }

  function buildZipArchiveBuffer(entries) {
    const zipEntries = Array.isArray(entries) ? entries : [];
    const localParts = [];
    const centralParts = [];
    const { time, date } = getDosDateTimeParts();
    let offset = 0;

    zipEntries.forEach((entry) => {
      const fileNameBuffer = Buffer.from(String(entry && entry.name ? entry.name : ''), 'utf8');
      const uncompressedBuffer = Buffer.isBuffer(entry && entry.data)
        ? entry.data
        : Buffer.from(entry && entry.data ? entry.data : '');
      const compressedBuffer = zlib.deflateRawSync(uncompressedBuffer);
      const crc32 = calculateCrc32(uncompressedBuffer);
      const localHeader = Buffer.alloc(30);

      localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER_SIGNATURE, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0, 6);
      localHeader.writeUInt16LE(8, 8);
      localHeader.writeUInt16LE(time, 10);
      localHeader.writeUInt16LE(date, 12);
      localHeader.writeUInt32LE(crc32, 14);
      localHeader.writeUInt32LE(compressedBuffer.length, 18);
      localHeader.writeUInt32LE(uncompressedBuffer.length, 22);
      localHeader.writeUInt16LE(fileNameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, fileNameBuffer, compressedBuffer);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_SIGNATURE, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0, 8);
      centralHeader.writeUInt16LE(8, 10);
      centralHeader.writeUInt16LE(time, 12);
      centralHeader.writeUInt16LE(date, 14);
      centralHeader.writeUInt32LE(crc32, 16);
      centralHeader.writeUInt32LE(compressedBuffer.length, 20);
      centralHeader.writeUInt32LE(uncompressedBuffer.length, 24);
      centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      centralParts.push(centralHeader, fileNameBuffer);
      offset += localHeader.length + fileNameBuffer.length + compressedBuffer.length;
    });

    const centralDirectoryOffset = offset;
    const centralDirectoryBuffer = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);

    endOfCentralDirectory.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(zipEntries.length, 8);
    endOfCentralDirectory.writeUInt16LE(zipEntries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12);
    endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return Buffer.concat([
      ...localParts,
      centralDirectoryBuffer,
      endOfCentralDirectory
    ]);
  }

  async function buildWorkbookBufferFromTemplate(templateId, dataRows, templateLayout) {
    const templateFilePath = normalizeText(templateLayout && templateLayout.templateFilePath)
      || await resolveTemplateFilePath(templateId, { required: true });

    if (!templateFilePath) {
      throw new Error('Template xlsx file is unavailable.');
    }

    const templateBuffer = await fs.promises.readFile(templateFilePath);
    const zipEntries = readZipEntries(templateBuffer);
    const entryList = Array.from(zipEntries.keys()).map((entryName) => {
      return {
        name: entryName,
        data: readZipEntryBuffer(templateBuffer, zipEntries, entryName)
      };
    });
    const worksheetEntry = entryList.find((entry) => entry.name === 'xl/worksheets/sheet1.xml');

    if (!worksheetEntry) {
      throw new Error('Template worksheet xl/worksheets/sheet1.xml was not found.');
    }

    const columnCount = Array.isArray(dataRows) && dataRows.length
      ? Math.max(...dataRows.map((row) => Array.isArray(row) ? row.length : 0), 1)
      : 1;

    worksheetEntry.data = Buffer.from(
      buildWorksheetXmlFromTemplate(worksheetEntry.data.toString('utf8'), dataRows, columnCount, templateLayout),
      'utf8'
    );

    return buildZipArchiveBuffer(entryList);
  }

  function buildColumnsByTemplateOrder(columns, headerRow) {
    const columnMap = buildTemplateColumnMap(columns);

    return (Array.isArray(headerRow) ? headerRow : []).map((header) => {
      const normalizedHeader = normalizeTemplateHeader(header);
      const matchedColumn = normalizedHeader ? columnMap.get(normalizedHeader) : null;

      if (!matchedColumn) {
        return {
          header: header || '',
          getValue: () => ''
        };
      }

      return {
        ...matchedColumn,
        header
      };
    });
  }

  function getTemplateLabel(templateId) {
    return normalizeText(templateId) === 'fashion' ? '服饰类模板' : '非服饰类模板';
  }

  function getTemplateColumns(templateId, categoryOptions) {
    if (normalizeText(templateId) === 'fashion') {
      return [
        { header: '', getValue: () => '' },
        { header: '类目ID', getValue: (product) => getCategoryId(product.category, categoryOptions) },
        { header: '* 主编号', getValue: (product) => getMainNumberValue(product) },
        { header: '*产品标题', getValue: (product) => normalizeTitleValue(product.title) },
        { header: '*英文标题', getValue: (product) => normalizeTitleValue(product.englishTitle) },
        { header: '产品描述', getValue: (product) => normalizeText(product.description) },
        { header: '*承诺发货时效', getValue: (product) => normalizeDeliveryValue(product.delivery) },
        { header: '*产地', getValue: (product) => normalizeText(product.origin) },
        { header: '站外产品链接', getValue: (product) => normalizeText(product.sourceLink) },
        { header: '* 产品素材图', getValue: (product) => getFirstCarouselItem(product) },
        { header: '*定制品', getValue: (product) => normalizeText(product.isCustom) },
        { header: '* 规格名称1', getValue: (product) => normalizeText(product.specNameOne) },
        { header: '* 规格属性值1', getValue: (_product, skuRow) => normalizeText(skuRow.specValueOne) },
        { header: '* 规格名称2', getValue: (product) => normalizeText(product.specNameTwo) },
        { header: '* 规格属性值2', getValue: (_product, skuRow) => normalizeText(skuRow.specValueTwo) },
        { header: '* 颜色图', getValue: (product, skuRow) => getFashionColorImageValue(product, skuRow) },
        { header: '主货号', getValue: (product) => getMasterSkuValue(product) },
        { header: '* 申报价（CNY）', getValue: (_product, skuRow) => normalizeText(skuRow.declaredPrice) },
        { header: '建议售价（CNY）', getValue: (_product, skuRow) => normalizeText(skuRow.price) },
        { header: '* 长（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.length) },
        { header: '* 宽（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.width) },
        { header: '* 高（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.height) },
        { header: '* 重量（g）', getValue: (_product, skuRow) => normalizeText(skuRow.weight) },
        { header: '库存', getValue: (_product, skuRow) => normalizeText(skuRow.stock) },
        { header: '平台SKU', getValue: (_product, skuRow) => normalizeText(skuRow.platformSku) },
        { header: '* 是否敏感属性', getValue: () => '否' },
        { header: '敏感属性值', getValue: () => '' },
        { header: '储电容量', getValue: () => '' },
        { header: '刀具长度', getValue: () => '' },
        { header: '刀具尖度', getValue: () => '' },
        { header: '液体容量', getValue: () => '' },
        { header: '产品编码类型', getValue: (product) => normalizeText(product.codeType) },
        { header: '产品编码', getValue: (product) => getProductCodeValue(product) },
        { header: 'SKU分类类型', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryType) },
        { header: 'SKU分类数量', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryCount) },
        { header: 'SKU分类单位', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryUnit) },
        { header: '是否独立包装', getValue: (_product, skuRow) => normalizeText(skuRow.independentPackaging) },
        { header: '包装清单', getValue: (product) => normalizeText(product.packingList) },
        { header: '包装清单数量', getValue: (product) => normalizeText(product.packingCount) },
        { header: '主图视频', getValue: (product) => normalizeText(product.mainVideo) },
        { header: '产品说明书', getValue: (product) => normalizeText(product.manual) },
        { header: '货源链接', getValue: (product) => normalizeText(product.sourceLink) }
      ];
    }

    return [
      { header: '', getValue: () => '' },
      { header: '类目ID', getValue: (product) => getCategoryId(product.category, categoryOptions) },
      { header: '* 主编号', getValue: (product) => getMainNumberValue(product) },
      { header: '*产品标题', getValue: (product) => normalizeTitleValue(product.title) },
      { header: '*英文标题', getValue: (product) => normalizeTitleValue(product.englishTitle) },
      { header: '产品描述', getValue: (product) => normalizeText(product.description) },
      { header: '*承诺发货时效', getValue: (product) => normalizeDeliveryValue(product.delivery) },
      { header: '主货号', getValue: (product) => getMasterSkuValue(product) },
      { header: '*产地', getValue: (product) => normalizeText(product.origin) },
      { header: '站外产品链接', getValue: (product) => normalizeText(product.sourceLink) },
      { header: '* 产品轮播图', getValue: (product) => getCarouselJoinedValue(product) },
      { header: '* 产品素材图', getValue: (product) => getFirstCarouselItem(product) },
      { header: '*定制品', getValue: (product) => normalizeText(product.isCustom) },
      { header: '* 规格名称1', getValue: (product) => normalizeText(product.specNameOne) },
      { header: '* 规格属性值1', getValue: (_product, skuRow) => normalizeText(skuRow.specValueOne) },
      { header: '* 规格名称2', getValue: (product) => normalizeText(product.specNameTwo) },
      { header: '* 规格属性值2', getValue: (_product, skuRow) => normalizeText(skuRow.specValueTwo) },
      { header: '* 预览图', getValue: (product, skuRow) => getSkuImageValue(product, skuRow) },
      { header: '* 申报价（CNY）', getValue: (_product, skuRow) => normalizeText(skuRow.declaredPrice) },
      { header: '建议售价（CNY）', getValue: (_product, skuRow) => normalizeText(skuRow.price) },
      { header: '* 长（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.length) },
      { header: '* 宽（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.width) },
      { header: '* 高（cm）', getValue: (_product, skuRow) => normalizeText(skuRow.height) },
      { header: '* 重量（g）', getValue: (_product, skuRow) => normalizeText(skuRow.weight) },
      { header: '库存', getValue: (_product, skuRow) => normalizeText(skuRow.stock) },
      { header: '平台SKU', getValue: (_product, skuRow) => normalizeText(skuRow.platformSku) },
      { header: '* 是否敏感属性', getValue: () => '否' },
      { header: '敏感属性值', getValue: () => '' },
      { header: '储电容量', getValue: () => '' },
      { header: '刀具长度', getValue: () => '' },
      { header: '刀具尖度', getValue: () => '' },
      { header: '液体容量', getValue: () => '' },
      { header: '产品编码类型', getValue: (product) => normalizeText(product.codeType) },
      { header: '产品编码', getValue: (product) => getProductCodeValue(product) },
      { header: 'SKU分类类型', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryType) },
      { header: 'SKU分类数量', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryCount) },
      { header: 'SKU分类单位', getValue: (_product, skuRow) => normalizeText(skuRow.skuCategoryUnit) },
      { header: '是否独立包装', getValue: (_product, skuRow) => normalizeText(skuRow.independentPackaging) },
      { header: '包装清单', getValue: (product) => normalizeText(product.packingList) },
      { header: '包装清单数量', getValue: (product) => normalizeText(product.packingCount) },
      { header: '主图视频', getValue: (product) => normalizeText(product.mainVideo) },
      { header: '产品说明书', getValue: (product) => normalizeText(product.manual) },
      { header: '货源链接', getValue: (product) => normalizeText(product.sourceLink) }
    ];
  }

  function withProductDescriptionColumn(columns) {
    if (!Array.isArray(columns)) {
      return columns;
    }

    const productDescriptionHeader = normalizeTemplateHeader('\u4ea7\u54c1\u63cf\u8ff0');

    return columns.map((column) => {
      if (!getTemplateColumnHeaderKeys(column).includes(productDescriptionHeader)) {
        return column;
      }

      return {
        ...column,
        getValue: (product) => getProductDescriptionValue(product)
      };
    });
  }

  async function buildExportRowsForTemplate(templateId, products) {
    const categoryOptions = await getCategoryOptions();
    const baseColumns = withProductDescriptionColumn(getTemplateColumns(templateId, categoryOptions));
    const templateRows = await resolveTemplateHeaderRows(templateId, baseColumns);
    const columns = buildColumnsByTemplateOrder(baseColumns, templateRows.headerRow);
    const rows = [
      templateRows.headerRow.slice(),
      templateRows.noteRow.slice()
    ];
    let dataRowCount = 0;

    products.forEach((product) => {
      getProductSkuRows(product).forEach((skuRow) => {
        rows.push(columns.map((column) => column.getValue(product, skuRow)));
        dataRowCount += 1;
      });
    });

    return {
      templateId,
      templateLayout: templateRows,
      rows,
      dataRows: rows.slice(2),
      rowCount: dataRowCount,
      productCount: products.length
    };
  }

  async function resolveProductsForExport(products) {
    if (!imageUploadService || typeof imageUploadService.resolveUploadedProducts !== 'function') {
      return products;
    }

    const resolvedPayload = await imageUploadService.resolveUploadedProducts({
      products
    });
    const missingCount = Array.isArray(resolvedPayload && resolvedPayload.missingFilePaths)
      ? resolvedPayload.missingFilePaths.length
      : 0;

    if (missingCount > 0) {
      throw new Error(
        `请先批量上传图片到 COS 后再导出，当前还有 ${missingCount} 张图片未生成链接。`
      );
    }

    return Array.isArray(resolvedPayload && resolvedPayload.products)
      ? resolvedPayload.products
      : products;
  }

  function getDefaultExportFileName(templateId) {
    return `妙手导出-${getTemplateLabel(templateId)}-${formatExportTimestamp()}.csv`;
  }

  async function promptExportFilePath(defaultFilePath, parentWindow) {
    const saveResult = await dialog.showSaveDialog(parentWindow || undefined, {
      title: '导出表格',
      title: '\u5bfc\u51fa\u8868\u683c',
      defaultPath: defaultFilePath,
      filters: [
        { name: 'CSV 文件', extensions: ['csv'] }
      ]
    });

    if (!saveResult || saveResult.canceled || !saveResult.filePath) {
      return '';
    }

    return saveResult.filePath;
  }

  async function writeExportFile(filePath, rows) {
    await fs.promises.writeFile(filePath, buildCsvContent(rows), 'utf8');
  }

  function getDefaultExportWorkbookFileName(templateId) {
    return `pod-export-${normalizeText(templateId) || 'template'}-${formatExportTimestamp()}.xlsx`;
  }

  async function promptExportWorkbookFilePath(defaultFilePath, parentWindow) {
    const saveResult = await dialog.showSaveDialog(parentWindow || undefined, {
      title: '瀵煎嚭琛ㄦ牸',
      title: '\u5bfc\u51fa\u8868\u683c',
      defaultPath: defaultFilePath,
      filters: [
        { name: 'Excel Workbook', extensions: ['xlsx'] }
      ]
    });

    if (!saveResult || saveResult.canceled || !saveResult.filePath) {
      return '';
    }

    return saveResult.filePath;
  }

  async function writeExportWorkbookFile(filePath, templateId, dataRows, templateLayout) {
    const workbookBuffer = await buildWorkbookBufferFromTemplate(templateId, dataRows, templateLayout);
    await fs.promises.writeFile(filePath, workbookBuffer);
  }

  async function exportTable(payload) {
    const parentWindow = payload && payload.parentWindow && !payload.parentWindow.isDestroyed()
      ? payload.parentWindow
      : null;
    const products = Array.isArray(payload && payload.products)
      ? payload.products.filter((item) => item && typeof item === 'object')
      : [];

    if (!products.length) {
      throw new Error('当前没有可导出的商品数据。');
    }

    const templateId = normalizeText(payload && payload.templateId)
      || normalizeText(products[0] && products[0].templateId)
      || 'non-fashion';
    const resolvedProducts = await resolveProductsForExport(products);
    await resolveTemplateFilePath(templateId, { required: true });
    const downloadsDirectory = app && typeof app.getPath === 'function'
      ? app.getPath('downloads')
      : process.cwd();
    const defaultFilePath = path.join(
      downloadsDirectory,
      getDefaultExportWorkbookFileName(templateId)
    );
    const selectedFilePath = await promptExportWorkbookFilePath(defaultFilePath, parentWindow);

    if (!selectedFilePath) {
      return {
        canceled: true,
        filePath: '',
        rowCount: 0,
        productCount: products.length,
        templateId,
        filePaths: [],
        exports: []
      };
    }

    const exportPayload = await buildExportRowsForTemplate(templateId, resolvedProducts);
    await writeExportWorkbookFile(selectedFilePath, templateId, exportPayload.dataRows, exportPayload.templateLayout);

    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log('pod_upload_sheet_table_exported', {
        templateIds: [templateId],
        filePaths: [selectedFilePath],
        productCount: resolvedProducts.length,
        rowCount: exportPayload.rowCount
      });
    }

    return {
      canceled: false,
      filePath: selectedFilePath,
      filePaths: [selectedFilePath],
      rowCount: exportPayload.rowCount,
      productCount: resolvedProducts.length,
      templateId,
      exports: [{
        templateId,
        filePath: selectedFilePath,
        rowCount: exportPayload.rowCount,
        productCount: exportPayload.productCount
      }]
    };
  }

  return {
    exportTable
  };
}

module.exports = {
  createPodUploadSheetMiaoshouExportService
};
