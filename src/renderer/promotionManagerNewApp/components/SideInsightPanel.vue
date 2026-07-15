<template>
  <aside class="pm-new-side-panel" aria-label="Promotion settings">
    <section class="pm-new-side-card">
      <div class="pm-new-side-title">
        <strong>{{ strategyTitle }}</strong>
        <a-tag color="blue" size="small" bordered>{{ strategyTag }}</a-tag>
      </div>

      <div class="pm-new-form-grid">
        <label>
          <span>{{ budgetLabel }}</span>
          <a-input-number
            :model-value="240"
            size="small"
            :min="1"
            hide-button
          />
        </label>
        <label>
          <span>{{ roasLabel }}</span>
          <a-input-number
            :model-value="3"
            size="small"
            :min="0"
            :precision="1"
            hide-button
          />
        </label>
      </div>
    </section>

    <section class="pm-new-side-card">
      <div class="pm-new-side-title">
        <strong>{{ policyTitle }}</strong>
      </div>
      <div class="pm-new-policy-list">
        <article
          v-for="group in policyGroups"
          :key="group.id"
          class="pm-new-policy"
        >
          <h3>{{ group.title }}</h3>
          <ul>
            <li v-for="item in group.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </div>
    </section>
  </aside>
</template>

<script setup>
defineProps({
  policyGroups: {
    type: Array,
    default: () => []
  }
});

const strategyTitle = '\u7b56\u7565\u6982\u89c8';
const strategyTag = '\u9884\u8bbe';
const budgetLabel = '\u65e5\u9884\u7b97';
const roasLabel = '\u76ee\u6807 ROAS';
const policyTitle = '\u6267\u884c\u89c4\u5219';
</script>
