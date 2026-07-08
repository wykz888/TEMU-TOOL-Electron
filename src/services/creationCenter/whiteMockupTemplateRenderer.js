const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const {
  MASK_SHAPE_REGION_TYPE,
  createMaskShapeRegionFromMask,
  forEachMaskShapePixel,
  isMaskShapeRegion,
  normalizeMaskShape
} = require('./whiteMockupMaskShapeRegion');

const DEFAULT_JPEG_QUALITY = 92;

const TABLECLOTH_FLAT_TEMPLATE = Object.freeze({
  id: 'tablecloth-flat-main',
  title: '\u684c\u5e03\u591a\u533a\u57df',
  maskImagePath: '',
  textureImagePath: '',
  regions: Object.freeze([
    Object.freeze({
      name: '\u684c\u9762',
      points: Object.freeze([
        Object.freeze([31, 264]),
        Object.freeze([404, 166]),
        Object.freeze([898, 465]),
        Object.freeze([492, 644])
      ]),
      strength: 0.84,
      feather: 15,
      bleed: 0
    }),
    Object.freeze({
      name: '\u524d\u4fa7\u5782\u8fb9',
      points: Object.freeze([
        Object.freeze([492, 644]),
        Object.freeze([898, 465]),
        Object.freeze([934, 617]),
        Object.freeze([533, 839])
      ]),
      strength: 0.78,
      feather: 18,
      bleed: 0
    }),
    Object.freeze({
      name: '\u5de6\u4fa7\u5782\u8fb9',
      points: Object.freeze([
        Object.freeze([0, 252]),
        Object.freeze([31, 264]),
        Object.freeze([492, 644]),
        Object.freeze([0, 506])
      ]),
      strength: 0.72,
      feather: 18,
      bleed: 0
    }),
    Object.freeze({
      name: '\u5de6\u524d\u89d2',
      points: Object.freeze([
        Object.freeze([0, 506]),
        Object.freeze([492, 644]),
        Object.freeze([533, 839]),
        Object.freeze([420, 933])
      ]),
      strength: 0.68,
      feather: 20,
      bleed: 0
    })
  ])
});

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeTemplateRegion(region, fallbackRegion, index = 0) {
  const source = region && typeof region === 'object' ? region : fallbackRegion;
  const fallback = fallbackRegion && typeof fallbackRegion === 'object' ? fallbackRegion : TABLECLOTH_FLAT_TEMPLATE.regions[0];
  const points = (Array.isArray(source && source.points) ? source.points : fallback.points)
    .map((point, index) => {
      const fallbackPoint = fallback.points[index] || [0, 0];
      const x = Number(Array.isArray(point) ? point[0] : point && point.x);
      const y = Number(Array.isArray(point) ? point[1] : point && point.y);

      return [
        Number.isFinite(x) ? Math.round(x) : fallbackPoint[0],
        Number.isFinite(y) ? Math.round(y) : fallbackPoint[1]
      ];
    })
    .slice(0, 4);

  while (points.length < 4) {
    points.push(TABLECLOTH_FLAT_TEMPLATE.regions[0].points[points.length].slice());
  }

  const normalizedRegion = {
    name: normalizeText(source && source.name) || fallback.name || `region-${index + 1}`,
    points,
    strength: Number.isFinite(Number(source && source.strength))
      ? clamp(Number(source.strength), 0.05, 1)
      : fallback.strength,
    feather: Number.isFinite(Number(source && source.feather))
      ? clamp(Math.round(Number(source.feather)), 0, 80)
      : fallback.feather,
    bleed: 0
  };

  if (isMaskShapeRegion(source)) {
    normalizedRegion.type = MASK_SHAPE_REGION_TYPE;
    normalizedRegion.shape = normalizeMaskShape(source.shape);
    normalizedRegion.shape.mappingBounds = createMappingBoundsFromRegionPoints(
      normalizedRegion.points,
      normalizedRegion.shape.mappingBounds
    );
    normalizedRegion.feather = 0;
  }

  return normalizedRegion;
}

function createMappingBoundsFromRegionPoints(points, fallbackBounds) {
  if (!Array.isArray(points) || points.length < 4) {
    return fallbackBounds;
  }

  const xValues = points.map((point) => Math.round(Number(point && point[0]) || 0));
  const yValues = points.map((point) => Math.round(Number(point && point[1]) || 0));
  const left = Math.min(...xValues);
  const top = Math.min(...yValues);
  const right = Math.max(...xValues);
  const bottom = Math.max(...yValues);

  return {
    ...(fallbackBounds && typeof fallbackBounds === 'object' ? fallbackBounds : {}),
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
    points
  };
}

function normalizeTextureImagePath(value) {
  return normalizeText(value);
}

function normalizeMaskImagePath(value) {
  return normalizeText(value);
}

