const { screen } = require('electron');

const TARGET_SIZE = Object.freeze({
  width: 1500,
  height: 900
});

const MIN_SIZE = Object.freeze({
  width: 700,
  height: 560
});

const WINDOW_MARGIN = Object.freeze({
  horizontal: 32,
  vertical: 32
});

function clampWindowSize(targetSize, workAreaSize, margin, minSize) {
  const preferredSize = Math.max(minSize, workAreaSize - margin);

  return Math.min(targetSize, workAreaSize, preferredSize);
}

function getAdaptiveMainWindowBounds() {
  const { workAreaSize } = screen.getPrimaryDisplay();

  return {
    width: clampWindowSize(
      TARGET_SIZE.width,
      workAreaSize.width,
      WINDOW_MARGIN.horizontal,
      MIN_SIZE.width
    ),
    height: clampWindowSize(
      TARGET_SIZE.height,
      workAreaSize.height,
      WINDOW_MARGIN.vertical,
      MIN_SIZE.height
    )
  };
}

module.exports = {
  getAdaptiveMainWindowBounds
};

