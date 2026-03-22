<template>
  <div class="category-filter">
    <Popover placement="bottom" trigger="click">
      <template #content>
        <div class="filter-popover">
          <div class="filter-header">
            <span>筛选分类</span>
            <Button 
              type="link" 
              size="small" 
              @click="clearFilter"
              :disabled="selectedFilterCategoryIds.length === 0"
            >
              清除筛选
            </Button>
          </div>
          <div class="category-list">
            <div
              v-for="category in visibleCategories"
              :key="category.id"
              class="category-item"
              :class="{ active: isSelected(category.id) }"
              @click="toggleCategoryFilter(category.id)"
            >
              <div class="color-indicator" :style="{ backgroundColor: getDisplayColor(category) }"></div>
              <span class="category-name">{{ getDisplayName(category) }}</span>
              <CheckOutlined v-if="isSelected(category.id)" class="check-icon" />
            </div>
            
            <!-- 如果没有分类 -->
            <div v-if="visibleCategories.length === 0" class="empty-text">
              暂无分类
            </div>
          </div>
        </div>
      </template>
      <Button 
        type="default" 
        :disabled="loading" 
        :size="size" 
        :class="{ 'filter-active': selectedFilterCategoryIds.length > 0 }"
      >
        <template #icon>
          <FilterOutlined />
        </template>
        <span v-if="selectedFilterCategoryIds.length > 0" class="filter-badge"></span>
      </Button>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { FilterOutlined, CheckOutlined } from '@ant-design/icons-vue';
import { Button, Popover } from 'ant-design-vue';
import type { TimeSlotCategory, MergedCategory } from '../types';
import { getCategoryColor, getCategoryName } from '../config';

interface Props {
  categories: (TimeSlotCategory | MergedCategory)[];
  loading?: boolean;
  size?: 'small' | 'middle' | 'large';
  multiple?: boolean;
}

interface Emits {
  (e: 'filterChange', categoryIds: string[] | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  size: 'middle',
  multiple: false
});

const emit = defineEmits<Emits>();

const selectedFilterCategoryIds = ref<string[]>([]);

// 分类计算属性
const visibleCategories = computed(() => {
  return props.categories.filter(c => !('isHidden' in c && c.isHidden));
});

// 获取显示颜色
const getDisplayColor = (category: TimeSlotCategory | MergedCategory) => {
  return getCategoryColor(category.id, props.categories);
};

// 获取显示名称
const getDisplayName = (category: TimeSlotCategory | MergedCategory) => {
  return getCategoryName(category.id, props.categories);
};

const isSelected = (categoryId: string) => {
  return selectedFilterCategoryIds.value.includes(categoryId);
};

const toggleCategoryFilter = (categoryId: string) => {
  if (props.multiple) {
    const index = selectedFilterCategoryIds.value.indexOf(categoryId);
    if (index > -1) {
      selectedFilterCategoryIds.value.splice(index, 1);
    } else {
      selectedFilterCategoryIds.value.push(categoryId);
    }
  } else {
    if (isSelected(categoryId)) {
      selectedFilterCategoryIds.value = [];
    } else {
      selectedFilterCategoryIds.value = [categoryId];
    }
  }
  
  emit('filterChange', selectedFilterCategoryIds.value.length > 0 ? selectedFilterCategoryIds.value : null);
};

// 暴露方法供父组件调用
const clearFilter = () => {
  selectedFilterCategoryIds.value = [];
  emit('filterChange', null);
};

defineExpose({
  clearFilter
});
</script>

<style scoped>
.category-filter {
  display: inline-block;
}

.filter-active {
  color: var(--ant-primary-color);
  border-color: var(--ant-primary-color);
  position: relative;
}

.filter-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ff4d4f;
  border: 1px solid #fff;
}

.filter-popover {
  width: 250px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
  font-weight: 500;
}

.category-list {
  max-height: 300px;
  overflow-y: auto;
}

.category-group {
  margin-bottom: 12px;
}

.group-title {
  font-size: 12px;
  color: #999;
  padding: 4px 8px;
  background: #fafafa;
  border-radius: 4px;
  margin-bottom: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
}

.category-item:hover {
  background-color: #f5f5f5;
}

.category-item.active {
  background-color: #e6f7ff;
}

.color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.override-tag {
  font-size: 10px;
  background: #fff7e6;
  color: #1890ff;
  border: 1px solid #91d5ff;
  padding: 0 4px;
  border-radius: 2px;
  margin-right: 8px;
}

.check-icon {
  color: #1890ff;
}

.empty-text {
  text-align: center;
  color: #999;
  padding: 16px 0;
}
</style>