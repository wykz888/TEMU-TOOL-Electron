<template>
  <a-modal
    :visible="carouselPresetVisible"
    :mask-closable="false"
    :footer="false"
    modal-class="pod-miaoshou-operation-modal pod-carousel-preset-modal"
    @cancel="closeCarouselPreset"
  >
    <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x4E3B;&#x56FE;/&#x8F6E;&#x64AD;&#x56FE;</template>
    <div class="pod-carousel-preset-body">
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x56FE;&#x7247;&#x6587;&#x4EF6;&#x5217;&#x8868;</strong>
            <span>&#x4ECE;&#x5DF2;&#x5BFC;&#x5165;&#x5546;&#x54C1;&#x7684;&#x8F6E;&#x64AD;&#x56FE;&#x4E2D;&#x9009;&#x62E9;</span>
          </div>
          <a-tag class="pod-carousel-count-tag" bordered>{{ carouselPresetCandidates.length }} &#x5F20;</a-tag>
        </div>
        <div class="pod-carousel-preset-toolbar">
          <a-button size="small" @click="clearCarouselPresetItems">&#x53D6;&#x6D88;&#x5168;&#x9009;</a-button>
          <a-button size="small" @click="selectAllCarouselPresetItems">&#x5168;&#x90E8;&#x52FE;&#x9009;</a-button>
          <span>{{ carouselPresetSelected.length }} / {{ carouselPresetCandidates.length }}</span>
        </div>
        <div class="pod-carousel-candidate-list">
          <label
            v-for="item in carouselPresetCandidates"
            :key="item.name"
            class="pod-carousel-candidate-item"
            :class="{ 'is-selected': isCarouselPresetSelected(item.name) }"
          >
            <a-checkbox :model-value="isCarouselPresetSelected(item.name)" @change="(checked) => toggleCarouselPresetItem(item.name, checked)" />
            <span class="pod-carousel-file-name" :title="item.name">{{ item.name }}</span>
            <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
          </label>
          <a-empty v-if="!carouselPresetCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
        </div>
      </section>
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x9009;&#x4E2D;&#x8F6E;&#x64AD;&#x987A;&#x5E8F;</strong>
            <span>&#x786E;&#x8BA4;&#x540E;&#x4F1A;&#x6309;&#x6B64;&#x987A;&#x5E8F;&#x6392;&#x5230;&#x524D;&#x9762;</span>
          </div>
          <a-tag class="pod-carousel-count-tag" bordered>{{ carouselPresetSelected.length }} &#x5F20;</a-tag>
        </div>
        <div class="pod-carousel-selected-list">
          <div v-for="(name, index) in carouselPresetSelected" :key="name" class="pod-carousel-selected-item">
            <span class="pod-carousel-order-index">{{ index + 1 }}</span>
            <div class="pod-carousel-assigned-file">
              <span>&#x7B2C; {{ index + 1 }} &#x5F20;&#x5206;&#x914D;&#x56FE;&#x7247;</span>
              <a-tooltip :content="getCarouselPresetFileTip(name)">
                <strong>{{ getCarouselPresetDisplayName(name) }}</strong>
              </a-tooltip>
            </div>
            <div class="pod-carousel-order-actions">
              <a-button size="mini" :disabled="index === 0" @click="moveCarouselPresetItem(index, -1)">&#x4E0A;&#x79FB;</a-button>
              <a-button size="mini" :disabled="index === carouselPresetSelected.length - 1" @click="moveCarouselPresetItem(index, 1)">&#x4E0B;&#x79FB;</a-button>
            </div>
          </div>
          <a-empty v-if="!carouselPresetSelected.length" class="pod-carousel-empty" description="&#x8BF7;&#x5728;&#x5DE6;&#x4FA7;&#x52FE;&#x9009;&#x56FE;&#x7247;" />
        </div>
      </section>
    </div>
    <div class="pod-modal-footer pod-carousel-preset-footer">
      <a-button @click="closeCarouselPreset">&#x53D6;&#x6D88;</a-button>
      <a-button class="pod-theme-button" type="primary" :disabled="!carouselPresetSelected.length" @click="applyCarouselPreset">&#x5E94;&#x7528;&#x9884;&#x8BBE;</a-button>
    </div>
  </a-modal>

  <a-modal
    :visible="randomCarouselVisible"
    :mask-closable="false"
    :footer="false"
    modal-class="pod-miaoshou-operation-modal pod-carousel-preset-modal pod-random-carousel-modal"
    @cancel="closeRandomCarouselPreset"
  >
    <template #title>&#x6279;&#x91CF;&#x968F;&#x673A;&#x4E3B;&#x56FE;</template>
    <div class="pod-carousel-preset-body pod-random-carousel-body">
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x56FE;&#x7247;&#x6587;&#x4EF6;&#x5217;&#x8868;</strong>
            <span>&#x52FE;&#x9009;&#x53C2;&#x4E0E;&#x968F;&#x673A;&#x7684;&#x8F6E;&#x64AD;&#x56FE;&#x5E8F;&#x53F7;</span>
          </div>
          <a-tag class="pod-carousel-count-tag" bordered>{{ randomCarouselCandidates.length }} &#x5F20;</a-tag>
        </div>
        <div class="pod-carousel-preset-toolbar">
          <a-button size="small" @click="clearRandomCarouselItems">&#x53D6;&#x6D88;&#x5168;&#x9009;</a-button>
          <a-button size="small" @click="selectAllRandomCarouselItems">&#x5168;&#x90E8;&#x52FE;&#x9009;</a-button>
          <span>{{ randomCarouselSelected.length }} / {{ randomCarouselCandidates.length }}</span>
        </div>
        <div class="pod-carousel-candidate-list">
          <label
            v-for="item in randomCarouselCandidates"
            :key="item.order"
            class="pod-carousel-candidate-item"
            :class="{ 'is-selected': isRandomCarouselSelected(item.order) }"
          >
            <a-checkbox :model-value="isRandomCarouselSelected(item.order)" @change="(checked) => toggleRandomCarouselItem(item.order, checked)" />
            <div class="pod-carousel-assigned-file">
              <span>&#x7B2C; {{ item.order }} &#x4E2A;&#x8F6E;&#x64AD;&#x4F4D;</span>
              <a-tooltip :content="getRandomCarouselItemTip(item)">
                <strong>{{ item.displayName }}</strong>
              </a-tooltip>
            </div>
            <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
          </label>
          <a-empty v-if="!randomCarouselCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
        </div>
      </section>
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x9009;&#x4E2D;&#x968F;&#x673A;&#x987A;&#x5E8F;</strong>
            <span>&#x53EA;&#x5BF9;&#x5DF2;&#x52FE;&#x9009;&#x7684;&#x5E8F;&#x53F7;&#x8FDB;&#x884C;&#x4EA4;&#x6362;</span>
          </div>
          <label class="pod-random-carousel-only-first">
            <a-checkbox :model-value="randomCarouselOnlyFirst" @change="(checked) => $emit('update:randomCarouselOnlyFirst', checked)" />
            <span>&#x53EA;&#x6539;&#x9996;&#x56FE;</span>
          </label>
        </div>
        <div class="pod-carousel-preset-toolbar">
          <span>{{ randomCarouselSelected.length }} &#x4E2A;&#x5E8F;&#x53F7;&#x5DF2;&#x9009;</span>
        </div>
        <div class="pod-carousel-selected-list">
          <div v-for="order in randomCarouselSelected" :key="order" class="pod-carousel-selected-item">
            <span class="pod-carousel-order-index">{{ order }}</span>
            <div class="pod-carousel-assigned-file">
              <span>&#x53C2;&#x4E0E;&#x968F;&#x673A;</span>
              <a-tooltip :content="getRandomCarouselItemTip(getRandomCarouselCandidate(order))">
                <strong>{{ getRandomCarouselCandidate(order) ? getRandomCarouselCandidate(order).displayName : ('#' + order) }}</strong>
              </a-tooltip>
            </div>
            <span class="pod-carousel-file-count">{{ getRandomCarouselCandidate(order) ? getRandomCarouselCandidate(order).count : 0 }} &#x4E2A;&#x5546;&#x54C1;</span>
          </div>
          <a-empty v-if="!randomCarouselSelected.length" class="pod-carousel-empty" description="&#x8BF7;&#x5728;&#x5DE6;&#x4FA7;&#x52FE;&#x9009;&#x56FE;&#x7247;" />
        </div>
      </section>
    </div>
    <div class="pod-modal-footer pod-random-carousel-footer">
      <a-button @click="closeRandomCarouselPreset">&#x53D6;&#x6D88;</a-button>
      <a-button class="pod-theme-button" type="primary" :disabled="!randomCarouselSelected.length" @click="applyRandomCarouselPreset">&#x5E94;&#x7528;&#x968F;&#x673A;</a-button>
    </div>
  </a-modal>

  <a-modal
    :visible="descriptionPresetVisible"
    :mask-closable="false"
    :footer="false"
    modal-class="pod-miaoshou-operation-modal pod-carousel-preset-modal"
    @cancel="closeDescriptionPreset"
  >
    <template #title>&#x6279;&#x91CF;&#x9884;&#x8BBE;&#x63CF;&#x8FF0;&#x56FE;</template>
    <div class="pod-carousel-preset-body">
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x56FE;&#x7247;&#x6587;&#x4EF6;&#x5217;&#x8868;</strong>
            <span>&#x4ECE;&#x8F6E;&#x64AD;&#x56FE;&#x4E2D;&#x9009;&#x62E9;&#x8981;&#x4F5C;&#x4E3A;&#x63CF;&#x8FF0;&#x56FE;&#x7684;&#x56FE;&#x7247;</span>
          </div>
          <a-tag class="pod-carousel-count-tag" bordered>{{ descriptionPresetCandidates.length }} &#x5F20;</a-tag>
        </div>
        <div class="pod-carousel-preset-toolbar">
          <a-button size="small" @click="clearDescriptionPresetItems">&#x53D6;&#x6D88;&#x5168;&#x9009;</a-button>
          <a-button size="small" @click="selectAllDescriptionPresetItems">&#x5168;&#x90E8;&#x52FE;&#x9009;</a-button>
          <span>{{ descriptionPresetSelected.length }} / {{ descriptionPresetCandidates.length }}</span>
        </div>
        <div class="pod-carousel-candidate-list">
          <label
            v-for="item in descriptionPresetCandidates"
            :key="item.name"
            class="pod-carousel-candidate-item"
            :class="{ 'is-selected': isDescriptionPresetSelected(item.name) }"
          >
            <a-checkbox :model-value="isDescriptionPresetSelected(item.name)" @change="(checked) => toggleDescriptionPresetItem(item.name, checked)" />
            <span class="pod-carousel-file-name" :title="item.name">{{ item.name }}</span>
            <span class="pod-carousel-file-count">{{ item.count }} &#x4E2A;&#x5546;&#x54C1;</span>
          </label>
          <a-empty v-if="!descriptionPresetCandidates.length" class="pod-carousel-empty" description="&#x6682;&#x65E0;&#x8F6E;&#x64AD;&#x56FE;" />
        </div>
      </section>
      <section class="pod-carousel-preset-panel">
        <div class="pod-carousel-preset-head">
          <div>
            <strong>&#x9009;&#x4E2D;&#x63CF;&#x8FF0;&#x56FE;&#x987A;&#x5E8F;</strong>
            <span>&#x786E;&#x8BA4;&#x540E;&#x4F1A;&#x6309;&#x6B64;&#x987A;&#x5E8F;&#x5199;&#x5165;&#x63CF;&#x8FF0;&#x56FE;</span>
          </div>
          <a-tag class="pod-carousel-count-tag" bordered>{{ descriptionPresetSelected.length }} &#x5F20;</a-tag>
        </div>
        <div class="pod-carousel-selected-list">
          <div v-for="(name, index) in descriptionPresetSelected" :key="name" class="pod-carousel-selected-item">
            <span class="pod-carousel-order-index">{{ index + 1 }}</span>
            <div class="pod-carousel-assigned-file">
              <span>&#x7B2C; {{ index + 1 }} &#x5F20;&#x63CF;&#x8FF0;&#x56FE;</span>
              <a-tooltip :content="getCarouselPresetFileTip(name)">
                <strong>{{ getCarouselPresetDisplayName(name) }}</strong>
              </a-tooltip>
            </div>
            <div class="pod-carousel-order-actions">
              <a-button size="mini" :disabled="index === 0" @click="moveDescriptionPresetItem(index, -1)">&#x4E0A;&#x79FB;</a-button>
              <a-button size="mini" :disabled="index === descriptionPresetSelected.length - 1" @click="moveDescriptionPresetItem(index, 1)">&#x4E0B;&#x79FB;</a-button>
            </div>
          </div>
          <a-empty v-if="!descriptionPresetSelected.length" class="pod-carousel-empty" description="&#x8BF7;&#x5728;&#x5DE6;&#x4FA7;&#x52FE;&#x9009;&#x56FE;&#x7247;" />
        </div>
      </section>
    </div>
    <div class="pod-modal-footer pod-carousel-preset-footer">
      <a-button @click="closeDescriptionPreset">&#x53D6;&#x6D88;</a-button>
      <a-button class="pod-theme-button" type="primary" :disabled="!descriptionPresetSelected.length" @click="applyDescriptionPreset">&#x5E94;&#x7528;&#x9884;&#x8BBE;</a-button>
    </div>
  </a-modal>
