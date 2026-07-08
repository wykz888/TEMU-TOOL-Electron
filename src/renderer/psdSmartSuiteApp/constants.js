export const PSD_REPLACEMENT_MODE_LABELS = Object.freeze({
  'cover-canvas': '铺满画布(等比裁边)',
  'contain-canvas': '匹配画布尺寸',
  'layer-bounds-transform': '按原图层边界(拉伸)'
});

export const PSD_EXPORT_MODE_LABELS = Object.freeze({
  original: '整图导出',
  guides: '按参考线切片',
  slices: '按PSD切片标记'
});

export const PSD_SOURCE_ROTATION_LABELS = Object.freeze({
  none: '不旋转',
  left: '向左旋转90°',
  right: '向右旋转90°'
});

export const PSD_PROGRESS_PHASE_LABELS = Object.freeze({
  start: '任务启动',
  'collect-sources': '正在读取素材目录',
  'sources-ready': '素材已读取',
  'mockup-start': '样机开始处理',
  'mockup-prepare': '正在准备样机',
  'mockup-local-parse': '正在识别PSD图层',
  'engine-start-wait': '等待引擎启动',
  'engine-start': '引擎开始启动',
  'mockup-loading': '正在打开PSD',
  'mockup-retry': '正在重新打开PSD',
  'mockup-ready': 'PSD已载入',
  'item-start': '素材开始处理',
  'smart-open': '正在打开智能对象',
  replace: '正在替换素材',
  export: '正在导出样机',
  'post-process-wait': '等待后处理队列',
  'post-process': '正在处理导出图',
  'post-process-drain': '正在等待切片保存完成',
  slice: '正在切片',
  'write-output': '正在写入文件',
  'item-skipped': '已存在，跳过',
  cleanup: '正在清理引擎缓存',
  'item-retry': '素材超时重试',
  'item-done': '素材已完成',
  'item-failed': '素材失败',
  'mockup-done': '样机已完成',
  'mockup-failed': '样机失败',
  complete: '任务完成'
});

export const ENGINE_CONCURRENCY_OPTIONS = [
  { value: 1, label: '单线程顺序执行' },
  { value: 2, label: '样机数并发×1' },
  { value: 3, label: '样机数并发×2' },
  { value: 4, label: '样机数并发×3' },
  { value: 5, label: '样机数并发×4' },
  { value: 6, label: '样机数并发×5' },
  { value: 8, label: '样机数并发×7' },
  { value: 12, label: '样机数并发×11' },
  { value: 16, label: '样机数并发×15' },
  { value: 24, label: '样机数并发×23' }
];

export const MAX_PSD_ACTIVE_ENGINE_COUNT = 24;

export const SETTINGS_STORAGE_KEY = 'pod-suite-tool-settings-v1';
