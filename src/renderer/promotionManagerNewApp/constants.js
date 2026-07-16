export const APP_COPY = Object.freeze({
  eyebrow: '\u63a8\u5e7f\u5927\u5e08-\u65b0',
  title: '\u529f\u80fd\u5207\u6362',
  subtitle: '\u9009\u62e9\u4e3b\u529f\u80fd\u540e\uff0c\u4e0b\u65b9\u5207\u6362\u5230\u5bf9\u5e94\u7684\u6574\u9875\u5e03\u5c40\u529f\u80fd\u3002',
  primaryAction: '\u65b0\u5efa\u63a8\u5e7f',
  secondaryAction: '\u540c\u6b65\u6570\u636e',
  statusLabel: '\u5e03\u5c40\u9884\u89c8',
  statusText: '\u5f85\u63a5\u5165\u771f\u5b9e\u6570\u636e'
});

export const MODULES = Object.freeze([
  {
    id: 'create',
    label: '\u65b0\u5efa\u63a8\u5e7f',
    description: '\u6279\u91cf\u9009\u54c1\u3001\u51fa\u4ef7\u548c\u9884\u7b97\u914d\u7f6e',
    icon: 'send'
  },
  {
    id: 'detail',
    label: '\u63a8\u5e7f\u660e\u7ec6',
    description: '\u6309\u5e97\u94fa\u3001\u6d3b\u52a8\u3001\u5546\u54c1\u67e5\u770b\u6570\u636e',
    icon: 'file'
  },
  {
    id: 'monitor',
    label: '\u63a8\u5e7f\u76d1\u63a7',
    description: '\u7edf\u4e00\u7ba1\u7406\u5e97\u94fa\u76d1\u63a7\u548c\u81ea\u52a8\u52a8\u4f5c',
    icon: 'notification'
  },
  {
    id: 'logs',
    label: '\u8fd0\u884c\u65e5\u5fd7',
    description: '\u67e5\u770b\u6267\u884c\u8bb0\u5f55\u548c\u5f02\u5e38\u63d0\u793a',
    icon: 'chart'
  }
]);

export const SUMMARY_METRICS = Object.freeze([
  {
    id: 'shops',
    label: '\u5df2\u9009\u5e97\u94fa',
    value: '12',
    tone: 'blue'
  },
  {
    id: 'campaigns',
    label: '\u5f85\u5904\u7406\u63a8\u5e7f',
    value: '36',
    tone: 'amber'
  },
  {
    id: 'budget',
    label: '\u65e5\u9884\u7b97',
    value: '$2,480',
    tone: 'green'
  },
  {
    id: 'guard',
    label: '\u98ce\u63a7\u89c4\u5219',
    value: '5',
    tone: 'purple'
  }
]);

export const WORKFLOW_STEPS = Object.freeze([
  {
    id: 'select',
    title: '\u9009\u62e9\u5e97\u94fa\u4e0e\u5546\u54c1',
    description: '\u652f\u6301\u6309\u5e97\u94fa\u5206\u7ec4\u3001\u5546\u54c1\u72b6\u6001\u548c\u6570\u636e\u8868\u7b5b\u9009\u3002',
    status: '\u5f85\u63a5\u5165'
  },
  {
    id: 'strategy',
    title: '\u8bbe\u7f6e\u63a8\u5e7f\u7b56\u7565',
    description: '\u914d\u7f6e\u9884\u7b97\u3001\u51fa\u4ef7\u3001\u76ee\u6807 ROAS \u548c\u6267\u884c\u8282\u594f\u3002',
    status: '\u5e03\u5c40\u5b8c\u6210'
  },
  {
    id: 'review',
    title: '\u9884\u89c8\u4e0e\u63d0\u4ea4',
    description: '\u63d0\u4ea4\u524d\u7edf\u4e00\u68c0\u67e5\u5e97\u94fa\u3001\u5546\u54c1\u548c\u9884\u7b97\u8fb9\u754c\u3002',
    status: '\u5f85\u63a5\u5165'
  }
]);

export const TABLE_COLUMNS = Object.freeze([
  '\u5e97\u94fa',
  '\u6a21\u5757',
  '\u72b6\u6001',
  '\u9884\u7b97',
  'ROAS',
  '\u64cd\u4f5c'
]);

export const TABLE_ROWS = Object.freeze([
  ['US-01', '\u65b0\u5efa\u63a8\u5e7f', '\u5f85\u5ba1\u6838', '$240', '3.2', '\u9884\u89c8'],
  ['EU-03', '\u63a8\u5e7f\u660e\u7ec6', '\u91c7\u96c6\u4e2d', '$180', '2.8', '\u67e5\u770b'],
  ['Global-02', '\u63a8\u5e7f\u76d1\u63a7', '\u8fd0\u884c\u4e2d', '$320', '4.1', '\u914d\u7f6e']
]);

export const POLICY_GROUPS = Object.freeze([
  {
    id: 'budget',
    title: '\u9884\u7b97\u4fdd\u62a4',
    items: ['\u5355\u5e97\u65e5\u9884\u7b97\u4e0a\u9650', '\u63a8\u5e7f\u7ec4\u603b\u82b1\u8d39\u9608\u503c']
  },
  {
    id: 'performance',
    title: '\u6548\u679c\u7b56\u7565',
    items: ['ROAS \u4f4e\u4e8e\u9608\u503c\u6682\u505c', '\u8f6c\u5316\u56de\u5347\u540e\u6062\u590d']
  },
  {
    id: 'schedule',
    title: '\u6267\u884c\u8282\u594f',
    items: ['\u5206\u6279\u6267\u884c', '\u6309\u533a\u57df\u8f6e\u8be2\u540c\u6b65']
  }
]);

export const LOG_ROWS = Object.freeze([
  {
    time: '21:08:12',
    level: '\u8fd0\u884c',
    text: '\u5df2\u521d\u59cb\u5316\u63a8\u5e7f\u5927\u5e08-\u65b0\u5e03\u5c40\u3002'
  },
  {
    time: '21:08:13',
    level: '\u7b49\u5f85',
    text: '\u5f85\u63a5\u5165\u5e97\u94fa\u5217\u8868\u548c\u63a8\u5e7f\u6570\u636e\u670d\u52a1\u3002'
  },
  {
    time: '21:08:14',
    level: '\u63d0\u793a',
    text: '\u5e03\u5c40\u5df2\u9884\u7559\u6279\u91cf\u521b\u5efa\u3001\u660e\u7ec6\u548c\u76d1\u63a7\u533a\u57df\u3002'
  }
]);
