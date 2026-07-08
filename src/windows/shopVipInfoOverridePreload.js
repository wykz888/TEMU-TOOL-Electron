(() => {
  const VIP_INFO_HOST = 'www.tupianfanyi.com'
  const VIP_INFO_PATH = '/users/getUserVipInfo'
  const INSTALL_FLAG = '__temuToolboxVipInfoOverrideInstalled'
  const RESPONSE_FLAG = '__temuToolboxVipInfoResponsePatched'
  const REQUEST_URL_KEY = '__temuToolboxVipInfoRequestUrl'

  function installVipInfoOverrideRuntime(vipInfoHost, vipInfoPath, installFlag, responseFlag, requestUrlKey) {
    const target = globalThis
    const FETCH_FLAG = '__temuToolboxVipInfoFetchWrapped'
    const XHR_FLAG = '__temuToolboxVipInfoXhrWrapped'

    if (!target || target[installFlag] === true) {
      return
    }

    function normalizeText(value) {
      return typeof value === 'string' ? value.trim() : String(value || '').trim()
    }

    function defineValue(propertyTarget, propertyName, value) {
      if (!propertyTarget || !propertyName) {
        return false
      }

      try {
        Object.defineProperty(propertyTarget, propertyName, {
          configurable: true,
          enumerable: false,
          writable: true,
          value
        })
        return true
      } catch (_error) {
        // Ignore defineProperty failures and fall back to plain assignment.
      }

      try {
        propertyTarget[propertyName] = value
        return true
      } catch (_error) {
        return false
      }
    }

    function resolveBaseHref() {
      if (target.location && typeof target.location.href === 'string' && target.location.href) {
        return target.location.href
      }

      return `https://${vipInfoHost}/`
    }

    function resolveRequestUrl(resource) {
      const rawValue =
        resource && typeof resource.url === 'string'
          ? resource.url
          : resource && typeof resource.href === 'string'
            ? resource.href
            : normalizeText(resource)

      if (!rawValue) {
        return ''
      }

      try {
        return new URL(rawValue, resolveBaseHref()).href
      } catch (_error) {
        return rawValue
      }
    }

    function matchesVipInfoUrl(resource) {
      const resolvedUrl = resolveRequestUrl(resource)

      if (!resolvedUrl) {
        return false
      }

      try {
        const parsedUrl = new URL(resolvedUrl, resolveBaseHref())
        return (
          parsedUrl.hostname.toLowerCase() === vipInfoHost
          && parsedUrl.pathname === vipInfoPath
        )
      } catch (_error) {
        return false
      }
    }

    function rewriteVipTypeDeep(value) {
      if (Array.isArray(value)) {
        return value.map((item) => rewriteVipTypeDeep(item))
      }

      if (!value || typeof value !== 'object') {
        return value
      }

      const nextValue = {}

      Object.keys(value).forEach((key) => {
        if (key === 'vipType') {
          nextValue[key] = '2'
          return
        }

        nextValue[key] = rewriteVipTypeDeep(value[key])
      })

      return nextValue
    }

    function rewriteVipInfoJsonText(text) {
      if (typeof text !== 'string' || !text) {
        return text
      }

      try {
        return JSON.stringify(rewriteVipTypeDeep(JSON.parse(text)))
      } catch (_error) {
        return text
      }
    }

    function patchFetchResponse(response) {
      if (!response || typeof response !== 'object' || response[responseFlag] === true) {
        return response
      }

      const nativeText = typeof response.text === 'function' ? response.text.bind(response) : null
      const nativeJson = typeof response.json === 'function' ? response.json.bind(response) : null
      const nativeClone = typeof response.clone === 'function' ? response.clone.bind(response) : null

      if (nativeText) {
        defineValue(response, 'text', function patchedText() {
          return nativeText().then((text) => rewriteVipInfoJsonText(text))
        })
      }

      if (nativeJson) {
        defineValue(response, 'json', function patchedJson() {
          return nativeJson().then((value) => rewriteVipTypeDeep(value))
        })
      } else if (nativeText) {
        defineValue(response, 'json', function patchedJsonFallback() {
          return nativeText()
            .then((text) => rewriteVipInfoJsonText(text))
            .then((text) => JSON.parse(text))
        })
      }

      if (nativeClone) {
        defineValue(response, 'clone', function patchedClone() {
          return patchFetchResponse(nativeClone())
        })
      }

      defineValue(response, responseFlag, true)
      return response
    }

    function installFetchOverride() {
      if (typeof target.fetch !== 'function') {
        return
      }

      const nativeFetch = target.fetch

      if (nativeFetch && nativeFetch[FETCH_FLAG] === true) {
        return
      }

      const patchedFetch = async function patchedFetch(resource) {
        const response = await nativeFetch.apply(this, arguments)

        if (!matchesVipInfoUrl(resource)) {
          return response
        }

        return patchFetchResponse(response)
      }

      defineValue(patchedFetch, FETCH_FLAG, true)
      defineValue(target, 'fetch', patchedFetch)
    }

    function installXhrOverride() {
      if (typeof target.XMLHttpRequest !== 'function') {
        return
      }

      const xhrPrototype = target.XMLHttpRequest.prototype

      if (!xhrPrototype || xhrPrototype[XHR_FLAG] === true || typeof xhrPrototype.open !== 'function') {
        return
      }

      const nativeOpen = xhrPrototype.open
      const nativeResponseTextDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, 'responseText')
      const nativeResponseDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, 'response')

      defineValue(xhrPrototype, 'open', function patchedOpen(method, url) {
        this[requestUrlKey] = resolveRequestUrl(url)
        return nativeOpen.apply(this, arguments)
      })

      if (nativeResponseTextDescriptor && typeof nativeResponseTextDescriptor.get === 'function') {
        try {
          Object.defineProperty(xhrPrototype, 'responseText', {
            configurable: true,
            enumerable: nativeResponseTextDescriptor.enumerable === true,
            get() {
              const nativeValue = nativeResponseTextDescriptor.get.call(this)
              const responseUrl = normalizeText(this.responseURL) || this[requestUrlKey]

              if (!matchesVipInfoUrl(responseUrl)) {
                return nativeValue
              }

              return rewriteVipInfoJsonText(nativeValue)
            }
          })
        } catch (_error) {
          // Ignore responseText override failures.
        }
      }

      if (nativeResponseDescriptor && typeof nativeResponseDescriptor.get === 'function') {
        try {
          Object.defineProperty(xhrPrototype, 'response', {
            configurable: true,
            enumerable: nativeResponseDescriptor.enumerable === true,
            get() {
              const nativeValue = nativeResponseDescriptor.get.call(this)
              const responseUrl = normalizeText(this.responseURL) || this[requestUrlKey]

              if (!matchesVipInfoUrl(responseUrl)) {
                return nativeValue
              }

              const responseType = normalizeText(this.responseType).toLowerCase()

              if (responseType === 'json') {
                return rewriteVipTypeDeep(nativeValue)
              }

              if (!responseType || responseType === 'text') {
                if (typeof nativeValue === 'string') {
                  return rewriteVipInfoJsonText(nativeValue)
                }

                if (nativeResponseTextDescriptor && typeof nativeResponseTextDescriptor.get === 'function') {
                  try {
                    return rewriteVipInfoJsonText(nativeResponseTextDescriptor.get.call(this))
                  } catch (_error) {
                    return nativeValue
                  }
                }
              }

              return nativeValue
            }
          })
        } catch (_error) {
          // Ignore response override failures.
        }
      }

      defineValue(xhrPrototype, XHR_FLAG, true)
    }

    defineValue(target, installFlag, true)
    installFetchOverride()
    installXhrOverride()
  }

  if (typeof window !== 'undefined') {
    try {
      const { contextBridge } = require('electron')

      if (contextBridge && typeof contextBridge.executeInMainWorld === 'function') {
        contextBridge.executeInMainWorld({
          func: installVipInfoOverrideRuntime,
          args: [VIP_INFO_HOST, VIP_INFO_PATH, INSTALL_FLAG, RESPONSE_FLAG, REQUEST_URL_KEY]
        })
        return
      }
    } catch (_error) {
      // Ignore main-world injection failures and fall back to the current context.
    }
  }

  installVipInfoOverrideRuntime(
    VIP_INFO_HOST,
    VIP_INFO_PATH,
    INSTALL_FLAG,
    RESPONSE_FLAG,
    REQUEST_URL_KEY
  )
})()
