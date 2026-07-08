const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const {
  createPodSuiteToolService
} = require('../src/services/creationCenter/podSuiteToolService');
const {
  buildSliceBoxes,
  buildSliceOutputPaths,
  hasCompleteSliceOutputs,
  writeImageSlices
} = require('../src/services/creationCenter/psdSliceExporter');
const {
  createQuadToUnitTransform,
  createWhiteMockupRegionFromMask,
  generateWhiteMockupImages,
  transformPerspectivePoint,
  renderWhiteMockupImage
} = require('../src/services/creationCenter/whiteMockupTemplateRenderer');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createSolidPng(filePath, width, height, background) {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background
    }
  })
    .png()
    .toFile(filePath);
}

async function createHorizontalGradientPng(filePath, width, height) {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const ratio = width > 1 ? x / (width - 1) : 0;

      data[offset] = Math.round(255 * (1 - ratio));
      data[offset + 1] = 30;
      data[offset + 2] = Math.round(255 * ratio);
      data[offset + 3] = 255;
    }
  }

  await sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png()
    .toFile(filePath);
}

async function createMaskPng(filePath, width, height) {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    }
  })
    .composite([
      {
        input: {
          create: {
            width: 180,
            height: 160,
            channels: 4,
            background: {
              r: 255,
              g: 255,
              b: 255,
              alpha: 1
            }
          }
        },
        left: 40,
        top: 50
      }
    ])
    .png()
    .toFile(filePath);
}

