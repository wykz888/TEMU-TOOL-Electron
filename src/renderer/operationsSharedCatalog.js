(function initOperationsSharedCatalog() {
  const EU_MARKET_STATION_ID_SET = new Set([
    '102', '105', '106', '107', '108', '109', '111', '112', '113', '114', '115', '116',
    '117', '120', '122', '123', '124', '130', '131', '133', '134', '135', '136', '137',
    '138', '139', '140', '141', '142', '143', '144', '145', '146', '147', '148', '149',
    '150', '151', '152', '153', '154', '155', '156', '158', '159', '165', '166', '167',
    '170', '171', '185', '192', '194', '197'
  ]);

  function resolveStationDeploymentRegion(stationId) {
    return EU_MARKET_STATION_ID_SET.has(String(stationId || '').trim()) ? 'eu' : 'us';
  }

  const STATION_OPTIONS = Object.freeze([
    { value: '100', label: '\u7f8e\u56fd\u7ad9', dr: 'us' },
    { value: '101', label: '\u52a0\u62ff\u5927\u7ad9', dr: 'us' },
    { value: '102', label: '\u82f1\u56fd\u7ad9', dr: 'eu' },
    { value: '103', label: '\u6fb3\u5927\u5229\u4e9a\u7ad9', dr: 'us' },
    { value: '104', label: '\u65b0\u897f\u5170\u7ad9', dr: 'us' },
    { value: '105', label: '\u5fb7\u56fd\u7ad9', dr: 'eu' },
    { value: '106', label: '\u6cd5\u56fd\u7ad9', dr: 'eu' },
    { value: '107', label: '\u610f\u5927\u5229\u7ad9', dr: 'eu' },
    { value: '108', label: '\u8377\u5170\u7ad9', dr: 'eu' },
    { value: '109', label: '\u897f\u73ed\u7259\u7ad9', dr: 'eu' },
    { value: '110', label: '\u58a8\u897f\u54e5\u7ad9', dr: 'us' },
    { value: '111', label: '\u8461\u8404\u7259\u7ad9', dr: 'eu' },
    { value: '112', label: '\u6ce2\u5170\u7ad9', dr: 'eu' },
    { value: '113', label: '\u745e\u5178\u7ad9', dr: 'eu' },
    { value: '114', label: '\u745e\u58eb\u7ad9', dr: 'eu' },
    { value: '115', label: '\u5e0c\u814a\u7ad9', dr: 'eu' },
    { value: '116', label: '\u7231\u5c14\u5170\u7ad9', dr: 'eu' },
    { value: '117', label: '\u585e\u6d66\u8def\u65af\u7ad9', dr: 'eu' },
    { value: '118', label: '\u65e5\u672c\u7ad9', dr: 'us' },
    { value: '120', label: '\u6c99\u7279\u7ad9', dr: 'eu' },
    { value: '122', label: '\u963f\u8054\u914b\u7ad9', dr: 'eu' },
    { value: '123', label: '\u79d1\u5a01\u7279\u7ad9', dr: 'eu' },
    { value: '124', label: '\u632a\u5a01\u7ad9', dr: 'eu' },
    { value: '125', label: '\u667a\u5229\u7ad9', dr: 'us' },
    { value: '126', label: '\u9a6c\u6765\u897f\u4e9a\u7ad9', dr: 'us' },
    { value: '127', label: '\u83f2\u5f8b\u5bbe\u7ad9', dr: 'us' },
    { value: '129', label: '\u6cf0\u56fd\u7ad9', dr: 'us' },
    { value: '130', label: '\u5361\u5854\u5c14\u7ad9', dr: 'eu' },
    { value: '131', label: '\u7ea6\u65e6\u7ad9', dr: 'eu' },
    { value: '133', label: '\u963f\u66fc\u7ad9', dr: 'eu' },
    { value: '134', label: '\u5df4\u6797\u7ad9', dr: 'eu' },
    { value: '135', label: '\u4ee5\u8272\u5217\u7ad9', dr: 'eu' },
    { value: '136', label: '\u5357\u975e\u7ad9', dr: 'eu' },
    { value: '137', label: '\u6377\u514b\u7ad9', dr: 'eu' },
    { value: '138', label: '\u5308\u7259\u5229\u7ad9', dr: 'eu' },
    { value: '139', label: '\u4e39\u9ea6\u7ad9', dr: 'eu' },
    { value: '140', label: '\u7f57\u9a6c\u5c3c\u4e9a\u7ad9', dr: 'eu' },
    { value: '141', label: '\u4fdd\u52a0\u5229\u4e9a\u7ad9', dr: 'eu' },
    { value: '142', label: '\u6bd4\u5229\u65f6\u7ad9', dr: 'eu' },
    { value: '143', label: '\u5965\u5730\u5229\u7ad9', dr: 'eu' },
    { value: '144', label: '\u82ac\u5170\u7ad9', dr: 'eu' },
    { value: '145', label: '\u65af\u6d1b\u4f10\u514b\u7ad9', dr: 'eu' },
    { value: '146', label: '\u514b\u7f57\u5730\u4e9a\u7ad9', dr: 'eu' },
    { value: '147', label: '\u65af\u6d1b\u6587\u5c3c\u4e9a\u7ad9', dr: 'eu' },
    { value: '148', label: '\u7acb\u9676\u5b9b\u7ad9', dr: 'eu' },
    { value: '149', label: '\u7231\u6c99\u5c3c\u4e9a\u7ad9', dr: 'eu' },
    { value: '150', label: '\u62c9\u8131\u7ef4\u4e9a\u7ad9', dr: 'eu' },
    { value: '151', label: '\u9a6c\u8033\u4ed6\u7ad9', dr: 'eu' },
    { value: '152', label: '\u5362\u68ee\u5821\u7ad9', dr: 'eu' },
    { value: '153', label: '\u585e\u5c14\u7ef4\u4e9a', dr: 'eu' },
    { value: '154', label: '\u6469\u5c14\u591a\u74e6', dr: 'eu' },
    { value: '155', label: '\u9ed1\u5c71', dr: 'eu' },
    { value: '156', label: '\u51b0\u5c9b', dr: 'eu' },
    { value: '158', label: '\u6ce2\u9ed1', dr: 'eu' },
    { value: '159', label: '\u963f\u5c14\u5df4\u5c3c\u4e9a', dr: 'eu' },
    { value: '163', label: '\u79d8\u9c81', dr: 'us' },
    { value: '164', label: '\u54e5\u4f26\u6bd4\u4e9a', dr: 'us' },
    { value: '165', label: '\u683c\u9c81\u5409\u4e9a', dr: 'eu' },
    { value: '166', label: '\u4e9a\u7f8e\u5c3c\u4e9a', dr: 'eu' },
    { value: '167', label: '\u963f\u585e\u62dc\u7586', dr: 'eu' },
    { value: '170', label: '\u6bdb\u91cc\u6c42\u65af', dr: 'eu' },
    { value: '171', label: '\u6469\u6d1b\u54e5', dr: 'eu' },
    { value: '176', label: '\u5df4\u62ff\u9a6c\u7ad9', dr: 'us' },
    { value: '178', label: '\u5384\u74dc\u591a\u5c14\u7ad9', dr: 'us' },
    { value: '185', label: '\u65af\u91cc\u5170\u5361\u7ad9', dr: 'eu' },
    { value: '187', label: '\u8d8a\u5357\u7ad9', dr: 'us' },
    { value: '188', label: '\u6587\u83b1\u7ad9', dr: 'us' },
    { value: '192', label: '\u5317\u9a6c\u5176\u987f', dr: 'eu' },
    { value: '194', label: '\u5409\u5c14\u5409\u65af\u65af\u5766\u7ad9', dr: 'eu' },
    { value: '197', label: '\u5217\u652f\u6566\u58eb\u767b\u7ad9', dr: 'eu' }
  ].map((option) => Object.freeze({
    ...option,
    marketRegion: option.dr === 'eu'
      ? 'eu'
      : (String(option.value || '').trim() === '100' ? 'us' : 'global')
  })));

  const STATION_LABEL_MAP = Object.freeze(
    STATION_OPTIONS.reduce((result, option) => {
      result[String(option.value)] = option.label;
      return result;
    }, Object.create(null))
  );

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeCostSpecSegmentText(specSegmentText) {
    return normalizeText(specSegmentText)
      .replace(/\s+/g, ' ')
      .replace(/[\uff1a\u0156\u0113\u951b\u6b56]/g, ':')
      .replace(/(\d+)\s*pcs?\b/gi, '$1pc')
      .replace(/\s*:\s*/g, ':');
  }

  function buildNormalizedCostSpecSegments(specText) {
    return Array.from(new Set(
      normalizeText(specText)
        .split(/[|,\uff0c]/)
        .map((segment) => normalizeCostSpecSegmentText(segment))
        .filter(Boolean)
    ));
  }

  function normalizeCostSpecText(specText) {
    const segments = buildNormalizedCostSpecSegments(specText);
    return segments.length > 0
      ? segments.join('\uff0c')
      : normalizeText(specText);
  }

  function getStationLabelByValue(value) {
    return STATION_LABEL_MAP[normalizeText(value)] || '';
  }

  function getStationOptionByValue(value) {
    const normalizedValue = normalizeText(value);
    return STATION_OPTIONS.find((option) => normalizeText(option && option.value) === normalizedValue) || null;
  }

  function getStationMarketRegionByValue(value) {
    const matchedOption = getStationOptionByValue(value);
    return normalizeText(matchedOption && matchedOption.marketRegion);
  }

  function getStationDeploymentRegionByValue(value) {
    const matchedOption = getStationOptionByValue(value);
    return normalizeText(matchedOption && matchedOption.dr) || resolveStationDeploymentRegion(value);
  }

  window.operationsSharedCatalog = {
    STATION_OPTIONS,
    getStationLabelByValue,
    getStationOptionByValue,
    getStationMarketRegionByValue,
    getStationDeploymentRegionByValue,
    normalizeCostSpecSegmentText,
    buildNormalizedCostSpecSegments,
    normalizeCostSpecText
  };
})();
