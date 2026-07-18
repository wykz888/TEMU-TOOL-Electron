const SUGGESTED_PRICE_COLUMN_ALIASES = Object.freeze([
  '\u5efa\u8bae\u552e\u4ef7',
  '\u5efa\u8bae\u552e\u4ef7(CNY)',
  '\u5efa\u8bae\u552e\u4ef7((CNY))',
  '\u5efa\u8bae\u552e\u4ef7\uff08CNY\uff09',
  '\u5efa\u8bae\u552e\u4ef7\uff08\uff08CNY\uff09\uff09',
  '*\u5efa\u8bae\u552e\u4ef7',
  '*\u5efa\u8bae\u552e\u4ef7(CNY)',
  '*\u5efa\u8bae\u552e\u4ef7((CNY))',
  '*\u5efa\u8bae\u552e\u4ef7\uff08CNY\uff09',
  '*\u5efa\u8bae\u552e\u4ef7\uff08\uff08CNY\uff09\uff09'
]);

function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function getSuggestedPriceValue(_product, skuRow) {
  return normalizeText(skuRow && skuRow.price);
}

module.exports = {
  SUGGESTED_PRICE_COLUMN_ALIASES,
  getSuggestedPriceValue
};
