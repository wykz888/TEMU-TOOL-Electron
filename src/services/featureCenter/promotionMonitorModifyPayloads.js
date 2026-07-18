const { normalizeText } = require('../shopManagement/common');
const { normalizeRoasRawValue } = require('./promotionMonitorMetricUtils');

const ADS_MODIFY_STATUS_RESUME = 0;
const ADS_MODIFY_STATUS_PAUSE = 2;
const ADS_MODIFY_STATUS_DELETE = 3;

function buildModifyAdsPayload(actionType, item, monitorConfig) {
  const normalizedActionType = normalizeText(actionType);
  const goodsId = normalizeText(item && item.goodsId);
  const adId = normalizeText(item && item.adId);

  if (normalizedActionType === 'pause_plan') {
    return goodsId
      ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_PAUSE }] }
      : null;
  }

  if (normalizedActionType === 'resume_plan') {
    return goodsId
      ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_RESUME }] }
      : null;
  }

  if (normalizedActionType === 'delete_plan') {
    return goodsId
      ? { modify_ad_dtos: [{ goods_id: goodsId, status: ADS_MODIFY_STATUS_DELETE }] }
      : null;
  }

  const targetRoasRaw = normalizeRoasRawValue(monitorConfig && monitorConfig.targetRoas);

  if (!goodsId || !adId || targetRoasRaw === null) {
    return null;
  }

  if (normalizedActionType === 'update_roas') {
    if (item && item.targetRoasRaw !== null && item.targetRoasRaw === targetRoasRaw) {
      return null;
    }

    return {
      modify_ad_dtos: [{
        ad_id: adId,
        roas: targetRoasRaw,
        goods_id: goodsId,
        roas_type: 1
      }]
    };
  }

  if (normalizedActionType === 'increase_roas') {
    if (item && item.targetRoasRaw === null) {
      return null;
    }

    return {
      modify_ad_dtos: [{
        ad_id: adId,
        roas: Math.max(0, item.targetRoasRaw + targetRoasRaw),
        goods_id: goodsId,
        roas_type: 1
      }]
    };
  }

  return null;
}

module.exports = {
  ADS_MODIFY_STATUS_RESUME,
  ADS_MODIFY_STATUS_PAUSE,
  ADS_MODIFY_STATUS_DELETE,
  buildModifyAdsPayload
};
