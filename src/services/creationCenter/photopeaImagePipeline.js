const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const {
  encodeSharpWithOptionalMetadata
} = require('./imageMetadataSource');
const {
  emitPhotopeaDebug
} = require('./photopeaRuntimeLogger');

const PHOTOPEA_TEMP_INPUT_PREFIX = 'pod-suite-photopea-input-';
const DIRECT_PHOTOPEA_INPUT_EXTENSIONS = new Set([
  '.png',
  '.webp'
]);
const JPEG_PHOTOPEA_INPUT_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg'
]);

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function resolvePhotopeaTempRootDir(tempRootDir) {
  const normalizedPath = normalizeText(tempRootDir);
  return normalizedPath ? path.resolve(normalizedPath) : os.tmpdir();
}

async function createPhotopeaTempDirectory(tempRootDir, prefix) {
  const rootDir = resolvePhotopeaTempRootDir(tempRootDir);
  await fs.promises.mkdir(rootDir, {
    recursive: true
  });

  return fs.promises.mkdtemp(path.join(rootDir, prefix));
}

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(format) ? format : 'png';
}

function normalizeImageQuality(value) {
  const quality = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, quality));
}

function getPhotopeaSourceExportFormat(outputFormat) {
  return normalizeOutputFormat(outputFormat) === 'jpg' ? 'jpg' : 'png';
}

async function convertExportBuffer(sourceBuffer, outputFormat, options = {}) {
  const normalizedFormat = normalizeOutputFormat(outputFormat);
  const sourceFormat = normalizeOutputFormat(options.sourceFormat || normalizedFormat);

  if (!normalizeText(options.metadataSourcePath)
    && sourceFormat === normalizedFormat
    && normalizedFormat === 'png') {
    return sourceBuffer;
  }

  return encodeSharpWithOptionalMetadata({
    createPipeline() {
      return sharp(sourceBuffer, {
        failOnError: false,
        limitInputPixels: false
      });
    },
    outputFormat: normalizedFormat,
    metadataSourcePath: options.metadataSourcePath,
    jpegQuality: normalizeImageQuality(options.imageQuality)
  });
}

function normalizeTargetImageSize(value) {
  const source = value && typeof value === 'object' ? value : {};
  const width = Math.max(0, Math.round(Number(source.width) || 0));
  const height = Math.max(0, Math.round(Number(source.height) || 0));

  return width > 0 && height > 0
    ? { width, height }
    : null;
}

function normalizeSourceRotation(value) {
  const mode = normalizeText(value);
  return ['left', 'right'].includes(mode) ? mode : 'none';
}

function getSourceRotationAngle(value) {
  const mode = normalizeSourceRotation(value);
  if (mode === 'left') {
    return -90;
  }
  if (mode === 'right') {
    return 90;
  }

  return 0;
}

async function preparePhotopeaInputImage(imagePath, runtimeLogger, options = {}) {
  const sourcePath = path.resolve(String(imagePath || ''));
  const targetSize = normalizeTargetImageSize(options.targetSize);
  const sourceRotation = normalizeSourceRotation(options.sourceRotation);
  const sourceRotationAngle = getSourceRotationAngle(sourceRotation);
  const sourceExtension = path.extname(sourcePath).toLowerCase();
  const hasSourceRotation = sourceRotationAngle !== 0;
  let canUseDirectInput = !targetSize && !hasSourceRotation && DIRECT_PHOTOPEA_INPUT_EXTENSIONS.has(sourceExtension);

  if (!targetSize && !hasSourceRotation && JPEG_PHOTOPEA_INPUT_EXTENSIONS.has(sourceExtension)) {
    const metadata = await sharp(sourcePath, {
      failOnError: false,
      limitInputPixels: false
    }).metadata().catch(() => null);
    canUseDirectInput = !metadata || !metadata.orientation || metadata.orientation === 1;
  }

  if (canUseDirectInput) {
    await emitPhotopeaDebug(runtimeLogger, 'input-image-direct', {
      sourcePath
    });

    return {
      filePath: sourcePath,
      targetSizeApplied: false,
      async cleanup() {}
    };
  }

  const tempDirectoryPath = await createPhotopeaTempDirectory(options.tempRootDir, PHOTOPEA_TEMP_INPUT_PREFIX);
  const tempFilePath = path.join(tempDirectoryPath, `source-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.png`);

  try {
    let imagePipeline = sharp(sourcePath, {
      failOnError: false,
      limitInputPixels: false
    })
      .rotate();

    if (hasSourceRotation) {
      imagePipeline = imagePipeline.rotate(sourceRotationAngle);
    }

    if (targetSize) {
      imagePipeline = imagePipeline.resize({
        width: targetSize.width,
        height: targetSize.height,
        fit: 'fill'
      });
    }

    await imagePipeline
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true
      })
      .toFile(tempFilePath);

    await emitPhotopeaDebug(runtimeLogger, 'input-image-prepared', {
      sourcePath,
      tempFilePath,
      targetSize,
      sourceRotation
    });

    return {
      filePath: tempFilePath,
      targetSizeApplied: Boolean(targetSize),
      async cleanup() {
        await fs.promises.rm(tempDirectoryPath, {
          recursive: true,
          force: true
        }).catch(() => {});
      }
    };
  } catch (error) {
    await fs.promises.rm(tempDirectoryPath, {
      recursive: true,
      force: true
    }).catch(() => {});
    await emitPhotopeaDebug(runtimeLogger, 'input-image-prepare-failed', {
      sourcePath,
      message: String(error && error.message || error || '')
    });

    return {
      filePath: sourcePath,
      targetSizeApplied: false,
      async cleanup() {}
    };
  }
}

module.exports = {
  convertExportBuffer,
  getPhotopeaSourceExportFormat,
  normalizeOutputFormat,
  normalizeSourceRotation,
  preparePhotopeaInputImage,
  resolvePhotopeaTempRootDir
};
