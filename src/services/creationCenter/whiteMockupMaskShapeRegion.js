const MASK_SHAPE_REGION_TYPE = 'mask-shape';
const DEFAULT_ALPHA_THRESHOLD = 1;
const DEFAULT_MAX_OUTLINE_POINTS = 720;
const DEFAULT_WARP_CONTROL_COUNT = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePoint(point) {
  const source = Array.isArray(point)
    ? point
    : point && typeof point === 'object'
      ? [point.x, point.y]
      : [];
  const x = Number(source[0]);
  const y = Number(source[1]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return [
    Math.round(x),
    Math.round(y)
  ];
}

function normalizeWarpControl(control) {
  const source = control && typeof control === 'object' ? control : {};
  const anchor = normalizePoint(source.anchor);
  const handle = normalizePoint(source.handle);
  const radius = normalizeNumber(source.radius, 180);

  if (!anchor || !handle) {
    return null;
  }

  return {
    anchor,
    handle,
    radius: clamp(Math.round(radius), 20, 800)
  };
}

function pickOutlinePoint(outlinePoints, ratio) {
  if (!outlinePoints.length) {
    return null;
  }

  return outlinePoints[Math.round((outlinePoints.length - 1) * clamp(ratio, 0, 1))];
}

function createDefaultWarpControls(outlinePoints, bounds) {
  const fallbackPoints = [
    [bounds.left, bounds.top],
    [bounds.right, bounds.top],
    [bounds.right, bounds.bottom],
    [bounds.left, bounds.bottom]
  ];
  const radius = Math.max(120, Math.round(Math.max(bounds.width, bounds.height) * 0.26));

  return Array.from({ length: DEFAULT_WARP_CONTROL_COUNT }, (_item, index) => {
    const ratio = (index + 0.5) / DEFAULT_WARP_CONTROL_COUNT;
    const anchor = pickOutlinePoint(outlinePoints, ratio) || fallbackPoints[index % fallbackPoints.length];

    return {
      anchor: anchor.slice(),
      handle: anchor.slice(),
      radius
    };
  });
}

function getPointDistance(pointA, pointB) {
  return Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1]);
}

function ensureWarpControls(warpControls, outlinePoints, bounds) {
  const controls = warpControls.slice();
  const defaults = createDefaultWarpControls(outlinePoints, bounds);
  const duplicateDistance = Math.max(28, Math.min(90, Math.max(bounds.width, bounds.height) * 0.04));

  defaults.forEach((control) => {
    const hasNearbyControl = controls.some((existingControl) => {
      return getPointDistance(existingControl.anchor, control.anchor) <= duplicateDistance;
    });

    if (!hasNearbyControl) {
      controls.push({
        anchor: control.anchor.slice(),
        handle: control.handle.slice(),
        radius: control.radius
      });
    }
  });

  return controls.map((control) => ({
    anchor: control.anchor.slice(),
    handle: control.handle.slice(),
    radius: control.radius
  }));
}

function normalizeBounds(bounds) {
  const source = bounds && typeof bounds === 'object' ? bounds : {};
  const left = Math.round(normalizeNumber(source.left, 0));
  const top = Math.round(normalizeNumber(source.top, 0));
  const right = Math.round(normalizeNumber(source.right, left));
  const bottom = Math.round(normalizeNumber(source.bottom, top));

  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
    width: Math.max(1, Math.abs(right - left) + 1),
    height: Math.max(1, Math.abs(bottom - top) + 1),
    count: Math.max(0, Math.round(normalizeNumber(source.count, 0)))
  };
}

