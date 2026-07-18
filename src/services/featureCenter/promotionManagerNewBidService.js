const { normalizeText } = require('../shopManagement/common');
const {
  ADS_GET_BID_URL,
  buildBidLookup,
  buildBidRequestPayload,
  chunkRowsForBidRequests,
  extractBidResults
} = require('./promotionManagerNewBidUtils');

function createPromotionManagerNewBidFetcher({
  adsSessionService,
  assertApiSuccess
} = {}) {
  async function fetchBidInfoForRows({
    shop,
    regionId,
    regionIds,
    rows,
    roasType,
    pageNumber,
    signal
  } = {}) {
    if (!adsSessionService || typeof adsSessionService.postWithRegionCookie !== 'function') {
      throw new Error('\u63a8\u5e7f\u4f1a\u8bdd\u670d\u52a1\u672a\u52a0\u8f7d');
    }

    const chunks = chunkRowsForBidRequests(rows);
    const bidRows = [];
    const details = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      if (signal && signal.canceled === true) {
        break;
      }

      const requestPayload = buildBidRequestPayload(chunks[chunkIndex], roasType);

      if (requestPayload.goods_info_list.length <= 0) {
        continue;
      }

      const sessionResult = await adsSessionService.postWithRegionCookie(
        normalizeText(shop && shop.id),
        regionId,
        ADS_GET_BID_URL,
        requestPayload,
        {
          allRegionIds: regionIds,
          reason: `${regionId}-get-bid-page-${pageNumber}-chunk-${chunkIndex + 1}`
        }
      );
      const response = sessionResult && sessionResult.response ? sessionResult.response : null;

      if (typeof assertApiSuccess === 'function') {
        assertApiSuccess(response, '\u51fa\u4ef7\u9884\u6d4b\u67e5\u8be2\u5931\u8d25');
      }

      const extracted = extractBidResults(response);

      bidRows.push(...extracted.rows);
      details.push({
        pageNumber,
        chunkIndex: chunkIndex + 1,
        requestCount: requestPayload.goods_info_list.length,
        responseCount: extracted.rows.length,
        currency: extracted.currency,
        refreshedCookies: sessionResult && sessionResult.refreshedCookies === true,
        cookieSyncMode: normalizeText(sessionResult && sessionResult.cookieSyncMode)
      });
    }

    return {
      rows: bidRows,
      lookup: buildBidLookup(bidRows),
      details,
      requestCount: details.reduce((sum, detail) => sum + detail.requestCount, 0),
      responseCount: details.reduce((sum, detail) => sum + detail.responseCount, 0)
    };
  }

  return {
    fetchBidInfoForRows
  };
}

module.exports = {
  createPromotionManagerNewBidFetcher
};
