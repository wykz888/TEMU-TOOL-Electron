const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SKU_ROW_KEY_SEPARATOR = '__temu_toolbox__';
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const UNIVERSAL_TEMPLATE_ID = 'universal';
const HEADER_ROW_NUMBER = 9;
const DATA_START_ROW_NUMBER = 10;
const CURRENCY_VALUE = 'CNY';
const TITLE_MAX_LENGTH = 255;
const FILE_LINK_FIELD_NAMES = Object.freeze(['mainVideo', 'certificate']);
const PRODUCT_LEVEL_SINGLE_ROW_HEADERS = Object.freeze([
  '*产品名称',
  '货币类型',
  '产品主图',
  '货源链接',
  '货源平台',
  '货源ID',
  '详情描述',
  '详情图',
  '货源类目',
  '自定义属性',
  '产品视频',
  '产品证书',
  '尺寸图表'
]);

function createPodUploadSheetMiaoshouUniversalExportService({
  app,
  dialog,
  runtimeLogger,
  templateService,
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

  async function resolveUniversalTemplateFilePath({ required = false } = {}) {
    const fallbackTemplateFilePath =
      templateService && typeof templateService.getTemplateLocalFilePath === 'function'
        ? normalizeText(templateService.getTemplateLocalFilePath(UNIVERSAL_TEMPLATE_ID))
        : '';

    if (fallbackTemplateFilePath && (await fileExists(fallbackTemplateFilePath))) {
      return fallbackTemplateFilePath;
    }

    if (templateService && typeof templateService.ensureTemplateFile === 'function') {
      try {
        const ensuredFilePath = normalizeText(await templateService.ensureTemplateFile(UNIVERSAL_TEMPLATE_ID));

        if (ensuredFilePath && (await fileExists(ensuredFilePath))) {
          return ensuredFilePath;
        }
      } catch (error) {
        if (required) {
          throw new Error('\u901a\u7528\u7248\u5bfc\u51fa\u6a21\u677f\u672a\u540c\u6b65\u6210\u529f\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u5bfc\u51fa\u3002');
        }
      }
    }

    if (required) {
      throw new Error('\u901a\u7528\u7248\u5bfc\u51fa\u6a21\u677f\u4e0d\u5b58\u5728\uff0c\u8bf7\u5148\u91cd\u542f\u8f6f\u4ef6\u6216\u91cd\u8bd5\u5bfc\u51fa\u3002');
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

  function normalizeTitleValue(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const characters = Array.from(normalizedValue);

    if (characters.length <= TITLE_MAX_LENGTH) {
      return normalizedValue;
    }

    return trimTitleTail(characters.slice(0, TITLE_MAX_LENGTH).join(''));
  }

  function rewriteExportImageDomain(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    return text.replaceAll(COS_IMAGE_SOURCE_DOMAIN, COS_IMAGE_EXPORT_DOMAIN);
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(normalizeText(value));
  }

  function normalizeFileLinkFieldValue(value) {
    const text = normalizeText(value);

    if (
      (text.startsWith('"') && text.endsWith('"'))
      || (text.startsWith("'") && text.endsWith("'"))
    ) {
      return normalizeText(text.slice(1, -1));
    }

    return text;
  }

  function looksLikeLocalFilePath(value) {
    const text = normalizeFileLinkFieldValue(value);

    if (!text) {
      return false;
    }

    if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text)) {
      return true;
    }

    return /[\\/]/.test(text) && /[.][a-z0-9]{1,10}$/i.test(text);
  }

  function hasLocalFileLinkFields(products) {
    return (Array.isArray(products) ? products : []).some((product) => {
      return FILE_LINK_FIELD_NAMES.some((fieldName) => {
        const value = normalizeFileLinkFieldValue(product && product[fieldName]);

        return value && !isHttpUrl(value) && looksLikeLocalFilePath(value);
      });
    });
  }

  function buildFolderMainNumber(sourceFolder, fallbackName) {
    const segments = normalizeText(sourceFolder)
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    if (segments.length >= 2) {
      return segments.slice(-2).join('-');
    }

    if (segments.length === 1) {
      return segments[0];
    }

    return normalizeText(fallbackName);
  }

  function normalizeSkuMultilineValue(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[,\uFF0C\u3001]+/g, '\n')
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n');
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

  function getSelectedCarouselItemsByOrders(product, value) {
    const carouselItems = getCarouselItems(product);
    const selectedOrders = normalizeSequenceSelection(value)
      .split(',')
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return selectedOrders.reduce((result, orderText) => {
      const itemName = carouselItems[Number.parseInt(orderText, 10) - 1];

      if (itemName) {
        result.push(itemName);
      }

      return result;
    }, []);
  }

  function joinChineseComma(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('，');
  }

  function getMainImageValue(product) {
    return rewriteExportImageDomain(joinChineseComma(getCarouselItems(product)));
  }

  function getDetailImageValue(product) {
    return rewriteExportImageDomain(
      joinChineseComma(getSelectedCarouselItemsByOrders(product, product && product.descriptionImageOrders))
    );
  }

  function getSizeChartValue(product) {
    const explicitValue = normalizeText(product && product.sizeChart);

    if (explicitValue) {
      return rewriteExportImageDomain(explicitValue);
    }

    return rewriteExportImageDomain(joinChineseComma(getMaterialItems(product, 'preview')));
  }

  function getSkuImageValue(product, skuRow) {
    const carouselItems = getCarouselItems(product);
    const selectedOrder = normalizePositiveInteger(skuRow && skuRow.skuImage);

    if (selectedOrder > 0 && carouselItems[selectedOrder - 1]) {
      return rewriteExportImageDomain(carouselItems[selectedOrder - 1]);
    }

    return rewriteExportImageDomain(carouselItems[0] || '');
  }

  function getMainNumberValue(product) {
    return buildFolderMainNumber(
      product && product.sourceFolder,
      product && (product.mainNumber || product.masterSku || product.localName)
    );
  }

  function getProductTitleValue(product) {
    return normalizeTitleValue(product && (product.title || product.localName || getMainNumberValue(product)));
  }

  function normalizeSkuSizeValue(skuRow) {
    const sizeText = normalizeText(skuRow && skuRow.skuSize);

    if (sizeText) {
      return sizeText;
    }

    const length = normalizeText(skuRow && skuRow.length);
    const width = normalizeText(skuRow && skuRow.width);
    const height = normalizeText(skuRow && skuRow.height);

    if (length || width || height) {
      return [length || '0', width || '0', height || '0'].join('X');
    }

    return '';
  }

  function getTemplateColumns() {
    return [
      { header: '*产品主编号', getValue: (product) => getMainNumberValue(product) },
      { header: '*产品名称', getValue: (product) => getProductTitleValue(product) },
      { header: '货币类型', getValue: () => CURRENCY_VALUE },
      { header: '产品主图', getValue: (product) => getMainImageValue(product) },
      { header: '货源链接', getValue: (product) => getMainNumberValue(product) },
      { header: '货源平台', getValue: (product) => getMainNumberValue(product) },
      { header: '货源ID', getValue: (product) => getMainNumberValue(product) },
      { header: '详情描述', getValue: (product) => normalizeText(product && product.description) },
      { header: '详情图', getValue: (product) => getDetailImageValue(product) },
      { header: '货源类目', getValue: (product) => normalizeText(product && product.sourceCategory) },
      { header: '自定义属性', getValue: (product) => normalizeText(product && product.customAttributes) },
      { header: '产品视频', getValue: (product) => normalizeText(product && product.mainVideo) },
      { header: '产品证书', getValue: (product) => normalizeText(product && product.certificate) },
      { header: '尺寸图表', getValue: (product) => getSizeChartValue(product) },
      { header: 'SKU规格1', getValue: (_product, skuRow) => normalizeText(skuRow && skuRow.specValueOne) },
      { header: 'SKU规格2', getValue: (_product, skuRow) => normalizeText(skuRow && skuRow.specValueTwo) },
      { header: '平台SKU', getValue: (_product, skuRow) => normalizeText(skuRow && skuRow.platformSku) },
      { header: '*SKU售价', getValue: (_product, skuRow) => normalizeText(skuRow && (skuRow.declaredPrice || skuRow.price)) },
      { header: 'SKU图片', getValue: (product, skuRow) => getSkuImageValue(product, skuRow) },
      { header: 'SKU库存', getValue: (_product, skuRow) => normalizeText(skuRow && skuRow.stock) },
      { header: 'SKU重量(KG)', getValue: (_product, skuRow) => normalizeText(skuRow && (skuRow.skuWeightKg || skuRow.weight)) },
      { header: 'SKU尺寸(CM)', getValue: (_product, skuRow) => normalizeSkuSizeValue(skuRow) }
    ];
  }

  function normalizeTemplateHeader(value) {
    return String(value == null ? '' : value)
      .replace(/\uFEFF/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function shouldOnlyOutputOnFirstSkuRow(columnHeader) {
    return PRODUCT_LEVEL_SINGLE_ROW_HEADERS.includes(normalizeText(columnHeader));
  }

  function buildColumnsByTemplateOrder(columns, headerRow) {
    const columnMap = new Map(
      (Array.isArray(columns) ? columns : []).map((column) => [
        normalizeTemplateHeader(column && column.header),
        column
      ])
    );

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

  function buildWorksheetDataRowsXml(dataRows, rowTemplateAttributes, columnTemplateMap, columnCount) {
    return (Array.isArray(dataRows) ? dataRows : []).map((row, rowIndex) => {
      const rowNumber = rowIndex + DATA_START_ROW_NUMBER;
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

  function replaceWorksheetDimension(sheetXml, columnCount, lastRowNumber) {
    const lastColumnLabel = getColumnLabelFromNumber(columnCount);
    const nextDimension = `A1:${lastColumnLabel}${Math.max(HEADER_ROW_NUMBER, lastRowNumber)}`;

    if (/<dimension\b[^>]*ref="[^"]*"[^/]*\/>/.test(sheetXml)) {
      return sheetXml.replace(/<dimension\b([^>]*)ref="[^"]*"([^/]*)\/>/, `<dimension$1ref="${nextDimension}"$2/>`);
    }

    return sheetXml;
  }

  function replaceWorksheetSheetData(sheetXml, preservedRowsXml, dataRowsXml) {
    return String(sheetXml || '').replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${preservedRowsXml}${dataRowsXml}</sheetData>`
    );
  }

  function buildWorksheetXmlFromTemplate(sheetXml, dataRows, columnCount) {
    const preservedRowsXml = Array.from({ length: HEADER_ROW_NUMBER }, (_item, index) => (
      extractSheetRowXml(sheetXml, index + 1)
    )).join('');
    const sampleRowXmlList = [10, 11, 12, 13]
      .map((rowNumber) => extractSheetRowXml(sheetXml, rowNumber))
      .filter(Boolean);
    const headerRowXml = extractSheetRowXml(sheetXml, HEADER_ROW_NUMBER);
    const rowTemplateAttributes = extractRowAttributes(sampleRowXmlList[0] || headerRowXml);
    const columnTemplateMap = buildColumnCellTemplateMap(sampleRowXmlList.concat(headerRowXml), columnCount);
    const dataRowsXml = buildWorksheetDataRowsXml(
      dataRows,
      rowTemplateAttributes,
      columnTemplateMap,
      columnCount
    );
    let nextSheetXml = replaceWorksheetSheetData(sheetXml, preservedRowsXml, dataRowsXml);

    nextSheetXml = nextSheetXml.replace(/<mergeCells[\s\S]*?<\/mergeCells>/g, '');
    nextSheetXml = replaceWorksheetDimension(nextSheetXml, columnCount, Math.max(HEADER_ROW_NUMBER, dataRows.length + HEADER_ROW_NUMBER));
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

  async function buildWorkbookBufferFromTemplate(dataRows) {
    const templateFilePath = await resolveUniversalTemplateFilePath({ required: true });

    if (!templateFilePath) {
      throw new Error('通用版模板文件不可用。');
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
      throw new Error('通用版模板工作表不存在。');
    }

    const columnCount = Array.isArray(dataRows) && dataRows.length
      ? Math.max(...dataRows.map((row) => Array.isArray(row) ? row.length : 0), 1)
      : getTemplateColumns().length;

    worksheetEntry.data = Buffer.from(
      buildWorksheetXmlFromTemplate(worksheetEntry.data.toString('utf8'), dataRows, columnCount),
      'utf8'
    );

    return buildZipArchiveBuffer(entryList);
  }

  async function readTemplateHeaderRow() {
    const templateFilePath = await resolveUniversalTemplateFilePath();

    if (!templateFilePath) {
      return getTemplateColumns().map((column) => column.header);
    }

    try {
      const templateBuffer = await fs.promises.readFile(templateFilePath);
      const zipEntries = readZipEntries(templateBuffer);
      const sharedStrings = parseSharedStringsXml(readZipEntryText(templateBuffer, zipEntries, 'xl/sharedStrings.xml'));
      const sheetXml = readZipEntryText(templateBuffer, zipEntries, 'xl/worksheets/sheet1.xml');
      const headerRow = parseSheetRow(sheetXml, HEADER_ROW_NUMBER, sharedStrings);

      return headerRow.length ? headerRow : getTemplateColumns().map((column) => column.header);
    } catch (error) {
      if (runtimeLogger && typeof runtimeLogger.logError === 'function') {
        runtimeLogger.logError('pod_upload_sheet_universal_template_header_read_failed', error, {
          templateFilePath
        });
      }

      return getTemplateColumns().map((column) => column.header);
    }
  }

  async function buildExportRows(products) {
    const headerRow = await readTemplateHeaderRow();
    const columns = buildColumnsByTemplateOrder(getTemplateColumns(), headerRow);
    const dataRows = [];

    products.forEach((product) => {
      getProductSkuRows(product).forEach((skuRow, skuRowIndex) => {
        dataRows.push(columns.map((column) => {
          if (skuRowIndex > 0 && shouldOnlyOutputOnFirstSkuRow(column && column.header)) {
            return '';
          }

          return column.getValue(product, skuRow);
        }));
      });
    });

    return {
      dataRows,
      rowCount: dataRows.length,
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
      throw new Error(`请先批量上传图片到 COS 后再导出，当前还有 ${missingCount} 张图片未生成链接。`);
    }

    return Array.isArray(resolvedPayload && resolvedPayload.products)
      ? resolvedPayload.products
      : products;
  }

  async function resolveImageProductsForUniversalExport(products) {
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
      throw new Error(`\u8bf7\u5148\u6279\u91cf\u4e0a\u4f20\u56fe\u7247\u5230 COS \u540e\u518d\u5bfc\u51fa\uff0c\u5f53\u524d\u8fd8\u6709 ${missingCount} \u5f20\u56fe\u7247\u672a\u751f\u6210\u94fe\u63a5\u3002`);
    }

    return Array.isArray(resolvedPayload && resolvedPayload.products)
      ? resolvedPayload.products
      : products;
  }

  async function resolveUniversalProductsForExport(products) {
    const imageResolvedProducts = await resolveImageProductsForUniversalExport(products);

    if (
      !imageUploadService
      || typeof imageUploadService.resolveFieldFileLinks !== 'function'
      || !hasLocalFileLinkFields(imageResolvedProducts)
    ) {
      return imageResolvedProducts;
    }

    const resolvedFilePayload = await imageUploadService.resolveFieldFileLinks({
      products: imageResolvedProducts,
      fieldNames: FILE_LINK_FIELD_NAMES
    });
    const missingFileCount = Array.isArray(resolvedFilePayload && resolvedFilePayload.missingFilePaths)
      ? resolvedFilePayload.missingFilePaths.length
      : 0;

    if (missingFileCount > 0) {
      throw new Error(`\u4ea7\u54c1\u89c6\u9891\u6216\u4ea7\u54c1\u8bc1\u4e66\u6709 ${missingFileCount} \u4e2a\u672c\u5730\u6587\u4ef6\u672a\u8f6c\u6210\u94fe\u63a5\uff0c\u8bf7\u68c0\u67e5\u6587\u4ef6\u8def\u5f84\u540e\u91cd\u8bd5\u3002`);
    }

    return Array.isArray(resolvedFilePayload && resolvedFilePayload.products)
      ? resolvedFilePayload.products
      : imageResolvedProducts;
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

  function getDefaultExportWorkbookFileName() {
    return `pod-export-miaoshou-universal-${formatExportTimestamp()}.xlsx`;
  }

  function resolveDefaultExportDirectoryPath(payload, fallbackDirectoryPath) {
    const candidate = normalizeText(
      payload && (
        payload.defaultExportDirectoryPath
        || payload.lastExportDirectoryPath
        || payload.exportDirectoryPath
      )
    );

    if (!candidate || /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      return fallbackDirectoryPath;
    }

    const resolvedPath = path.resolve(candidate);
    const extension = path.extname(resolvedPath).toLowerCase();

    return extension === '.xlsx' ? path.dirname(resolvedPath) : resolvedPath;
  }

  async function promptExportWorkbookFilePath(defaultFilePath, parentWindow) {
    const saveResult = await dialog.showSaveDialog(parentWindow || undefined, {
      title: '导出表格',
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

    const resolvedProducts = await resolveUniversalProductsForExport(products);
    await resolveUniversalTemplateFilePath({ required: true });
    const downloadsDirectory = app && typeof app.getPath === 'function'
      ? app.getPath('downloads')
      : process.cwd();
    const defaultDirectoryPath = resolveDefaultExportDirectoryPath(payload, downloadsDirectory);
    const defaultFilePath = path.join(defaultDirectoryPath, getDefaultExportWorkbookFileName());
    const selectedFilePath = await promptExportWorkbookFilePath(defaultFilePath, parentWindow);

    if (!selectedFilePath) {
      return {
        canceled: true,
        filePath: '',
        directoryPath: '',
        rowCount: 0,
        productCount: products.length,
        templateId: UNIVERSAL_TEMPLATE_ID,
        filePaths: [],
        exports: []
      };
    }

    const exportPayload = await buildExportRows(resolvedProducts);
    const workbookBuffer = await buildWorkbookBufferFromTemplate(exportPayload.dataRows);
    await fs.promises.writeFile(selectedFilePath, workbookBuffer);
    const selectedDirectoryPath = path.dirname(selectedFilePath);

    if (runtimeLogger && typeof runtimeLogger.log === 'function') {
      runtimeLogger.log('pod_upload_sheet_universal_table_exported', {
        filePaths: [selectedFilePath],
        directoryPath: selectedDirectoryPath,
        productCount: resolvedProducts.length,
        rowCount: exportPayload.rowCount
      });
    }

    return {
      canceled: false,
      filePath: selectedFilePath,
      directoryPath: selectedDirectoryPath,
      filePaths: [selectedFilePath],
      rowCount: exportPayload.rowCount,
      productCount: resolvedProducts.length,
      templateId: UNIVERSAL_TEMPLATE_ID,
      exports: [{
        templateId: UNIVERSAL_TEMPLATE_ID,
        filePath: selectedFilePath,
        directoryPath: selectedDirectoryPath,
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
  createPodUploadSheetMiaoshouUniversalExportService
};
