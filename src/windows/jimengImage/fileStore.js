const fs = require('node:fs');
const path = require('node:path');
const { nativeImage } = require('electron');

const COMMON_RATIOS = [
  { label: '1x1', value: 1 },
  { label: '4x3', value: 4 / 3 },
  { label: '3x4', value: 3 / 4 },
  { label: '3x2', value: 3 / 2 },
  { label: '2x3', value: 2 / 3 },
  { label: '4x5', value: 4 / 5 },
  { label: '5x4', value: 5 / 4 },
  { label: '16x9', value: 16 / 9 },
  { label: '9x16', value: 9 / 16 },
  { label: '21x9', value: 21 / 9 }
];

function sanitizeFileNameSegment(value, fallback = 'image') {
  const normalized = String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 64).replace(/\.+$/g, '').trim() || fallback;
}

function sanitizeIdSegment(value, fallback = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

  return normalized || fallback;
}

function shortenIdSegment(value, maxLength = 12) {
  const normalized = sanitizeIdSegment(value, '');

  if (!normalized) {
    return '';
  }

  return normalized.slice(0, Math.max(4, Number(maxLength) || 12));
}

function gcd(left, right) {
  let a = Math.max(1, Math.round(Math.abs(Number(left) || 1)));
  let b = Math.max(1, Math.round(Math.abs(Number(right) || 1)));

  while (b) {
    const temp = a % b;
    a = b;
    b = temp;
  }

  return a || 1;
}

function deriveRatioLabel(width, height) {
  const normalizedWidth = Math.max(1, Math.round(Number(width) || 1));
  const normalizedHeight = Math.max(1, Math.round(Number(height) || 1));
  const ratioValue = normalizedWidth / normalizedHeight;

  for (const ratioEntry of COMMON_RATIOS) {
    if (Math.abs(ratioValue - ratioEntry.value) <= 0.03) {
      return ratioEntry.label;
    }
  }

  const divisor = gcd(normalizedWidth, normalizedHeight);
  const left = Math.max(1, Math.round(normalizedWidth / divisor));
  const right = Math.max(1, Math.round(normalizedHeight / divisor));

  return `${left}x${right}`;
}

async function ensureDirectory(directoryPath) {
  await fs.promises.mkdir(directoryPath, {
    recursive: true
  });
}

async function resolveUniqueFilePath(directoryPath, baseName, extension) {
  let fileName = `${baseName}${extension}`;
  let filePath = path.join(directoryPath, fileName);
  let counter = 2;

  while (true) {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      fileName = `${baseName}_${counter}${extension}`;
      filePath = path.join(directoryPath, fileName);
      counter += 1;
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return {
          fileName,
          filePath
        };
      }

      throw error;
    }
  }
}

function buildImageBaseName({
  mode,
  taskId,
  submitId,
  generateId,
  taskIndex,
  imageIndex,
  promptText,
  sourceName,
  width,
  height
}) {
  const promptLabel = sanitizeFileNameSegment(promptText, '');
  const sourceLabel = sanitizeFileNameSegment(sourceName, '');
  const taskIdLabel = shortenIdSegment(taskId, 18);
  const submitIdLabel = shortenIdSegment(submitId, 8);
  const generateIdLabel = shortenIdSegment(generateId, 8);
  const modeLabel = mode === 'image-to-image' ? 'img2img' : 'txt2img';
  const taskLabel = taskIdLabel
    ? `task_${taskIdLabel}`
    : submitIdLabel
      ? `submit_${submitIdLabel}`
      : generateIdLabel
        ? `gen_${generateIdLabel}`
        : String(taskIndex).padStart(3, '0');
  const detailLabel = (taskIdLabel || submitIdLabel || generateIdLabel)
    ? ''
    : (promptLabel || sourceLabel || 'image');
  const traceLabel = taskIdLabel
    ? (submitIdLabel ? `submit_${submitIdLabel}` : '')
    : submitIdLabel && generateIdLabel
      ? `gen_${generateIdLabel}`
      : '';

  return [
    modeLabel,
    taskLabel,
    traceLabel,
    detailLabel,
    String(imageIndex).padStart(2, '0'),
    `${Math.max(1, Math.round(Number(width) || 1))}x${Math.max(1, Math.round(Number(height) || 1))}`
  ].filter(Boolean).join('_');
}

function deriveExtension(contentType, imageUrl) {
  const normalizedContentType = String(contentType || '').toLowerCase();
  const normalizedUrl = String(imageUrl || '').toLowerCase();

  if (normalizedContentType.includes('png') || /\\.png(\\?|$)/i.test(normalizedUrl)) {
    return '.png';
  }

  if (normalizedContentType.includes('webp') || /\\.webp(\\?|$)/i.test(normalizedUrl)) {
    return '.webp';
  }

  if (normalizedContentType.includes('jpeg') || normalizedContentType.includes('jpg') || /\\.jpe?g(\\?|$)/i.test(normalizedUrl)) {
    return '.jpg';
  }

  if (normalizedContentType.includes('gif') || /\\.gif(\\?|$)/i.test(normalizedUrl)) {
    return '.gif';
  }

  return '.png';
}

async function saveDownloadedImage({
  buffer,
  rootDirectoryPath,
  mode,
  taskId,
  submitId,
  generateId,
  taskIndex,
  imageIndex,
  promptText,
  sourceName,
  width,
  height,
  imageUrl,
  contentType
}) {
  const binary = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);

  if (!binary || binary.length === 0) {
    throw new Error('empty-downloaded-image');
  }

  const decodedImage = nativeImage.createFromBuffer(binary);
  const decodedSize = decodedImage && typeof decodedImage.isEmpty === 'function' && decodedImage.isEmpty() !== true
    ? decodedImage.getSize()
    : { width: 0, height: 0 };
  const finalWidth = Math.max(1, Math.round(decodedSize.width || Number(width) || 1));
  const finalHeight = Math.max(1, Math.round(decodedSize.height || Number(height) || 1));
  const ratioLabel = deriveRatioLabel(finalWidth, finalHeight);
  const ratioDirectoryPath = path.join(rootDirectoryPath, ratioLabel);
  const baseName = buildImageBaseName({
    mode,
    taskId,
    submitId,
    generateId,
    taskIndex,
    imageIndex,
    promptText,
    sourceName,
    width: finalWidth,
    height: finalHeight
  });
  const extension = deriveExtension(contentType, imageUrl);

  await ensureDirectory(ratioDirectoryPath);

  const { fileName, filePath } = await resolveUniqueFilePath(ratioDirectoryPath, baseName, extension);
  await fs.promises.writeFile(filePath, binary);

  return {
    fileName,
    filePath,
    ratioLabel,
    width: finalWidth,
    height: finalHeight
  };
}

module.exports = {
  deriveRatioLabel,
  saveDownloadedImage,
  sanitizeFileNameSegment
};
