const {
  getMaterialItemByOriginalOrder,
  getMaterialOriginalOrderItems
} = require('../src/services/featureCenter/podUploadSheetMiaoshouExportMaterialUtils');
const {
  SUGGESTED_PRICE_COLUMN_ALIASES,
  getSuggestedPriceValue
} = require('../src/services/featureCenter/podUploadSheetMiaoshouPriceExportUtils');
const {
  buildAiTitleCompressedResultCacheKey,
  buildAiTitleSourceResultCacheKey,
  getUniqueAiTitleCacheKeys
} = require('../src/services/featureCenter/podUploadSheetMiaoshouAiTitleCacheKeyUtils');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createRandomizedProduct() {
  return {
    materials: {
      carousel: [
        'https://cdn.example.com/item-c.png',
        'https://cdn.example.com/item-a.png',
        'https://cdn.example.com/item-b.png'
      ],
      assets: [],
      preview: []
    },
    materialImportOrderMap: {
      carousel: ['item-c.png', 'item-a.png', 'item-b.png'],
      assets: [],
      preview: []
    },
    materialOriginalOrderMap: {
      carousel: ['item-a.png', 'item-b.png', 'item-c.png'],
      assets: [],
      preview: []
    }
  };
}

function validateSkuImageUsesOriginalImportOrder() {
  const product = createRandomizedProduct();

  assert(
    getMaterialItemByOriginalOrder(product, 'carousel', '1') === 'https://cdn.example.com/item-a.png',
    'SKU image order 1 should resolve to the original first carousel image.'
  );
  assert(
    getMaterialItemByOriginalOrder(product, 'carousel', '2') === 'https://cdn.example.com/item-b.png',
    'SKU image order 2 should resolve to the original second carousel image.'
  );
  assert(
    getMaterialItemByOriginalOrder(product, 'carousel', '3') === 'https://cdn.example.com/item-c.png',
    'SKU image order 3 should resolve to the original third carousel image.'
  );
}

function validateFallbackFromPathMapOrderForOldProducts() {
  const product = {
    materials: {
      carousel: [
        'https://cdn.example.com/item-c.png',
        'https://cdn.example.com/item-a.png',
        'https://cdn.example.com/item-b.png'
      ],
      assets: [],
      preview: []
    },
    materialImportOrderMap: {
      carousel: ['item-c.png', 'item-a.png', 'item-b.png'],
      assets: [],
      preview: []
    },
    materialPathMap: {
      carousel: {
        'item-a': 'D:\\source\\item-a.png',
        'item-b': 'D:\\source\\item-b.png',
        'item-c': 'D:\\source\\item-c.png'
      },
      assets: {},
      preview: {}
    }
  };

  assert(
    getMaterialOriginalOrderItems(product, 'carousel').join('|') === 'item-a.png|item-b.png|item-c.png',
    'Old products should recover original order from materialPathMap insertion order.'
  );
  assert(
    getMaterialItemByOriginalOrder(product, 'carousel', '2') === 'https://cdn.example.com/item-b.png',
    'Old products should resolve SKU image order 2 from recovered original order.'
  );
}

function validateSuggestedPriceUsesSkuPrice() {
  assert(
    SUGGESTED_PRICE_COLUMN_ALIASES.includes('\u5efa\u8bae\u552e\u4ef7\uff08\uff08CNY\uff09\uff09'),
    'TEMU suggested price aliases should include the double-parentheses CNY header.'
  );
  assert(
    getSuggestedPriceValue({ price: '999.00' }, { declaredPrice: '12.00', price: '34.50' }) === '34.50',
    'TEMU suggested price should export the SKU row price field.'
  );
}

