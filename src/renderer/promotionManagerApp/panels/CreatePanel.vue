<template>
  <div class="pm-panel">
    <div class="pm-panel-head">
      <div class="pm-panel-copy">
        <p class="pm-panel-eyebrow">{{ moduleData.eyebrow }}</p>
        <h1 class="pm-panel-title">{{ moduleData.title }}</h1>
        <p class="pm-panel-text">{{ moduleData.description }}</p>
      </div>
    </div>

    <table class="pm-static-table">
      <thead>
        <tr>
          <th v-for="(col, idx) in moduleData.columns" :key="idx">{{ col }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rIdx) in moduleData.rows" :key="rIdx">
          <td v-for="(cell, cIdx) in row" :key="cIdx">{{ cell }}</td>
        </tr>
      </tbody>
    </table>

    <div class="pm-module-footer-note">
      <svg class="pm-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>新建推广功能正在接入中，当前为示例数据。</span>
    </div>
  </div>
</template>

<script setup>
import { MODULES } from '../constants.js';

const moduleData = MODULES.create;
</script>
