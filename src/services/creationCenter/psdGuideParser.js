const fs = require('node:fs');

const PSD_SIGNATURE = '8BPS';
const IMAGE_RESOURCE_SIGNATURES = new Set(['8BIM', '8B64']);
const GRID_AND_GUIDES_RESOURCE_ID = 1032;
const SLICES_RESOURCE_ID = 1050;

function readUInt16(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function pad2(value) {
  return value + (value % 2);
}

function readBigLength(buffer, offset) {
  const high = buffer.readUInt32BE(offset);
  const low = buffer.readUInt32BE(offset + 4);
  const value = (BigInt(high) << 32n) + BigInt(low);

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('PSD section is too large.');
  }

  return Number(value);
}

function assertPsdHeader(buffer) {
  if (buffer.length < 34 || buffer.subarray(0, 4).toString('latin1') !== PSD_SIGNATURE) {
    throw new Error('Unsupported PSD file.');
  }

  const version = readUInt16(buffer, 4);
  if (version !== 1 && version !== 2) {
    throw new Error('Unsupported PSD version.');
  }

  return {
    version,
    height: readUInt32(buffer, 14),
    width: readUInt32(buffer, 18)
  };
}

function parseGuidesResource(data) {
  if (!data || data.length < 16) {
    return {
      horizontal: [],
      vertical: []
    };
  }

  const guideCount = readUInt32(data, 12);
  const horizontal = [];
  const vertical = [];
  let offset = 16;

  for (let index = 0; index < guideCount && offset + 5 <= data.length; index += 1) {
    const position = readUInt32(data, offset) / 32;
    const direction = data[offset + 4];
    offset += 5;

    if (!Number.isFinite(position)) {
      continue;
    }

    if (direction === 1) {
      horizontal.push(position);
    } else {
      vertical.push(position);
    }
  }

  return {
    horizontal,
    vertical
  };
}

function readUnicodeString(data, offset) {
  if (!data || offset + 4 > data.length) {
    throw new Error('Invalid PSD unicode string.');
  }

  const length = readUInt32(data, offset);
  const start = offset + 4;
  const byteLength = length * 2;
  const end = start + byteLength;

  if (end > data.length) {
    throw new Error('Invalid PSD unicode string length.');
  }

  const charCodes = [];
  for (let currentOffset = start; currentOffset + 1 < end; currentOffset += 2) {
    const charCode = readUInt16(data, currentOffset);
    if (charCode) {
      charCodes.push(charCode);
    }
  }

  return {
    text: String.fromCharCode(...charCodes),
    nextOffset: end
  };
}

function normalizeSliceRecord(record, canvasWidth, canvasHeight) {
  if (!record || !record.id) {
    return null;
  }

  const left = Math.max(0, Math.min(canvasWidth, Math.round(Number(record.left) || 0)));
  const top = Math.max(0, Math.min(canvasHeight, Math.round(Number(record.top) || 0)));
  const right = Math.max(0, Math.min(canvasWidth, Math.round(Number(record.right) || 0)));
  const bottom = Math.max(0, Math.min(canvasHeight, Math.round(Number(record.bottom) || 0)));
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    id: record.id,
    name: record.name || '',
    left,
    top,
    right,
    bottom,
    width,
    height
  };
}

function readSliceRecord(data, offset) {
  if (offset + 12 > data.length) {
    throw new Error('Invalid PSD slice record.');
  }

  const id = readUInt32(data, offset);
  const groupId = readUInt32(data, offset + 4);
  const origin = readUInt32(data, offset + 8);
  let currentOffset = offset + 12;

  if (origin === 1) {
    if (currentOffset + 4 > data.length) {
      throw new Error('Invalid PSD slice layer id.');
    }
    currentOffset += 4;
  }

  const nameResult = readUnicodeString(data, currentOffset);
  currentOffset = nameResult.nextOffset;

  if (currentOffset + 20 > data.length) {
    throw new Error('Invalid PSD slice bounds.');
  }

  const type = readUInt32(data, currentOffset);
  const left = readUInt32(data, currentOffset + 4);
  const top = readUInt32(data, currentOffset + 8);
  const right = readUInt32(data, currentOffset + 12);
  const bottom = readUInt32(data, currentOffset + 16);
  currentOffset += 20;

  for (let index = 0; index < 4; index += 1) {
    const textResult = readUnicodeString(data, currentOffset);
    currentOffset = textResult.nextOffset;
  }

  if (currentOffset + 1 > data.length) {
    throw new Error('Invalid PSD slice html flag.');
  }
  currentOffset += 1;

  const cellTextResult = readUnicodeString(data, currentOffset);
  currentOffset = cellTextResult.nextOffset;

  if (currentOffset + 12 > data.length) {
    throw new Error('Invalid PSD slice footer.');
  }
  currentOffset += 12;

  return {
    record: {
      id,
      groupId,
      origin,
      type,
      name: nameResult.text,
      left,
      top,
      right,
      bottom
    },
    nextOffset: currentOffset
  };
}

