const DEFAULT_THUMBNAIL_SIZE = 160;
const IMAGE_VIEW2_PREFIX = 'imageView2/';

export function normalizePromotionImageUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPromotionOriginalImageUrl(value) {
  const url = normalizePromotionImageUrl(value);

  if (!url) {
    return '';
  }

  const hashIndex = url.indexOf('#');
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const queryIndex = urlWithoutHash.indexOf('?');

  if (queryIndex < 0) {
    return url;
  }

  const baseUrl = urlWithoutHash.slice(0, queryIndex);
  const query = urlWithoutHash.slice(queryIndex + 1);
  const keptQueryParts = query
    .split('&')
    .filter((part) => part && !part.toLowerCase().startsWith(IMAGE_VIEW2_PREFIX.toLowerCase()));
  const queryText = keptQueryParts.length > 0 ? `?${keptQueryParts.join('&')}` : '';

  return `${baseUrl}${queryText}${hash}`;
}

export function buildPromotionThumbnailUrl(value, size = DEFAULT_THUMBNAIL_SIZE) {
  const originalUrl = getPromotionOriginalImageUrl(value);

  if (!originalUrl) {
    return '';
  }

  const safeSize = normalizeThumbnailSize(size);
  const hashIndex = originalUrl.indexOf('#');
  const urlWithoutHash = hashIndex >= 0 ? originalUrl.slice(0, hashIndex) : originalUrl;
  const hash = hashIndex >= 0 ? originalUrl.slice(hashIndex) : '';
  const separator = urlWithoutHash.includes('?') ? '&' : '?';

  return `${urlWithoutHash}${separator}${IMAGE_VIEW2_PREFIX}1/w/${safeSize}/h/${safeSize}${hash}`;
}

export function buildPromotionImagePreviewProps(value) {
  const src = getPromotionOriginalImageUrl(value);

  if (!src) {
    return undefined;
  }

  return {
    src,
    maskClosable: false
  };
}

function normalizeThumbnailSize(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return DEFAULT_THUMBNAIL_SIZE;
  }

  return Math.max(80, Math.min(320, Math.round(numberValue)));
}
