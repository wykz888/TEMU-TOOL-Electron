const TRACKED_SIGNAL_LIMIT = 120;
const TRACKED_TASK_GROUP_LIMIT = 80;
const TRACKED_REQUEST_TYPES = new Set(['XHR', 'Fetch']);
const MAX_RESPONSE_TEXT_LENGTH = 2 * 1024 * 1024;
const URL_KEYWORDS = ['generate', 'submit', 'create', 'task', 'draw', 'image', 'result'];
const RATIO_TYPE_VALUE_MAP = new Map([
  [1, 1],
  [2, 3 / 4],
  [3, 16 / 9],
  [4, 4 / 3],
  [5, 9 / 16],
  [6, 2 / 3],
  [7, 3 / 2],
  [8, 21 / 9]
]);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function looksLikeImageUrl(value) {
  const text = normalizeText(value);

  if (!text || /^data:/i.test(text)) {
    return false;
  }

  return (
    /^https?:\/\//i.test(text)
    && (
      /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(text)
      || /image/i.test(text)
    )
  );
}

function pathLooksRelevant(url) {
  const text = normalizeLowerText(url);

  return URL_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isIgnoredImageFieldName(fieldName) {
  const normalized = normalizeLowerText(fieldName);

  return (
    normalized === 'cover_url'
    || normalized === 'coverurl'
    || normalized === 'cover_url_map'
    || normalized === 'coverurlmap'
    || normalized === 'icon_url'
    || normalized === 'iconurl'
    || normalized === 'icon_url_svg'
    || normalized === 'iconurlsvg'
  );
}

function isPreferredImageFieldName(fieldName) {
  const normalized = normalizeLowerText(fieldName);

  return (
    normalized === 'url'
    || normalized === 'src'
    || normalized === 'image_url'
    || normalized === 'imageurl'
    || normalized === 'origin_url'
    || normalized === 'originurl'
    || normalized === 'download_url'
    || normalized === 'downloadurl'
  );
}

function trimText(value, maxLength = 240) {
  const text = normalizeText(value);

  if (!text) {
    return '';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function toPositiveNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue;
}

function normalizeRatioValue(value) {
  const text = normalizeText(value);

  if (!text) {
    return 0;
  }

  if (/^\d+(?:\.\d+)?\s*[:/x]\s*\d+(?:\.\d+)?$/i.test(text)) {
    const [leftText, rightText] = text.split(/[:/x]/i);
    const left = toPositiveNumber(leftText);
    const right = toPositiveNumber(rightText);

    return left > 0 && right > 0 ? left / right : 0;
  }

  const numericValue = toPositiveNumber(text);

  if (!numericValue) {
    return 0;
  }

  if (RATIO_TYPE_VALUE_MAP.has(numericValue)) {
    return RATIO_TYPE_VALUE_MAP.get(numericValue) || 0;
  }

  return numericValue;
}

function buildImageRecordKey(value, fallback = '') {
  return normalizeText(value) || normalizeText(fallback);
}

function buildImageRecord(url, metadata = {}) {
  return {
    key: buildImageRecordKey(metadata.key, url),
    url: normalizeText(url),
    width: Math.max(0, Number(metadata.width) || 0),
    height: Math.max(0, Number(metadata.height) || 0),
    preferred: metadata.preferred === true
  };
}

function shouldReplaceImageRecord(existingRecord, nextRecord) {
  if (!existingRecord) {
    return true;
  }

  if (nextRecord.preferred === true && existingRecord.preferred !== true) {
    return true;
  }

  if (existingRecord.preferred === true && nextRecord.preferred !== true) {
    return false;
  }

  const existingPixels = Math.max(0, Number(existingRecord.width) || 0) * Math.max(0, Number(existingRecord.height) || 0);
  const nextPixels = Math.max(0, Number(nextRecord.width) || 0) * Math.max(0, Number(nextRecord.height) || 0);

  if (nextPixels > existingPixels) {
    return true;
  }

  if (existingPixels <= 0 && nextPixels > 0) {
    return true;
  }

  if (
    nextPixels === existingPixels
    && normalizeText(nextRecord.url)
    && normalizeText(nextRecord.url) !== normalizeText(existingRecord.url)
  ) {
    return true;
  }

  return false;
}

function looksLikeImageContainer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Boolean(
    Array.isArray(value.large_images)
    || (value.image && Array.isArray(value.image.large_images))
    || looksLikeImageUrl(value.url)
    || looksLikeImageUrl(value.src)
    || looksLikeImageUrl(value.image_url)
    || looksLikeImageUrl(value.imageUrl)
    || looksLikeImageUrl(value.origin_url)
    || looksLikeImageUrl(value.originUrl)
    || looksLikeImageUrl(value.download_url)
    || looksLikeImageUrl(value.downloadUrl)
    || normalizeText(value.image_uri)
    || normalizeText(value.imageUri)
    || (
      value.common_attr
      && (
        normalizeText(value.common_attr.id)
        || normalizeText(value.common_attr.local_item_id)
        || normalizeText(value.common_attr.effect_id)
      )
    )
  );
}

function extractImageRecordKeyFromObject(value, fallbackKey = '') {
  if (looksLikeImageContainer(value) !== true) {
    return buildImageRecordKey(fallbackKey);
  }

  const candidates = [
    value.image_uri,
    value.imageUri,
    value.file && value.file.file_uri,
    value.common_attr && value.common_attr.id,
    value.common_attr && value.common_attr.local_item_id,
    value.common_attr && value.common_attr.effect_id,
    value.local_item_id,
    value.effect_id
  ];

  return candidates
    .map((item) => normalizeText(item))
    .find(Boolean) || buildImageRecordKey(fallbackKey);
}

function extractRatioValueFromObject(value, inheritedRatioValue = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return inheritedRatioValue;
  }

  const directCandidates = [
    value.aspect_ratio,
    value.image_ratio,
    value.ratio,
    value.ratio_type
  ];

  for (let index = 0; index < directCandidates.length; index += 1) {
    const ratioValue = normalizeRatioValue(directCandidates[index]);

    if (ratioValue > 0) {
      return ratioValue;
    }
  }

  const nestedCandidates = [
    value.common_attr && value.common_attr.aspect_ratio,
    value.common_attr && value.common_attr.image_ratio,
    value.aigc_image_params
      && value.aigc_image_params.text2image_params
      && value.aigc_image_params.text2image_params.image_ratio,
    value.text2image_params && value.text2image_params.image_ratio
  ];

  for (let index = 0; index < nestedCandidates.length; index += 1) {
    const ratioValue = normalizeRatioValue(nestedCandidates[index]);

    if (ratioValue > 0) {
      return ratioValue;
    }
  }

  const largeImageInfo = value.large_image_info
    || (
      value.aigc_image_params
      && value.aigc_image_params.text2image_params
      && value.aigc_image_params.text2image_params.large_image_info
    )
    || null;
  const largeImageWidth = toPositiveNumber(largeImageInfo && largeImageInfo.width);
  const largeImageHeight = toPositiveNumber(largeImageInfo && largeImageInfo.height);

  if (largeImageWidth > 0 && largeImageHeight > 0) {
    return largeImageWidth / largeImageHeight;
  }

  return inheritedRatioValue;
}

