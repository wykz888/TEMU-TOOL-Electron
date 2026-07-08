(function initOperationsProfitMetrics(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === 'object') {
    root.operationsProfitMetrics = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createOperationsProfitMetrics() {
  function toFiniteNumber(value) {
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue)
      ? normalizedValue
      : Number.NaN;
  }

  function computeProfitValue(priceAmount, costAmount) {
    const normalizedPriceAmount = toFiniteNumber(priceAmount);
    const normalizedCostAmount = toFiniteNumber(costAmount);

    if (
      !Number.isFinite(normalizedPriceAmount)
      || normalizedPriceAmount <= 0
      || !Number.isFinite(normalizedCostAmount)
      || normalizedCostAmount < 0
    ) {
      return Number.NaN;
    }

    return normalizedPriceAmount - normalizedCostAmount;
  }

  function computeProfitRateByPrice(priceAmount, costAmount) {
    const normalizedPriceAmount = toFiniteNumber(priceAmount);
    const normalizedCostAmount = toFiniteNumber(costAmount);

    if (
      !Number.isFinite(normalizedPriceAmount)
      || normalizedPriceAmount <= 0
      || !Number.isFinite(normalizedCostAmount)
      || normalizedCostAmount <= 0
    ) {
      return Number.NaN;
    }

    return ((normalizedPriceAmount - normalizedCostAmount) / normalizedPriceAmount) * 100;
  }

  return Object.freeze({
    computeProfitValue,
    computeProfitRateByPrice
  });
});
