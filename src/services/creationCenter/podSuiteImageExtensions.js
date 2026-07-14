const IMAGE_EXTENSIONS = Object.freeze([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.heic',
  '.heif'
]);

const IMAGE_EXTENSION_SET = new Set(IMAGE_EXTENSIONS);

module.exports = {
  IMAGE_EXTENSIONS,
  IMAGE_EXTENSION_SET
};