function normalizeWhiteMockupTemplate(template) {
  const source = template && typeof template === 'object' ? template : TABLECLOTH_FLAT_TEMPLATE;
  const fallbackRegions = TABLECLOTH_FLAT_TEMPLATE.regions;
  const sourceRegions = Array.isArray(source.regions) && source.regions.length
    ? source.regions
    : fallbackRegions;
  const regions = sourceRegions
    .map((region, index) => normalizeTemplateRegion(
      region,
      fallbackRegions[index] || fallbackRegions[0],
      index
    ));

  if (!regions.length) {
    regions.push(normalizeTemplateRegion(fallbackRegions[0], fallbackRegions[0], 0));
  }

  return {
    id: normalizeText(source.id) || TABLECLOTH_FLAT_TEMPLATE.id,
    title: normalizeText(source.title) || TABLECLOTH_FLAT_TEMPLATE.title,
    key: normalizeText(source.key),
    mockupPath: normalizeText(source.mockupPath),
    maskImagePath: normalizeMaskImagePath(source.maskImagePath),
    textureImagePath: normalizeTextureImagePath(source.textureImagePath),
    createdAt: normalizeText(source.createdAt),
    updatedAt: normalizeText(source.updatedAt),
    regions
  };
}

function normalizeAutoRegionPadding(value) {
  const padding = Number(value);

  if (!Number.isFinite(padding)) {
    return 0;
  }

  return clamp(padding, 0, 0.5);
}

function normalizeAbsolutePath(value) {
  const text = normalizeText(value);
  return text ? path.resolve(text) : '';
}

