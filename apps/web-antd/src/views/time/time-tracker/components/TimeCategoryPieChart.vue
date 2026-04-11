<template>
  <Card class="pie-chart-card shadow-sm overflow-hidden" :body-style="{ padding: '12px' }">
    <div class="pie-chart-container">
      <EchartsUI ref="chartRef" />
    </div>
  </Card>
</template>

<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';
import type { TimeSlot, TimeSlotCategory, MergedCategory } from '../types';
import { getCategoryColor, getCategoryName } from '../config';

import { computed, onMounted, ref, watch } from 'vue';
import { Card } from 'ant-design-vue';
import dayjs from 'dayjs';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  timeSlots: TimeSlot[];
  categories: (TimeSlotCategory | MergedCategory)[];
  selectedDate: dayjs.Dayjs;
  selectedFilterCategoryIds?: string[] | null;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

// 计算每个分类的总时长
const categoryDurations = computed(() => {
  const durations: Record<string, number> = {};

  props.timeSlots.forEach(slot => {
    // 如果有分类过滤，且当前 slot 不属于过滤分类，则跳过
    if (props.selectedFilterCategoryIds && props.selectedFilterCategoryIds.length > 0 && !props.selectedFilterCategoryIds.includes(slot.categoryId)) {
      return;
    }
    const duration = slot.endTime - slot.startTime + 1;
    if (durations[slot.categoryId] !== undefined) {
      durations[slot.categoryId] = (durations[slot.categoryId] || 0) + duration;
    } else {
      durations[slot.categoryId] = duration;
    }
  });

  return durations;
});

// 生成饼图数据
const pieChartData = computed(() => {
  const data = props.categories.map(category => {
    const duration = categoryDurations.value[category.id] || 0;
    return {
      name: getCategoryName(category.id, props.categories),
      value: duration,
      itemStyle: {
        color: getCategoryColor(category.id, props.categories)
      }
    };
  }).filter(item => item.value > 0); // 只显示有数据的分类

  return data;
});

// 渲染饼图
const renderPieChart = () => {
  if (!chartRef.value) return;

  const options = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const duration = params.value;
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const percentage = params.percent;

        return `${params.name}<br/>
                ${hours}小时${minutes}分钟 (${percentage}%)<br/>
                总时长: ${duration}分钟`;
      }
    },
    legend: {
      orient: 'vertical' as const,
      right: 5,
      top: 'center',
      textStyle: {
        fontSize: 11
      }
    },
    series: [
      {
        name: '时间分类',
        type: 'pie' as const,
        radius: ['50%', '85%'],
        center: ['42%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'outside' as const,
          formatter: (params: any) => {
            const percentage = params.percent;
            return `${params.name}\n${percentage}%`;
          },
          fontSize: 10,
          fontWeight: 'normal' as const,
          color: '#666',
          minMargin: 5,
          overflow: 'truncate' as const,
          width: 60,
        },
        labelLine: {
          show: true,
          length: 5,
          length2: 8,
          smooth: true
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold' as const
          }
        },
        data: pieChartData.value
      }
    ]
  };

  renderEcharts(options as any);
};

// 监听数据变化，重新渲染图表
watch([pieChartData, () => props.selectedDate], () => {
  renderPieChart();
}, { immediate: true });

onMounted(() => {
  renderPieChart();
});
</script>

<style scoped>
.pie-chart-card {
  width: 100%;
  min-width: 300px;
  flex: 2;
}

.pie-chart-container {
  width: 100%;
  height: 280px;
}

.shadow-sm {
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 5%);
}
</style>
