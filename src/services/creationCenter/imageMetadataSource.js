const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const METADATA_SOURCE_CACHE_MAX_ITEMS = 96;
const METADATA_SOURCE_CACHE_MAX_BYTES = 384 * 1024 * 1024;
const metadataSourceCache = new Map();
let metadataSourceCacheBytes = 0;

function normalizeText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeOutputFormat(value) {
  const format = normalizeText(value).toLowerCase();
  return ['jpg', 'jpeg'].includes(format)
    ? 'jpg'
    : ['png', 'webp'].includes(format)
      ? format
      : 'png';
}

function normalizeJpegQuality(value) {
  const quality = Number(value);

  if (!Number.isFinite(quality)) {
    return 100;
  }

  return Math.max(60, Math.min(100, Math.round(quality)));
}

async function hasReadableFile(filePath) {
  if (!normalizeText(filePath)) {
    return false;
  }

  const stat = await fs.promises.stat(filePath).catch(() => null);
  return Boolean(stat && stat.isFile());
}

function normalizeAbsolutePath(value) {
  const text = normalizeText(value);
  return text ? path.resolve(text) : '';
}

function getMetadataSourceCacheKey(filePath) {
  const absolutePath = normalizeAbsolutePath(filePath);
  return process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
}

function removeMetadataSourceCacheEntry(cacheKey) {
  const cached = metadataSourceCache.get(cacheKey);
  if (!cached) {
    return;
  }

  metadataSourceCache.delete(cacheKey);
  metadataSourceCacheBytes = Math.max(0, metadataSourceCacheBytes - (Number(cached.size) || 0));
}

function pruneMetadataSourceCache() {
  while (metadataSourceCache.size > METADATA_SOURCE_CACHE_MAX_ITEMS
    || metadataSourceCacheBytes > METADATA_SOURCE_CACHE_MAX_BYTES) {
    const firstKey = metadataSourceCache.keys().next().value;
    if (!firstKey) {
      break;
    }

    removeMetadataSourceCacheEntry(firstKey);
  }
}

async function getCachedMetadataSource(filePath) {
  const absolutePath = normalizeAbsolutePath(filePath);
  if (!absolutePath) {
    return null;
  }

  const stat = await fs.promises.stat(absolutePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    return null;
  }

  const cacheKey = getMetadataSourceCacheKey(absolutePath);
  const cached = metadataSourceCache.get(cacheKey);
  if (cached
    && cached.size === stat.size
    && cached.mtimeMs === stat.mtimeMs
    && Buffer.isBuffer(cached.buffer)
    && cached.metadata) {
    metadataSourceCache.delete(cacheKey);
    metadataSourceCache.set(cacheKey, cached);
    return cached;
  }

  removeMetadataSourceCacheEntry(cacheKey);
  const buffer = await fs.promises.readFile(absolutePath);
  const metadata = await sharp(buffer, {
    failOnError: false,
    limitInputPixels: false
  }).metadata().catch(() => ({}));
  const entry = {
    filePath: absolutePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    buffer,
    metadata: metadata && typeof metadata === 'object' ? metadata : {}
  };

  metadataSourceCache.set(cacheKey, entry);
  metadataSourceCacheBytes += stat.size;
  pruneMetadataSourceCache();
  return entry;
}

function buildMetadataWriteOptions(sourceMetadata) {
  const metadata = sourceMetadata && typeof sourceMetadata === 'object' ? sourceMetadata : {};
  const density = Number(metadata.density);
  const options = {
    orientation: 1
  };

  if (Number.isFinite(density) && density > 0) {
    options.density = density;
  }

  return options;
}