function getIsoTimestamp() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeFileNameSegment(value, fallback = 'output') {
  const text = normalizeText(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[()\uFF08\uFF09]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return text || fallback;
}

async function assertFile(filePath, message) {
  const stat = await fs.promises.stat(filePath).catch(() => null);

  if (!stat || !stat.isFile()) {
    throw new Error(message);
  }
}

async function assertDirectory(directoryPath, message) {
  const stat = await fs.promises.stat(directoryPath).catch(() => null);

  if (!stat || !stat.isDirectory()) {
    throw new Error(message);
  }
}

function normalizeRegionPoints(region) {
  return (Array.isArray(region && region.points) ? region.points : [])
    .map((point) => ({
      x: Number(Array.isArray(point) ? point[0] : point && point.x),
      y: Number(Array.isArray(point) ? point[1] : point && point.y)
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => row.concat(values[index]));

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(rows[column][column]);

    for (let row = column + 1; row < size; row += 1) {
      const value = Math.abs(rows[row][column]);
      if (value > pivotValue) {
        pivotValue = value;
        pivotRow = row;
      }
    }

    if (pivotValue < 1e-9) {
      return null;
    }

    if (pivotRow !== column) {
      const nextRow = rows[column];
      rows[column] = rows[pivotRow];
      rows[pivotRow] = nextRow;
    }

    const pivot = rows[column][column];
    for (let cell = column; cell <= size; cell += 1) {
      rows[column][cell] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }

      const factor = rows[row][column];
      if (!factor) {
        continue;
      }

      for (let cell = column; cell <= size; cell += 1) {
        rows[row][cell] -= factor * rows[column][cell];
      }
    }
  }

  return rows.map((row) => row[size]);
}

function createPerspectiveCoefficients(sourcePoints, targetPoints) {
  const matrix = [];
  const values = [];

  for (let index = 0; index < 4; index += 1) {
    const source = sourcePoints[index];
    const target = targetPoints[index];
    const sourceX = source.x;
    const sourceY = source.y;
    const targetX = target.x;
    const targetY = target.y;

    matrix.push([
      sourceX,
      sourceY,
      1,
      0,
      0,
      0,
      -targetX * sourceX,
      -targetX * sourceY
    ]);
    values.push(targetX);
    matrix.push([
      0,
      0,
      0,
      sourceX,
      sourceY,
      1,
      -targetY * sourceX,
      -targetY * sourceY
    ]);
    values.push(targetY);
  }

  const coefficients = solveLinearSystem(matrix, values);

  if (!coefficients) {
    return null;
  }

  return coefficients.concat(1);
}

function transformPerspectivePoint(coefficients, x, y) {
  const denominator = (coefficients[6] * x) + (coefficients[7] * y) + coefficients[8];

  if (Math.abs(denominator) < 1e-9) {
    return null;
  }

  return {
    x: ((coefficients[0] * x) + (coefficients[1] * y) + coefficients[2]) / denominator,
    y: ((coefficients[3] * x) + (coefficients[4] * y) + coefficients[5]) / denominator
  };
}

function createQuadToUnitTransform(points) {
  return createPerspectiveCoefficients(points, [
    {
      x: 0,
      y: 0
    },
    {
      x: 1,
      y: 0
    },
    {
      x: 1,
      y: 1
    },
    {
      x: 0,
      y: 1
    }
  ]);
}

function getBounds(points, width, height) {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const left = clamp(Math.floor(Math.min(...xValues)), 0, width - 1);
  const top = clamp(Math.floor(Math.min(...yValues)), 0, height - 1);
  const right = clamp(Math.ceil(Math.max(...xValues)), left + 1, width);
  const bottom = clamp(Math.ceil(Math.max(...yValues)), top + 1, height);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function pointLineDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);

  if (!lengthSquared) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp((((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared, 0, 1);
  const projectedX = start.x + (t * dx);
  const projectedY = start.y + (t * dy);

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function getFeatherAlpha(points, x, y, feather) {
  if (!feather) {
    return 1;
  }

  const point = {
    x,
    y
  };
  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      pointLineDistance(point, points[index], points[(index + 1) % points.length])
    );
  }

  return clamp(minDistance / feather, 0, 1);
}

function samplePixel(image, u, v) {
  const x = clamp(u * (image.width - 1), 0, image.width - 1);
  const y = clamp(v * (image.height - 1), 0, image.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const weightX = x - x0;
  const weightY = y - y0;
  const offsets = [
    (y0 * image.width + x0) * 4,
    (y0 * image.width + x1) * 4,
    (y1 * image.width + x0) * 4,
    (y1 * image.width + x1) * 4
  ];
  const result = [0, 0, 0, 0];

  for (let channel = 0; channel < 4; channel += 1) {
    const top =
      (image.data[offsets[0] + channel] * (1 - weightX))
      + (image.data[offsets[1] + channel] * weightX);
    const bottom =
      (image.data[offsets[2] + channel] * (1 - weightX))
      + (image.data[offsets[3] + channel] * weightX);
    result[channel] = (top * (1 - weightY)) + (bottom * weightY);
  }

  return result;
}

function blendPrintedPixel(base, source, strength) {
  const luminance = ((base[0] * 0.2126) + (base[1] * 0.7152) + (base[2] * 0.0722)) / 255;
  const shade = clamp((luminance - 0.04) / 0.94, 0.42, 1.08);
  const highlight = clamp((luminance - 0.88) / 0.12, 0, 1);
  const alpha = clamp((source[3] / 255) * strength, 0, 1);
  const printed = [
    clamp((source[0] * shade) + (255 * highlight * 0.15), 0, 255),
    clamp((source[1] * shade) + (255 * highlight * 0.15), 0, 255),
    clamp((source[2] * shade) + (255 * highlight * 0.15), 0, 255)
  ];

  return [
    Math.round((printed[0] * alpha) + (base[0] * (1 - alpha))),
    Math.round((printed[1] * alpha) + (base[1] * (1 - alpha))),
    Math.round((printed[2] * alpha) + (base[2] * (1 - alpha))),
    base[3]
  ];
}

function blendOverlayPixel(base, overlay) {
  const sourceAlpha = clamp(overlay[3] / 255, 0, 1);
  const baseAlpha = clamp(base[3] / 255, 0, 1);
  const outputAlpha = sourceAlpha + (baseAlpha * (1 - sourceAlpha));

  if (sourceAlpha <= 0 || outputAlpha <= 0) {
    return base;
  }

  return [
    Math.round(((overlay[0] * sourceAlpha) + (base[0] * baseAlpha * (1 - sourceAlpha))) / outputAlpha),
    Math.round(((overlay[1] * sourceAlpha) + (base[1] * baseAlpha * (1 - sourceAlpha))) / outputAlpha),
    Math.round(((overlay[2] * sourceAlpha) + (base[2] * baseAlpha * (1 - sourceAlpha))) / outputAlpha),
    Math.round(outputAlpha * 255)
  ];
}

function drawTextureOverlay(canvas, texture) {
  for (let y = 0; y < texture.height; y += 1) {
    for (let x = 0; x < texture.width; x += 1) {
      const offset = (y * texture.width + x) * 4;
      const basePixel = [
        canvas[offset],
        canvas[offset + 1],
        canvas[offset + 2],
        canvas[offset + 3]
      ];
      const overlayPixel = [
        texture.data[offset],
        texture.data[offset + 1],
        texture.data[offset + 2],
        texture.data[offset + 3]
      ];
      const nextPixel = blendOverlayPixel(basePixel, overlayPixel);

      canvas[offset] = nextPixel[0];
      canvas[offset + 1] = nextPixel[1];
      canvas[offset + 2] = nextPixel[2];
      canvas[offset + 3] = nextPixel[3];
    }
  }
}

function drawRegion(canvas, base, design, region) {
  const points = normalizeRegionPoints(region);

  if (points.length < 4) {
    return;
  }

  const quadPoints = points.slice(0, 4);
  const transform = createQuadToUnitTransform(quadPoints);

  if (!transform) {
    return;
  }

  const bounds = getBounds(quadPoints, base.width, base.height);
  const feather = Number(region.feather) || 0;
  const strength = Number(region.strength) || 0.9;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const uv = transformPerspectivePoint(transform, x + 0.5, y + 0.5);

      if (!uv || uv.x < -0.001 || uv.x > 1.001 || uv.y < -0.001 || uv.y > 1.001) {
        continue;
      }

      const edgeAlpha = getFeatherAlpha(quadPoints, x + 0.5, y + 0.5, feather);
      if (edgeAlpha <= 0) {
        continue;
      }

      const offset = (y * base.width + x) * 4;
      const basePixel = [
        canvas[offset],
        canvas[offset + 1],
        canvas[offset + 2],
        canvas[offset + 3]
      ];
      const sourcePixel = samplePixel(
        design,
        clamp(uv.x, 0, 1),
        clamp(uv.y, 0, 1)
      );
      const nextPixel = blendPrintedPixel(basePixel, sourcePixel, strength * edgeAlpha);

      canvas[offset] = nextPixel[0];
      canvas[offset + 1] = nextPixel[1];
      canvas[offset + 2] = nextPixel[2];
      canvas[offset + 3] = nextPixel[3];
    }
  }
}

function createTransparentCanvas(width, height) {
  return Buffer.alloc(width * height * 4);
}

function replacePixelWithPrintedPixel(canvas, base, offset, sourcePixel, strength) {
  const basePixel = [
    base.data[offset],
    base.data[offset + 1],
    base.data[offset + 2],
    base.data[offset + 3]
  ];
  const nextPixel = blendPrintedPixel(basePixel, sourcePixel, strength);

  canvas[offset] = nextPixel[0];
  canvas[offset + 1] = nextPixel[1];
  canvas[offset + 2] = nextPixel[2];
  canvas[offset + 3] = nextPixel[3];
}

function drawRegionToLayer(layer, base, design, region) {
  const points = normalizeRegionPoints(region);

  if (points.length < 4) {
    return;
  }

  const quadPoints = points.slice(0, 4);
  const transform = createQuadToUnitTransform(quadPoints);

  if (!transform) {
    return;
  }

  const bounds = getBounds(quadPoints, base.width, base.height);
  const feather = Number(region.feather) || 0;
  const strength = Number(region.strength) || 0.9;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const uv = transformPerspectivePoint(transform, x + 0.5, y + 0.5);

      if (!uv || uv.x < -0.001 || uv.x > 1.001 || uv.y < -0.001 || uv.y > 1.001) {
        continue;
      }

      const edgeAlpha = getFeatherAlpha(quadPoints, x + 0.5, y + 0.5, feather);
      if (edgeAlpha <= 0) {
        continue;
      }

      const offset = (y * base.width + x) * 4;
      const sourcePixel = samplePixel(
        design,
        clamp(uv.x, 0, 1),
        clamp(uv.y, 0, 1)
      );
      replacePixelWithPrintedPixel(layer, base, offset, sourcePixel, strength * edgeAlpha);
    }
  }
}