function normalizeMaskShape(shape) {
  const source = shape && typeof shape === 'object' ? shape : {};
  const outlinePoints = Array.isArray(source.outlinePoints)
    ? source.outlinePoints.map(normalizePoint).filter(Boolean)
    : [];
  const warpControls = Array.isArray(source.warpControls)
    ? source.warpControls.map(normalizeWarpControl).filter(Boolean)
    : [];
  const bounds = normalizeBounds(source.bounds);
  const mappingBounds = normalizeBounds(source.mappingBounds || source.bounds);
  const imageSize = source.imageSize && typeof source.imageSize === 'object'
    ? {
      width: Math.max(1, Math.round(normalizeNumber(source.imageSize.width, mappingBounds.right + 1))),
      height: Math.max(1, Math.round(normalizeNumber(source.imageSize.height, mappingBounds.bottom + 1)))
    }
    : {
      width: Math.max(1, mappingBounds.right + 1),
      height: Math.max(1, mappingBounds.bottom + 1)
    };

  return {
    version: 1,
    mode: 'alpha-mask',
    alphaThreshold: clamp(Math.round(normalizeNumber(source.alphaThreshold, DEFAULT_ALPHA_THRESHOLD)), 0, 254),
    imageSize,
    bounds,
    mappingBounds,
    outlinePoints,
    warpControls: ensureWarpControls(warpControls, outlinePoints, bounds)
  };
}

function isMaskShapeRegion(region) {
  const type = normalizeText(region && (region.type || region.mode));
  return type === MASK_SHAPE_REGION_TYPE;
}

function isMaskAlphaVisible(mask, x, y, alphaThreshold) {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) {
    return false;
  }

  return mask.data[(y * mask.width + x) * 4 + 3] > alphaThreshold;
}

function createMaskRowSpans(mask, alphaThreshold = DEFAULT_ALPHA_THRESHOLD) {
  const spans = [];
  let left = mask.width;
  let top = mask.height;
  let right = -1;
  let bottom = -1;
  let count = 0;

  for (let y = 0; y < mask.height; y += 1) {
    let rowCount = 0;
    let segmentLeft = -1;

    for (let x = 0; x < mask.width; x += 1) {
      const visible = isMaskAlphaVisible(mask, x, y, alphaThreshold);

      if (visible) {
        if (segmentLeft < 0) {
          segmentLeft = x;
        }

        rowCount += 1;
        continue;
      }

      if (segmentLeft >= 0) {
        spans.push({
          y,
          left: segmentLeft,
          right: x - 1,
          count: x - segmentLeft
        });
        left = Math.min(left, segmentLeft);
        top = Math.min(top, y);
        right = Math.max(right, x - 1);
        bottom = Math.max(bottom, y);
        segmentLeft = -1;
      }
    }

    if (segmentLeft >= 0) {
      spans.push({
        y,
        left: segmentLeft,
        right: mask.width - 1,
        count: mask.width - segmentLeft
      });
      left = Math.min(left, segmentLeft);
      top = Math.min(top, y);
      right = Math.max(right, mask.width - 1);
      bottom = Math.max(bottom, y);
    }

    if (!rowCount) {
      continue;
    }

    count += rowCount;
  }

  if (!spans.length) {
    return {
      spans,
      bounds: null
    };
  }

  return {
    spans,
    bounds: {
      left,
      top,
      right,
      bottom,
      width: right - left + 1,
      height: bottom - top + 1,
      count
    }
  };
}

function createMaskRowEdges(mask, alphaThreshold = DEFAULT_ALPHA_THRESHOLD) {
  const rows = [];

  for (let y = 0; y < mask.height; y += 1) {
    let rowLeft = -1;
    let rowRight = -1;

    for (let x = 0; x < mask.width; x += 1) {
      if (!isMaskAlphaVisible(mask, x, y, alphaThreshold)) {
        continue;
      }

      if (rowLeft < 0) {
        rowLeft = x;
      }

      rowRight = x;
    }

    if (rowLeft >= 0) {
      rows.push({
        y,
        left: rowLeft,
        right: rowRight
      });
    }
  }

  return rows;
}

function createPointKey(x, y) {
  return `${x},${y}`;
}

function createBoundarySegments(mask, alphaThreshold = DEFAULT_ALPHA_THRESHOLD) {
  const segments = [];
  const addSegment = (startX, startY, endX, endY) => {
    segments.push({
      start: [startX, startY],
      end: [endX, endY],
      used: false
    });
  };

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!isMaskAlphaVisible(mask, x, y, alphaThreshold)) {
        continue;
      }

      if (!isMaskAlphaVisible(mask, x, y - 1, alphaThreshold)) {
        addSegment(x, y, x + 1, y);
      }
      if (!isMaskAlphaVisible(mask, x + 1, y, alphaThreshold)) {
        addSegment(x + 1, y, x + 1, y + 1);
      }
      if (!isMaskAlphaVisible(mask, x, y + 1, alphaThreshold)) {
        addSegment(x + 1, y + 1, x, y + 1);
      }
      if (!isMaskAlphaVisible(mask, x - 1, y, alphaThreshold)) {
        addSegment(x, y + 1, x, y);
      }
    }
  }

  return segments;
}

