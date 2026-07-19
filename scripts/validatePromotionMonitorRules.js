const assert = require('node:assert/strict');
const {
  normalizeAdsDetailItem,
  resolveAdsDetailProductCount
} = require('../src/services/featureCenter/promotionMonitorAdsDetailItemParser');
const {
  detectAdsDetailHasMore,
  fetchAdsDetailItemsBySortForRegion
} = require('../src/services/featureCenter/promotionMonitorAdsDetailItems');
const {
  resolveMonitorAutoPauseDecision,
  shouldAutoPauseBySpend,
  shouldAutoPauseByRoas
} = require('../src/services/featureCenter/promotionMonitorOperationRules');
const {
  resolvePauseSequenceExecution,
  resolvePauseThenResumeCheckDueAt,
  resolvePauseThenResumeDueAtFromPausedAt,
  shouldSkipUntrackedPausedSequenceItem,
  PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES
} = require('../src/services/featureCenter/promotionMonitorPauseSequenceRules');
const {
  buildModifyAdsPayload
} = require('../src/services/featureCenter/promotionMonitorModifyPayloads');

function buildAdsDetailRow(patch = {}) {
  return {
    goods_id: '607562766321739',
    ad_id: '1000000967565151',
    goods_name: 'Sample product',
    goods_image_url: 'https://cdn.example.com/item.jpg',
    ad_show_status: 8,
    fast_start_info: {
      active: 1
    },
    roas: 6.07,
    summary: {
      spend: {
        total: {
          value: '\u00a512.50'
        }
      },
      order_pay_cnt: {
        total: {
          value: '3'
        }
      },
      roas: {
        total: {
          value: '2.5'
        }
      }
    },
    ...patch
  };
}

function validateAdsDetailItemParsing() {
  const item = normalizeAdsDetailItem(buildAdsDetailRow(), 'us');

  assert.equal(item.goodsId, '607562766321739');
  assert.equal(item.adId, '1000000967565151');
  assert.equal(item.productName, 'Sample product');
  assert.equal(item.regionId, 'us');
  assert.equal(item.fastStartEnabled, true);
  assert.equal(item.isPaused, false);
  assert.equal(item.orderCount, 3);
  assert.equal(item.currentRoasRaw, 25000);
  assert.equal(item.targetRoasRaw, 60700);
  assert.equal(resolveAdsDetailProductCount({ result: { total: 3 } }, 'us'), 3);
}

function validateAdsDetailPagingRules() {
  assert.equal(detectAdsDetailHasMore({ result: { total_page: 2 } }, 1, 50), true);
  assert.equal(detectAdsDetailHasMore({ result: { total_page: 2 } }, 2, 50), false);
  assert.equal(detectAdsDetailHasMore({ result: { total: 150 } }, 1, 100, 100), true);
  assert.equal(detectAdsDetailHasMore({ result: { total: 150 } }, 2, 50, 100), false);
}

async function validateAdsDetailPagedCollection() {
  const requestedPages = [];
  const requestPayload = {
    list_id: 'stable-list-id',
    start_time: 1784304000000,
    end_time: 1784390399999
  };
  const firstResponse = {
    ok: true,
    success: true,
    data: {
      result: {
        ads_detail: [buildAdsDetailRow({ goods_id: 'goods-1', ad_id: 'ad-1' })],
        total_page: 2
      }
    }
  };
  const items = await fetchAdsDetailItemsBySortForRegion('shop-a', 'us', {
    firstResponse,
    requestPayload,
    pageSize: 1,
    postWithRegionCookie: async (shopId, regionId, url, payload) => {
      requestedPages.push({
        shopId,
        regionId,
        url,
        pageNumber: payload.page_number,
        listId: payload.list_id,
        startTime: payload.start_time,
        endTime: payload.end_time
      });

      return {
        response: {
          ok: true,
          success: true,
          data: {
            result: {
              ads_detail: [buildAdsDetailRow({ goods_id: 'goods-2', ad_id: 'ad-2' })],
              total_page: 2
            }
          }
        }
      };
    }
  });

  assert.equal(items.length, 2);
  assert.equal(requestedPages.length, 1);
  assert.equal(requestedPages[0].shopId, 'shop-a');
  assert.equal(requestedPages[0].regionId, 'us');
  assert.equal(requestedPages[0].pageNumber, 2);
  assert.equal(requestedPages[0].listId, requestPayload.list_id);
  assert.equal(requestedPages[0].startTime, requestPayload.start_time);
  assert.equal(requestedPages[0].endTime, requestPayload.end_time);
  await assert.rejects(
    () => fetchAdsDetailItemsBySortForRegion('shop-a', 'us', {
      firstResponse,
      requestPayload,
      pageSize: 1
    }),
    /pagination unavailable/
  );
}

function validateAutoOperationRules() {
  assert.equal(
    shouldAutoPauseBySpend({ adSpend: 101, orderCount: 0 }, 100),
    true
  );
  assert.equal(
    shouldAutoPauseBySpend({ adSpend: 101, orderCount: 1 }, 100),
    false
  );
  assert.equal(
    shouldAutoPauseByRoas({ currentRoasRaw: 5000, orderCount: 2 }, 6000),
    true
  );
  assert.equal(
    shouldAutoPauseByRoas({ currentRoasRaw: 5000, orderCount: 0 }, 6000),
    false
  );
  assert.deepEqual(
    resolveMonitorAutoPauseDecision({ adSpend: 101, orderCount: 0 }, { spendThreshold: 100 }),
    { matched: true, reason: 'spend' }
  );
}