function drawMaskShapeRegionToCanvas(canvas, base, design, region, mask) {
  const strength = Number(region.strength) || 0.9;

  forEachMaskShapePixel(mask, region, ({ x, y, u, v }) => {
    const offset = (y * base.width + x) * 4;
    const maskAlpha = getMaskAlpha(mask, offset);
    if (maskAlpha <= 0) {
      return;
    }

    const basePixel = [
      canvas[offset],
      canvas[offset + 1],
      canvas[offset + 2],
      canvas[offset + 3]
    ];
    const sourcePixel = samplePixel(
      design,
      clamp(u, 0, 1),
      clamp(v, 0, 1)
    );
    const nextPixel = blendPrintedPixel(basePixel, sourcePixel, strength * maskAlpha);

    canvas[offset] = nextPixel[0];
    canvas[offset + 1] = nextPixel[1];
    canvas[offset + 2] = nextPixel[2];
    canvas[offset + 3] = nextPixel[3];
  });
}

function getMaskAlpha(mask, offset) {
  const alpha = clamp(mask.data[offset + 3] / 255, 0, 1);

  if (alpha < 1) {
    return alpha;
  }

  return clamp(
    ((mask.data[offset] * 0.2126) + (mask.data[offset + 1] * 0.7152) + (mask.data[offset + 2] * 0.0722)) / 255,
    0,
    1
  );
}

