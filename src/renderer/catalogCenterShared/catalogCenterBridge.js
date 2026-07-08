function getTemuApp() {
  if (window.temuApp && typeof window.temuApp === 'object') {
    return window.temuApp;
  }

  throw new Error('\u7a0b\u5e8f\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\u3002');
}

function getFeatureCenterBridge() {
  const temuApp = getTemuApp();

  if (temuApp.featureCenter && typeof temuApp.featureCenter === 'object') {
    return temuApp.featureCenter;
  }

  throw new Error('\u529f\u80fd\u4e2d\u5fc3\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002');
}

function getCreationCenterBridge() {
  const temuApp = getTemuApp();

  if (temuApp.creationCenter && typeof temuApp.creationCenter === 'object') {
    return temuApp.creationCenter;
  }

  throw new Error('\u521b\u4f5c\u4e2d\u5fc3\u901a\u4fe1\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u8f6f\u4ef6\u3002');
}

export function getCatalogCenterBridge(centerType) {
  return centerType === 'creation'
    ? getCreationCenterBridge()
    : getFeatureCenterBridge();
}
