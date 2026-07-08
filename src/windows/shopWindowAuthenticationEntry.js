function buildSellerCenterAuthenticationEntryScript() {
  return `
    (() => {
      const primaryEntryPatterns = [
        /\\u5546\\u5BB6\\u4E2D\\u5FC3/u,
        /\\u5356\\u5BB6\\u4E2D\\u5FC3/u,
        /seller\\s*center/i,
        /agent\\s*seller/i,
        /temu\\s*seller/i
      ];
      const loginPatterns = [
        /\\u767B\\u5F55/u,
        /sign\\s*in/i,
        /log\\s*in/i
      ];
      const negativePatterns = [
        /\\u5546\\u54C1\\u63A8\\u5E7F/u,
        /\\u5E7F\\u544A/u,
        /ads/i,
        /promotion/i
      ];
      const loadingPatterns = [
        /\\u52A0\\u8F7D\\u4E2D/u,
        /loading/i,
        /please\\s*wait/i
      ];
      const rootContainerPatterns = [
        /sca-auth-root/i,
        /\\bauth-root\\b/i
      ];
      const genericContainerPatterns = [
        /\\bcontainer\\b/i,
        /\\bwrapper\\b/i,
        /\\blayout\\b/i,
        /\\bpage\\b/i,
        /\\broot\\b/i
      ];
      const regionPatterns = [
        {
          key: 'global',
          pattern: /\\u5168\\u7403|global/i
        },
        {
          key: 'us',
          pattern: /\\u7F8E\\u56FD|america|usa|\\bus\\b/i
        }
      ];
      const confidenceThreshold = 180;
      const manualSelectionThreshold = 220;

      function normalizeText(value) {
        return String(value || '').trim();
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

      function detectRegionKey(text) {
        const normalizedText = normalizeText(text);
        const matchedEntry = regionPatterns.find((entry) => entry.pattern.test(normalizedText));
        return matchedEntry ? matchedEntry.key : '';
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

      function isInteractiveElement(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const tagName = normalizeText(element.tagName).toLowerCase();
        const role = normalizeText(element.getAttribute('role')).toLowerCase();
        const href = normalizeText(element.getAttribute('href'));
        const onclick = normalizeText(element.getAttribute('onclick'));
        const tabIndexValue = element.getAttribute('tabindex');
        const tabIndex = Number(tabIndexValue);
        const style = window.getComputedStyle(element);
        const cursor = normalizeText(style && style.cursor).toLowerCase();

        return Boolean(
          tagName === 'a'
          || tagName === 'button'
          || tagName === 'summary'
          || tagName === 'input'
          || role === 'button'
          || role === 'link'
          || href
          || onclick
          || (
            tabIndexValue !== null
            && Number.isFinite(tabIndex)
            && tabIndex >= 0
          )
          || cursor === 'pointer'
        );
      }

      function getInteractiveTarget(element) {
        let current = element instanceof HTMLElement ? element : null;

        while (current) {
          if (isVisible(current) && isInteractiveElement(current)) {
            return current;
          }

          current = current.parentElement;
        }

        return null;
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
          normalizeText(element.getAttribute('href')),
          normalizeText(element.id),
          normalizeText(element.className)
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\\s+/g, ' ')
          .toLowerCase();
      }

      function triggerPointerClick(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        try {
          element.scrollIntoView({
            block: 'center',
            inline: 'nearest'
          });
        } catch (_error) {
          // Ignore scroll failures.
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

      function buildCandidatePreview(entries) {
        return entries.slice(0, 4).map((entry) => ({
          score: entry.score,
          regionKey: entry.regionKey,
          targetTagName: entry.targetTagName,
          hintText: limitText(entry.hintText, 120),
          href: limitText(entry.href, 180)
        }));
      }

      function collectCandidates() {
        const viewportWidth = Math.max(
          Number(document.documentElement && document.documentElement.clientWidth) || 0,
          Number(window.innerWidth) || 0,
          1
        );
        const viewportHeight = Math.max(
          Number(document.documentElement && document.documentElement.clientHeight) || 0,
          Number(window.innerHeight) || 0,
          1
        );
        const targetEntries = new Map();
        const sourceNodes = Array.from(
          document.querySelectorAll('a, button, [role="button"], [role="link"], [tabindex], [onclick], div, span, p, strong, em')
        ).filter((element) => isVisible(element));

        sourceNodes.forEach((sourceElement) => {
          const targetElement = getInteractiveTarget(sourceElement);

          if (!(targetElement instanceof HTMLElement) || !isVisible(targetElement)) {
            return;
          }

          const sourceHintText = getHintText(sourceElement);
          const targetHintText = getHintText(targetElement);
          const combinedHintText = normalizeText(sourceHintText + ' ' + targetHintText).toLowerCase();

          if (!combinedHintText || combinedHintText.length > 240) {
            return;
          }

          const currentEntry = targetEntries.get(targetElement) || {
            element: targetElement,
            hintText: '',
            sourceCount: 0
          };
          const nextHintText =
            !currentEntry.hintText
            || combinedHintText.length < currentEntry.hintText.length
              ? combinedHintText
              : currentEntry.hintText;

          currentEntry.hintText = nextHintText;
          currentEntry.sourceCount += 1;
          targetEntries.set(targetElement, currentEntry);
        });

        return Array.from(targetEntries.values())
          .map((entry) => {
            const element = entry.element;
            const hintText = normalizeText(entry.hintText || getHintText(element)).toLowerCase();
            const tagName = normalizeText(element.tagName).toLowerCase();
            const href = normalizeText(element.getAttribute('href')).toLowerCase();
            const regionKey = detectRegionKey(hintText);
            let score = 0;

            if (!hintText) {
              return {
                ...entry,
                score: -1,
                href,
                regionKey,
                targetTagName: tagName
              };
            }

            if (matchesAnyPattern(hintText, negativePatterns)) {
              score -= 180;
            }

            if (matchesAnyPattern(hintText, loadingPatterns)) {
              score -= 180;
            }

            if (matchesAnyPattern(hintText, rootContainerPatterns)) {
              score -= 260;
            } else if (matchesAnyPattern(hintText, genericContainerPatterns)) {
              score -= 120;
            }

            if (matchesAnyPattern(hintText, primaryEntryPatterns)) {
              score += 220;
            }

            if (matchesAnyPattern(hintText, loginPatterns)) {
              score += 60;
            }

            if (isInteractiveElement(element)) {
              score += 80;
            }

            if (tagName === 'a' || tagName === 'button') {
              score += 50;
            }

            if (href.includes('seller') || href.includes('login') || href.includes('auth')) {
              score += 140;
            }

            if (hintText.length <= 24) {
              score += 30;
            } else if (hintText.length >= 120) {
              score -= 100;
            }

            if (entry.sourceCount >= 5) {
              score -= 80;
            }

            const rect = element.getBoundingClientRect();
            const areaRatio = (rect.width * rect.height) / (viewportWidth * viewportHeight);

            if (rect.width >= 120 && rect.height >= 28) {
              score += 20;
            }

            if (areaRatio >= 0.55) {
              score -= 260;
            } else if (areaRatio >= 0.35) {
              score -= 140;
            }

            if (rect.width >= viewportWidth * 0.92 && rect.height >= viewportHeight * 0.45) {
              score -= 180;
            }

            return {
              ...entry,
              score,
              href,
              regionKey,
              targetTagName: tagName
            };
          })
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score);
      }

      const candidates = collectCandidates();
      const bestCandidate = candidates[0] || null;
      const candidatePreview = buildCandidatePreview(candidates);
      const strongRegionKeys = Array.from(new Set(
        candidates
          .filter((entry) => entry.score >= manualSelectionThreshold && entry.regionKey)
          .map((entry) => entry.regionKey)
      ));
      const bodyTextPreview = limitText(normalizeText(document.body && document.body.innerText), 800);

      if (strongRegionKeys.length >= 2) {
        return {
          status: 'manual-selection-required',
          candidatePreview,
          bodyTextPreview
        };
      }

      if (!bestCandidate || bestCandidate.score < confidenceThreshold) {
        return {
          status: matchesAnyPattern(bodyTextPreview.toLowerCase(), loadingPatterns) ? 'loading' : 'waiting-entry',
          candidatePreview,
          bodyTextPreview
        };
      }

      return {
        status: triggerPointerClick(bestCandidate.element) ? 'clicked' : 'click-failed',
        hintText: limitText(bestCandidate.hintText, 240),
        href: limitText(normalizeText(bestCandidate.element.getAttribute('href')), 240),
        candidatePreview,
        targetTagName: bestCandidate.targetTagName,
        regionKey: bestCandidate.regionKey,
        bodyTextPreview
      };
    })();
  `;
}

module.exports = {
  buildSellerCenterAuthenticationEntryScript
};
