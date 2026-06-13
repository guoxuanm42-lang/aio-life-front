<script setup lang="ts">
import ThinkAllList from './ThinkAllList.vue';

defineOptions({
  inheritAttrs: false,
  name: 'ThinkEmotionJournal',
});
</script>

<template>
  <ThinkAllList
    v-bind="$attrs"
    :show-type-filter="false"
    empty-description="还没有情绪心情记录，点击右下角或下方按钮添加"
  />
</template>
