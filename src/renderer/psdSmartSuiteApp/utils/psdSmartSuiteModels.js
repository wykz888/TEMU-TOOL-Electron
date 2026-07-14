import { MAX_PSD_ACTIVE_ENGINE_COUNT } from '../constants.js';

const PSD_EXPORT_MODES = Object.freeze(['original', 'guides', 'slices']);
const PSD_OUTPUT_FORMATS = Object.freeze(['png', 'jpg', 'webp']);
const PSD_SOURCE_ROTATIONS = Object.freeze(['left', 'right']);
const PSD_REPLACEMENT_MODES = Object.freeze([
  'cover-canvas',
  'contain-canvas',
  'layer-bounds-transform'
]);

const DEFAULT_SMART_OBJECT_NAME = '\u63D2\u753B#';

export function createEntityId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

export function clampConcurrency(value) {
  const nextValue = Math.round(Number(value) || 2);
  return Math.max(1, Math.min(MAX_PSD_ACTIVE_ENGINE_COUNT, nextValue));
}

export function normalizePsdExportMode(value) {
  const nextValue = normalizeText(value);
  return PSD_EXPORT_MODES.includes(nextValue) ? nextValue : 'original';
}

export function normalizePsdOutputFormat(value) {
  const nextValue = normalizeText(value).toLowerCase();
  return PSD_OUTPUT_FORMATS.includes(nextValue) ? nextValue : 'png';
}

export function normalizePsdImageQuality(value) {
  const nextValue = Math.round(Number(value) || 100);
  return Math.max(60, Math.min(100, nextValue));
}

export function normalizeMockup(mockup) {
  const source = mockup && typeof mockup === 'object' ? mockup : {};

  return {
    id: source.id ? source.id : createEntityId('psd_mockup'),
    psdPath: source.psdPath ? String(source.psdPath) : '',
    smartObjectName: source.smartObjectName ? String(source.smartObjectName) : DEFAULT_SMART_OBJECT_NAME,
    sourceRotation: PSD_SOURCE_ROTATIONS.includes(source.sourceRotation)
      ? source.sourceRotation
      : 'none',
    replacementMode: PSD_REPLACEMENT_MODES.includes(source.replacementMode)
      ? source.replacementMode
      : 'cover-canvas',
    exportMode: normalizePsdExportMode(source.exportMode),
    outputDirectoryPath: source.outputDirectoryPath ? String(source.outputDirectoryPath) : '',
    outputSubdirName: normalizeText(source.outputSubdirName),
    outputFormat: normalizePsdOutputFormat(source.outputFormat),
    imageQuality: normalizePsdImageQuality(source.imageQuality)
  };
}

export function normalizeMockupList(mockups) {
  const source = Array.isArray(mockups) && mockups.length ? mockups : [{}];
  return source.map((item) => normalizeMockup(item));
}

export function buildPsdSmartSuiteRunPayload({
  runId,
  config,
  mockups,
  sourceFiles
}) {
  const runtimeConfig = config && typeof config === 'object' ? config : {};
  const normalizedMockups = normalizeMockupList(mockups);

  return {
    runId,
    imageDirectoryPath: runtimeConfig.psdImageDirectoryPath || '',
    sourceFiles: Array.isArray(sourceFiles) ? sourceFiles : [],
    metadataSourcePath: runtimeConfig.psdMetadataSourcePath || '',
    metadataSourceDirectoryPath: runtimeConfig.psdMetadataSourceDirectoryPath || '',
    showEngineWindow: runtimeConfig.psdEngineWindowMode === 'visible',
    engineWindowMode: runtimeConfig.psdEngineWindowMode === 'visible' ? 'visible' : 'hidden',
    engineConcurrency: clampConcurrency(runtimeConfig.psdEngineConcurrency),
    skipExistingOutputs: runtimeConfig.psdSkipExistingOutputs,
    psdMockups: normalizedMockups,
    mockups: normalizedMockups
  };
}
