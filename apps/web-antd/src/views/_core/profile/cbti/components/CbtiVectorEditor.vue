<script setup lang="ts">
import { computed } from 'vue';

import { Tag } from 'ant-design-vue';

import type { CbtiDimensionDef } from '#/api/core/cbti';

interface Props {
  dimensionDefs?: CbtiDimensionDef[];
  vector?: number[];
  readonly?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:vector', value: number[]): void;
}>();

const modelOrder = ['C', 'B', 'T', 'D', 'A'];

type GroupItem = { def: CbtiDimensionDef; index: number };

const groups = computed(() => {
  const defs = props.dimensionDefs ?? [];
  const grouped = new Map<string, { model: string; modelName: string; items: GroupItem[] }>();
  defs.forEach((def, index) => {
    const g = grouped.get(def.model) ?? { model: def.model, modelName: def.modelName, items: [] };
    g.items.push({ def, index });
    grouped.set(def.model, g);
  });
  return modelOrder
    .filter((k) => grouped.has(k))
    .map((k) => grouped.get(k)!)
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.index - b.index) }));
});

const isReady = computed(() => (props.dimensionDefs?.length ?? 0) === 15 && (props.vector?.length ?? 0) === 15);

const numToLevel = (n: number | undefined) => {
  if (n === 0) return 'L';
  if (n === 1) return 'M';
  if (n === 2) return 'H';
  return null;
};

const numToPercent = (n: number | undefined) => {
  const v = typeof n === 'number' ? n : 0;
  const clamped = Math.max(0, Math.min(2, v));
  return Math.round((clamped / 2) * 100);
};

const setValue = (index: number, v: 0 | 1 | 2) => {
  if (props.readonly) return;
  const next = Array.from({ length: 15 }, (_, i) => props.vector?.[i] ?? 1);
  next[index] = v;
  emit('update:vector', next);
};
</script>

<template>
  <div v-if="!isReady" class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-500">
    维度定义或向量数据不完整（需要 dimensionDefs=15 且 vector=15）
  </div>

  <div v-else class="space-y-6">
    <div v-for="g in groups" :key="g.model">
      <div class="flex items-center gap-2 mb-3">
        <Tag color="orange">{{ g.model }}</Tag>
        <div class="font-black text-sm text-stone-700">{{ g.modelName }}</div>
      </div>

      <div class="space-y-3 pl-1">
        <div v-for="it in g.items" :key="it.def.code" class="border-l-2 border-orange-100 pl-4">
          <div class="flex items-center justify-between gap-3 mb-1">
            <span class="text-xs font-medium text-stone-600">
              <span class="font-mono">{{ it.def.code }}</span>
              {{ it.def.name }}
            </span>

            <div class="flex items-center gap-1.5">
              <button
                class="px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors"
                :disabled="readonly"
                :class="
                  numToLevel(vector?.[it.index]) === 'L'
                    ? 'bg-stone-100 text-stone-500 border-stone-200'
                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'
                "
                @click="setValue(it.index, 0)"
              >
                L
              </button>
              <button
                class="px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors"
                :disabled="readonly"
                :class="
                  numToLevel(vector?.[it.index]) === 'M'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'
                "
                @click="setValue(it.index, 1)"
              >
                M
              </button>
              <button
                class="px-2 py-0.5 rounded-md text-[10px] font-black border transition-colors"
                :disabled="readonly"
                :class="
                  numToLevel(vector?.[it.index]) === 'H'
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'
                "
                @click="setValue(it.index, 2)"
              >
                H
              </button>
            </div>
          </div>

          <div class="h-1.5 bg-orange-50 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400"
              :style="{ width: `${numToPercent(vector?.[it.index])}%` }"
            />
          </div>

          <div class="mt-2 text-[11px] text-stone-500 leading-relaxed">
            {{ it.def.levels[numToLevel(vector?.[it.index]) ?? 'L'] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