function pickPreferredLargeImage(largeImages, expectedRatioValue = 0) {
  const candidates = (Array.isArray(largeImages) ? largeImages : [])
    .map((item, index) => ({
      index,
      url: normalizeText(item && item.image_url),
      imageUri: normalizeText(item && item.image_uri),
      width: Math.max(0, Number(item && item.width) || 0),
      height: Math.max(0, Number(item && item.height) || 0),
      size: Math.max(0, Number(item && item.size) || 0)
    }))
    .filter((item) => looksLikeImageUrl(item.url));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => {
    if (expectedRatioValue > 0) {
      const leftRatio = left.width > 0 && left.height > 0 ? left.width / left.height : 0;
      const rightRatio = right.width > 0 && right.height > 0 ? right.width / right.height : 0;
      const leftDistance = leftRatio > 0 ? Math.abs(leftRatio - expectedRatioValue) : Number.POSITIVE_INFINITY;
      const rightDistance = rightRatio > 0 ? Math.abs(rightRatio - expectedRatioValue) : Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
    }

    if (right.index !== left.index) {
      return right.index - left.index;
    }

    const leftPixels = left.width * left.height;
    const rightPixels = right.width * right.height;

    if (rightPixels !== leftPixels) {
      return rightPixels - leftPixels;
    }

    return right.size - left.size;
  })[0];
}

function pickFirstImageUrl(imageRecords) {
  if (!Array.isArray(imageRecords) || imageRecords.length === 0) {
    return '';
  }

  for (let index = 0; index < imageRecords.length; index += 1) {
    const candidate = imageRecords[index];
    const url = normalizeText(candidate && candidate.url);

    if (url) {
      return url;
    }
  }

  return '';
}

function createIdSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((item) => normalizeText(item))
      .filter(Boolean)
  );
}

