const { DEFAULT_TEMU_USER_AGENT } = require('../services/shopManagement/defaultUserAgent');

function normalizeText(value) {
  return String(value || '').trim();
}

function parseChromeVersion(userAgent) {
  const versionMatch = /Chrome\/([0-9.]+)/i.exec(normalizeText(userAgent));
  const fallbackVersionMatch = /Chrome\/([0-9.]+)/i.exec(DEFAULT_TEMU_USER_AGENT);
  const fallbackFullVersion = fallbackVersionMatch ? fallbackVersionMatch[1] : '146.0.7680.179';
  const fullVersion = versionMatch ? versionMatch[1] : fallbackFullVersion;
  const majorVersion = fullVersion.split('.')[0] || '146';

  return {
    majorVersion,
    fullVersion
  };
}

function normalizePlatform(platform) {
  const rawPlatform = normalizeText(platform);

  if (/win/i.test(rawPlatform)) {
    return 'Windows';
  }

  if (/mac/i.test(rawPlatform)) {
    return 'macOS';
  }

  if (/linux/i.test(rawPlatform)) {
    return 'Linux';
  }

  if (/android/i.test(rawPlatform)) {
    return 'Android';
  }

  return rawPlatform || 'Windows';
}

function detectArchitecture(userAgent) {
  const normalizedUserAgent = normalizeText(userAgent);

  if (/arm64|aarch64/i.test(normalizedUserAgent)) {
    return {
      architecture: 'arm',
      bitness: '64',
      wow64: false
    };
  }

  if (/wow64/i.test(normalizedUserAgent)) {
    return {
      architecture: 'x86',
      bitness: '64',
      wow64: true
    };
  }

  if (/win64|x64|amd64|x86_64/i.test(normalizedUserAgent)) {
    return {
      architecture: 'x86',
      bitness: '64',
      wow64: false
    };
  }

  return {
    architecture: 'x86',
    bitness: '32',
    wow64: false
  };
}

function buildBrandEntries(majorVersion, fullVersion) {
  return {
    brands: [
      { brand: 'Not A(Brand', version: '99' },
      { brand: 'Chromium', version: majorVersion },
      { brand: 'Google Chrome', version: majorVersion }
    ],
    fullVersionList: [
      { brand: 'Not A(Brand', version: '99.0.0.0' },
      { brand: 'Chromium', version: fullVersion },
      { brand: 'Google Chrome', version: fullVersion }
    ]
  };
}

function formatBrandsHeader(brands) {
  return brands
    .map((brandEntry) => `"${brandEntry.brand.replace(/"/g, '\\"')}";v="${brandEntry.version}"`)
    .join(', ');
}

function buildUserAgentMetadata(fingerprintConfig) {
  const userAgent = normalizeText(fingerprintConfig && fingerprintConfig.userAgent);
  const platform = normalizePlatform(fingerprintConfig && fingerprintConfig.platform);
  const { majorVersion, fullVersion } = parseChromeVersion(userAgent);
  const { architecture, bitness, wow64 } = detectArchitecture(userAgent);
  const brandEntries = buildBrandEntries(majorVersion, fullVersion);

  return {
    brands: brandEntries.brands,
    fullVersionList: brandEntries.fullVersionList,
    mobile: false,
    platform,
    platformVersion: '10.0.0',
    architecture,
    bitness,
    wow64,
    model: '',
    uaFullVersion: fullVersion
  };
}

function buildAcceptLanguageHeader(languages, fallbackLanguage) {
  const normalizedLanguages = []
    .concat(Array.isArray(languages) ? languages : [])
    .concat(normalizeText(fallbackLanguage))
    .map(normalizeText)
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

  if (normalizedLanguages.length === 0) {
    return 'zh-CN,zh;q=0.9,en-US;q=0.8';
  }

  return normalizedLanguages
    .map((language, index) => {
      if (index === 0) {
        return language;
      }

      const qValue = Math.max(0.1, 1 - (index * 0.1));
      return `${language};q=${qValue.toFixed(1)}`;
    })
    .join(', ');
}

function buildClientHintHeaders(fingerprintConfig) {
  const metadata = buildUserAgentMetadata(fingerprintConfig);

  return {
    'Sec-CH-UA': formatBrandsHeader(metadata.brands),
    'Sec-CH-UA-Full-Version-List': formatBrandsHeader(metadata.fullVersionList),
    'Sec-CH-UA-Mobile': metadata.mobile ? '?1' : '?0',
    'Sec-CH-UA-Platform': `"${metadata.platform}"`,
    'Sec-CH-UA-Platform-Version': `"${metadata.platformVersion}"`,
    'Sec-CH-UA-Arch': `"${metadata.architecture}"`,
    'Sec-CH-UA-Bitness': `"${metadata.bitness}"`,
    'Sec-CH-UA-Wow64': metadata.wow64 ? '?1' : '?0'
  };
}

function buildUserAgentHeaders(fingerprintConfig) {
  return {
    'User-Agent': normalizeText(fingerprintConfig && fingerprintConfig.userAgent),
    'Accept-Language': buildAcceptLanguageHeader(
      fingerprintConfig && fingerprintConfig.languages,
      fingerprintConfig && fingerprintConfig.language
    ),
    ...buildClientHintHeaders(fingerprintConfig)
  };
}

module.exports = {
  normalizeText,
  buildUserAgentMetadata,
  buildAcceptLanguageHeader,
  buildClientHintHeaders,
  buildUserAgentHeaders
};
