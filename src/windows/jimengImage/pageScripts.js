function getHelperSource() {
  return `
(() => {
  if (window.__temuJimengBatchHelper) {
    return true;
  }

  const ATTRS = {
    candidate: 'data-temu-jimeng-candidate-key',
    generate: 'data-temu-jimeng-generate-target',
    upload: 'data-temu-jimeng-upload-target'
  };

  const PRIORITY_SELECTORS = {
    generateButton: [
      '#dreamina-ui-configuration-content-wrapper > div.content-V2NaRy > div > div.main-content-GHqUij > div.dimension-layout-L3Dit_.default-layout-l1Aja0 > div > div.toolbar-CO0C5P > div.toolbar-actions-KjbR4x > div:nth-child(2) > button',
      '#dreamina-ui-configuration-content-wrapper div.toolbar-actions-KjbR4x > div:nth-child(2) > button',
      '#dreamina-ui-configuration-content-wrapper div.toolbar-actions-KjbR4x button[class*="submit-button"]',
      '#dreamina-ui-configuration-content-wrapper button.submit-button-xdhu0e',
      '#dreamina-ui-configuration-content-wrapper button.submit-button-s4a7XV',
      '#dreamina-ui-configuration-content-wrapper button[class*="submit-button"]'
    ]
  };

  const KEYWORDS = {
    textToImage: ['\\u6587\\u751f\\u56fe', 'text to image'],
    imageToImage: ['\\u56fe\\u751f\\u56fe', 'image to image'],
    creationType: [
      '\\u521b\\u4f5c\\u7c7b\\u578b',
      '\\u9ed8\\u8ba4\\u521b\\u4f5c',
      'agent mode',
      'agent',
      '\\u56fe\\u7247\\u751f\\u6210',
      '\\u89c6\\u9891\\u751f\\u6210',
      'creation type'
    ],
    imageGeneration: ['\\u56fe\\u7247\\u751f\\u6210', 'image generate', 'image generation'],
    prompt: ['\\u63d0\\u793a\\u8bcd', '\\u63cf\\u8ff0', '\\u5185\\u5bb9', 'prompt', 'describe'],
    search: ['\\u641c\\u7d22', 'search'],
    generate: ['\\u7acb\\u5373\\u751f\\u6210', '\\u5f00\\u59cb\\u751f\\u6210', '\\u751f\\u6210', 'generate', 'create'],
    busy: ['\\u751f\\u6210\\u4e2d', '\\u6392\\u961f', '\\u5904\\u7406\\u4e2d', '\\u63d0\\u4ea4\\u4e2d', 'generating', 'queue', 'processing'],
    queue: ['\\u751f\\u6210\\u4e2d', '\\u6392\\u961f', '\\u961f\\u5217', 'queue', 'processing'],
    upload: ['\\u4e0a\\u4f20', '\\u53c2\\u8003\\u56fe', '\\u70b9\\u51fb\\u4e0a\\u4f20', '\\u62d6\\u62fd', '\\u5bfc\\u5165', 'upload', 'reference', 'image'],
    ignoredGenerate: [
      '\\u751f\\u6210\\u5386\\u53f2',
      '\\u751f\\u6210\\u8bb0\\u5f55',
      '\\u518d\\u6b21\\u751f\\u6210',
      '\\u91cd\\u65b0\\u7f16\\u8f91',
      '\\u7f16\\u8f91',
      '\\u53bb\\u753b\\u5e03',
      'history',
      'regenerate',
      'edit'
    ]
  };

  function normalizeText(value) {
    return String(value || '')
      .replace(/\\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function sleep(timeoutMs) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0));
    });
  }

  function hashString(input) {
    const text = String(input || '');
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return 'k' + Math.abs(hash).toString(16);
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) < 0.05) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width >= 1 && rect.height >= 1;
  }

  function getElementText(element, options = {}) {
    if (!element || !(element instanceof Element)) {
      return '';
    }

    const includeParent = options.includeParent !== false;
    const parts = [];
    const inlineText = normalizeText(element.innerText || element.textContent || '');
    const ariaLabel = normalizeText(element.getAttribute('aria-label'));
    const placeholder = normalizeText(element.getAttribute('placeholder'));
    const title = normalizeText(element.getAttribute('title'));
    const name = normalizeText(element.getAttribute('name'));
    const value = normalizeText(element.value);

    if (inlineText) {
      parts.push(inlineText);
    }

    if (ariaLabel) {
      parts.push(ariaLabel);
    }

    if (placeholder) {
      parts.push(placeholder);
    }

    if (title) {
      parts.push(title);
    }

    if (name) {
      parts.push(name);
    }

    if (value) {
      parts.push(value);
    }

    if (element.labels && element.labels.length > 0) {
      Array.from(element.labels).forEach((label) => {
        const labelText = normalizeText(label.innerText || label.textContent || '');

        if (labelText) {
          parts.push(labelText);
        }
      });
    }

    if (includeParent) {
      const parentText = normalizeText(
        element.parentElement && (element.parentElement.innerText || element.parentElement.textContent || '')
      );

      if (parentText) {
        parts.push(parentText.slice(0, 200));
      }
    }

    return normalizeText(parts.join(' '));
  }

  function normalizePromptValue(value) {
    return String(value || '')
      .replace(/\\r/g, '')
      .replace(/\\u00a0/g, ' ')
      .replace(/[ \\t]+\\n/g, '\\n')
      .replace(/\\n[ \\t]+/g, '\\n')
      .replace(/[ \\t]+/g, ' ')
      .trim();
  }

  function readPromptValue(element) {
    if (!element) {
      return '';
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return String(element.value || '');
    }

    return String(element.innerText || element.textContent || '');
  }

  function isPromptValueMatched(actualValue, expectedValue) {
    return normalizePromptValue(actualValue) === normalizePromptValue(expectedValue);
  }

  function isElementSelected(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const nodes = [element];
    const closestSelectable = element.closest('[aria-selected], [aria-checked], [aria-current], [data-state]');

    if (closestSelectable && nodes.includes(closestSelectable) !== true) {
      nodes.push(closestSelectable);
    }

    return nodes.some((node) => {
      const className = normalizeText(node.className);
      const dataState = normalizeText(node.getAttribute('data-state'));

      return (
        node.getAttribute('aria-selected') === 'true'
        || node.getAttribute('aria-checked') === 'true'
        || (node.getAttribute('aria-current') && node.getAttribute('aria-current') !== 'false')
        || className.includes('active')
        || className.includes('selected')
        || className.includes('checked')
        || className.includes('current')
        || dataState === 'active'
        || dataState === 'selected'
        || dataState === 'checked'
      );
    });
  }

  function scoreKeywords(text, keywords) {
    const normalized = normalizeText(text);

    if (!normalized) {
      return 0;
    }

    return keywords.reduce((total, keyword) => (
      normalized.includes(normalizeText(keyword)) ? total + 1 : total
    ), 0);
  }

  function queryUniqueElements(selectors) {
    const seen = new Set();
    const result = [];

    selectors.forEach((selector) => {
      Array.from(document.querySelectorAll(selector)).forEach((element) => {
        if (seen.has(element)) {
          return;
        }

        seen.add(element);
        result.push(element);
      });
    });

    return result;
  }

  function findFirstVisibleElementBySelectors(selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [];

    for (let index = 0; index < selectorList.length; index += 1) {
      const selector = String(selectorList[index] || '').trim();

      if (!selector) {
        continue;
      }

      try {
        const nodes = Array.from(document.querySelectorAll(selector));

        for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
          const element = nodes[nodeIndex];

          if (isVisible(element)) {
            return {
              element,
              selector
            };
          }
        }
      } catch (_error) {
        // Ignore invalid selectors and continue with the next one.
      }
    }

    return null;
  }

  function resolveClickTarget(element) {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    const candidates = [];

    function pushTarget(target) {
      if (!target || !(target instanceof Element) || candidates.includes(target) || isVisible(target) !== true) {
        return;
      }

      candidates.push(target);
    }

    const semanticTarget = element.closest('button, [role="button"], [role="tab"], a, label');

    pushTarget(semanticTarget);
    pushTarget(element);

    const rect = element.getBoundingClientRect();
    const pointTarget = document.elementFromPoint(
      Math.max(0, Math.round(rect.left + (rect.width / 2))),
      Math.max(0, Math.round(rect.top + (rect.height / 2)))
    );

    pushTarget(pointTarget && pointTarget.closest('button, [role="button"], [role="tab"], a, label'));
    pushTarget(pointTarget);

    return candidates[0] || null;
  }

  function buildInteractionPoint(target) {
    const rect = target.getBoundingClientRect();
    const horizontalPadding = Math.min(16, Math.max(4, Math.round(rect.width * 0.12)));
    const verticalPadding = Math.min(12, Math.max(4, Math.round(rect.height * 0.12)));

    return {
      rect,
      clientX: Math.round(rect.left + Math.min(rect.width - 2, Math.max(2, rect.width / 2 + horizontalPadding - 6))),
      clientY: Math.round(rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2 + verticalPadding - 4)))
    };
  }

  function createPointerLikeEvent(eventName, point, overrides) {
    const payload = Object.assign({
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: point.clientX,
      clientY: point.clientY,
      screenX: point.clientX,
      screenY: point.clientY,
      button: 0,
      buttons: 0
    }, overrides || {});

    if (eventName.indexOf('pointer') === 0 && typeof window.PointerEvent === 'function') {
      return new PointerEvent(eventName, Object.assign({
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      }, payload));
    }

    return new MouseEvent(eventName, payload);
  }

  function focusElement(target) {
    if (!target || typeof target.focus !== 'function') {
      return;
    }

    try {
      target.focus({
        preventScroll: true
      });
    } catch (_error) {
      target.focus();
    }
  }

  async function hoverElement(target) {
    if (!target) {
      return false;
    }

    target.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: 'auto'
    });

    const point = buildInteractionPoint(target);
    const hoverEvents = [
      'pointerover',
      'mouseover',
      'pointerenter',
      'mouseenter',
      'pointermove',
      'mousemove'
    ];

    for (let index = 0; index < hoverEvents.length; index += 1) {
      target.dispatchEvent(createPointerLikeEvent(hoverEvents[index], point));
      if (index === hoverEvents.length - 2) {
        await sleep(18);
      }
    }

    return true;
  }

  async function clickResolvedTarget(target) {
    if (!target) {
      return false;
    }

    await hoverElement(target);
    focusElement(target);
    await sleep(24);

    const point = buildInteractionPoint(target);

    target.dispatchEvent(createPointerLikeEvent('pointerdown', point, {
      button: 0,
      buttons: 1
    }));
    target.dispatchEvent(createPointerLikeEvent('mousedown', point, {
      button: 0,
      buttons: 1
    }));

    await sleep(36);

    target.dispatchEvent(createPointerLikeEvent('pointerup', point, {
      button: 0,
      buttons: 0
    }));
    target.dispatchEvent(createPointerLikeEvent('mouseup', point, {
      button: 0,
      buttons: 0
    }));

    if (typeof target.click === 'function') {
      target.click();
    } else {
      target.dispatchEvent(createPointerLikeEvent('click', point, {
        button: 0,
        buttons: 0
      }));
    }

    return true;
  }

  async function clickElement(element) {
    const target = resolveClickTarget(element);

    if (!target) {
      return false;
    }

    return clickResolvedTarget(target);
  }

  async function clickElementPrecisely(element) {
    const target = resolveClickTarget(element);

    if (!target) {
      return false;
    }

    return clickResolvedTarget(target);
  }

  function serializeRect(rect) {
    return {
      left: Math.max(0, Math.round(rect.left)),
      top: Math.max(0, Math.round(rect.top)),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    };
  }

  function markSingleElement(attributeName, element, attributeValue) {
    Array.from(document.querySelectorAll('[' + attributeName + ']')).forEach((node) => {
      if (node !== element) {
        node.removeAttribute(attributeName);
      }
    });

    if (element) {
      element.setAttribute(attributeName, attributeValue);
    }
  }

  function getElementRect(element) {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    return element.getBoundingClientRect();
  }

  function getRectRight(rect) {
    return Number(rect.left) + Number(rect.width);
  }

  function getRectBottom(rect) {
    return Number(rect.top) + Number(rect.height);
  }

  function isScrollableElement(element) {
    if (!element || !(element instanceof Element) || isVisible(element) !== true) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const overflowY = normalizeText(style && style.overflowY);

    return (
      (overflowY.includes('auto') || overflowY.includes('scroll') || overflowY.includes('overlay'))
      && element.scrollHeight > element.clientHeight + 80
      && element.clientHeight >= 140
    );
  }

  function collectScrollableContainers() {
    const seen = new Set();

    return queryUniqueElements([
      'main',
      'section',
      'article',
      'div'
    ])
      .filter((element) => {
        if (!element || seen.has(element) || isScrollableElement(element) !== true) {
          return false;
        }

        seen.add(element);
        return true;
      })
      .sort((left, right) => {
        const leftArea = Math.max(1, left.clientWidth * left.clientHeight);
        const rightArea = Math.max(1, right.clientWidth * right.clientHeight);

        return rightArea - leftArea;
      })
      .slice(0, 8);
  }

  function scrollElementToBottom(element) {
    if (!element) {
      return false;
    }

    const nextTop = Math.max(0, Number(element.scrollHeight || 0) - Number(element.clientHeight || 0));

    if (typeof element.scrollTo === 'function') {
      element.scrollTo({
        top: nextTop,
        left: 0,
        behavior: 'auto'
      });
    } else {
      element.scrollTop = nextTop;
      element.scrollLeft = 0;
    }

    return true;
  }

  async function scrollWorkspaceToBottom() {
    let movedCount = 0;
    const root = document.scrollingElement || document.documentElement || document.body;

    if (root) {
      scrollElementToBottom(root);
      movedCount += 1;
    }

    const containers = collectScrollableContainers();

    containers.forEach((element) => {
      if (scrollElementToBottom(element) === true) {
        movedCount += 1;
      }
    });

    await sleep(90);

    if (root) {
      scrollElementToBottom(root);
    }

    containers.forEach((element) => {
      scrollElementToBottom(element);
    });

    return {
      success: true,
      movedCount,
      containerCount: containers.length
    };
  }

  function expandRect(rect, padding) {
    const distance = Math.max(0, Number(padding) || 0);

    return {
      left: Number(rect.left) - distance,
      top: Number(rect.top) - distance,
      width: Number(rect.width) + (distance * 2),
      height: Number(rect.height) + (distance * 2)
    };
  }

  function rectsIntersect(leftRect, rightRect) {
    if (!leftRect || !rightRect) {
      return false;
    }

    return !(
      getRectRight(leftRect) <= Number(rightRect.left)
      || getRectRight(rightRect) <= Number(leftRect.left)
      || getRectBottom(leftRect) <= Number(rightRect.top)
      || getRectBottom(rightRect) <= Number(leftRect.top)
    );
  }

  function isButtonSemanticElement(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const tagName = String(element.tagName || '').toLowerCase();
    const role = normalizeText(element.getAttribute('role'));
    const className = normalizeText(element.className);

    return (
      tagName === 'button'
      || tagName === 'a'
      || role === 'button'
      || role === 'tab'
      || className.includes('button')
      || className.includes('btn')
    );
  }

  function isPriorityGenerateClassElement(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const className = normalizeText(element.className);
    const inConfigWrapper = Boolean(element.closest('#dreamina-ui-configuration-content-wrapper'));
    const inToolbar = Boolean(
      element.closest('[class*="toolbar-actions"]')
      || element.closest('[class*="toolbar-"]')
    );

    if (!className || inConfigWrapper !== true) {
      return false;
    }

    if (className.includes('submit-button')) {
      return true;
    }

    return (
      inToolbar
      && className.includes('lv-btn-primary')
      && className.includes('lv-btn-icon-only')
      && className.includes('button-')
    );
  }

  function findGenerateElementByClassPriority() {
    const candidates = queryUniqueElements([
      '#dreamina-ui-configuration-content-wrapper button',
      '#dreamina-ui-configuration-content-wrapper [role="button"]'
    ]);

    for (let index = 0; index < candidates.length; index += 1) {
      const element = candidates[index];

      if (!isVisible(element)) {
        continue;
      }

      if (isPriorityGenerateClassElement(element)) {
        return element;
      }
    }

    return null;
  }

  function scoreGeneratePromptProximity(rect, promptRect) {
    if (!rect || !promptRect) {
      return 0;
    }

    let score = 0;
    const horizontalGap = rect.left >= getRectRight(promptRect)
      ? rect.left - getRectRight(promptRect)
      : promptRect.left >= getRectRight(rect)
        ? promptRect.left - getRectRight(rect)
        : 0;
    const verticalGap = rect.top >= getRectBottom(promptRect)
      ? rect.top - getRectBottom(promptRect)
      : promptRect.top >= getRectBottom(rect)
        ? promptRect.top - getRectBottom(rect)
        : 0;

    if (horizontalGap <= 220) {
      score += Math.max(0, 44 - Math.round(horizontalGap / 6));
    } else {
      score -= Math.min(70, Math.round((horizontalGap - 220) / 8));
    }

    if (verticalGap <= 160) {
      score += Math.max(0, 30 - Math.round(verticalGap / 6));
    } else {
      score -= Math.min(56, Math.round((verticalGap - 160) / 8));
    }

    if (rect.left <= getRectRight(promptRect) + 220) {
      score += 12;
    }

    return score;
  }

  function isGenerateActionNearImageResult(rect, imageCandidates) {
    if (!rect || !Array.isArray(imageCandidates) || imageCandidates.length === 0) {
      return false;
    }

    return imageCandidates.some((candidate) => (
      candidate
      && candidate.rect
      && rectsIntersect(expandRect(rect, 24), expandRect(candidate.rect, 20))
    ));
  }

  function parseQueueStatusText(value) {
    const rawText = String(value || '').trim();
    const text = normalizeText(rawText);
    const match = text.match(/(\\d+)\\s*\\/\\s*(\\d+)/);

    if (!match) {
      return null;
    }

    const current = Math.max(0, Number(match[1]) || 0);
    const total = Math.max(0, Number(match[2]) || 0);
    const active = (
      total > 0
      && (
        scoreKeywords(text, KEYWORDS.queue) > 0
        || current < total
      )
    );

    return {
      current,
      total,
      active,
      label: rawText,
      signature: String(current) + '/' + String(total) + ':' + (active ? '1' : '0')
    };
  }

  function findQueueStatus() {
    const candidates = queryUniqueElements([
      'div',
      'span',
      'button',
      '[role="button"]',
      'p',
      'a'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const directText = String(
        element.innerText
        || element.textContent
        || element.getAttribute('aria-label')
        || ''
      ).trim();
      const parsed = parseQueueStatusText(directText);

      if (!parsed) {
        return;
      }

      const rect = element.getBoundingClientRect();
      let score = 120;

      score += scoreKeywords(directText, KEYWORDS.queue) * 80;

      if (rect.top <= 220) {
        score += 40;
      }

      if (rect.left <= 320) {
        score += 24;
      }

      if (rect.width >= 70 && rect.width <= 280) {
        score += 20;
      }

      if (rect.height >= 20 && rect.height <= 64) {
        score += 16;
      }

      if (
        element.closest('[class*="queue"]')
        || element.closest('[class*="process"]')
        || element.closest('[class*="status"]')
      ) {
        score += 24;
      }

      if (!best || score > best.score) {
        best = {
          element,
          score,
          parsed
        };
      }
    });

    if (!best || !best.element || !best.parsed) {
      return {
        found: false,
        active: false,
        current: 0,
        total: 0,
        label: '',
        signature: '',
        rect: null
      };
    }

    return {
      found: true,
      active: best.parsed.active === true,
      current: best.parsed.current,
      total: best.parsed.total,
      label: best.parsed.label,
      signature: best.parsed.signature,
      rect: serializeRect(best.element.getBoundingClientRect())
    };
  }

  function findModeElement(mode) {
    const modeKeywords = mode === 'image-to-image' ? KEYWORDS.imageToImage : KEYWORDS.textToImage;
    const candidates = queryUniqueElements([
      'button',
      '[role="button"]',
      '[role="tab"]',
      'label',
      'div',
      'span'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const text = getElementText(element, { includeParent: false }) || getElementText(element);
      const score = scoreKeywords(text, modeKeywords) * 20;

      if (score <= 0) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const totalScore = score + Math.min(80, Math.round(rect.width + rect.height));

      if (!best || totalScore > best.score) {
        best = {
          element,
          score: totalScore,
          text
        };
      }
    });

    return best ? best.element : null;
  }

  function findPromptInput() {
    const candidates = queryUniqueElements([
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'input[type="text"]'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const text = getElementText(element);
      let score = 0;

      if (scoreKeywords(text, KEYWORDS.prompt) > 0) {
        score += 60;
      }

      if (scoreKeywords(text, KEYWORDS.search) > 0) {
        score -= 40;
      }

      if (element.tagName === 'TEXTAREA') {
        score += 18;
      }

      if (element.getAttribute('contenteditable') === 'true') {
        score += 14;
      }

      if (Number(element.rows || 0) >= 3) {
        score += 10;
      }

      const rect = element.getBoundingClientRect();
      score += Math.min(120, Math.round(rect.width / 10) + Math.round(rect.height / 8));

      if (!best || score > best.score) {
        best = {
          element,
          score
        };
      }
    });

    return best ? best.element : null;
  }

  function createInputEvent(eventName, data, inputType) {
    try {
      return new InputEvent(eventName, {
        bubbles: true,
        cancelable: true,
        data: data == null ? null : String(data),
        inputType: inputType || 'insertText'
      });
    } catch (_error) {
      return new Event(eventName, {
        bubbles: true,
        cancelable: true
      });
    }
  }

  function dispatchValueEvents(element, value, inputType) {
    element.dispatchEvent(createInputEvent('beforeinput', value, inputType));
    element.dispatchEvent(createInputEvent('input', value, inputType));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function writeInputValue(element, value) {
    const nextValue = String(value || '');
    const prototype = element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    element.focus();

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(element, '');
    } else {
      element.value = '';
    }

    dispatchValueEvents(element, '', 'deleteContentBackward');

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(element, nextValue);
    } else {
      element.value = nextValue;
    }

    if (typeof element.setSelectionRange === 'function') {
      const valueLength = nextValue.length;

      try {
        element.setSelectionRange(valueLength, valueLength);
      } catch (_error) {}
    }

    dispatchValueEvents(element, nextValue, 'insertText');

    return {
      success: true,
      actualValue: readPromptValue(element)
    };
  }

  function selectNodeContents(element) {
    const selection = window.getSelection && window.getSelection();

    if (!selection) {
      return false;
    }

    const range = document.createRange();

    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function writeContentEditableValue(element, value) {
    const nextValue = String(value || '');

    element.focus();
    selectNodeContents(element);

    try {
      document.execCommand('delete', false);
    } catch (_error) {}

    element.innerHTML = '';
    element.textContent = '';
    dispatchValueEvents(element, '', 'deleteContentBackward');

    if (nextValue) {
      const selection = window.getSelection && window.getSelection();
      let inserted = false;

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        range.deleteContents();

        try {
          inserted = document.execCommand('insertText', false, nextValue) === true;
        } catch (_error) {
          inserted = false;
        }

        if (inserted !== true) {
          range.insertNode(document.createTextNode(nextValue));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        element.textContent = nextValue;
      }
    }

    dispatchValueEvents(element, nextValue, 'insertText');

    return {
      success: true,
      actualValue: readPromptValue(element)
    };
  }

  function selectExistingEditableValue(element) {
    if (!element) {
      return false;
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      focusElement(element);

      if (typeof element.select === 'function') {
        element.select();
      }

      if (typeof element.setSelectionRange === 'function') {
        try {
          element.setSelectionRange(0, String(element.value || '').length);
        } catch (_error) {}
      }

      return true;
    }

    if (element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox') {
      focusElement(element);
      return selectNodeContents(element);
    }

    return false;
  }

  async function prepareElementForTextInput(element) {
    if (!element) {
      return false;
    }

    await hoverElement(element);
    await sleep(24);
    focusElement(element);
    await sleep(24);
    selectExistingEditableValue(element);
    await sleep(18);
    return true;
  }

  async function writePromptValue(element, value) {
    const nextValue = String(value || '');

    if (!element) {
      return {
        success: false,
        matched: false,
        reason: 'prompt-not-found',
        actualValue: ''
      };
    }

    for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
      let result = null;

      await prepareElementForTextInput(element);

      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        result = writeInputValue(element, nextValue);
      } else if (element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox') {
        result = writeContentEditableValue(element, nextValue);
      }

      if (!result || result.success !== true) {
        continue;
      }

      const actualValue = readPromptValue(element);
      const matched = isPromptValueMatched(actualValue, nextValue);

      if (matched) {
        return {
          success: true,
          matched: true,
          actualValue,
          attemptCount: attemptIndex + 1
        };
      }

      await sleep(30);
    }

    return {
      success: false,
      matched: false,
      reason: 'prompt-mismatch',
      actualValue: readPromptValue(element)
    };
  }

  function findImageGenerationElement() {
    const candidates = queryUniqueElements([
      'button',
      '[role="button"]',
      '[role="tab"]',
      '[role="option"]',
      '[role="menuitem"]',
      'label',
      'li',
      'div',
      'span'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const text = getElementText(element, { includeParent: false });

      if (!text || text.length > 80) {
        return;
      }

      const imageScore = scoreKeywords(text, KEYWORDS.imageGeneration);

      if (imageScore <= 0) {
        return;
      }

      let score = imageScore * 60;

      score -= scoreKeywords(text, KEYWORDS.generate) * 20;
      score -= scoreKeywords(text, KEYWORDS.ignoredGenerate) * 25;
      score += isElementSelected(element) ? 20 : 0;

      const rect = element.getBoundingClientRect();

      score += Math.min(80, Math.round(rect.width / 8) + Math.round(rect.height / 6));

      if (!best || score > best.score) {
        best = {
          element,
          score,
          selected: isElementSelected(element),
          text
        };
      }
    });

    return best;
  }

  function findCreationTypeTrigger() {
    const candidates = queryUniqueElements([
      'button',
      '[role="button"]',
      '[role="tab"]',
      '[aria-haspopup="menu"]',
      '[aria-haspopup="listbox"]',
      'label',
      'div',
      'span'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const text = getElementText(element, { includeParent: false });

      if (!text || text.length > 120) {
        return;
      }

      const creationScore = scoreKeywords(text, KEYWORDS.creationType);

      if (creationScore <= 0) {
        return;
      }

      let score = creationScore * 35;

      if (
        element.getAttribute('aria-haspopup') === 'menu'
        || element.getAttribute('aria-haspopup') === 'listbox'
      ) {
        score += 18;
      }

      score -= scoreKeywords(text, KEYWORDS.generate) * 12;

      const rect = element.getBoundingClientRect();

      score += Math.min(80, Math.round(rect.width / 8) + Math.round(rect.height / 6));

      if (!best || score > best.score) {
        best = {
          element,
          score,
          text
        };
      }
    });

    return best;
  }

  async function ensureImageGenerationSelected() {
    const currentOption = findImageGenerationElement();

    if (currentOption && currentOption.selected === true) {
      return {
        success: true,
        skipped: true,
        via: 'selected-option',
        label: currentOption.text
      };
    }

    const readyByPage = Boolean(findPromptInput()) && Boolean(findGenerateElement());

    if (readyByPage && normalizeText(window.location.pathname).includes('/ai-tool/generate')) {
      return {
        success: true,
        skipped: true,
        via: 'ready-page'
      };
    }

    const trigger = findCreationTypeTrigger();

    if (trigger && (!currentOption || currentOption.selected !== true)) {
      await clickElement(trigger.element);
      await sleep(260);
    }

    const nextOption = findImageGenerationElement();

    if (nextOption && nextOption.selected !== true) {
      await clickElement(nextOption.element);
      await sleep(320);
    }

    const verifiedOption = findImageGenerationElement();

    if (verifiedOption) {
      return {
        success: true,
        selected: verifiedOption.selected === true,
        via: trigger ? 'trigger-option' : 'direct-option',
        label: verifiedOption.text
      };
    }

    if (readyByPage && normalizeText(window.location.pathname).includes('/ai-tool/generate')) {
      return {
        success: true,
        skipped: true,
        via: 'ready-fallback'
      };
    }

    return {
      success: false,
      reason: 'image-generation-not-found'
    };
  }

  function findGenerateElement() {
    const preferredMatch = findFirstVisibleElementBySelectors(PRIORITY_SELECTORS.generateButton);

    if (preferredMatch && preferredMatch.element) {
      markSingleElement(ATTRS.generate, preferredMatch.element, '1');
      return preferredMatch.element;
    }

    const classPriorityMatch = findGenerateElementByClassPriority();

    if (classPriorityMatch) {
      markSingleElement(ATTRS.generate, classPriorityMatch, '1');
      return classPriorityMatch;
    }

    const promptElement = findPromptInput();
    const promptRect = getElementRect(promptElement);
    const imageCandidates = collectImageCandidates();
    const candidates = queryUniqueElements([
      'button',
      '[role="button"]',
      '[role="tab"]',
      '[aria-label]',
      'div',
      'span',
      'a'
    ]);
    let best = null;

    candidates.forEach((element) => {
      if (!isVisible(element)) {
        return;
      }

      const directText = getElementText(element, { includeParent: false });
      const text = directText || getElementText(element);
      let score = scoreKeywords(text, KEYWORDS.generate) * 36;

      if (score <= 0) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const ignoredScore = scoreKeywords(text, KEYWORDS.ignoredGenerate);

      if (rect.width < 28 || rect.height < 28) {
        return;
      }

      score -= ignoredScore * 80;
      score -= scoreKeywords(text, KEYWORDS.textToImage) * 20;
      score -= scoreKeywords(text, KEYWORDS.imageToImage) * 20;
      score += isButtonSemanticElement(element) ? 34 : -36;

      if (directText.includes('\\u7acb\\u5373\\u751f\\u6210') || directText.includes('\\u5f00\\u59cb\\u751f\\u6210')) {
        score += 110;
      }

      if (directText.includes('\\u518d\\u6b21\\u751f\\u6210')) {
        score -= 220;
      }

      if (directText.includes('\\u91cd\\u65b0\\u7f16\\u8f91')) {
        score -= 180;
      }

      if (rect.width > 260 || rect.height > 110) {
        score -= 40;
      }

      score += scoreGeneratePromptProximity(rect, promptRect);

      if (isGenerateActionNearImageResult(rect, imageCandidates)) {
        score -= 220;
      }

      if (promptRect && rect.left > getRectRight(promptRect) + 320) {
        score -= 60;
      }

      score += Math.min(120, Math.round(rect.width / 8) + Math.round(rect.height / 6));

      if (!best || score > best.score) {
        best = {
          element,
          score,
          text: directText || text,
          rect: serializeRect(rect)
        };
      }
    });

    if (best && best.element && best.score > 0) {
      markSingleElement(ATTRS.generate, best.element, '1');
      return best.element;
    }

    return null;
  }

  function isGenerateBusy(element) {
    if (!element) {
      return false;
    }

    const text = getElementText(element);
    const queueStatus = findQueueStatus();

    return (
      element.disabled === true
      || element.getAttribute('aria-disabled') === 'true'
      || scoreKeywords(text, KEYWORDS.busy) > 0
      || queueStatus.active === true
    );
  }

  function findFileInput() {
    const candidates = Array.from(document.querySelectorAll('input[type="file"]'));
    let best = null;

    candidates.forEach((element) => {
      const accept = normalizeText(element.getAttribute('accept'));
      const text = getElementText(element);
      let score = 0;

      if (accept.includes('image')) {
        score += 60;
      }

      if (scoreKeywords(text, KEYWORDS.upload) > 0) {
        score += 40;
      }

      if (element.multiple === true) {
        score += 6;
      }

      if (score > 0 && (!best || score > best.score)) {
        best = {
          element,
          score
        };
      }
    });

    if (best && best.element) {
      markSingleElement(ATTRS.upload, best.element, '1');
      return best.element;
    }

    return null;
  }

  function extractBackgroundImageUrl(element) {
    const style = window.getComputedStyle(element);
    const backgroundImage = style ? String(style.backgroundImage || '') : '';
    const match = backgroundImage.match(/url\\((['"]?)(.*?)\\1\\)/i);

    return match ? String(match[2] || '').trim() : '';
  }

  function collectImageCandidates() {
    const candidates = queryUniqueElements([
      'img',
      'canvas',
      '[style*="background-image"]'
    ]);
    const result = [];
    const seenKeys = new Set();

    candidates.forEach((element, index) => {
      if (!element || !(element instanceof Element)) {
        return;
      }

      const style = window.getComputedStyle(element);

      if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) < 0.05) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const rectWidth = Math.round(rect.width);
      const rectHeight = Math.round(rect.height);

      if (rectWidth < 160 || rectHeight < 160) {
        return;
      }

      let kind = 'element';
      let sourceKey = '';
      let width = rectWidth;
      let height = rectHeight;

      if (element.tagName === 'IMG') {
        kind = 'img';
        sourceKey = String(element.currentSrc || element.src || '').trim();
        width = Math.max(width, Number(element.naturalWidth) || 0);
        height = Math.max(height, Number(element.naturalHeight) || 0);
      } else if (element.tagName === 'CANVAS') {
        kind = 'canvas';
        sourceKey = 'canvas:' + (Number(element.width) || width) + 'x' + (Number(element.height) || height) + ':' + index;
        width = Math.max(width, Number(element.width) || 0);
        height = Math.max(height, Number(element.height) || 0);
      } else {
        kind = 'background';
        sourceKey = extractBackgroundImageUrl(element);
      }

      if (!sourceKey && kind !== 'canvas') {
        return;
      }

      const key = hashString([
        kind,
        sourceKey,
        width,
        height,
        rectWidth,
        rectHeight
      ].join('|'));

      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      element.setAttribute(ATTRS.candidate, key);
      result.push({
        key,
        kind,
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
        area: Math.max(1, Math.round(rectWidth * rectHeight)),
        rect: serializeRect(rect)
      });
    });

    result.sort((left, right) => right.area - left.area);

    return result.slice(0, 16);
  }

  function getPageSnapshot() {
    const promptFound = Boolean(findPromptInput());
    const generateElement = findGenerateElement();
    const generateFound = Boolean(generateElement);
    const uploadFound = Boolean(findFileInput());
    const promptElement = findPromptInput();
    const promptValue = readPromptValue(promptElement);
    const imageGeneration = findImageGenerationElement();
    const queueStatus = findQueueStatus();

    return {
      url: window.location.href,
      title: document.title,
      promptFound,
      generateFound,
      uploadFound,
      generateLabel: generateElement
        ? (getElementText(generateElement, { includeParent: false }) || getElementText(generateElement))
        : '',
      generateRect: generateElement ? serializeRect(generateElement.getBoundingClientRect()) : null,
      promptValueLength: String(promptValue || '').length,
      promptValuePreview: normalizePromptValue(promptValue).slice(0, 200),
      creationTypeLabel: imageGeneration ? imageGeneration.text : '',
      imageGenerationSelected: Boolean(imageGeneration && imageGeneration.selected === true),
      queueFound: queueStatus.found === true,
      queueActive: queueStatus.active === true,
      queueCurrent: queueStatus.current,
      queueTotal: queueStatus.total,
      queueLabel: queueStatus.label,
      queueSignature: queueStatus.signature,
      queueRect: queueStatus.rect,
      inferredTextToImageReady: promptFound && generateFound,
      inferredImageToImageReady: uploadFound && generateFound,
      bodyTextPreview: normalizeText(
        document.body && (document.body.innerText || document.body.textContent || '')
      ).slice(0, 500),
      imageCandidates: collectImageCandidates().slice(0, 8)
    };
  }

  function isLoginRequired() {
    const snapshot = getPageSnapshot();

    return (
      snapshot.promptFound !== true
      && snapshot.generateFound !== true
      && snapshot.bodyTextPreview.includes('\\u767b\\u5f55')
    );
  }

  window.__temuJimengBatchHelper = {
    async setMode(mode) {
      if (isLoginRequired()) {
        return {
          success: false,
          reason: 'login-required',
          snapshot: getPageSnapshot()
        };
      }

      const creationTypeResult = await ensureImageGenerationSelected();

      if (
        creationTypeResult
        && creationTypeResult.success !== true
        && creationTypeResult.reason
      ) {
        const snapshot = getPageSnapshot();

        if (snapshot.inferredTextToImageReady || snapshot.inferredImageToImageReady) {
          return {
            success: true,
            skipped: true,
            fallback: 'implicit-image-generation-ready',
            snapshot
          };
        }
      }

      const element = findModeElement(mode);

      if (!element) {
        const snapshot = getPageSnapshot();
        const inferredTextToImageReady = snapshot && snapshot.inferredTextToImageReady === true;
        const inferredImageToImageReady = snapshot && snapshot.inferredImageToImageReady === true;

        if (mode === 'text-to-image' && inferredTextToImageReady) {
          return {
            success: true,
            skipped: true,
            fallback: 'implicit-text-to-image',
            snapshot
          };
        }

        if (mode === 'image-to-image' && inferredImageToImageReady) {
          return {
            success: true,
            skipped: true,
            fallback: 'implicit-image-to-image',
            snapshot
          };
        }

        return {
          success: false,
          reason: 'mode-not-found',
          snapshot
        };
      }

      await clickElement(element);
      await sleep(220);

      return {
        success: true,
        label: getElementText(element, { includeParent: false }) || getElementText(element),
        creationTypeResult
      };
    },
    async setPrompt(prompt) {
      const promptValue = String(prompt || '');

      if (!promptValue) {
        return {
          success: true,
          skipped: true
        };
      }

      const element = findPromptInput();

      if (!element) {
        return {
          success: false,
          reason: 'prompt-not-found',
          snapshot: getPageSnapshot()
        };
      }

      const result = await writePromptValue(element, promptValue);

      return {
        success: result.success === true,
        matched: result.matched === true,
        reason: result.reason || '',
        valueLength: promptValue.length,
        actualValueLength: String(result.actualValue || '').length,
        actualValuePreview: normalizePromptValue(result.actualValue).slice(0, 200),
        attemptCount: Math.max(1, Number(result.attemptCount) || 1)
      };
    },
    prepareUploadInput() {
      if (isLoginRequired()) {
        return {
          success: false,
          reason: 'login-required',
          snapshot: getPageSnapshot()
        };
      }

      const input = findFileInput();

      if (!input) {
        return {
          success: false,
          reason: 'upload-input-not-found',
          snapshot: getPageSnapshot()
        };
      }

      return {
        success: true,
        selector: 'input[' + ATTRS.upload + '="1"]',
        multiple: input.multiple === true,
        accept: String(input.getAttribute('accept') || '')
      };
    },
    async clickGenerate() {
      if (isLoginRequired()) {
        return {
          success: false,
          reason: 'login-required',
          snapshot: getPageSnapshot()
        };
      }

      const element = findGenerateElement();

      if (!element) {
        return {
          success: false,
          reason: 'generate-button-not-found',
          snapshot: getPageSnapshot()
        };
      }

      await clickElementPrecisely(element);
      await sleep(90);
      const scrollResult = await scrollWorkspaceToBottom();

      return {
        success: true,
        label: getElementText(element, { includeParent: false }) || getElementText(element),
        rect: serializeRect(element.getBoundingClientRect()),
        busy: isGenerateBusy(element),
        scrollResult
      };
    },
    getResultState() {
      const generateElement = findGenerateElement();
      const busy = isGenerateBusy(generateElement);
      const queueStatus = findQueueStatus();

      return {
        success: true,
        busy,
        queueStatus
      };
    },
    getSnapshot() {
      return getPageSnapshot();
    }
  };

  return true;
})();
  `;
}