function appendUniqueValues(targetSet, values) {
  (Array.isArray(values) ? values : []).forEach((item) => {
    const normalized = normalizeText(item);

    if (normalized) {
      targetSet.add(normalized);
    }
  });
}

function buildTaskGroupSnapshot(group) {
  if (!group || typeof group !== 'object') {
    return null;
  }

  return {
    groupId: normalizeText(group.groupId),
    firstEventId: Math.max(0, Number(group.firstEventId) || 0),
    latestEventId: Math.max(0, Number(group.latestEventId) || 0),
    latestKind: normalizeText(group.latestKind),
    taskIds: Array.from(group.taskIds || []),
    submitIds: Array.from(group.submitIds || []),
    generateIds: Array.from(group.generateIds || []),
    imageRecords: Array.from(group.imageRecordMap || new Map()).map((item) => ({ ...item[1] })),
    queueHints: Array.from(group.queueHints || []),
    statusHints: Array.from(group.statusHints || []),
    finishedImageCount: Math.max(0, Number(group.finishedImageCount) || 0),
    totalImageCount: Math.max(0, Number(group.totalImageCount) || 0),
    queueLength: Math.max(0, Number(group.queueLength) || 0),
    queueIndex: Math.max(0, Number(group.queueIndex) || 0),
    queueStatus: Math.max(0, Number(group.queueStatus) || 0)
  };
}

function collectJsonInsights(payload) {
  const imageRecordMap = new Map();
  const taskIds = new Set();
  const submitIds = new Set();
  const generateIds = new Set();
  const queueHints = new Set();
  const successFlags = [];
  const statusHints = new Set();
  const seen = new Set();
  let finishedImageCount = 0;
  let totalImageCount = 0;
  let queueLength = 0;
  let queueIndex = 0;
  let queueStatus = 0;

  function addImageRecord(url, metadata = {}, options = {}) {
    const normalizedUrl = normalizeText(url);
    const recordKey = buildImageRecordKey(metadata && metadata.key, normalizedUrl);

    if (!looksLikeImageUrl(normalizedUrl) || !recordKey) {
      return;
    }

    const nextRecord = buildImageRecord(normalizedUrl, {
      ...metadata,
      key: recordKey,
      preferred: options && options.preferred === true
    });
    const existingRecord = imageRecordMap.get(recordKey);

    if (shouldReplaceImageRecord(existingRecord, nextRecord)) {
      imageRecordMap.set(recordKey, nextRecord);
    }
  }

  function visit(value, inheritedRatioValue = 0, inheritedRecordKey = '') {
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string') {
        if (looksLikeImageUrl(value)) {
          addImageRecord(value, {
            key: inheritedRecordKey
          });
        }

        if (/\d+\s*\/\s*\d+/.test(value) && /(生成中|排队|队列|queue|processing)/i.test(value)) {
          queueHints.add(trimText(value));
        }
      }

      return;
    }

    if (seen.has(value)) {
      return;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => {
        visit(item, inheritedRatioValue, inheritedRecordKey);
      });
      return;
    }

    const expectedRatioValue = extractRatioValueFromObject(value, inheritedRatioValue);
    const recordKey = extractImageRecordKeyFromObject(value, inheritedRecordKey);

    const widthCandidate = (
      value.width
      || value.w
      || value.image_width
      || value.imageWidth
      || value.img_width
      || value.imgWidth
      || 0
    );
    const heightCandidate = (
      value.height
      || value.h
      || value.image_height
      || value.imageHeight
      || value.img_height
      || value.imgHeight
      || 0
    );

    if (Array.isArray(value.large_images) && value.large_images.length > 0) {
      const preferredLargeImage = pickPreferredLargeImage(value.large_images, expectedRatioValue);

      if (preferredLargeImage) {
        addImageRecord(preferredLargeImage.url, {
          key: buildImageRecordKey(preferredLargeImage.imageUri, recordKey),
          width: preferredLargeImage.width,
          height: preferredLargeImage.height
        }, {
          preferred: true
        });
      }
    }

    if (looksLikeImageContainer(value) === true) {
      [
        value.url,
        value.src,
        value.image_url,
        value.imageUrl,
        value.origin_url,
        value.originUrl,
        value.download_url,
        value.downloadUrl
      ].forEach((url) => {
        addImageRecord(url, {
          key: recordKey,
          width: widthCandidate,
          height: heightCandidate
        });
      });
    }

    Object.entries(value).forEach(([key, fieldValue]) => {
      const lowerKey = String(key || '').toLowerCase();

      if (isIgnoredImageFieldName(lowerKey)) {
        return;
      }

      if (
        (
          lowerKey.includes('taskid')
          || lowerKey.includes('task_id')
          || lowerKey.includes('recordid')
          || lowerKey.includes('record_id')
          || lowerKey.includes('historyid')
          || lowerKey.includes('history_id')
        )
        && (typeof fieldValue === 'string' || typeof fieldValue === 'number')
      ) {
        taskIds.add(String(fieldValue));
      }

      if ((lowerKey === 'submit_id' || lowerKey === 'submitid') && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
        submitIds.add(String(fieldValue));
      }

      if ((lowerKey === 'generate_id' || lowerKey === 'generateid') && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
        generateIds.add(String(fieldValue));
      }

      if (lowerKey === 'success' && typeof fieldValue === 'boolean') {
        successFlags.push(fieldValue);
      }

      if (
        (lowerKey === 'code' || lowerKey === 'statuscode' || lowerKey === 'status_code')
        && (typeof fieldValue === 'number' || typeof fieldValue === 'string')
      ) {
        const numericValue = Number(fieldValue);

        if (numericValue === 0 || numericValue === 200) {
          successFlags.push(true);
        }
      }

      if ((lowerKey === 'status' || lowerKey === 'state') && typeof fieldValue === 'string') {
        statusHints.add(trimText(fieldValue));
      }

      if (lowerKey === 'finished_image_count') {
        finishedImageCount = Math.max(finishedImageCount, Math.max(0, Number(fieldValue) || 0));
      }

      if (lowerKey === 'total_image_count') {
        totalImageCount = Math.max(totalImageCount, Math.max(0, Number(fieldValue) || 0));
      }

      if (lowerKey === 'queue_length') {
        queueLength = Math.max(queueLength, Math.max(0, Number(fieldValue) || 0));
      }

      if (lowerKey === 'queue_idx') {
        queueIndex = Math.max(queueIndex, Math.max(0, Number(fieldValue) || 0));
      }

      if (lowerKey === 'queue_status') {
        queueStatus = Math.max(queueStatus, Math.max(0, Number(fieldValue) || 0));
      }

      if (typeof fieldValue === 'string' && /\d+\s*\/\s*\d+/.test(fieldValue) && /(生成中|排队|队列|queue|processing)/i.test(fieldValue)) {
        queueHints.add(trimText(fieldValue));
      }

      if (
        typeof fieldValue === 'string'
        && isPreferredImageFieldName(lowerKey)
        && looksLikeImageContainer(value) === true
      ) {
        addImageRecord(fieldValue, {
          key: recordKey,
          width: widthCandidate,
          height: heightCandidate
        });
      }

      visit(fieldValue, expectedRatioValue, recordKey);
    });
  }

  visit(payload, 0);

  return {
    imageRecords: Array.from(imageRecordMap.values()),
    taskIds: Array.from(taskIds),
    submitIds: Array.from(submitIds),
    generateIds: Array.from(generateIds),
    queueHints: Array.from(queueHints),
    statusHints: Array.from(statusHints),
    success: successFlags.includes(true),
    finishedImageCount,
    totalImageCount,
    queueLength,
    queueIndex,
    queueStatus
  };
}