function applyNormalizedSourceMetadata(pipeline, sourceMetadata, width, height) {
  let outputPipeline = pipeline
    .withMetadata(buildMetadataWriteOptions(sourceMetadata))
    .withExifMerge({
      IFD0: {
        Orientation: '1'
      },
      ExifIFD: {
        PixelXDimension: String(width),
        PixelYDimension: String(height)
      }
    });
  const xmp = buildSourceXmpMetadata(sourceMetadata, width, height);

  if (xmp && typeof outputPipeline.withXmp === 'function') {
    outputPipeline = outputPipeline.withXmp(xmp);
  }

  return outputPipeline;
}

function readUInt16(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function writeUInt32(buffer, offset, value, littleEndian) {
  if (littleEndian) {
    buffer.writeUInt32LE(value, offset);
    return;
  }

  buffer.writeUInt32BE(value, offset);
}

function writeUInt16(buffer, offset, value, littleEndian) {
  if (littleEndian) {
    buffer.writeUInt16LE(value, offset);
    return;
  }

  buffer.writeUInt16BE(value, offset);
}

function getIfdInfo(buffer, tiffStart, ifdOffset, segmentEnd) {
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart < tiffStart || ifdStart + 2 > segmentEnd) {
    return null;
  }

  const endianMarker = buffer.toString('ascii', tiffStart, tiffStart + 2);
  const littleEndian = endianMarker === 'II';
  const entryCount = readUInt16(buffer, ifdStart, littleEndian);
  const nextIfdOffsetPosition = ifdStart + 2 + (entryCount * 12);
  if (nextIfdOffsetPosition + 4 > segmentEnd) {
    return null;
  }

  return {
    ifdStart,
    entryCount,
    nextIfdOffsetPosition
  };
}

function findIfdEntry(buffer, ifdInfo, tag, littleEndian) {
  if (!ifdInfo) {
    return null;
  }

  for (let index = 0; index < ifdInfo.entryCount; index += 1) {
    const entryOffset = ifdInfo.ifdStart + 2 + (index * 12);
    if (readUInt16(buffer, entryOffset, littleEndian) === tag) {
      return {
        offset: entryOffset,
        type: readUInt16(buffer, entryOffset + 2, littleEndian),
        count: readUInt32(buffer, entryOffset + 4, littleEndian)
      };
    }
  }

  return null;
}

function readIfdScalar(buffer, entry, littleEndian) {
  if (!entry || entry.count !== 1) {
    return 0;
  }

  if (entry.type === 3) {
    return readUInt16(buffer, entry.offset + 8, littleEndian);
  }

  if (entry.type === 4) {
    return readUInt32(buffer, entry.offset + 8, littleEndian);
  }

  return 0;
}

function readIfdText(buffer, entry, littleEndian, tiffStart, segmentEnd) {
  if (!entry || entry.type !== 2 || !entry.count) {
    return '';
  }

  const byteLength = Math.max(0, Math.round(Number(entry.count) || 0));
  const valueStart = byteLength <= 4
    ? entry.offset + 8
    : tiffStart + readUInt32(buffer, entry.offset + 8, littleEndian);
  const valueEnd = valueStart + byteLength;

  if (valueStart < tiffStart || valueEnd > segmentEnd || valueStart >= valueEnd) {
    return '';
  }

  return normalizeText(buffer.toString('utf8', valueStart, valueEnd).replace(/\u0000+$/g, ''));
}

function readIfdTextTag(buffer, ifdInfo, tag, littleEndian, tiffStart, segmentEnd) {
  return readIfdText(buffer, findIfdEntry(buffer, ifdInfo, tag, littleEndian), littleEndian, tiffStart, segmentEnd);
}

function getLinkedIfdInfo(buffer, ifdInfo, tag, littleEndian, tiffStart, segmentEnd) {
  const entry = findIfdEntry(buffer, ifdInfo, tag, littleEndian);
  const ifdOffset = readIfdScalar(buffer, entry, littleEndian);

  return ifdOffset ? getIfdInfo(buffer, tiffStart, ifdOffset, segmentEnd) : null;
}