function validatePauseSequenceRules() {
  const pausedAt = new Date(Date.now() - (2 * 60 * 1000)).toISOString();

  assert.equal(
    resolvePauseSequenceExecution(
      { knownPausedState: true, pausedAt },
      { isPaused: true, targetRoasRaw: 50000 },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: 1, targetRoas: 8 }
    ).executionActionType,
    'update_roas'
  );
  assert.equal(
    resolvePauseThenResumeDueAtFromPausedAt(Date.parse('2026-07-18T10:00:00+08:00'), PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES),
    new Date(2026, 6, 19).getTime()
  );
  assert.deepEqual(
    resolvePauseSequenceExecution(
      { knownPausedState: true },
      { isPaused: true, targetRoasRaw: 120000 },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES, targetRoas: 12 }
    ),
    {
      executionActionType: '',
      skipReason: 'resume_waiting',
      shouldEvaluateConditions: false
    }
  );
  assert.equal(
    resolvePauseThenResumeCheckDueAt(
      { knownPausedState: true },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES, targetRoas: 12 }
    ),
    Number.MAX_SAFE_INTEGER
  );
  assert.equal(
    resolvePauseSequenceExecution(
      {
        knownPausedState: true,
        pauseStateUpdatedAt: new Date(Date.now() - (2 * 60 * 1000)).toISOString()
      },
      { isPaused: true, targetRoasRaw: 80000 },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: 1, targetRoas: 8 }
    ).executionActionType,
    'resume_plan'
  );
  assert.equal(
    shouldSkipUntrackedPausedSequenceItem(
      null,
      { isPaused: true, targetRoasRaw: 150000 },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES, targetRoas: 12 }
    ),
    true
  );
  assert.equal(
    shouldSkipUntrackedPausedSequenceItem(
      { knownPausedState: true, pausedAt },
      { isPaused: true, targetRoasRaw: 150000 },
      { actionType: 'pause_then_modify_resume', resumeIntervalMinutes: PAUSE_THEN_RESUME_NEXT_DAY_START_MINUTES, targetRoas: 12 }
    ),
    false
  );
  assert.deepEqual(
    resolvePauseSequenceExecution(
      { knownPausedState: true, pausedAt },
      { isPaused: true, targetRoasRaw: 80000 },
      { actionType: 'pause_then_modify', targetRoas: 8 }
    ),
    {
      executionActionType: '',
      skipReason: 'action_payload'
    }
  );
  assert.equal(
    resolvePauseSequenceExecution(
      { knownPausedState: true, pausedAt },
      { isPaused: true, targetRoasRaw: 70000 },
      { actionType: 'pause_then_modify', targetRoas: 8 }
    ).executionActionType,
    'update_roas'
  );
}

function validateModifyPayloads() {
  assert.deepEqual(
    buildModifyAdsPayload('pause_plan', { goodsId: '607' }, {}),
    { modify_ad_dtos: [{ goods_id: '607', status: 2 }] }
  );
  assert.deepEqual(
    buildModifyAdsPayload('resume_plan', { goodsId: '607' }, {}),
    { modify_ad_dtos: [{ goods_id: '607', status: 0 }] }
  );
  assert.deepEqual(
    buildModifyAdsPayload('delete_plan', { goodsId: '607' }, {}),
    { modify_ad_dtos: [{ goods_id: '607', status: 3 }] }
  );
  assert.deepEqual(
    buildModifyAdsPayload(
      'update_roas',
      { goodsId: '607', adId: '100', targetRoasRaw: 50000 },
      { targetRoas: 8 }
    ),
    {
      modify_ad_dtos: [{
        ad_id: '100',
        roas: 80000,
        goods_id: '607',
        roas_type: 1
      }]
    }
  );
  assert.deepEqual(
    buildModifyAdsPayload(
      'increase_roas',
      { goodsId: '607', adId: '100', targetRoasRaw: 50000 },
      { targetRoas: 1.5 }
    ),
    {
      modify_ad_dtos: [{
        ad_id: '100',
        roas: 65000,
        goods_id: '607',
        roas_type: 1
      }]
    }
  );
  assert.equal(
    buildModifyAdsPayload(
      'update_roas',
      { goodsId: '607', adId: '100', targetRoasRaw: 80000 },
      { targetRoas: 8 }
    ),
    null
  );
  assert.equal(
    buildModifyAdsPayload(
      'increase_roas',
      { goodsId: '607', adId: '100', targetRoasRaw: null },
      { targetRoas: 1.5 }
    ),
    null
  );
  assert.equal(
    buildModifyAdsPayload(
      'update_roas',
      { goodsId: '607', targetRoasRaw: 50000 },
      { targetRoas: 8 }
    ),
    null
  );
}

async function main() {
  validateAdsDetailItemParsing();
  validateAdsDetailPagingRules();
  await validateAdsDetailPagedCollection();
  validateAutoOperationRules();
  validatePauseSequenceRules();
  validateModifyPayloads();

  console.log('promotion monitor rule validation passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