function buildSignalEvent(entry, insights) {
  const status = Math.max(0, Number(entry.status) || 0);
  const submissionLike = entry.method === 'POST' && status >= 200 && status < 400 && pathLooksRelevant(entry.url);
  let kind = 'other';

  if (Array.isArray(insights.imageRecords) && insights.imageRecords.length > 0) {
    kind = 'result';
  } else if (submissionLike && (insights.success === true || insights.taskIds.length > 0 || insights.queueHints.length > 0)) {
    kind = 'submission';
  } else if (insights.taskIds.length > 0 || insights.queueHints.length > 0) {
    kind = 'task';
  } else if (submissionLike) {
    kind = 'submission';
  }

  return {
    kind,
    url: normalizeText(entry.url),
    method: normalizeText(entry.method).toUpperCase(),
    status,
    mimeType: normalizeText(entry.mimeType),
    requestPostDataPreview: trimText(entry.postData, 400),
    imageRecords: Array.isArray(insights.imageRecords) ? insights.imageRecords : [],
    taskIds: Array.isArray(insights.taskIds) ? insights.taskIds : [],
    submitIds: Array.isArray(insights.submitIds) ? insights.submitIds : [],
    generateIds: Array.isArray(insights.generateIds) ? insights.generateIds : [],
    queueHints: Array.isArray(insights.queueHints) ? insights.queueHints : [],
    statusHints: Array.isArray(insights.statusHints) ? insights.statusHints : [],
    success: insights.success === true,
    finishedImageCount: Math.max(0, Number(insights.finishedImageCount) || 0),
    totalImageCount: Math.max(0, Number(insights.totalImageCount) || 0),
    queueLength: Math.max(0, Number(insights.queueLength) || 0),
    queueIndex: Math.max(0, Number(insights.queueIndex) || 0),
    queueStatus: Math.max(0, Number(insights.queueStatus) || 0)
  };
}