function buildEnsureHelperScript() {
  return getHelperSource();
}

function buildHelperReadyCheckScript() {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  return Boolean(
    helper
    && typeof helper.setMode === 'function'
    && typeof helper.setPrompt === 'function'
    && typeof helper.prepareUploadInput === 'function'
    && typeof helper.clickGenerate === 'function'
    && typeof helper.getResultState === 'function'
    && typeof helper.getSnapshot === 'function'
  );
})();
  `;
}

function buildSetModeScript(mode) {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.setMode !== 'function') {
    return {
      success: false,
      reason: 'helper-missing'
    };
  }

  return helper.setMode(${JSON.stringify(String(mode || 'text-to-image'))});
})();
  `;
}

function buildSetPromptScript(prompt) {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.setPrompt !== 'function') {
    return {
      success: false,
      reason: 'helper-missing'
    };
  }

  return helper.setPrompt(${JSON.stringify(String(prompt || ''))});
})();
  `;
}

function buildPrepareUploadInputScript() {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.prepareUploadInput !== 'function') {
    return {
      success: false,
      reason: 'helper-missing'
    };
  }

  return helper.prepareUploadInput();
})();
  `;
}

function buildClickGenerateScript() {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.clickGenerate !== 'function') {
    return {
      success: false,
      reason: 'helper-missing'
    };
  }

  return helper.clickGenerate();
})();
  `;
}

function buildGetResultStateScript() {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.getResultState !== 'function') {
    return {
      success: false,
      reason: 'helper-missing'
    };
  }

  return helper.getResultState();
})();
  `;
}

function buildPageSnapshotScript() {
  return `
(() => {
  const helper = window.__temuJimengBatchHelper;

  if (!helper || typeof helper.getSnapshot !== 'function') {
    return {
      reason: 'helper-missing'
    };
  }

  return helper.getSnapshot();
})();
  `;
}

module.exports = {
  buildClickGenerateScript,
  buildEnsureHelperScript,
  buildHelperReadyCheckScript,
  buildGetResultStateScript,
  buildPageSnapshotScript,
  buildPrepareUploadInputScript,
  buildSetModeScript,
  buildSetPromptScript
};
