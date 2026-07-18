import { normalizeText } from './promotionMonitorColumns.js';

const SORT_DIRECTIONS = Object.freeze(['ascend', 'descend']);
const TEXT_COLLATOR = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
});
const STATUS_SORT_WEIGHT = Object.freeze({
  disabled: 0,
  stopped: 10,
  idle: 20,
  online: 30,
  running: 40,
  retrying: 50,
  relogin: 60,
  error: 70
});
const AVERAGE_METRIC_COLUMN_IDS = new Set([
  'roas_label',
  'net_roas_label',
  'acos_label',
  'net_acos_ad_label',
  'transaction_cost_label',
  'net_trans_cost_ad_label',
  'ctr_label',
  'cvr_label'
]);

function normalizeSortDirection(direction) {
  return direction === 'descend' ? 'descend' : 'ascend';
}

function applyDirection(result, direction) {
  if (result === 0) {
    return 0;
  }

  const normalizedResult = result > 0 ? 1 : -1;

  return normalizeSortDirection(direction) === 'descend'
    ? -normalizedResult
    : normalizedResult;
}

function compareMissing(leftMissing, rightMissing) {
  if (leftMissing === rightMissing) {
    return 0;
  }

  return leftMissing ? 1 : -1;
}

function compareText(leftValue, rightValue, direction) {
  const leftText = normalizeText(leftValue);
  const rightText = normalizeText(rightValue);
  const missingResult = compareMissing(!leftText, !rightText);

  if (missingResult !== 0) {
    return missingResult;
  }

  if (!leftText && !rightText) {
    return 0;
  }

  return applyDirection(TEXT_COLLATOR.compare(leftText, rightText), direction);
}

function compareNumber(leftValue, rightValue, direction) {
  const leftMissing = !Number.isFinite(leftValue);
  const rightMissing = !Number.isFinite(rightValue);
  const missingResult = compareMissing(leftMissing, rightMissing);

  if (missingResult !== 0) {
    return missingResult;
  }

  if (leftMissing && rightMissing) {
    return 0;
  }

  return applyDirection(leftValue - rightValue, direction);
}

function parseMetricNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalizedValue = normalizeText(value)
    .replace(/[%\uff05,\s]/g, '')
    .replace(/[^\d.-]/g, '');

  if (
    !normalizedValue
    || normalizedValue === '-'
    || normalizedValue === '.'
    || normalizedValue === '-.'
  ) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getMetricRows(row, columnId) {
  const metricCell = row && row.metrics ? row.metrics[columnId] : null;

  return metricCell && Array.isArray(metricCell.rows) ? metricCell.rows : [];
}

function getMetricAggregate(row, columnId) {
  const metricRows = getMetricRows(row, columnId);
  const activeRows = metricRows.filter((item) => item && item.active !== false);
  const sourceRows = activeRows.length > 0 ? activeRows : metricRows;
  const values = sourceRows
    .map((item) => parseMetricNumber(item && item.text))
    .filter((value) => Number.isFinite(value));

  if (values.length <= 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return AVERAGE_METRIC_COLUMN_IDS.has(columnId) ? total / values.length : total;
}

function compareRowIdentity(leftRow, rightRow) {
  return (
    compareText(leftRow && leftRow.groupName, rightRow && rightRow.groupName, 'ascend')
    || compareText(leftRow && leftRow.shopName, rightRow && rightRow.shopName, 'ascend')
    || compareText(leftRow && leftRow.shopId, rightRow && rightRow.shopId, 'ascend')
  );
}

function buildSortable(sorter) {
  return Object.freeze({
    sortDirections: SORT_DIRECTIONS,
    sorter
  });
}

export const monitorStatusColumnSortable = buildSortable((leftRow, rightRow, extra = {}) => {
  const direction = normalizeSortDirection(extra.direction);
  const leftStatus = leftRow && leftRow.monitorEnabled === true
    ? normalizeText(leftRow.status) || 'idle'
    : 'disabled';
  const rightStatus = rightRow && rightRow.monitorEnabled === true
    ? normalizeText(rightRow.status) || 'idle'
    : 'disabled';
  const leftWeight = STATUS_SORT_WEIGHT[leftStatus] ?? STATUS_SORT_WEIGHT.idle;
  const rightWeight = STATUS_SORT_WEIGHT[rightStatus] ?? STATUS_SORT_WEIGHT.idle;

  return (
    compareNumber(leftWeight, rightWeight, direction)
    || compareRowIdentity(leftRow, rightRow)
  );
});

export const monitorLogColumnSortable = buildSortable((leftRow, rightRow, extra = {}) => (
  compareText(leftRow && leftRow.logText, rightRow && rightRow.logText, extra.direction)
  || compareText(leftRow && leftRow.regionSummaryText, rightRow && rightRow.regionSummaryText, extra.direction)
  || compareRowIdentity(leftRow, rightRow)
));

export const monitorShopColumnSortable = buildSortable((leftRow, rightRow, extra = {}) => (
  compareText(leftRow && leftRow.shopName, rightRow && rightRow.shopName, extra.direction)
  || compareText(leftRow && leftRow.groupName, rightRow && rightRow.groupName, extra.direction)
  || compareText(leftRow && leftRow.note, rightRow && rightRow.note, extra.direction)
  || compareRowIdentity(leftRow, rightRow)
));

export function createMonitorMetricColumnSortable(columnId) {
  const normalizedColumnId = normalizeText(columnId);

  return buildSortable((leftRow, rightRow, extra = {}) => (
    compareNumber(
      getMetricAggregate(leftRow, normalizedColumnId),
      getMetricAggregate(rightRow, normalizedColumnId),
      extra.direction
    )
    || compareRowIdentity(leftRow, rightRow)
  ));
}