async function createTouchingEdgeMaskPng(filePath, width, height) {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,60 ${width - 1},190 ${width - 1},330 0,210" fill="#ffffff"/>
    </svg>
  `;

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0
      }
    }
  })
    .composite([
      {
        input: Buffer.from(svg)
      }
    ])
    .png()
    .toFile(filePath);
}

function readRawImagePixel(image, x, y) {
  const offset = (y * image.width + x) * 4;

  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
    a: image.data[offset + 3]
  };
}

async function readImagePixel(filePath, x, y) {
  const result = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({
      resolveWithObject: true
    });
  const offset = (y * result.info.width + x) * 4;

  return {
    r: result.data[offset],
    g: result.data[offset + 1],
    b: result.data[offset + 2],
    a: result.data[offset + 3]
  };
}

function assertNearColor(actual, expected, tolerance, message) {
  const withinRange =
    Math.abs(actual.r - expected.r) <= tolerance
    && Math.abs(actual.g - expected.g) <= tolerance
    && Math.abs(actual.b - expected.b) <= tolerance
    && Math.abs(actual.a - expected.a) <= tolerance;

  assert(withinRange, `${message}: ${JSON.stringify(actual)}`);
}

async function collectFlatPngFiles(directoryPath) {
  const entries = await fs.promises.readdir(directoryPath);

  return entries
    .filter((fileName) => fileName.endsWith('.png'))
    .map((fileName) => ({
      filePath: path.join(directoryPath, fileName),
      relativePath: fileName,
      fileName
    }));
}

function createCustomTemplate() {
  return {
    id: 'custom-region',
    title: 'custom-region',
    regions: [
      {
        name: 'top',
        points: [
          [40, 40],
          [180, 40],
          [180, 180],
          [40, 180]
        ],
        strength: 1,
        feather: 0
      }
    ]
  };
}

function createMultiRegionTemplate() {
  return {
    id: 'multi-region',
    title: 'multi-region',
    regions: [
      {
        name: 'first',
        points: [
          [40, 40],
          [180, 40],
          [180, 180],
          [40, 180]
        ],
        strength: 1,
        feather: 0
      },
      {
        name: 'second',
        points: [
          [240, 40],
          [380, 40],
          [380, 180],
          [240, 180]
        ],
        strength: 1,
        feather: 0
      }
    ]
  };
}

function createOversizedRegionTemplate() {
  return {
    id: 'oversized-region',
    title: 'oversized-region',
    regions: [
      {
        name: 'oversized',
        points: [
          [-20, 80],
          [200, 80],
          [200, 200],
          [-20, 200]
        ],
        strength: 1,
        feather: 0
      }
    ]
  };
}

async function main() {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pod-suite-tool-'));
  const inputDir = path.join(tempRoot, 'input');
  const outputDir = path.join(tempRoot, 'output');
  const storeOutputDir = path.join(tempRoot, 'store-output');
  const whiteMockupPath = path.join(tempRoot, 'white-mockup.png');
  const maskPath = path.join(tempRoot, 'mask.png');
  const touchingEdgeMaskPath = path.join(tempRoot, 'touching-edge-mask.png');
  const texturePath = path.join(tempRoot, 'texture.png');
  const designAPath = path.join(inputDir, 'design-a.png');
  const gradientDesignPath = path.join(tempRoot, 'gradient-design.png');

  await fs.promises.mkdir(inputDir, {
    recursive: true
  });
  await fs.promises.mkdir(outputDir, {
    recursive: true
  });
  await fs.promises.mkdir(storeOutputDir, {
    recursive: true
  });
  await createSolidPng(whiteMockupPath, 934, 933, {
    r: 245,
    g: 246,
    b: 248,
    alpha: 1
  });
  await createSolidPng(designAPath, 800, 600, {
    r: 220,
    g: 40,
    b: 40,
    alpha: 1
  });
  await createHorizontalGradientPng(gradientDesignPath, 800, 600);
  await createSolidPng(texturePath, 220, 220, {
    r: 20,
    g: 60,
    b: 220,
    alpha: 0.5
  });
  await createMaskPng(maskPath, 934, 933);
  await createTouchingEdgeMaskPng(touchingEdgeMaskPath, 934, 933);
  await createSolidPng(path.join(inputDir, 'design-b.png'), 640, 800, {
    r: 30,
    g: 110,
    b: 210,
    alpha: 1
  });

  const perspectivePoints = [
    {
      x: 40,
      y: 40
    },
    {
      x: 180,
      y: 30
    },
    {
      x: 190,
      y: 180
    },
    {
      x: 30,
      y: 170
    }
  ];
  const perspectiveTransform = createQuadToUnitTransform(perspectivePoints);
  assert(perspectiveTransform, 'perspective transform should be solvable');
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ].forEach((expected, index) => {
    const actual = transformPerspectivePoint(
      perspectiveTransform,
      perspectivePoints[index].x,
      perspectivePoints[index].y
    );
    assert(
      Math.abs(actual.x - expected[0]) < 0.001 && Math.abs(actual.y - expected[1]) < 0.001,
      `perspective corner ${index} should map to source uv`
    );
  });

  const whiteResult = await generateWhiteMockupImages({
    mockupPath: whiteMockupPath,
    imageDirectoryPath: inputDir,
    outputDirectoryPath: outputDir,
    outputFormat: 'png'
  }, collectFlatPngFiles);

  assert(whiteResult.success === true, 'white mockup generation should succeed');
  assert(whiteResult.generatedCount === 2, 'white mockup should generate one file per input');
  const whiteOutput = whiteResult.items[0].outputs[0].filePath;
  const whiteMetadata = await sharp(whiteOutput).metadata();
  assert(whiteMetadata.width === 934, 'white mockup output width should match base');
  assert(whiteMetadata.height === 933, 'white mockup output height should match base');

  const customWhiteImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: createCustomTemplate(),
    outputFormat: 'png'
  });
  const customInsidePixel = readRawImagePixel(customWhiteImage, 80, 80);
  const customOutsidePixel = readRawImagePixel(customWhiteImage, 260, 260);
  assert(customInsidePixel.r > customInsidePixel.g + 80, 'custom white template should paint inside configured region');
  assertNearColor(customOutsidePixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 2, 'custom white template should not paint outside configured region');

  const multiRegionImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: createMultiRegionTemplate(),
    outputFormat: 'png'
  });
  const multiRegionFirstPixel = readRawImagePixel(multiRegionImage, 80, 80);
  const multiRegionSecondPixel = readRawImagePixel(multiRegionImage, 280, 80);
  const multiRegionOutsidePixel = readRawImagePixel(multiRegionImage, 460, 80);
  assert(multiRegionFirstPixel.r > multiRegionFirstPixel.g + 80, 'multi-region template should paint first region');
  assert(multiRegionSecondPixel.r > multiRegionSecondPixel.g + 80, 'multi-region template should paint second region');
  assertNearColor(multiRegionOutsidePixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 2, 'multi-region template should keep pixels outside all regions unchanged');

  const oversizedRegionImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: createOversizedRegionTemplate(),
    outputFormat: 'png'
  });
  const oversizedInsidePixel = readRawImagePixel(oversizedRegionImage, 5, 100);
  const oversizedFarOutsidePixel = readRawImagePixel(oversizedRegionImage, 240, 100);
  assert(oversizedInsidePixel.r > oversizedInsidePixel.g + 80, 'oversized region should paint when points extend outside canvas');
  assertNearColor(oversizedFarOutsidePixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 2, 'oversized region should only paint inside its manual points');

  const customTextureImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: {
      ...createCustomTemplate(),
      textureImagePath: texturePath
    },
    outputFormat: 'png'
  });
  const customTexturePixel = readRawImagePixel(customTextureImage, 80, 80);
  assert(customTexturePixel.b > customInsidePixel.b + 70, 'texture overlay should be composited above printed design');

  const maskedImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: {
      id: 'masked-template',
      title: 'masked-template',
      maskImagePath: maskPath,
      regions: [
        {
          name: 'mask-strength',
          points: [
            [-120, -80],
            [360, -80],
            [360, 260],
            [-120, 260]
          ],
          strength: 1,
          feather: 0
        }
      ]
    },
    outputFormat: 'png'
  });
  const maskedInsidePixel = readRawImagePixel(maskedImage, 80, 80);
  const maskedOutsidePixel = readRawImagePixel(maskedImage, 260, 260);
  const maskedRegionOnlyPixel = readRawImagePixel(maskedImage, 20, 20);
  assert(maskedInsidePixel.r > maskedInsidePixel.g + 80, 'mask template should paint where region and mask overlap');
  assertNearColor(maskedOutsidePixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 2, 'mask template should keep pixels outside mask unchanged');
  assertNearColor(maskedRegionOnlyPixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 2, 'mask template should clip oversized region outside mask');

  const autoRegionResult = await createWhiteMockupRegionFromMask({
    mockupPath: whiteMockupPath,
    maskImagePath: maskPath,
    padding: 0.05
  });
  assert(autoRegionResult.success === true, 'mask auto region should succeed');
  assert(Array.isArray(autoRegionResult.region.points), 'mask auto region should return points');
  assert(autoRegionResult.region.points.length === 4, 'mask auto region should return four corner points');
  assert(autoRegionResult.source === 'mask-shape', 'mask auto region should prefer mask shape mode');
  assert(autoRegionResult.region.type === 'mask-shape', 'mask auto region should return mask shape region');
  assert(
    Array.isArray(autoRegionResult.region.shape.outlinePoints) && autoRegionResult.region.shape.outlinePoints.length >= 4,
    'mask auto region should return visible outline points'
  );
  assert(
    Array.isArray(autoRegionResult.region.shape.warpControls) && autoRegionResult.region.shape.warpControls.length >= 12,
    'mask auto region should return local warp controls'
  );
  const shiftedMaskRegion = {
    ...autoRegionResult.region,
    points: [
      [0, 0],
      [320, 0],
      [320, 260],
      [0, 260]
    ],
    shape: {
      ...autoRegionResult.region.shape,
      mappingBounds: {
        left: 0,
        top: 0,
        right: 320,
        bottom: 260
      }
    }
  };
  const warpedMaskRegion = {
    ...shiftedMaskRegion,
    shape: {
      ...shiftedMaskRegion.shape,
      warpControls: [
        {
          anchor: [200, 80],
          handle: [260, 80],
          radius: 140
        }
      ]
    }
  };
  const defaultMaskShapeImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: gradientDesignPath,
    template: {
      id: 'mask-shape-default',
      title: 'mask-shape-default',
      maskImagePath: maskPath,
      regions: [autoRegionResult.region]
    },
    outputFormat: 'png'
  });
  const shiftedMaskShapeImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: gradientDesignPath,
    template: {
      id: 'mask-shape-shifted',
      title: 'mask-shape-shifted',
      maskImagePath: maskPath,
      regions: [shiftedMaskRegion]
    },
    outputFormat: 'png'
  });
  const defaultMaskShapePixel = readRawImagePixel(defaultMaskShapeImage, 200, 80);
  const shiftedMaskShapePixel = readRawImagePixel(shiftedMaskShapeImage, 200, 80);
  assert(
    Math.abs(defaultMaskShapePixel.r - shiftedMaskShapePixel.r) > 8
      || Math.abs(defaultMaskShapePixel.b - shiftedMaskShapePixel.b) > 8,
    'mask shape mapping bounds should change sampled design placement'
  );
  const warpedMaskShapeImage = await renderWhiteMockupImage({
    mockupPath: whiteMockupPath,
    designPath: gradientDesignPath,
    template: {
      id: 'mask-shape-warped',
      title: 'mask-shape-warped',
      maskImagePath: maskPath,
      regions: [warpedMaskRegion]
    },
    outputFormat: 'png'
  });
  const warpedMaskShapePixel = readRawImagePixel(warpedMaskShapeImage, 200, 80);
  assert(
    Math.abs(shiftedMaskShapePixel.r - warpedMaskShapePixel.r) > 8
      || Math.abs(shiftedMaskShapePixel.b - warpedMaskShapePixel.b) > 8,
    'mask shape local warp controls should change sampled design placement'
  );
  assert(
    warpedMaskShapePixel.b > shiftedMaskShapePixel.b + 8
      && warpedMaskShapePixel.r < shiftedMaskShapePixel.r - 8,
    'outward right-side warp should sample closer to the design edge instead of the center'
  );

  const edgeRegionResult = await createWhiteMockupRegionFromMask({
    mockupPath: whiteMockupPath,
    maskImagePath: touchingEdgeMaskPath
  });
  assert(edgeRegionResult.success === true, 'touching-edge mask auto region should succeed');
  assert(edgeRegionResult.source === 'mask-shape', 'touching-edge mask should use mask shape mode');
  assert(
    edgeRegionResult.region.shape.bounds.width > 900,
    'mask shape mode should preserve wide masks touching the canvas edge'
  );

  const service = createPodSuiteToolService({
    whiteMockupTemplateStore: {
      async getTemplate(payload) {
        assert(payload.mockupPath === whiteMockupPath, 'service should request template by mockup path');
        return {
          success: true,
          template: createCustomTemplate(),
          isDefault: false
        };
      }
    }
  });
  const storeResult = await service.generateWhiteMockups({
    mockupPath: whiteMockupPath,
    imageDirectoryPath: inputDir,
    outputDirectoryPath: storeOutputDir,
    outputFormat: 'png'
  });

  assert(storeResult.success === true, 'service white mockup generation should succeed');
  assert(storeResult.generatedCount === 2, 'service should generate one output per input');
  const storeInsidePixel = await readImagePixel(storeResult.items[0].outputs[0].filePath, 80, 80);
  const storeOutsidePixel = await readImagePixel(storeResult.items[0].outputs[0].filePath, 260, 260);
  assert(storeInsidePixel.r > storeInsidePixel.g + 80, 'service should use stored template region');
  assertNearColor(storeOutsidePixel, {
    r: 245,
    g: 246,
    b: 248,
    a: 255
  }, 3, 'service should keep pixels outside stored template region unchanged');

  const psdTemplateRecords = [];
  const psdTemplateService = createPodSuiteToolService({
    psdTemplateStore: {
      async getTemplates() {
        return {
          success: true,
          templates: psdTemplateRecords
        };
      },
      async saveTemplate(payload) {
        psdTemplateRecords.push(payload.template);
        return {
          success: true,
          template: payload.template,
          templates: psdTemplateRecords,
          cloudSynced: false
        };
      },
      async deleteTemplate(payload) {
        return {
          success: true,
          templates: psdTemplateRecords.filter((template) => template.id !== payload.templateId),
          cloudSynced: false
        };
      }
    }
  });
  const psdTemplateSaveResult = await psdTemplateService.savePsdSmartObjectTemplate({
    template: {
      name: 'PSD template',
      imageDirectoryPath: inputDir,
      outputDirectoryPath: outputDir,
      mockups: [
        {
          psdPath: whiteMockupPath,
          smartObjectName: 'mock',
          sourceRotation: 'left',
          replacementMode: 'cover-canvas',
          outputSubdirName: 'mockup-a'
        }
      ]
    }
  });
  assert(psdTemplateSaveResult.success === true, 'service should expose PSD template save');
  const psdTemplateGetResult = await psdTemplateService.getPsdSmartObjectTemplates({});
  assert(psdTemplateGetResult.success === true, 'service should expose PSD template get');
  assert(
    psdTemplateGetResult.templates[0].mockups[0].sourceRotation === 'left',
    'service should preserve PSD source rotation in templates'
  );

  const previewResult = await service.renderWhiteMockupPreview({
    mockupPath: whiteMockupPath,
    designPath: designAPath,
    template: createCustomTemplate()
  });
  assert(previewResult.success === true, 'service white mockup preview should succeed');
  assert(previewResult.width === 934, 'preview width should match base');
  assert(previewResult.height === 933, 'preview height should match base');
  assert(
    typeof previewResult.dataUrl === 'string' && previewResult.dataUrl.startsWith('data:image/png;base64,'),
    'preview should return a png data url'
  );

  const guideSliceBoxes = buildSliceBoxes({
    width: 120,
    height: 300,
    options: {
      mode: 'guides'
    },
    guideMetadata: {
      horizontalGuides: [0, 120, 300]
    }
  });
  assert(guideSliceBoxes.length === 2, 'guide slicing should ignore edge guides and split by inner guides');
  assert(guideSliceBoxes[0].height === 120, 'guide first slice height should match guide position');

  const markedSliceBoxes = buildSliceBoxes({
    width: 120,
    height: 300,
    options: {
      mode: 'slices'
    },
    guideMetadata: {
      sliceBoxes: [
        {
          left: 0,
          top: 0,
          right: 120,
          bottom: 90
        },
        {
          left: 0,
          top: 90,
          right: 120,
          bottom: 210
        }
      ]
    }
  });
  assert(markedSliceBoxes.length === 2, 'marked slicing should use PSD slice rectangles');
  assert(markedSliceBoxes[0].height === 90, 'marked first slice height should match PSD rectangle');
  assert(markedSliceBoxes[1].height === 120, 'marked second slice height should match PSD rectangle');

  const sliceSourcePath = path.join(tempRoot, 'slice-source.png');
  await createSolidPng(sliceSourcePath, 120, 300, {
    r: 80,
    g: 90,
    b: 100,
    alpha: 1
  });
  const sliceOutputPath = path.join(tempRoot, 'slice-output.png');
  const sliceOutputs = await writeImageSlices({
    inputPath: sliceSourcePath,
    outputPath: sliceOutputPath,
    options: {
      mode: 'guides'
    },
    guideMetadata: {
      horizontalGuides: [100, 200]
    }
  });
  assert(sliceOutputs.length === 3, 'slice exporter should write one image per slice');
  const sliceMetadata = await sharp(sliceOutputs[1].filePath).metadata();
  assert(sliceMetadata.width === 120, 'slice output width should match source');
  assert(sliceMetadata.height === 100, 'slice output height should match configured range');
  const expectedSlicePaths = buildSliceOutputPaths({
    outputPath: sliceOutputPath,
    width: 120,
    height: 300,
    options: {
      mode: 'guides'
    },
    guideMetadata: {
      horizontalGuides: [100, 200]
    },
    outputFormat: 'png'
  });
  assert(expectedSlicePaths.length === 3, 'slice existence check should know expected output count');
  const completeSliceOutputs = await hasCompleteSliceOutputs({
    outputPath: sliceOutputPath,
    options: {
      mode: 'guides'
    },
    guideMetadata: {
      width: 120,
      height: 300,
      horizontalGuides: [100, 200]
    },
    outputFormat: 'png'
  });
  assert(completeSliceOutputs === true, 'complete slice outputs should be treated as existing');
  await fs.promises.rm(expectedSlicePaths[1], {
    force: true
  });
  const incompleteSliceOutputs = await hasCompleteSliceOutputs({
    outputPath: sliceOutputPath,
    options: {
      mode: 'guides'
    },
    guideMetadata: {
      width: 120,
      height: 300,
      horizontalGuides: [100, 200]
    },
    outputFormat: 'png'
  });
  assert(incompleteSliceOutputs === false, 'partial slice outputs should not be skipped as existing');

  const noSliceOutputs = await writeImageSlices({
    inputPath: sliceSourcePath,
    outputPath: path.join(tempRoot, 'slice-original.webp'),
    options: {
      mode: 'original'
    },
    guideMetadata: {
      horizontalGuides: [100, 200]
    },
    outputFormat: 'webp'
  });
  assert(noSliceOutputs.length === 0, 'original PSD export mode should not write slices');

  const webpSliceOutputs = await writeImageSlices({
    inputPath: sliceSourcePath,
    outputPath: path.join(tempRoot, 'slice-webp.webp'),
    options: {
      mode: 'slices'
    },
    guideMetadata: {
      sliceBoxes: [
        {
          left: 0,
          top: 0,
          right: 120,
          bottom: 150
        }
      ]
    },
    outputFormat: 'webp'
  });
  assert(webpSliceOutputs.length === 1, 'webp slice exporter should write marked slice output');
  assert(path.extname(webpSliceOutputs[0].filePath) === '.webp', 'slice exporter should preserve selected webp format');

  console.log('pod suite tool validation passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
