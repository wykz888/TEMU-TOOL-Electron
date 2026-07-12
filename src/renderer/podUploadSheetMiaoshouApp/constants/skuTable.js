const POD_SKU_COLUMN_WIDTHS = Object.freeze({
  specValue: 120,
  previewImage: 170,
  price: 120,
  dimension: 120,
  weight: 120,
  stock: 120,
  platformSku: 150,
  skuCategory: 140,
  independentPackaging: 120
});

const POD_SKU_TABLE_COLUMN_WIDTH_SEQUENCE = Object.freeze([
  POD_SKU_COLUMN_WIDTHS.specValue,
  POD_SKU_COLUMN_WIDTHS.specValue,
  POD_SKU_COLUMN_WIDTHS.previewImage,
  POD_SKU_COLUMN_WIDTHS.price,
  POD_SKU_COLUMN_WIDTHS.price,
  POD_SKU_COLUMN_WIDTHS.dimension,
  POD_SKU_COLUMN_WIDTHS.dimension,
  POD_SKU_COLUMN_WIDTHS.dimension,
  POD_SKU_COLUMN_WIDTHS.weight,
  POD_SKU_COLUMN_WIDTHS.stock,
  POD_SKU_COLUMN_WIDTHS.platformSku,
  POD_SKU_COLUMN_WIDTHS.skuCategory,
  POD_SKU_COLUMN_WIDTHS.skuCategory,
  POD_SKU_COLUMN_WIDTHS.skuCategory,
  POD_SKU_COLUMN_WIDTHS.independentPackaging
]);

const POD_SKU_TABLE_SCROLL_X = POD_SKU_TABLE_COLUMN_WIDTH_SEQUENCE.reduce((totalWidth, width) => totalWidth + width, 0);

export {
  POD_SKU_COLUMN_WIDTHS,
  POD_SKU_TABLE_COLUMN_WIDTH_SEQUENCE,
  POD_SKU_TABLE_SCROLL_X
};