function compositeMaskedLayer(canvas, layer, mask) {
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const offset = (y * mask.width + x) * 4;
      const maskAlpha = getMaskAlpha(mask, offset);
      const layerAlpha = clamp(layer[offset + 3] / 255, 0, 1);
      const alpha = maskAlpha * layerAlpha;

      if (alpha <= 0) {
        continue;
      }

      canvas[offset] = Math.round((layer[offset] * alpha) + (canvas[offset] * (1 - alpha)));
      canvas[offset + 1] = Math.round((layer[offset + 1] * alpha) + (canvas[offset + 1] * (1 - alpha)));
      canvas[offset + 2] = Math.round((layer[offset + 2] * alpha) + (canvas[offset + 2] * (1 - alpha)));
      canvas[offset + 3] = Math.max(canvas[offset + 3], Math.round(alpha * 255));
    }
  }
}

async function readRawImage(filePath, resize) {
  let pipeline = sharp(filePath, {
    failOnError: false,
    animated: false
  }).rotate();

  if (resize) {
    pipeline = pipeline.resize(resize);
  }

  const result = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true
    });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height
  };
}

function createMaskAlphaBounds(mask, alphaThreshold) {
  let left = mask.width;
  let top = mask.height;
  let right = -1;
  let bottom = -1;
  let count = 0;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const offset = (y * mask.width + x) * 4;
      const alpha = mask.data[offset + 3];

      if (alpha <= alphaThreshold) {
        continue;
      }

      count += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (!count) {
    return null;
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    count
  };
}

function isMaskAlphaVisible(mask, x, y, alphaThreshold) {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) {
    return false;
  }

  return mask.data[(y * mask.width + x) * 4 + 3] > alphaThreshold;
}

function createMaskTransparentEdgePoints(mask, alphaThreshold) {
  const points = [];

  for (let y = 1; y < mask.height - 1; y += 1) {
    for (let x = 1; x < mask.width - 1; x += 1) {
      if (!isMaskAlphaVisible(mask, x, y, alphaThreshold)) {
        continue;
      }

      let touchesTransparent = false;

      for (let offsetY = -1; offsetY <= 1 && !touchesTransparent; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) {
            continue;
          }

          if (!isMaskAlphaVisible(mask, x + offsetX, y + offsetY, alphaThreshold)) {
            touchesTransparent = true;
            break;
          }
        }
      }

      if (touchesTransparent) {
        points.push({
          x,
          y
        });
      }
    }
  }

  return points;
}

function createPointBounds(points) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  points.forEach((point) => {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  });

  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    count: points.length
  };
}

function crossPoints(origin, pointA, pointB) {
  return ((pointA.x - origin.x) * (pointB.y - origin.y))
    - ((pointA.y - origin.y) * (pointB.x - origin.x));
}

