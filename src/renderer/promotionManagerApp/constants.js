// 监控筛选器
export const MONITOR_FILTERS = Object.freeze([
  { id: 'all', label: '全部' },
  { id: 'net', label: '净指标' },
  { id: 'ad', label: '推广口径' },
  { id: 'store', label: '全店口径' },
  { id: 'traffic', label: '流量曝光' },
  { id: 'conversion', label: '成交转化' }
]);

// 自定义快速筛选
export const CUSTOMIZE_QUICK_FILTERS = Object.freeze([
  { id: 'store', label: '全店数据' },
  { id: 'ad', label: '推广数据' },
  { id: 'net', label: '净(AD)数据' },
  { id: 'traffic', label: '流量曝光' },
  { id: 'conversion', label: '成交转化' }
]);

// 运行时日志事件前缀
export const PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES = Object.freeze([
  'promotion_master_',
  'promotion_monitor_'
]);

// 监控指标分组帮助文字
export const MONITOR_GROUP_HELP = Object.freeze({
  spend: '展示推广花费的不同口径，便于区分平台总花费与商家实际承担的净花费。',
  sales: '对比全店、推广、净(AD)三种口径下的申报价销售额。',
  roas: '用申报价销售额除以花费计算 ROAS，用于对比投入产出效率。',
  acos: '用花费除以申报价销售额得出费比，数值越低通常越好。',
  transaction: '对比各口径下每成交 1 笔子订单的平均花费。',
  orders: '对比全店、推广、净(AD)三种口径下的子订单量。',
  quantity: '对比全店、推广、净(AD)三种口径下的件数。',
  impression: '对比全店与推广口径下的曝光量。',
  click: '对比全店与推广口径下的点击量。',
  ctr: '对比全店与推广口径下的点击率(CTR)。',
  cvr: '对比全店与推广口径下的转化率(CVR)。',
  cart: '展示推广口径下的加入购物车数。'
});

// 监控指标列说明
export const MONITOR_COLUMN_HELP = Object.freeze({
  ad_spend_label: '商品推广被买家浏览所产生的花费，已去除符合规则的秒退订单推广费。',
  net_ad_spend_label: '商家实际承担的推广花费，即总花费扣除退单红包后的净值。',
  order_pay_amt_all: '商品在全店维度产生的申报价销售额总和，含取消与退款订单。',
  order_pay_amt_label: '推广被点击后 30 天内带来的申报价销售额，含退款订单。',
  net_pay_amt_label: '剩除直接减免花费及退单红包对应退款订单后的净申报价销售额。',
  roas_all: '全店申报价销售额除以推广花费得出的 ROAS，反映全店回报。',
  roas_label: '推广申报价销售额除以推广花费得出的 ROAS。',
  net_roas_label: '用净申报价销售额除以净总花费得出的净 ROAS。',
  acos_all_label: '推广花费除以全店申报价销售额得出的费比。',
  acos_label: '推广花费除以推广带来的申报价销售额得出的费比。',
  net_acos_ad_label: '用净总花费除以净申报价销售额计算的净费比。',
  transaction_cost_all: '推广花费除以商品全店子订单量得出的每笔成交花费。',
  transaction_cost_label: '推广花费除以推广子订单量得出的每笔成交花费。',
  net_trans_cost_ad_label: '用净总花费除以净子订单量得出的净每笔成交花费。',
  order_pay_count_all_label: '商品全店维度的子订单量，含取消与退款订单。',
  order_pay_count_label: '推广被点击后 30 天内带来的子订单量，含退款订单。',
  net_pay_cnt_label: '剩除直接减免花费及退单红包对应退款订单后的净子订单量。',
  goods_num_all: '选定时间段内全店商品的支付件数，含取消与退款订单。',
  goods_num_label: '商品推广被曝光并被买家点击后，30 天内直接购买的商品件数，含退款订单。',
  net_goods_num_label: '剩除直接减免花费及退单红包对应退款订单后计算的净件数。',
  impr_count_all: '商品在全店口径下被买家浏览的次数。',
  impr_count_label: '商品推广曝光被买家浏览的次数。',
  click_count_all: '商品在全店口径下被买家点击的次数。',
  click_count_label: '商品推广被买家点击的次数。',
  ctr_all: '全店点击量除以全店曝光量计算得出的点击率(CTR)。',
  ctr_label: '推广点击量除以推广曝光量计算得出的点击率(CTR)。',
  cvr_all: '全店子订单量除以全店点击量计算得出的转化率(CVR)。',
  cvr_label: '推广子订单量除以推广点击量计算得出的转化率(CVR)。',
  add_cart_count_label: '商品推广被曝光后，买家加入购物车的次数。'
});

