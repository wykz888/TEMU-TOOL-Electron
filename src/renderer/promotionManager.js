(function initPromotionManagerWindow() {
  const MONITOR_FILTERS = Object.freeze([
    { id: 'all', label: '\u5168\u90E8' },
    { id: 'net', label: '\u51C0\u6307\u6807' },
    { id: 'ad', label: '\u63A8\u5E7F\u53E3\u5F84' },
    { id: 'store', label: '\u5168\u5E97\u53E3\u5F84' },
    { id: 'traffic', label: '\u6D41\u91CF\u66DD\u5149' },
    { id: 'conversion', label: '\u6210\u4EA4\u8F6C\u5316' }
  ]);

  const CUSTOMIZE_QUICK_FILTERS = Object.freeze([
    { id: 'store', label: '\u5168\u5E97\u6570\u636E' },
    { id: 'ad', label: '\u63A8\u5E7F\u6570\u636E' },
    { id: 'net', label: '\u51C0(AD)\u6570\u636E' },
    { id: 'traffic', label: '\u6D41\u91CF\u66DD\u5149' },
    { id: 'conversion', label: '\u6210\u4EA4\u8F6C\u5316' }
  ]);
  const PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES = Object.freeze([
    'promotion_master_',
    'promotion_monitor_'
  ]);

  const MONITOR_GROUP_HELP = Object.freeze({
    spend: '\u5C55\u793A\u63A8\u5E7F\u82B1\u8D39\u7684\u4E0D\u540C\u53E3\u5F84\uFF0C\u4FBF\u4E8E\u533A\u5206\u5E73\u53F0\u603B\u82B1\u8D39\u4E0E\u5546\u5BB6\u5B9E\u9645\u627F\u62C5\u7684\u51C0\u82B1\u8D39\u3002',
    sales: '\u5BF9\u6BD4\u5168\u5E97\u3001\u63A8\u5E7F\u3001\u51C0(AD)\u4E09\u79CD\u53E3\u5F84\u4E0B\u7684\u7533\u62A5\u4EF7\u9500\u552E\u989D\u3002',
    roas: '\u7528\u7533\u62A5\u4EF7\u9500\u552E\u989D\u9664\u4EE5\u82B1\u8D39\u8BA1\u7B97 ROAS\uFF0C\u7528\u4E8E\u5BF9\u6BD4\u6295\u5165\u4EA7\u51FA\u6548\u7387\u3002',
    acos: '\u7528\u82B1\u8D39\u9664\u4EE5\u7533\u62A5\u4EF7\u9500\u552E\u989D\u5F97\u51FA\u8D39\u6BD4\uFF0C\u6570\u503C\u8D8A\u4F4E\u901A\u5E38\u8D8A\u597D\u3002',
    transaction: '\u5BF9\u6BD4\u5404\u53E3\u5F84\u4E0B\u6BCF\u6210\u4EA4 1 \u7B14\u5B50\u8BA2\u5355\u7684\u5E73\u5747\u82B1\u8D39\u3002',
    orders: '\u5BF9\u6BD4\u5168\u5E97\u3001\u63A8\u5E7F\u3001\u51C0(AD)\u4E09\u79CD\u53E3\u5F84\u4E0B\u7684\u5B50\u8BA2\u5355\u91CF\u3002',
    quantity: '\u5BF9\u6BD4\u5168\u5E97\u3001\u63A8\u5E7F\u3001\u51C0(AD)\u4E09\u79CD\u53E3\u5F84\u4E0B\u7684\u4EF6\u6570\u3002',
    impression: '\u5BF9\u6BD4\u5168\u5E97\u4E0E\u63A8\u5E7F\u53E3\u5F84\u4E0B\u7684\u66DD\u5149\u91CF\u3002',
    click: '\u5BF9\u6BD4\u5168\u5E97\u4E0E\u63A8\u5E7F\u53E3\u5F84\u4E0B\u7684\u70B9\u51FB\u91CF\u3002',
    ctr: '\u5BF9\u6BD4\u5168\u5E97\u4E0E\u63A8\u5E7F\u53E3\u5F84\u4E0B\u7684\u70B9\u51FB\u7387(CTR)\u3002',
    cvr: '\u5BF9\u6BD4\u5168\u5E97\u4E0E\u63A8\u5E7F\u53E3\u5F84\u4E0B\u7684\u8F6C\u5316\u7387(CVR)\u3002',
    cart: '\u5C55\u793A\u63A8\u5E7F\u53E3\u5F84\u4E0B\u7684\u52A0\u5165\u8D2D\u7269\u8F66\u6570\u3002'
  });

  const MONITOR_COLUMN_HELP = Object.freeze({
    ad_spend_label: '\u5546\u54C1\u63A8\u5E7F\u88AB\u4E70\u5BB6\u6D4F\u89C8\u6240\u4EA7\u751F\u7684\u82B1\u8D39\uFF0C\u5DF2\u53BB\u9664\u7B26\u5408\u89C4\u5219\u7684\u79D2\u9000\u8BA2\u5355\u63A8\u5E7F\u8D39\u3002',
    net_ad_spend_label: '\u5546\u5BB6\u5B9E\u9645\u627F\u62C5\u7684\u63A8\u5E7F\u82B1\u8D39\uFF0C\u5373\u603B\u82B1\u8D39\u6263\u9664\u9000\u5355\u7EA2\u5305\u540E\u7684\u51C0\u503C\u3002',
    order_pay_amt_all: '\u5546\u54C1\u5728\u5168\u5E97\u7EF4\u5EA6\u4EA7\u751F\u7684\u7533\u62A5\u4EF7\u9500\u552E\u989D\u603B\u548C\uFF0C\u542B\u53D6\u6D88\u4E0E\u9000\u6B3E\u8BA2\u5355\u3002',
    order_pay_amt_label: '\u63A8\u5E7F\u88AB\u70B9\u51FB\u540E 30 \u5929\u5185\u5E26\u6765\u7684\u7533\u62A5\u4EF7\u9500\u552E\u989D\uFF0C\u542B\u9000\u6B3E\u8BA2\u5355\u3002',
    net_pay_amt_label: '\u5269\u9664\u76F4\u63A5\u51CF\u514D\u82B1\u8D39\u53CA\u9000\u5355\u7EA2\u5305\u5BF9\u5E94\u9000\u6B3E\u8BA2\u5355\u540E\u7684\u51C0\u7533\u62A5\u4EF7\u9500\u552E\u989D\u3002',
    roas_all: '\u5168\u5E97\u7533\u62A5\u4EF7\u9500\u552E\u989D\u9664\u4EE5\u63A8\u5E7F\u82B1\u8D39\u5F97\u51FA\u7684 ROAS\uFF0C\u53CD\u6620\u5168\u5E97\u56DE\u62A5\u3002',
    roas_label: '\u63A8\u5E7F\u7533\u62A5\u4EF7\u9500\u552E\u989D\u9664\u4EE5\u63A8\u5E7F\u82B1\u8D39\u5F97\u51FA\u7684 ROAS\u3002',
    net_roas_label: '\u7528\u51C0\u7533\u62A5\u4EF7\u9500\u552E\u989D\u9664\u4EE5\u51C0\u603B\u82B1\u8D39\u5F97\u51FA\u7684\u51C0 ROAS\u3002',
    acos_all_label: '\u63A8\u5E7F\u82B1\u8D39\u9664\u4EE5\u5168\u5E97\u7533\u62A5\u4EF7\u9500\u552E\u989D\u5F97\u51FA\u7684\u8D39\u6BD4\u3002',
    acos_label: '\u63A8\u5E7F\u82B1\u8D39\u9664\u4EE5\u63A8\u5E7F\u5E26\u6765\u7684\u7533\u62A5\u4EF7\u9500\u552E\u989D\u5F97\u51FA\u7684\u8D39\u6BD4\u3002',
    net_acos_ad_label: '\u7528\u51C0\u603B\u82B1\u8D39\u9664\u4EE5\u51C0\u7533\u62A5\u4EF7\u9500\u552E\u989D\u8BA1\u7B97\u7684\u51C0\u8D39\u6BD4\u3002',
    transaction_cost_all: '\u63A8\u5E7F\u82B1\u8D39\u9664\u4EE5\u5546\u54C1\u5168\u5E97\u5B50\u8BA2\u5355\u91CF\u5F97\u51FA\u7684\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39\u3002',
    transaction_cost_label: '\u63A8\u5E7F\u82B1\u8D39\u9664\u4EE5\u63A8\u5E7F\u5B50\u8BA2\u5355\u91CF\u5F97\u51FA\u7684\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39\u3002',
    net_trans_cost_ad_label: '\u7528\u51C0\u603B\u82B1\u8D39\u9664\u4EE5\u51C0\u5B50\u8BA2\u5355\u91CF\u5F97\u51FA\u7684\u51C0\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39\u3002',
    order_pay_count_all_label: '\u5546\u54C1\u5168\u5E97\u7EF4\u5EA6\u7684\u5B50\u8BA2\u5355\u91CF\uFF0C\u542B\u53D6\u6D88\u4E0E\u9000\u6B3E\u8BA2\u5355\u3002',
    order_pay_count_label: '\u63A8\u5E7F\u88AB\u70B9\u51FB\u540E 30 \u5929\u5185\u5E26\u6765\u7684\u5B50\u8BA2\u5355\u91CF\uFF0C\u542B\u9000\u6B3E\u8BA2\u5355\u3002',
    net_pay_cnt_label: '\u5269\u9664\u76F4\u63A5\u51CF\u514D\u82B1\u8D39\u53CA\u9000\u5355\u7EA2\u5305\u5BF9\u5E94\u9000\u6B3E\u8BA2\u5355\u540E\u7684\u51C0\u5B50\u8BA2\u5355\u91CF\u3002',
    goods_num_all: '\u9009\u5B9A\u65F6\u95F4\u6BB5\u5185\u5168\u5E97\u5546\u54C1\u7684\u652F\u4ED8\u4EF6\u6570\uFF0C\u542B\u53D6\u6D88\u4E0E\u9000\u6B3E\u8BA2\u5355\u3002',
    goods_num_label: '\u5546\u54C1\u63A8\u5E7F\u88AB\u66DD\u5149\u5E76\u88AB\u4E70\u5BB6\u70B9\u51FB\u540E\uFF0C30 \u5929\u5185\u76F4\u63A5\u8D2D\u4E70\u7684\u5546\u54C1\u4EF6\u6570\uFF0C\u542B\u9000\u6B3E\u8BA2\u5355\u3002',
    net_goods_num_label: '\u5269\u9664\u76F4\u63A5\u51CF\u514D\u82B1\u8D39\u53CA\u9000\u5355\u7EA2\u5305\u5BF9\u5E94\u9000\u6B3E\u8BA2\u5355\u540E\u8BA1\u7B97\u7684\u51C0\u4EF6\u6570\u3002',
    impr_count_all: '\u5546\u54C1\u5728\u5168\u5E97\u53E3\u5F84\u4E0B\u88AB\u4E70\u5BB6\u6D4F\u89C8\u7684\u6B21\u6570\u3002',
    impr_count_label: '\u5546\u54C1\u63A8\u5E7F\u66DD\u5149\u88AB\u4E70\u5BB6\u6D4F\u89C8\u7684\u6B21\u6570\u3002',
    click_count_all: '\u5546\u54C1\u5728\u5168\u5E97\u53E3\u5F84\u4E0B\u88AB\u4E70\u5BB6\u70B9\u51FB\u7684\u6B21\u6570\u3002',
    click_count_label: '\u5546\u54C1\u63A8\u5E7F\u88AB\u4E70\u5BB6\u70B9\u51FB\u7684\u6B21\u6570\u3002',
    ctr_all: '\u5168\u5E97\u70B9\u51FB\u91CF\u9664\u4EE5\u5168\u5E97\u66DD\u5149\u91CF\u8BA1\u7B97\u5F97\u51FA\u7684\u70B9\u51FB\u7387(CTR)\u3002',
    ctr_label: '\u63A8\u5E7F\u70B9\u51FB\u91CF\u9664\u4EE5\u63A8\u5E7F\u66DD\u5149\u91CF\u8BA1\u7B97\u5F97\u51FA\u7684\u70B9\u51FB\u7387(CTR)\u3002',
    cvr_all: '\u5168\u5E97\u5B50\u8BA2\u5355\u91CF\u9664\u4EE5\u5168\u5E97\u70B9\u51FB\u91CF\u8BA1\u7B97\u5F97\u51FA\u7684\u8F6C\u5316\u7387(CVR)\u3002',
    cvr_label: '\u63A8\u5E7F\u5B50\u8BA2\u5355\u91CF\u9664\u4EE5\u63A8\u5E7F\u70B9\u51FB\u91CF\u8BA1\u7B97\u5F97\u51FA\u7684\u8F6C\u5316\u7387(CVR)\u3002',
    add_cart_count_label: '\u5546\u54C1\u63A8\u5E7F\u88AB\u66DD\u5149\u540E\uFF0C\u4E70\u5BB6\u52A0\u5165\u8D2D\u7269\u8F66\u7684\u6B21\u6570\u3002'
  });

  const MONITOR_BASE_COLUMNS = Object.freeze([
    { id: 'monitor', label: '\u76D1\u63A7\u72B6\u6001', width: '140px' },
    { id: 'log', label: '\u76D1\u63A7\u65E5\u5FD7', width: '220px' },
    { id: 'shop', label: '\u5E97\u94FA\u540D\u79F0', width: '190px' },
    { id: 'group', label: '\u5E97\u94FA\u5206\u7EC4', width: '140px' },
    { id: 'note', label: '\u5E97\u94FA\u5907\u6CE8', width: '160px' }
  ]);

  const MONITOR_COLUMN_GROUPS = Object.freeze([
    {
      id: 'spend',
      label: '\u82B1\u8D39',
      theme: 'amber',
      columns: [
        { id: 'ad_spend_label', shortLabel: '\u603B\u82B1\u8D39', fullLabel: '\u603B\u82B1\u8D39', tags: ['all', 'ad'] },
        { id: 'net_ad_spend_label', shortLabel: '\u51C0\u603B\u82B1\u8D39', fullLabel: '\u51C0\u603B\u82B1\u8D39', tags: ['all', 'ad', 'net'] }
      ]
    },
    {
      id: 'sales',
      label: '\u7533\u62A5\u4EF7\u9500\u552E\u989D',
      theme: 'blue',
      columns: [
        { id: 'order_pay_amt_all', shortLabel: '\u5168\u5E97', fullLabel: '\u7533\u62A5\u4EF7\u9500\u552E\u989D (\u5168\u5E97)', tags: ['all', 'store', 'conversion'] },
        { id: 'order_pay_amt_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u7533\u62A5\u4EF7\u9500\u552E\u989D (\u63A8\u5E7F)', tags: ['all', 'ad', 'conversion'] },
        { id: 'net_pay_amt_label', shortLabel: '\u51C0(AD)', fullLabel: '\u7533\u62A5\u4EF7\u9500\u552E\u989D (\u51C0(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
      ]
    },
    {
      id: 'roas',
      label: '\u6295\u8D44\u56DE\u62A5\u7387(ROAS)',
      theme: 'green',
      columns: [
        { id: 'roas_all', shortLabel: '\u5168\u5E97', fullLabel: '\u6295\u8D44\u56DE\u62A5\u7387(ROAS) (\u5168\u5E97)', tags: ['all', 'store'] },
        { id: 'roas_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u6295\u8D44\u56DE\u62A5\u7387(ROAS) (\u63A8\u5E7F)', tags: ['all', 'ad'] },
        { id: 'net_roas_label', shortLabel: '\u51C0(AD)', fullLabel: '\u6295\u8D44\u56DE\u62A5\u7387(ROAS) (\u51C0(AD))', tags: ['all', 'ad', 'net'] }
      ]
    },
    {
      id: 'acos',
      label: '\u8D39\u6BD4',
      theme: 'rose',
      columns: [
        { id: 'acos_all_label', shortLabel: '\u5168\u5E97', fullLabel: '\u8D39\u6BD4 (\u5168\u5E97)', tags: ['all', 'store'] },
        { id: 'acos_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u8D39\u6BD4 (\u63A8\u5E7F)', tags: ['all', 'ad'] },
        { id: 'net_acos_ad_label', shortLabel: '\u51C0(AD)', fullLabel: '\u8D39\u6BD4 (\u51C0(AD))', tags: ['all', 'ad', 'net'] }
      ]
    },
    {
      id: 'transaction',
      label: '\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39',
      theme: 'violet',
      columns: [
        { id: 'transaction_cost_all', shortLabel: '\u5168\u5E97', fullLabel: '\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39 (\u5168\u5E97)', tags: ['all', 'store'] },
        { id: 'transaction_cost_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39 (\u63A8\u5E7F)', tags: ['all', 'ad'] },
        { id: 'net_trans_cost_ad_label', shortLabel: '\u51C0(AD)', fullLabel: '\u6BCF\u7B14\u6210\u4EA4\u82B1\u8D39 (\u51C0(AD))', tags: ['all', 'ad', 'net'] }
      ]
    },
    {
      id: 'orders',
      label: '\u5B50\u8BA2\u5355\u91CF',
      theme: 'slate',
      columns: [
        { id: 'order_pay_count_all_label', shortLabel: '\u5168\u5E97', fullLabel: '\u5B50\u8BA2\u5355\u91CF (\u5168\u5E97)', tags: ['all', 'store', 'conversion'] },
        { id: 'order_pay_count_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u5B50\u8BA2\u5355\u91CF (\u63A8\u5E7F)', tags: ['all', 'ad', 'conversion'] },
        { id: 'net_pay_cnt_label', shortLabel: '\u51C0(AD)', fullLabel: '\u5B50\u8BA2\u5355\u91CF (\u51C0(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
      ]
    },
    {
      id: 'quantity',
      label: '\u4EF6\u6570',
      theme: 'indigo',
      columns: [
        { id: 'goods_num_all', shortLabel: '\u5168\u5E97', fullLabel: '\u4EF6\u6570 (\u5168\u5E97)', tags: ['all', 'store', 'conversion'] },
        { id: 'goods_num_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u4EF6\u6570 (\u63A8\u5E7F)', tags: ['all', 'ad', 'conversion'] },
        { id: 'net_goods_num_label', shortLabel: '\u51C0(AD)', fullLabel: '\u4EF6\u6570 (\u51C0(AD))', tags: ['all', 'ad', 'net', 'conversion'] }
      ]
    },
    {
      id: 'impression',
      label: '\u66DD\u5149\u91CF',
      theme: 'cyan',
      columns: [
        { id: 'impr_count_all', shortLabel: '\u5168\u5E97', fullLabel: '\u66DD\u5149\u91CF (\u5168\u5E97)', tags: ['all', 'store', 'traffic'] },
        { id: 'impr_count_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u66DD\u5149\u91CF (\u63A8\u5E7F)', tags: ['all', 'ad', 'traffic'] }
      ]
    },
    {
      id: 'click',
      label: '\u70B9\u51FB\u91CF',
      theme: 'cyan',
      columns: [
        { id: 'click_count_all', shortLabel: '\u5168\u5E97', fullLabel: '\u70B9\u51FB\u91CF (\u5168\u5E97)', tags: ['all', 'store', 'traffic'] },
        { id: 'click_count_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u70B9\u51FB\u91CF (\u63A8\u5E7F)', tags: ['all', 'ad', 'traffic'] }
      ]
    },
    {
      id: 'ctr',
      label: '\u70B9\u51FB\u7387(CTR)',
      theme: 'blue',
      columns: [
        { id: 'ctr_all', shortLabel: '\u5168\u5E97', fullLabel: '\u70B9\u51FB\u7387(CTR) (\u5168\u5E97)', tags: ['all', 'store', 'traffic'] },
        { id: 'ctr_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u70B9\u51FB\u7387(CTR) (\u63A8\u5E7F)', tags: ['all', 'ad', 'traffic'] }
      ]
    },
    {
      id: 'cvr',
      label: '\u8F6C\u5316\u7387(CVR)',
      theme: 'indigo',
      columns: [
        { id: 'cvr_all', shortLabel: '\u5168\u5E97', fullLabel: '\u8F6C\u5316\u7387(CVR) (\u5168\u5E97)', tags: ['all', 'store', 'conversion'] },
        { id: 'cvr_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u8F6C\u5316\u7387(CVR) (\u63A8\u5E7F)', tags: ['all', 'ad', 'conversion'] }
      ]
    },
    {
      id: 'cart',
      label: '\u52A0\u5165\u8D2D\u7269\u8F66\u6570',
      theme: 'amber',
      columns: [
        { id: 'add_cart_count_label', shortLabel: '\u63A8\u5E7F', fullLabel: '\u52A0\u5165\u8D2D\u7269\u8F66\u6570 (\u63A8\u5E7F)', tags: ['all', 'ad', 'traffic'] }
      ]
    }
  ]);

  const MONITOR_VIEW_SETTINGS_VERSION = 3;
  const MONITOR_VIEW_V2_ADDED_COLUMN_IDS = Object.freeze([
    'goods_num_all',
    'impr_count_all',
    'click_count_all',
    'ctr_all',
    'cvr_all'
  ]);

  const ALL_MONITOR_COLUMN_IDS = Object.freeze(
    MONITOR_COLUMN_GROUPS.flatMap((group) => group.columns.map((column) => column.id))
  );

  const DEFAULT_MONITOR_COLUMN_IDS = Object.freeze([
    'ad_spend_label',
    'click_count_label',
    'order_pay_amt_label',
    'roas_label',
    'transaction_cost_label',
    'order_pay_count_label',
    'goods_num_label',
    'impr_count_label',
    'ctr_label',
    'cvr_label',
    'add_cart_count_label'
  ]);

  const MONITOR_SITE_VARIANTS = Object.freeze([
    { id: 'us', label: '\u7F8E\u533A' },
    { id: 'eu', label: '\u6B27\u533A' },
    { id: 'global', label: '\u5168\u7403' }
  ]);

  const MONITOR_CONFIG_ACTIONS = Object.freeze([
    { id: 'pause_plan', label: '\u6682\u505C\u8BA1\u5212' },
    { id: 'pause_then_resume', label: '\u6682\u505C\u540E\u6062\u590D' },
    { id: 'delete_plan', label: '\u5220\u9664\u8BA1\u5212' },
    { id: 'update_roas', label: '\u4FEE\u6539ROAS' },
    { id: 'increase_roas', label: '\u589E\u52A0ROAS' }
  ]);

  const MONITOR_CONFIG_FIELD_NAMES = Object.freeze([
    'monitorIntervalSeconds',
    'dailyOperationLimit',
    'totalOperationLimit',
    'autoPauseSpendThreshold',
    'autoPauseRoasThreshold',
    'conditionMaxRoas',
    'minOrderCount',
    'regionIds',
    'actionType',
    'resumeIntervalMinutes',
    'targetRoas'
  ]);
  const PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES = 999;
  const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
  const MIN_MONITOR_INTERVAL_SECONDS = 5;
  const ACTIVE_MONITOR_POLL_INTERVAL_MS = 5000;
  const ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS = 5000;
  const RUNTIME_LOG_PAGE_SIZE = 60;
  const RUNTIME_LOG_LAZY_LOAD_THRESHOLD_PX = 96;

  const DEFAULT_MONITOR_BASE_COLUMN_WIDTHS = Object.freeze(
    MONITOR_BASE_COLUMNS.reduce((result, column) => {
      const parsedWidth = Number.parseInt(column.width, 10);

      result[column.id] = Number.isFinite(parsedWidth) ? parsedWidth : 160;
      return result;
    }, {})
  );
  const MONITOR_BASE_COLUMN_MIN_WIDTHS = Object.freeze({
    monitor: 72,
    log: 88,
    shop: 110,
    group: 92,
    note: 104
  });

  const MODULES = Object.freeze({
    create: {
      eyebrow: '\u63A8\u5E7F\u5927\u5E08',
      title: '\u65B0\u5EFA\u63A8\u5E7F',
      description: '\u7528\u4E8E\u67E5\u770B\u5F85\u521B\u5EFA\u7684\u8BA1\u5212\u961F\u5217\u4E0E\u63D0\u4EA4\u72B6\u6001\u3002',
      columnTemplate: '1.6fr 1.1fr 0.9fr 0.9fr 1.2fr',
      columns: [
        '\u8BA1\u5212\u540D\u79F0',
        '\u5E97\u94FA',
        '\u65E5\u9884\u7B97',
        '\u72B6\u6001',
        '\u66F4\u65B0\u65F6\u95F4'
      ],
      rows: [
        ['\u6625\u5B63\u5973\u88C5\u4E0A\u65B0', 'ChuangShopB', '\u00A5380', '\u5F85\u63D0\u4EA4', '2026-04-15 10:28'],
        ['\u590F\u65E5\u6237\u5916\u5957\u9910', 'ChuangShopB', '\u00A5520', '\u8349\u7A3F', '2026-04-15 09:42'],
        ['\u5BB6\u6E05\u7206\u6B3E\u8FFD\u6295', 'ChuangShopB', '\u00A5260', '\u5F85\u5BA1\u6838', '2026-04-14 21:16']
      ]
    },
    detail: {
      eyebrow: '\u63A8\u5E7F\u5927\u5E08',
      title: '\u63A8\u5E7F\u660E\u7EC6',
      description: '\u96C6\u4E2D\u5C55\u793A\u8BA1\u5212\u6548\u679C\u4E0E\u6838\u5FC3\u6295\u653E\u6307\u6807\u3002',
      columnTemplate: '1fr 1.5fr 0.9fr 0.9fr 0.9fr 1.1fr',
      columns: [
        '\u8BA1\u5212 ID',
        '\u5546\u54C1',
        '\u6D88\u8017',
        '\u70B9\u51FB',
        'ROAS',
        '\u66F4\u65B0\u65F6\u95F4'
      ],
      rows: [
        ['PM-240415-01', '\u8F7B\u8584\u9632\u6652\u5916\u5957', '\u00A5126.8', '184', '3.42', '2026-04-15 10:31'],
        ['PM-240415-02', '\u4FBF\u643A\u51C9\u611F\u6C34\u676F', '\u00A598.4', '133', '2.87', '2026-04-15 10:18'],
        ['PM-240414-07', '\u68C9\u9EBB\u5BB6\u5C45\u56DB\u4EF6\u5957', '\u00A5216.0', '249', '4.06', '2026-04-15 09:56']
      ]
    }
  });

  const moduleRuntimeState = {
    visibleShops: [],
    loadError: '',
    activeMonitorFilter: 'all',
    selectedMonitorColumnIds: DEFAULT_MONITOR_COLUMN_IDS.slice(),
    settingsLoaded: false,
    customizeDraftColumnIds: DEFAULT_MONITOR_COLUMN_IDS.slice(),
    monitorToggleStateByKey: {},
    monitorBaseColumnWidths: { ...DEFAULT_MONITOR_BASE_COLUMN_WIDTHS },
    monitorResizeSession: null,
    monitorSnapshot: {
      updatedAt: '',
      batchMonitoringActive: false,
      enabledShopIds: [],
      shops: {}
    },
    monitorSnapshotLoading: false,
    monitorSnapshotPollTimer: 0,
    monitorConfig: {
      monitorIntervalSeconds: String(DEFAULT_MONITOR_INTERVAL_SECONDS),
      dailyOperationLimit: '',
      totalOperationLimit: '',
      autoPauseSpendThreshold: '',
      autoPauseRoasThreshold: '',
      conditionMaxRoas: '',
      minOrderCount: '1',
      regionIds: MONITOR_SITE_VARIANTS.map((site) => site.id),
      actionType: 'pause_plan',
      resumeIntervalMinutes: '',
      targetRoas: ''
    },
    monitorShopConfigs: {},
    activeMonitorShopConfigKey: '',
    monitorShopConfigDraft: null,
    windowNoticeTimer: 0,
    runtimeLogEntries: [],
    runtimeLogLoading: false,
    runtimeLogLoadError: '',
    runtimeLogUpdatedAt: '',
    runtimeLogTotalCount: 0,
    runtimeLogLimit: RUNTIME_LOG_PAGE_SIZE,
    runtimeLogHasMore: false,
    runtimeLogPollTimer: 0,
    runtimeLogLastRenderSignature: ''
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function isDocumentVisible() {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }

  function hasOwnField(container, fieldName) {
    return Boolean(
      container
      && typeof container === 'object'
      && Object.prototype.hasOwnProperty.call(container, fieldName)
    );
  }

  function areStringArraysEqual(left, right) {
    const leftValues = Array.isArray(left) ? left : [];
    const rightValues = Array.isArray(right) ? right : [];

    if (leftValues.length !== rightValues.length) {
      return false;
    }

    return leftValues.every((value, index) => value === rightValues[index]);
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`\u7F3A\u5C11\u754C\u9762\u8282\u70B9\uFF1A${id}`);
    }

    return element;
  }

  function getModulePanelContainer() {
    return getElement('promotionModulePanels');
  }

  function getModulePanel(moduleId) {
    const normalizedModuleId = normalizeText(moduleId);

    if (!normalizedModuleId) {
      return null;
    }

    return document.querySelector(`[data-module-panel="${normalizedModuleId}"]`);
  }

  function getModulePanelElements(moduleId) {
    const panel = getModulePanel(moduleId);

    if (!(panel instanceof HTMLElement)) {
      return null;
    }

    return {
      panel,
      eyebrow: panel.querySelector('[data-module-role="eyebrow"]'),
      title: panel.querySelector('[data-module-role="title"]'),
      description: panel.querySelector('[data-module-role="description"]'),
      badge: panel.querySelector('[data-module-role="badge"]'),
      controls: panel.querySelector('[data-module-role="controls"]'),
      filterBar: panel.querySelector('[data-module-role="filterBar"]'),
      toolbarActions: panel.querySelector('[data-module-role="toolbarActions"]'),
      configSection: panel.querySelector('[data-module-role="configSection"]'),
      customizeStatus: panel.querySelector('[data-module-role="customizeStatus"]'),
      listShell: panel.querySelector('[data-module-role="listShell"]'),
      listHead: panel.querySelector('[data-module-role="listHead"]'),
      listBody: panel.querySelector('[data-module-role="listBody"]')
    };
  }

  function getMonitorStatusElement() {
    const moduleElements = getModulePanelElements('monitor');

    return moduleElements ? moduleElements.customizeStatus : null;
  }

  function buildModulePanelMarkup(moduleId, isActive) {
    return `
      <section
        class="promotion-module-panel ${isActive ? 'is-active' : ''}"
        data-module-panel="${escapeHtml(moduleId)}"
        ${isActive ? '' : 'hidden'}
      >
        <div class="promotion-panel-head">
          <div class="promotion-panel-copy">
            <p class="promotion-panel-eyebrow" data-module-role="eyebrow"></p>
            <h1 class="promotion-panel-title" data-module-role="title"></h1>
            <p class="promotion-panel-text" data-module-role="description"></p>
          </div>
          <span class="promotion-panel-badge" data-module-role="badge"></span>
        </div>

        <div class="promotion-controls" data-module-role="controls" hidden>
          <div class="promotion-filter-bar" data-module-role="filterBar" hidden></div>
          <div class="promotion-toolbar-actions" data-module-role="toolbarActions" hidden>
            <button
              class="promotion-icon-button"
              type="button"
              data-module-action="open-customize"
              aria-label="\u81EA\u5B9A\u4E49\u5217"
              title="\u81EA\u5B9A\u4E49\u5217"
            >
              <span class="promotion-icon-button-glyph" aria-hidden="true">&#9881;</span>
            </button>
          </div>
        </div>

        <section class="promotion-monitor-config-card" data-module-role="configSection" hidden></section>

        <p class="promotion-customize-status" data-module-role="customizeStatus" hidden></p>

        <div class="promotion-list-shell" data-module-role="listShell">
          <div class="promotion-list-head" data-module-role="listHead"></div>
          <div class="promotion-list-body" data-module-role="listBody"></div>
        </div>
      </section>
    `;
  }

  function createModulePanels(moduleIds, activeModuleId) {
    getModulePanelContainer().innerHTML = moduleIds
      .map((moduleId) => buildModulePanelMarkup(moduleId, moduleId === activeModuleId))
      .join('');
  }

  function setActiveModulePanel(moduleId) {
    document.querySelectorAll('[data-module-panel]').forEach((panel) => {
      const isActive = normalizeText(panel.getAttribute('data-module-panel')) === moduleId;

      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });
  }

  function capturePanelScrollState(moduleElements) {
    if (!moduleElements) {
      return null;
    }

    return {
      shellTop: moduleElements.listShell ? moduleElements.listShell.scrollTop : 0,
      shellLeft: moduleElements.listShell ? moduleElements.listShell.scrollLeft : 0,
      bodyTop: moduleElements.listBody ? moduleElements.listBody.scrollTop : 0,
      bodyLeft: moduleElements.listBody ? moduleElements.listBody.scrollLeft : 0
    };
  }

  function restorePanelScrollState(moduleElements, scrollState) {
    if (!moduleElements || !scrollState) {
      return;
    }

    if (moduleElements.listShell) {
      moduleElements.listShell.scrollTop = scrollState.shellTop;
      moduleElements.listShell.scrollLeft = scrollState.shellLeft;
    }

    if (moduleElements.listBody) {
      moduleElements.listBody.scrollTop = scrollState.bodyTop;
      moduleElements.listBody.scrollLeft = scrollState.bodyLeft;
    }
  }

  function setFeedbackMessage(element, message, tone = '') {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.hidden = !message;
    element.classList.remove('is-warning', 'is-success');

    if (message && tone) {
      element.classList.add(`is-${tone}`);
    }
  }

  function showWindowNotice(message, tone = '') {
    const noticeElement = document.getElementById('promotionWindowNotice');
    const normalizedMessage = normalizeText(message);

    if (!(noticeElement instanceof HTMLElement) || !normalizedMessage) {
      return;
    }

    if (moduleRuntimeState.windowNoticeTimer) {
      window.clearTimeout(moduleRuntimeState.windowNoticeTimer);
      moduleRuntimeState.windowNoticeTimer = 0;
    }

    noticeElement.textContent = normalizedMessage;
    noticeElement.hidden = false;
    noticeElement.classList.remove('is-success', 'is-warning', 'is-visible');

    if (tone) {
      noticeElement.classList.add(`is-${tone}`);
    }

    requestAnimationFrame(() => {
      noticeElement.classList.add('is-visible');
    });

    moduleRuntimeState.windowNoticeTimer = window.setTimeout(() => {
      noticeElement.classList.remove('is-visible');
      moduleRuntimeState.windowNoticeTimer = window.setTimeout(() => {
        noticeElement.hidden = true;
        moduleRuntimeState.windowNoticeTimer = 0;
      }, 180);
    }, 2600);
  }

  function toggleButtonBusy(button, isBusy, busyText) {
    if (!button) {
      return;
    }

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }

    button.disabled = isBusy;
    button.textContent = isBusy ? busyText : button.dataset.defaultText;
  }

  function uniq(values) {
    return Array.from(new Set(values));
  }

  function normalizeSelectedColumnIds(values) {
    if (!Array.isArray(values)) {
      return null;
    }

    const allowedIds = new Set(ALL_MONITOR_COLUMN_IDS);

    return uniq(
      values
        .map((value) => normalizeText(value))
        .filter((value) => allowedIds.has(value))
    );
  }

  function normalizeMonitorIntegerInput(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return '';
    }

    return String(parsedValue);
  }

  function normalizeMonitorMinOrderCountInput(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '1';
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return '1';
    }

    return String(parsedValue);
  }

  function normalizeMonitorResumeIntervalInput(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return '';
    }

    return String(parsedValue);
  }

  function normalizeMonitorDecimalInput(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '';
    }

    const parsedValue = Number.parseFloat(normalizedValue);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return '';
    }

    return String(parsedValue);
  }

  function normalizeMonitorIntervalInput(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return String(DEFAULT_MONITOR_INTERVAL_SECONDS);
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);

    if (!Number.isFinite(parsedValue)) {
      return String(DEFAULT_MONITOR_INTERVAL_SECONDS);
    }

    if (parsedValue < MIN_MONITOR_INTERVAL_SECONDS) {
      return String(MIN_MONITOR_INTERVAL_SECONDS);
    }

    return String(parsedValue);
  }

  function normalizeMonitorConfigRegionIds(values) {
    if (!Array.isArray(values)) {
      return MONITOR_SITE_VARIANTS.map((site) => site.id);
    }

    return uniq(
      values
        .map((value) => normalizeText(value))
        .filter((value) => MONITOR_SITE_VARIANTS.some((site) => site.id === value))
    );
  }

  function normalizeMonitorConfigActionType(value) {
    const normalizedValue = normalizeText(value);

    return MONITOR_CONFIG_ACTIONS.some((action) => action.id === normalizedValue)
      ? normalizedValue
      : 'pause_plan';
  }

  function normalizeMonitorConfigState(values) {
    const source = values && typeof values === 'object' ? values : {};

    return {
      monitorIntervalSeconds: normalizeMonitorIntervalInput(source.monitorIntervalSeconds),
      dailyOperationLimit: normalizeMonitorIntegerInput(source.dailyOperationLimit),
      totalOperationLimit: normalizeMonitorIntegerInput(source.totalOperationLimit),
      autoPauseSpendThreshold: normalizeMonitorDecimalInput(source.autoPauseSpendThreshold),
      autoPauseRoasThreshold: normalizeMonitorDecimalInput(source.autoPauseRoasThreshold),
      conditionMaxRoas: normalizeMonitorDecimalInput(source.conditionMaxRoas),
      minOrderCount: normalizeMonitorMinOrderCountInput(source.minOrderCount),
      regionIds: normalizeMonitorConfigRegionIds(source.regionIds),
      actionType: normalizeMonitorConfigActionType(source.actionType),
      resumeIntervalMinutes: normalizeMonitorResumeIntervalInput(source.resumeIntervalMinutes),
      targetRoas: normalizeMonitorDecimalInput(source.targetRoas)
    };
  }

  function normalizeMonitorConfigOverrideState(values) {
    const source = values && typeof values === 'object' ? values : {};
    const normalizedState = {};

    if (hasOwnField(source, 'monitorIntervalSeconds')) {
      normalizedState.monitorIntervalSeconds = normalizeMonitorIntervalInput(source.monitorIntervalSeconds);
    }

    if (hasOwnField(source, 'dailyOperationLimit')) {
      normalizedState.dailyOperationLimit = normalizeMonitorIntegerInput(source.dailyOperationLimit);
    }

    if (hasOwnField(source, 'totalOperationLimit')) {
      normalizedState.totalOperationLimit = normalizeMonitorIntegerInput(source.totalOperationLimit);
    }

    if (hasOwnField(source, 'autoPauseSpendThreshold')) {
      normalizedState.autoPauseSpendThreshold = normalizeMonitorDecimalInput(source.autoPauseSpendThreshold);
    }

    if (hasOwnField(source, 'autoPauseRoasThreshold')) {
      normalizedState.autoPauseRoasThreshold = normalizeMonitorDecimalInput(source.autoPauseRoasThreshold);
    }

    if (hasOwnField(source, 'conditionMaxRoas')) {
      normalizedState.conditionMaxRoas = normalizeMonitorDecimalInput(source.conditionMaxRoas);
    }

    if (hasOwnField(source, 'minOrderCount')) {
      normalizedState.minOrderCount = normalizeMonitorMinOrderCountInput(source.minOrderCount);
    }

    if (hasOwnField(source, 'regionIds')) {
      normalizedState.regionIds = normalizeMonitorConfigRegionIds(source.regionIds);
    }

    if (hasOwnField(source, 'actionType')) {
      normalizedState.actionType = normalizeMonitorConfigActionType(source.actionType);
    }

    if (hasOwnField(source, 'resumeIntervalMinutes')) {
      normalizedState.resumeIntervalMinutes = normalizeMonitorResumeIntervalInput(source.resumeIntervalMinutes);
    }

    if (hasOwnField(source, 'targetRoas')) {
      normalizedState.targetRoas = normalizeMonitorDecimalInput(source.targetRoas);
    }

    return normalizedState;
  }

  function mergeMonitorConfigStates(baseConfig, overrideConfig) {
    const normalizedBaseConfig = normalizeMonitorConfigState(baseConfig);
    const normalizedOverrideConfig = normalizeMonitorConfigOverrideState(overrideConfig);

    return MONITOR_CONFIG_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = hasOwnField(normalizedOverrideConfig, fieldName)
        ? normalizedOverrideConfig[fieldName]
        : normalizedBaseConfig[fieldName];
      return result;
    }, {});
  }

  function normalizeMonitorShopConfigsState(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(values)
        .map(([shopKey, config]) => {
          const normalizedShopKey = normalizeText(shopKey);

          if (!normalizedShopKey) {
            return null;
          }

          return [normalizedShopKey, normalizeMonitorConfigOverrideState(config)];
        })
        .filter(Boolean)
    );
  }

  function buildMonitorRegionSummaryText(regionIds) {
    const normalizedRegionIds = normalizeMonitorConfigRegionIds(regionIds);
    const selectedLabels = MONITOR_SITE_VARIANTS
      .filter((site) => normalizedRegionIds.includes(site.id))
      .map((site) => site.label);

    if (selectedLabels.length === 0) {
      return '\u8BF7\u9009\u62E9';
    }

    if (selectedLabels.length === MONITOR_SITE_VARIANTS.length) {
      return '\u5168\u90E8';
    }

    return selectedLabels.join('\u3001');
  }

  function getMonitorActionMeta(actionType) {
    const normalizedActionType = normalizeMonitorConfigActionType(actionType);
    const action = MONITOR_CONFIG_ACTIONS.find((item) => item.id === normalizedActionType)
      || MONITOR_CONFIG_ACTIONS[0];

    if (normalizedActionType === 'update_roas') {
      return {
        ...action,
        requiresRoasInput: true,
        requiresResumeIntervalInput: false,
        inputLabel: 'ROAS',
        inputPlaceholder: '\u8F93\u5165\u76EE\u6807\u503C',
        hint: '\u76F4\u63A5\u4FEE\u6539\u5230\u6307\u5B9AROAS'
      };
    }

    if (normalizedActionType === 'increase_roas') {
      return {
        ...action,
        requiresRoasInput: true,
        requiresResumeIntervalInput: false,
        inputLabel: '\u589E\u52A0\u503C',
        inputPlaceholder: '\u8F93\u5165\u589E\u52A0\u503C',
        hint: '\u5728\u539F\u8BA1\u5212ROAS\u4E0A\u589E\u52A0\u8BE5\u503C'
      };
    }

    if (normalizedActionType === 'pause_then_resume') {
      return {
        ...action,
        requiresRoasInput: false,
        requiresResumeIntervalInput: true,
        resumeIntervalLabel: '\u6062\u590D\u95F4\u9694(\u5206)',
        resumeIntervalPlaceholder: '\u8F93\u5165\u6062\u590D\u95F4\u9694',
        resumeIntervalHint: `\u8BB0\u5F55\u6682\u505C\u65F6\u95F4\u540E\u6309\u8BBE\u7F6E\u81EA\u52A8\u6062\u590D\u8BA1\u5212\uff0c${PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES}=\u6B21\u65E5\u51CC\u6668\u5F00\u59CB\u6062\u590D\uff0C\u5F53\u65E5\u4E0D\u518D\u6062\u590D`
      };
    }

    return {
      ...action,
      requiresRoasInput: false,
      requiresResumeIntervalInput: false,
      inputLabel: 'ROAS',
      inputPlaceholder: '\u8BF7\u8F93\u5165ROAS',
      hint: ''
    };
  }

  function buildMonitorConfigLabelMarkup(label, hint = '') {
    const normalizedLabel = normalizeText(label);
    const normalizedHint = normalizeText(hint);

    if (!normalizedHint) {
      return `<span class="promotion-monitor-config-label">${escapeHtml(normalizedLabel)}</span>`;
    }

    return `
      <span class="promotion-monitor-config-label-group">
        <span class="promotion-monitor-config-label">${escapeHtml(normalizedLabel)}</span>
        <span
          class="promotion-monitor-config-help"
          tabindex="0"
          title="${escapeHtml(normalizedHint)}"
          aria-label="${escapeHtml(normalizedHint)}"
        >
          ?
          <span class="promotion-monitor-config-help-bubble" role="tooltip">${escapeHtml(normalizedHint)}</span>
        </span>
      </span>
    `;
  }

  function buildMonitorConfigPayload(configState) {
    const normalizedConfigState = normalizeMonitorConfigState(configState);

    return {
      monitorIntervalSeconds: normalizeMonitorIntervalInput(normalizedConfigState.monitorIntervalSeconds),
      dailyOperationLimit: normalizeMonitorIntegerInput(normalizedConfigState.dailyOperationLimit),
      totalOperationLimit: normalizeMonitorIntegerInput(normalizedConfigState.totalOperationLimit),
      autoPauseSpendThreshold: normalizeMonitorDecimalInput(normalizedConfigState.autoPauseSpendThreshold),
      autoPauseRoasThreshold: normalizeMonitorDecimalInput(normalizedConfigState.autoPauseRoasThreshold),
      conditionMaxRoas: normalizeMonitorDecimalInput(normalizedConfigState.conditionMaxRoas),
      minOrderCount: normalizeMonitorMinOrderCountInput(normalizedConfigState.minOrderCount),
      regionIds: normalizeMonitorConfigRegionIds(normalizedConfigState.regionIds),
      actionType: normalizeMonitorConfigActionType(normalizedConfigState.actionType),
      resumeIntervalMinutes: normalizeMonitorResumeIntervalInput(normalizedConfigState.resumeIntervalMinutes),
      targetRoas: normalizeMonitorDecimalInput(normalizedConfigState.targetRoas)
    };
  }

  function buildMonitorConfigOverridePayload(configState) {
    const normalizedConfigState = normalizeMonitorConfigOverrideState(configState);
    const payload = {};

    if (hasOwnField(normalizedConfigState, 'monitorIntervalSeconds')) {
      payload.monitorIntervalSeconds = normalizeMonitorIntervalInput(normalizedConfigState.monitorIntervalSeconds);
    }

    if (hasOwnField(normalizedConfigState, 'dailyOperationLimit')) {
      payload.dailyOperationLimit = normalizeMonitorIntegerInput(normalizedConfigState.dailyOperationLimit);
    }

    if (hasOwnField(normalizedConfigState, 'totalOperationLimit')) {
      payload.totalOperationLimit = normalizeMonitorIntegerInput(normalizedConfigState.totalOperationLimit);
    }

    if (hasOwnField(normalizedConfigState, 'autoPauseSpendThreshold')) {
      payload.autoPauseSpendThreshold = normalizeMonitorDecimalInput(normalizedConfigState.autoPauseSpendThreshold);
    }

    if (hasOwnField(normalizedConfigState, 'autoPauseRoasThreshold')) {
      payload.autoPauseRoasThreshold = normalizeMonitorDecimalInput(normalizedConfigState.autoPauseRoasThreshold);
    }

    if (hasOwnField(normalizedConfigState, 'conditionMaxRoas')) {
      payload.conditionMaxRoas = normalizeMonitorDecimalInput(normalizedConfigState.conditionMaxRoas);
    }

    if (hasOwnField(normalizedConfigState, 'minOrderCount')) {
      payload.minOrderCount = normalizeMonitorMinOrderCountInput(normalizedConfigState.minOrderCount);
    }

    if (hasOwnField(normalizedConfigState, 'regionIds')) {
      payload.regionIds = normalizeMonitorConfigRegionIds(normalizedConfigState.regionIds);
    }

    if (hasOwnField(normalizedConfigState, 'actionType')) {
      payload.actionType = normalizeMonitorConfigActionType(normalizedConfigState.actionType);
    }

    if (hasOwnField(normalizedConfigState, 'resumeIntervalMinutes')) {
      payload.resumeIntervalMinutes = normalizeMonitorResumeIntervalInput(normalizedConfigState.resumeIntervalMinutes);
    }

    if (hasOwnField(normalizedConfigState, 'targetRoas')) {
      payload.targetRoas = normalizeMonitorDecimalInput(normalizedConfigState.targetRoas);
    }

    return payload;
  }

  function areMonitorConfigValuesEqual(leftValue, rightValue) {
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      const leftArray = Array.isArray(leftValue) ? leftValue : [];
      const rightArray = Array.isArray(rightValue) ? rightValue : [];

      if (leftArray.length !== rightArray.length) {
        return false;
      }

      return leftArray.every((item, index) => item === rightArray[index]);
    }

    return leftValue === rightValue;
  }

  function buildMonitorConfigDiffPayload(configState, baseConfigState) {
    const normalizedConfigPayload = buildMonitorConfigPayload(configState);
    const normalizedBasePayload = buildMonitorConfigPayload(baseConfigState);

    return MONITOR_CONFIG_FIELD_NAMES.reduce((result, fieldName) => {
      if (!areMonitorConfigValuesEqual(normalizedConfigPayload[fieldName], normalizedBasePayload[fieldName])) {
        result[fieldName] = normalizedConfigPayload[fieldName];
      }

      return result;
    }, {});
  }

  function buildMonitorConfigSavePayload(configState = moduleRuntimeState.monitorConfig) {
    return buildMonitorConfigPayload(configState);
  }

  function buildMonitorShopConfigsSavePayload(shopConfigsState = moduleRuntimeState.monitorShopConfigs) {
    return Object.fromEntries(
      Object.entries(shopConfigsState)
        .map(([shopKey, configState]) => {
          const normalizedShopKey = normalizeText(shopKey);

          if (!normalizedShopKey) {
            return null;
          }

          return [normalizedShopKey, buildMonitorConfigOverridePayload(configState)];
        })
        .filter(Boolean)
    );
  }

  function getMonitorShopConfig(shopKey) {
    const normalizedShopKey = normalizeText(shopKey);

    if (!normalizedShopKey) {
      return null;
    }

    return Object.prototype.hasOwnProperty.call(moduleRuntimeState.monitorShopConfigs, normalizedShopKey)
      ? normalizeMonitorConfigOverrideState(moduleRuntimeState.monitorShopConfigs[normalizedShopKey])
      : null;
  }

  function hasMonitorShopConfig(shopKey) {
    const normalizedShopKey = normalizeText(shopKey);

    return Boolean(
      normalizedShopKey
      && Object.prototype.hasOwnProperty.call(moduleRuntimeState.monitorShopConfigs, normalizedShopKey)
    );
  }

  function getEffectiveMonitorConfigState(shopKey) {
    return mergeMonitorConfigStates(
      moduleRuntimeState.monitorConfig,
      getMonitorShopConfig(shopKey)
    );
  }

  function normalizeMonitorBaseColumnWidth(columnId, value) {
    const fallbackWidth = DEFAULT_MONITOR_BASE_COLUMN_WIDTHS[columnId];
    const minimumWidth = MONITOR_BASE_COLUMN_MIN_WIDTHS[columnId] || 96;
    const parsedValue = Number.parseInt(value, 10);
    const resolvedValue = Number.isFinite(parsedValue) ? parsedValue : fallbackWidth;

    return Math.max(minimumWidth, resolvedValue);
  }

  function normalizeMonitorBaseColumnWidths(values) {
    return MONITOR_BASE_COLUMNS.reduce((result, column) => {
      result[column.id] = normalizeMonitorBaseColumnWidth(
        column.id,
        values && Object.prototype.hasOwnProperty.call(values, column.id)
          ? values[column.id]
          : DEFAULT_MONITOR_BASE_COLUMN_WIDTHS[column.id]
      );
      return result;
    }, {});
  }

  function getMonitorBaseColumnWidthsSnapshot() {
    return MONITOR_BASE_COLUMNS.reduce((result, column) => {
      result[column.id] = normalizeMonitorBaseColumnWidth(
        column.id,
        moduleRuntimeState.monitorBaseColumnWidths[column.id]
      );
      return result;
    }, {});
  }

  function setMonitorBaseColumnWidth(columnId, nextWidth) {
    if (!MONITOR_BASE_COLUMNS.some((column) => column.id === columnId)) {
      return;
    }

    moduleRuntimeState.monitorBaseColumnWidths[columnId] = normalizeMonitorBaseColumnWidth(columnId, nextWidth);
  }

  function buildMonitorBaseColumns() {
    return MONITOR_BASE_COLUMNS.map((column) => ({
      ...column,
      width: `${normalizeMonitorBaseColumnWidth(column.id, moduleRuntimeState.monitorBaseColumnWidths[column.id])}px`,
      isResizable: true
    }));
  }

  function resolveSelectedMonitorColumnIds(values, settingsVersion = MONITOR_VIEW_SETTINGS_VERSION) {
    const normalizedValues = normalizeSelectedColumnIds(values);

    if (!normalizedValues) {
      return null;
    }

    if (Number(settingsVersion) < MONITOR_VIEW_SETTINGS_VERSION) {
      return uniq([...normalizedValues, ...MONITOR_VIEW_V2_ADDED_COLUMN_IDS]);
    }

    return normalizedValues;
  }

  function formatDateTime(value) {
    const fallbackValue = normalizeText(value);
    const date = fallbackValue ? new Date(fallbackValue) : new Date();

    if (Number.isNaN(date.getTime())) {
      return fallbackValue || '-';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  function getActiveModuleButton() {
    return Array.from(document.querySelectorAll('[data-promotion-module]'))
      .find((button) => button.classList.contains('is-active')) || null;
  }

  function getActiveModuleId() {
    const activeButton = getActiveModuleButton();

    return activeButton ? normalizeText(activeButton.getAttribute('data-promotion-module')) : '';
  }

  function isValidMonitorFilter(filterId) {
    return MONITOR_FILTERS.some((filter) => filter.id === filterId);
  }

  function getMonitorFilterLabel(filterId) {
    const matchedFilter = MONITOR_FILTERS.find((filter) => filter.id === filterId);

    return matchedFilter ? matchedFilter.label : '\u5168\u90E8';
  }

  function getActiveMonitorFilter() {
    return 'all';
  }

  function getFeatureCenterBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.getPromotionManagerSettings === 'function'
      && typeof window.temuApp.featureCenter.savePromotionManagerSettings === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    return null;
  }

  function getPromotionMonitorBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.getPromotionMonitorSnapshot === 'function'
      && typeof window.temuApp.featureCenter.setPromotionMonitorShopEnabled === 'function'
      && typeof window.temuApp.featureCenter.setPromotionMonitorBatchActive === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    return null;
  }

  function getRuntimeLogBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.getRuntimeLogEntries === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    return null;
  }

  async function loadPromotionManagerSettings() {
    const bridge = getFeatureCenterBridge();

    moduleRuntimeState.settingsLoaded = true;

    if (!bridge) {
      return null;
    }

    try {
      const result = await bridge.getPromotionManagerSettings();
      const settings = result && result.settings ? result.settings : result;
      const monitorView = settings && settings.monitorView ? settings.monitorView : null;
      const monitorConfig = settings && settings.monitorConfig ? settings.monitorConfig : null;
      const monitorShopConfigs = settings && settings.monitorShopConfigs ? settings.monitorShopConfigs : null;
      const settingsVersion = Number(settings && settings.version) || 0;

      if (monitorView) {
        const nextFilter = normalizeText(monitorView.activeFilter);

        if (isValidMonitorFilter(nextFilter)) {
          moduleRuntimeState.activeMonitorFilter = nextFilter;
        }

        if (Array.isArray(monitorView.selectedColumnIds)) {
          moduleRuntimeState.selectedMonitorColumnIds = resolveSelectedMonitorColumnIds(
            monitorView.selectedColumnIds,
            settingsVersion
          ) || [];
        }

        moduleRuntimeState.monitorBaseColumnWidths = normalizeMonitorBaseColumnWidths(
          monitorView.baseColumnWidths
        );
      }

      if (monitorConfig) {
        moduleRuntimeState.monitorConfig = normalizeMonitorConfigState(monitorConfig);
      }

      moduleRuntimeState.monitorShopConfigs = normalizeMonitorShopConfigsState(monitorShopConfigs);

      return result;
    } catch (_error) {
      return null;
    }
  }

  async function savePromotionManagerSettings(options = {}) {
    const bridge = getFeatureCenterBridge();

    if (!bridge) {
      return null;
    }

    try {
      const monitorViewState = options.monitorView || {
        activeFilter: getActiveMonitorFilter(),
        selectedColumnIds: moduleRuntimeState.selectedMonitorColumnIds.slice(),
        baseColumnWidths: getMonitorBaseColumnWidthsSnapshot()
      };
      const monitorConfigState = options.monitorConfigState || moduleRuntimeState.monitorConfig;
      const monitorShopConfigsState = options.monitorShopConfigsState || moduleRuntimeState.monitorShopConfigs;
      const result = await bridge.savePromotionManagerSettings({
        monitorView: {
          activeFilter: normalizeText(monitorViewState.activeFilter) || getActiveMonitorFilter(),
          selectedColumnIds: Array.isArray(monitorViewState.selectedColumnIds)
            ? monitorViewState.selectedColumnIds.slice()
            : moduleRuntimeState.selectedMonitorColumnIds.slice(),
          baseColumnWidths: monitorViewState.baseColumnWidths || getMonitorBaseColumnWidthsSnapshot()
        },
        monitorConfig: buildMonitorConfigSavePayload(monitorConfigState),
        monitorShopConfigs: buildMonitorShopConfigsSavePayload(monitorShopConfigsState)
      });

      if (result && result.settings && result.settings.monitorConfig) {
        moduleRuntimeState.monitorConfig = normalizeMonitorConfigState(result.settings.monitorConfig);
      }

      if (result && result.settings) {
        moduleRuntimeState.monitorShopConfigs = normalizeMonitorShopConfigsState(result.settings.monitorShopConfigs);
      }

      if (result && result.settings && result.settings.monitorView) {
        const monitorView = result.settings.monitorView;
        const nextFilter = normalizeText(monitorView.activeFilter);
        const settingsVersion = Number(result.settings.version) || MONITOR_VIEW_SETTINGS_VERSION;

        if (isValidMonitorFilter(nextFilter)) {
          moduleRuntimeState.activeMonitorFilter = nextFilter;
        }

        if (Array.isArray(monitorView.selectedColumnIds)) {
          moduleRuntimeState.selectedMonitorColumnIds = resolveSelectedMonitorColumnIds(
            monitorView.selectedColumnIds,
            settingsVersion
          ) || [];
        }

        moduleRuntimeState.monitorBaseColumnWidths = normalizeMonitorBaseColumnWidths(
          monitorView.baseColumnWidths
        );
      }

      if (options.showSuccessMessage) {
        showWindowNotice(
          result && result.cloudSynced === false
            ? '\u81EA\u5B9A\u4E49\u5217\u5DF2\u4FDD\u5B58\uFF0C\u672C\u6B21\u4E91\u7AEF\u540C\u6B65\u5931\u8D25\u3002'
            : '\u81EA\u5B9A\u4E49\u5217\u5DF2\u540C\u6B65\u4E91\u7AEF\u3002',
          result && result.cloudSynced === false ? 'warning' : 'success'
        );
      } else if (result && result.cloudSynced === false) {
        showWindowNotice(
          '\u5F53\u524D\u4FEE\u6539\u5DF2\u4FDD\u5B58\uFF0C\u672C\u6B21\u4E91\u7AEF\u540C\u6B65\u5931\u8D25\u3002',
          'warning'
        );
      }

      return result;
    } catch (error) {
      const fallbackMessage = options.saveErrorMessage || '\u81EA\u5B9A\u4E49\u5217\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002';

      if (options.showErrorInModal) {
        setFeedbackMessage(
          getElement(options.modalStatusElementId || 'promotionCustomizeModalStatus'),
          error && error.message ? error.message : fallbackMessage,
          'warning'
        );
      } else {
        showWindowNotice(
          error && error.message ? error.message : fallbackMessage,
          'warning'
        );
      }

      return null;
    }
  }

  function getMonitorSnapshotShopState(shopKey) {
    const normalizedKey = normalizeText(shopKey);

    if (!normalizedKey) {
      return null;
    }

    const shops = moduleRuntimeState.monitorSnapshot && moduleRuntimeState.monitorSnapshot.shops
      ? moduleRuntimeState.monitorSnapshot.shops
      : {};

    return shops && typeof shops === 'object' ? shops[normalizedKey] || null : null;
  }

  async function loadPromotionMonitorSnapshot(options = {}) {
    const bridge = getPromotionMonitorBridge();

    if (!bridge || moduleRuntimeState.monitorSnapshotLoading) {
      return moduleRuntimeState.monitorSnapshot;
    }

    moduleRuntimeState.monitorSnapshotLoading = true;

    try {
      const snapshot = await bridge.getPromotionMonitorSnapshot();
      const shops = snapshot && snapshot.shops && typeof snapshot.shops === 'object'
        ? snapshot.shops
        : {};
      const updatedAt = normalizeText(snapshot && snapshot.updatedAt);
      const batchMonitoringActive = snapshot && snapshot.batchMonitoringActive === true;
      const enabledShopIds = Array.isArray(snapshot && snapshot.enabledShopIds)
        ? snapshot.enabledShopIds.map((value) => normalizeText(value)).filter(Boolean)
        : [];
      const changed =
        updatedAt !== normalizeText(moduleRuntimeState.monitorSnapshot.updatedAt)
        || batchMonitoringActive !== (moduleRuntimeState.monitorSnapshot.batchMonitoringActive === true)
        || !areStringArraysEqual(enabledShopIds, moduleRuntimeState.monitorSnapshot.enabledShopIds);

      if (!changed) {
        return moduleRuntimeState.monitorSnapshot;
      }

      moduleRuntimeState.monitorSnapshot = {
        updatedAt,
        batchMonitoringActive,
        enabledShopIds,
        shops
      };
      moduleRuntimeState.monitorToggleStateByKey = enabledShopIds.reduce((result, shopId) => {
        result[shopId] = true;
        return result;
      }, {});

      if (options.renderPanel !== false && getModulePanel('monitor')) {
        renderModulePanel('monitor');
      }

      return moduleRuntimeState.monitorSnapshot;
    } catch (_error) {
      return moduleRuntimeState.monitorSnapshot;
    } finally {
      moduleRuntimeState.monitorSnapshotLoading = false;
    }
  }

  function stopPromotionMonitorPolling() {
    if (!moduleRuntimeState.monitorSnapshotPollTimer) {
      return;
    }

    window.clearInterval(moduleRuntimeState.monitorSnapshotPollTimer);
    moduleRuntimeState.monitorSnapshotPollTimer = 0;
  }

  function startPromotionMonitorPolling() {
    stopPromotionMonitorPolling();
    moduleRuntimeState.monitorSnapshotPollTimer = window.setInterval(() => {
      void loadPromotionMonitorSnapshot({
        renderPanel: getActiveModuleId() === 'monitor'
      });
    }, ACTIVE_MONITOR_POLL_INTERVAL_MS);
  }

  async function loadRuntimeLogEntries(options = {}) {
    const bridge = getRuntimeLogBridge();
    const append = options.append === true;
    const preserveVisibleCount = options.preserveVisibleCount === true;
    const currentVisibleCount = moduleRuntimeState.runtimeLogEntries.length;
    const requestedLimit = Math.max(
      1,
      Number.parseInt(options.limit, 10) || (
        append
          ? currentVisibleCount + RUNTIME_LOG_PAGE_SIZE
          : (
            preserveVisibleCount && currentVisibleCount > 0
              ? currentVisibleCount
              : RUNTIME_LOG_PAGE_SIZE
          )
      )
    );

    if (!bridge || moduleRuntimeState.runtimeLogLoading) {
      return {
        updatedAt: moduleRuntimeState.runtimeLogUpdatedAt,
        entries: moduleRuntimeState.runtimeLogEntries
      };
    }

    moduleRuntimeState.runtimeLogLoading = true;
    moduleRuntimeState.runtimeLogLoadError = '';

    try {
      const result = await bridge.getRuntimeLogEntries({
        limit: requestedLimit,
        eventPrefixes: PROMOTION_MASTER_RUNTIME_LOG_EVENT_PREFIXES
      });
      const entries = Array.isArray(result && result.entries) ? result.entries : [];
      const nextUpdatedAt = normalizeText(result && result.updatedAt);
      const nextLimit = Math.max(
        1,
        Number.parseInt(result && result.limit, 10) || requestedLimit
      );
      const nextTotalCount = Math.max(
        0,
        Number.parseInt(result && result.totalCount, 10) || entries.length
      );
      const nextHasMore = result && typeof result.hasMore === 'boolean'
        ? result.hasMore
        : nextTotalCount > entries.length;
      const normalizedEntries = entries.map((entry, index) => ({
        id: normalizeText(entry && entry.id) || `runtime-log-${index}`,
        time: normalizeText(entry && entry.time),
        event: normalizeText(entry && entry.event) || 'runtime_log',
        source: normalizeText(entry && entry.source) || '\u901A\u7528\u65E5\u5FD7',
        summary: normalizeText(entry && entry.summary),
        errorMessage: normalizeText(entry && entry.errorMessage),
        level: normalizeText(entry && entry.level) || 'info',
        shopId: normalizeText(entry && entry.shopId),
        shopName: normalizeText(entry && entry.shopName),
        regionId: normalizeText(entry && entry.regionId),
        shopSource: buildRuntimeLogShopSource(entry)
      }));
      const renderSignature = JSON.stringify({
        updatedAt: nextUpdatedAt,
        totalCount: nextTotalCount,
        visibleCount: normalizedEntries.length,
        hasMore: nextHasMore,
        firstId: normalizeText(normalizedEntries[0] && normalizedEntries[0].id),
        lastId: normalizeText(normalizedEntries[normalizedEntries.length - 1] && normalizedEntries[normalizedEntries.length - 1].id)
      });

      if (renderSignature === moduleRuntimeState.runtimeLogLastRenderSignature) {
        moduleRuntimeState.runtimeLogUpdatedAt = nextUpdatedAt;
        moduleRuntimeState.runtimeLogLimit = nextLimit;
        moduleRuntimeState.runtimeLogTotalCount = nextTotalCount;
        moduleRuntimeState.runtimeLogHasMore = nextHasMore;
        return {
          updatedAt: moduleRuntimeState.runtimeLogUpdatedAt,
          entries: moduleRuntimeState.runtimeLogEntries
        };
      }

      moduleRuntimeState.runtimeLogLimit = Math.max(
        1,
        nextLimit
      );
      moduleRuntimeState.runtimeLogTotalCount = Math.max(
        0,
        nextTotalCount
      );
      moduleRuntimeState.runtimeLogHasMore = nextHasMore;
      moduleRuntimeState.runtimeLogEntries = normalizedEntries;
      moduleRuntimeState.runtimeLogUpdatedAt = nextUpdatedAt;
      moduleRuntimeState.runtimeLogLastRenderSignature = renderSignature;

      if (options.renderPanel !== false && getModulePanel('logs')) {
        renderModulePanel('logs');
      }

      return {
        updatedAt: moduleRuntimeState.runtimeLogUpdatedAt,
        entries: moduleRuntimeState.runtimeLogEntries
      };
    } catch (error) {
      moduleRuntimeState.runtimeLogLoadError = normalizeText(error && error.message)
        || '\u8FD0\u884C\u65E5\u5FD7\u8BFB\u53D6\u5931\u8D25';

      if (options.renderPanel !== false && getModulePanel('logs')) {
        renderModulePanel('logs');
      }

      return {
        updatedAt: moduleRuntimeState.runtimeLogUpdatedAt,
        entries: moduleRuntimeState.runtimeLogEntries
      };
    } finally {
      moduleRuntimeState.runtimeLogLoading = false;
    }
  }

  function stopRuntimeLogPolling() {
    if (!moduleRuntimeState.runtimeLogPollTimer) {
      return;
    }

    window.clearInterval(moduleRuntimeState.runtimeLogPollTimer);
    moduleRuntimeState.runtimeLogPollTimer = 0;
  }

  function startRuntimeLogPolling() {
    stopRuntimeLogPolling();
    moduleRuntimeState.runtimeLogPollTimer = window.setInterval(() => {
      void loadRuntimeLogEntries({
        preserveVisibleCount: true,
        renderPanel: getActiveModuleId() === 'logs'
      });
    }, ACTIVE_RUNTIME_LOG_POLL_INTERVAL_MS);
  }

  function shouldLoadMoreRuntimeLogs(scroller) {
    if (!(scroller instanceof HTMLElement)) {
      return false;
    }

    if (moduleRuntimeState.runtimeLogLoading || moduleRuntimeState.runtimeLogHasMore !== true) {
      return false;
    }

    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= RUNTIME_LOG_LAZY_LOAD_THRESHOLD_PX;
  }

  async function maybeLoadMoreRuntimeLogs(scroller) {
    if (!shouldLoadMoreRuntimeLogs(scroller) || getActiveModuleId() !== 'logs') {
      return;
    }

    await loadRuntimeLogEntries({
      append: true,
      renderPanel: true
    });
  }

  function updateModuleBackgroundPolling() {
    if (isDocumentVisible() && getActiveModuleId() === 'monitor') {
      startPromotionMonitorPolling();
    } else {
      stopPromotionMonitorPolling();
    }

    if (isDocumentVisible() && getActiveModuleId() === 'logs') {
      startRuntimeLogPolling();
    } else {
      stopRuntimeLogPolling();
    }
  }

  async function initializeModuleBackgroundTasks() {
    await Promise.all([
      loadPromotionMonitorSnapshot({
        renderPanel: false
      }),
      loadVisibleShops(),
      loadRuntimeLogEntries({
        renderPanel: false
      })
    ]);
    updateModuleBackgroundPolling();
  }

  async function setPromotionMonitorShopEnabled(shopId, enabled) {
    const bridge = getPromotionMonitorBridge();
    const normalizedShopId = normalizeText(shopId);

    if (!bridge || !normalizedShopId) {
      return null;
    }

    try {
      const snapshot = await bridge.setPromotionMonitorShopEnabled({
        shopId: normalizedShopId,
        enabled: enabled === true
      });

      moduleRuntimeState.monitorSnapshot = {
        updatedAt: normalizeText(snapshot && snapshot.updatedAt),
        batchMonitoringActive: snapshot && snapshot.batchMonitoringActive === true,
        enabledShopIds: Array.isArray(snapshot && snapshot.enabledShopIds)
          ? snapshot.enabledShopIds.map((value) => normalizeText(value)).filter(Boolean)
          : [],
        shops: snapshot && snapshot.shops && typeof snapshot.shops === 'object'
          ? snapshot.shops
          : {}
      };
      moduleRuntimeState.monitorToggleStateByKey = moduleRuntimeState.monitorSnapshot.enabledShopIds.reduce((result, value) => {
        result[value] = true;
        return result;
      }, {});

      return moduleRuntimeState.monitorSnapshot;
    } catch (_error) {
      return null;
    }
  }

  async function setPromotionMonitorBatchActive(enabled) {
    const bridge = getPromotionMonitorBridge();

    if (!bridge) {
      return null;
    }

    try {
      const snapshot = await bridge.setPromotionMonitorBatchActive({
        enabled: enabled === true
      });

      moduleRuntimeState.monitorSnapshot = {
        updatedAt: normalizeText(snapshot && snapshot.updatedAt),
        batchMonitoringActive: snapshot && snapshot.batchMonitoringActive === true,
        enabledShopIds: Array.isArray(snapshot && snapshot.enabledShopIds)
          ? snapshot.enabledShopIds.map((value) => normalizeText(value)).filter(Boolean)
          : [],
        shops: snapshot && snapshot.shops && typeof snapshot.shops === 'object'
          ? snapshot.shops
          : {}
      };
      moduleRuntimeState.monitorToggleStateByKey = moduleRuntimeState.monitorSnapshot.enabledShopIds.reduce((result, value) => {
        result[value] = true;
        return result;
      }, {});

      return moduleRuntimeState.monitorSnapshot;
    } catch (_error) {
      return null;
    }
  }

  function getSelectedMonitorColumnIds() {
    return Array.isArray(moduleRuntimeState.selectedMonitorColumnIds)
      ? moduleRuntimeState.selectedMonitorColumnIds.slice()
      : DEFAULT_MONITOR_COLUMN_IDS.slice();
  }

  function getVisibleMonitorGroups() {
    const selectedIds = new Set(getSelectedMonitorColumnIds());

    return MONITOR_COLUMN_GROUPS
      .map((group) => ({
        ...group,
        helpText: MONITOR_GROUP_HELP[group.id] || '',
        columns: group.columns.filter((column) => selectedIds.has(column.id))
      }))
      .filter((group) => group.columns.length > 0);
  }

  function flattenMonitorColumns(groups) {
    return groups.flatMap((group) => group.columns.map((column, index) => ({
      ...column,
      groupId: group.id,
      groupLabel: group.label,
      helpText: MONITOR_COLUMN_HELP[column.id] || '',
      theme: group.theme,
      isGroupStart: index === 0,
      isGroupEnd: index === group.columns.length - 1,
      width: column.width || '112px'
    })));
  }

  function buildMonitorGridTemplate(baseColumns, columns) {
    return [...baseColumns.map((column) => column.width), ...columns.map((column) => column.width)].join(' ');
  }

  function getCurrentMonitorColumnTemplate() {
    return buildMonitorGridTemplate(
      buildMonitorBaseColumns(),
      flattenMonitorColumns(getVisibleMonitorGroups())
    );
  }

  function applyCurrentMonitorColumnTemplate() {
    const moduleElements = getModulePanelElements('monitor');
    const headElement = moduleElements ? moduleElements.listHead : null;
    const bodyElement = moduleElements ? moduleElements.listBody : null;

    if (!headElement || !bodyElement || !headElement.classList.contains('is-monitor')) {
      return;
    }

    const columnTemplate = getCurrentMonitorColumnTemplate();

    headElement.style.gridTemplateColumns = columnTemplate;
    bodyElement.querySelectorAll('.promotion-monitor-row').forEach((rowElement) => {
      rowElement.style.gridTemplateColumns = columnTemplate;
    });
  }

  function beginMonitorColumnResize(columnId, clientX) {
    if (!MONITOR_BASE_COLUMNS.some((column) => column.id === columnId) || getActiveModuleId() !== 'monitor') {
      return;
    }

    moduleRuntimeState.monitorResizeSession = {
      columnId,
      startClientX: clientX,
      startWidth: normalizeMonitorBaseColumnWidth(
        columnId,
        moduleRuntimeState.monitorBaseColumnWidths[columnId]
      ),
      hasChanged: false
    };

    document.body.classList.add('is-monitor-column-resizing');
  }

  function updateMonitorColumnResize(clientX) {
    const resizeSession = moduleRuntimeState.monitorResizeSession;

    if (!resizeSession) {
      return;
    }

    const nextWidth = resizeSession.startWidth + (clientX - resizeSession.startClientX);
    setMonitorBaseColumnWidth(resizeSession.columnId, nextWidth);
    resizeSession.hasChanged = true;
    applyCurrentMonitorColumnTemplate();
  }

  async function finishMonitorColumnResize() {
    const resizeSession = moduleRuntimeState.monitorResizeSession;

    if (!resizeSession) {
      return;
    }

    moduleRuntimeState.monitorResizeSession = null;
    document.body.classList.remove('is-monitor-column-resizing');

    if (resizeSession.hasChanged) {
      await savePromotionManagerSettings();
    }
  }

  function getMonitorShopKey(shop) {
    return normalizeText(shop && (shop.id || shop.shopId || shop.recordKey || shop.phoneNumber || shop.shopName));
  }

  function findVisibleShopByMonitorKey(shopKey) {
    const normalizedShopKey = normalizeText(shopKey);

    if (!normalizedShopKey) {
      return null;
    }

    return moduleRuntimeState.visibleShops.find((shop) => getMonitorShopKey(shop) === normalizedShopKey) || null;
  }

  function findVisibleShopByRuntimeLogShopId(shopId) {
    const normalizedShopId = normalizeText(shopId);

    if (!normalizedShopId) {
      return null;
    }

    return moduleRuntimeState.visibleShops.find((shop) => (
      normalizeText(shop && shop.id) === normalizedShopId
      || normalizeText(shop && shop.shopId) === normalizedShopId
      || getMonitorShopKey(shop) === normalizedShopId
    )) || null;
  }

  function buildRuntimeLogShopSource(entry) {
    const shopId = normalizeText(entry && entry.shopId);
    const explicitShopName = normalizeText(entry && entry.shopName);
    const matchedShop = findVisibleShopByRuntimeLogShopId(shopId);
    const resolvedShopName = explicitShopName || normalizeText(matchedShop && matchedShop.shopName);

    if (resolvedShopName && shopId) {
      return `${resolvedShopName} (${shopId})`;
    }

    if (resolvedShopName) {
      return resolvedShopName;
    }

    if (shopId) {
      return shopId;
    }

    return '\u5168\u5C40';
  }

  function getMonitorToggleState(shop) {
    const shopKey = getMonitorShopKey(shop);
    const snapshotShopState = getMonitorSnapshotShopState(shopKey);

    if (shopKey && Object.prototype.hasOwnProperty.call(moduleRuntimeState.monitorToggleStateByKey, shopKey)) {
      return moduleRuntimeState.monitorToggleStateByKey[shopKey] !== false;
    }

    if (snapshotShopState) {
      return snapshotShopState.enabled === true;
    }

    return false;
  }

  function isMonitorBatchActive() {
    return moduleRuntimeState.monitorSnapshot
      && moduleRuntimeState.monitorSnapshot.batchMonitoringActive === true;
  }

  function getMonitorSnapshotRegionStates(shopKey) {
    const snapshotShopState = getMonitorSnapshotShopState(shopKey);
    const regions = snapshotShopState && snapshotShopState.regions && typeof snapshotShopState.regions === 'object'
      ? snapshotShopState.regions
      : {};

    return Object.values(regions).filter((region) => region && typeof region === 'object');
  }

  function parseMonitorOverviewMetric(value) {
    const text = normalizeText(value);

    if (!text || text === '--') {
      return 0;
    }

    const normalized = text
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatMonitorOverviewMetric(value, options = {}) {
    const normalizedValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const type = normalizeText(options.type);

    if (type === 'money') {
      return normalizedValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (type === 'ratio') {
      return normalizedValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }

    if (type === 'percent') {
      return `${normalizedValue.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })}%`;
    }

    return Math.max(0, Math.round(normalizedValue)).toLocaleString('zh-CN');
  }

  function buildMonitorPromotionOverviewSummary() {
    const visibleShops = Array.isArray(moduleRuntimeState.visibleShops) ? moduleRuntimeState.visibleShops : [];
    const totals = {
      adSpend: 0,
      storeSales: 0,
      adSales: 0,
      storeOrders: 0,
      adOrders: 0,
      storeGoodsCount: 0,
      adGoodsCount: 0,
      impressionCount: 0,
      clickCount: 0,
      cartCount: 0
    };

    visibleShops.forEach((shop) => {
      const shopKey = getMonitorShopKey(shop);
      const regionStates = getMonitorSnapshotRegionStates(shopKey);

      regionStates.forEach((regionState) => {
        const summary = regionState && regionState.summary && typeof regionState.summary === 'object'
          ? regionState.summary
          : {};

        totals.adSpend += parseMonitorOverviewMetric(summary.ad_spend_label);
        totals.storeSales += parseMonitorOverviewMetric(summary.order_pay_amt_all);
        totals.adSales += parseMonitorOverviewMetric(summary.order_pay_amt_label);
        totals.storeOrders += parseMonitorOverviewMetric(summary.order_pay_count_all_label);
        totals.adOrders += parseMonitorOverviewMetric(summary.order_pay_count_label);
        totals.storeGoodsCount += parseMonitorOverviewMetric(summary.goods_num_all);
        totals.adGoodsCount += parseMonitorOverviewMetric(summary.goods_num_label);
        totals.impressionCount += parseMonitorOverviewMetric(summary.impr_count_label);
        totals.clickCount += parseMonitorOverviewMetric(summary.click_count_label);
        totals.cartCount += parseMonitorOverviewMetric(summary.add_cart_count_label);
      });
    });

    return {
      ...totals,
      roas: totals.adSpend > 0 ? totals.adSales / totals.adSpend : 0,
      ctr: totals.impressionCount > 0 ? (totals.clickCount / totals.impressionCount) * 100 : 0
    };
  }

  function buildMonitorOverviewSummaryMarkup() {
    return buildMonitorOverviewSummaryMarkupV2();
    const summary = buildMonitorOverviewSummary();

    return `
      <section class="promotion-monitor-overview-card" aria-label="所有店铺汇总数据">
        <span class="promotion-monitor-overview-title">\u6240\u6709\u5E97\u94FA\u6C47\u603B</span>
        <div class="promotion-monitor-overview-metrics">
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewCount(summary.visibleShopCount))}</strong>
            <span class="promotion-monitor-overview-label">\u5168\u90E8\u5E97\u94FA</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewCount(summary.enabledShopCount))}</strong>
            <span class="promotion-monitor-overview-label">\u5DF2\u52A0\u5165\u76D1\u63A7</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewCount(summary.totalPromotionOrderCount))}</strong>
            <span class="promotion-monitor-overview-label">\u5B50\u8BA2\u5355(\u63A8\u5E7F)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewCount(summary.hitShopCount))}</strong>
            <span class="promotion-monitor-overview-label">\u547D\u4E2D\u5E97\u94FA</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewCount(summary.increasedShopCount))}</strong>
            <span class="promotion-monitor-overview-label">\u8F83\u4E0A\u6B21\u65B0\u589E</span>
          </span>
        </div>
      </section>
    `;
  }

  function buildMonitorOverviewSummaryMarkupV2() {
    const summary = buildMonitorPromotionOverviewSummary();

    return `
      <section class="promotion-monitor-overview-card" aria-label="\u6240\u6709\u5E97\u94FA\u6C47\u603B\u6570\u636E">
        <div class="promotion-monitor-overview-head">
          <span class="promotion-monitor-overview-title">\u63A8\u5E7F\u6C47\u603B</span>
        </div>
        <div class="promotion-monitor-overview-metrics">
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.adSpend, { type: 'money' }))}</strong>
            <span class="promotion-monitor-overview-label">\u82B1\u8D39</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.storeSales, { type: 'money' }))}</strong>
            <span class="promotion-monitor-overview-label">\u9500\u552E\u989D(\u5168\u5E97)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.adSales, { type: 'money' }))}</strong>
            <span class="promotion-monitor-overview-label">\u9500\u552E\u989D(\u63A8\u5E7F)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.storeOrders))}</strong>
            <span class="promotion-monitor-overview-label">\u5B50\u8BA2\u5355(\u5168\u5E97)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.adOrders))}</strong>
            <span class="promotion-monitor-overview-label">\u5B50\u8BA2\u5355(\u63A8\u5E7F)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.storeGoodsCount))}</strong>
            <span class="promotion-monitor-overview-label">\u4EF6\u6570(\u5168\u5E97)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.adGoodsCount))}</strong>
            <span class="promotion-monitor-overview-label">\u4EF6\u6570(\u63A8\u5E7F)</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.impressionCount))}</strong>
            <span class="promotion-monitor-overview-label">\u66DD\u5149</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.clickCount))}</strong>
            <span class="promotion-monitor-overview-label">\u70B9\u51FB</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.roas, { type: 'ratio' }))}</strong>
            <span class="promotion-monitor-overview-label">ROAS</span>
          </span>
          <span class="promotion-monitor-overview-item">
            <strong class="promotion-monitor-overview-value">${escapeHtml(formatMonitorOverviewMetric(summary.ctr, { type: 'percent' }))}</strong>
            <span class="promotion-monitor-overview-label">\u70B9\u51FB\u7387</span>
          </span>
        </div>
      </section>
    `;
  }

  function getMonitorLogDisplay(shopKey, snapshotShopState) {
    const selected = getMonitorToggleState({
      id: shopKey,
      shopId: shopKey
    });

    if (isMonitorBatchActive() !== true) {
      return selected ? '等待开始' : '';
    }

    return normalizeText(snapshotShopState && snapshotShopState.log);
  }

  function isMonitorLogErrorState(snapshotShopState) {
    const status = normalizeText(snapshotShopState && snapshotShopState.status);
    const lastError = normalizeText(snapshotShopState && snapshotShopState.lastError);

    return Boolean(
      lastError
      || status === 'retrying'
      || status === 'relogin'
    );
  }

  function getMonitorRegionMetric(shopKey, regionId, columnId) {
    const snapshotShopState = getMonitorSnapshotShopState(shopKey);
    const regionState =
      snapshotShopState
      && snapshotShopState.regions
      && snapshotShopState.regions[regionId]
        ? snapshotShopState.regions[regionId]
        : null;
    const summary = regionState && regionState.summary && typeof regionState.summary === 'object'
      ? regionState.summary
      : null;

    if (!summary) {
      return '--';
    }

    return normalizeText(summary[columnId]) || '--';
  }

  function buildMonitorRow(shop, columns) {
    const monitorKey = getMonitorShopKey(shop);
    const snapshotShopState = getMonitorSnapshotShopState(monitorKey);
    const hasShopConfig = hasMonitorShopConfig(monitorKey);

    return {
      monitorKey,
      monitorEnabled: getMonitorToggleState(shop),
      hasShopConfig,
      monitorConfigModeLabel: hasShopConfig ? '\u72EC\u7ACB\u914D\u7F6E' : '\u5168\u5C40\u914D\u7F6E',
      monitorLog: getMonitorLogDisplay(monitorKey, snapshotShopState),
      monitorLogError: isMonitorLogErrorState(snapshotShopState),
      shopName: normalizeText(shop.shopName) || '-',
      groupName: normalizeText(shop.groupName) || '\u672A\u5206\u7EC4',
      shopNote: normalizeText(shop.note),
      status: normalizeText(snapshotShopState && snapshotShopState.status) || normalizeText(shop.status) || '\u5F85\u63A5\u5165',
      updatedAt: formatDateTime(
        snapshotShopState && snapshotShopState.lastUpdatedAt
          ? snapshotShopState.lastUpdatedAt
          : shop.updatedAt
      ),
      values: columns.map((column) => ({
        fullLabel: column.fullLabel,
        theme: column.theme,
        isGroupStart: column.isGroupStart,
        isGroupEnd: column.isGroupEnd,
        siteValues: MONITOR_SITE_VARIANTS.map((site) => ({
          siteId: site.id,
          siteLabel: site.label,
          primary: getMonitorRegionMetric(monitorKey, site.id, column.id)
        }))
      }))
    };
  }

  function buildMonitorModuleConfig() {
    const visibleShops = moduleRuntimeState.visibleShops;
    const hasLoadError = Boolean(moduleRuntimeState.loadError);
    const baseColumns = buildMonitorBaseColumns();
    const visibleGroups = getVisibleMonitorGroups();
    const visibleColumns = flattenMonitorColumns(visibleGroups);
    const rows = visibleShops.map((shop) => buildMonitorRow(shop, visibleColumns));

    return {
      renderMode: 'monitor-grid',
      eyebrow: '\u63A8\u5E7F\u5927\u5E08',
      title: '\u63A8\u5E7F\u76D1\u63A7',
      description: '',
      badgeText: `${visibleShops.length} \u5E97 / ${visibleColumns.length} \u5217`,
      baseColumns,
      groups: visibleGroups,
      columns: visibleColumns,
      rows,
      emptyMessage: hasLoadError
        ? '\u672A\u80FD\u8BFB\u53D6\u5E97\u94FA\u7BA1\u7406\u6570\u636E'
        : '\u6682\u65E0\u53EF\u663E\u793A\u7684\u5E97\u94FA\u6216\u6307\u6807\u5217'
    };
  }

  function buildRuntimeLogModuleConfig() {
    const visibleCount = moduleRuntimeState.runtimeLogEntries.length;
    const totalCount = Math.max(moduleRuntimeState.runtimeLogTotalCount, visibleCount);
    const countDescription = totalCount > 0
      ? (
        moduleRuntimeState.runtimeLogHasMore === true
          ? `\u5DF2\u52A0\u8F7D ${visibleCount} / ${totalCount} \u6761\uFF0C\u4E0B\u6ED1\u7EE7\u7EED\u52A0\u8F7D\u66F4\u65E9\u65E5\u5FD7\u3002`
          : `\u5DF2\u5168\u90E8\u52A0\u8F7D ${visibleCount} \u6761\u4ECA\u65E5\u65E5\u5FD7\u3002`
      )
      : '\u5F53\u524D\u8FD8\u6CA1\u6709\u751F\u6210\u8FD0\u884C\u65E5\u5FD7\u3002';
    const rows = moduleRuntimeState.runtimeLogEntries.map((entry) => ([
      entry.time ? formatDateTime(entry.time) : '-',
      entry.source || '\u901A\u7528\u65E5\u5FD7',
      buildRuntimeLogShopSource(entry),
      entry.event || 'runtime_log',
      entry.summary || '-',
      entry.errorMessage || '-'
    ]));
    let emptyMessage = '\u6682\u65E0\u53EF\u67E5\u770B\u7684\u8FD0\u884C\u65E5\u5FD7';

    if (moduleRuntimeState.runtimeLogLoading) {
      emptyMessage = '\u6B63\u5728\u8BFB\u53D6\u8FD0\u884C\u65E5\u5FD7...';
    } else if (moduleRuntimeState.runtimeLogLoadError) {
      emptyMessage = moduleRuntimeState.runtimeLogLoadError;
    }

    return {
      eyebrow: '\u63A8\u5E7F\u5927\u5E08',
      title: '\u65E5\u5FD7\u8BB0\u5F55',
      description: moduleRuntimeState.runtimeLogUpdatedAt
        ? `\u4EC5\u663E\u793A\u63A8\u5E7F\u5927\u5E08\u81EA\u8EAB\u7684 Cookies\u3001\u76D1\u63A7\u4E0E\u6267\u884C\u65E5\u5FD7\u3002${countDescription}\u6700\u8FD1\u66F4\u65B0\uFF1A${formatDateTime(moduleRuntimeState.runtimeLogUpdatedAt)}`
        : `\u4EC5\u663E\u793A\u63A8\u5E7F\u5927\u5E08\u81EA\u8EAB\u7684 Cookies\u3001\u76D1\u63A7\u4E0E\u6267\u884C\u65E5\u5FD7\u3002${countDescription}`,
      badgeText: totalCount > 0
        ? `\u5DF2\u52A0\u8F7D ${visibleCount} / ${totalCount} \u6761`
        : '0 \u6761\u65E5\u5FD7',
      columnTemplate: '1.05fr 0.88fr 1.18fr 1.08fr 1.94fr 1.32fr',
      columns: [
        '\u65F6\u95F4',
        '\u6765\u6E90',
        '\u5E97\u94FA\u6765\u6E90',
        '\u4E8B\u4EF6',
        '\u6458\u8981',
        '\u9519\u8BEF'
      ],
      rows,
      emptyMessage
    };
  }

  function getShopManagementBridge() {
    if (
      window.temuApp
      && window.temuApp.shopManagement
      && typeof window.temuApp.shopManagement.getState === 'function'
    ) {
      return window.temuApp.shopManagement;
    }

    return null;
  }

  async function loadVisibleShops() {
    const bridge = getShopManagementBridge();

    if (!bridge) {
      moduleRuntimeState.visibleShops = [];
      moduleRuntimeState.loadError = '\u5E97\u94FA\u7BA1\u7406\u6A21\u5757\u672A\u52A0\u8F7D';
      return moduleRuntimeState.visibleShops;
    }

    try {
      const state = await bridge.getState();
      const shops = Array.isArray(state && state.shops) ? state.shops : [];

      moduleRuntimeState.visibleShops = shops
        .filter((shop) => shop && shop.isVisible !== false && normalizeText(shop.shopName))
        .map((shop) => ({
          ...shop,
          monitorEnabled: getMonitorToggleState(shop)
        }))
        .sort((left, right) => normalizeText(left.shopName).localeCompare(normalizeText(right.shopName), 'zh-CN'));
      moduleRuntimeState.loadError = '';
      return moduleRuntimeState.visibleShops;
    } catch (error) {
      moduleRuntimeState.visibleShops = [];
      moduleRuntimeState.loadError = normalizeText(error && error.message) || '\u5E97\u94FA\u6570\u636E\u52A0\u8F7D\u5931\u8D25';
      return moduleRuntimeState.visibleShops;
    }
  }

  function getModuleConfig(moduleId) {
    if (moduleId === 'monitor') {
      return buildMonitorModuleConfig();
    }

    if (moduleId === 'logs') {
      return buildRuntimeLogModuleConfig();
    }

    return MODULES[moduleId] || MODULES.create;
  }

  function renderMonitorFilters(moduleId, moduleElements) {
    if (!moduleElements || !moduleElements.filterBar) {
      return;
    }

    moduleElements.filterBar.hidden = true;
    moduleElements.filterBar.innerHTML = '';
  }

  function renderMonitorToolbarActions(moduleId, moduleElements) {
    if (!moduleElements || !moduleElements.toolbarActions || !moduleElements.customizeStatus) {
      return;
    }

    if (moduleElements.controls) {
      moduleElements.controls.hidden = true;
    }

    moduleElements.toolbarActions.hidden = true;
    moduleElements.customizeStatus.hidden = true;
    moduleElements.customizeStatus.textContent = '';
    moduleElements.customizeStatus.classList.remove('is-warning', 'is-success');

    if (moduleId === 'monitor') {
      return;
    }
  }

  function buildMonitorConfigFieldsMarkup(configState, options = {}) {
    const monitorConfig = normalizeMonitorConfigState(configState);
    const actionMeta = getMonitorActionMeta(monitorConfig.actionType);
    const fieldAttrName = normalizeText(options.fieldAttrName) || 'data-monitor-config-field';
    const regionAttrName = normalizeText(options.regionAttrName) || 'data-monitor-config-region';
    const regionSummaryAttrName = normalizeText(options.regionSummaryAttrName) || 'data-monitor-region-summary';
    const regionSelectAttrName = normalizeText(options.regionSelectAttrName) || 'data-monitor-region-select';
    const actionSelectAttrName = normalizeText(options.actionSelectAttrName) || 'data-monitor-config-action-select';
    const scrollClassName = options.modalLayout === true
      ? 'promotion-monitor-config-scroll is-modal'
      : 'promotion-monitor-config-scroll';
    const stackClassName = options.modalLayout === true
      ? 'promotion-monitor-config-stack is-modal'
      : 'promotion-monitor-config-stack';
    const sectionGridClassName = options.modalLayout === true
      ? 'promotion-monitor-config-section-grid is-modal'
      : 'promotion-monitor-config-section-grid';

    function buildConfigSectionCard(title, fieldMarkup, className = '') {
      const normalizedClassName = normalizeText(className);

      return `
        <section class="promotion-monitor-config-subcard${normalizedClassName ? ` ${normalizedClassName}` : ''}">
          <div class="promotion-monitor-config-subcard-head">
            <span class="promotion-monitor-config-subcard-title">${escapeHtml(title)}</span>
          </div>
          <div class="${sectionGridClassName}">
            ${fieldMarkup}
          </div>
        </section>
      `;
    }

    const monitorIntervalFieldMarkup = `
      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u76D1\u63A7\u95F4\u9694', `\u5355\u4F4D\uFF1A\u79D2\u3002\u6279\u91CF\u76D1\u63A7\u4F1A\u6309\u8BE5\u95F4\u9694\u8F6E\u8BE2\u67E5\u8BE2\u5546\u54C1\u63A8\u5E7F\u6570\u636E\uFF0C\u9ED8\u8BA4 ${DEFAULT_MONITOR_INTERVAL_SECONDS} \u79D2\uFF0C\u6700\u5C0F ${MIN_MONITOR_INTERVAL_SECONDS} \u79D2`)}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="${MIN_MONITOR_INTERVAL_SECONDS}"
          step="1"
          inputmode="numeric"
          ${fieldAttrName}="monitorIntervalSeconds"
          value="${escapeHtml(monitorConfig.monitorIntervalSeconds)}"
          placeholder="${DEFAULT_MONITOR_INTERVAL_SECONDS}"
        />
      </label>
    `;

    const regionFieldMarkup = `
      <section class="promotion-monitor-config-item is-wide is-dropdown">
        <span class="promotion-monitor-config-label">\u76D1\u63A7\u5730\u533A</span>
        <details class="promotion-monitor-config-multi-select" ${regionSelectAttrName}="true">
          <summary class="promotion-monitor-config-multi-toggle">
            <span class="promotion-monitor-config-multi-value" ${regionSummaryAttrName}="true">${escapeHtml(buildMonitorRegionSummaryText(monitorConfig.regionIds))}</span>
            <span class="promotion-monitor-config-multi-arrow" aria-hidden="true">&#9662;</span>
          </summary>
          <div class="promotion-monitor-config-multi-menu">
          ${MONITOR_SITE_VARIANTS.map((site) => `
            <label class="promotion-monitor-config-dropdown-option">
              <input
                type="checkbox"
                ${regionAttrName}="${escapeHtml(site.id)}"
                ${monitorConfig.regionIds.includes(site.id) ? 'checked' : ''}
              />
              <span>${escapeHtml(site.label)}</span>
            </label>
          `).join('')}
          </div>
        </details>
      </section>
    `;

    const autoPauseFieldMarkup = `
      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u82B1\u8D39\u8D85\u8FC7(\u5143)', '\u53EA\u9488\u5BF9 ads_detail \u5B50\u8BA2\u5355(\u63A8\u5E7F) = 0 \u7684\u5546\u54C1\u3002\u5F53\u82B1\u8D39\u8D85\u8FC7\u8BE5\u91D1\u989D\u65F6\uFF0C\u4F18\u5148\u81EA\u52A8\u6682\u505C\u8BA1\u5212\u3002\u7559\u7A7A\u4E3A\u5173\u95ED')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          ${fieldAttrName}="autoPauseSpendThreshold"
          value="${escapeHtml(monitorConfig.autoPauseSpendThreshold)}"
          placeholder="\u4E0D\u9650"
        />
      </label>

      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u6210\u4EA4ROAS \u2264', '\u53EA\u9488\u5BF9 ads_detail \u5B50\u8BA2\u5355(\u63A8\u5E7F) > 0 \u7684\u5546\u54C1\u3002\u5F53\u6210\u4EA4 ROAS \u5C0F\u4E8E\u7B49\u4E8E\u8BE5\u503C\u65F6\uFF0C\u4F18\u5148\u81EA\u52A8\u6682\u505C\u8BA1\u5212\u3002\u7559\u7A7A\u4E3A\u5173\u95ED')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          ${fieldAttrName}="autoPauseRoasThreshold"
          value="${escapeHtml(monitorConfig.autoPauseRoasThreshold)}"
          placeholder="\u4E0D\u9650"
        />
      </label>
    `;

    const actionFieldMarkup = `
      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u6BCF\u65E5\u64CD\u4F5C\u6570', '\u9488\u5BF9\u5355\u4E2A\u5546\u54C1\u7684\u6BCF\u65E5\u64CD\u4F5C\u6B21\u6570')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          ${fieldAttrName}="dailyOperationLimit"
          value="${escapeHtml(monitorConfig.dailyOperationLimit)}"
          placeholder="\u4E0D\u9650"
        />
      </label>

      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u603B\u64CD\u4F5C\u6570', '\u9488\u5BF9\u5355\u4E2A\u5546\u54C1\u7684\u7D2F\u8BA1\u64CD\u4F5C\u6B21\u6570')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          ${fieldAttrName}="totalOperationLimit"
          value="${escapeHtml(monitorConfig.totalOperationLimit)}"
          placeholder="\u4E0D\u9650"
        />
      </label>

      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u76EE\u6807ROAS \u2264', '\u5BF9\u5E94 ads_detail \u8FD4\u56DE\u7684\u76EE\u6807 ROAS\u3002\u53EA\u6709\u76EE\u6807 ROAS \u5C0F\u4E8E\u7B49\u4E8E\u8BE5\u503C\u7684\u5546\u54C1\u624D\u4F1A\u6267\u884C\u5F53\u524D\u9009\u62E9\u7684\u4FEE\u6539\u64CD\u4F5C\uFF0C\u7559\u7A7A\u4E3A\u4E0D\u9650')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          ${fieldAttrName}="conditionMaxRoas"
          value="${escapeHtml(monitorConfig.conditionMaxRoas)}"
          placeholder="\u4E0D\u9650"
        />
      </label>

      <label class="promotion-monitor-config-item">
        ${buildMonitorConfigLabelMarkup('\u8BA2\u5355\u91CF\u2265', '\u5BF9\u5E94 ads_detail \u8FD4\u56DE\u7684\u5B50\u8BA2\u5355\u91CF(\u63A8\u5E7F)\uFF0C\u6700\u5C0F\u503C\u4E3A 1')}
        <input
          class="promotion-monitor-config-input"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          ${fieldAttrName}="minOrderCount"
          value="${escapeHtml(monitorConfig.minOrderCount)}"
          placeholder="1"
        />
      </label>

      <section class="promotion-monitor-config-item is-wide">
        <span class="promotion-monitor-config-label">\u4FEE\u6539\u64CD\u4F5C</span>
        <span class="promotion-monitor-config-select-shell">
          <select class="promotion-monitor-config-select" ${actionSelectAttrName}="true">
            ${MONITOR_CONFIG_ACTIONS.map((action) => `
              <option
                value="${escapeHtml(action.id)}"
                ${monitorConfig.actionType === action.id ? 'selected' : ''}
              >
                ${escapeHtml(action.label)}
              </option>
            `).join('')}
          </select>
          <span class="promotion-monitor-config-select-arrow" aria-hidden="true">&#9662;</span>
        </span>
      </section>

      ${actionMeta.requiresResumeIntervalInput ? `
        <label class="promotion-monitor-config-item is-wide">
          ${buildMonitorConfigLabelMarkup(actionMeta.resumeIntervalLabel, actionMeta.resumeIntervalHint)}
          <input
            class="promotion-monitor-config-input"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            ${fieldAttrName}="resumeIntervalMinutes"
            value="${escapeHtml(monitorConfig.resumeIntervalMinutes)}"
            placeholder="${escapeHtml(actionMeta.resumeIntervalPlaceholder)}"
          />
        </label>
      ` : ''}

      ${actionMeta.requiresRoasInput ? `
        <label class="promotion-monitor-config-item is-wide">
          ${buildMonitorConfigLabelMarkup(actionMeta.inputLabel, actionMeta.hint)}
          <input
            class="promotion-monitor-config-input"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            ${fieldAttrName}="targetRoas"
            value="${escapeHtml(monitorConfig.targetRoas)}"
            placeholder="${escapeHtml(actionMeta.inputPlaceholder)}"
          />
        </label>
      ` : ''}
    `;

    return `
      <div class="${scrollClassName}">
        <div class="${stackClassName}">
          <div class="promotion-monitor-config-inline-block">
            <div class="${sectionGridClassName}">
              ${monitorIntervalFieldMarkup}
              ${regionFieldMarkup}
            </div>
          </div>

          ${buildConfigSectionCard(
            '\u81EA\u52A8\u6682\u505C',
            autoPauseFieldMarkup,
            'is-guard'
          )}

          ${buildConfigSectionCard(
            '\u76D1\u63A7\u52A8\u4F5C',
            actionFieldMarkup,
            'is-action'
          )}
        </div>
      </div>
    `;
  }

  function buildMonitorConfigSectionMarkup() {
    const batchMonitoringActive = isMonitorBatchActive();

    return `
      <div class="promotion-monitor-config-head">
        <div class="promotion-monitor-config-copy">
          <span class="promotion-monitor-config-tag">\u76D1\u63A7\u914D\u7F6E</span>
          <p class="promotion-monitor-config-text">\u8BBE\u7F6E\u76D1\u63A7\u89E6\u53D1\u6761\u4EF6\u4E0E\u5904\u7406\u64CD\u4F5C\u3002</p>
        </div>
        <div class="promotion-monitor-config-actions">
          <button
            class="promotion-monitor-config-batch-button ${batchMonitoringActive ? 'is-active' : ''}"
            type="button"
            data-monitor-batch-toggle="true"
          >
            ${batchMonitoringActive ? '\u505C\u6B62\u6279\u91CF\u76D1\u63A7' : '\u5F00\u59CB\u6279\u91CF\u76D1\u63A7'}
          </button>
          <button
            class="promotion-monitor-config-action-button"
            type="button"
            data-module-action="open-customize"
            aria-label="\u81EA\u5B9A\u4E49\u5217"
            title="\u81EA\u5B9A\u4E49\u5217"
          >
            <span class="promotion-icon-button-glyph" aria-hidden="true">&#9881;</span>
          </button>
        </div>
      </div>

      <div class="promotion-monitor-config-scroll">
        <div class="promotion-monitor-config-grid">
          <label class="promotion-monitor-config-item">
            ${buildMonitorConfigLabelMarkup('\u6BCF\u65E5\u64CD\u4F5C\u6570', '\u9488\u5BF9\u5355\u4E2A\u5546\u54C1\u7684\u6BCF\u65E5\u64CD\u4F5C\u6B21\u6570')}
            <input
              class="promotion-monitor-config-input"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              data-monitor-config-field="dailyOperationLimit"
              value="${escapeHtml(monitorConfig.dailyOperationLimit)}"
              placeholder="\u4E0D\u9650"
            />
          </label>

          <label class="promotion-monitor-config-item">
            ${buildMonitorConfigLabelMarkup('\u603B\u64CD\u4F5C\u6570', '\u9488\u5BF9\u5355\u4E2A\u5546\u54C1\u7684\u7D2F\u8BA1\u64CD\u4F5C\u6B21\u6570')}
            <input
              class="promotion-monitor-config-input"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              data-monitor-config-field="totalOperationLimit"
              value="${escapeHtml(monitorConfig.totalOperationLimit)}"
              placeholder="\u4E0D\u9650"
            />
          </label>

          <label class="promotion-monitor-config-item">
            ${buildMonitorConfigLabelMarkup('\u8BA2\u5355\u91CF\u5927\u4E8E', '对应 ads_detail 返回的推广子订单量，最小值为 1')}
            <input
              class="promotion-monitor-config-input"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              data-monitor-config-field="minOrderCount"
              value="${escapeHtml(monitorConfig.minOrderCount)}"
              placeholder="1"
            />
          </label>

          <section class="promotion-monitor-config-item is-wide is-dropdown">
            <span class="promotion-monitor-config-label">\u76D1\u63A7\u5730\u533A</span>
            <details class="promotion-monitor-config-multi-select" data-monitor-region-select>
              <summary class="promotion-monitor-config-multi-toggle">
                <span class="promotion-monitor-config-multi-value" data-monitor-region-summary>${escapeHtml(buildMonitorRegionSummaryText(monitorConfig.regionIds))}</span>
                <span class="promotion-monitor-config-multi-arrow" aria-hidden="true">&#9662;</span>
              </summary>
              <div class="promotion-monitor-config-multi-menu">
              ${MONITOR_SITE_VARIANTS.map((site) => `
                <label class="promotion-monitor-config-dropdown-option">
                  <input
                    type="checkbox"
                    data-monitor-config-region="${escapeHtml(site.id)}"
                    ${monitorConfig.regionIds.includes(site.id) ? 'checked' : ''}
                  />
                  <span>${escapeHtml(site.label)}</span>
                </label>
              `).join('')}
              </div>
            </details>
          </section>

          <section class="promotion-monitor-config-item is-wide">
            <span class="promotion-monitor-config-label">\u4FEE\u6539\u64CD\u4F5C</span>
            <span class="promotion-monitor-config-select-shell">
              <select class="promotion-monitor-config-select" data-monitor-config-action-select="true">
                ${MONITOR_CONFIG_ACTIONS.map((action) => `
                  <option
                    value="${escapeHtml(action.id)}"
                    ${monitorConfig.actionType === action.id ? 'selected' : ''}
                  >
                    ${escapeHtml(action.label)}
                  </option>
                `).join('')}
              </select>
              <span class="promotion-monitor-config-select-arrow" aria-hidden="true">&#9662;</span>
            </span>
          </section>

          ${actionMeta.requiresRoasInput ? `
            <label class="promotion-monitor-config-item is-wide">
              ${buildMonitorConfigLabelMarkup(actionMeta.inputLabel, actionMeta.hint)}
              <input
                class="promotion-monitor-config-input"
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                data-monitor-config-field="targetRoas"
                value="${escapeHtml(monitorConfig.targetRoas)}"
                placeholder="${escapeHtml(actionMeta.inputPlaceholder)}"
              />
            </label>
          ` : ''}
        </div>
      </div>
    `;
  }

  function buildMonitorConfigSectionMarkupV2() {
    const batchMonitoringActive = isMonitorBatchActive();

    return `
      <div class="promotion-monitor-config-head">
        <div class="promotion-monitor-config-copy">
          <span class="promotion-monitor-config-tag">\u76D1\u63A7\u914D\u7F6E</span>
        </div>
        ${buildMonitorOverviewSummaryMarkupV2()}
        <div class="promotion-monitor-config-button-group">
          <button
            class="promotion-monitor-config-batch-button ${batchMonitoringActive ? 'is-active' : ''}"
            type="button"
            data-monitor-batch-toggle="true"
          >
            ${batchMonitoringActive ? '\u505C\u6B62\u6279\u91CF\u76D1\u63A7' : '\u5F00\u59CB\u6279\u91CF\u76D1\u63A7'}
          </button>
          <button
            class="promotion-monitor-config-action-button"
            type="button"
            data-module-action="open-customize"
            aria-label="\u81EA\u5B9A\u4E49\u5217"
            title="\u81EA\u5B9A\u4E49\u5217"
          >
            <span class="promotion-icon-button-glyph" aria-hidden="true">&#9881;</span>
          </button>
        </div>
      </div>

      ${buildMonitorConfigFieldsMarkup(moduleRuntimeState.monitorConfig)}
    `;
  }

  function buildMonitorConfigSectionMarkup() {
    return buildMonitorConfigSectionMarkupV2();
  }

  function renderMonitorConfigSection(moduleId, moduleElements) {
    if (!moduleElements || !moduleElements.configSection) {
      return;
    }

    if (moduleId !== 'monitor') {
      moduleElements.configSection.hidden = true;
      moduleElements.configSection.innerHTML = '';
      return;
    }

    moduleElements.configSection.hidden = false;
    moduleElements.configSection.innerHTML = buildMonitorConfigSectionMarkupV2();
  }

  function syncMonitorRegionSummaryInContainer(container, regionIds, options = {}) {
    if (!(container instanceof Element)) {
      return;
    }

    const summarySelector = options.summarySelector || '[data-monitor-region-summary]';
    const dropdownSelector = options.dropdownSelector || '[data-monitor-region-select]';
    const summaryElement = container.querySelector(summarySelector);

    if (summaryElement) {
      summaryElement.textContent = buildMonitorRegionSummaryText(regionIds);
    }

    const dropdown = container.querySelector(dropdownSelector);

    if (dropdown instanceof HTMLDetailsElement && dropdown.open) {
      positionMonitorRegionDropdown(dropdown);
    }
  }

  function syncMonitorRegionSummary(moduleElements = getModulePanelElements('monitor')) {
    syncMonitorRegionSummaryInContainer(
      moduleElements && moduleElements.configSection ? moduleElements.configSection : null,
      moduleRuntimeState.monitorConfig.regionIds,
      {
        summarySelector: '[data-monitor-region-summary]',
        dropdownSelector: '[data-monitor-region-select]'
      }
    );
  }

  function syncMonitorShopConfigRegionSummary() {
    syncMonitorRegionSummaryInContainer(
      getElement('promotionMonitorShopConfigBody'),
      moduleRuntimeState.monitorShopConfigDraft
        ? moduleRuntimeState.monitorShopConfigDraft.regionIds
        : [],
      {
        summarySelector: '[data-monitor-shop-region-summary]',
        dropdownSelector: '[data-monitor-shop-region-select]'
      }
    );
  }

  function closeMonitorRegionDropdown(dropdown) {
    if (!(dropdown instanceof HTMLDetailsElement)) {
      return;
    }

    dropdown.open = false;
    delete dropdown.dataset.positioned;
  }

  function closeOpenMonitorRegionDropdowns(exceptDropdown = null) {
    document.querySelectorAll('[data-monitor-region-select][open], [data-monitor-shop-region-select][open]').forEach((node) => {
      if (node === exceptDropdown) {
        return;
      }

      closeMonitorRegionDropdown(node);
    });
  }

  function positionMonitorRegionDropdown(dropdown) {
    if (!(dropdown instanceof HTMLDetailsElement) || !dropdown.open) {
      return;
    }

    const toggle = dropdown.querySelector('.promotion-monitor-config-multi-toggle');
    const menu = dropdown.querySelector('.promotion-monitor-config-multi-menu');

    if (!(toggle instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
      return;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const toggleRect = toggle.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = Math.max(Math.round(toggleRect.width), Math.round(menuRect.width), 72);
    const menuHeight = Math.max(Math.round(menuRect.height), 120);
    let left = Math.round(toggleRect.left);
    let top = Math.round(toggleRect.bottom + 8);

    if (left + menuWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - menuWidth - 12);
    }

    if (top + menuHeight > viewportHeight - 12 && toggleRect.top - menuHeight - 8 >= 12) {
      top = Math.round(toggleRect.top - menuHeight - 8);
    }

    dropdown.style.setProperty('--monitor-region-menu-left', `${left}px`);
    dropdown.style.setProperty('--monitor-region-menu-top', `${top}px`);
    dropdown.style.setProperty('--monitor-region-menu-width', `${menuWidth}px`);
    dropdown.dataset.positioned = 'true';
  }

  function refreshOpenMonitorRegionDropdownPosition() {
    document.querySelectorAll('[data-monitor-region-select][open], [data-monitor-shop-region-select][open]').forEach((node) => {
      if (node instanceof HTMLDetailsElement) {
        positionMonitorRegionDropdown(node);
      }
    });
  }

  function positionMonitorConfigHelpTooltip(helpElement) {
    if (!(helpElement instanceof HTMLElement)) {
      return;
    }

    const bubble = helpElement.querySelector('.promotion-monitor-config-help-bubble');

    if (!(bubble instanceof HTMLElement)) {
      return;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const helpRect = helpElement.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const bubbleWidth = Math.max(Math.round(bubbleRect.width), 156);
    const bubbleHeight = Math.max(Math.round(bubbleRect.height), 38);
    const minLeft = 12 + Math.round(bubbleWidth / 2);
    const maxLeft = Math.max(minLeft, viewportWidth - 12 - Math.round(bubbleWidth / 2));
    const centerLeft = Math.round(helpRect.left + (helpRect.width / 2));
    const resolvedLeft = Math.min(maxLeft, Math.max(minLeft, centerLeft));
    let top = Math.round(helpRect.top - bubbleHeight - 12);

    if (top < 12) {
      top = Math.round(helpRect.bottom + 12);
    }

    helpElement.style.setProperty('--monitor-help-left', `${resolvedLeft}px`);
    helpElement.style.setProperty('--monitor-help-top', `${top}px`);
    helpElement.dataset.monitorHelpOpen = 'true';
  }

  function clearMonitorConfigHelpTooltip(helpElement) {
    if (!(helpElement instanceof HTMLElement)) {
      return;
    }

    delete helpElement.dataset.monitorHelpOpen;
  }

  function refreshMonitorConfigHelpTooltipPositions() {
    document.querySelectorAll('[data-monitor-help-open="true"]').forEach((node) => {
      positionMonitorConfigHelpTooltip(node);
    });
  }

  function applyStandardTableClasses(shellElement, headElement, bodyElement) {
    shellElement.classList.remove('is-monitor');
    headElement.classList.remove('is-monitor');
    bodyElement.classList.remove('is-monitor');
  }

  function applyMonitorTableClasses(shellElement, headElement, bodyElement) {
    shellElement.classList.add('is-monitor');
    headElement.classList.add('is-monitor');
    bodyElement.classList.add('is-monitor');
  }

  function renderStandardTable(moduleId, moduleConfig) {
    const moduleElements = getModulePanelElements(moduleId);
    const normalizedModuleId = normalizeText(moduleId);

    if (!moduleElements || !moduleElements.listShell || !moduleElements.listHead || !moduleElements.listBody) {
      return;
    }

    const scrollState = capturePanelScrollState(moduleElements);
    const shellElement = moduleElements.listShell;
    const headElement = moduleElements.listHead;
    const bodyElement = moduleElements.listBody;

    applyStandardTableClasses(shellElement, headElement, bodyElement);
    headElement.style.gridTemplateColumns = moduleConfig.columnTemplate;
    headElement.innerHTML = moduleConfig.columns
      .map((column) => `<span class="promotion-head-cell">${escapeHtml(column)}</span>`)
      .join('');

    if (moduleConfig.rows.length === 0) {
      bodyElement.innerHTML = normalizeText(moduleConfig.emptyMessage)
        ? `
          <article class="promotion-list-row" style="grid-template-columns:${moduleConfig.columnTemplate}">
            <span class="promotion-row-cell" style="grid-column: 1 / -1;">${escapeHtml(moduleConfig.emptyMessage)}</span>
          </article>
        `
        : '';
      restorePanelScrollState(moduleElements, scrollState);

      if (normalizedModuleId === 'logs' && getActiveModuleId() === 'logs') {
        requestAnimationFrame(() => {
          void maybeLoadMoreRuntimeLogs(bodyElement);
        });
      }
      return;
    }

    bodyElement.innerHTML = moduleConfig.rows
      .map((row) => `
        <article class="promotion-list-row" style="grid-template-columns:${moduleConfig.columnTemplate}">
          ${row.map((cell) => `<span class="promotion-row-cell">${escapeHtml(cell)}</span>`).join('')}
        </article>
      `)
      .join('');

    restorePanelScrollState(moduleElements, scrollState);

    if (normalizedModuleId === 'logs' && getActiveModuleId() === 'logs') {
      requestAnimationFrame(() => {
        void maybeLoadMoreRuntimeLogs(bodyElement);
      });
    }
  }

  function renderMonitorHead(moduleElements, moduleConfig, columnTemplate) {
    if (!moduleElements || !moduleElements.listHead) {
      return;
    }

    const headElement = moduleElements.listHead;
    const headSignature = JSON.stringify({
      columnTemplate,
      baseColumns: moduleConfig.baseColumns.map((column) => [
        column.id,
        column.label,
        column.width
      ]),
      groups: moduleConfig.groups.map((group) => [
        group.id,
        group.label,
        group.theme,
        group.columns.length,
        group.helpText || ''
      ]),
      columns: moduleConfig.columns.map((column) => [
        column.id,
        column.shortLabel,
        column.fullLabel,
        column.theme,
        column.isGroupStart === true,
        column.isGroupEnd === true,
        column.helpText || ''
      ])
    });

    if (headElement.dataset.monitorHeadSignature === headSignature) {
      headElement.style.gridTemplateColumns = columnTemplate;
      return;
    }

    headElement.style.gridTemplateColumns = columnTemplate;
    headElement.innerHTML = [
      ...moduleConfig.baseColumns.map((column) => `
        <span
          class="promotion-monitor-head-cell is-base is-resizable ${column.id === 'monitor' ? 'is-toggle' : ''} ${column.id === 'log' ? 'is-log' : ''}"
          style="grid-row: span 2;"
        >
          <span class="promotion-monitor-head-label is-base-label">${escapeHtml(column.label)}</span>
          <button
            class="promotion-monitor-resize-handle"
            type="button"
            data-monitor-resize-column="${escapeHtml(column.id)}"
            aria-label="${escapeHtml(`调整${column.label}列宽`)}"
            title="${escapeHtml(`拖动调整${column.label}`)}"
          ></button>
        </span>
      `),
      ...moduleConfig.groups.map((group) => `
        <span
          class="promotion-monitor-head-cell is-group tone-${escapeHtml(group.theme)}"
          style="grid-column: span ${group.columns.length};"
          title="${escapeHtml(group.helpText || group.label)}"
        >
          <span class="promotion-monitor-head-label">
            ${escapeHtml(group.label)}
            ${group.helpText ? `<span class="promotion-monitor-help" title="${escapeHtml(group.helpText)}">?</span>` : ''}
          </span>
        </span>
      `),
      ...moduleConfig.columns.map((column) => `
        <span
          class="promotion-monitor-head-cell is-sub tone-${escapeHtml(column.theme)} ${column.isGroupStart ? 'is-group-start' : ''} ${column.isGroupEnd ? 'is-group-end' : ''}"
          title="${escapeHtml(column.helpText || column.fullLabel || column.shortLabel)}"
        >
          <span class="promotion-monitor-head-label">
            ${escapeHtml(column.shortLabel)}
            ${column.helpText ? `<span class="promotion-monitor-help" title="${escapeHtml(column.helpText)}">?</span>` : ''}
          </span>
        </span>
      `)
    ].join('');
    headElement.dataset.monitorHeadSignature = headSignature;
  }

  function buildMonitorEmptyMarkup(moduleConfig, columnTemplate) {
    return `
      <article class="promotion-monitor-row is-empty" style="grid-template-columns:${columnTemplate}">
        <span class="promotion-monitor-cell is-base is-toggle">
          <span class="promotion-monitor-main">-</span>
          <span class="promotion-monitor-note is-empty"></span>
        </span>
        <span class="promotion-monitor-cell is-base is-log">
          <span class="promotion-monitor-main"></span>
          <span class="promotion-monitor-note is-empty"></span>
        </span>
        <span class="promotion-monitor-cell is-base">
          <span class="promotion-monitor-main">\u6682\u65E0\u5E97\u94FA</span>
          <span class="promotion-monitor-note">-</span>
        </span>
        <span class="promotion-monitor-cell is-base">
          <span class="promotion-monitor-main">\u6682\u65E0\u5206\u7EC4</span>
          <span class="promotion-monitor-note">-</span>
        </span>
        <span class="promotion-monitor-cell is-base">
          <span class="promotion-monitor-main"></span>
          <span class="promotion-monitor-note is-empty"></span>
        </span>
        <span class="promotion-monitor-cell is-empty-message" style="grid-column: span ${Math.max(1, moduleConfig.columns.length)}">
          ${escapeHtml(moduleConfig.emptyMessage)}
        </span>
      </article>
    `;
  }

  function buildMonitorRowSignature(row, columnTemplate) {
    return JSON.stringify({
      columnTemplate,
      monitorKey: row.monitorKey,
      monitorEnabled: row.monitorEnabled === true,
      hasShopConfig: row.hasShopConfig === true,
      monitorConfigModeLabel: row.monitorConfigModeLabel,
      monitorLog: row.monitorLog,
      shopName: row.shopName,
      groupName: row.groupName,
      shopNote: row.shopNote,
      updatedAt: row.updatedAt,
      values: row.values.map((value) => ({
        theme: value.theme,
        isGroupStart: value.isGroupStart === true,
        isGroupEnd: value.isGroupEnd === true,
        fullLabel: value.fullLabel,
        siteValues: value.siteValues.map((siteValue) => ({
          siteId: siteValue.siteId,
          siteLabel: siteValue.siteLabel,
          primary: siteValue.primary
        }))
      }))
    });
  }

  function buildMonitorRowInnerHtml(row) {
    return `
      <span class="promotion-monitor-cell is-base is-toggle">
        <span class="promotion-monitor-toggle-stack">
          <button
            class="promotion-monitor-toggle ${row.monitorEnabled ? 'is-active' : ''}"
            type="button"
            data-monitor-toggle-key="${escapeHtml(row.monitorKey)}"
            aria-pressed="${row.monitorEnabled ? 'true' : 'false'}"
            aria-label="${escapeHtml(`${row.shopName} \u6279\u91CF\u76D1\u63A7\u9009\u62E9\u72B6\u6001`)}"
            title="${row.monitorEnabled ? '\u5DF2\u7EB3\u5165\u6279\u91CF\u76D1\u63A7' : '\u672A\u7EB3\u5165\u6279\u91CF\u76D1\u63A7'}"
          >
            <span class="promotion-monitor-toggle-thumb" aria-hidden="true"></span>
          </button>
          <button
            class="promotion-monitor-row-config-button ${row.hasShopConfig ? 'is-custom' : ''}"
            type="button"
            data-monitor-shop-config-key="${escapeHtml(row.monitorKey)}"
            aria-label="${escapeHtml(`${row.shopName} \u76D1\u63A7\u914D\u7F6E`)}"
            title="${row.hasShopConfig ? '\u5F53\u524D\u4E3A\u72EC\u7ACB\u914D\u7F6E' : '\u5F53\u524D\u8DDF\u968F\u5168\u5C40\u914D\u7F6E'}"
          >
            \u914D\u7F6E
          </button>
        </span>
        <span class="promotion-monitor-note">${escapeHtml(row.monitorConfigModeLabel)}</span>
      </span>
      <span class="promotion-monitor-cell is-base is-log ${row.monitorLogError ? 'is-error' : ''}">
        <span class="promotion-monitor-main">${escapeHtml(row.monitorLog)}</span>
        <span class="promotion-monitor-note is-empty"></span>
      </span>
      <span class="promotion-monitor-cell is-base">
        <span class="promotion-monitor-main">${escapeHtml(row.shopName)}</span>
        <span class="promotion-monitor-note">\u66F4\u65B0\uFF1A${escapeHtml(row.updatedAt)}</span>
      </span>
      <span class="promotion-monitor-cell is-base">
        <span class="promotion-monitor-main">${escapeHtml(row.groupName)}</span>
        <span class="promotion-monitor-note is-empty"></span>
      </span>
      <span class="promotion-monitor-cell is-base">
        <span class="promotion-monitor-main">${escapeHtml(row.shopNote)}</span>
        <span class="promotion-monitor-note is-empty"></span>
      </span>
      ${row.values.map((value) => `
        <span
          class="promotion-monitor-cell tone-${escapeHtml(value.theme)} ${value.isGroupStart ? 'is-group-start' : ''} ${value.isGroupEnd ? 'is-group-end' : ''}"
          title="${escapeHtml(value.fullLabel || '')}"
        >
          <span class="promotion-monitor-site-list">
            ${value.siteValues.map((siteValue) => `
              <span class="promotion-monitor-site-row">
                <span class="promotion-monitor-site-label">${escapeHtml(siteValue.siteLabel)}</span>
                <span class="promotion-monitor-site-metric">${escapeHtml(siteValue.primary)}</span>
              </span>
            `).join('')}
          </span>
        </span>
      `).join('')}
    `;
  }

  function updateMonitorRowElement(rowElement, row, columnTemplate, rowSignature) {
    rowElement.className = 'promotion-monitor-row';
    rowElement.style.gridTemplateColumns = columnTemplate;
    rowElement.dataset.monitorRowKey = row.monitorKey;
    rowElement.dataset.monitorRowSignature = rowSignature;
    rowElement.innerHTML = buildMonitorRowInnerHtml(row);
  }

  function renderMonitorRows(moduleElements, moduleConfig, columnTemplate) {
    if (!moduleElements || !moduleElements.listBody) {
      return;
    }

    const bodyElement = moduleElements.listBody;

    if (moduleConfig.rows.length === 0) {
      const emptyMarkup = buildMonitorEmptyMarkup(moduleConfig, columnTemplate);

      if (bodyElement.dataset.monitorEmptySignature === emptyMarkup) {
        return;
      }

      bodyElement.innerHTML = emptyMarkup;
      bodyElement.dataset.monitorEmptySignature = emptyMarkup;
      delete bodyElement.dataset.monitorRowsMode;
      return;
    }

    delete bodyElement.dataset.monitorEmptySignature;
    if (bodyElement.dataset.monitorRowsMode !== 'rows') {
      bodyElement.innerHTML = '';
    }
    bodyElement.dataset.monitorRowsMode = 'rows';

    const existingRows = new Map(
      Array.from(bodyElement.querySelectorAll('[data-monitor-row-key]')).map((rowElement) => [
        normalizeText(rowElement.getAttribute('data-monitor-row-key')),
        rowElement
      ])
    );
    let referenceNode = bodyElement.firstElementChild;

    moduleConfig.rows.forEach((row) => {
      const rowSignature = buildMonitorRowSignature(row, columnTemplate);
      let rowElement = existingRows.get(row.monitorKey) || null;

      if (!rowElement) {
        rowElement = document.createElement('article');
        updateMonitorRowElement(rowElement, row, columnTemplate, rowSignature);
      } else if (
        rowElement.dataset.monitorRowSignature !== rowSignature
        || rowElement.style.gridTemplateColumns !== columnTemplate
      ) {
        updateMonitorRowElement(rowElement, row, columnTemplate, rowSignature);
      }

      existingRows.delete(row.monitorKey);

      if (rowElement !== referenceNode) {
        bodyElement.insertBefore(rowElement, referenceNode);
      } else {
        referenceNode = referenceNode ? referenceNode.nextElementSibling : null;
        return;
      }

      referenceNode = rowElement.nextElementSibling;
    });

    existingRows.forEach((rowElement) => {
      rowElement.remove();
    });
  }

  async function toggleMonitorState(toggleKey) {
    const normalizedKey = normalizeText(toggleKey);

    if (!normalizedKey) {
      return;
    }

    const matchedShop = moduleRuntimeState.visibleShops.find((shop) => getMonitorShopKey(shop) === normalizedKey);

    if (!matchedShop) {
      return;
    }

    const nextEnabled = !getMonitorToggleState(matchedShop);
    const snapshot = await setPromotionMonitorShopEnabled(normalizedKey, nextEnabled);

    if (!snapshot) {
      return;
    }

    matchedShop.monitorEnabled = nextEnabled;

    if (getModulePanel('monitor')) {
      renderModulePanel('monitor');
    }
  }

  async function toggleMonitorBatchState(button) {
    const targetButton = button instanceof HTMLButtonElement
      ? button
      : null;
    const nextEnabled = !isMonitorBatchActive();

    toggleButtonBusy(
      targetButton,
      true,
      nextEnabled ? '启动中...' : '停止中...'
    );

    const snapshot = await setPromotionMonitorBatchActive(nextEnabled);

    toggleButtonBusy(targetButton, false, '');

    if (!snapshot) {
      showWindowNotice(
        nextEnabled ? '批量监控启动失败，请稍后重试。' : '批量监控停止失败，请稍后重试。',
        'warning'
      );
      return;
    }

    showWindowNotice(
      nextEnabled ? '批量监控已启动。' : '批量监控已停止。',
      'success'
    );

    if (getModulePanel('monitor')) {
      renderModulePanel('monitor');
    }
  }

  function renderMonitorTable(moduleId, moduleConfig) {
    const moduleElements = getModulePanelElements(moduleId);

    if (!moduleElements || !moduleElements.listShell || !moduleElements.listHead || !moduleElements.listBody) {
      return;
    }

    const scrollState = capturePanelScrollState(moduleElements);
    const shellElement = moduleElements.listShell;
    const headElement = moduleElements.listHead;
    const bodyElement = moduleElements.listBody;
    const columnTemplate = buildMonitorGridTemplate(moduleConfig.baseColumns, moduleConfig.columns);

    applyMonitorTableClasses(shellElement, headElement, bodyElement);
    renderMonitorHead(moduleElements, moduleConfig, columnTemplate);
    renderMonitorRows(moduleElements, moduleConfig, columnTemplate);
    restorePanelScrollState(moduleElements, scrollState);
  }

  function renderModulePanel(moduleId) {
    const normalizedModuleId = normalizeText(moduleId);
    const moduleConfig = getModuleConfig(normalizedModuleId);
    const moduleElements = getModulePanelElements(normalizedModuleId);

    if (!moduleElements) {
      return null;
    }

    renderMonitorFilters(normalizedModuleId, moduleElements);
    renderMonitorToolbarActions(normalizedModuleId, moduleElements);
    renderMonitorConfigSection(normalizedModuleId, moduleElements);

    if (moduleElements.eyebrow) {
      moduleElements.eyebrow.textContent = moduleConfig.eyebrow;
    }

    if (moduleElements.title) {
      moduleElements.title.textContent = moduleConfig.title;
    }

    if (moduleElements.description) {
      moduleElements.description.textContent = moduleConfig.description;
      moduleElements.description.hidden = !normalizeText(moduleConfig.description);
    }

    if (moduleElements.badge) {
      moduleElements.badge.textContent = moduleConfig.badgeText || `${moduleConfig.rows.length} \u6761\u6570\u636E`;
    }

    if (moduleConfig.renderMode === 'monitor-grid') {
      renderMonitorTable(normalizedModuleId, moduleConfig);
      return moduleConfig;
    }

    renderStandardTable(normalizedModuleId, moduleConfig);
    return moduleConfig;
  }

  function getColumnIdsByTag(tagId) {
    return uniq(
      MONITOR_COLUMN_GROUPS.flatMap((group) => (
        group.columns
          .filter((column) => column.tags.includes(tagId))
          .map((column) => column.id)
      ))
    );
  }

  function getDraftSelectedColumnIds() {
    return Array.isArray(moduleRuntimeState.customizeDraftColumnIds)
      ? moduleRuntimeState.customizeDraftColumnIds.slice()
      : getSelectedMonitorColumnIds();
  }

  function setDraftSelectedColumnIds(nextIds) {
    moduleRuntimeState.customizeDraftColumnIds = normalizeSelectedColumnIds(nextIds) || [];
  }

  function getGroupColumnIds(groupId) {
    const group = MONITOR_COLUMN_GROUPS.find((item) => item.id === groupId);

    return group ? group.columns.map((column) => column.id) : [];
  }

  function renderCustomizeQuickFilters(selectedIdsSet) {
    const container = getElement('promotionCustomizeQuickFilters');

    container.innerHTML = CUSTOMIZE_QUICK_FILTERS.map((filter) => {
      const columnIds = getColumnIdsByTag(filter.id);
      const checked = columnIds.length > 0 && columnIds.every((columnId) => selectedIdsSet.has(columnId));

      return `
        <label class="promotion-customize-quick-item">
          <input
            type="checkbox"
            data-customize-quick-filter="${escapeHtml(filter.id)}"
            ${checked ? 'checked' : ''}
          />
          <span>${escapeHtml(filter.label)}</span>
        </label>
      `;
    }).join('');

    CUSTOMIZE_QUICK_FILTERS.forEach((filter) => {
      const input = container.querySelector(`[data-customize-quick-filter="${filter.id}"]`);
      const columnIds = getColumnIdsByTag(filter.id);
      const selectedCount = columnIds.filter((columnId) => selectedIdsSet.has(columnId)).length;

      if (input instanceof HTMLInputElement) {
        input.indeterminate = selectedCount > 0 && selectedCount < columnIds.length;
      }
    });
  }

  function renderCustomizeGroupList(selectedIdsSet) {
    const container = getElement('promotionCustomizeGroupList');

    container.innerHTML = MONITOR_COLUMN_GROUPS.map((group) => {
      const groupColumnIds = group.columns.map((column) => column.id);
      const selectedCount = groupColumnIds.filter((columnId) => selectedIdsSet.has(columnId)).length;
      const checked = groupColumnIds.length > 0 && selectedCount === groupColumnIds.length;

      return `
        <section class="promotion-customize-group-card">
          <div class="promotion-customize-group-head">
            <label class="promotion-check-row">
              <input
                type="checkbox"
                data-customize-group-toggle="${escapeHtml(group.id)}"
                ${checked ? 'checked' : ''}
              />
              <span>${escapeHtml(group.label)}</span>
            </label>
            <span class="promotion-customize-group-meta">\u5DF2\u9009 ${selectedCount} / ${group.columns.length}</span>
          </div>

          <div class="promotion-customize-option-grid">
            ${group.columns.map((column) => `
              <label
                class="promotion-customize-option"
                title="${escapeHtml(MONITOR_COLUMN_HELP[column.id] || column.fullLabel || column.shortLabel)}"
              >
                <input
                  type="checkbox"
                  data-customize-column-toggle="${escapeHtml(column.id)}"
                  ${selectedIdsSet.has(column.id) ? 'checked' : ''}
                />
                <span>${escapeHtml(column.shortLabel)}</span>
              </label>
            `).join('')}
          </div>
        </section>
      `;
    }).join('');

    MONITOR_COLUMN_GROUPS.forEach((group) => {
      const input = container.querySelector(`[data-customize-group-toggle="${group.id}"]`);
      const selectedCount = group.columns.filter((column) => selectedIdsSet.has(column.id)).length;

      if (input instanceof HTMLInputElement) {
        input.indeterminate = selectedCount > 0 && selectedCount < group.columns.length;
      }
    });
  }

  function renderCustomizeSelectedList(selectedIdsSet) {
    const container = getElement('promotionCustomizeSelectedList');
    const selectedGroups = MONITOR_COLUMN_GROUPS
      .map((group) => ({
        ...group,
        selectedColumns: group.columns.filter((column) => selectedIdsSet.has(column.id))
      }))
      .filter((group) => group.selectedColumns.length > 0);

    if (selectedGroups.length === 0) {
      container.innerHTML = `
        <div class="promotion-modal-empty">
          \u5F53\u524D\u8FD8\u6CA1\u6709\u9009\u4E2D\u7684\u6307\u6807\u5217\u3002\u53EF\u5728\u5DE6\u4FA7\u52FE\u9009\u540E\u70B9\u51FB\u5E94\u7528\u3002
        </div>
      `;
      return;
    }

    container.innerHTML = selectedGroups.map((group) => `
      <section class="promotion-customize-selected-card">
        <div class="promotion-customize-selected-head">
          <strong>${escapeHtml(group.label)}</strong>
          <button
            class="promotion-text-button is-danger"
            type="button"
            data-customize-remove-group="${escapeHtml(group.id)}"
          >
            \u79FB\u9664
          </button>
        </div>
        <p class="promotion-customize-selected-text">
          \u5305\u542B ${escapeHtml(group.selectedColumns.map((column) => column.fullLabel || column.shortLabel).join('\u3001'))}
        </p>
      </section>
    `).join('');
  }

  function renderCustomizeModal() {
    const selectedIds = getDraftSelectedColumnIds();
    const selectedIdsSet = new Set(selectedIds);
    const selectAllInput = getElement('promotionCustomizeSelectAll');

    renderCustomizeQuickFilters(selectedIdsSet);
    renderCustomizeGroupList(selectedIdsSet);
    renderCustomizeSelectedList(selectedIdsSet);

    getElement('promotionCustomizeSelectedCount').textContent = String(selectedIds.length);
    selectAllInput.checked = selectedIds.length === ALL_MONITOR_COLUMN_IDS.length && ALL_MONITOR_COLUMN_IDS.length > 0;
    selectAllInput.indeterminate = selectedIds.length > 0 && selectedIds.length < ALL_MONITOR_COLUMN_IDS.length;
  }

  function openCustomizeModal() {
    setDraftSelectedColumnIds(getSelectedMonitorColumnIds());
    setFeedbackMessage(getElement('promotionCustomizeModalStatus'), '');
    renderCustomizeModal();
    getElement('promotionCustomizeModal').hidden = false;
  }

  function closeCustomizeModal() {
    getElement('promotionCustomizeModal').hidden = true;
    setFeedbackMessage(getElement('promotionCustomizeModalStatus'), '');
  }

  function getMonitorShopConfigDraftState() {
    if (moduleRuntimeState.monitorShopConfigDraft) {
      return normalizeMonitorConfigState(moduleRuntimeState.monitorShopConfigDraft);
    }

    return getEffectiveMonitorConfigState(moduleRuntimeState.activeMonitorShopConfigKey);
  }

  function setMonitorShopConfigDraftState(values) {
    moduleRuntimeState.monitorShopConfigDraft = normalizeMonitorConfigState(values);
  }

  function renderMonitorShopConfigModal() {
    const shopKey = normalizeText(moduleRuntimeState.activeMonitorShopConfigKey);
    const matchedShop = findVisibleShopByMonitorKey(shopKey);
    const shopName = normalizeText(matchedShop && matchedShop.shopName) || shopKey || '\u5E97\u94FA';
    const hasShopConfig = hasMonitorShopConfig(shopKey);
    const sourceElement = getElement('promotionMonitorShopConfigSource');

    getElement('promotionMonitorShopConfigModalTitle').textContent = `${shopName} \u76D1\u63A7\u914D\u7F6E`;
    getElement('promotionMonitorShopConfigModalText').textContent = hasShopConfig
      ? '\u5F53\u524D\u5E97\u94FA\u5DF2\u8BBE\u7F6E\u72EC\u7ACB\u9879\u3002\u4EC5\u6709\u4E0E\u5168\u5C40\u4E0D\u540C\u7684\u5B57\u6BB5\u4F1A\u5355\u72EC\u4FDD\u5B58\u5E76\u540C\u6B65\u4E91\u7AEF\u3002'
      : '\u5F53\u524D\u5E97\u94FA\u9ED8\u8BA4\u8DDF\u968F\u5168\u5C40\u914D\u7F6E\u3002\u53EA\u6709\u4E0E\u5168\u5C40\u4E0D\u540C\u7684\u5B57\u6BB5\u624D\u4F1A\u751F\u6210\u5E97\u94FA\u72EC\u7ACB\u914D\u7F6E\u3002';
    sourceElement.textContent = hasShopConfig ? '\u72EC\u7ACB\u914D\u7F6E' : '\u8DDF\u968F\u5168\u5C40';
    sourceElement.classList.toggle('is-custom', hasShopConfig);
    sourceElement.classList.toggle('is-global', !hasShopConfig);
    getElement('promotionMonitorShopConfigBody').innerHTML = `
      <section class="promotion-modal-panel is-monitor-shop-config-panel">
        ${buildMonitorConfigFieldsMarkup(getMonitorShopConfigDraftState(), {
          fieldAttrName: 'data-monitor-shop-config-field',
          regionAttrName: 'data-monitor-shop-config-region',
          regionSummaryAttrName: 'data-monitor-shop-region-summary',
          regionSelectAttrName: 'data-monitor-shop-region-select',
          actionSelectAttrName: 'data-monitor-shop-config-action-select',
          modalLayout: true
        })}
      </section>
    `;
  }

  function openMonitorShopConfigModal(shopKey) {
    const normalizedShopKey = normalizeText(shopKey);

    if (!normalizedShopKey) {
      return;
    }

    moduleRuntimeState.activeMonitorShopConfigKey = normalizedShopKey;
    setMonitorShopConfigDraftState(getEffectiveMonitorConfigState(normalizedShopKey));
    setFeedbackMessage(getElement('promotionMonitorShopConfigModalStatus'), '');
    renderMonitorShopConfigModal();
    getElement('promotionMonitorShopConfigModal').hidden = false;
  }

  function closeMonitorShopConfigModal() {
    getElement('promotionMonitorShopConfigModal').hidden = true;
    moduleRuntimeState.activeMonitorShopConfigKey = '';
    moduleRuntimeState.monitorShopConfigDraft = null;
    closeOpenMonitorRegionDropdowns();
    setFeedbackMessage(getElement('promotionMonitorShopConfigModalStatus'), '');
  }

  async function saveMonitorShopConfig() {
    const shopKey = normalizeText(moduleRuntimeState.activeMonitorShopConfigKey);
    const saveButton = getElement('promotionMonitorShopConfigSaveButton');

    if (!shopKey) {
      return;
    }

    toggleButtonBusy(saveButton, true, '\u4FDD\u5B58\u4E2D...');
    setFeedbackMessage(
      getElement('promotionMonitorShopConfigModalStatus'),
      '\u6B63\u5728\u4FDD\u5B58\u5E97\u94FA\u76D1\u63A7\u914D\u7F6E...',
      ''
    );

    const nextShopConfigsState = {
      ...moduleRuntimeState.monitorShopConfigs
    };
    const nextOverridePayload = buildMonitorConfigDiffPayload(
      getMonitorShopConfigDraftState(),
      moduleRuntimeState.monitorConfig
    );

    if (Object.keys(nextOverridePayload).length > 0) {
      nextShopConfigsState[shopKey] = normalizeMonitorConfigOverrideState(nextOverridePayload);
    } else {
      delete nextShopConfigsState[shopKey];
    }

    const result = await savePromotionManagerSettings({
      monitorShopConfigsState: nextShopConfigsState,
      showErrorInModal: true,
      modalStatusElementId: 'promotionMonitorShopConfigModalStatus',
      saveErrorMessage: '\u5E97\u94FA\u76D1\u63A7\u914D\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'
    });

    toggleButtonBusy(saveButton, false, '');

    if (!result) {
      return;
    }

    if (getModulePanel('monitor')) {
      renderModulePanel('monitor');
    }

    showWindowNotice(
      result.cloudSynced === false
        ? '\u5E97\u94FA\u76D1\u63A7\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u672C\u6B21\u4E91\u7AEF\u540C\u6B65\u5931\u8D25\u3002'
        : '\u5E97\u94FA\u76D1\u63A7\u914D\u7F6E\u5DF2\u540C\u6B65\u4E91\u7AEF\u3002',
      result.cloudSynced === false ? 'warning' : 'success'
    );

    closeMonitorShopConfigModal();
  }

  async function resetMonitorShopConfigToGlobal() {
    const shopKey = normalizeText(moduleRuntimeState.activeMonitorShopConfigKey);
    const resetButton = getElement('promotionMonitorShopConfigResetButton');
    const hadShopConfig = hasMonitorShopConfig(shopKey);

    if (!shopKey) {
      return;
    }

    if (!hadShopConfig) {
      closeMonitorShopConfigModal();
      return;
    }

    toggleButtonBusy(resetButton, true, '\u6062\u590D\u4E2D...');
    setFeedbackMessage(
      getElement('promotionMonitorShopConfigModalStatus'),
      '\u6B63\u5728\u6062\u590D\u5E97\u94FA\u5168\u5C40\u76D1\u63A7\u914D\u7F6E...',
      ''
    );

    const nextShopConfigsState = {
      ...moduleRuntimeState.monitorShopConfigs
    };

    delete nextShopConfigsState[shopKey];

    const result = await savePromotionManagerSettings({
      monitorShopConfigsState: nextShopConfigsState,
      showErrorInModal: true,
      modalStatusElementId: 'promotionMonitorShopConfigModalStatus',
      saveErrorMessage: '\u6062\u590D\u5E97\u94FA\u5168\u5C40\u76D1\u63A7\u914D\u7F6E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'
    });

    toggleButtonBusy(resetButton, false, '');

    if (!result) {
      return;
    }

    if (getModulePanel('monitor')) {
      renderModulePanel('monitor');
    }

    showWindowNotice(
      result.cloudSynced === false
        ? '\u5E97\u94FA\u5DF2\u6539\u4E3A\u8DDF\u968F\u5168\u5C40\u914D\u7F6E\uFF0C\u672C\u6B21\u4E91\u7AEF\u540C\u6B65\u5931\u8D25\u3002'
        : '\u5E97\u94FA\u5DF2\u6539\u4E3A\u8DDF\u968F\u5168\u5C40\u914D\u7F6E\u3002',
      result.cloudSynced === false ? 'warning' : 'success'
    );

    closeMonitorShopConfigModal();
  }

  function addDraftColumns(columnIds) {
    setDraftSelectedColumnIds([...getDraftSelectedColumnIds(), ...columnIds]);
  }

  function removeDraftColumns(columnIds) {
    const removalSet = new Set(columnIds);

    setDraftSelectedColumnIds(
      getDraftSelectedColumnIds().filter((columnId) => !removalSet.has(columnId))
    );
  }

  function updateMonitorConfigFieldState(configState, fieldName, value) {
    if (!configState || typeof configState !== 'object') {
      return false;
    }

    const normalizedFieldName = normalizeText(fieldName);

    if (!normalizedFieldName) {
      return false;
    }

    if (normalizedFieldName === 'monitorIntervalSeconds') {
      configState.monitorIntervalSeconds = normalizeMonitorIntervalInput(value);
      return true;
    }

    if (normalizedFieldName === 'dailyOperationLimit') {
      configState.dailyOperationLimit = normalizeMonitorIntegerInput(value);
      return true;
    }

    if (normalizedFieldName === 'totalOperationLimit') {
      configState.totalOperationLimit = normalizeMonitorIntegerInput(value);
      return true;
    }

    if (normalizedFieldName === 'autoPauseSpendThreshold') {
      configState.autoPauseSpendThreshold = normalizeMonitorDecimalInput(value);
      return true;
    }

    if (normalizedFieldName === 'autoPauseRoasThreshold') {
      configState.autoPauseRoasThreshold = normalizeMonitorDecimalInput(value);
      return true;
    }

    if (normalizedFieldName === 'conditionMaxRoas') {
      configState.conditionMaxRoas = normalizeMonitorDecimalInput(value);
      return true;
    }

    if (normalizedFieldName === 'minOrderCount') {
      configState.minOrderCount = normalizeMonitorMinOrderCountInput(value);
      return true;
    }

    if (normalizedFieldName === 'resumeIntervalMinutes') {
      configState.resumeIntervalMinutes = normalizeMonitorResumeIntervalInput(value);
      return true;
    }

    if (normalizedFieldName === 'targetRoas') {
      configState.targetRoas = normalizeMonitorDecimalInput(value);
      return true;
    }

    return false;
  }

  function updateMonitorConfigField(fieldName, value) {
    return updateMonitorConfigFieldState(moduleRuntimeState.monitorConfig, fieldName, value);
  }

  function updateMonitorConfigRegionState(configState, regionId, checked) {
    if (!configState || typeof configState !== 'object') {
      return false;
    }

    const normalizedRegionId = normalizeText(regionId);

    if (!MONITOR_SITE_VARIANTS.some((site) => site.id === normalizedRegionId)) {
      return false;
    }

    const currentRegionIds = new Set(normalizeMonitorConfigRegionIds(configState.regionIds));

    if (checked) {
      currentRegionIds.add(normalizedRegionId);
    } else {
      currentRegionIds.delete(normalizedRegionId);
    }

    configState.regionIds = Array.from(currentRegionIds);
    return true;
  }

  function updateMonitorConfigRegion(regionId, checked) {
    return updateMonitorConfigRegionState(moduleRuntimeState.monitorConfig, regionId, checked);
  }

  function updateMonitorConfigActionState(configState, actionType) {
    if (!configState || typeof configState !== 'object') {
      return false;
    }

    const nextActionType = normalizeMonitorConfigActionType(actionType);

    if (configState.actionType === nextActionType) {
      return false;
    }

    configState.actionType = nextActionType;
    return true;
  }

  function updateMonitorConfigAction(actionType) {
    return updateMonitorConfigActionState(moduleRuntimeState.monitorConfig, actionType);
  }

  async function persistMonitorConfig(options = {}) {
    const result = await savePromotionManagerSettings({
      saveErrorMessage: '\u76D1\u63A7\u914D\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'
    });

    if (result && options.rerender) {
      renderMonitorConfigSection('monitor', getModulePanelElements('monitor'));
    }

    return result;
  }

  async function applyCustomizeSelection() {
    const applyButton = getElement('promotionCustomizeApplyButton');
    const nextColumnIds = getDraftSelectedColumnIds();

    toggleButtonBusy(applyButton, true, '\u5E94\u7528\u4E2D...');
    setFeedbackMessage(getElement('promotionCustomizeModalStatus'), '\u6B63\u5728\u4FDD\u5B58\u81EA\u5B9A\u4E49\u5217...', '');

    moduleRuntimeState.selectedMonitorColumnIds = nextColumnIds;

    if (getModulePanel('monitor')) {
      renderModulePanel('monitor');
    }

    const result = await savePromotionManagerSettings({
      showSuccessMessage: true,
      showErrorInModal: true,
      saveErrorMessage: '\u81EA\u5B9A\u4E49\u5217\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002'
    });

    toggleButtonBusy(applyButton, false, '');

    if (result) {
      closeCustomizeModal();
    }
  }

  async function syncActiveModule(nextButton) {
    const buttons = Array.from(document.querySelectorAll('[data-promotion-module]'));
    const targetButton = nextButton || buttons.find((button) => button.classList.contains('is-active')) || buttons[0] || null;
    const moduleId = targetButton ? normalizeText(targetButton.getAttribute('data-promotion-module')) : 'create';

    buttons.forEach((button) => {
      button.classList.toggle('is-active', button === targetButton);
    });
    setActiveModulePanel(moduleId);

    if (moduleId === 'monitor') {
      await Promise.all([
        loadPromotionMonitorSnapshot({
          renderPanel: false
        }),
        loadVisibleShops()
      ]);
    } else if (moduleId === 'logs') {
      await loadRuntimeLogEntries({
        preserveVisibleCount: true,
        renderPanel: false
      });
    }

    renderModulePanel(moduleId);
    updateModuleBackgroundPolling();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = Array.from(document.querySelectorAll('[data-promotion-module]'));
    const defaultButton = buttons.find((button) => button.classList.contains('is-active')) || buttons[0] || null;
    const defaultModuleId = defaultButton
      ? normalizeText(defaultButton.getAttribute('data-promotion-module')) || 'create'
      : 'create';
    const moduleIds = buttons
      .map((button) => normalizeText(button.getAttribute('data-promotion-module')))
      .filter(Boolean);
    const modulePanelContainer = getModulePanelContainer();
    const customizeGroupList = getElement('promotionCustomizeGroupList');
    const customizeQuickFilters = getElement('promotionCustomizeQuickFilters');
    const customizeSelectedList = getElement('promotionCustomizeSelectedList');
    const monitorShopConfigModal = getElement('promotionMonitorShopConfigModal');

    createModulePanels(moduleIds, defaultModuleId);
    moduleIds.forEach((moduleId) => {
      renderModulePanel(moduleId);
    });

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        void syncActiveModule(button);
      });
    });
    document.addEventListener('visibilitychange', () => {
      updateModuleBackgroundPolling();

      if (!isDocumentVisible()) {
        return;
      }

      const activeModuleId = getActiveModuleId();

      if (activeModuleId === 'monitor') {
        void loadVisibleShops().then(() => {
          if (getActiveModuleId() !== 'monitor' || !isDocumentVisible()) {
            return;
          }

          renderModulePanel('monitor');
        });
        void loadPromotionMonitorSnapshot({
          renderPanel: true
        });
        return;
      }

      if (activeModuleId === 'logs') {
        void loadRuntimeLogEntries({
          preserveVisibleCount: true,
          renderPanel: true
        });
      }
    });

    modulePanelContainer.addEventListener('click', (event) => {
      const filterButton = event.target instanceof Element
        ? event.target.closest('[data-monitor-filter]')
        : null;

      if (filterButton instanceof HTMLButtonElement) {
        const nextFilter = normalizeText(filterButton.getAttribute('data-monitor-filter')) || 'all';

        if (nextFilter === moduleRuntimeState.activeMonitorFilter) {
          return;
        }

        moduleRuntimeState.activeMonitorFilter = nextFilter;
        renderModulePanel('monitor');
        void savePromotionManagerSettings();
        return;
      }

      const customizeButton = event.target instanceof Element
        ? event.target.closest('[data-module-action="open-customize"]')
        : null;

      if (customizeButton instanceof HTMLButtonElement) {
        openCustomizeModal();
        return;
      }

      const batchToggleButton = event.target instanceof Element
        ? event.target.closest('[data-monitor-batch-toggle]')
        : null;

      if (batchToggleButton instanceof HTMLButtonElement) {
        void toggleMonitorBatchState(batchToggleButton);
        return;
      }

      const shopConfigButton = event.target instanceof Element
        ? event.target.closest('[data-monitor-shop-config-key]')
        : null;

      if (shopConfigButton instanceof HTMLButtonElement) {
        openMonitorShopConfigModal(shopConfigButton.getAttribute('data-monitor-shop-config-key'));
        return;
      }

      const toggleButton = event.target instanceof Element
        ? event.target.closest('[data-monitor-toggle-key]')
        : null;

      if (toggleButton instanceof HTMLButtonElement) {
        void toggleMonitorState(toggleButton.getAttribute('data-monitor-toggle-key'));
      }
    });

    modulePanelContainer.addEventListener('change', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const configField = normalizeText(target.getAttribute('data-monitor-config-field'));

      if (configField) {
        const fieldValue = 'value' in target ? target.value : '';

        if (!updateMonitorConfigField(configField, fieldValue)) {
          return;
        }

        if (target instanceof HTMLInputElement && Object.prototype.hasOwnProperty.call(moduleRuntimeState.monitorConfig, configField)) {
          target.value = normalizeText(moduleRuntimeState.monitorConfig[configField]);
        }

        void persistMonitorConfig();
        return;
      }

      const regionId = target instanceof HTMLInputElement
        ? normalizeText(target.getAttribute('data-monitor-config-region'))
        : '';

      if (regionId) {
        if (!updateMonitorConfigRegion(regionId, target.checked)) {
          return;
        }

        syncMonitorRegionSummary();
        void persistMonitorConfig();
        return;
      }

      const actionSelectFlag = target instanceof HTMLSelectElement
        ? normalizeText(target.getAttribute('data-monitor-config-action-select'))
        : '';

      if (actionSelectFlag) {
        if (!updateMonitorConfigAction(target.value)) {
          return;
        }

        renderMonitorConfigSection('monitor', getModulePanelElements('monitor'));
        void persistMonitorConfig({ rerender: false });
        return;
      }

      const actionType = target instanceof HTMLInputElement
        ? normalizeText(target.getAttribute('data-monitor-config-action'))
        : '';

      if (actionType) {
        if (!updateMonitorConfigAction(actionType)) {
          return;
        }

        renderMonitorConfigSection('monitor', getModulePanelElements('monitor'));
        void persistMonitorConfig({ rerender: false });
      }
    });

    monitorShopConfigModal.addEventListener('change', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement) || !moduleRuntimeState.monitorShopConfigDraft) {
        return;
      }

      const configField = normalizeText(target.getAttribute('data-monitor-shop-config-field'));

      if (configField) {
        const fieldValue = 'value' in target ? target.value : '';

        if (!updateMonitorConfigFieldState(moduleRuntimeState.monitorShopConfigDraft, configField, fieldValue)) {
          return;
        }

        if (
          target instanceof HTMLInputElement
          && Object.prototype.hasOwnProperty.call(moduleRuntimeState.monitorShopConfigDraft, configField)
        ) {
          target.value = normalizeText(moduleRuntimeState.monitorShopConfigDraft[configField]);
        }

        return;
      }

      const regionId = target instanceof HTMLInputElement
        ? normalizeText(target.getAttribute('data-monitor-shop-config-region'))
        : '';

      if (regionId) {
        if (!updateMonitorConfigRegionState(moduleRuntimeState.monitorShopConfigDraft, regionId, target.checked)) {
          return;
        }

        syncMonitorShopConfigRegionSummary();
        return;
      }

      const actionSelectFlag = target instanceof HTMLSelectElement
        ? normalizeText(target.getAttribute('data-monitor-shop-config-action-select'))
        : '';

      if (actionSelectFlag) {
        if (!updateMonitorConfigActionState(moduleRuntimeState.monitorShopConfigDraft, target.value)) {
          return;
        }

        renderMonitorShopConfigModal();
      }
    });

    modulePanelContainer.addEventListener('toggle', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLDetailsElement) || !target.matches('[data-monitor-region-select]')) {
        return;
      }

      if (!target.open) {
        delete target.dataset.positioned;
        return;
      }

      closeOpenMonitorRegionDropdowns(target);
      requestAnimationFrame(() => {
        positionMonitorRegionDropdown(target);
      });
    }, true);

    monitorShopConfigModal.addEventListener('toggle', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLDetailsElement) || !target.matches('[data-monitor-shop-region-select]')) {
        return;
      }

      if (!target.open) {
        delete target.dataset.positioned;
        return;
      }

      closeOpenMonitorRegionDropdowns(target);
      requestAnimationFrame(() => {
        positionMonitorRegionDropdown(target);
      });
    }, true);

    modulePanelContainer.addEventListener('pointerover', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      requestAnimationFrame(() => {
        positionMonitorConfigHelpTooltip(helpElement);
      });
    });

    modulePanelContainer.addEventListener('pointerout', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      clearMonitorConfigHelpTooltip(helpElement);
    });

    monitorShopConfigModal.addEventListener('pointerover', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      requestAnimationFrame(() => {
        positionMonitorConfigHelpTooltip(helpElement);
      });
    });

    monitorShopConfigModal.addEventListener('pointerout', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      clearMonitorConfigHelpTooltip(helpElement);
    });

    modulePanelContainer.addEventListener('focusin', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      requestAnimationFrame(() => {
        positionMonitorConfigHelpTooltip(helpElement);
      });
    });

    modulePanelContainer.addEventListener('focusout', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      clearMonitorConfigHelpTooltip(helpElement);
    });

    monitorShopConfigModal.addEventListener('focusin', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      requestAnimationFrame(() => {
        positionMonitorConfigHelpTooltip(helpElement);
      });
    });

    monitorShopConfigModal.addEventListener('focusout', (event) => {
      const helpElement = event.target instanceof Element
        ? event.target.closest('.promotion-monitor-config-help')
        : null;

      if (!(helpElement instanceof HTMLElement)) {
        return;
      }

      if (event.relatedTarget instanceof Node && helpElement.contains(event.relatedTarget)) {
        return;
      }

      clearMonitorConfigHelpTooltip(helpElement);
    });

    modulePanelContainer.addEventListener('scroll', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (normalizeText(target.getAttribute('data-module-role')) !== 'listBody') {
        return;
      }

      const panel = target.closest('[data-module-panel]');

      if (!(panel instanceof HTMLElement) || normalizeText(panel.getAttribute('data-module-panel')) !== 'logs') {
        return;
      }

      void maybeLoadMoreRuntimeLogs(target);
    }, true);

    document.addEventListener('click', (event) => {
      document.querySelectorAll('[data-monitor-region-select][open], [data-monitor-shop-region-select][open]').forEach((dropdown) => {
        if (!(dropdown instanceof HTMLDetailsElement)) {
          return;
        }

        if (event.target instanceof Node && dropdown.contains(event.target)) {
          return;
        }

        closeMonitorRegionDropdown(dropdown);
      });
    });

    document.addEventListener('scroll', () => {
      refreshOpenMonitorRegionDropdownPosition();
      refreshMonitorConfigHelpTooltipPositions();
    }, true);

    window.addEventListener('resize', () => {
      refreshOpenMonitorRegionDropdownPosition();
      refreshMonitorConfigHelpTooltipPositions();
    });

    document.querySelectorAll('[data-close-promotion-modal]').forEach((node) => {
      node.addEventListener('click', () => {
        closeCustomizeModal();
      });
    });

    document.querySelectorAll('[data-close-monitor-shop-config-modal]').forEach((node) => {
      node.addEventListener('click', () => {
        closeMonitorShopConfigModal();
      });
    });

    getElement('promotionCustomizeCancelButton').addEventListener('click', () => {
      closeCustomizeModal();
    });

    getElement('promotionCustomizeApplyButton').addEventListener('click', () => {
      void applyCustomizeSelection();
    });

    getElement('promotionMonitorShopConfigCancelButton').addEventListener('click', () => {
      closeMonitorShopConfigModal();
    });

    getElement('promotionMonitorShopConfigSaveButton').addEventListener('click', () => {
      void saveMonitorShopConfig();
    });

    getElement('promotionMonitorShopConfigResetButton').addEventListener('click', () => {
      void resetMonitorShopConfigToGlobal();
    });

    getElement('promotionCustomizeSelectAll').addEventListener('change', (event) => {
      const input = event.target;

      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      setDraftSelectedColumnIds(input.checked ? ALL_MONITOR_COLUMN_IDS.slice() : []);
      renderCustomizeModal();
    });

    customizeQuickFilters.addEventListener('change', (event) => {
      const input = event.target;

      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const filterId = normalizeText(input.getAttribute('data-customize-quick-filter'));
      const columnIds = getColumnIdsByTag(filterId);

      if (input.checked) {
        addDraftColumns(columnIds);
      } else {
        removeDraftColumns(columnIds);
      }

      renderCustomizeModal();
    });

    customizeGroupList.addEventListener('change', (event) => {
      const input = event.target;

      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const groupId = normalizeText(input.getAttribute('data-customize-group-toggle'));
      const columnId = normalizeText(input.getAttribute('data-customize-column-toggle'));

      if (groupId) {
        const groupColumnIds = getGroupColumnIds(groupId);

        if (input.checked) {
          addDraftColumns(groupColumnIds);
        } else {
          removeDraftColumns(groupColumnIds);
        }

        renderCustomizeModal();
        return;
      }

      if (columnId) {
        if (input.checked) {
          addDraftColumns([columnId]);
        } else {
          removeDraftColumns([columnId]);
        }

        renderCustomizeModal();
      }
    });

    customizeSelectedList.addEventListener('click', (event) => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-customize-remove-group]')
        : null;

      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      removeDraftColumns(getGroupColumnIds(button.getAttribute('data-customize-remove-group')));
      renderCustomizeModal();
    });

    modulePanelContainer.addEventListener('mousedown', (event) => {
      const resizeHandle = event.target instanceof Element
        ? event.target.closest('[data-monitor-resize-column]')
        : null;

      if (!(resizeHandle instanceof HTMLButtonElement)) {
        return;
      }

      event.preventDefault();
      beginMonitorColumnResize(
        resizeHandle.getAttribute('data-monitor-resize-column'),
        event.clientX
      );
    });

    document.addEventListener('mousemove', (event) => {
      if (!moduleRuntimeState.monitorResizeSession) {
        return;
      }

      event.preventDefault();
      updateMonitorColumnResize(event.clientX);
    });

    document.addEventListener('mouseup', () => {
      if (!moduleRuntimeState.monitorResizeSession) {
        return;
      }

      void finishMonitorColumnResize();
    });

    window.addEventListener('blur', () => {
      if (!moduleRuntimeState.monitorResizeSession) {
        return;
      }

      void finishMonitorColumnResize();
    });

    window.addEventListener('beforeunload', () => {
      stopPromotionMonitorPolling();
      stopRuntimeLogPolling();
    });

    getElement('promotionCustomizeClearAllButton').addEventListener('click', () => {
      setDraftSelectedColumnIds([]);
      renderCustomizeModal();
    });

    getElement('promotionCustomizeResetButton').addEventListener('click', () => {
      setDraftSelectedColumnIds(DEFAULT_MONITOR_COLUMN_IDS.slice());
      renderCustomizeModal();
    });

    void (async () => {
      await loadPromotionManagerSettings();
      await initializeModuleBackgroundTasks();
      moduleIds.forEach((moduleId) => {
        renderModulePanel(moduleId);
      });

      if (defaultButton) {
        await syncActiveModule(defaultButton);
      }
    })();
  });
})();