function writeIfdScalar(buffer, entry, value, littleEndian) {
  if (!entry || entry.count !== 1) {
    return false;
  }

  if (entry.type === 3) {
    writeUInt16(buffer, entry.offset + 8, Math.max(0, Math.min(0xFFFF, Math.round(value))), littleEndian);
    writeUInt16(buffer, entry.offset + 10, 0, littleEndian);
    return true;
  }

  if (entry.type === 4) {
    writeUInt32(buffer, entry.offset + 8, Math.max(0, Math.round(value)), littleEndian);
    return true;
  }

  return false;
}

function getExifTiffContext(buffer, exifDataStart, segmentEnd) {
  const tiffStart = exifDataStart + 6;
  if (tiffStart + 8 > segmentEnd) {
    return null;
  }

  const endianMarker = buffer.toString('ascii', tiffStart, tiffStart + 2);
  const littleEndian = endianMarker === 'II';
  if (!littleEndian && endianMarker !== 'MM') {
    return null;
  }

  if (readUInt16(buffer, tiffStart + 2, littleEndian) !== 42) {
    return null;
  }

  const firstIfdOffset = readUInt32(buffer, tiffStart + 4, littleEndian);
  const ifd0 = getIfdInfo(buffer, tiffStart, firstIfdOffset, segmentEnd);
  if (!ifd0) {
    return null;
  }

  return {
    tiffStart,
    littleEndian,
    ifd0
  };
}

function clearExifThumbnailDirectory(buffer, exifDataStart, segmentEnd) {
  const context = getExifTiffContext(buffer, exifDataStart, segmentEnd);
  if (!context) {
    return false;
  }

  const nextIfdOffset = readUInt32(buffer, context.ifd0.nextIfdOffsetPosition, context.littleEndian);
  if (!nextIfdOffset || context.tiffStart + nextIfdOffset >= segmentEnd) {
    return false;
  }

  writeUInt32(buffer, context.ifd0.nextIfdOffsetPosition, 0, context.littleEndian);
  return true;
}

function getJpegExifThumbnailLocation(buffer, exifDataStart, segmentEnd) {
  const context = getExifTiffContext(buffer, exifDataStart, segmentEnd);
  if (!context) {
    return null;
  }

  const nextIfdOffset = readUInt32(buffer, context.ifd0.nextIfdOffsetPosition, context.littleEndian);
  if (!nextIfdOffset) {
    return null;
  }

  const ifd1 = getIfdInfo(buffer, context.tiffStart, nextIfdOffset, segmentEnd);
  if (!ifd1) {
    return null;
  }

  const offsetEntry = findIfdEntry(buffer, ifd1, 0x0201, context.littleEndian);
  const lengthEntry = findIfdEntry(buffer, ifd1, 0x0202, context.littleEndian);
  const thumbnailOffset = readIfdScalar(buffer, offsetEntry, context.littleEndian);
  const thumbnailLength = readIfdScalar(buffer, lengthEntry, context.littleEndian);
  const thumbnailStart = context.tiffStart + thumbnailOffset;

  if (!thumbnailOffset || !thumbnailLength || thumbnailStart < context.tiffStart || thumbnailStart + thumbnailLength > segmentEnd) {
    return null;
  }

  return {
    ...context,
    ifd1,
    thumbnailStart,
    thumbnailLength,
    lengthEntry,
    widthEntry: findIfdEntry(buffer, ifd1, 0x0100, context.littleEndian),
    heightEntry: findIfdEntry(buffer, ifd1, 0x0101, context.littleEndian)
  };
}

function findJpegExifSegment(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset += 1;
      continue;
    }

    while (offset < buffer.length && buffer[offset] === 0xFF) {
      offset += 1;
    }

    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xD9 || marker === 0xDA) {
      break;
    }

    if (offset + 2 > buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    const segmentDataStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      break;
    }

    const isExifSegment = marker === 0xE1
      && segmentDataStart + 6 <= segmentEnd
      && buffer.toString('ascii', segmentDataStart, segmentDataStart + 6) === 'Exif\u0000\u0000';
    if (isExifSegment) {
      return {
        segmentDataStart,
        segmentEnd
      };
    }

    offset = segmentEnd;
  }

  return null;
}