function validateAiTitleCacheKeyRules() {
  const owner = {
    userKey: 'tester'
  };
  const product = {
    id: 'item-1',
    localName: 'sample',
    sourceFolder: 'folder-a',
    mainNumber: '1',
    categoryId: '11804',
    categoryLabel: 'category',
    imageName: 'image-a.png',
    imagePath: 'D:\\source\\image-a.png'
  };
  const settings = {
    apiBaseUrl: 'https://ark.example.com/api/v3',
    model: 'doubao-seed-2-0-mini-260428',
    imageCompression: 'jpg',
    imageQuality: 84
  };
  const storageContext = {
    storageProvider: 'tencent-cos',
    bucket: 'bucket-a',
    region: 'ap-guangzhou',
    rootPrefix: 'TEMU_Resources_Data'
  };
  const promptOptions = {
    prefixText: 'front',
    suffixText: 'end',
    extraPrompt: 'extra',
    targetLength: '250',
    outputLanguage: 'en'
  };
  const sourceCacheKey = buildAiTitleSourceResultCacheKey({
    entryId: 'pod-upload-sheet-miaoshou-table',
    owner,
    product,
    settings,
    fileStat: {
      size: 1024,
      mtimeMs: 123456
    },
    storageContext,
    promptOptions
  });
  const changedSourceCacheKey = buildAiTitleSourceResultCacheKey({
    entryId: 'pod-upload-sheet-miaoshou-table',
    owner,
    product,
    settings,
    fileStat: {
      size: 1024,
      mtimeMs: 123457
    },
    storageContext,
    promptOptions
  });
  const changedPromptCacheKey = buildAiTitleSourceResultCacheKey({
    entryId: 'pod-upload-sheet-miaoshou-table',
    owner,
    product,
    settings,
    fileStat: {
      size: 1024,
      mtimeMs: 123456
    },
    storageContext,
    promptOptions: {
      ...promptOptions,
      targetLength: '300'
    }
  });
  const compressedCacheKey = buildAiTitleCompressedResultCacheKey({
    entryId: 'pod-upload-sheet-miaoshou-table',
    owner,
    product,
    settings,
    compressedImage: {
      fileStat: {
        size: 1024,
        mtimeMs: 123456
      },
      byteLength: 512,
      maxDimension: 1280,
      quality: 84,
      imageCompression: 'jpg',
      extension: '.jpg'
    },
    storageContext,
    promptOptions
  });

  assert(sourceCacheKey.length === 32, 'AI title source cache key should be a stable hash.');
  assert(sourceCacheKey !== changedSourceCacheKey, 'AI title source cache key should change when the image file changes.');
  assert(sourceCacheKey !== changedPromptCacheKey, 'AI title source cache key should change when prompt settings change.');
  assert(compressedCacheKey.length === 32, 'AI title compressed cache key should remain available for existing cached results.');
  assert(
    getUniqueAiTitleCacheKeys(['', sourceCacheKey, compressedCacheKey, sourceCacheKey]).join('|')
      === `${sourceCacheKey}|${compressedCacheKey}`,
    'AI title cache keys should be deduplicated before cache lookup/write.'
  );
}

function validateSharedBatchAiTitleDialogHooks() {
  const fs = require('node:fs');
  const path = require('node:path');
  const temuHookPath = path.join(__dirname, '..', 'src', 'renderer', 'podUploadSheetMiaoshouApp', 'useBatchAiTitleDialog.js');
  const universalHookPath = path.join(__dirname, '..', 'src', 'renderer', 'podUploadSheetMiaoshouUniversalApp', 'useBatchAiTitleDialog.js');
  const sharedHookPath = path.join(__dirname, '..', 'src', 'renderer', 'shared', 'batchAiTitle', 'useBatchAiTitleDialog.js');
  const temuHook = fs.readFileSync(temuHookPath, 'utf8');
  const universalHook = fs.readFileSync(universalHookPath, 'utf8');
  const sharedHook = fs.readFileSync(sharedHookPath, 'utf8');

  assert(
    /createBatchAiTitleDialog/.test(temuHook) && /includeOutputLanguage:\s*false/.test(temuHook),
    'TEMU batch AI title hook should reuse the shared dialog factory without output language selection.'
  );
  assert(
    /createBatchAiTitleDialog/.test(universalHook) && /includeOutputLanguage:\s*true/.test(universalHook),
    'Universal batch AI title hook should reuse the shared dialog factory with output language selection.'
  );
  assert(
    /MIN_TARGET_LENGTH\s*=\s*30/.test(sharedHook) && /MAX_TARGET_LENGTH\s*=\s*300/.test(sharedHook),
    'Shared batch AI title dialog should keep title length bounds at 30-300.'
  );
}

function main() {
  validateSkuImageUsesOriginalImportOrder();
  validateFallbackFromPathMapOrderForOldProducts();
  validateSuggestedPriceUsesSkuPrice();
  validateAiTitleCacheKeyRules();
  validateSharedBatchAiTitleDialogHooks();

  console.log('POD MiaoShou material rule validation passed');
}

main();
