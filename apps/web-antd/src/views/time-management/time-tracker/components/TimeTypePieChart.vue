<template>
  <div class="pie-chart-container">
    <EchartsUI ref="chartRef" />
  </div>
</template>

<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';
import type { TimeSlot, TimeSlotCategory, MergedCategory } from '../types';
import { TimeType, TIME_TYPE_CONFIG } from '../types';

import { computed, onMounted, ref, watch } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import dayjs from 'dayjs';

interface Props {
  timeSlots: TimeSlot[];
  categories: (TimeSlotCategory | MergedCategory)[];
  selectedDate: dayjs.Dayjs;
  selectedFilterCategoryIds?: string[] | null;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

// 计算每个时间类型的总时长
const timeTypeDurations = computed(() => {
  const durations = {
    [TimeType.REQUIRED]: 0,
    [TimeType.POSITIVE]: 0,
    [TimeType.NEGATIVE]: 0,
  };

  props.timeSlots.forEach(slot => {
    // 如果有分类过滤，且当前 slot 不属于过滤分类，则跳过
    if (props.selectedFilterCategoryIds && props.selectedFilterCategoryIds.length > 0 && !props.selectedFilterCategoryIds.includes(slot.categoryId)) {
      return;
    }
    
    const category = props.categories.find(c => c.id === slot.categoryId);
    const timeType = category?.timeType;
    
    if (timeType && durations[timeType as TimeType] !== undefined) {
      durations[timeType as TimeType] += (slot.endTime - slot.startTime + 1);
    }
  });

  return durations;
});

// 生成饼图数据
const pieChartData = computed(() => {
  const data = [
    { 
      name: TIME_TYPE_CONFIG[TimeType.REQUIRED].label, 
      value: timeTypeDurations.value[TimeType.REQUIRED],
      itemStyle: { color: TIME_TYPE_CONFIG[TimeType.REQUIRED].color }
    },
    { 
      name: TIME_TYPE_CONFIG[TimeType.POSITIVE].label, 
      value: timeTypeDurations.value[TimeType.POSITIVE],
      itemStyle: { color: TIME_TYPE_CONFIG[TimeType.POSITIVE].color }
    },
    { 
      name: TIME_TYPE_CONFIG[TimeType.NEGATIVE].label, 
      value: timeTypeDurations.value[TimeType.NEGATIVE],
      itemStyle: { color: TIME_TYPE_CONFIG[TimeType.NEGATIVE].color }
    }
  ].filter(item => item.value > 0);

  return data;
});

// 渲染饼图
const renderPieChart = () => {
  if (!chartRef.value) return;

  const options = {
    title: {
      text: '时间类型分布',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const duration = params.value;
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const percentage = params.percent;

        return `${params.name}<br/>
                ${hours}小时${minutes}分钟 (${percentage}%)`;
      }
    },
    legend: {
      orient: 'horizontal' as const,
      bottom: 10,
      left: 'center',
      textStyle: {
        fontSize: 12
      }
    },
    series: [
      {
        name: '时间类型',
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          position: 'outside' as const,
          formatter: '{b}: {d}%',
          fontSize: 11
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
.pie-chart-container {
  width: 100%;
  height: 300px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  margin-top: 10px;
}
</style>
