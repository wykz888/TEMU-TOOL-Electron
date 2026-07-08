const { normalizeText } = require('../services/shopManagement/common');

function buildSellerCenterLandingScript(payload) {
  const runtimePayload = JSON.stringify({
    targetShopName: normalizeText(payload && payload.targetShopName)
  });

  return `
    (() => {
      const runtimePayload = ${runtimePayload};
      const switchPatterns = [
        /\\u5207\\u6362/u,
        /\\bswitch\\b/i
      ];
      const agreementPatterns = [
        /\\u60a8\\u6388\\u6743/u,
        /\\u5373\\u5c06\\u524d\\u5f80/u,
        /\\u6211\\u5df2\\u9605\\u8bfb\\u5e76\\u540c\\u610f/u,
        /\\u9605\\u8bfb\\u5e76\\u540c\\u610f/u,
        /\\u9690\\u79c1\\u653f\\u7b56/u,
        /\\u5e97\\u94fa\\u540d\\u79f0/u,
        /seller\\s*central/i,
        /account\\s*id/i
      ];
      const authorizationDialogPatterns = [
        /\\u5373\\u5c06\\u524d\\u5f80/u,
        /\\u60a8\\u6388\\u6743/u,
        /\\u5e97\\u94fa\\u540d\\u79f0/u,
        /\\u5356\\u5bb6\\u4e2d\\u5fc3\\u5404\\u677f\\u5757/u,
        /seller\\s*central/i,
        /account\\s*id/i
      ];
      const authorizationConfirmPatterns = [
        /\\u786e\\u8ba4\\u6388\\u6743\\u5e76\\u524d\\u5f80/u,
        /\\u6388\\u6743\\u5e76\\u524d\\u5f80/u,
        /\\u786e\\u8ba4\\u6388\\u6743/u,
        /confirm\\s*(authorization|auth)/i,
        /authorize\\s*(and\\s*)?(go|continue|enter)/i
      ];
      const globalTitlePatterns = [
        /^\\u5168\\u7403$/u,
        /global/i
      ];
      const globalNegativePatterns = [
        /\\u7f8e\\u56fd/u,
        /\\u6b27\\u533a/u,
        /\\bus\\b/i,
        /\\beur?\\b/i
      ];
      const enterPatterns = [
        /^\\u8fdb\\u5165$/u,
        /\\u8fdb\\u5165/u,
        /enter/i
      ];
      const loadingPatterns = [
        /\\u52a0\\u8f7d\\u4e2d/u,
        /loading/i
      ];
      const AUTHORIZATION_DIALOG_STATE_KEY = '__TEMU_TOOLBOX_AUTHORIZATION_DIALOG_STATE__';

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function normalizeMatchText(value) {
        return normalizeText(value).toLowerCase().replace(/\\s+/g, '');
      }

      function limitText(value, maxLength) {
        const normalizedValue = normalizeText(value);
        const limit = Number(maxLength) || 0;

        if (!normalizedValue || limit <= 0 || normalizedValue.length <= limit) {
          return normalizedValue;
        }

        return normalizedValue.slice(0, limit);
      }

      function matchesAnyPattern(text, patterns) {
        return patterns.some((pattern) => pattern.test(text));
      }

      function getBodyText() {
        return normalizeText(document.body && document.body.innerText);
      }

      function hasLoadingIndicator() {
        return matchesAnyPattern(getBodyText(), loadingPatterns);
      }

      function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        if (element.hidden || element.hasAttribute('hidden')) {
          return false;
        }

        const style = window.getComputedStyle(element);

        if (!style || style.display === 'none' || style.visibility === 'hidden') {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getHintText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return [
          normalizeText(element.textContent),
          normalizeText(element.innerText),
          normalizeText(element.getAttribute('aria-label')),
          normalizeText(element.getAttribute('title')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('data-id')),
          normalizeText(element.getAttribute('data-value')),
          normalizeText(element.id),
          normalizeText(element.className)
        ]
          .filter(Boolean)
          .join(' ');
      }

      function getVisibleText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return normalizeText(element.innerText || element.textContent);
      }

      function getClickableTarget(element) {
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        return element.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], label') || element;
      }

      function isElementDisabled(element) {
        if (!(element instanceof HTMLElement)) {
          return true;
        }

        if ('disabled' in element && element.disabled === true) {
          return true;
        }

        return normalizeText(element.getAttribute('aria-disabled')).toLowerCase() === 'true';
      }

      function triggerPointerClick(element) {
        const target = getClickableTarget(element);

        if (!(target instanceof HTMLElement)) {
          return false;
        }

        try {
          target.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        } catch (_error) {
          // Ignore scroll failures.
        }

        try {
          target.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          target.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          target.click();
          return true;
        } catch (_error) {
          try {
            target.click();
            return true;
          } catch (__error) {
            return false;
          }
        }
      }

      function triggerSingleClick(element) {
        const target = getClickableTarget(element);

        if (!(target instanceof HTMLElement)) {
          return false;
        }

        try {
          target.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        } catch (_error) {
          // Ignore scroll failures.
        }

        try {
          target.click();
          return true;
        } catch (_error) {
          return false;
        }
      }

      function wait(ms) {
        return new Promise((resolve) => {
          window.setTimeout(resolve, ms);
        });
      }

      function extractShopNameFromText(rawText) {
        const originalText = normalizeText(rawText);
        const normalizedText = originalText.replace(/\\s+/g, ' ');

        if (!normalizedText) {
          return '';
        }

        const normalizedTargetShopName = normalizeMatchText(runtimePayload.targetShopName);
        const fragments = originalText
          .split(/[\\r\\n]+/)
          .map((item) => normalizeText(item))
          .filter(Boolean);
        const candidateFragments = (fragments.length > 0 ? fragments : [normalizedText])
          .map((fragment) => {
            const cleaned = normalizeText(
              fragment
                .replace(/seller\\s*central/ig, ' ')
                .replace(/\\u6b22\\u8fce\\u6765\\u5230/ug, ' ')
                .replace(/\\u5207\\u6362/ug, ' ')
                .replace(/\\bswitch\\b/ig, ' ')
                .replace(/[|\\uFF5C]/g, ' ')
            ).replace(/\\s{2,}/g, ' ').trim();

            if (!cleaned) {
              return null;
            }

            const normalizedCandidate = normalizeMatchText(cleaned);
            let score = 0;

            if (/^[+]?\\d[\\d\\s*()-]{4,}$/u.test(cleaned)) {
              score -= 220;
            }

            if (/seller\\s*central/i.test(cleaned)) {
              score -= 120;
            }

            if (matchesAnyPattern(cleaned, switchPatterns)) {
              score -= 120;
            }

            if (normalizedTargetShopName && normalizedCandidate === normalizedTargetShopName) {
              score += 260;
            } else if (
              normalizedTargetShopName
              && (
                normalizedCandidate.includes(normalizedTargetShopName)
                || normalizedTargetShopName.includes(normalizedCandidate)
              )
            ) {
              score += 180;
            }

            if (/shop/i.test(cleaned)) {
              score += 70;
            }

            if (cleaned.length >= 3 && cleaned.length <= 64) {
              score += 80;
            } else if (cleaned.length > 96) {
              score -= 80;
            }

            return {
              text: cleaned,
              score
            };
          })
          .filter(Boolean)
          .sort((left, right) => right.score - left.score);

        const compact = candidateFragments.length > 0
          ? normalizeText(candidateFragments[0].text)
          : '';

        if (!compact) {
          return '';
        }

        return compact;
      }

      function findCurrentShopInfo() {
        const candidates = Array.from(document.querySelectorAll('button, a, div, span, header, section'))
          .filter((element) => isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const visibleText = getVisibleText(element);
            const rect = element.getBoundingClientRect();
            let score = 0;

            if (!matchesAnyPattern(hintText, switchPatterns)) {
              return {
                element,
                score: -1,
                shopName: ''
              };
            }

            if (rect.top <= 220) {
              score += 70;
            } else if (rect.top <= 320) {
              score += 20;
            }

            if (rect.left <= window.innerWidth * 0.45) {
              score += 60;
            }

            if (hintText.length <= 64) {
              score += 36;
            } else if (hintText.length >= 120) {
              score -= 30;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'a' || normalizeText(element.tagName).toLowerCase() === 'button') {
              score += 16;
            }

            if (/site-main_store/i.test(normalizeText(element.className))) {
              score += 220;
            }

            const parentText = getVisibleText(element.parentElement);
            const ownShopName = extractShopNameFromText(visibleText);
            const parentShopName = extractShopNameFromText(parentText);
            const shopName = ownShopName || parentShopName;

            if (shopName) {
              score += 120;
            }

            return {
              element,
              score,
              shopName,
              rowText: limitText(parentText || visibleText, 180)
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        if (candidates.length === 0) {
          return null;
        }

        const bestCandidate = candidates[0];
        return {
          shopName: normalizeText(bestCandidate.shopName),
          trigger: getClickableTarget(bestCandidate.element),
          rowText: bestCandidate.rowText
        };
      }

      function isTargetShopVisibleNearTop() {
        const normalizedTargetShopName = normalizeMatchText(runtimePayload.targetShopName);

        if (!normalizedTargetShopName) {
          return false;
        }

        return Array.from(document.querySelectorAll('div, span, p, a, button, header, section'))
          .filter((element) => isVisible(element))
          .some((element) => {
            const rect = element.getBoundingClientRect();
            const text = normalizeMatchText(getHintText(element));

            if (!text || rect.top > 260 || rect.left > window.innerWidth * 0.5) {
              return false;
            }

            return (
              text.includes(normalizedTargetShopName)
              && text.length <= Math.max(normalizedTargetShopName.length + 32, 96)
            );
          });
      }

      function findTargetShopOption() {
        const normalizedTargetShopName = normalizeMatchText(runtimePayload.targetShopName);

        if (!normalizedTargetShopName) {
          return null;
        }

        const candidates = Array.from(document.querySelectorAll('button, a, div, span, li, [role="button"], [role="option"], [role="menuitem"], [role="tab"]'))
          .filter((element) => isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const normalizedText = normalizeMatchText(hintText);
            let score = 0;

            if (!normalizedText || !normalizedText.includes(normalizedTargetShopName)) {
              return {
                element,
                score: -1,
                hintText
              };
            }

            if (normalizedText === normalizedTargetShopName) {
              score += 180;
            } else {
              score += 120;
            }

            if (matchesAnyPattern(hintText, switchPatterns)) {
              score -= 80;
            }

            if (hintText.length <= 80) {
              score += 30;
            }

            if (getClickableTarget(element)) {
              score += 30;
            }

            return {
              element,
              score,
              hintText
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function getAgreementStateText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return [
          normalizeText(element.className),
          normalizeText(element.id),
          normalizeText(element.getAttribute('data-state')),
          normalizeText(element.getAttribute('data-status')),
          normalizeText(element.getAttribute('data-checked')),
          normalizeText(element.getAttribute('data-selected')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('aria-checked')),
          normalizeText(element.getAttribute('aria-selected')),
          normalizeText(element.getAttribute('aria-pressed')),
          normalizeText(element.getAttribute('checked'))
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      }

      function isAgreementChecked(element) {
        if (!element) {
          return false;
        }

        if (element instanceof HTMLInputElement) {
          return element.checked === true;
        }

        if (
          normalizeText(element.getAttribute('aria-checked')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('aria-selected')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('aria-pressed')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('data-checked')).toLowerCase() === 'true'
          || normalizeText(element.getAttribute('data-selected')).toLowerCase() === 'true'
        ) {
          return true;
        }

        const nestedCheckbox = element instanceof HTMLElement
          ? element.querySelector('input[type="checkbox"], [role="checkbox"]')
          : null;

        if (nestedCheckbox && nestedCheckbox !== element && isAgreementChecked(nestedCheckbox)) {
          return true;
        }

        const stateText = getAgreementStateText(element);
        return (
          /\\bchecked\\b/i.test(stateText)
          || /\\bselected\\b/i.test(stateText)
          || /\\bactive\\b/i.test(stateText)
          || /haschecksquare/i.test(stateText)
          || /checksquare/i.test(stateText)
        ) && !/\\bunchecked\\b/i.test(stateText);
      }

      function getAgreementTextContainer(scopeRoot) {
        const root = scopeRoot instanceof HTMLElement ? scopeRoot : document;

        return Array.from(root.querySelectorAll('label, div, span, p, section'))
          .filter((element) => isVisible(element))
          .find((element) => {
            const text = getHintText(element);
            return text.length <= 220 && matchesAnyPattern(text, agreementPatterns);
          }) || null;
      }

      function findAgreementElement(scopeRoot) {
        const root = scopeRoot instanceof HTMLElement ? scopeRoot : document;
        const directCandidates = Array.from(root.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
          .map((element) => {
            const hintText = [
              getHintText(element),
              getHintText(element.parentElement),
              getHintText(element.closest('label, div, span, p, section'))
            ]
              .filter(Boolean)
              .join(' ');
            let score = 0;

            if (!matchesAnyPattern(hintText, agreementPatterns)) {
              return {
                element,
                score: -1
              };
            }

            if (isVisible(element)) {
              score += 80;
            } else if (isVisible(element.parentElement)) {
              score += 30;
            }

            if (element instanceof HTMLInputElement) {
              score += 60;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'checkbox') {
              score += 50;
            }

            return {
              element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        if (directCandidates.length > 0) {
          return directCandidates[0].element;
        }

        const textContainer = getAgreementTextContainer(root);

        if (!textContainer) {
          return null;
        }

        const rect = textContainer.getBoundingClientRect();
        const scopeRoots = [
          textContainer,
          textContainer.closest('label'),
          textContainer.closest('div, section, form'),
          textContainer.parentElement,
          textContainer.previousElementSibling,
          textContainer.nextElementSibling
        ]
          .filter((element) => element instanceof HTMLElement);
        const seen = new Set();
        const customCandidates = [];

        scopeRoots.forEach((scopeRoot) => {
          const scopeElements = [
            scopeRoot,
            ...Array.from(scopeRoot.querySelectorAll('button, [role="button"], [role="checkbox"], label, span, div, i, em, strong'))
          ];

          scopeElements.forEach((element) => {
            if (!(element instanceof HTMLElement) || seen.has(element) || !isVisible(element)) {
              return;
            }

            seen.add(element);

            const elementRect = element.getBoundingClientRect();
            const stateText = getAgreementStateText(element);
            let score = 0;

            if (element === textContainer) {
              score += 60;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'checkbox') {
              score += 220;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'label') {
              score += 70;
            }

            if (/(checkbox|check|tick|agree|policy)/i.test(stateText)) {
              score += 140;
            }

            if (elementRect.width >= 10 && elementRect.width <= 42 && elementRect.height >= 10 && elementRect.height <= 42) {
              score += 90;
            }

            if (Math.abs(elementRect.top - rect.top) <= 24 || Math.abs(elementRect.bottom - rect.bottom) <= 24) {
              score += 36;
            }

            if (elementRect.right <= rect.left + 56) {
              score += 80;
            }

            if (elementRect.width <= Math.max(rect.width + 80, 360) && elementRect.height <= 64) {
              score += 18;
            }

            if (score > 0) {
              customCandidates.push({
                element,
                score
              });
            }
          });
        });

        const pointTargets = [
          { x: Math.max(4, rect.left - 36), y: rect.top + rect.height / 2 },
          { x: Math.max(4, rect.left - 24), y: rect.top + rect.height / 2 },
          { x: Math.max(4, rect.left - 12), y: rect.top + rect.height / 2 },
          { x: rect.left + 8, y: rect.top + rect.height / 2 }
        ];

        for (const point of pointTargets) {
          if (
            point.x < 0
            || point.y < 0
            || point.x > window.innerWidth
            || point.y > window.innerHeight
          ) {
            continue;
          }

          const rawElement = document.elementFromPoint(point.x, point.y);
          const element = rawElement instanceof HTMLElement
            ? (
              rawElement.closest('input[type="checkbox"], [role="checkbox"], button, [role="button"], label, div, span, i')
              || rawElement
            )
            : null;

          if (element instanceof HTMLElement && isVisible(element)) {
            customCandidates.push({
              element,
              score: 180
            });
          }
        }

        customCandidates.sort((left, right) => right.score - left.score);
        return customCandidates.length > 0 ? customCandidates[0].element : textContainer;
      }

      async function tryEnterGlobalAfterAgreement(globalEntryButton, currentShopName) {
        const targetButton = globalEntryButton instanceof HTMLElement && document.contains(globalEntryButton)
          ? globalEntryButton
          : findGlobalEntryButton();

        if (!(targetButton instanceof HTMLElement)) {
          return false;
        }

        const previousUrl = normalizeText(window.location.href);
        const previousBodyText = getBodyText();

        if (!triggerPointerClick(targetButton)) {
          return false;
        }

        await wait(320);

        if (normalizeText(window.location.href) !== previousUrl) {
          return true;
        }

        const nextBodyText = getBodyText();

        return Boolean(
          nextBodyText
          && nextBodyText !== previousBodyText
          && (!currentShopName || !nextBodyText.includes(currentShopName))
        );
      }

      async function ensureAgreementAccepted(globalEntryButton, currentShopName) {
        const bodyText = limitText(normalizeText(document.body && document.body.innerText), 1200);
        const agreementRequired = matchesAnyPattern(bodyText, agreementPatterns);

        if (!agreementRequired) {
          return {
            accepted: true,
            changed: false,
            found: false,
            navigated: false
          };
        }

        const agreementElement = findAgreementElement();

        if (!agreementElement) {
          return {
            accepted: false,
            changed: false,
            found: false,
            navigated: false
          };
        }

        if (isAgreementChecked(agreementElement)) {
          return {
            accepted: true,
            changed: false,
            found: true,
            navigated: false
          };
        }

        const clickTargets = [
          agreementElement,
          agreementElement.closest('label'),
          agreementElement.parentElement,
          getAgreementTextContainer()
        ]
          .filter((element, index, collection) => (
            element instanceof HTMLElement && collection.indexOf(element) === index
          ));
        const initialStateText = getAgreementStateText(agreementElement);

        for (const target of clickTargets) {
          triggerPointerClick(target);

          const refreshedAgreementElement = findAgreementElement() || agreementElement;
          const refreshedStateText = getAgreementStateText(refreshedAgreementElement);

          if (
            isAgreementChecked(refreshedAgreementElement)
            || (
              refreshedStateText
              && refreshedStateText !== initialStateText
              && !/\\bunchecked\\b/i.test(refreshedStateText)
            )
          ) {
            return {
              accepted: true,
              changed: true,
              found: true,
              navigated: false
            };
          }

          if (await tryEnterGlobalAfterAgreement(globalEntryButton, currentShopName)) {
            return {
              accepted: true,
              changed: true,
              found: true,
              navigated: true
            };
          }
        }

        return {
          accepted: false,
          changed: false,
          found: true,
          navigated: false
        };
      }

      function findAuthorizationConfirmButton(scopeRoot) {
        const root = scopeRoot instanceof HTMLElement ? scopeRoot : document;
        const candidates = Array.from(root.querySelectorAll('button, a, [role="button"], div, span'))
          .filter((element) => isVisible(element))
          .map((element) => {
            const hintText = getHintText(element);
            const normalizedHintText = normalizeText(hintText);
            const clickableTarget = getClickableTarget(element);
            let score = 0;

            if (!matchesAnyPattern(normalizedHintText, authorizationConfirmPatterns)) {
              return {
                element,
                score: -1
              };
            }

            if (isElementDisabled(clickableTarget || element)) {
              score -= 80;
            }

            if (/^\\s*\\u786e\\u8ba4\\u6388\\u6743\\u5e76\\u524d\\u5f80\\s*$/u.test(normalizedHintText)) {
              score += 260;
            } else {
              score += 180;
            }

            if (normalizeText(element.tagName).toLowerCase() === 'button') {
              score += 80;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'button') {
              score += 60;
            }

            if (normalizedHintText.length <= 36) {
              score += 30;
            }

            return {
              element: clickableTarget || element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function findAuthorizationDialogContainer() {
        const candidates = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], [class*="modal"], [class*="dialog"], [class*="popup"], [class*="drawer"], section, div'))
          .filter((element) => element instanceof HTMLElement && isVisible(element))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const hintText = limitText(getHintText(element), 1600);
            const hasConfirmButton = Boolean(findAuthorizationConfirmButton(element));
            const isDialogLike = Boolean(
              normalizeText(element.getAttribute('role')).toLowerCase() === 'dialog'
              || normalizeText(element.getAttribute('aria-modal')).toLowerCase() === 'true'
              || /(modal|dialog|popup|drawer)/i.test(normalizeText(element.className))
            );
            const patternCount = authorizationDialogPatterns.reduce((count, pattern) => (
              count + (pattern.test(hintText) ? 1 : 0)
            ), 0);
            let score = 0;

            if (patternCount <= 0 || (!hasConfirmButton && !isDialogLike)) {
              return {
                element,
                score: -1
              };
            }

            if (patternCount >= 2) {
              score += 180;
            } else {
              score += 80;
            }

            if (hasConfirmButton) {
              score += 220;
            }

            if (normalizeText(element.getAttribute('role')).toLowerCase() === 'dialog') {
              score += 180;
            }

            if (normalizeText(element.getAttribute('aria-modal')).toLowerCase() === 'true') {
              score += 140;
            }

            if (/(modal|dialog|popup|drawer)/i.test(normalizeText(element.className))) {
              score += 90;
            }

            if (rect.width >= 240 && rect.height >= 120) {
              score += 50;
            }

            if (rect.top >= 0 && rect.top <= window.innerHeight * 0.35) {
              score += 20;
            }

            if (hintText.length > 1200) {
              score -= 120;
            }

            return {
              element,
              score
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);

        return candidates.length > 0 ? candidates[0].element : null;
      }

      function getAuthorizationDialogState() {
        if (!window[AUTHORIZATION_DIALOG_STATE_KEY] || typeof window[AUTHORIZATION_DIALOG_STATE_KEY] !== 'object') {
          window[AUTHORIZATION_DIALOG_STATE_KEY] = {};
        }

        return window[AUTHORIZATION_DIALOG_STATE_KEY];
      }

      function buildAuthorizationDialogSignature(dialogContainer) {
        return [
          normalizeText(window.location && window.location.origin),
          normalizeText(window.location && window.location.pathname),
          limitText(getHintText(dialogContainer), 260)
        ]
          .filter(Boolean)
          .join('::');
      }

      function shouldThrottleAuthorizationAgreementClick(signature) {
        const state = getAuthorizationDialogState();

        return Boolean(
          normalizeText(state.lastAgreementSignature) === normalizeText(signature)
          && Date.now() - (Number(state.lastAgreementClickAt) || 0) < 2400
        );
      }

      function markAuthorizationAgreementClicked(signature) {
        const state = getAuthorizationDialogState();

        state.lastAgreementSignature = normalizeText(signature);
        state.lastAgreementClickAt = Date.now();
      }

      async function clickAuthorizationConfirmButton(confirmButton, agreementResult) {
        const normalizedAgreementResult = agreementResult && typeof agreementResult === 'object'
          ? agreementResult
          : {};

        if (!(confirmButton instanceof HTMLElement)) {
          return {
            present: true,
            accepted: true,
            clicked: false,
            navigated: false,
            confirmFound: false,
            agreementFound: normalizedAgreementResult.found === true,
            agreementChanged: normalizedAgreementResult.changed === true
          };
        }

        if (isElementDisabled(confirmButton)) {
          return {
            present: true,
            accepted: true,
            clicked: false,
            navigated: false,
            confirmFound: true,
            confirmDisabled: true,
            agreementFound: normalizedAgreementResult.found === true,
            agreementChanged: normalizedAgreementResult.changed === true
          };
        }

        const previousUrl = normalizeText(window.location.href);
        const previousBodyText = getBodyText();

        if (!triggerPointerClick(confirmButton)) {
          return {
            present: true,
            accepted: true,
            clicked: false,
            navigated: false,
            confirmFound: true,
            clickFailed: true,
            agreementFound: normalizedAgreementResult.found === true,
            agreementChanged: normalizedAgreementResult.changed === true
          };
        }

        await wait(480);

        const nextUrl = normalizeText(window.location.href);
        const nextBodyText = getBodyText();
        const navigated = Boolean(
          nextUrl !== previousUrl
          || (
            nextBodyText
            && nextBodyText !== previousBodyText
            && !matchesAnyPattern(nextBodyText, authorizationDialogPatterns)
          )
        );

        return {
          present: true,
          accepted: true,
          clicked: true,
          navigated,
          confirmFound: true,
          clickedText: limitText(getHintText(confirmButton), 120),
          agreementFound: normalizedAgreementResult.found === true,
          agreementChanged: normalizedAgreementResult.changed === true
        };
      }

      async function ensureAuthorizationAgreementAccepted(dialogContainer) {
        const agreementElement = findAgreementElement(dialogContainer);

        if (!agreementElement) {
          return {
            accepted: false,
            changed: false,
            found: false,
            throttled: false
          };
        }

        if (isAgreementChecked(agreementElement)) {
          return {
            accepted: true,
            changed: false,
            found: true,
            throttled: false
          };
        }

        const signature = buildAuthorizationDialogSignature(dialogContainer);

        if (shouldThrottleAuthorizationAgreementClick(signature)) {
          return {
            accepted: false,
            changed: false,
            found: true,
            throttled: true
          };
        }

        const clickTargets = [
          agreementElement,
          agreementElement.closest('label'),
          agreementElement.closest('div, section, form'),
          agreementElement.parentElement,
          getAgreementTextContainer(dialogContainer)
        ]
          .filter((element, index, collection) => (
            element instanceof HTMLElement && collection.indexOf(element) === index
          ));
        const initialStateText = getAgreementStateText(agreementElement);
        let clicked = false;

        for (const target of clickTargets) {
          const refreshedAgreementElement = findAgreementElement(dialogContainer) || agreementElement;

          if (isAgreementChecked(refreshedAgreementElement)) {
            return {
              accepted: true,
              changed: clicked,
              found: true,
              throttled: false
            };
          }

          if (!clicked) {
            markAuthorizationAgreementClicked(signature);
          }

          clicked = triggerPointerClick(target) || clicked;
          await wait(180);

          const nextAgreementElement = findAgreementElement(dialogContainer) || refreshedAgreementElement;
          const refreshedStateText = getAgreementStateText(nextAgreementElement);

          if (
            isAgreementChecked(nextAgreementElement)
            || (
              refreshedStateText
              && refreshedStateText !== initialStateText
              && !/\\bunchecked\\b/i.test(refreshedStateText)
            )
          ) {
            return {
              accepted: true,
              changed: true,
              found: true,
              throttled: false
            };
          }

          break;
        }

        return {
          accepted: isAgreementChecked(findAgreementElement(dialogContainer) || agreementElement),
          changed: clicked,
          found: true,
          throttled: false
        };
      }

      async function handleAuthorizationDialog(currentShopName) {
        const dialogContainer = findAuthorizationDialogContainer();

        if (!dialogContainer) {
          return {
            present: false,
            accepted: true,
            clicked: false,
            navigated: false,
            confirmFound: false
          };
        }

        let agreementResult = {
          accepted: false,
          changed: false,
          found: false
        };
        let confirmButton = findAuthorizationConfirmButton(dialogContainer) || findAuthorizationConfirmButton(document);

        if (confirmButton instanceof HTMLElement && !isElementDisabled(confirmButton)) {
          return clickAuthorizationConfirmButton(confirmButton, agreementResult);
        }

        agreementResult = await ensureAuthorizationAgreementAccepted(dialogContainer);

        if (agreementResult.changed === true) {
          await wait(180);
        }

        confirmButton = findAuthorizationConfirmButton(dialogContainer) || findAuthorizationConfirmButton(document);

        if (confirmButton instanceof HTMLElement && !isElementDisabled(confirmButton)) {
          return clickAuthorizationConfirmButton(confirmButton, agreementResult);
        }

        return {
          present: true,
          accepted: agreementResult.accepted === true,
          clicked: false,
          navigated: false,
          confirmFound: confirmButton instanceof HTMLElement,
          confirmDisabled: confirmButton instanceof HTMLElement && isElementDisabled(confirmButton),
          agreementFound: agreementResult.found === true,
          agreementChanged: agreementResult.changed === true,
          agreementThrottled: agreementResult.throttled === true
        };
      }

      function isGlobalTitle(text) {
        const normalizedText = normalizeText(text);

        return matchesAnyPattern(normalizedText, globalTitlePatterns) && !matchesAnyPattern(normalizedText, globalNegativePatterns);
      }

      function splitVisibleLines(text) {
        const normalizedText = normalizeText(text);

        if (!normalizedText) {
          return [];
        }

        return normalizedText
          .split(/[\\r\\n]+/)
          .map((line) => normalizeText(line))
          .filter(Boolean);
      }

      function getSiteEntryRegionFromTitle(text) {
        const normalizedText = normalizeText(text);

        if (/^\\s*(\\u5168\\u7403|global)\\s*$/iu.test(normalizedText)) {
          return 'global';
        }

        if (/^\\s*(\\u7f8e\\u56fd|us|usa|united\\s*states)\\s*$/iu.test(normalizedText)) {
          return 'us';
        }

        if (/^\\s*(\\u6b27\\u533a|eu|europe)\\s*$/iu.test(normalizedText)) {
          return 'eu';
        }

        return '';
      }

      function findSiteEntryTitle(scopeRoot, enterElement) {
        if (!(scopeRoot instanceof HTMLElement)) {
          return null;
        }

        const enterRect = enterElement instanceof HTMLElement
          ? enterElement.getBoundingClientRect()
          : null;
        const titleCandidates = [];

        splitVisibleLines(getVisibleText(scopeRoot)).forEach((line, index) => {
          const region = getSiteEntryRegionFromTitle(line);

          if (!region) {
            return;
          }

          titleCandidates.push({
            text: line,
            region,
            score: 120 - index
          });
        });

        Array.from(scopeRoot.querySelectorAll('div, span, p, h1, h2, h3, h4'))
          .filter((element) => element instanceof HTMLElement && element !== enterElement && isVisible(element))
          .forEach((element) => {
            const text = getVisibleText(element);
            const region = getSiteEntryRegionFromTitle(text);

            if (!region) {
              return;
            }

            const rect = element.getBoundingClientRect();
            let score = 240;

            if (enterRect) {
              const titleCenterX = rect.left + rect.width / 2;
              const enterCenterX = enterRect.left + enterRect.width / 2;
              const horizontalDistance = Math.abs(titleCenterX - enterCenterX);
              const verticalDistance = Math.max(0, enterRect.top - rect.top);

              if (verticalDistance >= 0 && verticalDistance <= 320) {
                score += Math.max(0, 140 - Math.round(verticalDistance / 3));
              } else {
                score -= 80;
              }

              if (horizontalDistance <= Math.max(120, rect.width * 3)) {
                score += 90;
              } else {
                score -= Math.min(120, Math.round(horizontalDistance / 4));
              }
            }

            titleCandidates.push({
              text,
              region,
              score
            });
          });

        titleCandidates.sort((left, right) => right.score - left.score);
        return titleCandidates.length > 0 ? titleCandidates[0] : null;
      }

      function isEnterButtonCandidate(element) {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          return false;
        }

        const hintText = getHintText(element);
        const className = normalizeText(element.className);
        const tagName = normalizeText(element.tagName).toLowerCase();
        const role = normalizeText(element.getAttribute('role')).toLowerCase();
        const visibleText = getVisibleText(element).replace(/\\s+/g, ' ');
        const rect = element.getBoundingClientRect();

        if (/site-main_enter/i.test(className)) {
          return true;
        }

        if (!matchesAnyPattern(hintText, enterPatterns)) {
          return false;
        }

        if (tagName === 'button' || tagName === 'a' || role === 'button') {
          return true;
        }

        return Boolean(
          /^\\s*(\\u8fdb\\u5165|enter)\\s*$/iu.test(visibleText)
          && rect.width <= Math.max(180, window.innerWidth * 0.25)
          && rect.height <= 72
        );
      }

      function collectUniqueEnterTargets(scopeRoot) {
        const root = scopeRoot instanceof HTMLElement ? scopeRoot : document;
        const seen = new Set();
        const targets = [];
        const collectFromElements = (elements) => {
          elements
            .filter((element) => element instanceof HTMLElement && isEnterButtonCandidate(element))
            .forEach((element) => {
              const target = getClickableTarget(element) || element;

              if (!(target instanceof HTMLElement) || seen.has(target)) {
                return;
              }

              seen.add(target);
              targets.push(target);
            });
        };

        collectFromElements(Array.from(root.querySelectorAll('[class*="site-main_enter"], button, a, [role="button"]')));

        if (targets.length === 0) {
          collectFromElements(Array.from(root.querySelectorAll('div, span')));
        }

        return targets;
      }

      function countEnterTargetsInScope(scopeRoot, enterTargets) {
        if (!(scopeRoot instanceof HTMLElement) || !Array.isArray(enterTargets)) {
          return 0;
        }

        return enterTargets.reduce((count, enterTarget) => (
          enterTarget instanceof HTMLElement && scopeRoot.contains(enterTarget)
            ? count + 1
            : count
        ), 0);
      }

      function getSiteEntryCardDebug(card) {
        if (!card || typeof card !== 'object') {
          return null;
        }

        return {
          region: normalizeText(card.region),
          title: normalizeText(card.title),
          enterText: limitText(getHintText(card.enterButton), 80),
          scopeText: limitText(card.scopeText, 220),
          enterCount: Number(card.enterCount) || 0,
          score: Number(card.score) || 0
        };
      }

      function collectSiteEntryCards() {
        const enterElements = collectUniqueEnterTargets(document);
        const candidates = [];
        const seenScopeKeys = new Set();

        enterElements.forEach((enterElement) => {
          let currentElement = enterElement;
          let depth = 0;

          while (currentElement && currentElement !== document.body && depth < 10) {
            if (!(currentElement instanceof HTMLElement) || !isVisible(currentElement)) {
              currentElement = currentElement && currentElement.parentElement;
              depth += 1;
              continue;
            }

            const rect = currentElement.getBoundingClientRect();
            const scopeText = limitText(getVisibleText(currentElement), 720);
            const enterCount = countEnterTargetsInScope(currentElement, enterElements);
            const titleEntry = findSiteEntryTitle(currentElement, enterElement);

            if (
              scopeText
              && titleEntry
              && enterCount > 0
              && rect.width >= 96
              && rect.height >= 56
              && rect.width <= Math.max(720, window.innerWidth * 0.72)
              && rect.height <= Math.max(520, window.innerHeight * 0.70)
            ) {
              const scopeKey = [
                titleEntry.region,
                Math.round(rect.left),
                Math.round(rect.top),
                Math.round(rect.width),
                Math.round(rect.height),
                limitText(scopeText, 80)
              ].join('|');

              if (!seenScopeKeys.has(scopeKey)) {
                let score = titleEntry.score;
                const className = normalizeText(enterElement.className);

                if (titleEntry.region === 'global') {
                  score += 700;
                } else if (titleEntry.region === 'us' || titleEntry.region === 'eu') {
                  score += 120;
                }

                if (enterCount === 1) {
                  score += 240;
                } else {
                  score -= Math.min(420, (enterCount - 1) * 180);
                }

                if (/site-main_enter/i.test(className)) {
                  score += 180;
                }

                if (matchesAnyPattern(getHintText(enterElement), enterPatterns)) {
                  score += 120;
                }

                score -= Math.min(180, depth * 18);
                score -= Math.min(160, Math.round((rect.width * rect.height) / 22000));

                candidates.push({
                  region: titleEntry.region,
                  title: titleEntry.text,
                  enterButton: getClickableTarget(enterElement) || enterElement,
                  scopeElement: currentElement,
                  scopeText,
                  enterCount,
                  score
                });

                seenScopeKeys.add(scopeKey);
              }
            }

            currentElement = currentElement.parentElement;
            depth += 1;
          }
        });

        candidates.sort((left, right) => (
          right.score - left.score
          || left.enterCount - right.enterCount
          || normalizeText(left.scopeText).length - normalizeText(right.scopeText).length
        ));

        return candidates;
      }

      function buildSiteMainPageModel() {
        const entryCards = collectSiteEntryCards();
        const globalEntryCard = entryCards.find((card) => normalizeText(card.region) === 'global') || null;

        return {
          currentShopInfo: findCurrentShopInfo(),
          targetShopVisibleNearTop: isTargetShopVisibleNearTop(),
          entryCards,
          globalEntryCard,
          globalEntryButton: globalEntryCard ? globalEntryCard.enterButton : null
        };
      }

      function summarizeSiteMainPageModel(model) {
        const normalizedModel = model && typeof model === 'object' ? model : {};

        return {
          currentShopName: normalizeText(normalizedModel.currentShopInfo && normalizedModel.currentShopInfo.shopName),
          currentShopRowText: limitText(normalizedModel.currentShopInfo && normalizedModel.currentShopInfo.rowText, 180),
          targetShopVisibleNearTop: normalizedModel.targetShopVisibleNearTop === true,
          globalEntryFound: normalizedModel.globalEntryButton instanceof HTMLElement,
          entryCards: Array.isArray(normalizedModel.entryCards)
            ? normalizedModel.entryCards.slice(0, 6).map(getSiteEntryCardDebug).filter(Boolean)
            : []
        };
      }

      function findGlobalEntryButtonByEnterCards() {
        const globalEntryCard = collectSiteEntryCards()
          .find((card) => normalizeText(card.region) === 'global');

        return globalEntryCard ? globalEntryCard.enterButton : null;
      }

      function findGlobalEntryButton() {
        return findGlobalEntryButtonByEnterCards();
      }

      function buildResult(status, extra) {
        return {
          status,
          targetShopName: normalizeText(runtimePayload.targetShopName),
          bodyTextPreview: limitText(getBodyText(), 600),
          ...(extra && typeof extra === 'object' ? extra : {})
        };
      }

      async function run() {
        const pageModel = buildSiteMainPageModel();
        const siteMainModel = summarizeSiteMainPageModel(pageModel);

        if (
          !pageModel.currentShopInfo
          && pageModel.targetShopVisibleNearTop !== true
          && !(pageModel.globalEntryButton instanceof HTMLElement)
          && hasLoadingIndicator()
        ) {
          return buildResult('pending-page-ready', {
            currentShopName: '',
            shopRowText: '',
            siteMainModel
          });
        }

        const targetShopName = normalizeText(runtimePayload.targetShopName);
        const currentShopInfo = pageModel.currentShopInfo;
        const currentShopName = normalizeText(currentShopInfo && currentShopInfo.shopName)
          || (pageModel.targetShopVisibleNearTop ? targetShopName : '');
        const normalizedTargetShopName = normalizeMatchText(targetShopName);
        const normalizedCurrentShopName = normalizeMatchText(currentShopName);
        const globalEntryButton = pageModel.globalEntryButton;
        const shopReadyForGlobalEntry = Boolean(
          !normalizedTargetShopName
          || normalizedCurrentShopName === normalizedTargetShopName
          || normalizedCurrentShopName.includes(normalizedTargetShopName)
          || normalizedTargetShopName.includes(normalizedCurrentShopName)
        );

        if (normalizedTargetShopName) {
          if (!normalizedCurrentShopName) {
            if (hasLoadingIndicator() && !globalEntryButton) {
              return buildResult('pending-page-ready', {
                currentShopName: '',
                shopRowText: normalizeText(currentShopInfo && currentShopInfo.rowText),
                siteMainModel
              });
            }

            return buildResult('missing-current-shop', {
              currentShopName,
              shopRowText: normalizeText(currentShopInfo && currentShopInfo.rowText),
              globalEntryFound: globalEntryButton instanceof HTMLElement,
              siteMainModel
            });
          }

          if (
            normalizedCurrentShopName !== normalizedTargetShopName
            && !normalizedCurrentShopName.includes(normalizedTargetShopName)
            && !normalizedTargetShopName.includes(normalizedCurrentShopName)
          ) {
            const switchTrigger = currentShopInfo && currentShopInfo.trigger
              ? currentShopInfo.trigger
              : null;

            if (!switchTrigger) {
              return buildResult('switch-trigger-not-found', {
                currentShopName,
                siteMainModel
              });
            }

            if (!triggerPointerClick(switchTrigger)) {
              return buildResult('switch-trigger-click-failed', {
                currentShopName,
                siteMainModel
              });
            }

            await wait(320);

            let targetShopOption = findTargetShopOption();

            if (!targetShopOption) {
              await wait(540);
              targetShopOption = findTargetShopOption();
            }

            if (!targetShopOption) {
              return buildResult('switch-target-not-found', {
                currentShopName,
                siteMainModel
              });
            }

            if (!triggerPointerClick(targetShopOption)) {
              return buildResult('switch-target-click-failed', {
                currentShopName,
                clickedText: limitText(getHintText(targetShopOption), 120),
                siteMainModel
              });
            }

            return buildResult('switched-shop', {
              currentShopName,
              clickedText: limitText(getHintText(targetShopOption), 120)
            });
          }
        }

        const authorizationDialogResult = await handleAuthorizationDialog(currentShopName);

        if (authorizationDialogResult.present === true) {
          if (authorizationDialogResult.navigated === true) {
            return buildResult('entered-global', {
              currentShopName,
              clickedText: normalizeText(authorizationDialogResult.clickedText),
              authorizationDialog: authorizationDialogResult,
              siteMainModel
            });
          }

          if (authorizationDialogResult.clicked === true) {
            return buildResult('authorization-confirm-clicked', {
              currentShopName,
              clickedText: normalizeText(authorizationDialogResult.clickedText),
              authorizationDialog: authorizationDialogResult,
              siteMainModel
            });
          }

          return buildResult('pending-authorization', {
            currentShopName,
            authorizationDialog: authorizationDialogResult,
            siteMainModel
          });
        }

        const agreementResult = await ensureAgreementAccepted(globalEntryButton, currentShopName);

        if (agreementResult.navigated) {
          return buildResult('entered-global', {
            currentShopName,
            clickedText: limitText(getHintText(globalEntryButton), 120),
            siteMainModel
          });
        }

        if (!agreementResult.accepted) {
          return buildResult('pending-agreement', {
            currentShopName,
            agreementFound: agreementResult.found === true,
            siteMainModel
          });
        }

        if (!globalEntryButton) {
          if (hasLoadingIndicator()) {
            return buildResult('pending-page-ready', {
              currentShopName,
              siteMainModel
            });
          }

          return buildResult('missing-global-entry', {
            currentShopName,
            siteMainModel
          });
        }

        if (!shopReadyForGlobalEntry) {
          return buildResult('shop-not-ready-for-global-entry', {
            currentShopName,
            siteMainModel
          });
        }

        if (!triggerPointerClick(globalEntryButton)) {
          return buildResult('global-click-failed', {
            currentShopName,
            clickedText: limitText(getHintText(globalEntryButton), 120),
            siteMainModel
          });
        }

        return buildResult('entered-global', {
          currentShopName,
          clickedText: limitText(getHintText(globalEntryButton), 120),
          siteMainModel
        });
      }

      return run();
    })();
  `;
}

module.exports = {
  buildSellerCenterLandingScript
};
