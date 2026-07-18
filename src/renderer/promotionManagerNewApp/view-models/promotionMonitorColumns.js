import { normalizeMonitorRegionIds } from './promotionMonitorConfig.js';

const EMPTY_TEXT = '-';
const ALL_FILTER_ID = 'all';
const ALL_REGION_IDS = Object.freeze(['us', 'eu', 'global']);

export const MONITOR_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: '\u5168\u90e8' },
  { value: 'cost', label: '\u82b1\u8d39' },
  { value: 'basic', label: '\u57fa\u7840\u6548\u679c' },
  { value: 'net', label: '\u51c0\u6210\u4ea4\u6548\u679c' }
]);

export const MONITOR_COLUMN_GROUPS = Object.freeze([
  {
    id: 'spend',
    label: '\u82b1\u8d39',
    theme: 'amber',
    columns: Object.freeze([
      { id: 'ad_spend_label', shortLabel: '\u603b\u82b1\u8d39', fullLabel: '\u603b\u82b1\u8d39', tags: Object.freeze(['all', 'cost']) },
      { id: 'net_ad_spend_label', shortLabel: '\u51c0\u603b\u82b1\u8d39', fullLabel: '\u51c0\u603b\u82b1\u8d39', tags: Object.freeze(['all', 'cost']) }
    ])
  },
  {
    id: 'basic',
    label: '\u57fa\u7840\u6548\u679c',
    theme: 'blue',
    columns: Object.freeze([
      { id: 'order_pay_amt_label', shortLabel: '\u7533\u62a5\u4ef7\u9500\u552e\u989d', fullLabel: '\u7533\u62a5\u4ef7\u9500\u552e\u989d(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'roas_label', shortLabel: 'ROAS', fullLabel: '\u6295\u8d44\u56de\u62a5\u7387(ROAS)(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'acos_label', shortLabel: '\u8d39\u6bd4', fullLabel: '\u8d39\u6bd4(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'transaction_cost_label', shortLabel: '\u6bcf\u7b14\u6210\u4ea4\u82b1\u8d39', fullLabel: '\u6bcf\u7b14\u6210\u4ea4\u82b1\u8d39(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'order_pay_count_label', shortLabel: '\u5b50\u8ba2\u5355\u91cf', fullLabel: '\u5b50\u8ba2\u5355\u91cf(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'goods_num_label', shortLabel: '\u4ef6\u6570', fullLabel: '\u4ef6\u6570(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'impr_count_label', shortLabel: '\u66dd\u5149\u91cf', fullLabel: '\u66dd\u5149\u91cf(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'click_count_label', shortLabel: '\u70b9\u51fb\u91cf', fullLabel: '\u70b9\u51fb\u91cf(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'ctr_label', shortLabel: 'CTR', fullLabel: '\u70b9\u51fb\u7387(CTR)(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'cvr_label', shortLabel: 'CVR', fullLabel: '\u8f6c\u5316\u7387(CVR)(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) },
      { id: 'add_cart_count_label', shortLabel: '\u52a0\u8d2d\u6570', fullLabel: '\u52a0\u5165\u8d2d\u7269\u8f66\u6570(\u5168\u57df)', tags: Object.freeze(['all', 'basic']) }
    ])
  },
  {
    id: 'net',
    label: '\u51c0\u6210\u4ea4\u6548\u679c',
    theme: 'green',
    columns: Object.freeze([
      { id: 'net_pay_amt_label', shortLabel: '\u51c0\u7533\u62a5\u4ef7\u9500\u552e\u989d', fullLabel: '\u51c0\u7533\u62a5\u4ef7\u9500\u552e\u989d(\u5168\u57df)', tags: Object.freeze(['all', 'net']) },
      { id: 'net_roas_label', shortLabel: '\u51c0ROAS', fullLabel: '\u51c0\u6295\u8d44\u56de\u62a5\u7387(ROAS)(\u5168\u57df)', tags: Object.freeze(['all', 'net']) },
      { id: 'net_acos_ad_label', shortLabel: '\u51c0\u8d39\u6bd4', fullLabel: '\u51c0\u8d39\u6bd4(\u5168\u57df)', tags: Object.freeze(['all', 'net']) },
      { id: 'net_trans_cost_ad_label', shortLabel: '\u51c0\u6bcf\u7b14\u6210\u4ea4\u82b1\u8d39', fullLabel: '\u51c0\u6bcf\u7b14\u6210\u4ea4\u82b1\u8d39(\u5168\u57df)', tags: Object.freeze(['all', 'net']) },
      { id: 'net_pay_cnt_label', shortLabel: '\u51c0\u5b50\u8ba2\u5355\u91cf', fullLabel: '\u51c0\u5b50\u8ba2\u5355\u91cf(\u5168\u57df)', tags: Object.freeze(['all', 'net']) },
      { id: 'net_goods_num_label', shortLabel: '\u51c0\u4ef6\u6570', fullLabel: '\u51c0\u4ef6\u6570(\u5168\u57df)', tags: Object.freeze(['all', 'net']) }
    ])
  }
]);

export const ALL_MONITOR_COLUMN_IDS = Object.freeze(
  MONITOR_COLUMN_GROUPS.flatMap((group) => group.columns.map((column) => column.id))
);

export const DEFAULT_MONITOR_COLUMN_IDS = Object.freeze([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_label',
  'roas_label',
  'acos_label',
  'transaction_cost_label',
  'order_pay_count_label',
  'goods_num_label',
  'impr_count_label',
  'click_count_label',
  'ctr_label',
  'cvr_label',
  'add_cart_count_label'
]);

const COLUMN_BY_ID = new Map(
  MONITOR_COLUMN_GROUPS.flatMap((group) => (
    group.columns.map((column) => [column.id, { ...column, theme: group.theme, groupId: group.id }])
  ))
);

const FILTER_VALUE_SET = new Set(MONITOR_FILTER_OPTIONS.map((option) => option.value));
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
const SUMMARY_LABEL = '\u6c47\u603b';
const SUMMARY_TITLE_LABEL = '\u6240\u6709\u5e97\u94fa\u6c47\u603b';
const DIRECT_SUM_COLUMN_ID_SET = new Set([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'order_pay_count_label',
  'net_pay_cnt_label',
  'goods_num_label',
  'net_goods_num_label',
  'impr_count_label',
  'click_count_label',
  'add_cart_count_label'
]);
const MONEY_COLUMN_ID_SET = new Set([
  'ad_spend_label',
  'net_ad_spend_label',
  'order_pay_amt_label',
  'net_pay_amt_label',
  'transaction_cost_label',
  'net_trans_cost_ad_label'
]);
const COUNT_COLUMN_ID_SET = new Set([
  'order_pay_count_label',
  'net_pay_cnt_label',
  'goods_num_label',
  'net_goods_num_label',
  'impr_count_label',
  'click_count_label',
  'add_cart_count_label'
]);
const DERIVED_SUMMARY_DEFINITIONS = Object.freeze({
  roas_label: { numeratorColumnId: 'order_pay_amt_label', denominatorColumnId: 'ad_spend_label', format: 'ratio' },
  net_roas_label: { numeratorColumnId: 'net_pay_amt_label', denominatorColumnId: 'net_ad_spend_label', format: 'ratio' },
  acos_label: { numeratorColumnId: 'ad_spend_label', denominatorColumnId: 'order_pay_amt_label', format: 'percent' },
  net_acos_ad_label: { numeratorColumnId: 'net_ad_spend_label', denominatorColumnId: 'net_pay_amt_label', format: 'percent' },
  transaction_cost_label: { numeratorColumnId: 'ad_spend_label', denominatorColumnId: 'order_pay_count_label', format: 'money' },
  net_trans_cost_ad_label: { numeratorColumnId: 'net_ad_spend_label', denominatorColumnId: 'net_pay_cnt_label', format: 'money' },
  ctr_label: { numeratorColumnId: 'click_count_label', denominatorColumnId: 'impr_count_label', format: 'percent' },
  cvr_label: { numeratorColumnId: 'order_pay_count_label', denominatorColumnId: 'click_count_label', format: 'percent' }
});

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function normalizeMonitorFilter(value) {
  const normalizedValue = normalizeText(value);

  return FILTER_VALUE_SET.has(normalizedValue) ? normalizedValue : ALL_FILTER_ID;
}

export function normalizeMonitorColumnIds(value) {
  const validColumnIds = new Set(ALL_MONITOR_COLUMN_IDS);
  const normalizedColumnIds = Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => normalizeText(entry))
      .filter((entry) => validColumnIds.has(entry))
  ));

  return normalizedColumnIds.length > 0
    ? normalizedColumnIds
    : [...DEFAULT_MONITOR_COLUMN_IDS];
}

export function resolveVisibleMonitorColumns(selectedColumnIds, activeFilter) {
  const selectedIdSet = new Set(normalizeMonitorColumnIds(selectedColumnIds));
  const normalizedFilter = normalizeMonitorFilter(activeFilter);

  return MONITOR_COLUMN_GROUPS.flatMap((group) => (
    group.columns
      .filter((column) => (
        selectedIdSet.has(column.id)
        && (
          normalizedFilter === ALL_FILTER_ID
          || column.tags.includes(normalizedFilter)
        )
      ))
      .map((column) => ({ ...column, theme: group.theme, groupId: group.id }))
  ));
}

export function getMonitorColumnLabel(columnId) {
  const column = COLUMN_BY_ID.get(normalizeText(columnId));

  return column ? column.fullLabel || column.shortLabel : normalizeText(columnId);
}

function getRegionState(regionStates, regionId) {
  return regionStates && typeof regionStates === 'object' && regionStates[regionId]
    ? regionStates[regionId]
    : null;
}

function normalizeMetricValue(value) {
  const text = normalizeText(value);

  return text && text !== '--' ? text : '';
}

function parseMetricNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = normalizeText(value);

  if (!text || text === EMPTY_TEXT || text === '--') {
    return null;
  }

  const normalizedText = text
    .replace(/[%\uff05,\s]/g, '')
    .replace(/[^\d.-]/g, '');

  if (
    !normalizedText
    || normalizedText === '-'
    || normalizedText === '.'
    || normalizedText === '-.'
  ) {
    return null;
  }

  const parsedValue = Number(normalizedText);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatMetricNumber(value, options = {}) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: Math.max(0, Number(options.minimumFractionDigits) || 0),
    maximumFractionDigits: Math.max(
      Math.max(0, Number(options.minimumFractionDigits) || 0),
      Number(options.maximumFractionDigits) || 0
    )
  });
}

