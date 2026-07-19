function formatDateValue(date) {
  const sourceDate = date instanceof Date ? date : new Date();
  const pad = (numberValue) => String(numberValue).padStart(2, '0');

  return [
    sourceDate.getFullYear(),
    pad(sourceDate.getMonth() + 1),
    pad(sourceDate.getDate())
  ].join('-');
}

export function createDateRangeByOffset(startOffsetDays, endOffsetDays = 0) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  startDate.setDate(startDate.getDate() + startOffsetDays);
  endDate.setDate(endDate.getDate() + endOffsetDays);

  return [
    formatDateValue(startDate),
    formatDateValue(endDate)
  ];
}

export function createTodayDateRange() {
  return createDateRangeByOffset(0, 0);
}

export function createThisMonthDateRange() {
  const now = new Date();
  const firstDate = new Date(now.getFullYear(), now.getMonth(), 1);

  return [
    formatDateValue(firstDate),
    formatDateValue(now)
  ];
}

export function createLastMonthDateRange() {
  const now = new Date();
  const firstDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDate = new Date(now.getFullYear(), now.getMonth(), 0);

  return [
    formatDateValue(firstDate),
    formatDateValue(lastDate)
  ];
}

export function createDefaultDateShortcuts() {
  return Object.freeze([
    { label: '\u4eca\u5929', value: createTodayDateRange },
    { label: '\u8fd17\u5929', value: () => createDateRangeByOffset(-6, 0) },
    { label: '\u8fd130\u5929', value: () => createDateRangeByOffset(-29, 0) },
    { label: '\u672c\u6708', value: createThisMonthDateRange },
    { label: '\u4e0a\u6708', value: createLastMonthDateRange }
  ]);
}
