(function initPodSuiteTemplateRegions() {
  const DEFAULT_TEMPLATE_SIZE = Object.freeze({
    width: 934,
    height: 933
  });

  const DEFAULT_TEMPLATE = Object.freeze({
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

  const POINT_LABELS = Object.freeze([
    '\u5de6\u4e0a',
    '\u53f3\u4e0a',
    '\u53f3\u4e0b',
    '\u5de6\u4e0b'
  ]);
  const MASK_SHAPE_REGION_TYPE = 'mask-shape';
  const DEFAULT_WARP_CONTROL_COUNT = 12;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeTemplateSize(size) {
    const width = Number(size && size.width);
    const height = Number(size && size.height);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return {
        width: Math.round(width),
        height: Math.round(height)
      };
    }

    return {
      ...DEFAULT_TEMPLATE_SIZE
    };
  }

  function normalizeTemplatePoint(point, fallbackPoint, size) {
    const source = Array.isArray(point)
      ? point
      : point && typeof point === 'object'
        ? [point.x, point.y]
        : fallbackPoint;
    const x = Number(source && source[0]);
    const y = Number(source && source[1]);

    return [
      Math.round(clamp(Number.isFinite(x) ? x : fallbackPoint[0], -size.width * 0.5, size.width * 1.5)),
      Math.round(clamp(Number.isFinite(y) ? y : fallbackPoint[1], -size.height * 0.5, size.height * 1.5))
    ];
  }

  function normalizeBounds(bounds, fallbackBounds, size) {
    const source = bounds && typeof bounds === 'object' ? bounds : fallbackBounds;
    const fallback = source && typeof source === 'object'
      ? source
      : {
        left: 0,
        top: 0,
        right: size.width - 1,
        bottom: size.height - 1,
        count: 0
      };
    const left = Math.round(clamp(Number.isFinite(Number(fallback.left)) ? Number(fallback.left) : 0, -size.width * 0.5, size.width * 1.5));
    const top = Math.round(clamp(Number.isFinite(Number(fallback.top)) ? Number(fallback.top) : 0, -size.height * 0.5, size.height * 1.5));
    const right = Math.round(clamp(Number.isFinite(Number(fallback.right)) ? Number(fallback.right) : left, -size.width * 0.5, size.width * 1.5));
    const bottom = Math.round(clamp(Number.isFinite(Number(fallback.bottom)) ? Number(fallback.bottom) : top, -size.height * 0.5, size.height * 1.5));

    return {
      left: Math.min(left, right),
      top: Math.min(top, bottom),
      right: Math.max(left, right),
      bottom: Math.max(top, bottom),
      width: Math.max(1, Math.abs(right - left) + 1),
      height: Math.max(1, Math.abs(bottom - top) + 1),
      count: Math.max(0, Math.round(Number(fallback.count) || 0))
    };
  }

  function normalizeShapePoint(point, size) {
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
      Math.round(clamp(x, -size.width * 0.5, size.width * 1.5)),
      Math.round(clamp(y, -size.height * 0.5, size.height * 1.5))
    ];
  }

  function normalizeWarpControl(control, size) {
    const source = control && typeof control === 'object' ? control : {};
    const anchor = normalizeShapePoint(source.anchor, size);
    const handle = normalizeShapePoint(source.handle, size);
    const radius = Number(source.radius);

    if (!anchor || !handle) {
      return null;
    }

    return {
      anchor,
      handle,
      radius: Math.max(20, Math.min(800, Math.round(Number.isFinite(radius) ? radius : 180)))
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

  function normalizeMaskShape(shape, size) {
    const source = shape && typeof shape === 'object' ? shape : {};
    const bounds = normalizeBounds(source.bounds, null, size);
    const mappingBounds = normalizeBounds(source.mappingBounds, bounds, size);
    const outlinePoints = Array.isArray(source.outlinePoints)
      ? source.outlinePoints.map((point) => normalizeShapePoint(point, size)).filter(Boolean)
      : [];
    const warpControls = Array.isArray(source.warpControls)
      ? source.warpControls.map((control) => normalizeWarpControl(control, size)).filter(Boolean)
      : [];

    return {
      version: 1,
      mode: 'alpha-mask',
      alphaThreshold: Math.max(0, Math.min(254, Math.round(Number(source.alphaThreshold) || 1))),
      imageSize: {
        width: Math.max(1, Math.round(Number(source.imageSize && source.imageSize.width) || size.width)),
        height: Math.max(1, Math.round(Number(source.imageSize && source.imageSize.height) || size.height))
      },
      bounds,
      mappingBounds,
      outlinePoints,
      warpControls: ensureWarpControls(warpControls, outlinePoints, bounds)
    };
  }

  function createMappingBoundsFromPoints(points, fallbackBounds) {
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

  function isMaskShapeRegion(region) {
    return normalizeText(region && (region.type || region.mode)) === MASK_SHAPE_REGION_TYPE;
  }

  function normalizeRegion(region, fallbackRegion, index, size) {
    const source = region && typeof region === 'object' ? region : fallbackRegion;
    const fallback = fallbackRegion && typeof fallbackRegion === 'object'
      ? fallbackRegion
      : DEFAULT_TEMPLATE.regions[0];
    const points = [];

    for (let pointIndex = 0; pointIndex < 4; pointIndex += 1) {
      points.push(normalizeTemplatePoint(
        Array.isArray(source.points) ? source.points[pointIndex] : null,
        fallback.points[pointIndex],
        size
      ));
    }

    const normalizedRegion = {
      ...clonePlain(fallback),
      ...(source && typeof source === 'object' ? source : {}),
      name: normalizeText(source && source.name) || normalizeText(fallback.name) || `\u533a\u57df${index + 1}`,
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
      normalizedRegion.shape = normalizeMaskShape(source.shape, size);
      normalizedRegion.shape.mappingBounds = createMappingBoundsFromPoints(
        normalizedRegion.points,
        normalizedRegion.shape.mappingBounds
      );
      normalizedRegion.feather = 0;
    }

    return normalizedRegion;
  }

  function normalizeTemplate(template, size) {
    const resolvedSize = normalizeTemplateSize(size);
    const source = template && typeof template === 'object' ? template : DEFAULT_TEMPLATE;
    const sourceRegions = Array.isArray(source.regions) && source.regions.length
      ? source.regions
      : DEFAULT_TEMPLATE.regions;
    const regions = sourceRegions.map((region, index) => normalizeRegion(
      region,
      DEFAULT_TEMPLATE.regions[index] || DEFAULT_TEMPLATE.regions[0],
      index,
      resolvedSize
    ));

    if (!regions.length) {
      regions.push(normalizeRegion(DEFAULT_TEMPLATE.regions[0], DEFAULT_TEMPLATE.regions[0], 0, resolvedSize));
    }

    return {
      ...clonePlain(DEFAULT_TEMPLATE),
      ...(source && typeof source === 'object' ? source : {}),
      title: normalizeText(source.title) || DEFAULT_TEMPLATE.title,
      maskImagePath: normalizeText(source.maskImagePath),
      textureImagePath: normalizeText(source.textureImagePath),
      regions
    };
  }

  function scaleTemplate(template, fromSize, toSize) {
    const source = template && typeof template === 'object' ? template : DEFAULT_TEMPLATE;
    const sourceSize = normalizeTemplateSize(fromSize);
    const targetSize = normalizeTemplateSize(toSize);
    const scaleX = targetSize.width / sourceSize.width;
    const scaleY = targetSize.height / sourceSize.height;
    const sourceRegions = Array.isArray(source.regions) && source.regions.length
      ? source.regions
      : DEFAULT_TEMPLATE.regions;

    return normalizeTemplate({
      ...source,
      regions: sourceRegions.map((region, regionIndex) => {
        const fallbackRegion = DEFAULT_TEMPLATE.regions[regionIndex] || DEFAULT_TEMPLATE.regions[0];

        return {
          ...region,
          shape: isMaskShapeRegion(region) ? normalizeMaskShape(region.shape, targetSize) : region.shape,
          points: [0, 1, 2, 3].map((pointIndex) => {
            const point = Array.isArray(region.points) ? region.points[pointIndex] : null;
            const fallbackPoint = fallbackRegion.points[pointIndex];
            const x = Number(Array.isArray(point) ? point[0] : point && point.x);
            const y = Number(Array.isArray(point) ? point[1] : point && point.y);

            return [
              Math.round((Number.isFinite(x) ? x : fallbackPoint[0]) * scaleX),
              Math.round((Number.isFinite(y) ? y : fallbackPoint[1]) * scaleY)
            ];
          })
        };
      })
    }, targetSize);
  }

  function createDefaultTemplate(size) {
    return scaleTemplate(
      clonePlain(DEFAULT_TEMPLATE),
      DEFAULT_TEMPLATE_SIZE,
      normalizeTemplateSize(size)
    );
  }

  function createRegionFrom(region, index, size) {
    const resolvedSize = normalizeTemplateSize(size);
    const source = normalizeRegion(region, DEFAULT_TEMPLATE.regions[0], index, resolvedSize);
    const offset = Math.min(36, Math.max(12, Math.round(Math.min(resolvedSize.width, resolvedSize.height) * 0.03)));

    return normalizeRegion({
      ...source,
      name: `\u533a\u57df${index + 1}`,
      points: source.points.map((point) => [
        clamp(point[0] + offset, -resolvedSize.width * 0.5, resolvedSize.width * 1.5),
        clamp(point[1] + offset, -resolvedSize.height * 0.5, resolvedSize.height * 1.5)
      ])
    }, DEFAULT_TEMPLATE.regions[0], index, resolvedSize);
  }

  window.podSuiteTemplateRegions = Object.freeze({
    DEFAULT_TEMPLATE,
    DEFAULT_TEMPLATE_SIZE,
    MASK_SHAPE_REGION_TYPE,
    POINT_LABELS,
    createDefaultTemplate,
    createRegionFrom,
    isMaskShapeRegion,
    normalizeTemplate,
    scaleTemplate
  });
})();
