import {
  buildMonitorMetricCells,
  normalizeText
} from './promotionMonitorColumns.js';

const EMPTY_TEXT = '-';
const REGION_LABELS = Object.freeze({
  us: '\u7f8e\u56fd',
  eu: '\u6b27\u533a',
  global: '\u5168\u7403'
});

const REGION_SHORT_LABELS = Object.freeze({
  us: '\u7f8e',
  eu: '\u6b27',
  global: '\u5168'
});

const REGION_IDS = Object.freeze(['us', 'eu', 'global']);
const UNGROUPED_LABEL = '\u672a\u5206\u7ec4';

function normalizeRegionIds(values) {
  const sourceItems = Array.isArray(values) ? values : [];

  return Array.from(new Set(
    sourceItems
      .map((entry) => normalizeText(entry))
      .filter((entry) => REGION_IDS.includes(entry))
  ));
}

function buildRegionSummaryText(regionReports, regionIds) {
  const reports = regionReports && typeof regionReports === 'object' ? regionReports : {};
  const sourceRegionIds = normalizeRegionIds(regionIds);

  return sourceRegionIds
    .map((regionId) => {
      const report = reports[regionId];
      const shortLabel = REGION_SHORT_LABELS[regionId] || regionId;

      if (!report) {
        return `${shortLabel} -`;
      }

      return report.status === 'success'
        ? `${shortLabel} \u5df2\u67e5`
        : `${shortLabel} \u5931\u8d25`;
    })
    .join(' / ');
}

function buildRegionSummaryTitle(regionReports, regionIds) {
  const reports = regionReports && typeof regionReports === 'object' ? regionReports : {};
  const sourceRegionIds = normalizeRegionIds(regionIds);

  return sourceRegionIds
    .map((regionId) => {
      const report = reports[regionId];
      const label = REGION_LABELS[regionId] || regionId;

      if (!report) {
        return `${label}\uff1a-`;
      }

      return [
        `${label}\uff1a${normalizeText(report.statusLabel) || '-'}`,
        normalizeText(report.message) ? `\u539f\u56e0\uff1a${normalizeText(report.message)}` : '',
        Number.isFinite(Number(report.metricCount)) ? `\u6570\u636e\u9879\uff1a${Number(report.metricCount) || 0}` : ''
      ].filter(Boolean).join(' / ');
    })
    .join('\n');
}

function resolveShopQuerySummaryText(row, regionIds) {
  const successCount = Math.max(0, Number(row && row.successCount) || 0);
  const failedCount = Math.max(0, Number(row && row.failedCount) || 0);
  const regionCount = normalizeRegionIds(regionIds).length || 0;

  if (successCount <= 0 && failedCount <= 0 && regionCount <= 0) {
    return EMPTY_TEXT;
  }

  return `\u5730\u533a\u6210\u529f ${successCount} / \u5730\u533a\u5931\u8d25 ${failedCount}`;
}

export function normalizePromotionShopDataResult(result) {
  const source = result && typeof result === 'object' ? result : {};

  return {
    updatedAt: normalizeText(source.updatedAt),
    request: source.request && typeof source.request === 'object' ? source.request : {},
    rows: Array.isArray(source.rows) ? source.rows : [],
    errors: Array.isArray(source.errors) ? source.errors : [],
    warnings: Array.isArray(source.warnings) ? source.warnings : [],
    totalCount: Math.max(0, Number(source.totalCount) || 0),
    successCount: Math.max(0, Number(source.successCount) || 0),
    failedCount: Math.max(0, Number(source.failedCount) || 0)
  };
}

export function buildPromotionShopDataRows(rows, selectedRegionIds) {
  const regionIds = normalizeRegionIds(selectedRegionIds);

  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const sourceRow = row && typeof row === 'object' ? row : {};
    const shopId = normalizeText(sourceRow.shopId || sourceRow.id);
    const shopName = normalizeText(sourceRow.shopName) || shopId || `${index + 1}`;
    const regionReports = sourceRow.regions && typeof sourceRow.regions === 'object'
      ? sourceRow.regions
      : {};
    const metrics = buildMonitorMetricCells(regionReports, regionIds);
    const normalizedRegionSummaryText = normalizeText(sourceRow.regionSummaryText)
      || buildRegionSummaryText(regionReports, regionIds)
      || EMPTY_TEXT;
    const normalizedRegionSummaryTitle = normalizeText(sourceRow.regionSummaryTitle)
      || buildRegionSummaryTitle(regionReports, regionIds);

    return {
      id: normalizeText(sourceRow.id) || shopId || `${index + 1}`,
      shopId,
      shopName,
      groupName: normalizeText(sourceRow.groupName) || UNGROUPED_LABEL,
      accountValue: normalizeText(sourceRow.accountValue),
      note: normalizeText(sourceRow.note),
      status: normalizeText(sourceRow.status) || 'success',
      statusLabel: normalizeText(sourceRow.statusLabel) || '\u5df2\u67e5\u8be2',
      statusTone: normalizeText(sourceRow.statusTone) || 'green',
      queriedAt: normalizeText(sourceRow.queriedAt),
      querySummaryText: normalizeText(sourceRow.querySummaryText) || resolveShopQuerySummaryText(sourceRow, regionIds),
      regionSummaryText: normalizedRegionSummaryText,
      regionSummaryTitle: normalizedRegionSummaryTitle,
      metrics
    };
  });
}