function createSegmentStartMap(segments) {
  const startMap = new Map();

  segments.forEach((segment, index) => {
    const key = createPointKey(segment.start[0], segment.start[1]);
    const list = startMap.get(key) || [];

    list.push(index);
    startMap.set(key, list);
  });

  return startMap;
}

function takeNextSegmentIndex(startMap, point) {
  const key = createPointKey(point[0], point[1]);
  const indexes = startMap.get(key);

  if (!indexes || !indexes.length) {
    return -1;
  }

  while (indexes.length) {
    const index = indexes.shift();

    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function traceBoundaryLoops(segments) {
  const startMap = createSegmentStartMap(segments);
  const loops = [];

  for (let index = 0; index < segments.length; index += 1) {
    const firstSegment = segments[index];

    if (firstSegment.used) {
      continue;
    }

    const start = firstSegment.start;
    const points = [start];
    let current = firstSegment.end;

    firstSegment.used = true;
    points.push(current);

    while (points.length <= segments.length + 1 && createPointKey(current[0], current[1]) !== createPointKey(start[0], start[1])) {
      const nextIndex = takeNextSegmentIndex(startMap, current);

      if (nextIndex < 0) {
        break;
      }

      const segment = segments[nextIndex];

      if (!segment || segment.used) {
        continue;
      }

      segment.used = true;
      current = segment.end;
      points.push(current);
    }

    if (points.length >= 4) {
      loops.push(points);
    }
  }

  return loops;
}

function getLoopArea(points) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const pointA = points[index];
    const pointB = points[(index + 1) % points.length];

    area += (pointA[0] * pointB[1]) - (pointB[0] * pointA[1]);
  }

  return Math.abs(area / 2);
}

function sampleRows(rows, maxRows) {
  if (rows.length <= maxRows) {
    return rows;
  }

  const step = (rows.length - 1) / Math.max(1, maxRows - 1);
  const sampled = [];

  for (let index = 0; index < maxRows; index += 1) {
    sampled.push(rows[Math.round(index * step)]);
  }

  return sampled;
}

function samplePathPoints(points, maxPoints) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = (points.length - 1) / Math.max(1, maxPoints - 1);
  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }

  return sampled;
}

function createRowEnvelopeOutlinePoints(rowEdges, maxOutlinePoints = DEFAULT_MAX_OUTLINE_POINTS) {
  if (!rowEdges.length) {
    return [];
  }

  const maxRows = Math.max(4, Math.floor(maxOutlinePoints / 2));
  const sampledRows = sampleRows(rowEdges, maxRows);
  const leftPoints = sampledRows.map((span) => [span.left, span.y]);
  const rightPoints = sampledRows
    .slice()
    .reverse()
    .map((span) => [span.right, span.y]);

  return leftPoints.concat(rightPoints);
}

function createOutlinePoints(mask, alphaThreshold, maxOutlinePoints = DEFAULT_MAX_OUTLINE_POINTS) {
  const segments = createBoundarySegments(mask, alphaThreshold);
  const loops = traceBoundaryLoops(segments);

  if (!loops.length) {
    return createRowEnvelopeOutlinePoints(createMaskRowEdges(mask, alphaThreshold), maxOutlinePoints);
  }

  const largestLoop = loops.reduce((best, loop) => (getLoopArea(loop) > getLoopArea(best) ? loop : best), loops[0]);
  return samplePathPoints(largestLoop, Math.max(12, maxOutlinePoints));
}

function padBounds(bounds, padding, imageSize) {
  const normalizedPadding = clamp(normalizeNumber(padding, 0), 0, 0.5);

  if (!normalizedPadding) {
    return normalizeBounds(bounds);
  }

  const inset = Math.max(bounds.width, bounds.height) * normalizedPadding;

  return normalizeBounds({
    left: clamp(Math.round(bounds.left - inset), -imageSize.width * 0.5, imageSize.width * 1.5),
    top: clamp(Math.round(bounds.top - inset), -imageSize.height * 0.5, imageSize.height * 1.5),
    right: clamp(Math.round(bounds.right + inset), -imageSize.width * 0.5, imageSize.width * 1.5),
    bottom: clamp(Math.round(bounds.bottom + inset), -imageSize.height * 0.5, imageSize.height * 1.5),
    count: bounds.count
  });
}

