const {
  getMaterialItemByOriginalOrder,
  getMaterialOriginalOrderItems
} = require('../src/services/featureCenter/podUploadSheetMiaoshouExportMaterialUtils');
const {
  SUGGESTED_PRICE_COLUMN_ALIASES,
  getSuggestedPriceValue
} = require('../src/services/featureCenter/podUploadSheetMiaoshouPriceExportUtils');

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

function main() {
  validateSkuImageUsesOriginalImportOrder();
  validateFallbackFromPathMapOrderForOldProducts();
  validateSuggestedPriceUsesSkuPrice();

  console.log('POD MiaoShou material rule validation passed');
}

main();
