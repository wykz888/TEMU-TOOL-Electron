export const CATALOG_CENTER_CONFIG = Object.freeze({
  feature: Object.freeze({
    eyebrow: '\u529f\u80fd\u5de5\u4f5c\u53f0',
    title: '\u529f\u80fd\u4e2d\u5fc3',
    description: '\u6309\u529f\u80fd\u5361\u7247\u8fdb\u5165\u72ec\u7acb\u5de5\u4f5c\u53f0\uff0c\u4fdd\u6301\u6bcf\u4e2a\u6a21\u5757\u72ec\u7acb\u8fd0\u884c\u4e0e\u72ec\u7acb\u5b58\u50a8\u3002',
    emptyTitle: '\u6682\u65e0\u529f\u80fd',
    emptyDescription: '\u529f\u80fd\u4e2d\u5fc3\u8fd8\u6ca1\u6709\u53ef\u7528\u9879\u76ee\u3002',
    actionLabel: '\u8fdb\u5165\u5de5\u4f5c\u53f0',
    pendingLabel: '\u6b63\u5728\u6253\u5f00',
    disabledLabel: '\u6682\u672a\u5f00\u653e',
    metricLabels: Object.freeze({
      total: '\u529f\u80fd\u5361\u7247',
      module: '\u5b50\u6a21\u5757',
      ready: '\u53ef\u6253\u5f00'
    })
  }),
  creation: Object.freeze({
    eyebrow: '\u521b\u4f5c\u5de5\u4f5c\u53f0',
    title: '\u521b\u4f5c\u4e2d\u5fc3',
    description: '\u96c6\u4e2d\u7ba1\u7406 AI \u521b\u4f5c\u3001\u751f\u56fe\u4e0e POD \u5957\u56fe\u5de5\u4f5c\u53f0\uff0c\u5404\u81ea\u4fdd\u6301\u72ec\u7acb\u7f13\u5b58\u548c\u72ec\u7acb\u72b6\u6001\u3002',
    emptyTitle: '\u6682\u65e0\u521b\u4f5c\u529f\u80fd',
    emptyDescription: '\u521b\u4f5c\u4e2d\u5fc3\u8fd8\u6ca1\u6709\u53ef\u7528\u9879\u76ee\u3002',
    actionLabel: '\u6253\u5f00\u5de5\u4f5c\u53f0',
    pendingLabel: '\u6b63\u5728\u6253\u5f00',
    disabledLabel: '\u7b79\u5907\u4e2d',
    metricLabels: Object.freeze({
      total: '\u521b\u4f5c\u5361\u7247',
      module: '\u5b50\u80fd\u529b',
      ready: '\u53ef\u6253\u5f00'
    })
  })
});

export function getCatalogCenterConfig(centerType) {
  return centerType === 'creation'
    ? CATALOG_CENTER_CONFIG.creation
    : CATALOG_CENTER_CONFIG.feature;
}