function parseExifTextFields(sourceMetadata) {
  const metadata = sourceMetadata && typeof sourceMetadata === 'object' ? sourceMetadata : {};
  const buffer = Buffer.isBuffer(metadata.exif) ? metadata.exif : null;
  if (!buffer || buffer.length < 14 || buffer.toString('ascii', 0, 6) !== 'Exif\u0000\u0000') {
    return {};
  }

  const context = getExifTiffContext(buffer, 0, buffer.length);
  if (!context) {
    return {};
  }

  const exifIfd = getLinkedIfdInfo(buffer, context.ifd0, 0x8769, context.littleEndian, context.tiffStart, buffer.length);

  return {
    make: readIfdTextTag(buffer, context.ifd0, 0x010F, context.littleEndian, context.tiffStart, buffer.length),
    model: readIfdTextTag(buffer, context.ifd0, 0x0110, context.littleEndian, context.tiffStart, buffer.length),
    software: readIfdTextTag(buffer, context.ifd0, 0x0131, context.littleEndian, context.tiffStart, buffer.length),
    dateTime: readIfdTextTag(buffer, context.ifd0, 0x0132, context.littleEndian, context.tiffStart, buffer.length),
    description: readIfdTextTag(buffer, context.ifd0, 0x010E, context.littleEndian, context.tiffStart, buffer.length),
    artist: readIfdTextTag(buffer, context.ifd0, 0x013B, context.littleEndian, context.tiffStart, buffer.length),
    copyright: readIfdTextTag(buffer, context.ifd0, 0x8298, context.littleEndian, context.tiffStart, buffer.length),
    dateTimeOriginal: exifIfd
      ? readIfdTextTag(buffer, exifIfd, 0x9003, context.littleEndian, context.tiffStart, buffer.length)
      : '',
    dateTimeDigitized: exifIfd
      ? readIfdTextTag(buffer, exifIfd, 0x9004, context.littleEndian, context.tiffStart, buffer.length)
      : '',
    lensMake: exifIfd
      ? readIfdTextTag(buffer, exifIfd, 0xA433, context.littleEndian, context.tiffStart, buffer.length)
      : '',
    lensModel: exifIfd
      ? readIfdTextTag(buffer, exifIfd, 0xA434, context.littleEndian, context.tiffStart, buffer.length)
      : ''
  };
}