function formatSummaryValue(columnId, value, format) {
  if (!Number.isFinite(value)) {
    return EMPTY_TEXT;
  }

  if (format === 'percent') {
    return `${formatMetricNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}%`;
  }

  if (format === 'ratio') {
    return formatMetricNumber(value, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  if (format === 'money' || MONEY_COLUMN_ID_SET.has(columnId)) {
    return formatMetricNumber(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (COUNT_COLUMN_ID_SET.has(columnId)) {
    return formatMetricNumber(Math.round(value), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  return formatMetricNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function resolveMetricRegionIds(regionStates, requestedRegionIds) {
  const normalizedRequestedRegionIds = normalizeMonitorRegionIds(requestedRegionIds, {
    useDefault: false
  });
  const sourceRegionIds = normalizedRequestedRegionIds.length > 0
    ? normalizedRequestedRegionIds
    : ALL_REGION_IDS;

  return sourceRegionIds.filter((regionId) => Boolean(getRegionState(regionStates, regionId)));
}

function buildEmptyCell() {
  const rows = ALL_REGION_IDS.map((regionId) => ({
    regionId,
    regionLabel: REGION_LABELS[regionId] || regionId,
    shortLabel: REGION_SHORT_LABELS[regionId] || regionId,
    text: EMPTY_TEXT,
    empty: true
  }));

  return {
    text: EMPTY_TEXT,
    title: rows.map((item) => `${item.regionLabel}\uff1a${item.text}`).join('\n'),
    rows
  };
}

function getMetricCellRegionRows(row, columnId) {
  const metricCell = row && row.metrics ? row.metrics[columnId] : null;

  return metricCell && Array.isArray(metricCell.rows) ? metricCell.rows : [];
}

function getMetricCellRegionValue(row, columnId, regionId) {
  const regionRow = getMetricCellRegionRows(row, columnId)
    .find((item) => item && item.regionId === regionId);

  return regionRow ? parseMetricNumber(regionRow.text) : null;
}

function sumColumnRegionValues(rows, columnId, regionId) {
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const value = getMetricCellRegionValue(row, columnId, regionId);

    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function sumColumnAllRegionValues(rows, columnId) {
  return ALL_REGION_IDS.reduce((sum, regionId) => (
    sum + sumColumnRegionValues(rows, columnId, regionId)
  ), 0);
}

function hasColumnRegionValue(rows, columnId, regionId) {
  return (Array.isArray(rows) ? rows : [])
    .some((row) => Number.isFinite(getMetricCellRegionValue(row, columnId, regionId)));
}

function hasColumnAnyRegionValue(rows, columnId) {
  return ALL_REGION_IDS.some((regionId) => hasColumnRegionValue(rows, columnId, regionId));
}

function resolveSummaryRegionValue(rows, columnId, regionId) {
  const derivedDefinition = DERIVED_SUMMARY_DEFINITIONS[columnId];

  if (derivedDefinition) {
    if (
      !hasColumnRegionValue(rows, derivedDefinition.numeratorColumnId, regionId)
      || !hasColumnRegionValue(rows, derivedDefinition.denominatorColumnId, regionId)
    ) {
      return {
        value: null,
        text: EMPTY_TEXT
      };
    }

    const numerator = sumColumnRegionValues(rows, derivedDefinition.numeratorColumnId, regionId);
    const denominator = sumColumnRegionValues(rows, derivedDefinition.denominatorColumnId, regionId);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return {
        value: null,
        text: EMPTY_TEXT
      };
    }

    const normalizedValue = derivedDefinition.format === 'percent'
      ? (numerator / denominator) * 100
      : numerator / denominator;

    return {
      value: normalizedValue,
      text: formatSummaryValue(columnId, normalizedValue, derivedDefinition.format)
    };
  }

  if (!DIRECT_SUM_COLUMN_ID_SET.has(columnId) || !hasColumnRegionValue(rows, columnId, regionId)) {
    return {
      value: null,
      text: EMPTY_TEXT
    };
  }

  const summedValue = sumColumnRegionValues(rows, columnId, regionId);

  return {
    value: summedValue,
    text: formatSummaryValue(columnId, summedValue)
  };
}

function resolveSummaryTotalValue(rows, columnId) {
  const derivedDefinition = DERIVED_SUMMARY_DEFINITIONS[columnId];

  if (derivedDefinition) {
    if (
      !hasColumnAnyRegionValue(rows, derivedDefinition.numeratorColumnId)
      || !hasColumnAnyRegionValue(rows, derivedDefinition.denominatorColumnId)
    ) {
      return {
        value: null,
        text: EMPTY_TEXT
      };
    }

    const numerator = sumColumnAllRegionValues(rows, derivedDefinition.numeratorColumnId);
    const denominator = sumColumnAllRegionValues(rows, derivedDefinition.denominatorColumnId);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return {
        value: null,
        text: EMPTY_TEXT
      };
    }

    const normalizedValue = derivedDefinition.format === 'percent'
      ? (numerator / denominator) * 100
      : numerator / denominator;

    return {
      value: normalizedValue,
      text: formatSummaryValue(columnId, normalizedValue, derivedDefinition.format)
    };
  }

  if (!DIRECT_SUM_COLUMN_ID_SET.has(columnId) || !hasColumnAnyRegionValue(rows, columnId)) {
    return {
      value: null,
      text: EMPTY_TEXT
    };
  }

  const summedValue = sumColumnAllRegionValues(rows, columnId);

  return {
    value: summedValue,
    text: formatSummaryValue(columnId, summedValue)
  };
}

function buildEmptyColumnSummary() {
  const rows = ALL_REGION_IDS.map((regionId) => ({
    regionId,
    regionLabel: REGION_LABELS[regionId] || regionId,
    shortLabel: REGION_SHORT_LABELS[regionId] || regionId,
    text: EMPTY_TEXT,
    empty: true
  }));

  return {
    text: `${SUMMARY_LABEL} ${EMPTY_TEXT}`,
    title: [
      `${SUMMARY_TITLE_LABEL}\uff1a${EMPTY_TEXT}`,
      ...rows.map((item) => `${item.regionLabel}\uff1a${item.text}`)
    ].join('\n'),
    rows
  };
}

export function buildMonitorMetricCells(regionStates, requestedRegionIds) {
  const activeRegionIdSet = new Set(
    normalizeMonitorRegionIds(requestedRegionIds, { useDefault: false })
  );

  return ALL_MONITOR_COLUMN_IDS.reduce((result, columnId) => {
    const rows = ALL_REGION_IDS
      .map((regionId) => {
        const regionState = getRegionState(regionStates, regionId);
        const summary = regionState && regionState.summary && typeof regionState.summary === 'object'
          ? regionState.summary
          : {};
        const text = normalizeMetricValue(summary[columnId]);

        return {
          regionId,
          regionLabel: REGION_LABELS[regionId] || regionId,
          shortLabel: REGION_SHORT_LABELS[regionId] || regionId,
          text: text || EMPTY_TEXT,
          empty: !text,
          active: activeRegionIdSet.size <= 0 || activeRegionIdSet.has(regionId)
        };
      });

    if (rows.every((item) => item.empty)) {
      result[columnId] = buildEmptyCell();
      return result;
    }

    result[columnId] = {
      text: rows.map((item) => `${item.shortLabel} ${item.text}`).join(' / '),
      title: rows.map((item) => `${item.regionLabel}\uff1a${item.text}`).join('\n'),
      rows
    };
    return result;
  }, {});
}

export function buildMonitorColumnSummaries(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];

  if (sourceRows.length <= 0) {
    return ALL_MONITOR_COLUMN_IDS.reduce((result, columnId) => {
      result[columnId] = buildEmptyColumnSummary();
      return result;
    }, {});
  }

  return ALL_MONITOR_COLUMN_IDS.reduce((result, columnId) => {
    const summaryRows = ALL_REGION_IDS.map((regionId) => {
      const summaryValue = resolveSummaryRegionValue(sourceRows, columnId, regionId);

      return {
        regionId,
        regionLabel: REGION_LABELS[regionId] || regionId,
        shortLabel: REGION_SHORT_LABELS[regionId] || regionId,
        text: summaryValue.text,
        empty: summaryValue.text === EMPTY_TEXT
      };
    });
    const totalSummary = resolveSummaryTotalValue(sourceRows, columnId);

    if (totalSummary.text === EMPTY_TEXT && summaryRows.every((item) => item.empty)) {
      result[columnId] = buildEmptyColumnSummary();
      return result;
    }

    result[columnId] = {
      text: `${SUMMARY_LABEL} ${totalSummary.text}`,
      title: [
        `${SUMMARY_TITLE_LABEL}\uff1a${totalSummary.text}`,
        ...summaryRows.map((item) => `${item.regionLabel}\uff1a${item.text}`)
      ].join('\n'),
      rows: summaryRows
    };
    return result;
  }, {});
}

export function buildMonitorRegionSummary(regionStates, requestedRegionIds) {
  const regionIds = resolveMetricRegionIds(regionStates, requestedRegionIds);
  const summaries = regionIds
    .map((regionId) => {
      const regionState = getRegionState(regionStates, regionId);
      const fetchedAt = normalizeText(regionState && regionState.fetchedAt);
      const source = normalizeText(regionState && regionState.summarySource);
      const detailFetched = regionState && regionState.detailFetched === true;
      const productCount = Math.max(0, Number.parseInt(regionState && regionState.productCount, 10) || 0);

      if (!fetchedAt && !source && detailFetched !== true) {
        return {
          regionId,
          text: `${REGION_SHORT_LABELS[regionId] || regionId} ${EMPTY_TEXT}`,
          title: `${REGION_LABELS[regionId] || regionId}\uff1a${EMPTY_TEXT}`
        };
      }

      return {
        regionId,
        text: `${REGION_SHORT_LABELS[regionId] || regionId} ${productCount}`,
        title: `${REGION_LABELS[regionId] || regionId}\uff1a${productCount} \u4e2a\u5546\u54c1`
      };
    });

  if (summaries.length === 0) {
    return {
      text: '\u672a\u540c\u6b65',
      title: ''
    };
  }

  return {
    text: summaries.map((item) => item.text).join(' / '),
    title: summaries.map((item) => item.title).join('\n')
  };
}
