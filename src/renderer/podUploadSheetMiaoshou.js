(function initPodUploadSheetMiaoshouWindow() {
  const TEMPLATE_OPTIONS = Object.freeze([
    { id: 'non-fashion', label: '\u975e\u670d\u9970\u7c7b\u6a21\u677f' },
    { id: 'fashion', label: '\u670d\u9970\u7c7b\u6a21\u677f' }
  ]);

  const DEFAULT_CATEGORY_OPTION = Object.freeze({
    id: '',
    label: ''
  });
  const DELIVERY_OPTION_VALUES = Object.freeze(['1', '2', '9']);
  const PRODUCT_CODE_HASH_BASE = 1000000000000;
  const PRODUCT_CODE_HASH_RANGE = 9000000000000;
  const TITLE_MAX_LENGTH = 255;
  const COS_UPLOAD_STOP_GUARD_MS = 1000;
  const COS_UPLOAD_PROGRESS_POLL_MS = 700;
  const IMAGE_UPLOAD_MODE_OPTIONS = Object.freeze(['original', 'jpg', 'webp']);

  const MATERIAL_SECTIONS = Object.freeze([
    {
      id: 'carousel',
      title: '\u4ea7\u54c1\u8f6e\u64ad\u56fe',
      description: '\u4f18\u5148\u653e\u4e3b\u56fe\u548c\u8f6e\u64ad\u56fe\u7d20\u6750\uff0c\u5bfc\u5165\u603b\u76ee\u5f55\u65f6\u4f1a\u4f18\u5148\u81ea\u52a8\u5206\u5230\u8fd9\u91cc\u3002',
      filesInputId: 'podCarouselFilesInput',
      folderInputId: 'podCarouselFolderInput'
    },
    {
      id: 'assets',
      title: '\u4ea7\u54c1\u7d20\u6750\u56fe',
      description: '\u7528\u4e8e\u653e\u7ec6\u8282\u56fe\u3001\u5c3a\u5bf8\u56fe\u3001\u8bbe\u8ba1\u7a3f\u7b49\u672c\u5730\u5546\u54c1\u7d20\u6750\u3002',
      filesInputId: 'podAssetsFilesInput',
      folderInputId: 'podAssetsFolderInput'
    },
    {
      id: 'preview',
      title: '\u9884\u89c8\u56fe',
      description: '\u9002\u5408\u6210\u54c1\u9884\u89c8\u56fe\u3001\u6548\u679c\u56fe\u3001mockup \u7b49\u7528\u4e8e\u786e\u8ba4\u5c55\u793a\u6548\u679c\u7684\u56fe\u7247\u3002',
      filesInputId: 'podPreviewFilesInput',
      folderInputId: 'podPreviewFolderInput'
    }
  ]);

  const TEMPLATE_FIELD_GROUPS = Object.freeze({
    'non-fashion': [
      {
        title: '\u6807\u9898\u4e0e\u7c7b\u76ee',
        tone: 'gold',
        fields: ['\u7c7b\u76eeID', '*\u4ea7\u54c1\u6807\u9898', '*\u82f1\u6587\u6807\u9898', '\u4ea7\u54c1\u63cf\u8ff0', '*\u627f\u8bfa\u53d1\u8d27\u65f6\u6548', '*\u4ea7\u5730', '\u7ad9\u5916\u4ea7\u54c1\u94fe\u63a5', '*\u5b9a\u5236\u54c1']
      },
      {
        title: '\u56fe\u7247\u4e0e\u89c4\u683c',
        tone: 'blue',
        fields: ['\u4ea7\u54c1\u8f6e\u64ad\u56fe', '\u4ea7\u54c1\u7d20\u6750\u56fe', '\u9884\u89c8\u56fe', '\u89c4\u683c\u540d\u79f01', '\u89c4\u683c\u5c5e\u6027\u503c1', '\u89c4\u683c\u540d\u79f02', '\u89c4\u683c\u5c5e\u6027\u503c2', '\u4e3b\u8d27\u53f7']
      },
      {
        title: '\u4ef7\u683c\u5e93\u5b58\u4e0e\u7269\u6d41',
        tone: 'green',
        fields: ['\u7533\u62a5\u4ef7\uff08CNY\uff09', '\u5efa\u8bae\u552e\u4ef7\uff08CNY\uff09', '\u957f\uff08cm\uff09', '\u5bbd\uff08cm\uff09', '\u9ad8\uff08cm\uff09', '\u91cd\u91cf\uff08g\uff09', '\u5e93\u5b58', '\u5e73\u53f0SKU']
      },
      {
        title: '\u5305\u88c5\u4e0e\u8865\u5145',
        tone: 'slate',
        fields: ['\u654f\u611f\u5c5e\u6027\u503c', '\u4ea7\u54c1\u7f16\u7801\u7c7b\u578b', '\u4ea7\u54c1\u7f16\u7801', 'SKU\u5206\u7c7b\u7c7b\u578b', 'SKU\u5206\u7c7b\u6570\u91cf', 'SKU\u5206\u7c7b\u5355\u4f4d', '\u662f\u5426\u72ec\u7acb\u5305\u88c5', '\u5305\u88c5\u6e05\u5355', '\u5305\u88c5\u6e05\u5355\u6570\u91cf', '\u4e3b\u56fe\u89c6\u9891', '\u4ea7\u54c1\u8bf4\u660e\u4e66', '\u8d27\u6e90\u94fe\u63a5']
      }
    ],
    fashion: [
      {
        title: '\u6807\u9898\u4e0e\u57fa\u7840\u4fe1\u606f',
        tone: 'gold',
        fields: ['\u7c7b\u76eeID', '*\u4ea7\u54c1\u6807\u9898', '*\u82f1\u6587\u6807\u9898', '\u4ea7\u54c1\u63cf\u8ff0', '*\u627f\u8bfa\u53d1\u8d27\u65f6\u6548', '*\u4ea7\u5730', '\u7ad9\u5916\u4ea7\u54c1\u94fe\u63a5', '*\u5b9a\u5236\u54c1']
      },
      {
        title: '\u7d20\u6750\u4e0e\u89c4\u683c',
        tone: 'blue',
        fields: ['\u4ea7\u54c1\u8f6e\u64ad\u56fe', '\u4ea7\u54c1\u7d20\u6750\u56fe', '\u9884\u89c8\u56fe', '\u89c4\u683c\u540d\u79f01', '\u89c4\u683c\u5c5e\u6027\u503c1', '\u89c4\u683c\u540d\u79f02', '\u89c4\u683c\u5c5e\u6027\u503c2', '\u4e3b\u8d27\u53f7']
      },
      {
        title: '\u4ef7\u683c\u5c3a\u5bf8\u4e0e\u5e93\u5b58',
        tone: 'green',
        fields: ['\u7533\u62a5\u4ef7\uff08CNY\uff09', '\u5efa\u8bae\u552e\u4ef7\uff08CNY\uff09', '\u957f\uff08cm\uff09', '\u5bbd\uff08cm\uff09', '\u9ad8\uff08cm\uff09', '\u91cd\u91cf\uff08g\uff09', '\u5e93\u5b58', '\u5e73\u53f0SKU']
      },
      {
        title: '\u5305\u88c5\u4e0e\u5a92\u4ecb',
        tone: 'slate',
        fields: ['\u5305\u88c5\u6e05\u5355', '\u5305\u88c5\u6e05\u5355\u6570\u91cf', '\u654f\u611f\u5c5e\u6027\u503c', '\u4ea7\u54c1\u7f16\u7801\u7c7b\u578b', '\u4ea7\u54c1\u7f16\u7801', '\u662f\u5426\u72ec\u7acb\u5305\u88c5', '\u4e3b\u56fe\u89c6\u9891', '\u4ea7\u54c1\u8bf4\u660e\u4e66', '\u8d27\u6e90\u94fe\u63a5']
      }
    ]
  });

  const DEFAULT_PRODUCT_FIELDS = Object.freeze({
    templateId: 'non-fashion',
    category: DEFAULT_CATEGORY_OPTION.id,
    localName: '',
    mainNumber: '',
    delivery: '2',
    origin: '\u4e2d\u56fd',
    isCustom: '\u5426',
    sourceFolder: '',
    sourceLink: '',
    description: '',
    descriptionImageOrders: '',
    title: '',
    englishTitle: '',
    specNameOne: '',
    specValueOne: '',
    specNameTwo: '',
    specValueTwo: '',
    masterSku: '',
    declaredPrice: '',
    price: '',
    stock: '',
    platformSku: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    packingList: '',
    packingCount: '',
    codeType: '',
    codeValue: '',
    codeValueDerivedFromSource: false,
    mainVideo: '',
    manual: ''
  });

  const GLOBAL_PRODUCT_FIELD_NAMES = Object.freeze([
    'templateId',
    'category',
    'delivery',
    'origin',
    'isCustom',
    'sourceLink',
    'description',
    'specNameOne',
    'specValueOne',
    'specNameTwo',
    'specValueTwo',
    'packingList',
    'packingCount',
    'codeType',
    'codeValue',
    'mainVideo',
    'manual'
  ]);

  const DEFAULT_GLOBAL_PRODUCT_SETTINGS = Object.freeze(
    GLOBAL_PRODUCT_FIELD_NAMES.reduce((settings, fieldName) => {
      settings[fieldName] = DEFAULT_PRODUCT_FIELDS[fieldName];
      return settings;
    }, {})
  );
  const FORM_TEMPLATE_EXTRA_FIELD_NAMES = Object.freeze([
    'aiTitlePrefix',
    'aiTitleSuffix',
    'aiTitleExtraPrompt',
    'aiTitleMaxLength'
  ]);
  const FORM_TEMPLATE_FIELD_NAMES = Object.freeze([
    ...GLOBAL_PRODUCT_FIELD_NAMES,
    ...FORM_TEMPLATE_EXTRA_FIELD_NAMES
  ]);
  const DEFAULT_FORM_TEMPLATE_FIELDS = Object.freeze({
    ...DEFAULT_GLOBAL_PRODUCT_SETTINGS,
    aiTitlePrefix: '',
    aiTitleSuffix: '',
    aiTitleExtraPrompt: '',
    aiTitleMaxLength: ''
  });

  const SKU_CONFIG_FIELD_NAMES = Object.freeze([
    'declaredPrice',
    'price',
    'length',
    'width',
    'height',
    'weight',
    'stock',
    'skuImage',
    'platformSku',
    'skuCategoryType',
    'skuCategoryCount',
    'skuCategoryUnit',
    'independentPackaging'
  ]);

  const FORM_FIELD_HELP_KEY_OVERRIDES = Object.freeze({
    codeType: 'productCodeType',
    codeValue: 'productCode'
  });

  const SKU_TABLE_HEADER_HELP_KEYS = Object.freeze([
    'specValueOne',
    'specValueTwo',
    'declaredPrice',
    'price',
    'length',
    'width',
    'height',
    'weight',
    'stock',
    'skuImage',
    'platformSku',
    'skuCategoryType',
    'skuCategoryCount',
    'skuCategoryUnit',
    'independentPackaging'
  ]);

  const PRODUCT_LIST_HEADER_HELP_KEYS = Object.freeze([
    '',
    'title',
    'englishTitle',
    'descriptionImageOrders',
    '',
    'category',
    'mainNumber',
    'masterSku',
    'carousel',
    ''
  ]);

  const COMMON_FIELD_HELP_TEXTS = Object.freeze({
    category: '\u53ef\u5728\u6a21\u677f\u7684 Sheet2 \u67e5\u770b\u7c7b\u76eeID\uff1b\u4e0d\u586b\u5199\u65f6\uff0c\u5999\u624b\u4f1a\u81ea\u52a8\u5339\u914d\u7c7b\u76ee\u3002',
    title: '\u5fc5\u586b\u3002\u540c\u4e00 SPU \u4e0b\u7684\u4ea7\u54c1\u6807\u9898\u8bf7\u4fdd\u6301\u4e00\u81f4\u3002',
    englishTitle: '\u5fc5\u586b\u3002\u540c\u4e00 SPU \u4e0b\u7684\u82f1\u6587\u6807\u9898\u8bf7\u4fdd\u6301\u4e00\u81f4\u3002',
    description: '\u652f\u6301\u586b\u5199\u6587\u5b57\u548c\u56fe\u7247 URL\uff1b\u56fe\u7247 URL \u4e0e\u6587\u5b57\u8bf7\u6362\u884c\u5206\u9694\u3002',
    delivery: '\u56fa\u5b9a\u9009\u62e9 1\u30012 \u6216 9\u3002',
    origin: '\u586b\u5199\u4ea7\u5730\u540d\u79f0\uff1b\u5982\u4e3a\u4e2d\u56fd\uff0c\u53ef\u5199\u201c\u4e2d\u56fd+\u7701\u4efd\u201d\u3002',
    isCustom: '\u586b\u5199\u201c\u662f\u201d\u6216\u201c\u5426\u201d\u3002',
    specValueOne: '\u652f\u6301\u591a SKU\uff0c\u4e00\u884c\u4e00\u4e2a\u89c4\u683c\u503c\uff0c\u5bfc\u51fa\u65f6\u4f1a\u6309\u884c\u5c55\u5f00\u3002',
    specValueTwo: '\u652f\u6301\u591a SKU\uff0c\u4e00\u884c\u4e00\u4e2a\u89c4\u683c\u503c\uff0c\u5bfc\u51fa\u65f6\u4f1a\u6309\u884c\u5c55\u5f00\u3002',
    declaredPrice: '\u5fc5\u586b\uff0c\u6700\u591a\u4fdd\u7559\u4e24\u4f4d\u5c0f\u6570\u3002',
    price: '\u6700\u591a\u4fdd\u7559\u4e24\u4f4d\u5c0f\u6570\u3002',
    length: '\u5fc5\u586b\uff0c\u6700\u591a\u4fdd\u7559\u4e24\u4f4d\u5c0f\u6570\u3002',
    width: '\u5fc5\u586b\uff0c\u6700\u591a\u4fdd\u7559\u4e24\u4f4d\u5c0f\u6570\u3002',
    height: '\u5fc5\u586b\uff0c\u6700\u591a\u4fdd\u7559\u4e24\u4f4d\u5c0f\u6570\u3002',
    weight: '\u5fc5\u586b\u3002',
    stock: '\u5982\u9009\u62e9\u591a\u4e2a\u4ed3\u5e93\uff0c\u5219\u6bcf\u4e2a\u4ed3\u5e93\u90fd\u4f7f\u7528\u8fd9\u4e2a\u5e93\u5b58\u503c\u3002',
    skuImage: '\u9009\u62e9\u5f53\u524d SKU \u5bf9\u5e94\u7684\u8f6e\u64ad\u56fe\u5e8f\u53f7\uff0c\u4f8b\u5982 1 \u8868\u793a\u7b2c 1 \u5f20\u3002',
    platformSku: '\u53ef\u6309\u5e73\u53f0\u8981\u6c42\u586b\u5199\u3002',
    skuCategoryType: '\u586b\u5199\u5355\u54c1\u3001\u7ec4\u5408\u88c5\u6216\u6df7\u5408\u5957\u88c5\u3002',
    skuCategoryCount: '\u586b\u5199\u5206\u7c7b\u6570\u91cf\u3002',
    skuCategoryUnit: '\u586b\u5199\u5355\u4f4d\uff0c\u5982 \u4ef6\u3001\u53cc\u3001\u5305\u3002',
    independentPackaging: '\u586b\u5199\u201c\u662f\u201d\u6216\u201c\u5426\u201d\uff0c\u4ec5\u7ec4\u5408\u88c5\u6216\u6df7\u5408\u5957\u88c5\u9700\u8981\u65f6\u586b\u5199\u3002',
    descriptionImageOrders: '\u586b\u5199\u8f6e\u64ad\u56fe\u5e8f\u53f7\uff0c\u5982 1,2,3\uff1b\u5bfc\u51fa\u65f6\u4f1a\u6309\u8fd9\u4e9b\u5e8f\u53f7\u5e26\u5165\u4ea7\u54c1\u63cf\u8ff0\u3002',
    packingList: '\u53ef\u5728\u6a21\u677f Sheet3 \u67e5\u770b\u5305\u88c5\u6e05\u5355\u5185\u5bb9\uff0c\u8bf7\u586b\u5199 vid\u3002',
    packingCount: '\u4ec5\u652f\u6301\u5927\u4e8e 0 \u7684\u6574\u6570\u3002',
    productCodeType: '\u53ef\u9009\uff0c\u5982 CN / UPC / EAN / ISBN\u3002',
    mainVideo: '\u89c6\u9891 URL \u4ec5\u652f\u6301\u4e00\u6761\u3002',
    manual: '\u8bf4\u660e\u4e66 URL \u4ec5\u652f\u6301\u4e00\u6761\uff0c\u683c\u5f0f\u5efa\u8bae\u4e3a PDF\u3002',
    sourceLink: '\u8d27\u6e90\u94fe\u63a5\u53ef\u586b\u5199\u591a\u6761\uff0c\u4f7f\u7528\u9017\u53f7\u5206\u9694\u3002',
    mainNumber: '\u540c\u4e00 SPU \u53ef\u586b\u5199\u76f8\u540c\u4e3b\u8d27\u53f7\uff1b\u5de5\u5177\u4f1a\u6309\u5bfc\u5165\u7684\u6587\u4ef6\u5939\u548c\u56fe\u7247\u540d\u81ea\u52a8\u751f\u6210\u4e3b\u8d27\u53f7\u3002',
    assets: '\u4ea7\u54c1\u7d20\u6750\u56fe\u4e3a\u5fc5\u586b\u9879\uff1b\u8fd9\u91cc\u4ec5\u663e\u793a\u5df2\u9009\u62e9\u7684\u56fe\u7247\u6570\u91cf\u3002'
  });

  const TEMPLATE_FIELD_HELP_TEXTS = Object.freeze({
    'non-fashion': Object.freeze({
      specNameOne: '\u5fc5\u586b\uff0c\u586b\u5199\u4e0e TEMU \u540e\u53f0\u4e00\u81f4\u7684\u89c4\u683c\u540d\u79f0\u3002',
      specNameTwo: '\u5fc5\u586b\uff0c\u586b\u5199\u4e0e TEMU \u540e\u53f0\u4e00\u81f4\u7684\u89c4\u683c\u540d\u79f0\u3002',
      productCode: '\u4ec5\u652f\u6301\u6570\u5b57\uff1b\u5de5\u5177\u4f1a\u6309\u4e3b\u8d27\u53f7\u81ea\u52a8\u751f\u6210\u7a33\u5b9a\u7684\u4ea7\u54c1\u7f16\u7801\u3002',
      masterSku: '\u4e3b\u8d27\u53f7\u662f SPU \u7ea7\u522b\uff1b\u540c\u4e00 SPU \u53ea\u53d6\u7b2c\u4e00\u6761\u4e3b\u8d27\u53f7\u3002',
      carousel: '\u4ea7\u54c1\u8f6e\u64ad\u56fe\u4e3a\u5fc5\u586b\u9879\uff0c\u6700\u591a\u5bfc\u51fa\u524d 10 \u5f20\u3002',
      preview: '\u9884\u89c8\u56fe\u4e3a\u5fc5\u586b\u9879\uff0c\u4ec5\u53d6\u7b2c 1 \u5f20\u3002'
    }),
    fashion: Object.freeze({
      specNameOne: '\u5fc5\u586b\uff0c\u586b\u5199\u89c4\u683c\u540d\u79f0\u3002',
      specNameTwo: '\u5fc5\u586b\uff0c\u586b\u5199\u89c4\u683c\u540d\u79f0\u3002',
      productCode: '\u5de5\u5177\u4f1a\u6309\u4e3b\u8d27\u53f7\u81ea\u52a8\u751f\u6210\u7a33\u5b9a\u7684\u4ea7\u54c1\u7f16\u7801\u3002',
      masterSku: '\u4e3b\u8d27\u53f7\u662f SKC \u7ea7\u522b\uff1b\u540c\u4e00 SKC \u53ea\u53d6\u7b2c\u4e00\u6761\u4e3b\u8d27\u53f7\u3002',
      carousel: '\u670d\u9970\u6a21\u677f\u5bfc\u51fa\u65f6\u4f1a\u76f4\u63a5\u4f7f\u7528\u8f6e\u64ad\u56fe\uff0c\u5e76\u6309 SKU \u56fe\u81ea\u52a8\u524d\u7f6e\u53bb\u91cd\u3002',
      preview: '\u670d\u9970\u6a21\u677f\u7684\u989c\u8272\u56fe\u76f4\u63a5\u4f7f\u7528\u8f6e\u64ad\u56fe\uff0c\u8fd9\u91cc\u4ec5\u4f5c\u4e3a\u672c\u5730\u7d20\u6750\u6574\u7406\u5206\u7ec4\u3002'
    })
  });

  const TEMPLATE_UI_COPY = Object.freeze({
    'non-fashion': Object.freeze({
      productListImageLabel: '\u8f6e\u64ad\u56fe',
      descriptionOrderPlaceholder: '\u8f6e\u64ad\u56fe\u5e8f\u53f7\uff0c\u5982 1,2,3',
      carouselButtonLabel: '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u56fe',
      carouselOrderName: '\u8f6e\u64ad\u56fe',
      activeTemplateSummary: '\u5f53\u524d\u6a21\u677f\uff1a\u975e\u670d\u9970\u7c7b\u6a21\u677f\uff1b\u5bfc\u51fa\u4f1a\u4f7f\u7528\u4ea7\u54c1\u8f6e\u64ad\u56fe\u3001\u9884\u89c8\u56fe\u548c\u4e3b\u8d27\u53f7\uff08SPU\u7ea7\uff09\u5b57\u6bb5\u3002',
      carouselPresetTitle: '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u56fe',
      carouselPresetTag: '\u8f6e\u64ad\u56fe',
      carouselPresetCandidateText: '\u4ece\u5df2\u5bfc\u5165\u7684\u5168\u90e8\u56fe\u7247\u540d\u4e2d\u9009\u62e9\u3002',
      carouselPresetSelectedText: '\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u628a\u8fd9\u4e9b\u56fe\u7247\u79fb\u52a8\u5230\u5404\u5546\u54c1\u8f6e\u64ad\u56fe\u524d\u9762\u3002',
      carouselPresetSummary: '\u5171 {count} \u4e2a\u5546\u54c1\uff0c\u53ef\u4ece\u5df2\u5bfc\u5165\u7684\u5168\u90e8\u56fe\u7247\u540d\u91cc\u9009\u62e9\uff1b\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u8c03\u6574\u5404\u5546\u54c1\u7684\u8f6e\u64ad\u56fe\u987a\u5e8f\u3002',
      carouselPresetEmptySelection: '\u52fe\u9009\u5de6\u4fa7\u56fe\u7247\u540d\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u8c03\u6574\u8f6e\u64ad\u56fe\u987a\u5e8f\u3002',
      carouselPresetSaved: '\u5df2\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u56fe',
      descriptionPresetSourceName: '\u8f6e\u64ad\u56fe',
      descriptionPresetSummary: '\u5171 {count} \u4e2a\u5546\u54c1\uff0c\u53ef\u4ece\u5df2\u5bfc\u5165\u7684\u8f6e\u64ad\u56fe\u6587\u4ef6\u540d\u91cc\u9009\u62e9\uff1b\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u5199\u5165\u4ea7\u54c1\u63cf\u8ff0\u3002',
      descriptionPresetEmptyCandidates: '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u9884\u8bbe\u7684\u8f6e\u64ad\u56fe\u6587\u4ef6\u540d\u3002',
      descriptionPresetCandidateText: '\u4ece\u5df2\u5bfc\u5165\u7684\u8f6e\u64ad\u56fe\u6587\u4ef6\u540d\u4e2d\u9009\u62e9\u3002'
    }),
    fashion: Object.freeze({
      productListImageLabel: '\u672c\u5730\u8f6e\u64ad\u7d20\u6750',
      descriptionOrderPlaceholder: '\u8f6e\u64ad\u7d20\u6750\u5e8f\u53f7\uff0c\u5982 1,2,3',
      carouselButtonLabel: '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u7d20\u6750',
      carouselOrderName: '\u8f6e\u64ad\u7d20\u6750',
      activeTemplateSummary: '\u5f53\u524d\u6a21\u677f\uff1a\u670d\u9970\u7c7b\u6a21\u677f\uff1b\u5bfc\u51fa\u4f1a\u4f7f\u7528\u4ea7\u54c1\u7d20\u6750\u56fe\u3001\u989c\u8272\u56fe\u548c\u4e3b\u8d27\u53f7\uff08SKC\u7ea7\uff09\u5b57\u6bb5\uff0c\u989c\u8272\u56fe\u76f4\u63a5\u53d6\u8f6e\u64ad\u56fe\u5e76\u6309 SKU \u56fe\u524d\u7f6e\u53bb\u91cd\u3002',
      carouselPresetTitle: '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u7d20\u6750',
      carouselPresetTag: '\u8f6e\u64ad\u7d20\u6750',
      carouselPresetCandidateText: '\u4ece\u5df2\u5bfc\u5165\u7684\u5168\u90e8\u56fe\u7247\u540d\u4e2d\u9009\u62e9\u3002',
      carouselPresetSelectedText: '\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u628a\u8fd9\u4e9b\u56fe\u7247\u79fb\u52a8\u5230\u5404\u5546\u54c1\u8f6e\u64ad\u7d20\u6750\u524d\u9762\u3002',
      carouselPresetSummary: '\u5171 {count} \u4e2a\u5546\u54c1\uff0c\u53ef\u4ece\u5df2\u5bfc\u5165\u7684\u5168\u90e8\u56fe\u7247\u540d\u91cc\u9009\u62e9\uff1b\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u8c03\u6574\u5404\u5546\u54c1\u7684\u8f6e\u64ad\u7d20\u6750\u987a\u5e8f\u3002',
      carouselPresetEmptySelection: '\u52fe\u9009\u5de6\u4fa7\u56fe\u7247\u540d\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u8c03\u6574\u8f6e\u64ad\u7d20\u6750\u987a\u5e8f\u3002',
      carouselPresetSaved: '\u5df2\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u7d20\u6750',
      descriptionPresetSourceName: '\u8f6e\u64ad\u7d20\u6750',
      descriptionPresetSummary: '\u5171 {count} \u4e2a\u5546\u54c1\uff0c\u53ef\u4ece\u5df2\u5bfc\u5165\u7684\u8f6e\u64ad\u7d20\u6750\u6587\u4ef6\u540d\u91cc\u9009\u62e9\uff1b\u4fdd\u5b58\u540e\u4f1a\u6279\u91cf\u5199\u5165\u4ea7\u54c1\u63cf\u8ff0\u3002',
      descriptionPresetEmptyCandidates: '\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u9884\u8bbe\u7684\u8f6e\u64ad\u7d20\u6750\u6587\u4ef6\u540d\u3002',
      descriptionPresetCandidateText: '\u4ece\u5df2\u5bfc\u5165\u7684\u8f6e\u64ad\u7d20\u6750\u6587\u4ef6\u540d\u4e2d\u9009\u62e9\u3002'
    })
  });

  function createAiTitleProgressSnapshot(overrides = {}) {
    return {
      runId: normalizeText(overrides.runId),
      runState: normalizeText(overrides.runState) || 'idle',
      totalCount: Math.max(0, Number(overrides.totalCount) || 0),
      completedCount: Math.max(0, Number(overrides.completedCount) || 0),
      successCount: Math.max(0, Number(overrides.successCount) || 0),
      failedCount: Math.max(0, Number(overrides.failedCount) || 0),
      canceledCount: Math.max(0, Number(overrides.canceledCount) || 0),
      productId: normalizeText(overrides.productId),
      label: normalizeText(overrides.label),
      updatedAt: normalizeText(overrides.updatedAt)
    };
  }

  function createCosUploadProgressSnapshot(overrides = {}) {
    return {
      runState: normalizeText(overrides.runState) || 'idle',
      updatedAt: normalizeText(overrides.updatedAt),
      totalCount: Math.max(0, Number(overrides.totalCount) || 0),
      completedCount: Math.max(0, Number(overrides.completedCount) || 0),
      successCount: Math.max(0, Number(overrides.successCount) || 0),
      uploadedCount: Math.max(0, Number(overrides.uploadedCount) || 0),
      cachedCount: Math.max(0, Number(overrides.cachedCount) || 0),
      failedCount: Math.max(0, Number(overrides.failedCount) || 0),
      canceledCount: Math.max(0, Number(overrides.canceledCount) || 0),
      canceled: Boolean(overrides.canceled),
      label: normalizeText(overrides.label)
    };
  }

  const state = {
    snapshot: {
      updatedAt: '',
      templates: []
    },
    formTemplateSnapshot: {
      updatedAt: '',
      templates: []
    },
    loadingSnapshot: false,
    syncingSnapshot: false,
    exportingTable: false,
    uploadingCosImages: false,
    stoppingCosImages: false,
    cosUploadRunId: '',
    cosUploadStopGuardUntil: 0,
    cosUploadStopGuardTimer: 0,
    cosUploadProgressPollTimer: 0,
    cosUploadSnapshot: createCosUploadProgressSnapshot(),
    eventsBound: false,
    lastCosUploadButtonEventStamp: 0,
    lastAiTitleButtonEventStamp: 0,
    loadingFormTemplateSnapshot: true,
    savingFormTemplate: false,
    deletingFormTemplate: false,
    loadingWorkspaceState: true,
    workspaceStateHydrated: false,
    savingWorkspaceState: false,
    workspaceStateSaveTimer: 0,
    workspaceStateSavePromise: null,
    lastImportDirectoryPath: '',
    imageUploadMode: 'original',
    aiTitlePrefix: '',
    aiTitleSuffix: '',
    aiTitleExtraPrompt: '',
    aiTitleMaxLength: '',
    generatingAiTitles: false,
    stoppingAiTitles: false,
    retryingFailedAiTitles: false,
    aiTitleRunId: '',
    aiTitleProgress: createAiTitleProgressSnapshot(),
    removeAiTitleProgressListener: null,
    selectedFormTemplateId: '',
    formTemplateDropdownOpen: false,
    globalProductSettings: {
      ...DEFAULT_GLOBAL_PRODUCT_SETTINGS,
      skuConfigMap: {}
    },
    products: [],
    activeProductId: '',
    carouselPresetModalOpen: false,
    carouselPresetMode: 'selected',
    carouselPresetSelectionDraft: [],
    carouselPresetRandomOrdersDraft: '',
    carouselPresetCachedMode: 'selected',
    carouselPresetCachedSelection: [],
    carouselPresetCachedRandomOrders: '',
    descriptionPresetModalOpen: false,
    descriptionPresetSelectionDraft: [],
    descriptionPresetCachedSelection: [],
    windowNoticeTimer: 0
  };
  let categoryOptions = [];

  function createSkuConfigEntry(overrides = {}) {
    return SKU_CONFIG_FIELD_NAMES.reduce((entry, fieldName) => {
      entry[fieldName] = normalizeSkuConfigFieldValue(fieldName, overrides[fieldName]);
      return entry;
    }, {});
  }

  function getCategoryOptionById(categoryId) {
    const normalizedCategoryId = normalizeText(categoryId);
    return categoryOptions.find((option) => option.id === normalizedCategoryId) || null;
  }

  function getCategoryOptionByLabel(categoryLabel) {
    const normalizedCategoryLabel = normalizeText(categoryLabel);
    return categoryOptions.find((option) => {
      return (
        option.label === normalizedCategoryLabel
        || normalizedCategoryLabel.includes(option.label)
        || option.label.includes(normalizedCategoryLabel)
      );
    }) || null;
  }

  function normalizeCategoryId(value) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return categoryOptions[0] ? categoryOptions[0].id : DEFAULT_CATEGORY_OPTION.id;
    }

    if (getCategoryOptionById(normalizedValue)) {
      return normalizedValue;
    }

    const leadingIdMatch = normalizedValue.match(/^(\d{4,})\s+/);

    if (leadingIdMatch && getCategoryOptionById(leadingIdMatch[1])) {
      return leadingIdMatch[1];
    }

    const matchedByLabel = getCategoryOptionByLabel(normalizedValue);

    if (matchedByLabel) {
      return matchedByLabel.id;
    }

    return normalizedValue;
  }

  function getCategoryLabel(value) {
    const normalizedValue = normalizeText(value);
    const matchedById = getCategoryOptionById(normalizedValue);

    if (matchedById) {
      return matchedById.label;
    }

    const leadingIdMatch = normalizedValue.match(/^(\d{4,})\s+/);

    if (leadingIdMatch) {
      const matchedByLeadingId = getCategoryOptionById(leadingIdMatch[1]);

      if (matchedByLeadingId) {
        return matchedByLeadingId.label;
      }
    }

    const matchedByLabel = getCategoryOptionByLabel(normalizedValue);

    return matchedByLabel ? matchedByLabel.label : normalizedValue;
  }

  function getCategoryDisplayText(value) {
    const categoryId = normalizeCategoryId(value);
    const categoryLabel = getCategoryLabel(value);

    if (getCategoryOptionById(categoryId) && categoryLabel) {
      return `${categoryId} ${categoryLabel}`;
    }

    return categoryLabel || categoryId || '-';
  }

  function normalizeTemplateId(value) {
    return normalizeText(value) === 'fashion' ? 'fashion' : 'non-fashion';
  }

  function normalizeSkuConfigMap(source) {
    if (!source || typeof source !== 'object') {
      return {};
    }

    return Object.entries(source).reduce((result, [key, value]) => {
      const normalizedKey = normalizeText(key);

      if (!normalizedKey) {
        return result;
      }

      result[normalizedKey] = createSkuConfigEntry(value);
      return result;
    }, {});
  }

  function cloneSkuConfigMap(source) {
    return normalizeSkuConfigMap(source);
  }

  function normalizeFormTemplateFieldValue(fieldName, value) {
    return GLOBAL_PRODUCT_FIELD_NAMES.includes(fieldName)
      ? normalizeGlobalProductFieldValue(fieldName, value)
      : normalizeText(value);
  }

  function normalizeFormTemplateRecord(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const templateId = normalizeText(record.id);
    const templateName = normalizeText(record.name);

    if (!templateId || !templateName) {
      return null;
    }

    const fields = FORM_TEMPLATE_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(
        fieldName,
        record.fields && record.fields[fieldName]
      );
      return result;
    }, {});

    return {
      id: templateId,
      name: templateName,
      createdAt: normalizeText(record.createdAt),
      updatedAt: normalizeText(record.updatedAt),
      fields,
      skuConfigMap: cloneSkuConfigMap(record.skuConfigMap),
      batchPreset: Object.prototype.hasOwnProperty.call(record, 'batchPreset')
        ? normalizeFormTemplateBatchPreset(record.batchPreset)
        : null
    };
  }

  function normalizeFormTemplateSnapshot(snapshot) {
    const templates = Array.isArray(snapshot && snapshot.templates)
      ? snapshot.templates.map(normalizeFormTemplateRecord).filter(Boolean)
      : [];

    return {
      updatedAt: normalizeText(snapshot && snapshot.updatedAt),
      templates
    };
  }

  function normalizeWorkspaceStateSnapshot(snapshot) {
    const workspaceSource =
      snapshot && snapshot.workspace && typeof snapshot.workspace === 'object' && !Array.isArray(snapshot.workspace)
        ? snapshot.workspace
        : {};

    return {
      updatedAt: normalizeText(snapshot && snapshot.updatedAt),
      lastImportDirectoryPath: normalizeText(
        workspaceSource.lastImportDirectoryPath
        || workspaceSource.lastImportPath
        || workspaceSource.importDirectoryPath
      ),
      imageUploadMode: normalizeImageUploadMode(
        workspaceSource.imageUploadMode
        || workspaceSource.uploadImageMode
      ),
      carouselPresetMode: normalizeCachedCarouselPresetMode(
        workspaceSource.carouselPresetMode
        || workspaceSource.cachedCarouselPresetMode
      ),
      carouselPresetRandomOrders: normalizeSequenceSelection(
        workspaceSource.carouselPresetRandomOrders
        || workspaceSource.cachedCarouselPresetRandomOrders
      ),
      carouselPresetSelection: normalizeCachedPresetSelection(
        workspaceSource.carouselPresetSelection
        || workspaceSource.cachedCarouselPresetSelection
      ),
      descriptionPresetSelection: normalizeCachedPresetSelection(
        workspaceSource.descriptionPresetSelection
        || workspaceSource.cachedDescriptionPresetSelection
      )
    };
  }

  function normalizeImageUploadMode(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    return IMAGE_UPLOAD_MODE_OPTIONS.includes(normalizedValue) ? normalizedValue : 'original';
  }

  function normalizeCachedCarouselPresetMode(value) {
    return normalizeText(value) === 'random-first' ? 'random-first' : 'selected';
  }

  function normalizeCachedPresetSelection(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => getMaterialNameKey(item))
      .filter((item, index, items) => item && items.indexOf(item) === index);
  }

  function getPreferredPresetSelection(candidates, cachedSelection, seedSelection) {
    const candidateMap = getCarouselPresetCandidateMap(candidates);
    const preferredSelection = normalizeCachedPresetSelection(cachedSelection)
      .filter((key) => candidateMap.has(key));

    if (preferredSelection.length) {
      return preferredSelection;
    }

    return normalizeCachedPresetSelection(seedSelection)
      .filter((key) => candidateMap.has(key));
  }

  function buildWorkspaceStatePayload() {
    return {
      lastImportDirectoryPath: normalizeText(state.lastImportDirectoryPath),
      imageUploadMode: normalizeImageUploadMode(state.imageUploadMode),
      carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetCachedRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetCachedSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
    };
  }

  function buildCurrentFormTemplateBatchPreset() {
    if (state.carouselPresetModalOpen) {
      return {
        carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetMode),
        carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft),
        carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetSelectionDraft),
        descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
      };
    }

    return {
      carouselPresetMode: normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(state.carouselPresetCachedRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(state.carouselPresetCachedSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(state.descriptionPresetCachedSelection)
    };
  }

  function normalizeFormTemplateBatchPreset(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

    return {
      carouselPresetMode: normalizeCachedCarouselPresetMode(source.carouselPresetMode || source.cachedCarouselPresetMode),
      carouselPresetRandomOrders: normalizeSequenceSelection(source.carouselPresetRandomOrders || source.cachedCarouselPresetRandomOrders),
      carouselPresetSelection: normalizeCachedPresetSelection(source.carouselPresetSelection || source.cachedCarouselPresetSelection),
      descriptionPresetSelection: normalizeCachedPresetSelection(source.descriptionPresetSelection || source.cachedDescriptionPresetSelection)
    };
  }

  function applyFormTemplateBatchPreset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }

    const batchPreset = normalizeFormTemplateBatchPreset(value);

    state.carouselPresetCachedMode = batchPreset.carouselPresetMode;
    state.carouselPresetCachedRandomOrders = batchPreset.carouselPresetRandomOrders;
    state.carouselPresetCachedSelection = batchPreset.carouselPresetSelection;
    state.descriptionPresetCachedSelection = batchPreset.descriptionPresetSelection;
    scheduleWorkspaceStateSave();
  }

  function persistCachedCarouselPresetState(options = {}) {
    state.carouselPresetCachedMode = normalizeCachedCarouselPresetMode(state.carouselPresetMode);
    state.carouselPresetCachedSelection = normalizeCachedPresetSelection(state.carouselPresetSelectionDraft);
    state.carouselPresetCachedRandomOrders = normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft);
    scheduleWorkspaceStateSave(options);
  }

  function persistCachedPresetSelection(fieldName, value, options = {}) {
    state[fieldName] = normalizeCachedPresetSelection(value);
    scheduleWorkspaceStateSave(options);
  }

  async function saveWorkspaceState(options = {}) {
    const { showErrorNotice = false, syncLatest = false } = options;

    if (!state.workspaceStateHydrated) {
      return null;
    }

    state.workspaceStateSavePromise = (state.workspaceStateSavePromise || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        state.savingWorkspaceState = true;

        try {
          return await getFeatureCenterBridge().savePodUploadSheetMiaoshouWorkspaceState({
            workspace: buildWorkspaceStatePayload()
          });
        } catch (error) {
          if (showErrorNotice) {
            showWindowNotice(
              `\u5de5\u4f5c\u533a\u7f13\u5b58\u4fdd\u5b58\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`,
              'warning'
            );
          }
          return null;
        } finally {
          state.savingWorkspaceState = false;
        }
      });

    return state.workspaceStateSavePromise;
  }

  function scheduleWorkspaceStateSave(options = {}) {
    const { immediate = false, showErrorNotice = false } = options;

    if (!state.workspaceStateHydrated) {
      return;
    }

    window.clearTimeout(state.workspaceStateSaveTimer);
    state.workspaceStateSaveTimer = 0;

    if (immediate) {
      void saveWorkspaceState({
        showErrorNotice
      });
      return;
    }

    state.workspaceStateSaveTimer = window.setTimeout(() => {
      state.workspaceStateSaveTimer = 0;
      void saveWorkspaceState({
        showErrorNotice
      });
    }, 400);
  }

  async function loadWorkspaceState(options = {}) {
    const { showErrorNotice = false, syncLatest = false } = options;

    state.loadingWorkspaceState = true;

    try {
      const snapshot = normalizeWorkspaceStateSnapshot(
        await getFeatureCenterBridge().getPodUploadSheetMiaoshouWorkspaceState()
      );

      state.lastImportDirectoryPath = snapshot.lastImportDirectoryPath;
      state.imageUploadMode = snapshot.imageUploadMode;
      state.carouselPresetCachedMode = snapshot.carouselPresetMode;
      state.carouselPresetCachedRandomOrders = snapshot.carouselPresetRandomOrders;
      state.carouselPresetCachedSelection = snapshot.carouselPresetSelection;
      state.descriptionPresetCachedSelection = snapshot.descriptionPresetSelection;
      renderAll();
    } catch (error) {
      if (syncLatest) {
        try {
          state.snapshot = await getFeatureCenterBridge().getPodUploadSheetMiaoshouTemplateSnapshot();
        } catch (snapshotError) {
          if (showErrorNotice) {
            showWindowNotice(
              '模板状态读取失败：' + (normalizeText(snapshotError && snapshotError.message) || '请稍后重试'),
              'danger'
            );
          }
        }
      } else if (showErrorNotice) {
        showWindowNotice(
          `\u5de5\u4f5c\u533a\u7f13\u5b58\u8bfb\u53d6\u5931\u8d25\uff1a${normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'}`,
          'warning'
        );
      }
    } finally {
      state.loadingWorkspaceState = false;
      state.workspaceStateHydrated = true;
    }
  }

  function buildCurrentFormTemplateFields() {
    return FORM_TEMPLATE_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(
        fieldName,
        GLOBAL_PRODUCT_FIELD_NAMES.includes(fieldName)
          ? state.globalProductSettings[fieldName]
          : state[fieldName]
      );
      return result;
    }, {});
  }

  function areFieldSetsEqual(leftFields, rightFields) {
    return FORM_TEMPLATE_FIELD_NAMES.every((fieldName) => {
      return normalizeFormTemplateFieldValue(fieldName, leftFields && leftFields[fieldName])
        === normalizeFormTemplateFieldValue(fieldName, rightFields && rightFields[fieldName]);
    });
  }

  function areSkuConfigMapsEqual(leftMap, rightMap) {
    const normalizedLeftMap = normalizeSkuConfigMap(leftMap);
    const normalizedRightMap = normalizeSkuConfigMap(rightMap);
    const leftKeys = Object.keys(normalizedLeftMap).sort();
    const rightKeys = Object.keys(normalizedRightMap).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key, index) => {
      if (key !== rightKeys[index]) {
        return false;
      }

      return SKU_CONFIG_FIELD_NAMES.every((fieldName) => {
        return normalizeText(normalizedLeftMap[key] && normalizedLeftMap[key][fieldName])
          === normalizeText(normalizedRightMap[key] && normalizedRightMap[key][fieldName]);
      });
    });
  }

  function hasNonDefaultFormTemplateContent() {
    return (
      !areFieldSetsEqual(buildCurrentFormTemplateFields(), DEFAULT_FORM_TEMPLATE_FIELDS)
      || !areSkuConfigMapsEqual(state.globalProductSettings.skuConfigMap, {})
    );
  }

  function shouldConfirmBeforeApplyingFormTemplate(template) {
    if (!template || !hasNonDefaultFormTemplateContent()) {
      return false;
    }

    return (
      !areFieldSetsEqual(buildCurrentFormTemplateFields(), template.fields)
      || !areSkuConfigMapsEqual(state.globalProductSettings.skuConfigMap, template.skuConfigMap)
    );
  }

  function buildSkuRowKey(specValueOne, specValueTwo) {
    return `${normalizeText(specValueOne)}__temu_toolbox__${normalizeText(specValueTwo)}`;
  }

  function getSkuCombinationRows(source = state.globalProductSettings) {
    const specValueOneItems = getSkuValueItems(source && source.specValueOne);
    const specValueTwoItems = getSkuValueItems(source && source.specValueTwo);

    if (!specValueOneItems.length && !specValueTwoItems.length) {
      return [];
    }

    const leftItems = specValueOneItems.length ? specValueOneItems : [''];
    const rightItems = specValueTwoItems.length ? specValueTwoItems : [''];

    return leftItems.flatMap((leftValue) => {
      return rightItems.map((rightValue) => {
        return {
          key: buildSkuRowKey(leftValue, rightValue),
          specValueOne: leftValue,
          specValueTwo: rightValue
        };
      });
    });
  }

  function buildDefaultSkuConfig(source = state.globalProductSettings) {
    return createSkuConfigEntry({
      declaredPrice: normalizeText(source && source.declaredPrice),
      price: normalizeText(source && source.price),
      length: normalizeText(source && source.length),
      width: normalizeText(source && source.width),
      height: normalizeText(source && source.height),
      weight: normalizeText(source && source.weight),
      stock: normalizeText(source && source.stock),
      platformSku: normalizeText(source && source.platformSku)
    });
  }

  function syncSkuConfigMapWithCurrentSpecs(source = state.globalProductSettings) {
    const existingMap = normalizeSkuConfigMap(source && source.skuConfigMap);
    const defaultConfig = buildDefaultSkuConfig(source);
    const nextMap = {};

    getSkuCombinationRows(source).forEach((row) => {
      nextMap[row.key] = createSkuConfigEntry({
        ...defaultConfig,
        ...(existingMap[row.key] || {})
      });
    });

    source.skuConfigMap = nextMap;
    return nextMap;
  }

  function getSkuEditorRows(source = state.globalProductSettings) {
    const nextMap = syncSkuConfigMapWithCurrentSpecs(source);

    return getSkuCombinationRows(source).map((row) => {
      return {
        ...row,
        ...createSkuConfigEntry(nextMap[row.key])
      };
    });
  }

  function getFeatureCenterBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouTemplateSnapshot === 'function'
      && typeof window.temuApp.featureCenter.syncPodUploadSheetMiaoshouTemplates === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouCategories === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouFormTemplates === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouFormTemplate === 'function'
      && typeof window.temuApp.featureCenter.deletePodUploadSheetMiaoshouFormTemplate === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouWorkspaceState === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouWorkspaceState === 'function'
      && typeof window.temuApp.featureCenter.selectPodUploadSheetMiaoshouImportDirectory === 'function'
      && typeof window.temuApp.featureCenter.exportPodUploadSheetMiaoshouTable === 'function'
      && typeof window.temuApp.featureCenter.uploadPodUploadSheetMiaoshouCosImages === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouCosImages === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouAiTitleConfig === 'function'
      && typeof window.temuApp.featureCenter.savePodUploadSheetMiaoshouAiTitleConfig === 'function'
      && typeof window.temuApp.featureCenter.generatePodUploadSheetMiaoshouAiTitles === 'function'
      && typeof window.temuApp.featureCenter.onPodUploadSheetMiaoshouAiTitleProgress === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouAiTitles === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    throw new Error('\u672a\u627e\u5230 POD \u4e0a\u8d27\u8868\u683c\uff08\u5999\u624b\u7248\uff09\u7684\u6e32\u67d3\u8fdb\u7a0b\u6865\u63a5\u63a5\u53e3');
  }

  function getFeatureCenterCosUploadBridge() {
    if (
      window.temuApp
      && window.temuApp.featureCenter
      && typeof window.temuApp.featureCenter.uploadPodUploadSheetMiaoshouCosImages === 'function'
      && typeof window.temuApp.featureCenter.cancelPodUploadSheetMiaoshouCosImages === 'function'
      && typeof window.temuApp.featureCenter.getPodUploadSheetMiaoshouCosUploadProgressSnapshot === 'function'
    ) {
      return window.temuApp.featureCenter;
    }

    throw new Error('\u672a\u627e\u5230 POD \u4e0a\u8d27\u8868\u683c\uff08\u5999\u624b\u7248\uff09\u7684\u56fe\u7247\u4e0a\u4f20\u6865\u63a5\u63a5\u53e3');
  }

  function getDialogBridge() {
    if (
      window.temuApp
      && window.temuApp.dialogs
      && typeof window.temuApp.dialogs.confirm === 'function'
    ) {
      return window.temuApp.dialogs;
    }

    throw new Error('\u672a\u627e\u5230\u901a\u7528\u786e\u8ba4\u5f39\u7a97\u6865\u63a5\u63a5\u53e3');
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function trimTitleTail(value) {
    let result = normalizeText(value).replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    const tailMatch = result.match(/([A-Za-z]{1,2})$/u);
    const previousCharacter = tailMatch ? result.slice(0, -tailMatch[1].length).slice(-1) : '';

    if (tailMatch && /[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]/u.test(previousCharacter)) {
      result = result.slice(0, -tailMatch[1].length)
        .replace(/[\s,\uFF0C\u3001;\uFF1B:\uFF1A/|\\\-\u2013\u2014_+()[\]{}<>\u300A\u300B"'\u201C\u201D\u2018\u2019]+$/u, '');
    }

    return result.trim();
  }

  function normalizeTitleFieldValue(value) {
    const normalizedValue = normalizeText(value);
    const characters = Array.from(normalizedValue);

    if (characters.length <= TITLE_MAX_LENGTH) {
      return normalizedValue;
    }

    return trimTitleTail(characters.slice(0, TITLE_MAX_LENGTH).join(''));
  }

  function normalizeDigitsOnlyText(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function normalizeDeliveryValue(value) {
    const text = normalizeText(value);

    if (DELIVERY_OPTION_VALUES.includes(text)) {
      return text;
    }

    if (text.includes('24') || text.includes('24h') || text == '1') {
      return '1';
    }

    if (text.includes('48') || text.includes('48h') || text == '2') {
      return '2';
    }

    if (text.includes('9')) {
      return '9';
    }

    const digits = normalizeDigitsOnlyText(text);
    return DELIVERY_OPTION_VALUES.includes(digits) ? digits : DEFAULT_PRODUCT_FIELDS.delivery;
  }

  function normalizeProductCodeValue(value) {
    return normalizeDigitsOnlyText(value);
  }

  function normalizeGlobalProductFieldValue(fieldName, value) {
    if (fieldName === 'category') {
      return normalizeCategoryId(value);
    }

    if (fieldName === 'delivery') {
      return normalizeDeliveryValue(value);
    }

    if (fieldName === 'codeValue') {
      return normalizeProductCodeValue(value);
    }

    if (['specValueOne', 'specValueTwo'].includes(fieldName)) {
      return normalizeSkuMultilineValue(value);
    }

    return normalizeText(value);
  }

  function buildStableNumericProductCode(seedText) {
    const normalizedSeed = normalizeText(seedText);

    if (!normalizedSeed) {
      return '';
    }

    let hash = 0;

    for (const character of normalizedSeed) {
      hash = (hash * 131 + character.codePointAt(0)) % PRODUCT_CODE_HASH_RANGE;
    }

    return String(Math.trunc(hash) + PRODUCT_CODE_HASH_BASE);
  }

  function normalizePositiveIntegerString(value) {
    const text = normalizeText(value);

    if (!text || !/^\d+$/.test(text)) {
      return '';
    }

    const numericValue = Number.parseInt(text, 10);

    return numericValue > 0 ? String(numericValue) : '';
  }

  function normalizeSkuConfigFieldValue(fieldName, value) {
    return fieldName === 'skuImage'
      ? normalizePositiveIntegerString(value)
      : normalizeText(value);
  }

  function normalizeSequenceSelection(value) {
    const values = String(value || '')
      .replace(/\r\n/g, '\n')
      .split(/[\n,;\uFF0C\u3001\uFF1B\s]+/)
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return Array.from(new Set(values)).join(',');
  }

  function parseSequenceSelectionNumbers(value) {
    return normalizeSequenceSelection(value)
      .split(',')
      .map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  function normalizeSkuMultilineValue(value) {
    return String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[,\uFF0C\u3001]+/g, '\n')
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n');
  }

  function getSkuValueItems(value) {
    return normalizeSkuMultilineValue(value)
      .split('\n')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function getSkuValueSummary(product) {
    const skuValueOneCount = getSkuValueItems(product && product.specValueOne).length;
    const skuValueTwoCount = getSkuValueItems(product && product.specValueTwo).length;

    if (!skuValueOneCount && !skuValueTwoCount) {
      return '\u672a\u914d\u7f6e SKU';
    }

    if (skuValueOneCount && skuValueTwoCount) {
      return `瑙勬牸 ${skuValueOneCount} x ${skuValueTwoCount}`;
    }

    return `瑙勬牸 ${skuValueOneCount || skuValueTwoCount}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      throw new Error(`\u7f3a\u5c11\u754c\u9762\u8282\u70b9\uff1a${id}`);
    }

    return element;
  }

  function getActiveProduct() {
    return state.products.find((product) => product.id === state.activeProductId) || null;
  }

  function getMaterialItems(product, sectionId) {
    return product && product.materials && Array.isArray(product.materials[sectionId])
      ? product.materials[sectionId].slice()
      : [];
  }

  function getCarouselItems(product) {
    return getMaterialItems(product, 'carousel');
  }

  function getMaterialNameHelper() {
    return window.podUploadSheetMiaoshouImageName || null;
  }

  function getMaterialNameKey(value) {
    const helper = getMaterialNameHelper();

    if (helper && typeof helper.normalizeMaterialNameKey === 'function') {
      return helper.normalizeMaterialNameKey(value);
    }

    return normalizeText(value).toLowerCase();
  }

  function getLegacyMaterialNameKey(value) {
    return normalizeText(getReferenceBaseName(value))
      .replace(/\.[^.]+$/, '')
      .toLowerCase();
  }

  function normalizeImportedMaterialName(fileName, context = {}) {
    const helper = getMaterialNameHelper();

    if (helper && typeof helper.normalizeMaterialDisplayName === 'function') {
      return helper.normalizeMaterialDisplayName(fileName, context);
    }

    return normalizeText(fileName);
  }

  function getUniqueMaterialItems(items) {
    const seenKeys = new Set();

    return (Array.isArray(items) ? items : []).reduce((result, item) => {
      const normalizedItemName = normalizeText(item);
      const key = getMaterialNameKey(normalizedItemName);

      if (!key || seenKeys.has(key)) {
        return result;
      }

      seenKeys.add(key);
      result.push(normalizedItemName);
      return result;
    }, []);
  }

  function getAllMaterialItems(product) {
    const materials = product && product.materials && typeof product.materials === 'object'
      ? product.materials
      : {};

    return getUniqueMaterialItems(
      MATERIAL_SECTIONS.reduce((result, section) => {
        const items = Array.isArray(materials[section.id]) ? materials[section.id] : [];
        result.push(...items.map((item) => normalizeText(item)).filter(Boolean));
        return result;
      }, [])
    );
  }

  function getCarouselPresetCandidates() {
    const candidateMap = new Map();

    state.products.forEach((product) => {
      const matchedKeys = new Set();

      getAllMaterialItems(product).forEach((itemName) => {
        const key = getMaterialNameKey(itemName);
        const displayName = getCarouselItemDisplayName(product, itemName) || itemName;

        if (!key) {
          return;
        }

        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            key,
            label: displayName,
            displayNames: [displayName],
            productCount: 0
          });
        } else {
          const candidate = candidateMap.get(key);

          if (candidate.displayNames.indexOf(displayName) < 0) {
            candidate.displayNames.push(displayName);
          }
        }

        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          candidateMap.get(key).productCount += 1;
        }
      });
    });

    return Array.from(candidateMap.values()).sort((left, right) => {
      return left.label.localeCompare(right.label, 'zh-CN', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function getCarouselPresetCandidateMap(candidates = getCarouselPresetCandidates()) {
    return (Array.isArray(candidates) ? candidates : []).reduce((result, candidate) => {
      result.set(candidate.key, candidate);
      return result;
    }, new Map());
  }

  function getCarouselPresetSeedKeys(candidates = getCarouselPresetCandidates()) {
    const availableKeys = new Set((Array.isArray(candidates) ? candidates : []).map((item) => item.key));
    const preferredProducts = [];
    const activeProduct = getActiveProduct();

    if (activeProduct) {
      preferredProducts.push(activeProduct);
    }

    state.products.forEach((product) => {
      if (!product || product.id === (activeProduct && activeProduct.id)) {
        return;
      }

      preferredProducts.push(product);
    });

    for (const product of preferredProducts) {
      const seedKeys = getCarouselItems(product)
        .map((itemName) => getMaterialNameKey(itemName))
        .filter((key, index, items) => key && availableKeys.has(key) && items.indexOf(key) === index);

      if (seedKeys.length) {
        return seedKeys;
      }
    }

    return [];
  }

  function getCarouselOrdersByItemNames(carouselItems, itemNames) {
    const normalizedCarouselItems = getUniqueMaterialItems(
      (Array.isArray(carouselItems) ? carouselItems : []).map((item) => normalizeText(item)).filter(Boolean)
    );

    return Array.from(new Set(
      (Array.isArray(itemNames) ? itemNames : []).reduce((result, itemName) => {
        const key = getMaterialNameKey(itemName);
        const matchIndex = normalizedCarouselItems.findIndex((candidate) => getMaterialNameKey(candidate) === key);

        if (matchIndex >= 0) {
          result.push(String(matchIndex + 1));
        }

        return result;
      }, [])
    )).join(',');
  }

  function mergeMaterialItemsWithPriority(priorityItems, fallbackItems) {
    return getUniqueMaterialItems([
      ...(Array.isArray(priorityItems) ? priorityItems : []),
      ...(Array.isArray(fallbackItems) ? fallbackItems : [])
    ]);
  }

  function applyCarouselPresetToProduct(product, selectedKeys) {
    if (!product || typeof product !== 'object') {
      return {
        matched: false,
        updated: false
      };
    }

    const previousMaterials = {
      carousel: getUniqueMaterialItems(getCarouselItems(product)),
      assets: getUniqueMaterialItems(getMaterialItems(product, 'assets')),
      preview: getUniqueMaterialItems(getMaterialItems(product, 'preview'))
    };
    const previousDescriptionImageOrders = normalizeText(product.descriptionImageOrders);
    const previousDescriptionItems = getSelectedCarouselItemsByOrders(product, previousDescriptionImageOrders)
      .map((item) => normalizeText(item && item.name))
      .filter(Boolean);
    const previousSkuConfigMap = cloneSkuConfigMap(product.skuConfigMap);
    const previousSkuImageNameMap = Object.entries(previousSkuConfigMap).reduce((result, [rowKey, entry]) => {
      const orderText = normalizePositiveIntegerString(entry && entry.skuImage);
      const imageName = orderText ? previousMaterials.carousel[Number.parseInt(orderText, 10) - 1] || '' : '';
      result[rowKey] = normalizeText(imageName);
      return result;
    }, {});
    const selectedItems = (Array.isArray(selectedKeys) ? selectedKeys : []).reduce((result, key) => {
      const match = getAllMaterialItems(product).find((itemName) => getMaterialNameKey(itemName) === key);

      if (match) {
        result.push(match);
      }

      return result;
    }, []);
    const selectedKeySet = new Set(selectedItems.map((itemName) => getMaterialNameKey(itemName)).filter(Boolean));
    const removedCarouselItems = previousMaterials.carousel.filter((itemName) => {
      return !selectedKeySet.has(getMaterialNameKey(itemName));
    });
    const nextCarousel = getUniqueMaterialItems(selectedItems);
    const nextAssets = mergeMaterialItemsWithPriority(
      removedCarouselItems,
      previousMaterials.assets.filter((itemName) => !selectedKeySet.has(getMaterialNameKey(itemName)))
    );
    const nextPreview = getUniqueMaterialItems(
      previousMaterials.preview.filter((itemName) => !selectedKeySet.has(getMaterialNameKey(itemName)))
    );
    const previousSnapshot = JSON.stringify({
      materials: previousMaterials,
      descriptionImageOrders: previousDescriptionImageOrders,
      skuConfigMap: previousSkuConfigMap,
      mainNumber: getProductMainNumberValue(product),
      masterSku: getProductMasterSkuValue(product),
      codeValue: normalizeText(product.codeValue)
    });

    product.materials.carousel = nextCarousel;
    product.materials.assets = nextAssets;
    product.materials.preview = nextPreview;
    product.materialPathMap = {
      carousel: buildSectionMaterialPathMapByItems(product, nextCarousel),
      assets: buildSectionMaterialPathMapByItems(product, nextAssets),
      preview: buildSectionMaterialPathMapByItems(product, nextPreview)
    };
    product.descriptionImageOrders = getCarouselOrdersByItemNames(nextCarousel, previousDescriptionItems);

    const nextSkuConfigMap = cloneSkuConfigMap(previousSkuConfigMap);
    Object.entries(nextSkuConfigMap).forEach(([rowKey, entry]) => {
      entry.skuImage = getCarouselOrdersByItemNames(nextCarousel, [previousSkuImageNameMap[rowKey]]);
    });
    product.skuConfigMap = nextSkuConfigMap;

    if (product.codeValueDerivedFromSource) {
      applyImportedSourceMappingsToProduct(product);
    }

    const nextSnapshot = JSON.stringify({
      materials: {
        carousel: getUniqueMaterialItems(getCarouselItems(product)),
        assets: getUniqueMaterialItems(getMaterialItems(product, 'assets')),
        preview: getUniqueMaterialItems(getMaterialItems(product, 'preview'))
      },
      descriptionImageOrders: normalizeText(product.descriptionImageOrders),
      skuConfigMap: cloneSkuConfigMap(product.skuConfigMap),
      mainNumber: getProductMainNumberValue(product),
      masterSku: getProductMasterSkuValue(product),
      codeValue: normalizeText(product.codeValue)
    });

    return {
      matched: selectedItems.length > 0,
      updated: previousSnapshot !== nextSnapshot
    };
  }

  function applyRandomFirstCarouselPresetToProduct(product, selectedOrders) {
    if (!product || typeof product !== 'object') {
      return {
        matched: false,
        updated: false
      };
    }

    const carouselItems = getUniqueMaterialItems(getCarouselItems(product));
    const validIndexes = (Array.isArray(selectedOrders) ? selectedOrders : [])
      .map((order) => Number.parseInt(order, 10) - 1)
      .filter((index, itemIndex, indexes) => {
        return Number.isInteger(index)
          && index >= 0
          && index < carouselItems.length
          && indexes.indexOf(index) === itemIndex;
      });

    if (validIndexes.length < 2) {
      return {
        matched: false,
        updated: false
      };
    }

    const previousDescriptionImageOrders = normalizeText(product.descriptionImageOrders);
    const previousDescriptionItems = getSelectedCarouselItemsByOrders(product, previousDescriptionImageOrders)
      .map((item) => normalizeText(item && item.name))
      .filter(Boolean);
    const previousSkuConfigMap = cloneSkuConfigMap(product.skuConfigMap);
    const previousSkuImageNameMap = Object.entries(previousSkuConfigMap).reduce((result, [rowKey, entry]) => {
      const orderText = normalizePositiveIntegerString(entry && entry.skuImage);
      const imageName = orderText ? carouselItems[Number.parseInt(orderText, 10) - 1] || '' : '';
      result[rowKey] = normalizeText(imageName);
      return result;
    }, {});
    const previousSnapshot = JSON.stringify({
      materials: {
        carousel: carouselItems
      },
      descriptionImageOrders: previousDescriptionImageOrders,
      skuConfigMap: previousSkuConfigMap,
      mainNumber: getProductMainNumberValue(product),
      masterSku: getProductMasterSkuValue(product),
      codeValue: normalizeText(product.codeValue)
    });
    const nextCarousel = carouselItems.slice();
    const shuffledItems = validIndexes.map((index) => carouselItems[index]);

    for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const item = shuffledItems[index];
      shuffledItems[index] = shuffledItems[swapIndex];
      shuffledItems[swapIndex] = item;
    }

    if (
      shuffledItems.length > 1
      && shuffledItems.every((itemName, index) => itemName === carouselItems[validIndexes[index]])
    ) {
      shuffledItems.push(shuffledItems.shift());
    }

    validIndexes.forEach((carouselIndex, selectedIndex) => {
      nextCarousel[carouselIndex] = shuffledItems[selectedIndex];
    });

    product.materials = product.materials && typeof product.materials === 'object' ? product.materials : {};
    product.materials.carousel = nextCarousel;
    product.materialPathMap = {
      ...normalizeMaterialPathMap(product.materialPathMap),
      carousel: buildSectionMaterialPathMapByItems(product, nextCarousel)
    };
    product.descriptionImageOrders = getCarouselOrdersByItemNames(nextCarousel, previousDescriptionItems);

    const nextSkuConfigMap = cloneSkuConfigMap(previousSkuConfigMap);
    Object.entries(nextSkuConfigMap).forEach(([rowKey, entry]) => {
      entry.skuImage = getCarouselOrdersByItemNames(nextCarousel, [previousSkuImageNameMap[rowKey]]);
    });
    product.skuConfigMap = nextSkuConfigMap;

    if (product.codeValueDerivedFromSource) {
      applyImportedSourceMappingsToProduct(product);
    }

    const nextSnapshot = JSON.stringify({
      materials: {
        carousel: getUniqueMaterialItems(getCarouselItems(product))
      },
      descriptionImageOrders: normalizeText(product.descriptionImageOrders),
      skuConfigMap: cloneSkuConfigMap(product.skuConfigMap),
      mainNumber: getProductMainNumberValue(product),
      masterSku: getProductMasterSkuValue(product),
      codeValue: normalizeText(product.codeValue)
    });

    return {
      matched: true,
      updated: previousSnapshot !== nextSnapshot
    };
  }

  function getDescriptionPresetCandidates() {
    const candidateMap = new Map();

    state.products.forEach((product) => {
      const matchedKeys = new Set();

      getCarouselItems(product).forEach((itemName) => {
        const normalizedItemName = normalizeText(itemName);
        const key = getMaterialNameKey(normalizedItemName);
        const displayName = getCarouselItemDisplayName(product, normalizedItemName) || normalizedItemName;

        if (!key) {
          return;
        }

        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            key,
            label: displayName,
            displayNames: [displayName],
            productCount: 0
          });
        } else {
          const candidate = candidateMap.get(key);

          if (candidate.displayNames.indexOf(displayName) < 0) {
            candidate.displayNames.push(displayName);
          }
        }

        if (!matchedKeys.has(key)) {
          matchedKeys.add(key);
          candidateMap.get(key).productCount += 1;
        }
      });
    });

    return Array.from(candidateMap.values()).sort((left, right) => {
      return left.label.localeCompare(right.label, 'zh-CN', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function getDescriptionPresetCandidateMap(candidates = getDescriptionPresetCandidates()) {
    return (Array.isArray(candidates) ? candidates : []).reduce((result, candidate) => {
      result.set(candidate.key, candidate);
      return result;
    }, new Map());
  }

  function getDescriptionPresetSeedKeys(candidates = getDescriptionPresetCandidates()) {
    const availableKeys = new Set((Array.isArray(candidates) ? candidates : []).map((item) => item.key));
    const preferredProducts = [];
    const activeProduct = getActiveProduct();

    if (activeProduct) {
      preferredProducts.push(activeProduct);
    }

    state.products.forEach((product) => {
      if (!product || product.id === (activeProduct && activeProduct.id)) {
        return;
      }

      preferredProducts.push(product);
    });

    for (const product of preferredProducts) {
      const seedKeys = getSelectedCarouselItemsByOrders(product, product && product.descriptionImageOrders)
        .map((item) => getMaterialNameKey(item && item.name))
        .filter((key, index, items) => key && availableKeys.has(key) && items.indexOf(key) === index);

      if (seedKeys.length) {
        return seedKeys;
      }
    }

    return [];
  }

  function getDescriptionPresetOrdersForProduct(product, selectedKeys) {
    const carouselItems = getCarouselItems(product);

    return (Array.isArray(selectedKeys) ? selectedKeys : []).reduce((result, key) => {
      const matchIndex = carouselItems.findIndex((itemName) => getMaterialNameKey(itemName) === key);

      if (matchIndex < 0) {
        return result;
      }

      result.push(String(matchIndex + 1));
      return result;
    }, []).join(',');
  }

  function getTemplateLabel(templateId) {
    const templateOption = TEMPLATE_OPTIONS.find((item) => item.id === normalizeText(templateId));
    return templateOption ? templateOption.label : '\u672a\u8bbe\u7f6e\u6a21\u677f';
  }

  function getMaterialSectionById(sectionId) {
    return MATERIAL_SECTIONS.find((item) => item.id === normalizeText(sectionId)) || null;
  }

  function getCurrentTemplateId(source = state.globalProductSettings) {
    return normalizeText(source && source.templateId) || DEFAULT_PRODUCT_FIELDS.templateId;
  }

  function getCurrentTemplateUiCopy(source = state.globalProductSettings) {
    return TEMPLATE_UI_COPY[getCurrentTemplateId(source)] || TEMPLATE_UI_COPY['non-fashion'];
  }

  function formatTemplateCopy(template, replacements = {}) {
    return Object.entries(replacements).reduce((result, [key, value]) => {
      return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }, String(template || ''));
  }

  function getFormFieldHelpKey(fieldName) {
    const normalizedFieldName = normalizeText(fieldName);
    return FORM_FIELD_HELP_KEY_OVERRIDES[normalizedFieldName] || normalizedFieldName;
  }

  function getFieldHelpText(helpKey, source = state.globalProductSettings) {
    const normalizedHelpKey = normalizeText(helpKey);

    if (!normalizedHelpKey) {
      return '';
    }

    const templateId = getCurrentTemplateId(source);
    const templateHelpTexts = TEMPLATE_FIELD_HELP_TEXTS[templateId] || {};

    return normalizeText(templateHelpTexts[normalizedHelpKey]) || normalizeText(COMMON_FIELD_HELP_TEXTS[normalizedHelpKey]);
  }

  function getHelpAnchorElement(targetElement) {
    if (!(targetElement instanceof HTMLElement)) {
      return null;
    }

    const parentElement = targetElement.parentElement;

    if (parentElement && parentElement.classList.contains('pod-field-label-group')) {
      return parentElement;
    }

    return targetElement;
  }

  function getHelpBadgeElement(anchorElement) {
    if (!(anchorElement instanceof HTMLElement)) {
      return null;
    }

    return Array.from(anchorElement.children).find((child) => {
      return child instanceof HTMLElement && child.classList.contains('pod-field-help');
    }) || null;
  }

  function setHelpBadge(targetElement, helpText, options = {}) {
    const anchorElement = getHelpAnchorElement(targetElement);

    if (!anchorElement) {
      return;
    }

    const normalizedHelpText = normalizeText(helpText);
    const existingHelpElement = getHelpBadgeElement(anchorElement);

    if (!normalizedHelpText) {
      if (existingHelpElement) {
        existingHelpElement.remove();
      }

      return;
    }

    anchorElement.classList.add('pod-field-label-group');

    const helpElement = existingHelpElement || document.createElement('span');

    helpElement.className = 'pod-field-help';
    helpElement.textContent = '?';
    helpElement.tabIndex = 0;
    helpElement.setAttribute('role', 'note');
    helpElement.setAttribute('data-help', normalizedHelpText);
    helpElement.setAttribute('data-help-placement', options.placement === 'bottom' ? 'bottom' : 'top');

    if (!existingHelpElement) {
      anchorElement.appendChild(helpElement);
    }
  }

  function renderFieldHelpBadges() {
    document.querySelectorAll('[data-global-product-field]').forEach((fieldElement) => {
      const fieldName = normalizeText(fieldElement.getAttribute('data-global-product-field'));
      const fieldContainer = fieldElement.closest('.pod-field');
      const labelElement = fieldContainer ? fieldContainer.querySelector('.pod-field-label') : null;

      if (!fieldName || !(labelElement instanceof HTMLElement)) {
        return;
      }

      setHelpBadge(labelElement, getFieldHelpText(getFormFieldHelpKey(fieldName)));
    });

    Array.from(document.querySelectorAll('.pod-sku-table-head > span')).forEach((headerElement, index) => {
      setHelpBadge(headerElement, getFieldHelpText(SKU_TABLE_HEADER_HELP_KEYS[index]), {
        placement: 'bottom'
      });
    });

    Array.from(document.querySelectorAll('.pod-product-table-head > span')).forEach((headerElement, index) => {
      setHelpBadge(headerElement, getFieldHelpText(PRODUCT_LIST_HEADER_HELP_KEYS[index]), {
        placement: 'bottom'
      });
    });
  }

  function renderTemplateAwareCopy() {
    const templateCopy = getCurrentTemplateUiCopy();
    const productTableImageHeader = document.querySelector('[data-product-table-column="image"]');
    const carouselButton = getElement('podBatchPresetCarouselButton');
    const carouselPresetTitle = getElement('podCarouselPresetTitle');
    const carouselPresetTag = document.querySelector('#podCarouselPresetModal .pod-panel-tag');
    const carouselPresetPanelTexts = document.querySelectorAll('#podCarouselPresetModal .pod-description-preset-panel-text');
    const descriptionPresetPanelTexts = document.querySelectorAll('#podDescriptionPresetModal .pod-description-preset-panel-text');

    if (productTableImageHeader instanceof HTMLElement) {
      productTableImageHeader.textContent = templateCopy.productListImageLabel;
    }

    if (carouselButton instanceof HTMLButtonElement) {
      const shouldResetDefaultLabel = carouselButton.dataset.defaultLabel === '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u56fe'
        || carouselButton.dataset.defaultLabel === '\u6279\u91cf\u9884\u8bbe\u8f6e\u64ad\u7d20\u6750'
        || !carouselButton.dataset.defaultLabel;

      carouselButton.textContent = templateCopy.carouselButtonLabel;

      if (shouldResetDefaultLabel) {
        carouselButton.dataset.defaultLabel = templateCopy.carouselButtonLabel;
      }
    }

    if (carouselPresetTitle instanceof HTMLElement) {
      carouselPresetTitle.textContent = templateCopy.carouselPresetTitle;
    }

    if (carouselPresetTag instanceof HTMLElement) {
      carouselPresetTag.textContent = templateCopy.carouselPresetTag;
    }

    if (carouselPresetPanelTexts[0] instanceof HTMLElement) {
      carouselPresetPanelTexts[0].textContent = templateCopy.carouselPresetCandidateText;
    }

    if (carouselPresetPanelTexts[1] instanceof HTMLElement) {
      carouselPresetPanelTexts[1].textContent = templateCopy.carouselPresetSelectedText;
    }

    if (descriptionPresetPanelTexts[0] instanceof HTMLElement) {
      descriptionPresetPanelTexts[0].textContent = templateCopy.descriptionPresetCandidateText;
    }
  }

  function createProductId() {
    return `pod-product-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createCosUploadRunId() {
    return `pod-cos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createAiTitleRunId() {
    return `pod-ai-title-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clearCosUploadStopGuardTimer() {
    if (state.cosUploadStopGuardTimer) {
      window.clearTimeout(state.cosUploadStopGuardTimer);
      state.cosUploadStopGuardTimer = 0;
    }
  }

  function isCosUploadStopGuardActive() {
    return state.uploadingCosImages && Number(state.cosUploadStopGuardUntil) > Date.now();
  }

  function scheduleCosUploadStopGuardTimer() {
    clearCosUploadStopGuardTimer();

    if (!isCosUploadStopGuardActive()) {
      return;
    }

    state.cosUploadStopGuardTimer = window.setTimeout(() => {
      state.cosUploadStopGuardTimer = 0;
      renderActionButtonStates();
    }, Math.max(0, Number(state.cosUploadStopGuardUntil) - Date.now()));
  }

  function startCosUploadStopGuard() {
    state.cosUploadStopGuardUntil = Date.now() + COS_UPLOAD_STOP_GUARD_MS;
    scheduleCosUploadStopGuardTimer();
  }

  function resetCosUploadStopGuard() {
    state.cosUploadStopGuardUntil = 0;
    clearCosUploadStopGuardTimer();
  }

  function clearCosUploadProgressPollTimer() {
    if (state.cosUploadProgressPollTimer) {
      window.clearTimeout(state.cosUploadProgressPollTimer);
      state.cosUploadProgressPollTimer = 0;
    }
  }

  function getCosUploadProgressText() {
    const snapshot = createCosUploadProgressSnapshot(state.cosUploadSnapshot || {});
    const totalCount = Math.max(0, Number(snapshot.totalCount) || 0);
    const completedCount = Math.min(totalCount, Math.max(0, Number(snapshot.completedCount) || 0));
    const successCount = Math.max(0, Number(snapshot.successCount) || 0);
    const failedCount = Math.max(0, Number(snapshot.failedCount) || 0);
    const canceledCount = Math.max(0, Number(snapshot.canceledCount) || 0);

    if (state.uploadingCosImages) {
      const prefix = state.stoppingCosImages || snapshot.runState === 'stopping'
        ? '\u505c\u6b62\u4e0a\u4f20\u4e2d'
        : '\u56fe\u7247\u4e0a\u4f20\u4e2d';

      if (!totalCount) {
        return prefix;
      }

      let text = `${prefix} ${completedCount}/${totalCount}`;

      if (successCount || failedCount || canceledCount) {
        const detailParts = [`\u6210\u529f ${successCount}`];

        if (failedCount > 0) {
          detailParts.push(`\u5931\u8d25 ${failedCount}`);
        }

        if (canceledCount > 0) {
          detailParts.push(`\u505c\u6b62 ${canceledCount}`);
        }

        text += `\uff0c${detailParts.join('\uff0c')}`;
      }

      return text;
    }

    if (!totalCount) {
      return '';
    }

    const prefix = snapshot.canceled || snapshot.runState === 'canceled'
      ? '\u4e0a\u6b21\u5df2\u505c\u6b62'
      : '\u4e0a\u6b21\u4e0a\u4f20\u7ed3\u679c';
    const detailParts = [
      `\u6210\u529f ${successCount}`,
      `\u65b0\u4f20 ${Math.max(0, Number(snapshot.uploadedCount) || 0)}`,
      `\u7f13\u5b58 ${Math.max(0, Number(snapshot.cachedCount) || 0)}`
    ];

    if (failedCount > 0) {
      detailParts.push(`\u5931\u8d25 ${failedCount}`);
    }

    if (canceledCount > 0) {
      detailParts.push(`\u505c\u6b62 ${canceledCount}`);
    }

    return `${prefix}\uff1a${detailParts.join('\uff0c')}`;
  }

  function renderCosUploadProgressText() {
    const progressText = getElement('podCosUploadProgressText');
    const text = getCosUploadProgressText();
    const snapshot = createCosUploadProgressSnapshot(state.cosUploadSnapshot || {});

    progressText.textContent = text;
    progressText.hidden = !text;
    progressText.title = snapshot.label || '';
  }

  function scheduleCosUploadProgressPoll(delayMs = COS_UPLOAD_PROGRESS_POLL_MS) {
    clearCosUploadProgressPollTimer();

    if (!state.uploadingCosImages) {
      return;
    }

    state.cosUploadProgressPollTimer = window.setTimeout(() => {
      state.cosUploadProgressPollTimer = 0;
      void refreshCosUploadProgressSnapshot();
    }, Math.max(0, Number(delayMs) || 0));
  }

  async function refreshCosUploadProgressSnapshot() {
    if (!state.uploadingCosImages) {
      return;
    }

    const runId = normalizeText(state.cosUploadRunId);

    if (!runId) {
      return;
    }

    try {
      const result = await getFeatureCenterCosUploadBridge().getPodUploadSheetMiaoshouCosUploadProgressSnapshot({ runId });
      const progress = result && result.progress && typeof result.progress === 'object'
        ? result.progress
        : null;

      if (progress) {
        state.cosUploadSnapshot = createCosUploadProgressSnapshot({
          ...state.cosUploadSnapshot,
          ...progress
        });
        renderActionButtonStates();
      }
    } catch (_error) {
    } finally {
      if (state.uploadingCosImages) {
        scheduleCosUploadProgressPoll();
      }
    }
  }

  function startCosUploadProgressPolling() {
    scheduleCosUploadProgressPoll(0);
  }

  function stopCosUploadProgressPolling() {
    clearCosUploadProgressPollTimer();
  }

  function isDuplicateButtonEvent(stampKey, event) {
    const nextStamp = Number(event && event.timeStamp) || Date.now();

    if (Number(state[stampKey]) === nextStamp) {
      return true;
    }

    state[stampKey] = nextStamp;
    return false;
  }

  function createEmptyMaterialPathMap() {
    return {
      carousel: {},
      assets: {},
      preview: {}
    };
  }

  function normalizeMaterialPathMap(source) {
    const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};

    return MATERIAL_SECTIONS.reduce((result, section) => {
      const sectionSource =
        input[section.id] && typeof input[section.id] === 'object' && !Array.isArray(input[section.id])
          ? input[section.id]
          : {};

      result[section.id] = Object.entries(sectionSource).reduce((map, [key, value]) => {
        const normalizedKey = normalizeText(key);
        const normalizedValue = normalizeText(value);

        if (normalizedKey && normalizedValue) {
          map[normalizedKey] = normalizedValue;
        }

        return map;
      }, {});

      return result;
    }, createEmptyMaterialPathMap());
  }

  function buildMaterialPathMapFromEntries(entries) {
    return (Array.isArray(entries) ? entries : []).reduce((result, item) => {
      const itemName = normalizeText(item && item.name);
      const itemPath = normalizeText(item && item.path);
      const itemKey = getMaterialNameKey(itemName);

      if (itemKey && itemPath && !result[itemKey]) {
        result[itemKey] = itemPath;
      }

      return result;
    }, {});
  }

  function createEmptyProduct(overrides = {}) {
    const materials = overrides.materials && typeof overrides.materials === 'object'
      ? overrides.materials
      : {};
    const skuConfigMap = normalizeSkuConfigMap(overrides.skuConfigMap);
    const materialPathMap = normalizeMaterialPathMap(overrides.materialPathMap);

    return {
      id: createProductId(),
      ...DEFAULT_PRODUCT_FIELDS,
      ...overrides,
      skuConfigMap,
      aiTitleStatus: normalizeText(overrides.aiTitleStatus),
      aiTitleError: normalizeText(overrides.aiTitleError),
      aiTitlePatternSummary: normalizeText(overrides.aiTitlePatternSummary),
      aiTitleUpdatedAt: normalizeText(overrides.aiTitleUpdatedAt),
      materials: {
        carousel: Array.isArray(materials.carousel) ? materials.carousel.slice() : [],
        assets: Array.isArray(materials.assets) ? materials.assets.slice() : [],
        preview: Array.isArray(materials.preview) ? materials.preview.slice() : []
      },
      materialPathMap
    };
  }

  function getFileNameWithoutExtension(fileName) {
    return normalizeText(fileName).replace(/\.[^.]+$/, '');
  }

  function getSourceMappedFolderParts(product) {
    const sourceFolder = normalizeText(product && product.sourceFolder).replace(/\\/g, '/');
    const segments = sourceFolder
      .split('/')
      .map((segment) => normalizeText(segment))
      .filter(Boolean);

    return {
      mainFolderName: normalizeText(segments[0] || product && product.localName),
      detailFolderName: normalizeText(segments.length > 1 ? segments[segments.length - 1] : '')
    };
  }

  function getSourceMappedImageName(product) {
    const materials = product && product.materials && typeof product.materials === 'object'
      ? product.materials
      : {};

    for (const sectionId of ['carousel', 'assets', 'preview']) {
      const items = Array.isArray(materials[sectionId]) ? materials[sectionId] : [];
      const imageName = getFileNameWithoutExtension(items[0]);

      if (imageName) {
        return imageName;
      }
    }

    return '';
  }

  function buildSourceFolderMappedValue(product) {
    const { mainFolderName, detailFolderName } = getSourceMappedFolderParts(product);

    if (mainFolderName && detailFolderName) {
      return detailFolderName === mainFolderName
        ? mainFolderName
        : `${mainFolderName}-${detailFolderName}`;
    }

    return detailFolderName || mainFolderName;
  }

  function getMaterialPathByName(product, sectionId, itemName) {
    const normalizedSectionId = normalizeText(sectionId);
    const materialPathMap = normalizeMaterialPathMap(product && product.materialPathMap);
    const itemKey = getMaterialNameKey(itemName);
    const legacyItemKey = getLegacyMaterialNameKey(itemName);

    if (!itemKey) {
      return '';
    }

    const directPath = normalizeText(
      materialPathMap[normalizedSectionId] && materialPathMap[normalizedSectionId][itemKey]
    );

    if (directPath) {
      return directPath;
    }

    if (legacyItemKey && legacyItemKey !== itemKey) {
      const legacyPath = normalizeText(
        materialPathMap[normalizedSectionId] && materialPathMap[normalizedSectionId][legacyItemKey]
      );

      if (legacyPath) {
        return legacyPath;
      }
    }

    for (const section of MATERIAL_SECTIONS) {
      const fallbackPath = normalizeText(
        materialPathMap[section.id] && materialPathMap[section.id][itemKey]
      );

      if (fallbackPath) {
        return fallbackPath;
      }

      if (legacyItemKey && legacyItemKey !== itemKey) {
        const legacyFallbackPath = normalizeText(
          materialPathMap[section.id] && materialPathMap[section.id][legacyItemKey]
        );

        if (legacyFallbackPath) {
          return legacyFallbackPath;
        }
      }
    }

    return '';
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(normalizeText(value));
  }

  function looksLikeLocalFilePath(value) {
    const text = normalizeText(value);

    if (!text) {
      return false;
    }

    if (/^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text)) {
      return true;
    }

    return /[\\/]/.test(text) && /[.][a-z0-9]{1,10}$/i.test(text);
  }

  function normalizeLocalFilePathKey(filePath) {
    const text = normalizeText(filePath);

    if (!text) {
      return '';
    }

    return text.replace(/\//g, '\\').toLowerCase();
  }

  function getLocalFilePath(file) {
    const directPath = normalizeText(file && file.path);

    if (directPath) {
      return directPath;
    }

    if (
      window.temuApp
      && window.temuApp.files
      && typeof window.temuApp.files.getPathForFile === 'function'
    ) {
      try {
        return normalizeText(window.temuApp.files.getPathForFile(file));
      } catch (error) {
        return '';
      }
    }

    return '';
  }

  function getReferenceBaseName(value) {
    const text = normalizeText(value);

    if (!text) {
      return '';
    }

    const segments = text.split(/[\\/]+/).filter(Boolean);
    return normalizeText(segments[segments.length - 1] || text);
  }

  function getMaterialDisplayName(product, sectionId, itemName) {
    const itemPath = getMaterialPathByName(product, sectionId, itemName);
    return getReferenceBaseName(itemPath) || normalizeText(itemName);
  }

  function getCarouselItemDisplayName(product, itemName) {
    return getMaterialDisplayName(product, 'carousel', itemName);
  }

  function getMaterialPathCandidatesByReference(product, referenceText) {
    const normalizedReference = normalizeText(referenceText);
    const candidateMap = new Map();

    if (!normalizedReference) {
      return [];
    }

    if (looksLikeLocalFilePath(normalizedReference)) {
      const normalizedPathKey = normalizeLocalFilePathKey(normalizedReference);

      if (normalizedPathKey) {
        candidateMap.set(normalizedPathKey, {
          filePath: normalizedReference,
          fileName: getReferenceBaseName(normalizedReference)
        });
      }
    }

    const referenceName = getReferenceBaseName(normalizedReference) || normalizedReference;
    const displayReferenceName = normalizeImportedMaterialName(referenceName, {
      productKey: product && product.localName,
      sourceFolder: product && product.sourceFolder
    }) || referenceName;

    MATERIAL_SECTIONS.forEach((section) => {
      const localPath = getMaterialPathByName(product, section.id, referenceName);
      const normalizedPathKey = normalizeLocalFilePathKey(localPath);

      if (!normalizedPathKey || candidateMap.has(normalizedPathKey)) {
        return;
      }

      candidateMap.set(normalizedPathKey, {
        filePath: localPath,
        fileName: displayReferenceName
      });
    });

    return Array.from(candidateMap.values());
  }

  function buildSectionMaterialPathMapByItems(product, itemNames) {
    return getUniqueMaterialItems(itemNames).reduce((result, itemName) => {
      const itemKey = getMaterialNameKey(itemName);
      const itemPath = getMaterialPathByName(product, 'carousel', itemName);

      if (itemKey && itemPath && !result[itemKey]) {
        result[itemKey] = itemPath;
      }

      return result;
    }, {});
  }

  function appendUploadableEntry(entryMap, filePath, fileName) {
    const normalizedPathKey = normalizeLocalFilePathKey(filePath);

    if (!normalizedPathKey) {
      return;
    }

    if (!entryMap.has(normalizedPathKey)) {
      entryMap.set(normalizedPathKey, {
        filePath: normalizeText(filePath),
        fileName: normalizeText(fileName) || getReferenceBaseName(filePath)
      });
    }
  }

  function getProductUploadableImageEntries(product) {
    const entryMap = new Map();

    MATERIAL_SECTIONS.forEach((section) => {
      getMaterialItems(product, section.id).forEach((itemName) => {
        if (isHttpUrl(itemName)) {
          return;
        }

        appendUploadableEntry(
          entryMap,
          getMaterialPathByName(product, section.id, itemName),
          itemName
        );
      });
    });

    String(product && product.description || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .forEach((line) => {
        if (isHttpUrl(line)) {
          return;
        }

        getMaterialPathCandidatesByReference(product, line).forEach((entry) => {
          appendUploadableEntry(entryMap, entry.filePath, entry.fileName);
        });
      });

    return Array.from(entryMap.values());
  }

  function getUploadableImageEntries() {
    const entryMap = new Map();

    state.products.forEach((product) => {
      getProductUploadableImageEntries(product).forEach((entry) => {
        appendUploadableEntry(entryMap, entry.filePath, entry.fileName);
      });
    });

    return Array.from(entryMap.values());
  }

  function hasLocalMaterialItems(products = state.products) {
    return (Array.isArray(products) ? products : []).some((product) => {
      const hasLocalSectionItems = MATERIAL_SECTIONS.some((section) => {
        return getMaterialItems(product, section.id).some((itemName) => !isHttpUrl(itemName));
      });

      if (hasLocalSectionItems) {
        return true;
      }

      return String(product && product.description || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .some((line) => {
          return !isHttpUrl(line) && getMaterialPathCandidatesByReference(product, line).length > 0;
        });
    });
  }

  function getPrimaryProductImage(product) {
    if (!product) {
      return null;
    }

    for (const sectionId of ['carousel', 'assets', 'preview']) {
      const items = getMaterialItems(product, sectionId);

      for (let index = 0; index < items.length; index += 1) {
        const itemName = normalizeText(items[index]);
        const itemPath = getMaterialPathByName(product, sectionId, itemName);

        if (itemName && itemPath) {
          return {
            sectionId,
            name: itemName,
            path: itemPath,
            order: index + 1
          };
        }
      }
    }

    return null;
  }

  function getProductMainNumberValue(product) {
    const mainNumber = resolveAutoMappedFieldValue(product, product && product.mainNumber);

    if (mainNumber) {
      return mainNumber;
    }

    const legacyCodeValue = normalizeText(product && product.codeValue);

    if (legacyCodeValue && /\D/.test(legacyCodeValue)) {
      return legacyCodeValue;
    }

    return resolveAutoMappedFieldValue(product, product && product.masterSku);
  }

  function getProductMasterSkuValue(product) {
    const masterSku = resolveAutoMappedFieldValue(product, product && product.masterSku);

    if (masterSku) {
      return masterSku;
    }

    return getProductMainNumberValue(product);
  }

  function getAutoDerivedProductCode(product, sourceMappedValue = '') {
    const seedText =
      normalizeText(sourceMappedValue)
      || getProductMainNumberValue(product)
      || getProductMasterSkuValue(product)
      || normalizeText(product && product.sourceFolder)
      || normalizeText(product && product.localName);

    return buildStableNumericProductCode(seedText);
  }

  function getSourceMappedFieldValue(product) {
    const folderMappedValue = buildSourceFolderMappedValue(product);

    if (folderMappedValue) {
      return folderMappedValue;
    }

    return getSourceMappedImageName(product);
  }

  function getLegacySourceMappedFieldValue(product) {
    const { detailFolderName, mainFolderName } = getSourceMappedFolderParts(product);
    const folderName = detailFolderName || mainFolderName;
    const imageName = getSourceMappedImageName(product);

    if (folderName && imageName) {
      const match = folderName.match(/^(.*?)(\s*[\(\uFF08][^()\uFF08\uFF09]+[\)\uFF09]\s*)$/);

      if (match) {
        const baseName = normalizeText(match[1]);
        const suffix = normalizeText(match[2]);

        return baseName ? `${baseName}-${imageName} ${suffix}` : `${imageName} ${suffix}`;
      }

      return `${folderName}-${imageName}`;
    }

    return folderName || imageName;
  }

  function resolveAutoMappedFieldValue(product, currentValue) {
    const normalizedCurrentValue = normalizeText(currentValue);
    const sourceMappedValue = getSourceMappedFieldValue(product);

    if (!sourceMappedValue) {
      return normalizedCurrentValue;
    }

    if (!normalizedCurrentValue) {
      return sourceMappedValue;
    }

    const legacySourceMappedValue = getLegacySourceMappedFieldValue(product);
    const { detailFolderName } = getSourceMappedFolderParts(product);
    const imageName = getSourceMappedImageName(product);

    if (
      normalizedCurrentValue === legacySourceMappedValue
      || normalizedCurrentValue === detailFolderName
      || normalizedCurrentValue === imageName
    ) {
      return sourceMappedValue;
    }

    return normalizedCurrentValue;
  }

  function applyImportedSourceMappingsToProduct(product) {
    if (!product || typeof product !== 'object') {
      return product;
    }

    const sourceMappedValue = getSourceMappedFieldValue(product);
    const shouldAutoAssignProductCode =
      Boolean(product.codeValueDerivedFromSource)
      || !normalizeProductCodeValue(product.codeValue);

    if (!sourceMappedValue) {
      return product;
    }

    product.mainNumber = sourceMappedValue;
    product.masterSku = sourceMappedValue;

    if (shouldAutoAssignProductCode) {
      product.codeValue = getAutoDerivedProductCode(product, sourceMappedValue);
      product.codeValueDerivedFromSource = true;
    } else {
      product.codeValueDerivedFromSource = false;
    }

    return product;
  }

  function applyGlobalProductSettingsToProduct(product) {
    if (!product || typeof product !== 'object') {
      return product;
    }

    syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);

    GLOBAL_PRODUCT_FIELD_NAMES.forEach((fieldName) => {
      if (
        fieldName === 'codeValue'
        && product.codeValueDerivedFromSource
        && !normalizeText(state.globalProductSettings.codeValue)
      ) {
        return;
      }

      product[fieldName] = state.globalProductSettings[fieldName];
    });

    product.skuConfigMap = cloneSkuConfigMap(state.globalProductSettings.skuConfigMap);

    return product;
  }

  function syncGlobalProductSettingsToProducts(products = state.products) {
    const targetProducts = Array.isArray(products) ? products : [];
    targetProducts.forEach((product) => {
      applyGlobalProductSettingsToProduct(product);
    });
  }

  function formatTime(value) {
    const timestamp = normalizeText(value);

    if (!timestamp) {
      return '\u672a\u540c\u6b65';
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    return date.toLocaleString('zh-CN', { hour12: false });
  }

  function formatBytes(value) {
    const bytes = Number.parseInt(value, 10);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size >= 100 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
  }

  function getTemplateSnapshotById(templateId) {
    return (Array.isArray(state.snapshot.templates) ? state.snapshot.templates : []).find((item) => item.id === templateId) || null;
  }

  function getTotalMaterialCount(product) {
    if (!product || !product.materials) {
      return 0;
    }

    return MATERIAL_SECTIONS.reduce((total, section) => {
      return total + (Array.isArray(product.materials[section.id]) ? product.materials[section.id].length : 0);
    }, 0);
  }

  function getSectionMaterialCount(product, sectionId) {
    return product && product.materials && Array.isArray(product.materials[sectionId])
      ? product.materials[sectionId].length
      : 0;
  }

  function getSelectedCarouselItemsByOrders(product, value) {
    const carouselItems = getCarouselItems(product);
    const selectedOrders = normalizeSequenceSelection(value)
      .split(',')
      .map((item) => normalizePositiveIntegerString(item))
      .filter(Boolean);

    return selectedOrders.reduce((result, orderText) => {
      const index = Number.parseInt(orderText, 10) - 1;
      const itemName = carouselItems[index];

      if (!itemName) {
        return result;
      }

      result.push({
        order: orderText,
        name: normalizeText(itemName),
        displayName: getCarouselItemDisplayName(product, itemName)
      });
      return result;
    }, []);
  }

  function getDescriptionImagePreviewText(product) {
    const selectedItems = getSelectedCarouselItemsByOrders(product, product && product.descriptionImageOrders);

    if (selectedItems.length) {
      return [
        `\u5df2\u9009 ${selectedItems.length} \u5f20`,
        ...selectedItems.map((item) => `\u7b2c${item.order}\u5f20 ${item.displayName || item.name}`)
      ].join('\n');
    }

    if (getSectionMaterialCount(product, 'carousel') > 0) {
      return '\u5df2\u9009 0 \u5f20';
    }

    return '\u5171 0 \u5f20';
  }

  function getCarouselPreviewText(product) {
    const carouselItems = getCarouselItems(product);

    if (!carouselItems.length) {
      return '\u5171 0 \u5f20';
    }

    return [
      `\u5171 ${carouselItems.length} \u5f20`,
      ...carouselItems.map((itemName, index) => `\u7b2c${index + 1}\u5f20 ${getCarouselItemDisplayName(product, itemName) || normalizeText(itemName)}`)
    ].join('\n');
  }

  function getAiTitleTargetItems(options = {}) {
    const { retryFailedOnly = false } = options;

    return state.products.reduce((result, product) => {
      if (retryFailedOnly && normalizeText(product.aiTitleStatus) !== 'failed') {
        return result;
      }

      const primaryImage = getPrimaryProductImage(product);

      if (!primaryImage) {
        return result;
      }

      result.push({
        product,
        primaryImage
      });
      return result;
    }, []);
  }

  function resetAiTitleProgress() {
    state.aiTitleProgress = createAiTitleProgressSnapshot();
  }

  function getAiTitleProgressText() {
    if (!state.generatingAiTitles) {
      return '';
    }

    const totalCount = Math.max(0, Number(state.aiTitleProgress.totalCount) || 0);
    const completedCount = Math.min(
      totalCount,
      Math.max(0, Number(state.aiTitleProgress.completedCount) || 0)
    );
    const prefix = state.stoppingAiTitles ? '\u505c\u6b62\u4e2d' : 'AI\u751f\u6210\u4e2d';

    if (!totalCount) {
      return prefix;
    }

    return `${prefix} ${completedCount}/${totalCount}`;
  }

  function applyAiTitleResultToProduct(product, item, updatedAt, taskCanceled = false) {
    if (!product) {
      return;
    }

    if (!item) {
      product.aiTitleStatus = taskCanceled ? 'canceled' : 'failed';
      product.aiTitleError = taskCanceled
        ? '\u4efb\u52a1\u5df2\u505c\u6b62\u3002'
        : 'AI \u8fd4\u56de\u7ed3\u679c\u7f3a\u5c11\u5f53\u524d\u5546\u54c1\u3002';
      product.aiTitlePatternSummary = '';
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    if (normalizeText(item.status) === 'success') {
      product.title = normalizeTitleFieldValue(item.zhTitle);
      product.englishTitle = normalizeTitleFieldValue(item.enTitle);
      product.aiTitleStatus = 'success';
      product.aiTitleError = '';
      product.aiTitlePatternSummary = normalizeText(item.patternSummary);
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    if (normalizeText(item.status) === 'canceled') {
      product.aiTitleStatus = 'canceled';
      product.aiTitleError = normalizeText(item.error) || '\u4efb\u52a1\u5df2\u505c\u6b62\u3002';
      product.aiTitlePatternSummary = '';
      product.aiTitleUpdatedAt = updatedAt;
      return;
    }

    product.aiTitleStatus = 'failed';
    product.aiTitleError = normalizeText(item.error) || '\u6807\u9898\u751f\u6210\u5931\u8d25\u3002';
    product.aiTitlePatternSummary = '';
    product.aiTitleUpdatedAt = updatedAt;
  }

  function handleAiTitleProgressEvent(payload) {
    if (!state.generatingAiTitles) {
      return;
    }

    const incomingRunId = normalizeText(payload && payload.runId);

    if (incomingRunId && incomingRunId !== normalizeText(state.aiTitleRunId)) {
      return;
    }

    const nextProgress = createAiTitleProgressSnapshot({
      ...state.aiTitleProgress,
      ...payload,
      label: normalizeText(payload && payload.localName) || normalizeText(payload && payload.imageName)
    });
    const item = payload && payload.item && typeof payload.item === 'object' ? payload.item : null;
    const productId = normalizeText(item && item.id) || nextProgress.productId;

    state.aiTitleProgress = nextProgress;

    if (productId && item) {
      const product = state.products.find((entry) => entry.id === productId);

      if (product) {
        applyAiTitleResultToProduct(product, item, nextProgress.updatedAt, false);
        syncProductRowStatus(productId);

        if (state.activeProductId === productId) {
          renderEditor();
        }
      }
    }

    renderAiTitleControls();
  }

  function renderAiTitleControls() {
    const prefixInput = getElement('podAiTitlePrefixInput');
    const suffixInput = getElement('podAiTitleSuffixInput');
    const generateButton = getElement('podBatchAiTitleButton');
    const retryButton = getElement('podRetryFailedAiTitleButton');
    const progressText = getElement('podAiTitleProgressText');
    const eligibleCount = getAiTitleTargetItems().length;
    const retryTargetCount = getAiTitleTargetItems({ retryFailedOnly: true }).length;

    if (prefixInput.value !== state.aiTitlePrefix) {
      prefixInput.value = state.aiTitlePrefix;
    }

    if (suffixInput.value !== state.aiTitleSuffix) {
      suffixInput.value = state.aiTitleSuffix;
    }

    const extraPromptInput = getElement('podAiTitleExtraPromptInput');
    if (extraPromptInput.value !== state.aiTitleExtraPrompt) {
      extraPromptInput.value = state.aiTitleExtraPrompt;
    }

    const maxLengthInput = getElement('podAiTitleMaxLengthInput');
    if (maxLengthInput.value !== state.aiTitleMaxLength) {
      maxLengthInput.value = state.aiTitleMaxLength;
    }

    if (!generateButton.dataset.defaultLabel) {
      generateButton.dataset.defaultLabel = generateButton.textContent || '\u6279\u91cfAI\u751f\u6210\u6807\u9898';
    }

    generateButton.textContent = state.generatingAiTitles
      ? (state.stoppingAiTitles ? '\u505c\u6b62\u4e2d...' : '\u505c\u6b62\u4efb\u52a1')
      : (generateButton.dataset.defaultLabel || '\u6279\u91cfAI\u751f\u6210\u6807\u9898');
    generateButton.disabled = state.generatingAiTitles ? state.stoppingAiTitles : !eligibleCount;
    toggleButtonBusy(
      retryButton,
      state.generatingAiTitles && state.retryingFailedAiTitles && !state.stoppingAiTitles,
      '\u91cd\u8bd5\u4e2d...'
    );
    retryButton.disabled = state.generatingAiTitles || state.stoppingAiTitles || !retryTargetCount;
    progressText.textContent = getAiTitleProgressText();
    progressText.hidden = !progressText.textContent;
    progressText.title = state.aiTitleProgress.label || '';
  }

  async function handleStopAiTitles() {
    if (!state.generatingAiTitles || state.stoppingAiTitles) {
      return;
    }

    state.stoppingAiTitles = true;
    renderAiTitleControls();

    try {
      const result = await getFeatureCenterBridge().cancelPodUploadSheetMiaoshouAiTitles({
        runId: state.aiTitleRunId
      });

      if (!result || !result.canceled) {
        state.stoppingAiTitles = false;
        renderAiTitleControls();
        showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u505c\u6b62\u7684 AI \u6807\u9898\u4efb\u52a1\u3002', 'warning');
        return;
      }

      showWindowNotice('\u5df2\u53d1\u9001\u505c\u6b62\u8bf7\u6c42\uff0c\u6b63\u5728\u7b49\u5f85\u5f53\u524d\u4efb\u52a1\u7ed3\u675f\u3002', 'warning');
    } catch (error) {
      state.stoppingAiTitles = false;
      renderAiTitleControls();
      showWindowNotice(
        '\u505c\u6b62 AI \u6807\u9898\u4efb\u52a1\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  async function handleGenerateAiTitles(options = {}) {
    const { retryFailedOnly = false } = options;
    const targetItems = getAiTitleTargetItems({
      retryFailedOnly
    });

    if (!targetItems.length) {
      showWindowNotice(
        retryFailedOnly
          ? '\u6ca1\u6709\u53ef\u91cd\u8bd5\u7684\u5931\u8d25\u5546\u54c1\uff0c\u6216\u8fd9\u4e9b\u5546\u54c1\u7f3a\u5c11\u9ed8\u8ba4\u7b2c\u4e00\u5f20\u56fe\u7247\u3002'
          : '\u6ca1\u6709\u53ef\u751f\u6210\u6807\u9898\u7684\u5546\u54c1\uff0c\u8bf7\u5148\u5bfc\u5165\u5e26\u56fe\u7247\u8def\u5f84\u7684\u672c\u5730\u5546\u54c1\u3002',
        'warning'
      );
      return;
    }

    state.generatingAiTitles = true;
    state.stoppingAiTitles = false;
    state.retryingFailedAiTitles = retryFailedOnly;
    state.aiTitleRunId = createAiTitleRunId();
    state.aiTitleProgress = createAiTitleProgressSnapshot({
      runState: 'started',
      totalCount: targetItems.length,
      completedCount: 0,
      successCount: 0,
      failedCount: 0,
      canceledCount: 0
    });
    targetItems.forEach(({ product }) => {
      product.aiTitleStatus = 'processing';
      product.aiTitleError = '';
    });
    renderAll();

    try {
      const result = await getFeatureCenterBridge().generatePodUploadSheetMiaoshouAiTitles({
        runId: state.aiTitleRunId,
        entryId: 'pod-upload-sheet-miaoshou-table',
        prefixText: state.aiTitlePrefix,
        suffixText: state.aiTitleSuffix,
        extraPrompt: state.aiTitleExtraPrompt,
        targetLength: state.aiTitleMaxLength,
        outputLanguage: 'en',
        products: targetItems.map(({ product, primaryImage }) => {
          return {
            id: product.id,
            localName: product.localName,
            sourceFolder: product.sourceFolder,
            mainNumber: getProductMainNumberValue(product),
            categoryId: normalizeCategoryId(product.category),
            categoryLabel: getCategoryLabel(product.category),
            imageName: primaryImage.name,
            imagePath: primaryImage.path
          };
        })
      });

      const resultItems = Array.isArray(result && result.items) ? result.items : [];
      const resultMap = new Map(resultItems.map((item) => [normalizeText(item && item.id), item]));
      const updatedAt = normalizeText(result && result.updatedAt);
      const successCount = Number(result && result.successCount) || 0;
      const failedCount = Number(result && result.failedCount) || 0;
      const canceledCount = Number(result && result.canceledCount) || 0;
      const taskCanceled = Boolean(result && result.canceled);

      state.aiTitleProgress = createAiTitleProgressSnapshot({
        runState: taskCanceled ? 'canceled' : 'completed',
        totalCount: targetItems.length,
        completedCount: targetItems.length,
        successCount,
        failedCount,
        canceledCount,
        updatedAt
      });

      targetItems.forEach(({ product }) => {
        const item = resultMap.get(product.id);
        applyAiTitleResultToProduct(product, item, updatedAt, taskCanceled);
      });

      renderAll();

      if (taskCanceled) {
        showWindowNotice(
          `AI \u6807\u9898\u4efb\u52a1\u5df2\u505c\u6b62\uff0c\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failedCount} \u4e2a\uff0c\u505c\u6b62 ${canceledCount} \u4e2a\u3002`,
          'warning'
        );
      } else {
        showWindowNotice(
          `AI \u6807\u9898\u5904\u7406\u5b8c\u6210\uff0c\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failedCount} \u4e2a\u3002`,
          failedCount > 0 ? 'warning' : 'success'
        );
      }
    } catch (error) {
      targetItems.forEach(({ product }) => {
        product.aiTitleStatus = 'failed';
        product.aiTitleError = normalizeText(error && error.message) || '\u6807\u9898\u751f\u6210\u5931\u8d25\u3002';
      });
      renderAll();
      showWindowNotice(
        'AI \u6807\u9898\u5904\u7406\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.generatingAiTitles = false;
      state.stoppingAiTitles = false;
      state.retryingFailedAiTitles = false;
      state.aiTitleRunId = '';
      resetAiTitleProgress();
      renderAll();
    }
  }

  function renderActionButtonStates() {
    const importButton = getElement('podImportProductsButton');
    const uploadModeSelect = getElement('podImageUploadModeSelect');
    const uploadButton = getElement('podBatchUploadCosButton');
    const exportButton = getElement('podExportTableButton');
    const batchPresetCarouselButton = getElement('podBatchPresetCarouselButton');
    const batchPresetDescriptionButton = getElement('podBatchPresetDescriptionButton');
    const clearButton = getElement('podClearProductsButton');
    const carouselPresetCandidates = getCarouselPresetCandidates();
    const descriptionPresetCandidates = getDescriptionPresetCandidates();
    const stopGuardActive = isCosUploadStopGuardActive();
    const uploadDefaultLabel = '\u6279\u91cf\u4e0a\u4f20\u56fe\u7247';
    const uploadStoppingLabel = '\u505c\u6b62\u4e0a\u4f20';
    const uploadStoppingBusyLabel = '\u505c\u6b62\u4e2d...';
    const uploadStartingLabel = '\u4e0a\u4f20\u542f\u52a8\u4e2d...';
    const exportDefaultLabel = '\u5bfc\u51fa\u8868\u683c';

    importButton.title = normalizeText(state.lastImportDirectoryPath)
      ? `\u4e0a\u6b21\u5bfc\u5165\u76ee\u5f55\uff1a${state.lastImportDirectoryPath}`
      : '';

    uploadModeSelect.value = normalizeImageUploadMode(state.imageUploadMode);
    uploadModeSelect.disabled = state.uploadingCosImages || state.stoppingCosImages;
    uploadButton.dataset.defaultLabel = uploadDefaultLabel;

    uploadButton.textContent = state.uploadingCosImages
      ? (state.stoppingCosImages ? uploadStoppingBusyLabel : (stopGuardActive ? uploadStartingLabel : uploadStoppingLabel))
      : uploadDefaultLabel;
    exportButton.textContent = exportDefaultLabel;
    uploadButton.disabled = state.uploadingCosImages ? (state.stoppingCosImages || stopGuardActive) : false;
    exportButton.disabled = state.exportingTable || state.uploadingCosImages || state.stoppingCosImages || !state.products.length;
    importButton.disabled = state.uploadingCosImages || state.stoppingCosImages;
    clearButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length;
    batchPresetCarouselButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length || !carouselPresetCandidates.length;
    batchPresetDescriptionButton.disabled = state.uploadingCosImages || state.stoppingCosImages || !state.products.length || !descriptionPresetCandidates.length;
    renderCosUploadProgressText();
  }

  async function handleStopCosImageUpload() {
    if (!state.uploadingCosImages || state.stoppingCosImages) {
      return;
    }

    if (isCosUploadStopGuardActive()) {
      return;
    }

    const runId = normalizeText(state.cosUploadRunId);

    if (!runId) {
      state.uploadingCosImages = false;
      state.stoppingCosImages = false;
      renderActionButtonStates();
      showWindowNotice('\u5f53\u524d\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u72b6\u6001\u5df2\u91cd\u7f6e\uff0c\u8bf7\u91cd\u65b0\u5f00\u59cb\u4e0a\u4f20\u3002', 'warning');
      return;
    }

    state.stoppingCosImages = true;
    state.cosUploadSnapshot = createCosUploadProgressSnapshot({
      ...state.cosUploadSnapshot,
      runState: 'stopping'
    });
    renderActionButtonStates();

    try {
      const result = await getFeatureCenterCosUploadBridge().cancelPodUploadSheetMiaoshouCosImages({ runId });

      if (!result || !result.canceled) {
        state.stoppingCosImages = false;
        renderActionButtonStates();
        showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u505c\u6b62\u7684\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u3002', 'warning');
        return;
      }

      showWindowNotice('\u5df2\u53d1\u9001\u505c\u6b62\u4e0a\u4f20\u8bf7\u6c42\uff0c\u6b63\u5728\u7b49\u5f85\u5f53\u524d\u4efb\u52a1\u7ed3\u675f\u3002', 'warning');
    } catch (error) {
      state.stoppingCosImages = false;
      renderActionButtonStates();
      showWindowNotice(
        '\u505c\u6b62\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  async function handleUploadCosImages() {
    if (state.uploadingCosImages || state.stoppingCosImages) {
      return;
    }

    const uploadableEntries = getUploadableImageEntries();

    if (!uploadableEntries.length) {
      showWindowNotice(
        hasLocalMaterialItems()
          ? '\u5df2\u68c0\u6d4b\u5230\u672c\u5730\u5546\u54c1\u56fe\u7247\uff0c\u4f46\u672a\u8bfb\u53d6\u5230\u6587\u4ef6\u8def\u5f84\uff0c\u8bf7\u5173\u95ed\u91cd\u5f00\u7a97\u53e3\u540e\u91cd\u65b0\u5bfc\u5165\u3002'
          : '\u5f53\u524d\u6ca1\u6709\u53ef\u4e0a\u4f20\u7684\u672c\u5730\u56fe\u7247\u3002',
        'warning'
      );
      return;
    }

    state.uploadingCosImages = true;
    state.stoppingCosImages = false;
    state.cosUploadRunId = createCosUploadRunId();
    state.cosUploadSnapshot = createCosUploadProgressSnapshot({
      runState: 'running',
      totalCount: 0,
      completedCount: 0,
      successCount: 0,
      uploadedCount: 0,
      cachedCount: 0,
      failedCount: 0,
      canceledCount: 0,
      canceled: false,
      label: ''
    });
    startCosUploadStopGuard();
    renderActionButtonStates();

    try {
      const uploadPromise = getFeatureCenterCosUploadBridge().uploadPodUploadSheetMiaoshouCosImages({
        runId: state.cosUploadRunId,
        products: state.products,
        imageUploadMode: normalizeImageUploadMode(state.imageUploadMode)
      });
      startCosUploadProgressPolling();
      const result = await uploadPromise;
      const successCount = Number(result && result.successCount) || 0;
      const uploadedCount = Number(result && result.uploadedCount) || 0;
      const cachedCount = Number(result && result.cachedCount) || 0;
      const failedCount = Number(result && result.failedCount) || 0;
      const canceledCount = Number(result && result.canceledCount) || 0;

      state.cosUploadSnapshot = createCosUploadProgressSnapshot({
        updatedAt: normalizeText(result && result.updatedAt),
        runState: result && result.canceled ? 'canceled' : 'completed',
        canceled: Boolean(result && result.canceled),
        totalCount: Number(result && result.totalCount) || 0,
        completedCount: Number(result && result.totalCount) || 0,
        successCount,
        uploadedCount,
        cachedCount,
        failedCount,
        canceledCount,
        label: ''
      });
      renderActionButtonStates();

      if (result && result.canceled) {
        const canceledSummaryParts = [
          `\u56fe\u7247\u4e0a\u4f20\u5df2\u505c\u6b62\uff0c\u6210\u529f ${successCount} \u5f20`,
          `\u65b0\u4f20 ${uploadedCount} \u5f20`,
          `\u7f13\u5b58 ${cachedCount} \u5f20`,
          `\u505c\u6b62 ${canceledCount} \u5f20`
        ];

        if (failedCount > 0) {
          canceledSummaryParts.push(`\u5176\u4e2d\u5931\u8d25 ${failedCount} \u5f20`);
        }

        showWindowNotice(
          `${canceledSummaryParts.join('\uff0c')}\u3002`,
          'warning'
        );
        return;
      }

      showWindowNotice(
        `\u56fe\u7247\u4e0a\u4f20\u5b8c\u6210\uff0c\u6210\u529f ${successCount} \u5f20\uff0c\u65b0\u4f20 ${uploadedCount} \u5f20\uff0c\u7f13\u5b58 ${cachedCount} \u5f20\uff0c\u5931\u8d25 ${failedCount} \u5f20\u3002`,
        failedCount > 0 ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      stopCosUploadProgressPolling();
      state.uploadingCosImages = false;
      state.stoppingCosImages = false;
      state.cosUploadRunId = '';
      resetCosUploadStopGuard();
      renderActionButtonStates();
    }
  }

  function getCarouselPresetRandomOrderImageNames(order) {
    const normalizedOrder = Number.parseInt(order, 10);
    const seenKeys = new Set();

    if (!Number.isInteger(normalizedOrder) || normalizedOrder <= 0) {
      return [];
    }

    return state.products.reduce((result, product) => {
      const itemName = normalizeText(getCarouselItems(product)[normalizedOrder - 1]);
      const key = getMaterialNameKey(itemName);
      const displayName = getCarouselItemDisplayName(product, itemName) || itemName;

      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        result.push(displayName);
      }

      return result;
    }, []);
  }

  function renderCarouselPresetRandomFileNames(itemNames) {
    const normalizedNames = (Array.isArray(itemNames) ? itemNames : [])
      .map((itemName) => normalizeText(itemName))
      .filter(Boolean);

    if (!normalizedNames.length) {
      return '<span class="pod-carousel-preset-random-file-empty">\u6ca1\u6709\u5339\u914d\u5230\u8fd9\u4e2a\u5e8f\u53f7\u7684\u56fe\u7247</span>';
    }

    const visibleNames = normalizedNames.slice(0, 6);
    const remainingCount = Math.max(0, normalizedNames.length - visibleNames.length);

    return `
      <span class="pod-carousel-preset-random-file-list" title="${escapeHtml(normalizedNames.join('\n'))}">
        ${visibleNames.map((itemName) => `
          <span class="pod-carousel-preset-random-file-name">${escapeHtml(itemName)}</span>
        `).join('')}
        ${remainingCount > 0 ? `<span class="pod-carousel-preset-random-file-more">\u8fd8\u6709 ${escapeHtml(String(remainingCount))} \u4e2a\u6587\u4ef6</span>` : ''}
      </span>
    `;
  }

  function renderCarouselPresetRandomOrderList(selectedOrders) {
    if (!selectedOrders.length) {
      return '<div class="pod-empty-state">\u8f93\u5165\u9700\u8981\u968f\u673a\u4e92\u6362\u7684\u8f6e\u64ad\u56fe\u5e8f\u53f7\u3002</div>';
    }

    return selectedOrders.map((order) => {
      const matchedCount = state.products.reduce((count, product) => {
        return getCarouselItems(product).length >= order ? count + 1 : count;
      }, 0);
      const imageNames = getCarouselPresetRandomOrderImageNames(order);

      return `
        <article class="pod-carousel-order-item pod-description-preset-selected-item pod-carousel-preset-random-order-item">
          <span class="pod-carousel-order-index">${escapeHtml(String(order))}</span>
          <span class="pod-description-preset-candidate-copy">
            <span class="pod-carousel-order-name">\u7b2c ${escapeHtml(String(order))} \u5f20</span>
            <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(matchedCount))} \u4e2a\u5546\u54c1</span>
            ${renderCarouselPresetRandomFileNames(imageNames)}
          </span>
          <div class="pod-inline-actions">
            <button
              class="pod-material-action"
              type="button"
              data-pod-carousel-random-order-remove="${escapeHtml(String(order))}"
            >\u79fb\u9664</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function getCarouselPresetRandomOrderCandidates() {
    const maxOrder = state.products.reduce((maxValue, product) => {
      return Math.max(maxValue, getCarouselItems(product).length);
    }, 0);

    return Array.from({ length: maxOrder }, (unused, index) => index + 1);
  }

  function renderCarouselPresetRandomCandidateList(selectedOrders) {
    const orders = getCarouselPresetRandomOrderCandidates();
    const selectedSet = new Set(selectedOrders);

    if (!orders.length) {
      return '';
    }

    return orders.map((order) => {
      const matchedCount = state.products.reduce((count, product) => {
        return getCarouselItems(product).length >= order ? count + 1 : count;
      }, 0);
      const imageNames = getCarouselPresetRandomOrderImageNames(order);
      const isSelected = selectedSet.has(order);

      return `
        <label
          class="pod-carousel-preset-random-candidate ${isSelected ? 'is-selected' : ''}"
          title="${escapeHtml(imageNames.join('\n'))}"
        >
          <input
            type="checkbox"
            data-pod-carousel-random-order="${escapeHtml(String(order))}"
            ${isSelected ? 'checked' : ''}
          />
          <span>\u7b2c ${escapeHtml(String(order))} \u5f20</span>
          <small>${escapeHtml(String(matchedCount))}/${escapeHtml(String(state.products.length))}</small>
        </label>
      `;
    }).join('');
  }

  function setCarouselPresetRandomOrder(order, checked) {
    const normalizedOrder = Number.parseInt(order, 10);

    if (!Number.isInteger(normalizedOrder) || normalizedOrder <= 0) {
      return;
    }

    const selectedOrders = parseSequenceSelectionNumbers(state.carouselPresetRandomOrdersDraft);
    const existingIndex = selectedOrders.indexOf(normalizedOrder);

    if (checked && existingIndex < 0) {
      selectedOrders.push(normalizedOrder);
    }

    if (!checked && existingIndex >= 0) {
      selectedOrders.splice(existingIndex, 1);
    }

    state.carouselPresetRandomOrdersDraft = selectedOrders.sort((left, right) => left - right).join(',');
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function renderCarouselPresetDialog() {
    const modal = getElement('podCarouselPresetModal');
    const summaryElement = getElement('podCarouselPresetSummary');
    const selectedModeInput = getElement('podCarouselPresetModeSelected');
    const randomFirstModeInput = getElement('podCarouselPresetModeRandomFirst');
    const randomOrdersField = getElement('podCarouselPresetRandomOrdersField');
    const randomOrdersInput = getElement('podCarouselPresetRandomOrdersInput');
    const randomCandidateListElement = getElement('podCarouselPresetRandomCandidateList');
    const randomOrderListElement = getElement('podCarouselPresetRandomOrderList');
    const imageNameLayoutElement = getElement('podCarouselPresetImageNameLayout');
    const candidateListElement = getElement('podCarouselPresetCandidateList');
    const selectedListElement = getElement('podCarouselPresetSelectedList');
    const selectedCountElement = getElement('podCarouselPresetSelectedCount');
    const selectAllButton = getElement('podCarouselPresetSelectAllButton');
    const clearButton = getElement('podCarouselPresetClearButton');
    const saveButton = getElement('podCarouselPresetSaveButton');
    const candidates = getCarouselPresetCandidates();
    const candidateMap = getCarouselPresetCandidateMap(candidates);
    const templateCopy = getCurrentTemplateUiCopy();
    const mode = state.carouselPresetMode === 'random-first' ? 'random-first' : 'selected';

    if (!state.carouselPresetModalOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      selectedModeInput.checked = mode === 'selected';
      randomFirstModeInput.checked = mode === 'random-first';
      randomOrdersField.hidden = true;
      randomOrdersInput.value = '';
      randomCandidateListElement.innerHTML = '';
      randomOrderListElement.innerHTML = '';
      imageNameLayoutElement.hidden = false;
      candidateListElement.innerHTML = '';
      selectedListElement.innerHTML = '';
      selectedCountElement.textContent = '0';
      selectAllButton.disabled = true;
      clearButton.disabled = true;
      saveButton.disabled = true;
      return;
    }

    const selectedKeys = (Array.isArray(state.carouselPresetSelectionDraft) ? state.carouselPresetSelectionDraft : [])
      .filter((key, index, items) => key && candidateMap.has(key) && items.indexOf(key) === index);

    state.carouselPresetSelectionDraft = selectedKeys;
    modal.hidden = false;
    selectedModeInput.checked = mode === 'selected';
    randomFirstModeInput.checked = mode === 'random-first';
    randomOrdersField.hidden = mode !== 'random-first';
    imageNameLayoutElement.hidden = mode === 'random-first';

    const normalizedOrdersValue = normalizeSequenceSelection(state.carouselPresetRandomOrdersDraft);
    const selectedOrders = parseSequenceSelectionNumbers(normalizedOrdersValue);

    randomOrdersInput.value = state.carouselPresetRandomOrdersDraft;
    randomCandidateListElement.innerHTML = renderCarouselPresetRandomCandidateList(selectedOrders);
    randomOrderListElement.innerHTML = renderCarouselPresetRandomOrderList(selectedOrders);
    summaryElement.textContent = mode === 'random-first'
      ? `\u5c06\u5728\u5df2\u52fe\u9009\u7684\u8f6e\u64ad\u56fe\u5e8f\u53f7\u4e4b\u95f4\uff0c\u4e3a ${state.products.length} \u4e2a\u5546\u54c1\u968f\u673a\u4e92\u6362\u56fe\u7247\uff0c\u672a\u52fe\u9009\u5e8f\u53f7\u4fdd\u6301\u539f\u4f4d\u3002`
      : formatTemplateCopy(templateCopy.carouselPresetSummary, {
        count: state.products.length
      });
    selectedCountElement.textContent = String(selectedKeys.length);
    selectAllButton.disabled = mode !== 'selected';
    clearButton.disabled = mode === 'random-first' ? !selectedOrders.length : !selectedKeys.length;
    saveButton.disabled = !state.products.length || (mode === 'random-first' ? !selectedOrders.length : !selectedKeys.length);

    if (!candidates.length) {
      candidateListElement.innerHTML = '<div class="pod-empty-state">\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u9884\u8bbe\u7684\u56fe\u7247\u6587\u4ef6\u540d\u3002</div>';
    } else {
      candidateListElement.innerHTML = candidates.map((candidate) => {
        const selectedIndex = selectedKeys.indexOf(candidate.key);
        const isSelected = selectedIndex >= 0;
        const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
          ? candidate.displayNames
          : [candidate.label];

        return `
          <article class="pod-description-preset-candidate-item ${isSelected ? 'is-selected' : ''}" title="${escapeHtml(displayNames.join('\n'))}">
            <label class="pod-description-preset-candidate-toggle">
              <span class="pod-description-preset-candidate-copy">
                <span class="pod-description-preset-candidate-title">${escapeHtml(candidate.label)}</span>
                <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
              </span>
              <span class="pod-description-preset-candidate-meta">
                ${isSelected ? `<span class="pod-carousel-order-index">\u7b2c ${escapeHtml(String(selectedIndex + 1))} \u4f4d</span>` : ''}
                <input
                  class="pod-description-preset-checkbox"
                  type="checkbox"
                  data-pod-carousel-preset-candidate="${escapeHtml(candidate.key)}"
                  ${isSelected ? 'checked' : ''}
                />
              </span>
            </label>
          </article>
        `;
      }).join('');
    }

    if (!selectedKeys.length) {
      selectedListElement.innerHTML = `<div class="pod-empty-state">${escapeHtml(templateCopy.carouselPresetEmptySelection)}</div>`;
      return;
    }

    selectedListElement.innerHTML = selectedKeys.map((key, index) => {
      const candidate = candidateMap.get(key);

      if (!candidate) {
        return '';
      }

      const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
        ? candidate.displayNames
        : [candidate.label];

      return `
        <article class="pod-carousel-order-item pod-description-preset-selected-item" title="${escapeHtml(displayNames.join('\n'))}">
          <span class="pod-carousel-order-index">${escapeHtml(String(index + 1))}</span>
          <span class="pod-description-preset-candidate-copy">
            <span class="pod-carousel-order-name">${escapeHtml(candidate.label)}</span>
            <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
          </span>
          <div class="pod-inline-actions">
            <button
              class="pod-material-action"
              type="button"
              data-pod-carousel-preset-action="up"
              data-pod-carousel-preset-index="${escapeHtml(String(index))}"
              ${index === 0 ? 'disabled' : ''}
            >\u4e0a\u79fb</button>
            <button
              class="pod-material-action"
              type="button"
              data-pod-carousel-preset-action="down"
              data-pod-carousel-preset-index="${escapeHtml(String(index))}"
              ${index === selectedKeys.length - 1 ? 'disabled' : ''}
            >\u4e0b\u79fb</button>
            <button
              class="pod-material-action"
              type="button"
              data-pod-carousel-preset-action="remove"
              data-pod-carousel-preset-index="${escapeHtml(String(index))}"
            >\u79fb\u9664</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function closeCarouselPresetDialog() {
    state.carouselPresetModalOpen = false;
    state.carouselPresetMode = 'selected';
    state.carouselPresetSelectionDraft = [];
    state.carouselPresetRandomOrdersDraft = '';
    renderCarouselPresetDialog();
  }

  function openCarouselPresetDialog() {
    const candidates = getCarouselPresetCandidates();
    const templateCopy = getCurrentTemplateUiCopy();

    if (!state.products.length) {
      showWindowNotice(`\u8bf7\u5148\u5bfc\u5165\u672c\u5730\u5546\u54c1\uff0c\u518d\u6279\u91cf\u9884\u8bbe${templateCopy.carouselOrderName}\u3002`, 'warning');
      return;
    }

    if (!candidates.length) {
      showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u4e8e\u9884\u8bbe\u7684\u56fe\u7247\u6587\u4ef6\u540d\u3002', 'warning');
      return;
    }

    state.carouselPresetModalOpen = true;
    state.carouselPresetMode = normalizeCachedCarouselPresetMode(state.carouselPresetCachedMode);
    state.carouselPresetSelectionDraft = getPreferredPresetSelection(
      candidates,
      state.carouselPresetCachedSelection,
      getCarouselPresetSeedKeys(candidates)
    );
    state.carouselPresetRandomOrdersDraft = normalizeSequenceSelection(state.carouselPresetCachedRandomOrders);
    renderCarouselPresetDialog();
  }

  function setCarouselPresetMode(mode) {
    state.carouselPresetMode = mode === 'random-first' ? 'random-first' : 'selected';
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function toggleCarouselPresetCandidate(candidateKey, checked) {
    const normalizedKey = getMaterialNameKey(candidateKey);
    const selectedKeys = Array.isArray(state.carouselPresetSelectionDraft)
      ? state.carouselPresetSelectionDraft.slice()
      : [];
    const existingIndex = selectedKeys.indexOf(normalizedKey);

    if (checked && existingIndex < 0) {
      selectedKeys.push(normalizedKey);
    }

    if (!checked && existingIndex >= 0) {
      selectedKeys.splice(existingIndex, 1);
    }

    state.carouselPresetSelectionDraft = selectedKeys;
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function moveCarouselPresetSelection(direction, itemIndex) {
    const currentIndex = Number.parseInt(itemIndex, 10);
    const selectedKeys = Array.isArray(state.carouselPresetSelectionDraft)
      ? state.carouselPresetSelectionDraft.slice()
      : [];

    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= selectedKeys.length) {
      return;
    }

    if (direction === 'remove') {
      selectedKeys.splice(currentIndex, 1);
      state.carouselPresetSelectionDraft = selectedKeys;
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= selectedKeys.length) {
      return;
    }

    [selectedKeys[currentIndex], selectedKeys[targetIndex]] = [selectedKeys[targetIndex], selectedKeys[currentIndex]];
    state.carouselPresetSelectionDraft = selectedKeys;
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function selectAllCarouselPresetCandidates() {
    state.carouselPresetSelectionDraft = getCarouselPresetCandidates().map((candidate) => candidate.key);
    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function clearCarouselPresetSelection() {
    if (state.carouselPresetMode === 'random-first') {
      state.carouselPresetRandomOrdersDraft = '';
    } else {
      state.carouselPresetSelectionDraft = [];
    }

    persistCachedCarouselPresetState();
    renderCarouselPresetDialog();
  }

  function saveCarouselPresetDialog() {
    if (state.carouselPresetMode === 'random-first') {
      const selectedOrders = parseSequenceSelectionNumbers(state.carouselPresetRandomOrdersDraft);

      if (selectedOrders.length < 2) {
        showWindowNotice('\u8bf7\u81f3\u5c11\u8f93\u5165 2 \u4e2a\u9700\u8981\u968f\u673a\u4e92\u6362\u7684\u8f6e\u64ad\u56fe\u5e8f\u53f7\u3002', 'warning');
        return;
      }

      state.carouselPresetRandomOrdersDraft = selectedOrders.join(',');
      persistCachedCarouselPresetState({
        immediate: true
      });

      let matchedCount = 0;
      let updatedCount = 0;

      state.products.forEach((product) => {
        const applyResult = applyRandomFirstCarouselPresetToProduct(product, selectedOrders);

        if (applyResult.matched) {
          matchedCount += 1;
        }

        if (applyResult.updated) {
          updatedCount += 1;
        }
      });

      closeCarouselPresetDialog();
      renderAll();
      showWindowNotice(
        `\u5df2\u6309\u5e8f\u53f7\u968f\u673a\u4e92\u6362\u8f6e\u64ad\u56fe\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
        matchedCount === state.products.length ? 'success' : 'warning'
      );
      return;
    }

    const selectedKeys = Array.isArray(state.carouselPresetSelectionDraft)
      ? state.carouselPresetSelectionDraft.slice()
      : [];
    const templateCopy = getCurrentTemplateUiCopy();

    if (!selectedKeys.length) {
      showWindowNotice(`\u8bf7\u5148\u9009\u62e9\u9700\u8981\u6279\u91cf\u9884\u8bbe\u7684${templateCopy.carouselOrderName}\u56fe\u7247\u540d\u3002`, 'warning');
      return;
    }

    persistCachedCarouselPresetState({
      immediate: true
    });

    let matchedCount = 0;
    let updatedCount = 0;

    state.products.forEach((product) => {
      const applyResult = applyCarouselPresetToProduct(product, selectedKeys);

      if (applyResult.matched) {
        matchedCount += 1;
      }

      if (applyResult.updated) {
        updatedCount += 1;
      }
    });

    closeCarouselPresetDialog();
    renderAll();
    showWindowNotice(
      `${templateCopy.carouselPresetSaved}\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
      matchedCount === state.products.length ? 'success' : 'warning'
    );
  }

  function renderDescriptionPresetDialog() {
    const modal = getElement('podDescriptionPresetModal');
    const summaryElement = getElement('podDescriptionPresetSummary');
    const candidateListElement = getElement('podDescriptionPresetCandidateList');
    const selectedListElement = getElement('podDescriptionPresetSelectedList');
    const selectedCountElement = getElement('podDescriptionPresetSelectedCount');
    const clearButton = getElement('podDescriptionPresetClearButton');
    const saveButton = getElement('podDescriptionPresetSaveButton');
    const candidates = getDescriptionPresetCandidates();
    const candidateMap = getDescriptionPresetCandidateMap(candidates);
    const templateCopy = getCurrentTemplateUiCopy();

    if (!state.descriptionPresetModalOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      candidateListElement.innerHTML = '';
      selectedListElement.innerHTML = '';
      selectedCountElement.textContent = '0';
      clearButton.disabled = true;
      saveButton.disabled = false;
      return;
    }

    const selectedKeys = (Array.isArray(state.descriptionPresetSelectionDraft) ? state.descriptionPresetSelectionDraft : [])
      .filter((key, index, items) => key && candidateMap.has(key) && items.indexOf(key) === index);

    state.descriptionPresetSelectionDraft = selectedKeys;
    modal.hidden = false;
    summaryElement.textContent = formatTemplateCopy(templateCopy.descriptionPresetSummary, {
      count: state.products.length
    });
    selectedCountElement.textContent = String(selectedKeys.length);
    clearButton.disabled = !selectedKeys.length;
    saveButton.disabled = !state.products.length;

    if (!candidates.length) {
      candidateListElement.innerHTML = `<div class="pod-empty-state">${escapeHtml(templateCopy.descriptionPresetEmptyCandidates)}</div>`;
    } else {
      candidateListElement.innerHTML = candidates.map((candidate) => {
        const selectedIndex = selectedKeys.indexOf(candidate.key);
        const isSelected = selectedIndex >= 0;
        const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
          ? candidate.displayNames
          : [candidate.label];

        return `
          <article class="pod-description-preset-candidate-item ${isSelected ? 'is-selected' : ''}" title="${escapeHtml(displayNames.join('\n'))}">
            <label class="pod-description-preset-candidate-toggle">
              <span class="pod-description-preset-candidate-copy">
                <span class="pod-description-preset-candidate-title">${escapeHtml(candidate.label)}</span>
                <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
              </span>
              <span class="pod-description-preset-candidate-meta">
                ${isSelected ? `<span class="pod-carousel-order-index">\u7b2c ${escapeHtml(String(selectedIndex + 1))} \u4f4d</span>` : ''}
                <input
                  class="pod-description-preset-checkbox"
                  type="checkbox"
                  data-pod-description-preset-candidate="${escapeHtml(candidate.key)}"
                  ${isSelected ? 'checked' : ''}
                />
              </span>
            </label>
          </article>
        `;
      }).join('');
    }

    if (!selectedKeys.length) {
      selectedListElement.innerHTML = '<div class="pod-empty-state">\u52fe\u9009\u5de6\u4fa7\u56fe\u7247\u540d\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u8c03\u6574\u987a\u5e8f\u3002</div>';
      return;
    }

    selectedListElement.innerHTML = selectedKeys.map((key, index) => {
      const candidate = candidateMap.get(key);

      if (!candidate) {
        return '';
      }

      const displayNames = Array.isArray(candidate.displayNames) && candidate.displayNames.length
        ? candidate.displayNames
        : [candidate.label];

      return `
        <article class="pod-carousel-order-item pod-description-preset-selected-item" title="${escapeHtml(displayNames.join('\n'))}">
          <span class="pod-carousel-order-index">${escapeHtml(String(index + 1))}</span>
          <span class="pod-description-preset-candidate-copy">
            <span class="pod-carousel-order-name">${escapeHtml(candidate.label)}</span>
            <span class="pod-product-note">\u5339\u914d ${escapeHtml(String(candidate.productCount))} \u4e2a\u5546\u54c1</span>
          </span>
          <div class="pod-inline-actions">
            <button
              class="pod-material-action"
              type="button"
              data-pod-description-preset-action="up"
              data-pod-description-preset-index="${escapeHtml(String(index))}"
              ${index === 0 ? 'disabled' : ''}
            >\u4e0a\u79fb</button>
            <button
              class="pod-material-action"
              type="button"
              data-pod-description-preset-action="down"
              data-pod-description-preset-index="${escapeHtml(String(index))}"
              ${index === selectedKeys.length - 1 ? 'disabled' : ''}
            >\u4e0b\u79fb</button>
            <button
              class="pod-material-action"
              type="button"
              data-pod-description-preset-action="remove"
              data-pod-description-preset-index="${escapeHtml(String(index))}"
            >\u79fb\u9664</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function closeDescriptionPresetDialog() {
    state.descriptionPresetModalOpen = false;
    state.descriptionPresetSelectionDraft = [];
    renderDescriptionPresetDialog();
  }

  function openDescriptionPresetDialog() {
    const candidates = getDescriptionPresetCandidates();
    const templateCopy = getCurrentTemplateUiCopy();

    if (!state.products.length) {
      showWindowNotice('\u8bf7\u5148\u5bfc\u5165\u672c\u5730\u5546\u54c1\uff0c\u518d\u6279\u91cf\u9884\u8bbe\u4ea7\u54c1\u63cf\u8ff0\u3002', 'warning');
      return;
    }

    if (!candidates.length) {
      showWindowNotice(templateCopy.descriptionPresetEmptyCandidates, 'warning');
      return;
    }

    state.descriptionPresetModalOpen = true;
    state.descriptionPresetSelectionDraft = getPreferredPresetSelection(
      candidates,
      state.descriptionPresetCachedSelection,
      getDescriptionPresetSeedKeys(candidates)
    );
    renderDescriptionPresetDialog();
  }

  function toggleDescriptionPresetCandidate(candidateKey, checked) {
    const normalizedKey = getMaterialNameKey(candidateKey);
    const selectedKeys = Array.isArray(state.descriptionPresetSelectionDraft)
      ? state.descriptionPresetSelectionDraft.slice()
      : [];
    const existingIndex = selectedKeys.indexOf(normalizedKey);

    if (checked && existingIndex < 0) {
      selectedKeys.push(normalizedKey);
    }

    if (!checked && existingIndex >= 0) {
      selectedKeys.splice(existingIndex, 1);
    }

    state.descriptionPresetSelectionDraft = selectedKeys;
    persistCachedPresetSelection('descriptionPresetCachedSelection', selectedKeys);
    renderDescriptionPresetDialog();
  }

  function moveDescriptionPresetSelection(direction, itemIndex) {
    const currentIndex = Number.parseInt(itemIndex, 10);
    const selectedKeys = Array.isArray(state.descriptionPresetSelectionDraft)
      ? state.descriptionPresetSelectionDraft.slice()
      : [];

    if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= selectedKeys.length) {
      return;
    }

    if (direction === 'remove') {
      selectedKeys.splice(currentIndex, 1);
      state.descriptionPresetSelectionDraft = selectedKeys;
      persistCachedPresetSelection('descriptionPresetCachedSelection', selectedKeys);
      renderDescriptionPresetDialog();
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= selectedKeys.length) {
      return;
    }

    [selectedKeys[currentIndex], selectedKeys[targetIndex]] = [selectedKeys[targetIndex], selectedKeys[currentIndex]];
    state.descriptionPresetSelectionDraft = selectedKeys;
    persistCachedPresetSelection('descriptionPresetCachedSelection', selectedKeys);
    renderDescriptionPresetDialog();
  }

  function selectAllDescriptionPresetCandidates() {
    state.descriptionPresetSelectionDraft = getDescriptionPresetCandidates().map((candidate) => candidate.key);
    persistCachedPresetSelection('descriptionPresetCachedSelection', state.descriptionPresetSelectionDraft);
    renderDescriptionPresetDialog();
  }

  function clearDescriptionPresetSelection() {
    state.descriptionPresetSelectionDraft = [];
    persistCachedPresetSelection('descriptionPresetCachedSelection', state.descriptionPresetSelectionDraft);
    renderDescriptionPresetDialog();
  }

  function saveDescriptionPresetDialog() {
    const selectedKeys = Array.isArray(state.descriptionPresetSelectionDraft)
      ? state.descriptionPresetSelectionDraft.slice()
      : [];

    persistCachedPresetSelection('descriptionPresetCachedSelection', selectedKeys, {
      immediate: true
    });

    if (!state.products.length) {
      closeDescriptionPresetDialog();
      return;
    }

    if (!selectedKeys.length) {
      let clearedCount = 0;

      state.products.forEach((product) => {
        if (normalizeText(product && product.descriptionImageOrders)) {
          clearedCount += 1;
        }

        product.descriptionImageOrders = '';
      });

      closeDescriptionPresetDialog();
      renderAll();
      showWindowNotice(
        clearedCount
          ? `\u5df2\u6e05\u7a7a ${clearedCount} \u4e2a\u5546\u54c1\u7684\u4ea7\u54c1\u63cf\u8ff0\u9884\u8bbe\u3002`
          : '\u5df2\u6e05\u7a7a\u4ea7\u54c1\u63cf\u8ff0\u9884\u8bbe\u3002',
        'success'
      );
      return;
    }

    let matchedCount = 0;
    let updatedCount = 0;

    state.products.forEach((product) => {
      const nextOrders = getDescriptionPresetOrdersForProduct(product, selectedKeys);

      if (nextOrders) {
        matchedCount += 1;
      }

      if (normalizeText(product && product.descriptionImageOrders) !== nextOrders) {
        updatedCount += 1;
      }

      product.descriptionImageOrders = nextOrders;
    });

    closeDescriptionPresetDialog();
    renderAll();
    showWindowNotice(
      `\u5df2\u6279\u91cf\u9884\u8bbe\u4ea7\u54c1\u63cf\u8ff0\uff0c\u5339\u914d ${matchedCount}/${state.products.length} \u4e2a\u5546\u54c1\uff0c\u66f4\u65b0 ${updatedCount} \u4e2a\u5546\u54c1\u3002`,
      matchedCount === state.products.length ? 'success' : 'warning'
    );
  }

  function getSkuImageOptionItems(skuRows, product = getActiveProduct()) {
    const optionMap = new Map();
    const carouselItems = product && product.materials && Array.isArray(product.materials.carousel)
      ? product.materials.carousel
      : [];

    carouselItems.forEach((itemName, index) => {
      const orderText = String(index + 1);
      const normalizedItemName = normalizeText(itemName);
      optionMap.set(
        orderText,
        normalizedItemName ? `\u7b2c${orderText}\u5f20 (${normalizedItemName})` : `\u7b2c${orderText}\u5f20`
      );
    });

    (Array.isArray(skuRows) ? skuRows : []).forEach((row) => {
      const orderText = normalizePositiveIntegerString(row && row.skuImage);

      if (orderText && !optionMap.has(orderText)) {
        optionMap.set(orderText, `\u7b2c${orderText}\u5f20`);
      }
    });

    return Array.from(optionMap.entries())
      .sort((left, right) => Number.parseInt(left[0], 10) - Number.parseInt(right[0], 10))
      .map(([value, label]) => ({ value, label }));
  }

  function renderSkuImageSelect(row, optionItems) {
    const currentValue = normalizePositiveIntegerString(row && row.skuImage);
    const options = [
      '<option value="">\u672a\u9009\u62e9</option>',
      ...optionItems.map((item) => {
        const selected = item.value === currentValue ? ' selected' : '';
        return `<option value="${escapeHtml(item.value)}"${selected}>${escapeHtml(item.label)}</option>`;
      })
    ];

    return `
      <select class="pod-sku-table-input pod-sku-table-select" data-sku-config-field="skuImage" data-sku-row-key="${escapeHtml(row.key)}">
        ${options.join('')}
      </select>
    `;
  }

  function getProductStatus(product) {
    if (normalizeText(product && product.aiTitleStatus) === 'processing') {
      return {
        label: 'AI\u751f\u6210\u4e2d',
        tone: 'working'
      };
    }

    if (normalizeText(product && product.aiTitleStatus) === 'canceled') {
      return {
        label: '\u5df2\u505c\u6b62',
        tone: 'pending'
      };
    }

    if (normalizeText(product && product.aiTitleStatus) === 'failed') {
      return {
        label: 'AI\u5931\u8d25',
        tone: 'danger'
      };
    }

    const totalCount = getTotalMaterialCount(product);

    if (totalCount <= 0) {
      return {
        label: '\u5f85\u8865\u7d20\u6750',
        tone: 'empty'
      };
    }

    if (!normalizeText(product.title) || !normalizeText(product.englishTitle)) {
      return {
        label: '\u5f85\u5b8c\u5584\u6807\u9898',
        tone: 'pending'
      };
    }

    return {
      label: '\u53ef\u7ee7\u7eed\u5904\u7406',
      tone: 'ready'
    };
  }

  function showWindowNotice(message, tone) {
    const notice = getElement('podWindowNotice');

    window.clearTimeout(state.windowNoticeTimer);
    notice.textContent = normalizeText(message) || '\u64cd\u4f5c\u5b8c\u6210';
    notice.className = 'pod-window-notice is-visible';

    if (tone) {
      notice.classList.add(`is-${tone}`);
    }

    notice.hidden = false;
    state.windowNoticeTimer = window.setTimeout(() => {
      notice.classList.remove('is-visible');
      state.windowNoticeTimer = window.setTimeout(() => {
        notice.hidden = true;
      }, 180);
    }, 2200);
  }

  window.showPodUploadSheetNotice = showWindowNotice;

  function toggleButtonBusy(button, isBusy, busyText) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent || '';
    }

    button.disabled = Boolean(isBusy);
    button.textContent = isBusy ? busyText : button.dataset.defaultLabel;
  }

  function renderTemplateSummary() {}

  function renderTemplateCards() {
    const container = getElement('podTemplateCards');
    const currentTemplateId = normalizeText(state.globalProductSettings.templateId) || 'non-fashion';

    container.innerHTML = TEMPLATE_OPTIONS.map((option) => {
      const snapshotItem = getTemplateSnapshotById(option.id);
      const exists = Boolean(snapshotItem && snapshotItem.exists);

      return `
        <article class="pod-template-card ${option.id === currentTemplateId ? 'is-active' : ''}">
          <div class="pod-template-card-head">
            <div class="pod-template-card-copy">
              <h3 class="pod-template-card-title">${escapeHtml(option.label)}</h3>
              <p class="pod-template-card-text">
                ${exists ? '\u5df2\u7f13\u5b58\u5230\u672c\u5730\uff0c\u53ef\u76f4\u63a5\u5bfc\u51fa' : '\u672c\u5730\u6682\u65e0\u7f13\u5b58'}
              </p>
            </div>
          </div>

          <div class="pod-template-card-meta">
            <div class="pod-template-card-copy">
              <p class="pod-template-card-text">\u6587\u4ef6\u540d</p>
              <p class="pod-template-path">${escapeHtml(normalizeText(snapshotItem && snapshotItem.fileName) || option.label)}</p>
            </div>
            <div class="pod-template-card-copy">
              <p class="pod-template-card-text">\u5927\u5c0f</p>
              <p class="pod-template-path">${escapeHtml(formatBytes(snapshotItem && snapshotItem.contentLength))}</p>
            </div>
          </div>

          <div class="pod-template-card-copy">
            <p class="pod-template-card-text">\u6700\u8fd1\u540c\u6b65</p>
            <p class="pod-template-path">${escapeHtml(formatTime(snapshotItem && snapshotItem.syncedAt))}</p>
          </div>
        </article>
      `;
    }).join('');
  }

  function getSelectedFormTemplate() {
    return (
      Array.isArray(state.formTemplateSnapshot.templates)
        ? state.formTemplateSnapshot.templates
        : []
    ).find((item) => item.id === state.selectedFormTemplateId) || null;
  }

  function setSelectedFormTemplateId(templateId) {
    state.selectedFormTemplateId = normalizeText(templateId);
    state.formTemplateDropdownOpen = false;

    const selectedTemplate = getSelectedFormTemplate();
    getElement('podFormTemplateNameInput').value = selectedTemplate ? selectedTemplate.name : '';
    renderFormTemplateSelect();
  }

  async function selectAndApplyFormTemplate(templateId, options = {}) {
    const { showNotice = true } = options;
    const normalizedTemplateId = normalizeText(templateId);
    const selectedTemplate = (
      Array.isArray(state.formTemplateSnapshot.templates)
        ? state.formTemplateSnapshot.templates
        : []
    ).find((item) => item.id === normalizedTemplateId) || null;

    if (!normalizedTemplateId || !selectedTemplate) {
      setSelectedFormTemplateId(normalizedTemplateId);
      return false;
    }

    if (
      shouldConfirmBeforeApplyingFormTemplate(selectedTemplate)
      && !(await getDialogBridge().confirm({
        tone: 'warning',
        title: '\u5957\u7528\u586b\u5199\u6a21\u677f',
        badgeText: '\u5185\u5bb9\u8986\u76d6',
        message: `\u5f53\u524d\u586b\u5199\u5185\u5bb9\u5c06\u88ab\u6a21\u677f\u201c${selectedTemplate.name}\u201d\u8986\u76d6\uff0c\u786e\u8ba4\u7ee7\u7eed\u5417\uff1f`,
        detail: '\u5957\u7528\u540e\uff0c\u5f53\u524d\u7684\u6a21\u677f\u5b57\u6bb5\u3001SKU \u914d\u7f6e\u548c AI \u6807\u9898\u524d\u540e\u7f00\u4f1a\u6309\u6240\u9009\u6a21\u677f\u66f4\u65b0\u3002',
        confirmText: '\u7ee7\u7eed\u5957\u7528',
        cancelText: '\u4fdd\u7559\u5f53\u524d\u586b\u5199'
      }))
    ) {
      renderFormTemplateSelect();
      return false;
    }

    state.selectedFormTemplateId = normalizedTemplateId;
    state.formTemplateDropdownOpen = false;
    applyFormTemplate(selectedTemplate);
    getElement('podFormTemplateNameInput').value = selectedTemplate.name;

    if (showNotice) {
      showWindowNotice(`\u5df2\u81ea\u52a8\u5957\u7528\u586b\u5199\u6a21\u677f\uff1a${selectedTemplate.name}`, 'success');
    }

    return true;
  }

  function renderFormTemplateSummary() {}

  function renderFormTemplateSelect() {
    const select = getElement('podFormTemplateSelect');
    const pickerButton = getElement('podFormTemplatePickerButton');
    const pickerLabel = getElement('podFormTemplatePickerLabel');
    const deleteButton = getElement('podDeleteFormTemplateButton');
    const templates = Array.isArray(state.formTemplateSnapshot.templates)
      ? state.formTemplateSnapshot.templates
      : [];

    if (!templates.some((item) => item.id === state.selectedFormTemplateId)) {
      state.selectedFormTemplateId = '';
    }

    select.replaceChildren();

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '\u9009\u62e9\u5df2\u4fdd\u5b58\u6a21\u677f';
    select.appendChild(defaultOption);

    templates.forEach((template) => {
      const option = document.createElement('option');
      option.value = normalizeText(template.id);
      option.textContent = normalizeText(template.name);
      select.appendChild(option);
    });

    select.value = state.selectedFormTemplateId || '';
    pickerLabel.textContent = state.selectedFormTemplateId && getSelectedFormTemplate()
      ? getSelectedFormTemplate().name
      : '\u9009\u62e9\u5df2\u4fdd\u5b58\u6a21\u677f';
    pickerButton.setAttribute('aria-expanded', state.formTemplateDropdownOpen ? 'true' : 'false');
    pickerButton.disabled = false;
    deleteButton.disabled = !state.selectedFormTemplateId || state.deletingFormTemplate;
    renderFormTemplatePickerModal();
  }

  function renderFormTemplatePickerModal() {
    const modal = getElement('podFormTemplateModal');
    const summaryElement = getElement('podFormTemplateModalSummary');
    const listElement = getElement('podFormTemplateModalList');
    const templates = Array.isArray(state.formTemplateSnapshot.templates)
      ? state.formTemplateSnapshot.templates
      : [];

    if (!state.formTemplateDropdownOpen) {
      modal.hidden = true;
      summaryElement.textContent = '';
      listElement.innerHTML = '';
      return;
    }

    modal.hidden = false;

    if (state.loadingFormTemplateSnapshot) {
      summaryElement.textContent = '\u6b63\u5728\u8bfb\u53d6\u6a21\u677f...';
      listElement.innerHTML = '<div class="pod-empty-state">\u6b63\u5728\u8bfb\u53d6\u5df2\u4fdd\u5b58\u6a21\u677f...</div>';
      return;
    }

    summaryElement.textContent = templates.length
      ? `\u5df2\u4fdd\u5b58 ${templates.length} \u4e2a\u586b\u5199\u6a21\u677f`
      : '\u6682\u65e0\u5df2\u4fdd\u5b58\u6a21\u677f';

    if (!templates.length) {
      listElement.innerHTML = '<div class="pod-empty-state">\u8fd8\u6ca1\u6709\u5df2\u4fdd\u5b58\u7684\u586b\u5199\u6a21\u677f</div>';
      return;
    }

    listElement.innerHTML = templates.map((template) => {
      const templateId = normalizeText(template.id);
      const templateName = normalizeText(template.name) || '\u672a\u547d\u540d\u6a21\u677f';
      const updatedText = formatTime(template.updatedAt)
        ? `\u6700\u8fd1\u66f4\u65b0\uff1a${formatTime(template.updatedAt)}`
        : '\u672a\u8bb0\u5f55\u66f4\u65b0\u65f6\u95f4';
      const isActive = templateId === state.selectedFormTemplateId;

      return `
        <button
          class="pod-form-template-option${isActive ? ' is-active' : ''}"
          type="button"
          data-form-template-id="${escapeHtml(templateId)}"
          role="option"
          aria-selected="${isActive ? 'true' : 'false'}"
        >
          <span class="pod-form-template-option-name">${escapeHtml(templateName)}</span>
          <span class="pod-form-template-option-meta">${escapeHtml(updatedText)}</span>
        </button>
      `;
    }).join('');
  }

  function renderTemplateSelectOptions() {
    const select = getElement('podTemplateSelect');

    if (select.dataset.initialized === 'true') {
      return;
    }

    select.innerHTML = TEMPLATE_OPTIONS.map((option) => {
      return `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`;
    }).join('');
    select.dataset.initialized = 'true';
  }

  function renderCategoryOptions() {
    const select = getElement('podCategorySelect');

    if (!categoryOptions.length) {
      select.innerHTML = '<option value="">\u7c7b\u76ee\u5217\u8868\u52a0\u8f7d\u5931\u8d25</option>';
      return;
    }

    select.innerHTML = categoryOptions.map((option) => {
      return `<option value="${escapeHtml(option.id)}">${escapeHtml(`${option.id} ${option.label}`)}</option>`;
    }).join('');
    select.dataset.initialized = 'true';
  }

  function getFilteredProducts() {
    return state.products.slice();
  }

  function renderProductListSummary(filteredProducts) {
    void filteredProducts;
  }

  function renderProductStatusBadge(status) {
    return `<span class="pod-product-status is-${escapeHtml(status.tone)}" data-product-row-status>${escapeHtml(status.label)}</span>`;
  }

  function syncProductListActiveState() {
    document.querySelectorAll('[data-product-row-id]').forEach((element) => {
      const productId = normalizeText(element.getAttribute('data-product-row-id'));
      element.classList.toggle('is-active', productId === state.activeProductId);
    });
  }

  function syncProductRowStatus(productId) {
    const product = state.products.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    const row = Array.from(document.querySelectorAll('[data-product-row-id]')).find((element) => {
      return normalizeText(element.getAttribute('data-product-row-id')) === productId;
    });

    if (!(row instanceof HTMLElement)) {
      return;
    }

    const statusElement = row.querySelector('[data-product-row-status]');

    if (!(statusElement instanceof HTMLElement)) {
      return;
    }

    const status = getProductStatus(product);
    statusElement.className = `pod-product-status is-${status.tone}`;
    statusElement.textContent = status.label;
  }

  function activateProductFromList(productId) {
    if (!state.products.some((product) => product.id === productId)) {
      return;
    }

    if (state.activeProductId === productId) {
      return;
    }

    state.activeProductId = productId;
    syncProductListActiveState();
    renderEditor();
  }

  function renderProductList() {
    const container = getElement('podProductTableBody');
    const filteredProducts = getFilteredProducts();
    const templateCopy = getCurrentTemplateUiCopy();

    renderProductListSummary(filteredProducts);

    if (!state.products.length) {
      container.innerHTML = `
        <div class="pod-empty-state">
          \u8fd8\u6ca1\u6709\u672c\u5730\u5546\u54c1\u6570\u636e\uff0c\u70b9\u51fb\u201c\u6279\u91cf\u5bfc\u5165\u672c\u5730\u5546\u54c1\u201d\u540e\u5373\u53ef\u8f7d\u5165\u3002
        </div>
      `;
      return;
    }

    if (!filteredProducts.length) {
      container.innerHTML = `
        <div class="pod-empty-state">
          \u6ca1\u6709\u5339\u914d\u5230\u641c\u7d22\u7ed3\u679c\uff0c\u8bf7\u6362\u4e2a\u5173\u952e\u5b57\u8bd5\u8bd5\u3002
        </div>
      `;
      return;
    }

    container.innerHTML = filteredProducts.map((product) => {
      const status = getProductStatus(product);
      const sourceText = normalizeText(product.sourceFolder) || '\u624b\u52a8\u65b0\u5efa';
      const mainNumberText = getProductMainNumberValue(product) || '-';
      const masterSkuText = getProductMasterSkuValue(product) || '-';
      const categoryText = getCategoryDisplayText(product.category);
      const descriptionImageOrders = normalizeSequenceSelection(product.descriptionImageOrders);
      const descriptionPreviewText = getDescriptionImagePreviewText(product);
      const carouselPreviewText = getCarouselPreviewText(product);
      const aiDetailText = normalizeText(product.aiTitleError) || normalizeText(product.aiTitlePatternSummary);
      return `
        <article
          class="pod-product-table-row ${product.id === state.activeProductId ? 'is-active' : ''}"
          data-product-row-id="${escapeHtml(product.id)}"
        >
          <span class="pod-product-cell pod-product-cell-main">
            <span class="pod-product-name">${escapeHtml(product.localName || '\u672a\u547d\u540d\u5546\u54c1')}</span>
            <span class="pod-product-note">\u6765\u6e90\uff1a${escapeHtml(sourceText)}</span>
          </span>
          <label class="pod-product-cell pod-product-cell-editor">
            <textarea
              class="pod-product-inline-input"
              rows="3"
              placeholder="\u6279\u91cf\u586b\u5199\u4ea7\u54c1\u6807\u9898"
              maxlength="255"
              data-product-list-field="title"
              data-product-list-row-id="${escapeHtml(product.id)}"
            >${escapeHtml(product.title)}</textarea>
          </label>
          <label class="pod-product-cell pod-product-cell-editor">
            <textarea
              class="pod-product-inline-input"
              rows="3"
              placeholder="\u6279\u91cf\u586b\u5199\u82f1\u6587\u6807\u9898"
              maxlength="255"
              data-product-list-field="englishTitle"
              data-product-list-row-id="${escapeHtml(product.id)}"
            >${escapeHtml(product.englishTitle)}</textarea>
          </label>
          <span class="pod-product-cell">
            <span class="pod-product-note pod-product-preview-note">${escapeHtml(carouselPreviewText)}</span>
          </span>
          <label class="pod-product-cell pod-product-cell-editor">
            <textarea
              class="pod-product-inline-input"
              rows="3"
              placeholder="${escapeHtml(templateCopy.descriptionOrderPlaceholder)}"
              data-product-list-field="descriptionImageOrders"
              data-product-list-row-id="${escapeHtml(product.id)}"
            >${escapeHtml(descriptionImageOrders)}</textarea>
            <span class="pod-product-note pod-product-preview-note" data-product-description-preview>${escapeHtml(descriptionPreviewText)}</span>
          </label>
          <span class="pod-product-cell">
            <span class="pod-product-count">${escapeHtml(getTemplateLabel(product.templateId))}</span>
          </span>
          <span class="pod-product-cell">
            <span class="pod-product-note">${escapeHtml(categoryText)}</span>
          </span>
          <span class="pod-product-cell">
            <span class="pod-product-count">${escapeHtml(mainNumberText)}</span>
          </span>
          <span class="pod-product-cell">
            <span class="pod-product-count">${escapeHtml(masterSkuText)}</span>
          </span>
          <span class="pod-product-cell">
            ${renderProductStatusBadge(status)}
          </span>
        </article>
      `;
    }).join('');
  }

  function fillEditorFields() {
    document.querySelectorAll('[data-global-product-field]').forEach((element) => {
      const fieldName = normalizeText(element.getAttribute('data-global-product-field'));

      if (!fieldName) {
        return;
      }

      element.value = normalizeGlobalProductFieldValue(fieldName, state.globalProductSettings[fieldName]);
    });
  }

  function renderActiveProductHeader() {
    const titleElement = getElement('podActiveProductTitle');
    titleElement.textContent = '\u5546\u54c1\u57fa\u7840\u4fe1\u606f';
  }

  function renderSkuEditor() {
    const summaryElement = getElement('podSkuEditorSummary');
    const container = getElement('podSkuTableBody');
    const skuRows = getSkuEditorRows(state.globalProductSettings);
    const skuImageOptionItems = getSkuImageOptionItems(skuRows);

    if (!skuRows.length) {
      summaryElement.textContent = '\u5148\u586b\u5199\u89c4\u683c\u5c5e\u6027\uff0c\u7cfb\u7edf\u4f1a\u6309\u89c4\u5219\u81ea\u52a8\u751f\u6210 SKU \u884c\u3002';
      container.innerHTML = `
        <div class="pod-empty-state">
          \u89c4\u683c\u5c5e\u60271\u3001\u89c4\u683c\u5c5e\u60272 \u8fd8\u6ca1\u586b\u5199\uff0c\u6682\u65f6\u65e0\u6cd5\u751f\u6210 SKU \u7ea7\u914d\u7f6e\u3002
        </div>
      `;
      return;
    }

    summaryElement.textContent = `\u5df2\u751f\u6210 ${skuRows.length} \u884c SKU \u7ec4\u5408\uff0c\u914d\u7f6e\u4f1a\u6309\u884c\u5206\u522b\u4fdd\u5b58\u3002`;
    container.innerHTML = skuRows.map((row) => {
      return `
        <div class="pod-sku-table-row" data-sku-row-key="${escapeHtml(row.key)}">
          <span class="pod-sku-table-value">${escapeHtml(row.specValueOne || '-')}</span>
          <span class="pod-sku-table-value">${escapeHtml(row.specValueTwo || '-')}</span>
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.declaredPrice)}" data-sku-config-field="declaredPrice" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.price)}" data-sku-config-field="price" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.length)}" data-sku-config-field="length" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.width)}" data-sku-config-field="width" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.height)}" data-sku-config-field="height" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.weight)}" data-sku-config-field="weight" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.stock)}" data-sku-config-field="stock" data-sku-row-key="${escapeHtml(row.key)}" />
          ${renderSkuImageSelect(row, skuImageOptionItems)}
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.platformSku)}" data-sku-config-field="platformSku" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.skuCategoryType)}" data-sku-config-field="skuCategoryType" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.skuCategoryCount)}" data-sku-config-field="skuCategoryCount" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.skuCategoryUnit)}" data-sku-config-field="skuCategoryUnit" data-sku-row-key="${escapeHtml(row.key)}" />
          <input class="pod-sku-table-input" type="text" value="${escapeHtml(row.independentPackaging)}" data-sku-config-field="independentPackaging" data-sku-row-key="${escapeHtml(row.key)}" />
        </div>
      `;
    }).join('');
  }

  function renderEditor() {
    const product = getActiveProduct();

    renderActiveProductHeader();
    renderSkuEditor();
    fillEditorFields();
  }

  function renderAll() {
    renderTemplateAwareCopy();
    renderTemplateSummary();
    renderTemplateCards();
    renderFormTemplateSummary();
    renderFormTemplateSelect();
    renderProductList();
    renderEditor();
    renderActionButtonStates();
    renderAiTitleControls();
    renderCarouselPresetDialog();
    renderDescriptionPresetDialog();
    renderFieldHelpBadges();
  }

  function selectProduct(productId) {
    if (!state.products.some((product) => product.id === productId)) {
      return;
    }

    state.activeProductId = productId;
    renderAll();
  }

  function addProducts(products) {
    const nextProducts = Array.isArray(products) ? products.filter(Boolean) : [];

    if (!nextProducts.length) {
      return;
    }

    syncGlobalProductSettingsToProducts(nextProducts);
    state.products.push(...nextProducts);

    if (!getActiveProduct()) {
      state.activeProductId = nextProducts[0].id;
    }
  }

  async function handleClearProducts() {
    if (!state.products.length) {
      return;
    }

    if (!(await getDialogBridge().confirm({
      tone: 'danger',
      title: '\u6e05\u7a7a\u5546\u54c1\u5217\u8868',
      badgeText: '\u4e0d\u53ef\u64a4\u9500',
      message: '\u786e\u8ba4\u6e05\u7a7a\u5f53\u524d\u672c\u5730\u5546\u54c1\u5217\u8868\u5417\uff1f',
      detail: '\u6e05\u7a7a\u540e\uff0c\u5f53\u524d\u7a97\u53e3\u91cc\u7684\u672c\u5730\u5546\u54c1\u3001\u89c4\u683c\u7f16\u8f91\u548c\u6279\u91cf\u9884\u8bbe\u7ed3\u679c\u90fd\u4f1a\u88ab\u79fb\u9664\u3002',
      confirmText: '\u786e\u8ba4\u6e05\u7a7a',
      cancelText: '\u53d6\u6d88'
    }))) {
      return;
    }

    state.products = [];
    state.activeProductId = '';
    renderAll();
    showWindowNotice('\u672c\u5730\u5546\u54c1\u5217\u8868\u5df2\u6e05\u7a7a\u3002', 'warning');
  }

  function classifyExplicitSection(fileName, relativePath) {
    const text = `${normalizeText(fileName)} ${normalizeText(relativePath)}`.toLowerCase();

    if (/(preview|mockup)/.test(text)) {
      return 'preview';
    }

    if (/(detail|asset|size)/.test(text)) {
      return 'assets';
    }

    if (/(carousel|banner|main)/.test(text)) {
      return 'carousel';
    }

    return '';
  }

  function getImportedProductGroup(file) {
    const relativePath = normalizeText(file && file.webkitRelativePath);
    const segments = relativePath.split('/').filter(Boolean);

    if (segments.length >= 3) {
      return {
        productKey: normalizeText(segments[1]) || '\u672a\u547d\u540d\u5546\u54c1',
        sourceFolder: `${segments[0]}/${segments[1]}`
      };
    }

    if (segments.length === 2) {
      return {
        productKey: normalizeText(segments[0]) || '\u672a\u547d\u540d\u5546\u54c1',
        sourceFolder: segments[0]
      };
    }

    return {
      productKey: '\u6839\u76ee\u5f55\u5546\u54c1',
      sourceFolder: ''
    };
  }

  function buildProductsFromImportedFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    const groupedProducts = new Map();

    files.forEach((file) => {
      const groupInfo = getImportedProductGroup(file);
      const groupKey = `${groupInfo.sourceFolder}__${groupInfo.productKey}`;
      const filePath = getLocalFilePath(file);

      if (!groupedProducts.has(groupKey)) {
        groupedProducts.set(groupKey, {
          localName: groupInfo.productKey,
          sourceFolder: groupInfo.sourceFolder,
          materials: {
            carousel: [],
            assets: [],
            preview: []
          },
          materialPathMap: createEmptyMaterialPathMap(),
          pendingItems: [],
          pendingPathMap: {}
        });
      }

      const group = groupedProducts.get(groupKey);
      const fileName = normalizeImportedMaterialName(file && file.name, {
        productKey: groupInfo.productKey,
        sourceFolder: groupInfo.sourceFolder,
        relativePath: file && file.webkitRelativePath
      }) || '\u672a\u547d\u540d\u56fe\u7247';
      const explicitSection = classifyExplicitSection(fileName, file && file.webkitRelativePath);
      const fileKey = getMaterialNameKey(fileName);

      if (explicitSection) {
        group.materials[explicitSection].push(fileName);

        if (fileKey && filePath && !group.materialPathMap[explicitSection][fileKey]) {
          group.materialPathMap[explicitSection][fileKey] = filePath;
        }
      } else {
        group.pendingItems.push(fileName);

        if (fileKey && filePath && !group.pendingPathMap[fileKey]) {
          group.pendingPathMap[fileKey] = filePath;
        }
      }
    });

    return Array.from(groupedProducts.values()).map((group) => {
      const pendingItems = group.pendingItems.slice();
      const carouselItems = group.materials.carousel.slice();
      const assetsItems = group.materials.assets.slice();
      const carouselPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).carousel
      };
      const assetsPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).assets
      };
      const previewPathMap = {
        ...normalizeMaterialPathMap(group.materialPathMap).preview
      };

      while (pendingItems.length) {
        const nextItemName = pendingItems.shift();
        const nextItemKey = getMaterialNameKey(nextItemName);

        carouselItems.push(nextItemName);

        if (nextItemKey && group.pendingPathMap[nextItemKey] && !carouselPathMap[nextItemKey]) {
          carouselPathMap[nextItemKey] = group.pendingPathMap[nextItemKey];
        }
      }

      assetsItems.push(...pendingItems);
      pendingItems.forEach((itemName) => {
        const itemKey = getMaterialNameKey(itemName);

        if (itemKey && group.pendingPathMap[itemKey] && !assetsPathMap[itemKey]) {
          assetsPathMap[itemKey] = group.pendingPathMap[itemKey];
        }
      });

      return createEmptyProduct({
        localName: group.localName,
        sourceFolder: group.sourceFolder,
        materials: {
          carousel: carouselItems,
          assets: assetsItems,
          preview: group.materials.preview.slice()
        },
        materialPathMap: {
          carousel: carouselPathMap,
          assets: assetsPathMap,
          preview: previewPathMap
        }
      });
    });
  }

  function getImportedDirectoryPath(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    const sampleFile = files.find((file) => {
      return getLocalFilePath(file) && normalizeText(file && file.webkitRelativePath);
    });

    if (!sampleFile) {
      return '';
    }

    const absolutePathText = getLocalFilePath(sampleFile);
    const relativePathSegments = normalizeText(sampleFile.webkitRelativePath)
      .split('/')
      .filter(Boolean);
    const absolutePathSegments = absolutePathText
      .split(/[\\/]+/)
      .filter(Boolean);

    if (!absolutePathSegments.length || !relativePathSegments.length) {
      return '';
    }

    const rootSegmentCount = absolutePathSegments.length - relativePathSegments.length + 1;

    if (rootSegmentCount <= 0) {
      return '';
    }

    const rootSegments = absolutePathSegments.slice(0, rootSegmentCount);
    const separator = absolutePathText.includes('\\') ? '\\' : '/';
    let result = rootSegments.join(separator);

    if (/^[A-Za-z]:$/.test(rootSegments[0])) {
      result = rootSegments.length > 1
        ? `${rootSegments[0]}${separator}${rootSegments.slice(1).join(separator)}`
        : `${rootSegments[0]}${separator}`;
    } else if (absolutePathText.startsWith('/')) {
      result = `/${result}`;
    }

    return result;
  }

  function handleImportProducts(fileList, options = {}) {
    const explicitDirectoryPath = normalizeText(options && options.directoryPath);
    const products = buildProductsFromImportedFiles(fileList);
    const importedDirectoryPath = explicitDirectoryPath || getImportedDirectoryPath(fileList);

    if (!products.length) {
      if (importedDirectoryPath) {
        state.lastImportDirectoryPath = importedDirectoryPath;
        scheduleWorkspaceStateSave({
          immediate: true,
          showErrorNotice: true
        });
      }

      showWindowNotice('\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u5bfc\u5165\u7684\u672c\u5730\u5546\u54c1\u56fe\u7247\u3002', 'warning');
      return;
    }

    addProducts(products);
    products.forEach((product) => {
      applyImportedSourceMappingsToProduct(product);
    });
    state.lastImportDirectoryPath = importedDirectoryPath || state.lastImportDirectoryPath;
    state.activeProductId = products[0].id;
    renderAll();
    scheduleWorkspaceStateSave({
      immediate: true,
      showErrorNotice: true
    });
    showWindowNotice(
      `\u5df2\u4ece\u672c\u5730\u76ee\u5f55\u8f7d\u5165 ${products.length} \u5957\u5546\u54c1\uff0c\u5e76\u5df2\u751f\u6210\u4e3b\u7f16\u53f7\u3001\u4e3b\u8d27\u53f7\u548c\u7eaf\u6570\u5b57\u4ea7\u54c1\u7f16\u7801`,
      'success'
    );
  }

  async function openImportProductsDialog() {
    try {
      const result = await getFeatureCenterBridge().selectPodUploadSheetMiaoshouImportDirectory({
        defaultPath: state.lastImportDirectoryPath
      });

      if (!result || result.canceled) {
        return;
      }

      handleImportProducts(result.files, {
        directoryPath: normalizeText(result.directoryPath)
      });
    } catch (error) {
      showWindowNotice(
        '\u9009\u62e9\u672c\u5730\u5546\u54c1\u76ee\u5f55\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    }
  }

  function collectMaterialSelection(files, mode, product) {
    const nextFiles = Array.from(files || []).filter(Boolean);
    const materialEntries = nextFiles
      .map((file) => ({
        name: normalizeImportedMaterialName(file && file.name, {
          productKey: product && product.localName,
          sourceFolder: product && product.sourceFolder,
          relativePath: file && file.webkitRelativePath
        }),
        path: getLocalFilePath(file)
      }))
      .filter((entry) => normalizeText(entry.name));
    const folderNames = Array.from(new Set(
      nextFiles
        .map((file) => {
          const relativePath = normalizeText(file && file.webkitRelativePath);
          return relativePath ? relativePath.split('/')[0] : '';
        })
        .filter(Boolean)
    ));
    const itemNames = Array.from(new Set(
      materialEntries.map((entry) => normalizeText(entry.name)).filter(Boolean)
    ));
    const pathMap = materialEntries.reduce((result, entry) => {
      const itemName = normalizeText(entry.name);
      const itemPath = normalizeText(entry.path);
      const itemKey = getMaterialNameKey(itemName);

      if (itemKey && itemPath && !result[itemKey]) {
        result[itemKey] = itemPath;
      }

      return result;
    }, {});

    let summary = '\u5c1a\u672a\u9009\u62e9\u7d20\u6750';

    if (itemNames.length) {
      summary = mode === 'folder' && folderNames.length
        ? `\u5df2\u9009\u62e9 ${folderNames.length} \u4e2a\u6587\u4ef6\u5939\uff0c\u5171 ${itemNames.length} \u5f20\u56fe\u7247`
        : `\u5df2\u9009\u62e9 ${itemNames.length} \u5f20\u56fe\u7247`;
    }

    return {
      items: itemNames,
      pathMap,
      summary
    };
  }

  function applyMaterialsToActiveProduct(sectionId, files, mode) {
    const product = getActiveProduct();
    const section = getMaterialSectionById(sectionId);

    if (!product || !section) {
      return;
    }

    const selection = collectMaterialSelection(files, mode, product);
    product.materials[sectionId] = selection.items.slice();
    product.materialPathMap[sectionId] = {
      ...(selection.pathMap || {})
    };

    if (product.codeValueDerivedFromSource) {
      applyImportedSourceMappingsToProduct(product);
    }

    renderAll();
    showWindowNotice(`${section.title}\u5df2\u66f4\u65b0\uff0c\u5171 ${selection.items.length} \u5f20`, 'success');
  }

  async function loadTemplateSnapshot(options = {}) {
    const { showErrorNotice = false, syncLatest = false } = options;

    state.loadingSnapshot = true;
    renderTemplateSummary();
    renderTemplateCards();

    try {
      state.snapshot = syncLatest
        ? await getFeatureCenterBridge().syncPodUploadSheetMiaoshouTemplates()
        : await getFeatureCenterBridge().getPodUploadSheetMiaoshouTemplateSnapshot();
    } catch (error) {
      if (syncLatest) {
        try {
          state.snapshot = await getFeatureCenterBridge().getPodUploadSheetMiaoshouTemplateSnapshot();
        } catch (snapshotError) {
          if (showErrorNotice) {
            showWindowNotice(
              '模板状态读取失败：' + (normalizeText(snapshotError && snapshotError.message) || '请稍后重试'),
              'danger'
            );
          }
        }
      } else if (showErrorNotice) {
        showWindowNotice(
          '模板状态读取失败：' + (normalizeText(error && error.message) || '请稍后重试'),
          'danger'
        );
      }
    } finally {
      state.loadingSnapshot = false;
      renderTemplateSummary();
      renderTemplateCards();
    }
  }

  function normalizeCategoryOptions(values) {
    const optionMap = new Map();

    (Array.isArray(values) ? values : []).forEach((item) => {
      const id = normalizeText(item && item.id);
      const label = normalizeText(item && item.label);

      if (/^\d+$/.test(id) && label) {
        optionMap.set(id, {
          id,
          label
        });
      }
    });

    return Array.from(optionMap.values());
  }

  async function loadCategoryOptions(options = {}) {
    const { showErrorNotice = false } = options;

    try {
      const snapshot = await getFeatureCenterBridge().getPodUploadSheetMiaoshouCategories();
      const nextOptions = normalizeCategoryOptions(snapshot && snapshot.categories);

      if (!nextOptions.length) {
        throw new Error('\u7c7b\u76ee\u5217\u8868\u4e3a\u7a7a\u3002');
      }

      categoryOptions = nextOptions;
      if (!normalizeText(state.globalProductSettings.category)) {
        state.globalProductSettings.category = normalizeCategoryId('');
      }
      getElement('podCategorySelect').dataset.initialized = '';
      renderCategoryOptions();
    } catch (error) {
      categoryOptions = [];
      getElement('podCategorySelect').dataset.initialized = '';
      renderCategoryOptions();

      if (showErrorNotice) {
        showWindowNotice(
          '\u7c7b\u76ee\u5217\u8868\u8bfb\u53d6\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
          'danger'
        );
      }
    }
  }

  async function exportTable(button) {
    if (state.exportingTable) {
      return;
    }

    if (state.uploadingCosImages || state.stoppingCosImages) {
      showWindowNotice('\u56fe\u7247\u4e0a\u4f20\u4efb\u52a1\u8fdb\u884c\u4e2d\uff0c\u8bf7\u5148\u7b49\u5f85\u5b8c\u6210\u6216\u505c\u6b62\u540e\u518d\u5bfc\u51fa\u3002', 'warning');
      return;
    }

    if (!state.products.length) {
      showWindowNotice('\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u5546\u54c1\u6570\u636e\u3002', 'warning');
      return;
    }

    state.exportingTable = true;
    toggleButtonBusy(button, true, '\u5bfc\u51fa\u4e2d...');
    renderActionButtonStates();

    try {
      const result = await getFeatureCenterBridge().exportPodUploadSheetMiaoshouTable({
        templateId: normalizeText(state.globalProductSettings.templateId) || 'non-fashion',
        products: state.products
      });

      if (result && result.canceled) {
        showWindowNotice('\u5df2\u53d6\u6d88\u5bfc\u51fa\u3002', 'warning');
        return;
      }

      showWindowNotice(
        `\u5df2\u5bfc\u51fa ${Number.parseInt(result && result.rowCount, 10) || 0} \u884c\u5230 ${normalizeText(result && result.filePath) || '\u76ee\u6807\u6587\u4ef6'}`,
        'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u5bfc\u51fa\u8868\u683c\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.exportingTable = false;
      toggleButtonBusy(button, false, '');
      renderActionButtonStates();
    }
  }

  async function loadFormTemplateSnapshot(options = {}) {
    const { showErrorNotice = false, syncLatest = false } = options;

    state.loadingFormTemplateSnapshot = true;
    renderFormTemplateSummary();
    renderFormTemplateSelect();

    try {
      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(
        await getFeatureCenterBridge().getPodUploadSheetMiaoshouFormTemplates()
      );
    } catch (error) {
      if (showErrorNotice) {
        showWindowNotice(
          '\u5df2\u4fdd\u5b58\u6a21\u677f\u5217\u8868\u8bfb\u53d6\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
          'danger'
        );
      }
    } finally {
      state.loadingFormTemplateSnapshot = false;
      renderFormTemplateSummary();
      renderFormTemplateSelect();
    }
  }

  function applyFormTemplate(template) {
    if (!template) {
      return;
    }

    const normalizedFields = GLOBAL_PRODUCT_FIELD_NAMES.reduce((result, fieldName) => {
      result[fieldName] = normalizeFormTemplateFieldValue(fieldName, template.fields && template.fields[fieldName]);
      return result;
    }, {});

    state.globalProductSettings = {
      ...DEFAULT_GLOBAL_PRODUCT_SETTINGS,
      ...normalizedFields,
      skuConfigMap: cloneSkuConfigMap(template.skuConfigMap)
    };

    if (normalizeProductCodeValue(template.fields && template.fields.codeValue)) {
      state.products.forEach((product) => {
        product.codeValueDerivedFromSource = false;
      });
    }

    state.aiTitlePrefix = normalizeFormTemplateFieldValue('aiTitlePrefix', template.fields && template.fields.aiTitlePrefix);
    state.aiTitleSuffix = normalizeFormTemplateFieldValue('aiTitleSuffix', template.fields && template.fields.aiTitleSuffix);
    state.aiTitleExtraPrompt = normalizeFormTemplateFieldValue('aiTitleExtraPrompt', template.fields && template.fields.aiTitleExtraPrompt);
    state.aiTitleMaxLength = normalizeFormTemplateFieldValue('aiTitleMaxLength', template.fields && template.fields.aiTitleMaxLength);

    applyFormTemplateBatchPreset(template.batchPreset);
    syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);
    syncGlobalProductSettingsToProducts();
    renderAll();
  }

  async function saveCurrentFormTemplate(button) {
    if (state.savingFormTemplate) {
      return;
    }

    const nameInput = getElement('podFormTemplateNameInput');
    const selectedTemplate = getSelectedFormTemplate();
    const templateName = normalizeText(nameInput.value) || normalizeText(selectedTemplate && selectedTemplate.name);
    const targetTemplateId = selectedTemplate && templateName === normalizeText(selectedTemplate.name)
      ? selectedTemplate.id
      : '';

    if (!templateName) {
      showWindowNotice('\u8bf7\u5148\u586b\u5199\u6a21\u677f\u540d\u79f0\uff0c\u518d\u4fdd\u5b58\u5f53\u524d\u586b\u5199\u5185\u5bb9\u3002', 'warning');
      nameInput.focus();
      return;
    }

    state.savingFormTemplate = true;
    toggleButtonBusy(button, true, '\u4fdd\u5b58\u4e2d...');

    try {
      const result = await getFeatureCenterBridge().savePodUploadSheetMiaoshouFormTemplate({
        templateId: targetTemplateId,
        templateName,
        fields: buildCurrentFormTemplateFields(),
        skuConfigMap: cloneSkuConfigMap(state.globalProductSettings.skuConfigMap),
        batchPreset: buildCurrentFormTemplateBatchPreset()
      });

      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(result);
      state.selectedFormTemplateId = normalizeText(result && result.templateId);
      nameInput.value = templateName;
      renderFormTemplateSummary();
      renderFormTemplateSelect();
      showWindowNotice(
        result && result.cloudSynced === false
          ? ('\u6a21\u677f\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u5931\u8d25' + (normalizeText(result.warning) ? '\uff1a' + normalizeText(result.warning) : ''))
          : `\u5df2\u4fdd\u5b58\u586b\u5199\u6a21\u677f\uff1a${templateName}`,
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u4fdd\u5b58\u586b\u5199\u6a21\u677f\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.savingFormTemplate = false;
      toggleButtonBusy(button, false, '');
      renderFormTemplateSelect();
    }
  }

  async function deleteSelectedFormTemplate(button) {
    const selectedTemplate = getSelectedFormTemplate();

    if (!selectedTemplate) {
      showWindowNotice('\u8bf7\u5148\u9009\u62e9\u8981\u5220\u9664\u7684\u586b\u5199\u6a21\u677f\u3002', 'warning');
      return;
    }

    if (!(await getDialogBridge().confirm({
      tone: 'danger',
      title: '\u5220\u9664\u586b\u5199\u6a21\u677f',
      badgeText: '\u4e0d\u53ef\u64a4\u9500',
      message: `\u786e\u8ba4\u5220\u9664\u6a21\u677f\u201c${selectedTemplate.name}\u201d\u5417\uff1f`,
      detail: '\u5220\u9664\u540e\uff0c\u8fd9\u4e2a\u6a21\u677f\u5c06\u4e0d\u518d\u51fa\u73b0\u5728\u540e\u7eed\u7684\u6a21\u677f\u9009\u62e9\u5217\u8868\u4e2d\u3002',
      confirmText: '\u5220\u9664\u6a21\u677f',
      cancelText: '\u53d6\u6d88'
    }))) {
      return;
    }

    state.deletingFormTemplate = true;
    toggleButtonBusy(button, true, '\u5220\u9664\u4e2d...');
    renderFormTemplateSelect();

    try {
      const result = await getFeatureCenterBridge().deletePodUploadSheetMiaoshouFormTemplate({
        templateId: selectedTemplate.id
      });

      state.formTemplateSnapshot = normalizeFormTemplateSnapshot(result);
      state.selectedFormTemplateId = '';
      getElement('podFormTemplateNameInput').value = '';
      renderFormTemplateSummary();
      renderFormTemplateSelect();
      showWindowNotice(
        result && result.cloudSynced === false
          ? ('\u6a21\u677f\u5df2\u4ece\u672c\u5730\u5220\u9664\uff0c\u4f46\u4e91\u7aef\u540c\u6b65\u5931\u8d25' + (normalizeText(result.warning) ? '\uff1a' + normalizeText(result.warning) : ''))
          : `\u5df2\u5220\u9664\u586b\u5199\u6a21\u677f\uff1a${selectedTemplate.name}`,
        result && result.cloudSynced === false ? 'warning' : 'success'
      );
    } catch (error) {
      showWindowNotice(
        '\u5220\u9664\u586b\u5199\u6a21\u677f\u5931\u8d25\uff1a' + (normalizeText(error && error.message) || '\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
        'danger'
      );
    } finally {
      state.deletingFormTemplate = false;
      toggleButtonBusy(button, false, '');
      renderFormTemplateSelect();
    }
  }

  function bindProductFieldEvents() {
    document.querySelectorAll('[data-global-product-field]').forEach((element) => {
      const updateField = () => {
        const fieldName = normalizeText(element.getAttribute('data-global-product-field'));

        if (!fieldName) {
          return;
        }

        const normalizedValue = normalizeGlobalProductFieldValue(fieldName, element.value);
        state.globalProductSettings[fieldName] = normalizedValue;

        if (element.value !== normalizedValue) {
          element.value = normalizedValue;
        }

        if (fieldName === 'codeValue') {
          state.products.forEach((product) => {
            product.codeValueDerivedFromSource = false;
          });
        }

        syncSkuConfigMapWithCurrentSpecs(state.globalProductSettings);
        syncGlobalProductSettingsToProducts();
        renderActiveProductHeader();
        renderSkuEditor();
        renderProductList();
        renderFieldHelpBadges();
        renderTemplateAwareCopy();

        if (fieldName === 'templateId') {
          renderTemplateCards();
        }
      };

      element.addEventListener('input', updateField);
      element.addEventListener('change', updateField);
    });
  }

  function bindEvents() {
    if (state.eventsBound) {
      return;
    }

    state.eventsBound = true;

    if (typeof state.removeAiTitleProgressListener !== 'function') {
      state.removeAiTitleProgressListener = getFeatureCenterBridge().onPodUploadSheetMiaoshouAiTitleProgress((payload) => {
        handleAiTitleProgressEvent(payload);
      });

      window.addEventListener('beforeunload', () => {
        if (typeof state.removeAiTitleProgressListener === 'function') {
          state.removeAiTitleProgressListener();
          state.removeAiTitleProgressListener = null;
        }

        stopCosUploadProgressPolling();
      }, { once: true });
    }

    getElement('podExportTableButton').addEventListener('click', (event) => {
      void exportTable(event.currentTarget);
    });

    getElement('podBatchUploadCosButton').addEventListener('click', (event) => {
      if (isDuplicateButtonEvent('lastCosUploadButtonEventStamp', event)) {
        return;
      }

      if (state.uploadingCosImages) {
        void handleStopCosImageUpload();
        return;
      }

      void handleUploadCosImages();
    });

    getElement('podImageUploadModeSelect').addEventListener('change', (event) => {
      state.imageUploadMode = normalizeImageUploadMode(event.target && event.target.value);
      renderActionButtonStates();
      scheduleWorkspaceStateSave({
        immediate: true,
        showErrorNotice: true
      });
    });

    getElement('podFormTemplateSelect').addEventListener('change', (event) => {
      void selectAndApplyFormTemplate(event.target.value);
    });

    getElement('podFormTemplatePickerButton').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.formTemplateDropdownOpen = true;
      renderFormTemplateSelect();
    });

    getElement('podFormTemplateModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-form-template-close]')
        : null;

      if (closeTrigger) {
        state.formTemplateDropdownOpen = false;
        renderFormTemplateSelect();
        return;
      }

      const optionButton = event.target instanceof Element
        ? event.target.closest('[data-form-template-id]')
        : null;

      if (!(optionButton instanceof HTMLButtonElement)) {
        return;
      }

      void selectAndApplyFormTemplate(optionButton.getAttribute('data-form-template-id'));
    });

    getElement('podSaveFormTemplateButton').addEventListener('click', (event) => {
      void saveCurrentFormTemplate(event.currentTarget);
    });

    getElement('podDeleteFormTemplateButton').addEventListener('click', (event) => {
      void deleteSelectedFormTemplate(event.currentTarget);
    });

    getElement('podImportProductsButton').addEventListener('click', () => {
      void openImportProductsDialog();
    });

    getElement('podBatchPresetCarouselButton').addEventListener('click', () => {
      openCarouselPresetDialog();
    });

    getElement('podBatchPresetDescriptionButton').addEventListener('click', () => {
      openDescriptionPresetDialog();
    });

    getElement('podClearProductsButton').addEventListener('click', () => {
      void handleClearProducts();
    });

    getElement('podAiTitlePrefixInput').addEventListener('input', (event) => {
      state.aiTitlePrefix = String(event.target && event.target.value ? event.target.value : '');
      renderAiTitleControls();
    });

    getElement('podAiTitleSuffixInput').addEventListener('input', (event) => {
      state.aiTitleSuffix = String(event.target && event.target.value ? event.target.value : '');
      renderAiTitleControls();
    });

    getElement('podAiTitleExtraPromptInput').addEventListener('input', (event) => {
      state.aiTitleExtraPrompt = String(event.target && event.target.value ? event.target.value : '');
      renderAiTitleControls();
    });

    getElement('podAiTitleMaxLengthInput').addEventListener('input', (event) => {
      state.aiTitleMaxLength = String(event.target && event.target.value ? event.target.value : '');
      renderAiTitleControls();
    });

    getElement('podBatchAiTitleButton').addEventListener('click', (event) => {
      if (isDuplicateButtonEvent('lastAiTitleButtonEventStamp', event)) {
        return;
      }

      if (state.generatingAiTitles) {
        void handleStopAiTitles();
        return;
      }

      void handleGenerateAiTitles();
    });

    getElement('podRetryFailedAiTitleButton').addEventListener('click', () => {
      void handleGenerateAiTitles({
        retryFailedOnly: true
      });
    });

    getElement('podDescriptionPresetCancelButton').addEventListener('click', () => {
      closeDescriptionPresetDialog();
    });

    getElement('podDescriptionPresetSaveButton').addEventListener('click', () => {
      saveDescriptionPresetDialog();
    });

    getElement('podDescriptionPresetSelectAllButton').addEventListener('click', () => {
      selectAllDescriptionPresetCandidates();
    });

    getElement('podDescriptionPresetClearButton').addEventListener('click', () => {
      clearDescriptionPresetSelection();
    });

    getElement('podCarouselPresetCancelButton').addEventListener('click', () => {
      closeCarouselPresetDialog();
    });

    getElement('podCarouselPresetSaveButton').addEventListener('click', () => {
      saveCarouselPresetDialog();
    });

    document.querySelectorAll('input[name="podCarouselPresetMode"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        const field = event.currentTarget;

        if (!(field instanceof HTMLInputElement) || !field.checked) {
          return;
        }

        setCarouselPresetMode(field.value);
      });
    });

    getElement('podCarouselPresetRandomOrdersInput').addEventListener('input', (event) => {
      const field = event.currentTarget;

      if (!(field instanceof HTMLInputElement)) {
        return;
      }

      state.carouselPresetRandomOrdersDraft = field.value;
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podCarouselPresetRandomOrdersInput').addEventListener('change', (event) => {
      const field = event.currentTarget;

      if (!(field instanceof HTMLInputElement)) {
        return;
      }

      state.carouselPresetRandomOrdersDraft = normalizeSequenceSelection(field.value);
      persistCachedCarouselPresetState();
      renderCarouselPresetDialog();
    });

    getElement('podCarouselPresetRandomCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-random-order]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      setCarouselPresetRandomOrder(
        checkbox.getAttribute('data-pod-carousel-random-order'),
        checkbox.checked
      );
    });

    getElement('podCarouselPresetRandomOrderList').addEventListener('click', (event) => {
      const removeButton = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-random-order-remove]')
        : null;

      if (!(removeButton instanceof HTMLButtonElement)) {
        return;
      }

      setCarouselPresetRandomOrder(
        removeButton.getAttribute('data-pod-carousel-random-order-remove'),
        false
      );
    });

    getElement('podCarouselPresetSelectAllButton').addEventListener('click', () => {
      selectAllCarouselPresetCandidates();
    });

    getElement('podCarouselPresetClearButton').addEventListener('click', () => {
      clearCarouselPresetSelection();
    });

    getElement('podDescriptionPresetModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-close]')
        : null;

      if (closeTrigger) {
        closeDescriptionPresetDialog();
      }
    });

    getElement('podCarouselPresetModal').addEventListener('click', (event) => {
      const closeTrigger = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-close]')
        : null;

      if (closeTrigger) {
        closeCarouselPresetDialog();
      }
    });

    getElement('podDescriptionPresetCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-candidate]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      toggleDescriptionPresetCandidate(
        checkbox.getAttribute('data-pod-description-preset-candidate'),
        checkbox.checked
      );
    });

    getElement('podDescriptionPresetSelectedList').addEventListener('click', (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest('[data-pod-description-preset-action]')
        : null;

      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      moveDescriptionPresetSelection(
        normalizeText(actionButton.getAttribute('data-pod-description-preset-action')),
        actionButton.getAttribute('data-pod-description-preset-index')
      );
    });

    getElement('podCarouselPresetCandidateList').addEventListener('change', (event) => {
      const checkbox = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-candidate]')
        : null;

      if (!(checkbox instanceof HTMLInputElement)) {
        return;
      }

      toggleCarouselPresetCandidate(
        checkbox.getAttribute('data-pod-carousel-preset-candidate'),
        checkbox.checked
      );
    });

    getElement('podCarouselPresetSelectedList').addEventListener('click', (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest('[data-pod-carousel-preset-action]')
        : null;

      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      moveCarouselPresetSelection(
        normalizeText(actionButton.getAttribute('data-pod-carousel-preset-action')),
        actionButton.getAttribute('data-pod-carousel-preset-index')
      );
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.formTemplateDropdownOpen) {
        state.formTemplateDropdownOpen = false;
        renderFormTemplateSelect();
        return;
      }

      if (event.key === 'Escape' && state.carouselPresetModalOpen) {
        closeCarouselPresetDialog();
        return;
      }

      if (event.key === 'Escape' && state.descriptionPresetModalOpen) {
        closeDescriptionPresetDialog();
        return;
      }

    });

    const updateSkuConfigField = (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-sku-config-field]') : null;

      if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
        return;
      }

      const rowKey = normalizeText(field.getAttribute('data-sku-row-key'));
      const fieldName = normalizeText(field.getAttribute('data-sku-config-field'));

      if (!rowKey || !SKU_CONFIG_FIELD_NAMES.includes(fieldName)) {
        return;
      }

      const nextMap = cloneSkuConfigMap(state.globalProductSettings.skuConfigMap);
      const nextEntry = createSkuConfigEntry(nextMap[rowKey]);
      nextEntry[fieldName] = normalizeSkuConfigFieldValue(fieldName, field.value);
      nextMap[rowKey] = nextEntry;
      state.globalProductSettings.skuConfigMap = nextMap;
      syncGlobalProductSettingsToProducts();
    };

    getElement('podSkuTableBody').addEventListener('input', updateSkuConfigField);
    getElement('podSkuTableBody').addEventListener('change', updateSkuConfigField);

    getElement('podImportProductsInput').addEventListener('change', (event) => {
      handleImportProducts(event.target.files);
      event.target.value = '';
    });

    MATERIAL_SECTIONS.forEach((section) => {
      const filesInput = getElement(section.filesInputId);
      const folderInput = getElement(section.folderInputId);

      filesInput.addEventListener('change', (event) => {
        applyMaterialsToActiveProduct(section.id, event.target.files, 'files');
        event.target.value = '';
      });

      folderInput.addEventListener('change', (event) => {
        applyMaterialsToActiveProduct(section.id, event.target.files, 'folder');
        event.target.value = '';
      });
    });

    getElement('podProductTableBody').addEventListener('focusin', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      activateProductFromList(normalizeText(field.getAttribute('data-product-list-row-id')));
    });

    getElement('podProductTableBody').addEventListener('input', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      const rowId = normalizeText(field.getAttribute('data-product-list-row-id'));
      const fieldName = normalizeText(field.getAttribute('data-product-list-field'));
      const product = state.products.find((item) => item.id === rowId);

      if (!product || !['title', 'englishTitle', 'descriptionImageOrders'].includes(fieldName)) {
        return;
      }

      product[fieldName] = fieldName === 'descriptionImageOrders'
        ? normalizeSequenceSelection(field.value)
        : normalizeTitleFieldValue(field.value);
      activateProductFromList(rowId);

      if (fieldName === 'descriptionImageOrders') {
        const previewElement = field.parentElement
          ? field.parentElement.querySelector('[data-product-description-preview]')
          : null;

        field.value = product.descriptionImageOrders;

        if (previewElement instanceof HTMLElement) {
          previewElement.textContent = getDescriptionImagePreviewText(product);
        }
        return;
      }

      if (field.value !== product[fieldName]) {
        field.value = product[fieldName];
      }

      syncProductRowStatus(rowId);
    });

    getElement('podProductTableBody').addEventListener('change', (event) => {
      const field = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      const rowId = normalizeText(field.getAttribute('data-product-list-row-id'));
      const product = state.products.find((item) => item.id === rowId);

      if (!product) {
        return;
      }

      product.title = normalizeTitleFieldValue(product.title);
      product.englishTitle = normalizeTitleFieldValue(product.englishTitle);
      product.descriptionImageOrders = normalizeSequenceSelection(product.descriptionImageOrders);
      renderProductList();
      renderEditor();
    });

    getElement('podProductTableBody').addEventListener('click', (event) => {
      const clickedField = event.target instanceof Element ? event.target.closest('[data-product-list-field]') : null;

      if (clickedField) {
        return;
      }

      const row = event.target instanceof Element ? event.target.closest('[data-product-row-id]') : null;

      if (!(row instanceof HTMLElement)) {
        return;
      }

      selectProduct(row.getAttribute('data-product-row-id'));
    });

    document.addEventListener('click', (event) => {
      const placeholderButton = event.target instanceof Element
        ? event.target.closest('[data-pod-placeholder-action]')
        : null;

      if (!(placeholderButton instanceof HTMLButtonElement)) {
        return;
      }

      if (!getActiveProduct()) {
        showWindowNotice('\u8bf7\u5148\u4ece\u4e0b\u9762\u7684\u5546\u54c1\u6570\u636e\u5217\u8868\u91cc\u9009\u62e9\u4e00\u4e2a\u672c\u5730\u5546\u54c1\u3002', 'warning');
        return;
      }

      const action = normalizeText(placeholderButton.getAttribute('data-pod-placeholder-action'));
      const actionText = action === 'generate-english-title' ? 'AI\u751f\u6210\u82f1\u6587\u6807\u9898' : 'AI\u751f\u6210\u6807\u9898';
      showWindowNotice(`${actionText}\u63a5\u53e3\u4e0b\u4e00\u6b65\u518d\u63a5\u5165\uff0c\u5f53\u524d\u5148\u4fdd\u7559\u6570\u636e\u5217\u8868\u548c\u5546\u54c1\u7f16\u8f91\u7ed3\u6784\u3002`, 'warning');
    });

    bindProductFieldEvents();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    renderTemplateSelectOptions();
    renderAll();
    renderFieldHelpBadges();
    bindEvents();
    await loadCategoryOptions({
      showErrorNotice: true
    });
    void loadTemplateSnapshot({
      showErrorNotice: true,
      syncLatest: true
    });
    void loadFormTemplateSnapshot({
      showErrorNotice: true
    });
    void loadWorkspaceState({
      showErrorNotice: true
    });
  });
})();
