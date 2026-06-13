<script setup lang="ts">
import ThinkAllList from './ThinkAllList.vue';

defineOptions({
  inheritAttrs: false,
  name: 'ThinkActionBoard',
});
</script>

<template>
  <ThinkAllList
    v-bind="$attrs"
    :show-type-filter="false"
    empty-description="还没有想法行动记录，点击右下角或下方按钮添加"
  />
</template>