function createBoundsPoints(bounds) {
  return [
    [bounds.left, bounds.top],
    [bounds.right, bounds.top],
    [bounds.right, bounds.bottom],
    [bounds.left, bounds.bottom]
  ];
}

function createMaskShapeRegionFromMask(mask, options = {}) {
  const alphaThreshold = clamp(Math.round(normalizeNumber(options.alphaThreshold, DEFAULT_ALPHA_THRESHOLD)), 0, 254);
  const { spans, bounds } = createMaskRowSpans(mask, alphaThreshold);

  if (!bounds) {
    return null;
  }

  const imageSize = {
    width: mask.width,
    height: mask.height
  };
  const mappingBounds = padBounds(bounds, options.padding, imageSize);
  const outlinePoints = createOutlinePoints(mask, alphaThreshold, options.maxOutlinePoints);

  return {
    type: MASK_SHAPE_REGION_TYPE,
    name: normalizeText(options.name) || '\u8499\u7248\u5f62\u72b6\u533a\u57df',
    points: createBoundsPoints(mappingBounds),
    strength: Number.isFinite(Number(options.strength)) ? clamp(Number(options.strength), 0.05, 1) : 0.96,
    feather: 0,
    bleed: 0,
    shape: {
      version: 1,
      mode: 'alpha-mask',
      alphaThreshold,
      imageSize,
      bounds: normalizeBounds(bounds),
      mappingBounds,
      outlinePoints,
      warpControls: createDefaultWarpControls(outlinePoints, bounds)
    }
  };
}

function applyWarpControlsToUv(x, y, u, v, shape, mappingBounds) {
  const warpControls = Array.isArray(shape.warpControls) ? shape.warpControls : [];

  if (!warpControls.length) {
    return {
      u,
      v
    };
  }

  const sourceWidth = Math.max(1, mappingBounds.right - mappingBounds.left);
  const sourceHeight = Math.max(1, mappingBounds.bottom - mappingBounds.top);
  let offsetX = 0;
  let offsetY = 0;

  warpControls.forEach((control) => {
    const anchor = control.anchor;
    const handle = control.handle;
    const radius = Math.max(1, Number(control.radius) || 1);
    const distance = Math.hypot(x - anchor[0], y - anchor[1]);

    if (distance > radius) {
      return;
    }

    const weight = (1 - (distance / radius)) ** 2;

    offsetX += (handle[0] - anchor[0]) * weight;
    offsetY += (handle[1] - anchor[1]) * weight;
  });

  return {
    u: clamp(u + (offsetX / sourceWidth), 0, 1),
    v: clamp(v + (offsetY / sourceHeight), 0, 1)
  };
}

function forEachMaskShapePixel(mask, region, visit) {
  const shape = normalizeMaskShape(region && region.shape);
  const { spans, bounds } = createMaskRowSpans(mask, shape.alphaThreshold);
  const mappingBounds = normalizeBounds(shape.mappingBounds || bounds);
  const sourceWidth = Math.max(1, mappingBounds.right - mappingBounds.left);
  const sourceHeight = Math.max(1, mappingBounds.bottom - mappingBounds.top);

  spans.forEach((span) => {
    const y = span.y;
    const v = clamp((y - mappingBounds.top) / sourceHeight, 0, 1);
    const left = clamp(span.left, 0, mask.width - 1);
    const right = clamp(span.right, left, mask.width - 1);

    for (let x = left; x <= right; x += 1) {
      const u = clamp((x - mappingBounds.left) / sourceWidth, 0, 1);
      const uv = applyWarpControlsToUv(x, y, u, v, shape, mappingBounds);

      visit({
        x,
        y,
        u: uv.u,
        v: uv.v
      });
    }
  });
}

module.exports = {
  MASK_SHAPE_REGION_TYPE,
  createMaskShapeRegionFromMask,
  forEachMaskShapePixel,
  isMaskShapeRegion,
  normalizeMaskShape
};