function createJimengImageNetworkTracker({
  getBrowserView,
  log,
  logError
}) {
  let attachedWebContents = null;
  let networkEnabled = false;
  let nextEventId = 0;
  const requestMap = new Map();
  const signalEvents = [];
  const taskGroups = [];
  const taskGroupMap = new Map();
  const taskAliasMap = new Map();

  function getWebContents() {
    const browserView = typeof getBrowserView === 'function' ? getBrowserView() : null;

    if (
      !browserView
      || !browserView.webContents
      || typeof browserView.webContents.isDestroyed !== 'function'
      || browserView.webContents.isDestroyed() === true
    ) {
      return null;
    }

    return browserView.webContents;
  }

  function getDebugger() {
    const webContents = getWebContents();

    return webContents ? webContents.debugger : null;
  }

  function buildAliasKeysFromEntity(entity) {
    const aliasKeys = [];

    (Array.isArray(entity && entity.taskIds) ? entity.taskIds : []).forEach((item) => {
      const normalized = normalizeText(item);

      if (normalized) {
        aliasKeys.push(`task:${normalized}`);
      }
    });

    (Array.isArray(entity && entity.submitIds) ? entity.submitIds : []).forEach((item) => {
      const normalized = normalizeText(item);

      if (normalized) {
        aliasKeys.push(`submit:${normalized}`);
      }
    });

    (Array.isArray(entity && entity.generateIds) ? entity.generateIds : []).forEach((item) => {
      const normalized = normalizeText(item);

      if (normalized) {
        aliasKeys.push(`generate:${normalized}`);
      }
    });

    return aliasKeys;
  }

  function buildAliasKeysFromGroup(group) {
    return buildAliasKeysFromEntity({
      taskIds: Array.from(group && group.taskIds ? group.taskIds : []),
      submitIds: Array.from(group && group.submitIds ? group.submitIds : []),
      generateIds: Array.from(group && group.generateIds ? group.generateIds : [])
    });
  }

  function registerTaskGroupAliases(group) {
    buildAliasKeysFromGroup(group).forEach((aliasKey) => {
      taskAliasMap.set(aliasKey, group.groupId);
    });
  }

  function unregisterTaskGroupAliases(group) {
    buildAliasKeysFromGroup(group).forEach((aliasKey) => {
      if (taskAliasMap.get(aliasKey) === group.groupId) {
        taskAliasMap.delete(aliasKey);
      }
    });
  }

  function removeTaskGroup(group) {
    if (!group) {
      return;
    }

    unregisterTaskGroupAliases(group);
    taskGroupMap.delete(group.groupId);

    const groupIndex = taskGroups.findIndex((item) => item && item.groupId === group.groupId);

    if (groupIndex >= 0) {
      taskGroups.splice(groupIndex, 1);
    }
  }

  function trimTaskGroups() {
    while (taskGroups.length > TRACKED_TASK_GROUP_LIMIT) {
      removeTaskGroup(taskGroups[0]);
    }
  }

  function createTaskGroup(entry) {
    const group = {
      groupId: `task-group-${Math.max(1, Number(entry && entry.eventId) || (taskGroups.length + 1))}`,
      firstEventId: Math.max(0, Number(entry && entry.eventId) || 0),
      latestEventId: Math.max(0, Number(entry && entry.eventId) || 0),
      latestKind: normalizeText(entry && entry.kind),
      taskIds: createIdSet(entry && entry.taskIds),
      submitIds: createIdSet(entry && entry.submitIds),
      generateIds: createIdSet(entry && entry.generateIds),
      imageRecordMap: new Map(),
      queueHints: new Set(),
      statusHints: new Set(),
      finishedImageCount: 0,
      totalImageCount: 0,
      queueLength: 0,
      queueIndex: 0,
      queueStatus: 0
    };

    taskGroups.push(group);
    taskGroupMap.set(group.groupId, group);
    registerTaskGroupAliases(group);
    trimTaskGroups();

    return group;
  }

  function mergeTaskGroupInto(targetGroup, sourceGroup) {
    if (!targetGroup || !sourceGroup || targetGroup.groupId === sourceGroup.groupId) {
      return targetGroup;
    }

    appendUniqueValues(targetGroup.taskIds, Array.from(sourceGroup.taskIds || []));
    appendUniqueValues(targetGroup.submitIds, Array.from(sourceGroup.submitIds || []));
    appendUniqueValues(targetGroup.generateIds, Array.from(sourceGroup.generateIds || []));
    appendUniqueValues(targetGroup.queueHints, Array.from(sourceGroup.queueHints || []));
    appendUniqueValues(targetGroup.statusHints, Array.from(sourceGroup.statusHints || []));

    Array.from(sourceGroup.imageRecordMap || new Map()).forEach(([recordKey, record]) => {
      const existingRecord = targetGroup.imageRecordMap.get(recordKey);

      if (shouldReplaceImageRecord(existingRecord, record)) {
        targetGroup.imageRecordMap.set(recordKey, { ...record });
      }
    });

    targetGroup.firstEventId = Math.min(
      Math.max(0, Number(targetGroup.firstEventId) || 0),
      Math.max(0, Number(sourceGroup.firstEventId) || 0)
    );
    targetGroup.latestEventId = Math.max(
      Math.max(0, Number(targetGroup.latestEventId) || 0),
      Math.max(0, Number(sourceGroup.latestEventId) || 0)
    );
    targetGroup.latestKind = normalizeText(sourceGroup.latestKind) || targetGroup.latestKind;
    targetGroup.finishedImageCount = Math.max(
      Math.max(0, Number(targetGroup.finishedImageCount) || 0),
      Math.max(0, Number(sourceGroup.finishedImageCount) || 0)
    );
    targetGroup.totalImageCount = Math.max(
      Math.max(0, Number(targetGroup.totalImageCount) || 0),
      Math.max(0, Number(sourceGroup.totalImageCount) || 0)
    );
    targetGroup.queueLength = Math.max(
      Math.max(0, Number(targetGroup.queueLength) || 0),
      Math.max(0, Number(sourceGroup.queueLength) || 0)
    );
    targetGroup.queueIndex = Math.max(
      Math.max(0, Number(targetGroup.queueIndex) || 0),
      Math.max(0, Number(sourceGroup.queueIndex) || 0)
    );
    targetGroup.queueStatus = Math.max(
      Math.max(0, Number(targetGroup.queueStatus) || 0),
      Math.max(0, Number(sourceGroup.queueStatus) || 0)
    );

    removeTaskGroup(sourceGroup);
    registerTaskGroupAliases(targetGroup);

    return targetGroup;
  }

  function applySignalToTaskGroup(group, entry) {
    if (!group || !entry) {
      return group;
    }

    appendUniqueValues(group.taskIds, entry.taskIds);
    appendUniqueValues(group.submitIds, entry.submitIds);
    appendUniqueValues(group.generateIds, entry.generateIds);
    appendUniqueValues(group.queueHints, entry.queueHints);
    appendUniqueValues(group.statusHints, entry.statusHints);

    (Array.isArray(entry.imageRecords) ? entry.imageRecords : []).forEach((item) => {
      const recordKey = buildImageRecordKey(item && item.key, item && item.url);
      const normalizedUrl = normalizeText(item && item.url);
      const nextRecord = {
        key: recordKey,
        url: normalizedUrl,
        width: Math.max(0, Number(item && item.width) || 0),
        height: Math.max(0, Number(item && item.height) || 0),
        preferred: item && item.preferred === true
      };

      if (!recordKey || !normalizedUrl) {
        return;
      }

      const existingRecord = group.imageRecordMap.get(recordKey);

      if (shouldReplaceImageRecord(existingRecord, nextRecord)) {
        group.imageRecordMap.set(recordKey, nextRecord);
      }
    });

    if (Math.max(0, Number(entry.eventId) || 0) > 0) {
      if (group.firstEventId <= 0) {
        group.firstEventId = Math.max(0, Number(entry.eventId) || 0);
      } else {
        group.firstEventId = Math.min(group.firstEventId, Math.max(0, Number(entry.eventId) || 0));
      }

      group.latestEventId = Math.max(group.latestEventId, Math.max(0, Number(entry.eventId) || 0));
    }

    group.latestKind = normalizeText(entry.kind) || group.latestKind;
    group.finishedImageCount = Math.max(group.finishedImageCount, Math.max(0, Number(entry.finishedImageCount) || 0));
    group.totalImageCount = Math.max(group.totalImageCount, Math.max(0, Number(entry.totalImageCount) || 0));
    group.queueLength = Math.max(group.queueLength, Math.max(0, Number(entry.queueLength) || 0));
    group.queueIndex = Math.max(group.queueIndex, Math.max(0, Number(entry.queueIndex) || 0));
    group.queueStatus = Math.max(group.queueStatus, Math.max(0, Number(entry.queueStatus) || 0));
    registerTaskGroupAliases(group);

    return group;
  }

  function trackTaskGroup(entry) {
    const aliasKeys = buildAliasKeysFromEntity(entry);
    const matchedGroups = new Map();

    aliasKeys.forEach((aliasKey) => {
      const groupId = normalizeText(taskAliasMap.get(aliasKey));
      const group = groupId ? taskGroupMap.get(groupId) : null;

      if (group) {
        matchedGroups.set(group.groupId, group);
      }
    });

    let targetGroup = null;

    if (matchedGroups.size > 0) {
      const candidateGroups = Array.from(matchedGroups.values()).sort((left, right) => {
        return Math.max(0, Number(left.firstEventId) || 0) - Math.max(0, Number(right.firstEventId) || 0);
      });

      targetGroup = candidateGroups[0];

      for (let index = 1; index < candidateGroups.length; index += 1) {
        targetGroup = mergeTaskGroupInto(targetGroup, candidateGroups[index]);
      }
    } else if (
      entry
      && entry.kind !== 'other'
      && (
        aliasKeys.length > 0
        || (Array.isArray(entry.imageRecords) && entry.imageRecords.length > 0)
        || (Array.isArray(entry.queueHints) && entry.queueHints.length > 0)
      )
    ) {
      targetGroup = createTaskGroup(entry);
    }

    if (targetGroup) {
      applySignalToTaskGroup(targetGroup, entry);
    }

    return targetGroup;
  }

  function pushSignalEvent(signal) {
    const eventId = nextEventId + 1;
    const entry = {
      eventId,
      time: Date.now(),
      ...signal
    };
    const trackedGroup = trackTaskGroup(entry);

    nextEventId = eventId;
    signalEvents.push(entry);

    while (signalEvents.length > TRACKED_SIGNAL_LIMIT) {
      signalEvents.shift();
    }

    if (entry.kind !== 'other' && typeof log === 'function') {
      log('jimeng_network_signal', {
        eventId: entry.eventId,
        taskGroupId: trackedGroup ? trackedGroup.groupId : '',
        kind: entry.kind,
        method: entry.method,
        status: entry.status,
        url: entry.url,
        imageCount: entry.imageRecords.length,
        taskIdCount: entry.taskIds.length,
        submitIds: entry.submitIds,
        generateIds: entry.generateIds,
        queueHintCount: entry.queueHints.length,
        finishedImageCount: entry.finishedImageCount,
        totalImageCount: entry.totalImageCount,
        queueStatus: entry.queueStatus,
        queueIndex: entry.queueIndex,
        queueLength: entry.queueLength,
        firstImageUrl: trimText(pickFirstImageUrl(entry.imageRecords), 360)
      });
    }

    return entry;
  }

  async function inspectResponseBody(requestId) {
    const debuggerInstance = getDebugger();
    const requestEntry = requestMap.get(requestId);

    if (!debuggerInstance || !requestEntry) {
      return;
    }

    const mimeType = normalizeLowerText(requestEntry.mimeType);
    const shouldInspect = (
      TRACKED_REQUEST_TYPES.has(requestEntry.type)
      || mimeType.includes('json')
    );

    if (shouldInspect !== true) {
      requestMap.delete(requestId);
      return;
    }

    try {
      const responseBody = await debuggerInstance.sendCommand('Network.getResponseBody', {
        requestId
      });
      const rawBody = responseBody && responseBody.body
        ? (
          responseBody.base64Encoded === true
            ? Buffer.from(String(responseBody.body || ''), 'base64').toString('utf8')
            : String(responseBody.body || '')
        )
        : '';
      const bodyText = rawBody.slice(0, MAX_RESPONSE_TEXT_LENGTH);
      const payload = safeParseJson(bodyText);

      if (!payload) {
        requestMap.delete(requestId);
        return;
      }

      const insights = collectJsonInsights(payload);
      const signal = buildSignalEvent(requestEntry, insights);

      if (
        signal.kind !== 'other'
        || signal.imageRecords.length > 0
        || signal.taskIds.length > 0
        || signal.queueHints.length > 0
      ) {
        pushSignalEvent(signal);
      }
    } catch (error) {
      if (typeof logError === 'function') {
        logError('jimeng_network_body_inspect_failed', error, {
          requestId,
          url: requestEntry.url
        });
      }
    } finally {
      requestMap.delete(requestId);
    }
  }

  function handleDebuggerMessage(_event, method, params = {}) {
    if (method === 'Network.requestWillBeSent') {
      const request = params.request && typeof params.request === 'object' ? params.request : {};

      requestMap.set(String(params.requestId || ''), {
        url: normalizeText(request.url),
        method: normalizeText(request.method).toUpperCase() || 'GET',
        type: normalizeText(params.type),
        postData: typeof request.postData === 'string' ? request.postData : '',
        status: 0,
        mimeType: ''
      });

      return;
    }

    if (method === 'Network.responseReceived') {
      const requestId = String(params.requestId || '');
      const response = params.response && typeof params.response === 'object' ? params.response : {};
      const requestEntry = requestMap.get(requestId);

      if (!requestEntry) {
        return;
      }

      requestEntry.status = Math.max(0, Number(response.status) || 0);
      requestEntry.mimeType = normalizeText(response.mimeType);
      if (normalizeText(response.url)) {
        requestEntry.url = normalizeText(response.url);
      }

      return;
    }

    if (method === 'Network.loadingFinished') {
      void inspectResponseBody(String(params.requestId || ''));
      return;
    }

    if (method === 'Network.loadingFailed') {
      requestMap.delete(String(params.requestId || ''));
    }
  }

  async function ensureAttached() {
    const webContents = getWebContents();

    if (!webContents) {
      return false;
    }

    if (attachedWebContents !== webContents) {
      const previousDebugger = attachedWebContents ? attachedWebContents.debugger : null;

      if (previousDebugger) {
        previousDebugger.removeListener('message', handleDebuggerMessage);
      }

      attachedWebContents = webContents;
      networkEnabled = false;
    }

    const debuggerInstance = webContents.debugger;

    if (debuggerInstance.isAttached() !== true) {
      debuggerInstance.attach('1.3');
    }

    debuggerInstance.removeListener('message', handleDebuggerMessage);
    debuggerInstance.on('message', handleDebuggerMessage);

    if (networkEnabled !== true) {
      await debuggerInstance.sendCommand('Network.enable');
      networkEnabled = true;
    }

    return true;
  }

  function getLatestEventId() {
    return nextEventId;
  }

  function getSignalsAfter(afterEventId, kinds = []) {
    const normalizedAfter = Math.max(0, Number(afterEventId) || 0);
    const kindSet = Array.isArray(kinds) && kinds.length > 0
      ? new Set(kinds.map((item) => normalizeText(item)))
      : null;

    return signalEvents.filter((entry) => {
      if (entry.eventId <= normalizedAfter) {
        return false;
      }

      if (!kindSet) {
        return true;
      }

      return kindSet.has(entry.kind);
    }).map((entry) => ({
      ...entry,
      imageRecords: Array.isArray(entry.imageRecords) ? entry.imageRecords.map((item) => ({ ...item })) : [],
      taskIds: Array.isArray(entry.taskIds) ? [...entry.taskIds] : [],
      submitIds: Array.isArray(entry.submitIds) ? [...entry.submitIds] : [],
      generateIds: Array.isArray(entry.generateIds) ? [...entry.generateIds] : [],
      queueHints: Array.isArray(entry.queueHints) ? [...entry.queueHints] : [],
      statusHints: Array.isArray(entry.statusHints) ? [...entry.statusHints] : []
    }));
  }

  function getTaskGroupsAfter(afterEventId) {
    const normalizedAfter = Math.max(0, Number(afterEventId) || 0);

    return taskGroups
      .filter((group) => Math.max(0, Number(group && group.firstEventId) || 0) > normalizedAfter)
      .sort((left, right) => {
        const leftFirstEventId = Math.max(0, Number(left && left.firstEventId) || 0);
        const rightFirstEventId = Math.max(0, Number(right && right.firstEventId) || 0);

        if (leftFirstEventId !== rightFirstEventId) {
          return leftFirstEventId - rightFirstEventId;
        }

        return Math.max(0, Number(left && left.latestEventId) || 0) - Math.max(0, Number(right && right.latestEventId) || 0);
      })
      .map((group) => buildTaskGroupSnapshot(group))
      .filter(Boolean);
  }

  function destroy() {
    const debuggerInstance = getDebugger();

    if (debuggerInstance) {
      debuggerInstance.removeListener('message', handleDebuggerMessage);
    }

    attachedWebContents = null;
    networkEnabled = false;
    requestMap.clear();
    signalEvents.length = 0;
    taskGroups.length = 0;
    taskGroupMap.clear();
    taskAliasMap.clear();
  }

  return {
    destroy,
    ensureAttached,
    getLatestEventId,
    getSignalsAfter,
    getTaskGroupsAfter
  };
}

module.exports = {
  createJimengImageNetworkTracker
};