// 监控固定列
export const MONITOR_BASE_COLUMNS = Object.freeze([
  { id: 'monitor', label: '监控状态', width: 140 },
  { id: 'log', label: '监控日志', width: 220 },
  { id: 'shop', label: '店铺名称', width: 190 },
  { id: 'group', label: '店铺分组', width: 140 },
  { id: 'note', label: '店铺备注', width: 160 }
]);

// 监控数据列分组
export const MONITOR_COLUMN_GROUPS = Object.freeze([
  {
    id: 'spend', label: '花费', theme: 'amber',
    columns: [
      { id: 'ad_spend_label', shortLabel: '总花费', fullLabel: '总花费', tags: ['all', 'ad'] },
      { id: 'net_ad_spend_label', shortLabel: '净总花费', fullLabel: '净总花费', tags: ['all', 'ad', 'net'] }
    ]
  },
  {
    id: 'sales', label: '申报价销售额', theme: 'blue',
    columns: [
      { id: 'order_pay_amt_all', shortLabel: '全店', fullLabel: '申报价销售额 (全店)', tags: ['all', 'store', 'conversion'] },
      { id: 'order_pay_amt_label', shortLabel: '推广', fullLabel: '申报价销售额 (推广)', tags: ['all', 'ad', 'conversion'] },
      { id: 'net_pay_amt_label', shortLabel: '净(AD)', fullLabel: '申报价销售额 (净(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
    ]
  },
  {
    id: 'roas', label: '投资回报率(ROAS)', theme: 'green',
    columns: [
      { id: 'roas_all', shortLabel: '全店', fullLabel: '投资回报率(ROAS) (全店)', tags: ['all', 'store'] },
      { id: 'roas_label', shortLabel: '推广', fullLabel: '投资回报率(ROAS) (推广)', tags: ['all', 'ad'] },
      { id: 'net_roas_label', shortLabel: '净(AD)', fullLabel: '投资回报率(ROAS) (净(AD))', tags: ['all', 'ad', 'net'] }
    ]
  },
  {
    id: 'acos', label: '费比', theme: 'rose',
    columns: [
      { id: 'acos_all_label', shortLabel: '全店', fullLabel: '费比 (全店)', tags: ['all', 'store'] },
      { id: 'acos_label', shortLabel: '推广', fullLabel: '费比 (推广)', tags: ['all', 'ad'] },
      { id: 'net_acos_ad_label', shortLabel: '净(AD)', fullLabel: '费比 (净(AD))', tags: ['all', 'ad', 'net'] }
    ]
  },
  {
    id: 'transaction', label: '每笔成交花费', theme: 'violet',
    columns: [
      { id: 'transaction_cost_all', shortLabel: '全店', fullLabel: '每笔成交花费 (全店)', tags: ['all', 'store'] },
      { id: 'transaction_cost_label', shortLabel: '推广', fullLabel: '每笔成交花费 (推广)', tags: ['all', 'ad'] },
      { id: 'net_trans_cost_ad_label', shortLabel: '净(AD)', fullLabel: '每笔成交花费 (净(AD))', tags: ['all', 'ad', 'net'] }
    ]
  },
  {
    id: 'orders', label: '子订单量', theme: 'slate',
    columns: [
      { id: 'order_pay_count_all_label', shortLabel: '全店', fullLabel: '子订单量 (全店)', tags: ['all', 'store', 'conversion'] },
      { id: 'order_pay_count_label', shortLabel: '推广', fullLabel: '子订单量 (推广)', tags: ['all', 'ad', 'conversion'] },
      { id: 'net_pay_cnt_label', shortLabel: '净(AD)', fullLabel: '子订单量 (净(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
    ]
  },
  {
    id: 'quantity', label: '件数', theme: 'indigo',
    columns: [
      { id: 'goods_num_all', shortLabel: '全店', fullLabel: '件数 (全店)', tags: ['all', 'store', 'conversion'] },
      { id: 'goods_num_label', shortLabel: '推广', fullLabel: '件数 (推广)', tags: ['all', 'ad', 'conversion'] },
      { id: 'net_goods_num_label', shortLabel: '净(AD)', fullLabel: '件数 (净(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
    ]
  },
  {
    id: 'impression', label: '曝光量', theme: 'cyan',
    columns: [
      { id: 'impr_count_all', shortLabel: '全店', fullLabel: '曝光量 (全店)', tags: ['all', 'store', 'traffic'] },
      { id: 'impr_count_label', shortLabel: '推广', fullLabel: '曝光量 (推广)', tags: ['all', 'ad', 'traffic'] }
    ]
  },
  {
    id: 'click', label: '点击量', theme: 'cyan',
    columns: [
      { id: 'click_count_all', shortLabel: '全店', fullLabel: '点击量 (全店)', tags: ['all', 'store', 'traffic'] },
      { id: 'click_count_label', shortLabel: '推广', fullLabel: '点击量 (推广)', tags: ['all', 'ad', 'traffic'] }
    ]
  },
  {
    id: 'ctr', label: '点击率(CTR)', theme: 'blue',
    columns: [
      { id: 'ctr_all', shortLabel: '全店', fullLabel: '点击率(CTR) (全店)', tags: ['all', 'store', 'traffic'] },
      { id: 'ctr_label', shortLabel: '推广', fullLabel: '点击率(CTR) (推广)', tags: ['all', 'ad', 'traffic'] }
    ]
  },
  {
    id: 'cvr', label: '转化率(CVR)', theme: 'indigo',
    columns: [
      { id: 'cvr_all', shortLabel: '全店', fullLabel: '转化率(CVR) (全店)', tags: ['all', 'store', 'conversion'] },
      { id: 'cvr_label', shortLabel: '推广', fullLabel: '转化率(CVR) (推广)', tags: ['all', 'ad', 'conversion'] }
    ]
  },
  {
    id: 'cart', label: '加入购物车数', theme: 'amber',
    columns: [
      { id: 'add_cart_count_label', shortLabel: '推广', fullLabel: '加入购物车数 (推广)', tags: ['all', 'ad', 'traffic'] }
    ]
  }
]);

// 所有监控列 ID
export const ALL_MONITOR_COLUMN_IDS = Object.freeze(
  MONITOR_COLUMN_GROUPS.flatMap(g => g.columns.map(c => c.id))
);

// 默认显示列
export const DEFAULT_MONITOR_COLUMN_IDS = Object.freeze([
  'ad_spend_label', 'click_count_label', 'order_pay_amt_label',
  'roas_label', 'transaction_cost_label', 'order_pay_count_label',
  'goods_num_label', 'impr_count_label', 'ctr_label', 'cvr_label', 'add_cart_count_label'
]);

// 区域选项
export const MONITOR_SITE_VARIANTS = Object.freeze([
  { id: 'us', label: '美区' },
  { id: 'eu', label: '欧区' },
  { id: 'global', label: '全球' }
]);

// 操作类型
export const MONITOR_CONFIG_ACTIONS = Object.freeze([
  { id: 'pause_plan', label: '暂停计划' },
  { id: 'pause_then_resume', label: '暂停后恢复' },
  { id: 'delete_plan', label: '删除计划' },
  { id: 'update_roas', label: '修改ROAS' },
  { id: 'increase_roas', label: '增加ROAS' }
]);

// 配置字段名
export const MONITOR_CONFIG_FIELD_NAMES = Object.freeze([
  'monitorIntervalSeconds', 'dailyOperationLimit', 'totalOperationLimit',
  'autoPauseSpendThreshold', 'autoPauseRoasThreshold', 'conditionMaxRoas',
  'minOrderCount', 'regionIds', 'actionType', 'resumeIntervalMinutes', 'targetRoas'
]);

// 常量
export const PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES = 999;
export const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
export const MIN_MONITOR_INTERVAL_SECONDS = 5;
export const ACTIVE_MONITOR_POLL_INTERVAL_MS = 5000;
export const ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS = 5000;
export const RUNTIME_LOG_PAGE_SIZE = 60;
export const RUNTIME_LOG_LAZY_LOAD_THRESHOLD_PX = 96;

// 固定列默认宽度
export const DEFAULT_MONITOR_BASE_COLUMN_WIDTHS = Object.freeze({
  monitor: 140, log: 220, shop: 190, group: 140, note: 160
});

// 固定列最小宽度
export const MONITOR_BASE_COLUMN_MIN_WIDTHS = Object.freeze({
  monitor: 72, log: 88, shop: 110, group: 92, note: 104
});

// 模块定义 (新建推广 / 推广明细 的静态示例数据)
export const MODULES = Object.freeze({
  create: {
    eyebrow: '推广大师',
    title: '新建推广',
    description: '用于查看待创建的计划队列与提交状态。',
    columns: ['计划名称', '店铺', '日预算', '状态', '更新时间'],
    rows: [
      ['春季女装上新', 'ChuangShopB', '£380', '待提交', '2026-04-15 10:28'],
      ['夏日户外套餐', 'ChuangShopB', '£520', '草稿', '2026-04-15 09:42'],
      ['家清爆款追投', 'ChuangShopB', '£260', '待审核', '2026-04-14 21:16']
    ]
  },
  detail: {
    eyebrow: '推广大师',
    title: '推广明细',
    description: '集中展示计划效果与核心投放指标。',
    columns: ['计划 ID', '商品', '消耗', '点击', 'ROAS', '更新时间'],
    rows: [
      ['PM-240415-01', '轻薄防晒外套', '£126.8', '184', '3.42', '2026-04-15 10:31'],
      ['PM-240415-02', '便携凉感水杯', '£98.4', '133', '2.87', '2026-04-15 10:18'],
      ['PM-240414-07', '棉麻家居四件套', '£216.0', '249', '4.06', '2026-04-15 09:56']
    ]
  }
});
