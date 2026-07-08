const fs = require('node:fs');

function readUInt16(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function readInt16(buffer, offset) {
  return buffer.readInt16BE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function readInt32(buffer, offset) {
  return buffer.readInt32BE(offset);
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

function pad4(value) {
  return (value + 3) & ~3;
}

function pad2(value) {
  return value + (value % 2);
}

function normalizeName(value) {
  return String(value == null ? '' : value).trim();
}

function namesEqual(left, right) {
  return normalizeName(left) === normalizeName(right);
}

function readPascalName(buffer, offset, limit) {
  if (offset >= limit) {
    return {
      name: '',
      nextOffset: offset
    };
  }

  const length = buffer[offset];
  const nameStart = offset + 1;
  const nameEnd = Math.min(nameStart + length, limit);
  const raw = buffer.subarray(nameStart, nameEnd);
  let name = '';

  try {
    name = raw.toString('latin1');
  } catch (_error) {
    name = '';
  }

  return {
    name,
    nextOffset: offset + pad4(1 + length)
  };
}

function readUnicodeName(buffer, offset, length) {
  if (length < 4) {
    return '';
  }

  const charCount = readUInt32(buffer, offset);
  const textStart = offset + 4;
  const textEnd = Math.min(textStart + (charCount * 2), offset + length);

  if (textEnd <= textStart) {
    return '';
  }

  let text = '';
  for (let index = textStart; index + 1 < textEnd; index += 2) {
    const code = buffer.readUInt16BE(index);
    if (code === 0) {
      continue;
    }
    text += String.fromCharCode(code);
  }

  return text;
}

function readLayerAdditionalInfo(buffer, start, end, layer) {
  let offset = start;

  while (offset + 12 <= end) {
    const signature = buffer.subarray(offset, offset + 4).toString('latin1');
    const key = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    offset += 8;

    if (signature !== '8BIM' && signature !== '8B64') {
      break;
    }

    const length = readUInt32(buffer, offset);
    offset += 4;
    const dataStart = offset;
    const dataEnd = dataStart + length;

    if (dataEnd > end) {
      break;
    }

    layer.keys.push(key);

    if (key === 'luni') {
      layer.unicodeName = readUnicodeName(buffer, dataStart, length);
    } else if (key === 'lyid' && length >= 4) {
      layer.id = readUInt32(buffer, dataStart);
    } else if (key === 'PlLd' || key === 'SoLd') {
      layer.isSmartObject = true;
    }

    offset = dataStart + pad2(length);
  }
}

async function parsePsdLayerMetadata(filePath) {
  const buffer = await fs.promises.readFile(filePath);

  if (buffer.length < 34 || buffer.subarray(0, 4).toString('latin1') !== '8BPS') {
    throw new Error('Unsupported PSD file.');
  }

  const version = readUInt16(buffer, 4);
  if (version !== 1 && version !== 2) {
    throw new Error('Unsupported PSD version.');
  }

  const lengthSize = version === 2 ? 8 : 4;
  const readLength = (offset) => version === 2 ? readBigLength(buffer, offset) : readUInt32(buffer, offset);
  let offset = 26;

  const colorModeLength = readUInt32(buffer, offset);
  offset += 4 + colorModeLength;

  const imageResourceLength = readUInt32(buffer, offset);
  offset += 4 + imageResourceLength;

  const layerMaskLength = readLength(offset);
  offset += lengthSize;
  const layerMaskEnd = offset + layerMaskLength;
  if (layerMaskLength <= 0 || layerMaskEnd > buffer.length) {
    return [];
  }

  const layerInfoLength = readLength(offset);
  offset += lengthSize;
  if (layerInfoLength <= 0 || offset + layerInfoLength > layerMaskEnd) {
    return [];
  }

  let layerCount = readInt16(buffer, offset);
  offset += 2;
  layerCount = Math.abs(layerCount);

  const layers = [];
  for (let index = 0; index < layerCount; index += 1) {
    const top = readInt32(buffer, offset);
    const left = readInt32(buffer, offset + 4);
    const bottom = readInt32(buffer, offset + 8);
    const right = readInt32(buffer, offset + 12);
    offset += 16;

    const channelCount = readUInt16(buffer, offset);
    offset += 2;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      offset += 2;
      offset += lengthSize;
    }

    const blendMode = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    offset += 12;

    const extraLength = readUInt32(buffer, offset);
    offset += 4;
    const extraStart = offset;
    const extraEnd = extraStart + extraLength;
    if (extraEnd > buffer.length) {
      break;
    }

    const maskLength = readUInt32(buffer, offset);
    offset += 4 + maskLength;

    const blendingRangeLength = readUInt32(buffer, offset);
    offset += 4 + blendingRangeLength;

    const pascal = readPascalName(buffer, offset, extraEnd);
    offset = pascal.nextOffset;

    const layer = {
      index,
      id: null,
      name: pascal.name,
      unicodeName: '',
      isSmartObject: false,
      blendMode,
      bounds: {
        left,
        top,
        right,
        bottom
      },
      keys: []
    };

    readLayerAdditionalInfo(buffer, offset, extraEnd, layer);
    layers.push(layer);
    offset = extraEnd;
  }

  return layers;
}

async function findPsdLayerByName(filePath, layerName) {
  const targetName = normalizeName(layerName);
  const layers = await parsePsdLayerMetadata(filePath);

  return layers.find((layer) => {
    return namesEqual(layer.unicodeName, targetName) || namesEqual(layer.name, targetName);
  }) || null;
}

module.exports = {
  findPsdLayerByName,
  parsePsdLayerMetadata
};