function parseSlicesResource(data, canvasWidth, canvasHeight) {
  if (!data || data.length < 24) {
    return [];
  }

  const version = readUInt32(data, 0);
  if (version !== 6) {
    return [];
  }

  let offset = 20;
  const groupNameResult = readUnicodeString(data, offset);
  offset = groupNameResult.nextOffset;

  if (offset + 4 > data.length) {
    return [];
  }

  const sliceCount = Math.min(readUInt32(data, offset), 5000);
  offset += 4;

  const slices = [];
  for (let index = 0; index < sliceCount && offset < data.length; index += 1) {
    let result = null;
    try {
      result = readSliceRecord(data, offset);
      offset = result.nextOffset;
    } catch (_error) {
      break;
    }

    const sliceBox = normalizeSliceRecord(result.record, canvasWidth, canvasHeight);
    if (sliceBox) {
      slices.push(sliceBox);
    }
  }

  return slices
    .filter((sliceBox) => {
      return !(sliceBox.left === 0
        && sliceBox.top === 0
        && sliceBox.right === canvasWidth
        && sliceBox.bottom === canvasHeight);
    })
    .sort((left, right) => {
      if (left.top !== right.top) {
        return left.top - right.top;
      }
      if (left.left !== right.left) {
        return left.left - right.left;
      }
      return left.id - right.id;
    });
}

function parseImageResources(buffer, offset, length) {
  const end = Math.min(buffer.length, offset + length);
  let currentOffset = offset;
  const resources = [];

  while (currentOffset + 12 <= end) {
    const signature = buffer.subarray(currentOffset, currentOffset + 4).toString('latin1');
    if (!IMAGE_RESOURCE_SIGNATURES.has(signature)) {
      break;
    }

    const id = readUInt16(buffer, currentOffset + 4);
    currentOffset += 6;

    const nameLength = currentOffset < end ? buffer[currentOffset] : 0;
    currentOffset += pad2(1 + nameLength);
    if (currentOffset + 4 > end) {
      break;
    }

    const dataLength = readUInt32(buffer, currentOffset);
    currentOffset += 4;
    const dataStart = currentOffset;
    const dataEnd = dataStart + dataLength;
    if (dataEnd > end) {
      break;
    }

    resources.push({
      id,
      data: buffer.subarray(dataStart, dataEnd)
    });
    currentOffset = dataStart + pad2(dataLength);
  }

  return resources;
}

async function parsePsdGuideMetadata(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const header = assertPsdHeader(buffer);
  const readLength = (offset) => header.version === 2 ? readBigLength(buffer, offset) : readUInt32(buffer, offset);
  let offset = 26;

  const colorModeLength = readUInt32(buffer, offset);
  offset += 4 + colorModeLength;

  const imageResourceLength = readLength(offset);
  offset += header.version === 2 ? 8 : 4;
  const imageResources = parseImageResources(buffer, offset, imageResourceLength);
  const guideResource = imageResources.find((resource) => resource.id === GRID_AND_GUIDES_RESOURCE_ID);
  const slicesResource = imageResources.find((resource) => resource.id === SLICES_RESOURCE_ID);
  const guides = guideResource ? parseGuidesResource(guideResource.data) : {
    horizontal: [],
    vertical: []
  };
  const sliceBoxes = slicesResource
    ? parseSlicesResource(slicesResource.data, header.width, header.height)
    : [];

  return {
    width: header.width,
    height: header.height,
    horizontalGuides: guides.horizontal,
    verticalGuides: guides.vertical,
    sliceBoxes
  };
}

module.exports = {
  parsePsdGuideMetadata,
  parseSlicesResource
};
