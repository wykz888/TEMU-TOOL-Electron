const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePath(value) {
  return path.resolve(String(value || '').trim());
}

function createDefaultOutputPath(mockupPath, suffix) {
  const directory = path.dirname(mockupPath);
  const baseName = path.basename(mockupPath, path.extname(mockupPath));
  return path.join(directory, `${baseName}_${suffix}.png`);
}

function interpolateQuad(points, u, v) {
  const topWeight = 1 - v;
  const bottomWeight = v;
  const leftWeight = 1 - u;
  const rightWeight = u;

  return {
    x:
      (points[0].x * leftWeight * topWeight)
      + (points[1].x * rightWeight * topWeight)
      + (points[2].x * rightWeight * bottomWeight)
      + (points[3].x * leftWeight * bottomWeight),
    y:
      (points[0].y * leftWeight * topWeight)
      + (points[1].y * rightWeight * topWeight)
      + (points[2].y * rightWeight * bottomWeight)
      + (points[3].y * leftWeight * bottomWeight)
  };
}

function solveQuadUv(points, x, y, bounds) {
  let u = bounds.width ? (x - bounds.left) / bounds.width : 0.5;
  let v = bounds.height ? (y - bounds.top) / bounds.height : 0.5;

  for (let index = 0; index < 10; index += 1) {
    const point = interpolateQuad(points, u, v);
    const errorX = point.x - x;
    const errorY = point.y - y;

    if (Math.abs(errorX) + Math.abs(errorY) < 0.01) {
      break;
    }

    const dxdu = ((points[1].x - points[0].x) * (1 - v)) + ((points[2].x - points[3].x) * v);
    const dydu = ((points[1].y - points[0].y) * (1 - v)) + ((points[2].y - points[3].y) * v);
    const dxdv = ((points[3].x - points[0].x) * (1 - u)) + ((points[2].x - points[1].x) * u);
    const dydv = ((points[3].y - points[0].y) * (1 - u)) + ((points[2].y - points[1].y) * u);
    const determinant = (dxdu * dydv) - (dxdv * dydu);

    if (Math.abs(determinant) < 0.000001) {
      return null;
    }

    const deltaU = ((errorX * dydv) - (dxdv * errorY)) / determinant;
    const deltaV = ((dxdu * errorY) - (errorX * dydu)) / determinant;
    u -= deltaU;
    v -= deltaV;
  }

  if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) {
    return null;
  }

  return {
    u: clamp(u, 0, 1),
    v: clamp(v, 0, 1)
  };
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
  const wx = x - x0;
  const wy = y - y0;
  const offsets = [
    (y0 * image.width + x0) * 4,
    (y0 * image.width + x1) * 4,
    (y1 * image.width + x0) * 4,
    (y1 * image.width + x1) * 4
  ];
  const result = [0, 0, 0, 0];

  for (let channel = 0; channel < 4; channel += 1) {
    const top = (image.data[offsets[0] + channel] * (1 - wx)) + (image.data[offsets[1] + channel] * wx);
    const bottom = (image.data[offsets[2] + channel] * (1 - wx)) + (image.data[offsets[3] + channel] * wx);
    result[channel] = (top * (1 - wy)) + (bottom * wy);
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

function drawRegion(canvas, base, design, region) {
  const points = region.points.map(([x, y]) => ({
    x,
    y
  }));
  const bounds = getBounds(points, base.width, base.height);
  const feather = Number(region.feather) || 0;
  const strength = Number(region.strength) || 0.9;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const uv = solveQuadUv(points, x + 0.5, y + 0.5, bounds);

      if (!uv) {
        continue;
      }

      const edgeAlpha = getFeatherAlpha(points, x + 0.5, y + 0.5, feather);
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
      const sourcePixel = samplePixel(design, uv.u, uv.v);
      const nextPixel = blendPrintedPixel(basePixel, sourcePixel, strength * edgeAlpha);

      canvas[offset] = nextPixel[0];
      canvas[offset + 1] = nextPixel[1];
      canvas[offset + 2] = nextPixel[2];
      canvas[offset + 3] = nextPixel[3];
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

async function writePng(filePath, image) {
  await fs.promises.mkdir(path.dirname(filePath), {
    recursive: true
  });
  await sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4
    }
  })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toFile(filePath);
}

async function renderMockup({ mockupPath, designPath, outputPath, mode }) {
  const base = await readRawImage(mockupPath);
  const design = await readRawImage(designPath, {
    width: 1800,
    height: 1400,
    fit: 'cover',
    position: 'center',
    kernel: sharp.kernel.lanczos3
  });
  const canvas = Buffer.from(base.data);
  const topRegion = {
    name: 'top',
    points: [
      [31, 264],
      [404, 166],
      [898, 465],
      [492, 644]
    ],
    strength: 0.84,
    feather: 15
  };
  const sideRegions = [
    {
      name: 'left-drop',
      points: [
        [10, 252],
        [493, 666],
        [536, 768],
        [0, 504]
      ],
      strength: 0.72,
      feather: 9
    },
    {
      name: 'front-drop',
      points: [
        [493, 666],
        [933, 462],
        [933, 702],
        [536, 768]
      ],
      strength: 0.68,
      feather: 9
    }
  ];

  drawRegion(canvas, base, design, topRegion);

  if (mode === 'multi') {
    sideRegions.forEach((region) => {
      drawRegion(canvas, base, design, region);
    });
  }

  await writePng(outputPath, {
    data: canvas,
    width: base.width,
    height: base.height
  });

  return outputPath;
}

async function main() {
  const mockupPath = normalizePath(process.argv[2] || 'C:\\Users\\wykz8\\Desktop\\0001.png');
  const designPath = normalizePath(process.argv[3] || 'C:\\Users\\wykz8\\Desktop\\新建文件夹\\Z8 (5).png');
  const topOutputPath = normalizePath(process.argv[4] || createDefaultOutputPath(mockupPath, 'top_test'));
  const multiOutputPath = normalizePath(process.argv[5] || createDefaultOutputPath(mockupPath, 'multi_test'));

  await renderMockup({
    mockupPath,
    designPath,
    outputPath: topOutputPath,
    mode: 'top'
  });
  await renderMockup({
    mockupPath,
    designPath,
    outputPath: multiOutputPath,
    mode: 'multi'
  });

  console.log(JSON.stringify({
    topOutputPath,
    multiOutputPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