function createConvexHull(points) {
  if (points.length <= 3) {
    return points.slice();
  }

  const sortedPoints = points
    .slice()
    .sort((pointA, pointB) => (pointA.x - pointB.x) || (pointA.y - pointB.y));
  const lower = [];

  sortedPoints.forEach((point) => {
    while (lower.length >= 2 && crossPoints(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }

    lower.push(point);
  });

  const upper = [];

  for (let index = sortedPoints.length - 1; index >= 0; index -= 1) {
    const point = sortedPoints[index];

    while (upper.length >= 2 && crossPoints(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }

    upper.push(point);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function rotatePoint(point, cos, sin) {
  return {
    x: (point.x * cos) - (point.y * sin),
    y: (point.x * sin) + (point.y * cos)
  };
}

function createMinimumAreaRect(points) {
  const hull = createConvexHull(points);

  if (hull.length < 3) {
    return null;
  }

  let bestRect = null;

  for (let index = 0; index < hull.length; index += 1) {
    const pointA = hull[index];
    const pointB = hull[(index + 1) % hull.length];
    const angle = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    hull.forEach((point) => {
      const rotated = rotatePoint(point, cos, sin);

      minX = Math.min(minX, rotated.x);
      minY = Math.min(minY, rotated.y);
      maxX = Math.max(maxX, rotated.x);
      maxY = Math.max(maxY, rotated.y);
    });

    const area = (maxX - minX) * (maxY - minY);

    if (!bestRect || area < bestRect.area) {
      bestRect = {
        area,
        angle,
        minX,
        minY,
        maxX,
        maxY
      };
    }
  }

  if (!bestRect) {
    return null;
  }

  const cos = Math.cos(bestRect.angle);
  const sin = Math.sin(bestRect.angle);
  const toImagePoint = (x, y) => {
    const point = rotatePoint({
      x,
      y
    }, cos, sin);

    return {
      x: Math.round(point.x),
      y: Math.round(point.y)
    };
  };

  return [
    toImagePoint(bestRect.minX, bestRect.minY),
    toImagePoint(bestRect.maxX, bestRect.minY),
    toImagePoint(bestRect.maxX, bestRect.maxY),
    toImagePoint(bestRect.minX, bestRect.maxY)
  ];
}

function orderQuadPoints(points) {
  const byTopLeft = points.reduce((best, point) => ((point.x + point.y) < (best.x + best.y) ? point : best), points[0]);
  const byTopRight = points.reduce((best, point) => ((point.x - point.y) > (best.x - best.y) ? point : best), points[0]);
  const byBottomRight = points.reduce((best, point) => ((point.x + point.y) > (best.x + best.y) ? point : best), points[0]);
  const byBottomLeft = points.reduce((best, point) => ((point.x - point.y) < (best.x - best.y) ? point : best), points[0]);
  const ordered = [byTopLeft, byTopRight, byBottomRight, byBottomLeft];
  const uniqueKeys = new Set(ordered.map((point) => `${point.x},${point.y}`));

  if (uniqueKeys.size === 4) {
    return ordered;
  }

  const center = points.reduce((total, point) => ({
    x: total.x + point.x,
    y: total.y + point.y
  }), {
    x: 0,
    y: 0
  });
  center.x /= points.length;
  center.y /= points.length;

  const sorted = points
    .slice()
    .sort((pointA, pointB) => (
      Math.atan2(pointA.y - center.y, pointA.x - center.x)
      - Math.atan2(pointB.y - center.y, pointB.x - center.x)
    ));
  let startIndex = 0;
  let bestScore = Infinity;

  sorted.forEach((point, index) => {
    const score = point.x + point.y;

    if (score < bestScore) {
      startIndex = index;
      bestScore = score;
    }
  });

  return sorted.slice(startIndex).concat(sorted.slice(0, startIndex));
}

function applyRegionPadding(points, padding) {
  if (!padding) {
    return points;
  }

  const bounds = createPointBounds(points);
  const inset = Math.max(bounds.width, bounds.height) * padding;
  const center = points.reduce((total, point) => ({
    x: total.x + point.x,
    y: total.y + point.y
  }), {
    x: 0,
    y: 0
  });
  center.x /= points.length;
  center.y /= points.length;

  return points.map((point) => {
    const offsetX = point.x - center.x;
    const offsetY = point.y - center.y;
    const distance = Math.hypot(offsetX, offsetY);

    if (!distance) {
      return point;
    }

    const scale = (distance + inset) / distance;

    return {
      x: Math.round(center.x + (offsetX * scale)),
      y: Math.round(center.y + (offsetY * scale))
    };
  });
}

function clampRegionPoints(points, width, height) {
  return points.map((point) => [
    clamp(Math.round(point.x), -width * 0.5, width * 1.5),
    clamp(Math.round(point.y), -height * 0.5, height * 1.5)
  ]);
}

function createMaskTransparentEdgeRegion(mask, padding) {
  const edgePoints = createMaskTransparentEdgePoints(mask, 8);

  if (edgePoints.length < 4) {
    return null;
  }

  const rectPoints = createMinimumAreaRect(edgePoints);

  if (!rectPoints) {
    return null;
  }

  return {
    source: 'transparent-edge',
    bounds: createPointBounds(edgePoints),
    points: clampRegionPoints(
      applyRegionPadding(orderQuadPoints(rectPoints), padding),
      mask.width,
      mask.height
    )
  };
}

function createMaskBoundsRegion(mask, bounds, padding) {
  const inset = Math.max(bounds.width, bounds.height) * padding;
  const left = clamp(Math.round(bounds.left - inset), -mask.width * 0.5, mask.width * 1.5);
  const top = clamp(Math.round(bounds.top - inset), -mask.height * 0.5, mask.height * 1.5);
  const right = clamp(Math.round(bounds.right + inset), -mask.width * 0.5, mask.width * 1.5);
  const bottom = clamp(Math.round(bounds.bottom + inset), -mask.height * 0.5, mask.height * 1.5);

  return {
    source: 'alpha-bounds',
    bounds,
    points: [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom]
    ]
  };
}

async function createWhiteMockupRegionFromMask(payload = {}) {
  const mockupPath = normalizeAbsolutePath(payload.mockupPath);
  const maskImagePath = normalizeAbsolutePath(payload.maskImagePath);
  const padding = normalizeAutoRegionPadding(payload.padding);

  await assertFile(mockupPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u767d\u819c\u56fe\u7247\u3002');
  await assertFile(maskImagePath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u5370\u82b1\u8499\u7248\u56fe\u3002');

  const base = await readRawImage(mockupPath);
  const mask = await readRawImage(maskImagePath, {
    width: base.width,
    height: base.height,
    fit: 'fill',
    kernel: sharp.kernel.lanczos3
  });
  const bounds = createMaskAlphaBounds(mask, 8);

  if (!bounds) {
    throw new Error('\u5370\u82b1\u8499\u7248\u56fe\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u89c1\u533a\u57df\u3002');
  }

  const shapeRegion = createMaskShapeRegionFromMask(mask, {
    padding,
    name: '\u8499\u7248\u5f62\u72b6\u533a\u57df',
    strength: 0.96
  });
  const edgeRegion = shapeRegion ? null : createMaskTransparentEdgeRegion(mask, padding);
  const resolvedRegion = shapeRegion || edgeRegion || createMaskBoundsRegion(mask, bounds, padding);
  const region = normalizeTemplateRegion(resolvedRegion, TABLECLOTH_FLAT_TEMPLATE.regions[0], 0);

  return {
    success: true,
    updatedAt: getIsoTimestamp(),
    region,
    bounds: resolvedRegion.bounds || (resolvedRegion.shape && resolvedRegion.shape.bounds) || bounds,
    source: resolvedRegion.type === MASK_SHAPE_REGION_TYPE ? 'mask-shape' : resolvedRegion.source,
    imageSize: {
      width: base.width,
      height: base.height
    }
  };
}

async function encodeImage(image, outputFormat, jpegQuality) {
  let pipeline = sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4
    }
  });

  if (outputFormat === 'png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
      adaptiveFiltering: true
    });
  } else {
    pipeline = pipeline
      .flatten({
        background: '#ffffff'
      })
      .jpeg({
        quality: jpegQuality,
        mozjpeg: true
      });
  }

  return pipeline.toBuffer();
}

