const { normalizeText } = require('../services/shopManagement/common');

function buildShopMallSwitchScript(payload) {
  const runtimePayload = JSON.stringify({
    targetShopName: normalizeText(payload && payload.targetShopName),
    targetMallId: normalizeText(payload && payload.targetMallId),
    targetMallUniqueId: normalizeText(payload && payload.targetMallUniqueId)
  });

  return `
    (() => {
      const switchPayload = ${runtimePayload};

      function normalizeText(value) {
        return String(value || '').trim();
      }

      function normalizeMatchText(value) {
        return normalizeText(value).toLowerCase().replace(/\\s+/g, '');
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

      function getElementText(element) {
        if (!(element instanceof HTMLElement)) {
          return '';
        }

        return [
          normalizeText(element.textContent),
          normalizeText(element.getAttribute('aria-label')),
          normalizeText(element.getAttribute('title')),
          normalizeText(element.getAttribute('data-testid')),
          normalizeText(element.getAttribute('data-id')),
          normalizeText(element.id),
          normalizeText(element.className)
        ]
          .filter(Boolean)
          .join(' ');
      }

      function isClickableElement(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const tagName = normalizeText(element.tagName).toLowerCase();
        const role = normalizeText(element.getAttribute('role')).toLowerCase();

        return (
          ['button', 'a', 'summary'].includes(tagName)
          || ['button', 'menuitem', 'option', 'tab', 'link', 'treeitem'].includes(role)
          || typeof element.onclick === 'function'
        );
      }

      function triggerPointerClick(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        try {
          element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          element.click();
          return true;
        } catch (_error) {
          try {
            element.click();
            return true;
          } catch (__error) {
            return false;
          }
        }
      }

      function matchesTargetElement(element) {
        if (!(element instanceof HTMLElement) || !isVisible(element)) {
          return false;
        }

        const matchTarget = normalizeMatchText(switchPayload.targetShopName);

        if (!matchTarget) {
          return false;
        }

        const text = getElementText(element);
        const normalizedText = normalizeMatchText(text);

        if (normalizedText === matchTarget || normalizedText.includes(matchTarget)) {
          return true;
        }

        const dataset = element.dataset || {};
        const targetMallId = normalizeText(switchPayload.targetMallId);
        const targetMallUniqueId = normalizeText(switchPayload.targetMallUniqueId);

        return (
          (targetMallId && Object.values(dataset).some((value) => normalizeText(value) === targetMallId))
          || (targetMallUniqueId && Object.values(dataset).some((value) => normalizeText(value) === targetMallUniqueId))
        );
      }

      function findSwitchTargetElement() {
        const candidateSelectors = [
          '[role="menuitem"]',
          '[role="option"]',
          '[role="tab"]',
          'button',
          'a',
          'li',
          'div',
          'span'
        ].join(', ');

        const candidates = Array.from(document.querySelectorAll(candidateSelectors))
          .filter((element) => isVisible(element))
          .filter((element) => matchesTargetElement(element))
          .filter((element) => isClickableElement(element) || isClickableElement(element.closest('button, a, [role="menuitem"], [role="option"], [role="tab"]')));

        if (candidates.length === 0) {
          return null;
        }

        const exactMatch = candidates.find((element) => {
          const normalizedText = normalizeMatchText(getElementText(element));
          return normalizedText === normalizeMatchText(switchPayload.targetShopName);
        });

        return exactMatch || candidates[0];
      }

      function findSwitchTriggerElements() {
        const triggerHintPatterns = [
          /shop/i,
          /store/i,
          /mall/i,
          /merchant/i,
          /switch/i,
          /\\u5E97\\u94FA/u,
          /\\u5546\\u5BB6/u,
          /\\u5207\\u6362/u
        ];

        return Array.from(document.querySelectorAll('button, a, div, span, [role="button"], [role="tab"]'))
          .filter((element) => isVisible(element))
          .filter((element) => {
            const text = getElementText(element).toLowerCase();
            return triggerHintPatterns.some((pattern) => pattern.test(text));
          })
          .filter((element) => isClickableElement(element) || isClickableElement(element.closest('button, a, [role="button"], [role="tab"]')));
      }

      function getClickableTarget(element) {
        if (!(element instanceof HTMLElement)) {
          return null;
        }

        return element.closest('button, a, [role="menuitem"], [role="option"], [role="tab"], [role="button"]') || element;
      }

      function wait(ms) {
        return new Promise((resolve) => {
          window.setTimeout(resolve, ms);
        });
      }

      async function runSwitch() {
        if (!normalizeText(switchPayload.targetShopName)) {
          return {
            status: 'missing-target'
          };
        }

        const directTarget = findSwitchTargetElement();

        if (directTarget && triggerPointerClick(getClickableTarget(directTarget))) {
          return {
            status: 'switched',
            clickedText: normalizeText(getElementText(directTarget))
          };
        }

        const triggers = findSwitchTriggerElements();

        for (const trigger of triggers) {
          if (!triggerPointerClick(getClickableTarget(trigger))) {
            continue;
          }

          await wait(260);

          const targetElement = findSwitchTargetElement();

          if (targetElement && triggerPointerClick(getClickableTarget(targetElement))) {
            return {
              status: 'switched',
              clickedText: normalizeText(getElementText(targetElement)),
              triggerText: normalizeText(getElementText(trigger))
            };
          }
        }

        return {
          status: triggers.length > 0 ? 'target-not-found' : 'trigger-not-found'
        };
      }

      return runSwitch();
    })();
  `;
}

module.exports = {
  buildShopMallSwitchScript
};
