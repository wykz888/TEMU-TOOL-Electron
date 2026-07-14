import { computed, ref } from 'vue';
import {
  normalizeMockup,
  normalizeMockupList,
  normalizePsdExportMode,
  normalizePsdImageQuality,
  normalizePsdOutputFormat
} from './psdSmartSuiteModels.js';

export function usePsdSmartSuiteMockups() {
  const mockups = ref([]);
  const readyMockupCount = computed(() => (
    mockups.value.filter((item) => item.psdPath && item.outputDirectoryPath).length
  ));

  function ensureMockups() {
    if (!Array.isArray(mockups.value) || mockups.value.length === 0) {
      mockups.value = [normalizeMockup({})];
      return;
    }

    mockups.value = mockups.value.map((item) => normalizeMockup(item));
  }

  function setMockups(nextMockups) {
    mockups.value = normalizeMockupList(nextMockups);
  }

  function addMockup() {
    mockups.value.push(normalizeMockup({}));
  }

  function removeMockup(mockupId) {
    if (mockups.value.length <= 1) {
      return;
    }

    mockups.value = mockups.value.filter((item) => item.id !== mockupId);
    ensureMockups();
  }

  function updateMockupField(mockupId, field, value) {
    mockups.value = mockups.value.map((item) => {
      if (item.id !== mockupId) {
        return item;
      }

      const nextItem = {
        ...item,
        [field]: value
      };

      if (field === 'imageQuality') {
        nextItem.imageQuality = normalizePsdImageQuality(value);
      }

      if (field === 'exportMode') {
        nextItem.exportMode = normalizePsdExportMode(value);
      }

      if (field === 'outputFormat') {
        nextItem.outputFormat = normalizePsdOutputFormat(value);
      }

      return nextItem;
    });
  }

  return {
    addMockup,
    ensureMockups,
    mockups,
    readyMockupCount,
    removeMockup,
    setMockups,
    updateMockupField
  };
}