async function writeImage(filePath, image, outputFormat, jpegQuality) {
  await fs.promises.mkdir(path.dirname(filePath), {
    recursive: true
  });
  const buffer = await encodeImage(image, outputFormat, jpegQuality);
  await fs.promises.writeFile(filePath, buffer);
}

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return format === 'png' ? 'png' : 'jpg';
}

function normalizeJpegQuality(value) {
  const quality = Number(value);

  if (!Number.isFinite(quality)) {
    return DEFAULT_JPEG_QUALITY;
  }

  return Math.max(60, Math.min(100, Math.round(quality)));
}

async function renderWhiteMockupImage({
  mockupPath,
  designPath,
  template = TABLECLOTH_FLAT_TEMPLATE,
  outputFormat = 'jpg',
  jpegQuality = DEFAULT_JPEG_QUALITY
}) {
  const resolvedTemplate = normalizeWhiteMockupTemplate(template);
  const base = await readRawImage(mockupPath);
  const maskImagePath = normalizeAbsolutePath(resolvedTemplate.maskImagePath);
  const design = await readRawImage(designPath, {
    width: 1800,
    height: 1400,
    fit: 'cover',
    position: 'center',
    kernel: sharp.kernel.lanczos3
  });
  const canvas = Buffer.from(base.data);
  const regions = Array.isArray(resolvedTemplate && resolvedTemplate.regions)
    ? resolvedTemplate.regions
    : [];

  if (maskImagePath) {
    const mask = await readRawImage(maskImagePath, {
      width: base.width,
      height: base.height,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    });
    const layer = createTransparentCanvas(base.width, base.height);
    regions.forEach((region) => {
      if (isMaskShapeRegion(region)) {
        drawMaskShapeRegionToCanvas(canvas, base, design, region, mask);
      } else {
        drawRegionToLayer(layer, base, design, region);
      }
    });
    compositeMaskedLayer(canvas, layer, mask);
  } else {
    regions.forEach((region) => {
      drawRegion(canvas, base, design, region);
    });
  }

  const textureImagePath = normalizeAbsolutePath(resolvedTemplate.textureImagePath);
  if (textureImagePath) {
    const texture = await readRawImage(textureImagePath, {
      width: base.width,
      height: base.height,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    });
    drawTextureOverlay(canvas, texture);
  }

  return {
    data: canvas,
    width: base.width,
    height: base.height,
    outputFormat,
    jpegQuality
  };
}

