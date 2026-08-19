<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import { ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

export interface ActivitySummaryChartSpec {
  data: Array<{ name: string; value: number }>;
  kind: 'bar' | 'pie';
  title: string;
  unit: string;
}

const props = defineProps<{ spec: ActivitySummaryChartSpec }>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#60a5fa', '#c4b5fd'];

const renderChart = () => {
  const spec = props.spec;
  if (spec.kind === 'pie') {
    renderEcharts({
      color: colors,
      legend: {
        bottom: 0,
        icon: 'circle',
        itemHeight: 8,
        itemWidth: 8,
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          center: ['50%', '43%'],
          data: spec.data,
          emphasis: { scale: true, scaleSize: 4 },
          itemStyle: { borderColor: '#fff', borderRadius: 4, borderWidth: 3 },
          label: { show: false },
          radius: ['48%', '70%'],
          type: 'pie',
        },
      ],
      tooltip: {
        formatter: `{b}<br/><strong>{c}</strong> ${spec.unit}（{d}%）`,
        trigger: 'item',
      },
    } as any);
    return;
  }

  const data = [...spec.data].sort((a, b) => a.value - b.value);
  renderEcharts({
    color: [colors[0]],
    grid: { bottom: 8, containLabel: true, left: 8, right: 18, top: 8 },
    series: [
      {
        barMaxWidth: 18,
        data: data.map((item, index) => ({
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: colors[index % colors.length],
          },
          value: item.value,
        })),
        type: 'bar',
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `${params?.name ?? ''}<br/><strong>${params?.value ?? 0}</strong> ${spec.unit}`,
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2ff' } },
      type: 'value',
    },
    yAxis: {
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        width: 80,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
      data: data.map((item) => item.name),
      type: 'category',
    },
  } as any);
};

watch(() => props.spec, renderChart, { deep: true, immediate: true });
</script>

<template>
  <section class="rounded-2xl border border-indigo-100 bg-white p-4">
    <h3 class="mb-2 text-sm font-semibold text-slate-700">{{ spec.title }}</h3>
    <EchartsUI ref="chartRef" height="220px" />
  </section>
</template>
