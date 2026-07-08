const { normalizeText } = require('../shopManagement/common');

function normalizeSpecSegmentKey(segment) {
  return normalizeText(segment)
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function uniqueSpecSegments(segments = []) {
  const uniqueSegments = [];
  const seenSegmentKeys = new Set();

  (Array.isArray(segments) ? segments : [segments]).forEach((segment) => {
    const normalizedSegment = normalizeText(segment);
    const segmentKey = normalizeSpecSegmentKey(normalizedSegment);

    if (!segmentKey || seenSegmentKeys.has(segmentKey)) {
      return;
    }

    seenSegmentKeys.add(segmentKey);
    uniqueSegments.push(normalizedSegment);
  });

  return uniqueSegments;
}

function buildSkuPropertySegments(skuRecord) {
  const properties = Array.isArray(skuRecord && skuRecord.productPropertyList)
    ? skuRecord.productPropertyList
    : [];

  return uniqueSpecSegments(
    properties
      .map((property) => {
        const name = normalizeText(property && property.name);
        const value = normalizeText(property && property.value);
        return name && value ? `${name}:${value}` : '';
      })
      .filter(Boolean)
  );
}

function buildSkcOptionSegments(skcRecord) {
  const colorName = normalizeText(
    skcRecord && (
      skcRecord.colorName
      || skcRecord.primaryMultiColor
    )
  );

  return uniqueSpecSegments(
    colorName
      ? [`\u989c\u8272:${colorName}`]
      : []
  );
}

function resolveFallbackSpecText(skuRecord, fallbackSpec) {
  return normalizeText(fallbackSpec)
    || normalizeText(
      skuRecord && (
        skuRecord.skuAttributeSet
        || skuRecord.specName
        || skuRecord.skuSpec
        || skuRecord.spec
      )
    );
}

function buildSkuSpecDescriptor(options = {}) {
  const skuRecord = options && typeof options === 'object'
    ? options.skuRecord
    : null;
  const skcRecord = options && typeof options === 'object'
    ? options.skcRecord
    : null;
  const fallbackSpec = resolveFallbackSpecText(
    skuRecord,
    options && typeof options === 'object' ? options.fallbackSpec : ''
  );
  const skuPropertySegments = buildSkuPropertySegments(skuRecord);
  const skcOptionSegments = buildSkcOptionSegments(skcRecord);
  const legacySegments = uniqueSpecSegments(
    fallbackSpec
      ? skuPropertySegments.concat(fallbackSpec)
      : skuPropertySegments
  );
  const compositeSegments = uniqueSpecSegments(
    skcOptionSegments.concat(legacySegments)
  );
  const spec = (compositeSegments.length > 0 ? compositeSegments : legacySegments).join('\uff0c');
  const legacySpec = legacySegments.join('\uff0c');
  const specAliases = uniqueSpecSegments([legacySpec, fallbackSpec]).filter((aliasSpec) => {
    return normalizeSpecSegmentKey(aliasSpec) !== normalizeSpecSegmentKey(spec);
  });

  return {
    spec,
    legacySpec: normalizeSpecSegmentKey(legacySpec) !== normalizeSpecSegmentKey(spec)
      ? legacySpec
      : '',
    specAliases
  };
}

module.exports = {
  buildSkuPropertySegments,
  buildSkuSpecDescriptor
};