function escapeXmlText(value) {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function exifDateToXmpDate(value) {
  const text = normalizeText(value);
  const match = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(text);

  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}` : text;
}

function buildSourceXmpMetadata(sourceMetadata, width, height) {
  const metadata = sourceMetadata && typeof sourceMetadata === 'object' ? sourceMetadata : {};
  if (normalizeText(metadata.xmpAsString)) {
    return metadata.xmpAsString;
  }

  const fields = parseExifTextFields(metadata);
  const createDate = exifDateToXmpDate(fields.dateTimeOriginal || fields.dateTimeDigitized || fields.dateTime);
  const modifyDate = exifDateToXmpDate(fields.dateTime);
  const xmpFields = [];

  if (fields.make) {
    xmpFields.push(`tiff:Make="${escapeXmlText(fields.make)}"`);
  }
  if (fields.model) {
    xmpFields.push(`tiff:Model="${escapeXmlText(fields.model)}"`);
  }
  if (fields.software) {
    xmpFields.push(`xmp:CreatorTool="${escapeXmlText(fields.software)}"`);
  }
  if (createDate) {
    xmpFields.push(`xmp:CreateDate="${escapeXmlText(createDate)}"`);
    xmpFields.push(`photoshop:DateCreated="${escapeXmlText(createDate)}"`);
    xmpFields.push(`exif:DateTimeOriginal="${escapeXmlText(createDate)}"`);
  }
  if (modifyDate) {
    xmpFields.push(`xmp:ModifyDate="${escapeXmlText(modifyDate)}"`);
  }
  if (width) {
    xmpFields.push(`exif:PixelXDimension="${Math.max(1, Math.round(Number(width) || 0))}"`);
  }
  if (height) {
    xmpFields.push(`exif:PixelYDimension="${Math.max(1, Math.round(Number(height) || 0))}"`);
  }

  if (!xmpFields.length) {
    return '';
  }

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" ${xmpFields.join(' ')} />
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;

  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data || ''), 'utf8');
  const chunk = Buffer.alloc(12 + dataBuffer.length);

  chunk.writeUInt32BE(dataBuffer.length, 0);
  typeBuffer.copy(chunk, 4);
  dataBuffer.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, dataBuffer])), 8 + dataBuffer.length);

  return chunk;
}

function createPngInternationalTextChunk(keyword, text) {
  const normalizedKeyword = normalizeText(keyword).replace(/\u0000/g, '').slice(0, 79);
  const normalizedText = normalizeText(text);

  if (!normalizedKeyword || !normalizedText) {
    return null;
  }

  return createPngChunk('iTXt', Buffer.concat([
    Buffer.from(normalizedKeyword, 'latin1'),
    Buffer.from([0, 0, 0, 0, 0]),
    Buffer.from(normalizedText, 'utf8')
  ]));
}

function buildPngTextMetadataChunks(sourceMetadata) {
  const fields = parseExifTextFields(sourceMetadata);
  const entries = [
    ['Creation Time', exifDateToXmpDate(fields.dateTimeOriginal || fields.dateTimeDigitized || fields.dateTime)],
    ['Make', fields.make],
    ['Model', fields.model],
    ['Software', fields.software],
    ['Description', fields.description],
    ['Author', fields.artist],
    ['Copyright', fields.copyright],
    ['Lens Make', fields.lensMake],
    ['Lens Model', fields.lensModel]
  ];

  return entries
    .map(([keyword, text]) => createPngInternationalTextChunk(keyword, text))
    .filter(Boolean);
}

function insertPngChunksBeforeIdat(buffer, chunks) {
  if (!Buffer.isBuffer(buffer) || !Array.isArray(chunks) || !chunks.length) {
    return buffer;
  }

  if (buffer.length < 16 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    return buffer;
  }

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const nextOffset = offset + 12 + length;

    if (nextOffset > buffer.length) {
      return buffer;
    }
    if (type === 'IDAT' || type === 'IEND') {
      return Buffer.concat([
        buffer.subarray(0, offset),
        ...chunks,
        buffer.subarray(offset)
      ]);
    }

    offset = nextOffset;
  }

  return buffer;
}

function removeJpegExifThumbnail(buffer) {
  const exifSegment = findJpegExifSegment(buffer);
  if (!exifSegment) {
    return buffer;
  }

  const outputBuffer = Buffer.from(buffer);
  if (clearExifThumbnailDirectory(outputBuffer, exifSegment.segmentDataStart, exifSegment.segmentEnd)) {
    return outputBuffer;
  }

  return buffer;
}

async function createOutputJpegThumbnail({
  rawBuffer,
  width,
  height,
  channels,
  maxBytes
}) {
  const normalizedMaxBytes = Math.max(0, Math.round(Number(maxBytes) || 0));
  if (!normalizedMaxBytes) {
    return null;
  }

  const sizeSteps = [320, 256, 200, 160, 128, 96, 64, 48];
  const qualitySteps = [82, 72, 62, 52, 42, 32, 24];

  for (const size of sizeSteps) {
    for (const quality of qualitySteps) {
      const buffer = await sharp(rawBuffer, {
        raw: {
          width,
          height,
          channels
        }
      })
        .flatten({
          background: '#ffffff'
        })
        .resize({
          width: size,
          height: size,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality
        })
        .toBuffer();

      if (buffer.length <= normalizedMaxBytes) {
        const metadata = await sharp(buffer, {
          failOnError: false,
          limitInputPixels: false
        }).metadata().catch(() => ({}));

        return {
          buffer,
          width: Math.max(1, Math.round(Number(metadata.width) || 0)),
          height: Math.max(1, Math.round(Number(metadata.height) || 0))
        };
      }
    }
  }

  return null;
}

function replaceJpegExifThumbnail(buffer, thumbnail) {
  const exifSegment = findJpegExifSegment(buffer);
  if (!exifSegment || !thumbnail || !Buffer.isBuffer(thumbnail.buffer)) {
    return buffer;
  }

  const location = getJpegExifThumbnailLocation(buffer, exifSegment.segmentDataStart, exifSegment.segmentEnd);
  if (!location) {
    return removeJpegExifThumbnail(buffer);
  }

  if (thumbnail.buffer.length > location.thumbnailLength) {
    return removeJpegExifThumbnail(buffer);
  }

  const outputBuffer = Buffer.from(buffer);
  thumbnail.buffer.copy(outputBuffer, location.thumbnailStart);
  outputBuffer.fill(0, location.thumbnailStart + thumbnail.buffer.length, location.thumbnailStart + location.thumbnailLength);
  writeIfdScalar(outputBuffer, location.lengthEntry, thumbnail.buffer.length, location.littleEndian);
  writeIfdScalar(outputBuffer, location.widthEntry, thumbnail.width, location.littleEndian);
  writeIfdScalar(outputBuffer, location.heightEntry, thumbnail.height, location.littleEndian);
  return outputBuffer;
}

async function syncJpegExifThumbnail(buffer, rawImage) {
  const exifSegment = findJpegExifSegment(buffer);
  if (!exifSegment) {
    return buffer;
  }

  const location = getJpegExifThumbnailLocation(buffer, exifSegment.segmentDataStart, exifSegment.segmentEnd);
  if (!location) {
    return removeJpegExifThumbnail(buffer);
  }

  const thumbnail = await createOutputJpegThumbnail({
    ...rawImage,
    maxBytes: location.thumbnailLength
  });

  if (!thumbnail) {
    return removeJpegExifThumbnail(buffer);
  }

  return replaceJpegExifThumbnail(buffer, thumbnail);
}

async function applyOutputFormatToBuffer(pipeline, outputFormat, options = {}) {
  const normalizedFormat = normalizeOutputFormat(outputFormat);
  const outputBuffer = await applyOutputFormat(pipeline, normalizedFormat, options).toBuffer();
  if (normalizedFormat === 'png' && options.sourceMetadata) {
    return insertPngChunksBeforeIdat(outputBuffer, buildPngTextMetadataChunks(options.sourceMetadata));
  }

  if (normalizedFormat !== 'jpg' || !options.rawImageForThumbnail) {
    return outputBuffer;
  }

  return syncJpegExifThumbnail(outputBuffer, options.rawImageForThumbnail);
}

function applyOutputFormat(pipeline, outputFormat, options = {}) {
  const normalizedFormat = normalizeOutputFormat(outputFormat);
  const jpegQuality = normalizeJpegQuality(options.jpegQuality);

  if (normalizedFormat === 'jpg') {
    return pipeline
      .flatten({
        background: '#ffffff'
      })
      .jpeg({
        quality: jpegQuality,
        mozjpeg: false,
        chromaSubsampling: '4:4:4',
        ...(options.jpegOptions && typeof options.jpegOptions === 'object' ? options.jpegOptions : {})
      });
  }

  if (normalizedFormat === 'webp') {
    if (jpegQuality >= 100) {
      return pipeline.webp({
        lossless: true,
        effort: 6,
        ...(options.webpOptions && typeof options.webpOptions === 'object' ? options.webpOptions : {})
      });
    }

    return pipeline.webp({
      quality: jpegQuality,
      alphaQuality: 100,
      effort: 6,
      smartSubsample: true,
      ...(options.webpOptions && typeof options.webpOptions === 'object' ? options.webpOptions : {})
    });
  }

  return pipeline.png({
    ...(options.pngOptions && typeof options.pngOptions === 'object' ? options.pngOptions : {})
  });
}

async function encodeRawPixelsWithOptionalMetadata({
  rawBuffer,
  width,
  height,
  channels = 4,
  outputFormat,
  metadataSourcePath,
  jpegQuality,
  pngOptions,
  jpegOptions,
  webpOptions
}) {
  const normalizedWidth = Math.max(1, Math.round(Number(width) || 0));
  const normalizedHeight = Math.max(1, Math.round(Number(height) || 0));
  const normalizedChannels = Math.max(1, Math.round(Number(channels) || 4));
  const metadataSource = await getCachedMetadataSource(metadataSourcePath);

  if (metadataSource) {
    try {
      const sourceMetadata = metadataSource.metadata || {};
      const metadataCarrier = applyNormalizedSourceMetadata(sharp(metadataSource.buffer, {
        failOnError: false,
        limitInputPixels: false
      })
        .rotate()
        .resize({
          width: normalizedWidth,
          height: normalizedHeight,
          fit: 'fill'
        })
        .toColorspace('srgb')
        .composite([{
          input: rawBuffer,
          raw: {
            width: normalizedWidth,
            height: normalizedHeight,
            channels: normalizedChannels
          },
          blend: 'source',
          left: 0,
          top: 0
        }]), sourceMetadata, normalizedWidth, normalizedHeight);

      return applyOutputFormatToBuffer(metadataCarrier, outputFormat, {
        jpegQuality,
        pngOptions,
        jpegOptions,
        webpOptions,
        sourceMetadata,
        rawImageForThumbnail: {
          rawBuffer,
          width: normalizedWidth,
          height: normalizedHeight,
          channels: normalizedChannels
        }
      });
    } catch (_error) {
      // Fall through to a clean export when the metadata carrier image cannot be decoded.
    }
  }

  const cleanPipeline = sharp(rawBuffer, {
    raw: {
      width: normalizedWidth,
      height: normalizedHeight,
      channels: normalizedChannels
    }
  });

  return applyOutputFormatToBuffer(cleanPipeline, outputFormat, {
    jpegQuality,
    pngOptions,
    jpegOptions,
    webpOptions
  });
}

async function encodeSharpWithOptionalMetadata({
  createPipeline,
  outputFormat,
  metadataSourcePath,
  jpegQuality,
  pngOptions,
  jpegOptions,
  webpOptions
}) {
  if (typeof createPipeline !== 'function') {
    throw new Error('Image pipeline is not ready.');
  }

  if (await hasReadableFile(metadataSourcePath)) {
    try {
      const result = await createPipeline()
        .ensureAlpha()
        .raw()
        .toBuffer({
          resolveWithObject: true
        });

      return encodeRawPixelsWithOptionalMetadata({
        rawBuffer: result.data,
        width: result.info.width,
        height: result.info.height,
        channels: result.info.channels,
        outputFormat,
        metadataSourcePath,
        jpegQuality,
        pngOptions,
        jpegOptions,
        webpOptions
      });
    } catch (_error) {
      // Fall through to a direct export if raw metadata preparation is too memory-heavy.
    }
  }

  return applyOutputFormatToBuffer(createPipeline(), outputFormat, {
    jpegQuality,
    pngOptions,
    jpegOptions,
    webpOptions
  });
}

module.exports = {
  encodeRawPixelsWithOptionalMetadata,
  encodeSharpWithOptionalMetadata
};