</template>

<script setup>
defineProps({
  carouselPresetVisible: Boolean,
  carouselPresetCandidates: {
    type: Array,
    default: () => []
  },
  carouselPresetSelected: {
    type: Array,
    default: () => []
  },
  randomCarouselVisible: Boolean,
  randomCarouselOnlyFirst: Boolean,
  randomCarouselCandidates: {
    type: Array,
    default: () => []
  },
  randomCarouselSelected: {
    type: Array,
    default: () => []
  },
  descriptionPresetVisible: Boolean,
  descriptionPresetCandidates: {
    type: Array,
    default: () => []
  },
  descriptionPresetSelected: {
    type: Array,
    default: () => []
  },
  closeCarouselPreset: {
    type: Function,
    required: true
  },
  clearCarouselPresetItems: {
    type: Function,
    required: true
  },
  selectAllCarouselPresetItems: {
    type: Function,
    required: true
  },
  isCarouselPresetSelected: {
    type: Function,
    required: true
  },
  toggleCarouselPresetItem: {
    type: Function,
    required: true
  },
  getCarouselPresetFileTip: {
    type: Function,
    required: true
  },
  getCarouselPresetDisplayName: {
    type: Function,
    required: true
  },
  moveCarouselPresetItem: {
    type: Function,
    required: true
  },
  applyCarouselPreset: {
    type: Function,
    required: true
  },
  closeRandomCarouselPreset: {
    type: Function,
    required: true
  },
  selectAllRandomCarouselItems: {
    type: Function,
    required: true
  },
  clearRandomCarouselItems: {
    type: Function,
    required: true
  },
  isRandomCarouselSelected: {
    type: Function,
    required: true
  },
  toggleRandomCarouselItem: {
    type: Function,
    required: true
  },
  getRandomCarouselCandidate: {
    type: Function,
    required: true
  },
  getRandomCarouselItemTip: {
    type: Function,
    required: true
  },
  applyRandomCarouselPreset: {
    type: Function,
    required: true
  },
  closeDescriptionPreset: {
    type: Function,
    required: true
  },
  clearDescriptionPresetItems: {
    type: Function,
    required: true
  },
  selectAllDescriptionPresetItems: {
    type: Function,
    required: true
  },
  isDescriptionPresetSelected: {
    type: Function,
    required: true
  },
  toggleDescriptionPresetItem: {
    type: Function,
    required: true
  },
  moveDescriptionPresetItem: {
    type: Function,
    required: true
  },
  applyDescriptionPreset: {
    type: Function,
    required: true
  }
});

defineEmits(['update:randomCarouselOnlyFirst']);
</script>