async function renderWhiteMockupPreview(payload = {}) {
  const mockupPath = normalizeAbsolutePath(payload.mockupPath);
  const designPath = normalizeAbsolutePath(payload.designPath);
  const template = normalizeWhiteMockupTemplate(payload.template);
  const maskImagePath = normalizeAbsolutePath(template.maskImagePath);
  const textureImagePath = normalizeAbsolutePath(template.textureImagePath);

  await assertFile(mockupPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u767d\u819c\u56fe\u7247\u3002');
  await assertFile(designPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u9884\u89c8\u7d20\u6750\u56fe\u3002');
  if (maskImagePath) {
    await assertFile(maskImagePath, '\u5370\u82b1\u8499\u7248\u56fe\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
  }
  if (textureImagePath) {
    await assertFile(textureImagePath, '\u7eb9\u7406/\u906e\u6321\u56fe\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
  }

  const image = await renderWhiteMockupImage({
    mockupPath,
    designPath,
    template,
    outputFormat: 'png',
    jpegQuality: DEFAULT_JPEG_QUALITY
  });
  const buffer = await encodeImage(image, 'png', DEFAULT_JPEG_QUALITY);

  return {
    success: true,
    updatedAt: getIsoTimestamp(),
    mockupPath,
    designPath,
    width: image.width,
    height: image.height,
    dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
  };
}

function buildOutputPath({ outputDirectoryPath, sourceFile, outputFormat }) {
  const sourceDirectory = path.dirname(sourceFile.relativePath || '');
  const sourceBaseName = sanitizeFileNameSegment(
    path.basename(sourceFile.fileName || sourceFile.relativePath || 'image', path.extname(sourceFile.fileName || ''))
  );
  const extension = outputFormat === 'png' ? '.png' : '.jpg';
  const relativeOutputDirectory = sourceDirectory && sourceDirectory !== '.'
    ? path.join(outputDirectoryPath, sourceDirectory)
    : outputDirectoryPath;

  return path.join(relativeOutputDirectory, `${sourceBaseName}${extension}`);
}

async function generateWhiteMockupImages(payload = {}, collectImageFiles) {
  const mockupPath = normalizeAbsolutePath(payload.mockupPath);
  const imageDirectoryPath = normalizeAbsolutePath(payload.imageDirectoryPath);
  const outputDirectoryPath = normalizeAbsolutePath(payload.outputDirectoryPath);
  const outputFormat = normalizeOutputFormat(payload.outputFormat);
  const jpegQuality = normalizeJpegQuality(payload.jpegQuality);
  const template = normalizeWhiteMockupTemplate(payload.template);
  const maskImagePath = normalizeAbsolutePath(template.maskImagePath);
  const textureImagePath = normalizeAbsolutePath(template.textureImagePath);

  await assertFile(mockupPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u767d\u819c\u56fe\u7247\u3002');
  if (maskImagePath) {
    await assertFile(maskImagePath, '\u5370\u82b1\u8499\u7248\u56fe\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
  }
  if (textureImagePath) {
    await assertFile(textureImagePath, '\u7eb9\u7406/\u906e\u6321\u56fe\u4e0d\u5b58\u5728\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002');
  }
  await assertDirectory(imageDirectoryPath, '\u8bf7\u5148\u9009\u62e9\u6709\u6548\u7684\u7d20\u6750\u56fe\u7247\u6587\u4ef6\u5939\u3002');
  await fs.promises.mkdir(outputDirectoryPath, {
    recursive: true
  });

  if (typeof collectImageFiles !== 'function') {
    throw new Error('\u5957\u56fe\u5de5\u5177\u56fe\u7247\u6536\u96c6\u5668\u672a\u5c31\u7eea\u3002');
  }

  const sourceFiles = await collectImageFiles(imageDirectoryPath);

  if (!sourceFiles.length) {
    throw new Error('\u56fe\u7247\u6587\u4ef6\u5939\u4e2d\u6ca1\u6709\u53ef\u7528\u56fe\u7247\u3002');
  }

  const items = [];
  const failures = [];

  for (const sourceFile of sourceFiles) {
    const item = {
      sourcePath: sourceFile.filePath,
      relativePath: sourceFile.relativePath,
      outputs: [],
      error: ''
    };

    try {
      const outputPath = buildOutputPath({
        outputDirectoryPath,
        sourceFile,
        outputFormat
      });
      const image = await renderWhiteMockupImage({
        mockupPath,
        designPath: sourceFile.filePath,
        template,
        outputFormat,
        jpegQuality
      });

      await writeImage(outputPath, image, outputFormat, jpegQuality);
      item.outputs.push({
        filePath: outputPath,
        width: image.width,
        height: image.height
      });
    } catch (error) {
      item.error = String(error && error.message || error || '').trim();
      failures.push({
        sourcePath: sourceFile.filePath,
        message: item.error
      });
    }

    items.push(item);
  }

  const generatedCount = items.reduce((count, item) => count + item.outputs.length, 0);

  return {
    success: true,
    updatedAt: getIsoTimestamp(),
    mode: 'white-mockup',
    templateId: template.id,
    templateTitle: template.title,
    mockupPath,
    imageDirectoryPath,
    outputDirectoryPath,
    outputFormat,
    jpegQuality,
    totalInputCount: sourceFiles.length,
    generatedCount,
    failedCount: failures.length,
    items,
    failures
  };
}

module.exports = {
  TABLECLOTH_FLAT_TEMPLATE,
  createWhiteMockupRegionFromMask,
  createQuadToUnitTransform,
  generateWhiteMockupImages,
  normalizeWhiteMockupTemplate,
  renderWhiteMockupPreview,
  renderWhiteMockupImage,
  transformPerspectivePoint
};
