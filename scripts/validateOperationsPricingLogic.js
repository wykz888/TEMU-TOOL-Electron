const assert = require('node:assert/strict');
const trafficPricing = require('../src/services/featureCenter/operationsTrafficBoostSubmitPricing');
const trafficFlowPriceInfo = require('../src/services/featureCenter/operationsTrafficBoostFlowPriceInfo');
const trafficSubmitErrors = require('../src/services/featureCenter/operationsTrafficBoostSubmitErrors');
const priceDeclPricing = require('../src/services/featureCenter/operationsPriceDeclarationPricing');

function assertAlmostEqual(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`
  );
}

function validateTrafficBoostPricing() {
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitDays(30), 30);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitDays(99), 7);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitLevel(4), 4);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitLevel(99), 1);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitBatchSize(100), 30);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitBatchSize(0), 30);
  assert.equal(trafficPricing.normalizeTrafficBoostSubmitBatchSize(-5), 1);
  assert.equal(trafficPricing.buildTrafficBoostSubmitProductKey(8823621899, 100), '100:8823621899');

  assert.equal(
    trafficPricing.normalizeFlowPriceSubmitSkuForRequest({
      productSkuId: 24046892899,
      supplierPrice: 5050
    }, 4),
    null
  );

  const customRequestSku = trafficPricing.normalizeFlowPriceSubmitSkuForRequest({
    productSkuId: 24046892899,
    supplierPrice: 5050,
    targetSupplierPrice: 4545,
    currencyType: 'CNY'
  }, 4);

  assert.deepEqual(customRequestSku, {
    productSkuId: 24046892899,
    supplierPrice: 5050,
    currencyType: 'CNY',
    preSupplierPrice: 5050,
    targetSupplierPrice: 4545
  });

  assert.deepEqual(
    trafficPricing.normalizeFlowPriceSubmitSkuForBatchPayload(customRequestSku, 4),
    {
      productSkuId: 24046892899,
      preSupplierPrice: 5050,
      supplierPrice: 4545,
      currencyType: 'CNY'
    }
  );

  const oldCustomTargetSku = trafficPricing.normalizeFlowPriceSubmitSkuForRequest({
    productSkuId: 64435461404,
    preSupplierPrice: 4838,
    supplierPrice: 4354
  }, 4);

  assert.deepEqual(oldCustomTargetSku, {
    productSkuId: 64435461404,
    supplierPrice: 4838,
    currencyType: 'CNY',
    preSupplierPrice: 4838,
    targetSupplierPrice: 4354
  });

  const normalizedProduct = trafficPricing.normalizeFlowPriceSubmitProductForRequest({
    siteId: 100,
    productId: 8823621899,
    increaseFlowLevel: 4,
    increaseFlowDays: 30,
    isAutoRenew: true,
    skuPriceList: [
      customRequestSku,
      { productSkuId: 0, supplierPrice: 1000 }
    ]
  });

  assert.equal(normalizedProduct.skuPriceList.length, 1);
  assert.equal(normalizedProduct.increaseFlowDays, 30);
}

function validateTrafficBoostFlowPriceInfo() {
  const flowPriceInfoMap = trafficFlowPriceInfo.buildFlowPriceInfoMap({
    canSubmitProductList: [
      {
        siteId: 100,
        productId: 8823621899,
        productName: 'Sample',
        skcList: [
          {
            productSkcId: 123,
            specList: [
              { name: 'Color', value: 'Black' },
              { name: 'Size', value: 'XL' }
            ],
            skuList: [
              {
                productSkuId: 24046892899,
                supplierPrice: 5050,
                customFlowSupplierPrice: 4545
              }
            ]
          }
        ]
      }
    ]
  });
  const productInfo = flowPriceInfoMap.get('100:8823621899');

  assert.equal(flowPriceInfoMap.size, 1);
  assert.equal(productInfo.skuPriceInfoList.length, 1);
  assert.equal(productInfo.skuPriceInfoList[0].productSkuId, '24046892899');
  assert.equal(productInfo.skuPriceInfoList[0].productSkcId, '123');
  assert.equal(productInfo.skuPriceInfoList[0].specText, 'Color: Black | Size: XL');
  assert.deepEqual(
    productInfo.skuPriceInfoList[0].specAliases,
    ['Color:Black\uff0cSize:XL', 'Black-XL', 'Black\uff0cXL']
  );

  assert.equal(
    trafficFlowPriceInfo.buildCompactWarningText(['A', 'B', 'A', 'C'], 2),
    'A\uff1bB \u7b49 3 \u9879'
  );
}

function validateTrafficBoostSubmitErrors() {
  assert.equal(
    trafficSubmitErrors.isRateLimitErrorMessage('\u62a5\u540d\u5546\u54c1\u91cf\u8fc7\u4e8e\u706b\u7206\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5'),
    true
  );
  assert.equal(
    trafficSubmitErrors.isHotSubmitRateLimitErrorMessage('\u62a5\u540d\u5546\u54c1\u91cf\u8fc7\u4e8e\u706b\u7206'),
    true
  );
  assert.equal(
    trafficSubmitErrors.shouldSplitFlowPriceSubmitErrorMessage('submit custom price without sku:68934308256'),
    true
  );
  assert.equal(
    trafficSubmitErrors.shouldSplitFlowPriceSubmitErrorMessage('submit higher custom price, sku:51583327411'),
    true
  );
  assert.equal(
    trafficSubmitErrors.shouldSplitFlowPriceSubmitErrorMessage('authorization expired'),
    false
  );
  assert.equal(
    trafficSubmitErrors.shouldSplitFlowPriceSubmitErrorMessage('product list size must in [1,30]'),
    false
  );
}

function validatePriceDeclarationPricing() {
  const metrics = priceDeclPricing.computePriceDeclProfitMetrics(10000, 60);
  assert.equal(metrics.suggestPriceYuan, 100);
  assert.equal(metrics.profitValue, 40);
  assertAlmostEqual(metrics.profitRate, 40, 0.0001, 'profit rate');

  assert.equal(priceDeclPricing.computePriceDeclRedeclareSubmitPrice(10000, 'discount', 10), 9000);
  assert.equal(priceDeclPricing.computePriceDeclRedeclareSubmitPrice(10000, 'flatReduce', 12.34), 8766);
  assert.equal(priceDeclPricing.computePriceDeclRedeclareSubmitPrice(0, 'discount', 10), 0);
  assert.equal(priceDeclPricing.computePriceDeclRedeclareSubmitPrice(10000, 'unknown', 10), 0);
  assert.equal(priceDeclPricing.resolvePriceDeclDeclaredPriceCentFromRow({ declaredPrice: '45.45' }), 4545);
  assert.equal(
    priceDeclPricing.resolvePriceDeclDeclaredPriceCentFromReviewData(
      { priceBeforeExchange: 0 },
      { priceBeforeExchange: 3210 },
      1000
    ),
    3210
  );

  const andRule = {
    id: 'and-rule',
    reviewTimesMin: '3',
    profitRateValue: '20',
    profitLogicMode: 'and',
    profitValueValue: '30'
  };
  const orRule = {
    id: 'or-rule',
    reviewTimesMin: '3',
    profitRateValue: '50',
    profitLogicMode: 'or',
    profitValueValue: '30'
  };

  assert.equal(
    priceDeclPricing.resolvePriceDeclFallbackApproveRuleMatch(andRule, 4, 40, 40).matched,
    true
  );
  assert.equal(
    priceDeclPricing.resolvePriceDeclFallbackApproveRuleMatch(andRule, 3, 40, 40).matched,
    false
  );
  assert.equal(
    priceDeclPricing.resolvePriceDeclFallbackApproveRuleMatch(orRule, 4, 40, 40).matched,
    true
  );
  assert.equal(
    priceDeclPricing.resolvePriceDeclFallbackApproveDecision([andRule], 4, 40, 40).rule.id,
    'and-rule'
  );
  assert.equal(
    priceDeclPricing.hasConfiguredPriceDeclFallbackApproveRule({
      reviewTimesMin: '3',
      profitRateValue: '',
      profitValueValue: '30'
    }),
    false
  );
}

function main() {
  validateTrafficBoostPricing();
  validateTrafficBoostFlowPriceInfo();
  validateTrafficBoostSubmitErrors();
  validatePriceDeclarationPricing();
  console.log('operations pricing logic validation passed');
}

main();
