const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const {
  encodeSharpWithOptionalMetadata
} = require('./imageMetadataSource');

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function clampInteger(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(numericValue)));
}

function sanitizeFileNameSegment(value) {
  const text = normalizeText(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return text || 'slice';
}

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['png', 'jpg', 'webp'].includes(format) ? format : '';
}

function normalizeImageQuality(value) {
  const quality = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, quality));
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

function normalizeHorizontalGuides(guides, height) {
  if (!Array.isArray(guides)) {
    return [];
  }

  return guides
    .map((value) => clampInteger(value, 0, height))
    .filter((value) => value > 0 && value < height);
}

function dedupePositions(positions, height) {
  const seen = new Set();

  return positions
    .map((position) => clampInteger(position, 0, height))
    .filter((position) => position > 0 && position < height)
    .sort((left, right) => left - right)
    .filter((position) => {
      if (seen.has(position)) {
        return false;
      }

      seen.add(position);
      return true;
    });
}

function normalizeMarkedSliceBoxes(sliceBoxes, width, height) {
  if (!Array.isArray(sliceBoxes)) {
    return [];
  }

  const seen = new Set();

  return sliceBoxes
    .map((sliceBox) => {
      const left = clampInteger(sliceBox && sliceBox.left, 0, width);
      const top = clampInteger(sliceBox && sliceBox.top, 0, height);
      const right = clampInteger(sliceBox && sliceBox.right, 0, width);
      const bottom = clampInteger(sliceBox && sliceBox.bottom, 0, height);

      return {
        left,
        top,
        width: right - left,
        height: bottom - top
      };
    })
    .filter((sliceBox) => sliceBox.width > 0 && sliceBox.height > 0)
    .sort((left, right) => {
      if (left.top !== right.top) {
        return left.top - right.top;
      }

      return left.left - right.left;
    })
    .filter((sliceBox) => {
      const key = `${sliceBox.left},${sliceBox.top},${sliceBox.width},${sliceBox.height}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function buildGuideSliceBoxes(width, height, guideMetadata) {
  const positions = normalizeHorizontalGuides(guideMetadata && guideMetadata.horizontalGuides, height);
  const boundaries = [0, ...dedupePositions(positions, height), height];
  const boxes = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const top = boundaries[index];
    const bottom = boundaries[index + 1];
    const sliceHeight = bottom - top;
    if (sliceHeight <= 0) {
      continue;
    }

    boxes.push({
      index: index + 1,
      left: 0,
      top,
      width,
      height: sliceHeight
    });
  }

  return boxes;
}

function buildSliceBoxes({ width, height, options = {}, guideMetadata = {} }) {
  const mode = normalizeText(options.mode || options.sliceMode || 'guides');

  if (mode === 'original') {
    return [];
  }

  if (mode === 'slices') {
    return normalizeMarkedSliceBoxes(guideMetadata.sliceBoxes, width, height)
      .map((sliceBox, index) => ({
        index: index + 1,
        ...sliceBox
      }));
  }

  return buildGuideSliceBoxes(width, height, guideMetadata);
}

function buildSliceOutputPath(outputPath, slice, totalSlices, outputFormat) {
  const directoryPath = path.dirname(outputPath);
  const normalizedOutputFormat = normalizeOutputFormat(outputFormat);
  const extension = normalizedOutputFormat ? `.${normalizedOutputFormat}` : (path.extname(outputPath) || '.png');
  const baseName = sanitizeFileNameSegment(path.basename(outputPath, extension));
  const width = Math.max(2, String(totalSlices || 1).length);
  const indexText = String(slice.index).padStart(width, '0');

  return path.join(directoryPath, `${baseName}_${indexText}${extension}`);
}

function buildSliceOutputPaths({
  outputPath,
  width,
  height,
  options,
  guideMetadata,
  outputFormat
}) {
  const normalizedWidth = normalizePositiveInteger(width);
  const normalizedHeight = normalizePositiveInteger(height);
  if (!normalizeText(outputPath) || normalizedWidth <= 0 || normalizedHeight <= 0) {
    return [];
  }

  const boxes = buildSliceBoxes({
    width: normalizedWidth,
    height: normalizedHeight,
    options,
    guideMetadata
  });
  const normalizedOutputFormat = normalizeOutputFormat(outputFormat)
    || normalizeOutputFormat(path.extname(outputPath).slice(1))
    || 'png';

  return boxes.map((box) => buildSliceOutputPath(outputPath, box, boxes.length, normalizedOutputFormat));
}

async function hasCompleteSliceOutputs({
  outputPath,
  options,
  guideMetadata,
  outputFormat
}) {
  const expectedOutputPaths = buildSliceOutputPaths({
    outputPath,
    width: guideMetadata && guideMetadata.width,
    height: guideMetadata && guideMetadata.height,
    options,
    guideMetadata,
    outputFormat
  });

  if (!expectedOutputPaths.length) {
    return false;
  }

  const stats = await Promise.all(expectedOutputPaths.map((expectedOutputPath) => {
    return fs.promises.stat(expectedOutputPath).catch(() => null);
  }));

  return stats.every((stat) => stat && stat.isFile() && stat.size > 0);
}

function createInputPipeline(inputPath, inputBuffer) {
  const source = Buffer.isBuffer(inputBuffer) ? inputBuffer : inputPath;
  if (!source) {
    throw new Error('Invalid mockup image input.');
  }

  return sharp(source, {
    failOnError: false,
    limitInputPixels: false
  });
}

function createSliceInputPipelineFactory(inputPath, inputBuffer) {
  const basePipeline = createInputPipeline(inputPath, inputBuffer);

  return {
    basePipeline,
    createPipeline() {
      return basePipeline.clone();
    }
  };
}

async function runLimitedTasks(items, limit, worker) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedLimit = Math.max(1, Math.min(sourceItems.length || 1, clampInteger(limit, 1, 8)));
  const results = new Array(sourceItems.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < sourceItems.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await worker(sourceItems[itemIndex], itemIndex);
    }
  }

  await Promise.all(Array.from({
    length: normalizedLimit
  }, runWorker));

  return results;
}

async function writeImageSlices({
  inputPath,
  inputBuffer,
  outputPath,
  options,
  guideMetadata,
  outputFormat,
  imageQuality,
  metadataSourcePath,
  metadataSourcePathForSlice,
  concurrency
}) {
  const inputPipelineFactory = createSliceInputPipelineFactory(inputPath, inputBuffer);
  const metadata = await inputPipelineFactory.basePipeline.metadata();
  const width = Number(metadata.width);
  const height = Number(metadata.height);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Invalid mockup image size.');
  }

  const boxes = buildSliceBoxes({
    width: Math.round(width),
    height: Math.round(height),
    options,
    guideMetadata
  });

  if (!boxes.length) {
    return [];
  }

  const normalizedOutputFormat = normalizeOutputFormat(outputFormat)
    || normalizeOutputFormat(path.extname(outputPath).slice(1))
    || 'png';
  const outputs = await runLimitedTasks(boxes, concurrency || 1, async (box) => {
    const slicePath = buildSliceOutputPath(outputPath, box, boxes.length, normalizedOutputFormat);
    const sliceMetadataSourcePath = typeof metadataSourcePathForSlice === 'function'
      ? normalizeText(metadataSourcePathForSlice({
        slice: box,
        slicePath,
        totalSlices: boxes.length
      }))
      : metadataSourcePath;
    await fs.promises.mkdir(path.dirname(slicePath), {
      recursive: true
    });
    const outputBuffer = await encodeSharpWithOptionalMetadata({
      createPipeline() {
        return inputPipelineFactory.createPipeline()
          .extract({
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height
          });
      },
      outputFormat: normalizedOutputFormat,
      metadataSourcePath: sliceMetadataSourcePath,
      jpegQuality: normalizeImageQuality(imageQuality)
    });
    await fs.promises.writeFile(slicePath, outputBuffer);

    return {
      filePath: slicePath,
      sliceIndex: box.index,
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height
    };
  });

  return outputs;
}

module.exports = {
  buildSliceBoxes,
  buildSliceOutputPaths,
  hasCompleteSliceOutputs,
  writeImageSlices
};
