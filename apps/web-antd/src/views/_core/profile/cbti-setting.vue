<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Button, Form, Input, Modal, Popconfirm, Spin, Switch, Table, Tag, Upload, message } from 'ant-design-vue';

import {
  cbtiTestApi,
  createCbtiPersonalityApi,
  deleteCbtiPersonalityApi,
  getCbtiAdminPersonalitiesApi,
  getCbtiHistoryApi,
  getCbtiHistoryDetailApi,
  getCbtiPersonalitiesApi,
  getCbtiQuestionsApi,
  updateCbtiPersonalityApi,
  uploadCbtiPersonalityImageApi,
  type CbtiAdminPersonality,
  type CbtiHistoryItem,
  type CbtiPersonality,
  type CbtiQuestionsResp,
  type CbtiTestResult,
  type CbtiPersonalitySaveReq,
} from '#/api/core/cbti';

import { useUserStore } from '@vben/stores';

import CbtiRadarChart from './cbti/components/CbtiRadarChart.vue';

type Phase = 'home' | 'main' | 'hidden1' | 'hidden2' | 'result';

const phase = ref<Phase>('home');
const initializing = ref(false);
const calculating = ref(false);

const questionsResp = ref<CbtiQuestionsResp>();
const personalities = ref<CbtiPersonality[]>([]);

const currentIndex = ref(0);
const answers = ref<Record<number, number>>({});
const hiddenAnswers = ref<{ drink?: string; drinkAttitude?: string }>({});

const result = ref<CbtiTestResult | null>(null);
const showDetails = ref(false);

const typesVisible = ref(false);
const selectedType = ref<string | null>(null);

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<CbtiHistoryItem[]>([]);

const userStore = useUserStore();
const isAdmin = computed(() => (userStore.userInfo?.roles ?? []).includes('admin'));

const adminVisible = ref(false);
const adminLoading = ref(false);
const adminList = ref<CbtiAdminPersonality[]>([]);

const adminEditVisible = ref(false);
const adminSaving = ref(false);
const adminEditingId = ref<number | null>(null);
const adminForm = ref<CbtiPersonalitySaveReq>({
  code: '',
  name: '',
  vector: Array.from({ length: 15 }, () => 1),
});
const adminVectorText = ref(JSON.stringify(adminForm.value.vector));
const adminStrengthsText = ref('');
const adminWeaknessesText = ref('');

const questions = computed(() => questionsResp.value?.questions ?? []);
const hiddenQuestions = computed(() => questionsResp.value?.hiddenQuestions ?? []);

const total = computed(() => questions.value.length);
const answeredCount = computed(() => Object.keys(answers.value).length);
const progress = computed(() => {
  const t = total.value || 1;
  return Math.round((answeredCount.value / t) * 100);
});

const currentQuestion = computed(() => {
  if (phase.value !== 'main') return null;
  return questions.value[currentIndex.value] ?? null;
});

const currentTypeDetail = computed(() => {
  if (!selectedType.value) return null;
  return personalities.value.find((p) => p.code === selectedType.value) ?? null;
});

const historyColumns = [
  { title: '类型', dataIndex: 'personalityCode', key: 'personalityCode', width: 120 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '匹配度', dataIndex: 'similarity', key: 'similarity', width: 120 },
  { title: '时间', dataIndex: 'createTime', key: 'createTime', width: 200 },
  { title: '操作', key: 'action', width: 140 },
];

const adminColumns: any[] = [
  { title: '图片', key: 'image', width: 80 },
  { title: 'Code', dataIndex: 'code', key: 'code', width: 120 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '隐藏', dataIndex: 'isSpecial', key: 'isSpecial', width: 90 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 200 },
  { title: '操作', key: 'action', width: 320 },
];

const init = async () => {
  if (questionsResp.value && personalities.value.length > 0) return;
  initializing.value = true;
  try {
    const [q, p] = await Promise.all([getCbtiQuestionsApi(), getCbtiPersonalitiesApi()]);
    questionsResp.value = q;
    personalities.value = p;
  } catch (e: any) {
    message.error(e?.message || '初始化 CBTI 数据失败');
  } finally {
    initializing.value = false;
  }
};

const loadAdminList = async () => {
  adminLoading.value = true;
  try {
    adminList.value = await getCbtiAdminPersonalitiesApi();
  } finally {
    adminLoading.value = false;
  }
};

const refreshPersonalities = async () => {
  try {
    personalities.value = await getCbtiPersonalitiesApi();
  } catch {
  }
};

const openAdmin = async () => {
  await loadAdminList();
  adminVisible.value = true;
};

const resetAdminForm = () => {
  adminEditingId.value = null;
  adminForm.value = {
    code: '',
    name: '',
    vector: Array.from({ length: 15 }, () => 1),
    isSpecial: false,
    strengths: [],
    weaknesses: [],
  };
  adminVectorText.value = JSON.stringify(adminForm.value.vector);
  adminStrengthsText.value = '';
  adminWeaknessesText.value = '';
};

const openCreatePersonality = () => {
  resetAdminForm();
  adminEditVisible.value = true;
};

const openEditPersonality = (row: any) => {
  const r = row as CbtiAdminPersonality;
  adminEditingId.value = r.id;
  adminForm.value = {
    id: r.id,
    code: r.code,
    name: r.name,
    motto: r.motto,
    color: r.color,
    techStack: r.techStack,
    spirit: r.spirit,
    description: r.description,
    vector: r.vector ?? Array.from({ length: 15 }, () => 1),
    strengths: r.strengths ?? [],
    weaknesses: r.weaknesses ?? [],
    isSpecial: Boolean(r.isSpecial),
    imageObject: r.imageObject,
  };
  adminVectorText.value = JSON.stringify(adminForm.value.vector);
  adminStrengthsText.value = (adminForm.value.strengths ?? []).join('\n');
  adminWeaknessesText.value = (adminForm.value.weaknesses ?? []).join('\n');
  adminEditVisible.value = true;
};

const parseVector = () => {
  const raw = adminVectorText.value?.trim();
  const arr = JSON.parse(raw) as any;
  if (!Array.isArray(arr) || arr.length !== 15 || arr.some((x) => typeof x !== 'number')) {
    throw new Error('vector 必须是长度 15 的数字数组，如 [0,1,2,...]');
  }
  return arr as number[];
};

const parseLines = (text: string) => {
  return (text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
};

const saveAdminPersonality = async () => {
  adminSaving.value = true;
  try {
    const vector = parseVector();
    const payload: CbtiPersonalitySaveReq = {
      ...adminForm.value,
      code: adminForm.value.code?.trim(),
      vector,
      strengths: parseLines(adminStrengthsText.value),
      weaknesses: parseLines(adminWeaknessesText.value),
    };

    if (adminEditingId.value == null) {
      await createCbtiPersonalityApi(payload);
      message.success('新增成功');
    } else {
      await updateCbtiPersonalityApi(adminEditingId.value, payload);
      message.success('更新成功');
    }
    adminEditVisible.value = false;
    await Promise.all([loadAdminList(), refreshPersonalities()]);
  } catch (e: any) {
    message.error(e?.message || '保存失败');
  } finally {
    adminSaving.value = false;
  }
};

const deleteAdminPersonality = async (row: any) => {
  const r = row as CbtiAdminPersonality;
  try {
    await deleteCbtiPersonalityApi(r.id);
    message.success('删除成功');
    await Promise.all([loadAdminList(), refreshPersonalities()]);
  } catch (e: any) {
    message.error(e?.message || '删除失败');
  }
};

const uploadAdminImage = async (row: any, file: File) => {
  const r = row as CbtiAdminPersonality;
  const formData = new FormData();
  formData.append('file', file);
  await uploadCbtiPersonalityImageApi(r.code, formData);
  message.success('上传成功');
  await Promise.all([loadAdminList(), refreshPersonalities()]);
};

const resetTest = () => {
  phase.value = 'home';
  currentIndex.value = 0;
  answers.value = {};
  hiddenAnswers.value = {};
  result.value = null;
  showDetails.value = false;
};

const startTest = async () => {
  await init();
  currentIndex.value = 0;
  answers.value = {};
  hiddenAnswers.value = {};
  result.value = null;
  showDetails.value = false;
  phase.value = 'main';
};

const selectOption = (value: number) => {
  const q = currentQuestion.value;
  if (!q) return;
  answers.value = { ...answers.value, [q.id]: value };
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value += 1;
    return;
  }
  phase.value = 'hidden1';
};

const prevQuestion = () => {
  if (phase.value !== 'main') return;
  if (currentIndex.value <= 0) return;
  currentIndex.value -= 1;
};

const nextQuestion = () => {
  if (phase.value !== 'main') return;
  if (currentIndex.value >= questions.value.length - 1) return;
  currentIndex.value += 1;
};

const jumpTo = (idx: number) => {
  if (phase.value !== 'main') return;
  if (idx < 0 || idx >= questions.value.length) return;
  currentIndex.value = idx;
};

const answerHidden1 = async (value: string) => {
  hiddenAnswers.value = { ...hiddenAnswers.value, drink: value };
  if (value === 'coffee') {
    phase.value = 'hidden2';
    return;
  }
  await calculate();
};

const answerHidden2 = async (value: string) => {
  hiddenAnswers.value = { ...hiddenAnswers.value, drink: 'coffee', drinkAttitude: value };
  await calculate();
};

const calculate = async () => {
  calculating.value = true;
  try {
    const r = await cbtiTestApi({ answers: answers.value, hiddenAnswers: hiddenAnswers.value });
    result.value = r;
    phase.value = 'result';
  } catch (e: any) {
    message.error(e?.message || '计算结果失败');
  } finally {
    calculating.value = false;
  }
};

const openTypes = async () => {
  await init();
  typesVisible.value = true;
};

const openHistory = async () => {
  historyLoading.value = true;
  try {
    historyList.value = await getCbtiHistoryApi();
    historyVisible.value = true;
  } catch (e: any) {
    message.error(e?.message || '获取历史失败');
  } finally {
    historyLoading.value = false;
  }
};

const viewHistoryDetail = async (record: any) => {
  try {
    const detail = await getCbtiHistoryDetailApi(String(record.id));
    result.value = {
      personality: detail.personality,
      similarity: detail.similarity,
      dimensions: detail.dimensions,
      matchDetails: [],
      isSpecial: Boolean(detail.personality?.isSpecial),
    };
    phase.value = 'result';
    historyVisible.value = false;
  } catch (e: any) {
    message.error(e?.message || '获取详情失败');
  }
};

const groupedDimensions = computed(() => {
  const dims = result.value?.dimensions ?? [];
  const groups = new Map<string, { model: string; modelName: string; items: any[] }>();
  for (const d of dims) {
    const g = groups.get(d.model) ?? { model: d.model, modelName: d.modelName, items: [] };
    g.items.push(d);
    groups.set(d.model, g);
  }
  const order = ['C', 'B', 'T', 'D', 'A'];
  return order
    .filter((k) => groups.has(k))
    .map((k) => groups.get(k)!)
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.code.localeCompare(b.code)) }));
});

onMounted(() => {
  init();
});
</script>

<template>
  <div class="p-4">
    <Spin :spinning="initializing || calculating">
      <div v-if="phase === 'home'" class="max-w-3xl mx-auto">
        <div class="rounded-3xl overflow-hidden border border-orange-100 shadow-sm bg-gradient-to-b from-[#fffbf5] to-[#fff7ed]">
          <div class="p-10 text-center">
            <div class="text-xs font-mono tracking-widest text-orange-500 mb-2">PROGRAMMER BEHAVIOR TEST</div>
            <div class="text-6xl md:text-7xl font-black tracking-wider text-stone-900 mb-4" style="letter-spacing: 0.12em">
              CBTI
            </div>
            <div class="text-stone-600 font-bold mb-2">程序员行为类型测试</div>
            <div class="text-stone-400 text-sm leading-relaxed mb-8">
              你是 SUDO 还是 NULL？是 996 还是 404？<br />30 道题，测出你的编程人格
            </div>
            <div class="flex items-center justify-center gap-3 flex-wrap">
              <Button type="primary" size="large" class="!rounded-full !px-10 !font-black" @click="startTest">
                开始测试
              </Button>
              <Button size="large" class="!rounded-full !px-8 !font-bold" @click="openTypes">全部人格</Button>
              <Button size="large" class="!rounded-full !px-8 !font-bold" @click="openHistory">历史记录</Button>
              <Button v-if="isAdmin" size="large" class="!rounded-full !px-8 !font-bold" @click="openAdmin">
                角色管理
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'main' && currentQuestion" class="max-w-2xl mx-auto">
        <div class="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-orange-100/60 rounded-2xl overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <button class="text-stone-400 hover:text-orange-500 text-sm font-medium" @click="resetTest">← 返回</button>
            <span class="font-mono font-black text-orange-500 text-sm">
              {{ currentIndex + 1 }} / {{ total }}
            </span>
            <span class="text-[11px] text-stone-400 font-mono">{{ answeredCount }} 已答</span>
          </div>
          <div class="h-1 bg-orange-100">
            <div
              class="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-r-full"
              :style="{ width: `${progress}%` }"
            />
          </div>
        </div>

        <div class="pt-8">
          <div class="flex items-center gap-2 mb-4">
            <span class="bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-lg">
              Q{{ currentQuestion.id }}
            </span>
            <span class="text-[11px] text-stone-400 font-mono">{{ currentQuestion.dimension }}</span>
          </div>

          <h2 class="text-lg md:text-xl font-bold mb-6 leading-relaxed text-stone-800">
            {{ currentQuestion.text }}
          </h2>

          <div class="space-y-2.5">
            <button
              v-for="(opt, idx) in currentQuestion.options"
              :key="idx"
              class="w-full text-left p-3.5 rounded-2xl border transition-all"
              :class="
                answers[currentQuestion.id] === opt.value
                  ? 'border-orange-400 bg-orange-50 shadow-sm'
                  : 'border-orange-100 bg-white hover:bg-orange-50/60'
              "
              @click="selectOption(opt.value)"
            >
              <div class="flex items-start gap-3">
                <span
                  class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black mt-0.5"
                  :class="
                    answers[currentQuestion.id] === opt.value ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-400'
                  "
                >
                  {{ String.fromCharCode(65 + idx) }}
                </span>
                <span class="text-sm text-stone-700 leading-relaxed">{{ opt.label }}</span>
              </div>
            </button>
          </div>

          <div class="flex justify-between mt-6 items-center">
            <button
              class="text-xs text-stone-400 hover:text-orange-500 disabled:opacity-20 transition font-medium"
              :disabled="currentIndex === 0"
              @click="prevQuestion"
            >
              ← 上一题
            </button>
            <button
              v-if="answers[currentQuestion.id] != null && currentIndex < total - 1"
              class="text-xs text-orange-500 hover:text-orange-600 transition font-medium"
              @click="nextQuestion"
            >
              下一题 →
            </button>
          </div>

          <div class="mt-8 pt-5 border-t border-orange-100/60">
            <div class="flex items-center justify-between mb-2.5">
              <span class="text-xs text-stone-500 font-medium">答题卡</span>
              <span class="text-xs text-stone-400">{{ answeredCount }}/{{ total }}</span>
            </div>
            <div class="flex flex-wrap gap-1">
              <template v-for="(q, i) in questions" :key="q.id">
                <button
                  v-if="q.id in answers || i === currentIndex"
                  class="w-6 h-6 rounded text-[10px] font-bold transition-all"
                  :class="
                    i === currentIndex
                      ? 'bg-orange-400 text-white ring-2 ring-orange-200'
                      : 'bg-orange-50 text-orange-500 border border-orange-200 hover:bg-orange-100'
                  "
                  @click="jumpTo(i)"
                >
                  {{ q.id }}
                </button>
                <span
                  v-else
                  class="w-6 h-6 rounded text-[10px] font-medium flex items-center justify-center bg-stone-100 text-stone-400"
                >
                  {{ q.id }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'hidden1'" class="max-w-xl mx-auto text-center pt-8">
        <div class="bg-orange-100 text-orange-600 text-xs font-black px-4 py-1.5 rounded-lg inline-block mb-4">
          彩蛋题
        </div>
        <h2 class="text-lg font-bold mb-6 text-stone-800">{{ hiddenQuestions[0]?.text }}</h2>
        <div class="space-y-2.5">
          <button
            v-for="(opt, idx) in hiddenQuestions[0]?.options ?? []"
            :key="idx"
            class="w-full text-left p-3.5 rounded-2xl border border-orange-100 bg-white hover:bg-orange-50/60 transition-all"
            @click="answerHidden1(opt.value)"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black mt-0.5 bg-orange-100 text-orange-400"
              >
                {{ String.fromCharCode(65 + idx) }}
              </span>
              <span class="text-sm text-stone-700 leading-relaxed">{{ opt.label }}</span>
            </div>
          </button>
        </div>
      </div>

      <div v-else-if="phase === 'hidden2'" class="max-w-xl mx-auto text-center pt-8">
        <div class="bg-amber-100 text-amber-700 text-xs font-black px-4 py-1.5 rounded-lg inline-block mb-4">
          咖啡因检测
        </div>
        <h2 class="text-lg font-bold mb-6 text-stone-800">{{ hiddenQuestions[1]?.text }}</h2>
        <div class="space-y-2.5">
          <button
            v-for="(opt, idx) in hiddenQuestions[1]?.options ?? []"
            :key="idx"
            class="w-full text-left p-3.5 rounded-2xl border border-orange-100 bg-white hover:bg-orange-50/60 transition-all"
            @click="answerHidden2(opt.value)"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black mt-0.5 bg-orange-100 text-orange-400"
              >
                {{ String.fromCharCode(65 + idx) }}
              </span>
              <span class="text-sm text-stone-700 leading-relaxed">{{ opt.label }}</span>
            </div>
          </button>
        </div>
      </div>

      <div v-else-if="phase === 'result' && result" class="max-w-3xl mx-auto">
        <div class="rounded-3xl overflow-hidden shadow-sm border border-orange-100 mb-6" :style="{ background: `linear-gradient(160deg, ${result.personality.color || '#f97316'}10, ${result.personality.color || '#f97316'}1f, ${result.personality.color || '#f97316'}10)` }">
          <div class="p-10 text-center">
            <div v-if="result.isSpecial" class="inline-block bg-amber-100 text-amber-700 text-xs font-black px-4 py-1.5 rounded-lg mb-4">
              隐藏人格触发
            </div>
            <div class="mx-auto mb-6 w-40 h-40 rounded-2xl overflow-hidden bg-white/70 border border-orange-100 flex items-center justify-center">
              <img v-if="result.personality.imageUrl" :src="result.personality.imageUrl" class="w-full h-full object-contain" />
              <span v-else class="text-stone-300 font-mono">NO IMG</span>
            </div>
            <div class="text-5xl md:text-7xl font-black font-mono tracking-wider" :style="{ color: result.personality.color || '#f97316' }">
              {{ result.personality.code }}
            </div>
            <div class="text-2xl font-black text-stone-800 mt-3 mb-2">
              {{ result.personality.name }}
            </div>
            <div class="text-stone-500 italic text-sm mb-6">
              「{{ result.personality.motto }}」
            </div>
            <div class="inline-flex items-center gap-2 bg-white/70 backdrop-blur px-5 py-2.5 rounded-full border border-orange-100">
              <span class="text-xs text-stone-400">匹配度</span>
              <span class="text-3xl font-black" :style="{ color: result.personality.color || '#f97316' }">
                {{ result.similarity }}%
              </span>
            </div>
          </div>
          <div class="bg-white/60 backdrop-blur px-8 py-6 border-t border-orange-50">
            <div class="text-stone-600 leading-relaxed text-sm">
              {{ result.personality.description }}
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-6 mb-5 border border-orange-50">
          <div class="font-black text-base mb-4 text-center text-stone-700">五维雷达图</div>
          <div class="flex justify-center">
            <div class="w-full max-w-[420px] h-[320px]">
              <CbtiRadarChart :dimensions="result.dimensions" />
            </div>
          </div>
        </div>

        <div v-if="result.matchDetails.length > 0" class="bg-white rounded-2xl shadow-sm p-6 mb-5 border border-orange-50">
          <div class="font-black text-base mb-4 text-stone-700">匹配排行</div>
          <div class="space-y-2.5">
            <div v-for="(m, i) in result.matchDetails" :key="m.code" class="flex items-center gap-3">
              <span
                class="text-xs font-black w-6 h-6 rounded-lg flex items-center justify-center"
                :class="i === 0 ? 'bg-orange-100 text-orange-600' : 'bg-stone-100 text-stone-400'"
              >
                {{ i + 1 }}
              </span>
              <span class="font-mono text-sm font-bold flex-1 text-stone-700">{{ m.code }} · {{ m.name }}</span>
              <div class="w-20 h-2 bg-orange-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400" :style="{ width: `${m.similarity}%` }" />
              </div>
              <span class="text-[11px] text-stone-400 w-10 text-right font-mono">{{ m.similarity }}%</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-6 mb-5 border border-orange-50">
          <button class="w-full flex items-center justify-between" @click="showDetails = !showDetails">
            <div class="font-black text-base text-stone-700">十五维度详细解读</div>
            <span class="text-stone-300 transition-transform text-sm" :class="showDetails ? 'rotate-180' : ''">▼</span>
          </button>
          <div v-if="showDetails" class="mt-6 space-y-8">
            <div v-for="g in groupedDimensions" :key="g.model">
              <div class="flex items-center gap-2 mb-3">
                <Tag color="orange">{{ g.model }}</Tag>
                <div class="font-black text-sm text-stone-700">{{ g.modelName }}</div>
              </div>
              <div class="space-y-3 pl-1">
                <div v-for="d in g.items" :key="d.code" class="border-l-2 border-orange-100 pl-4">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-stone-600">{{ d.code }} {{ d.name }}</span>
                    <span
                      class="text-[10px] font-black px-2 py-0.5 rounded-md"
                      :class="
                        d.level === 'H'
                          ? 'bg-orange-100 text-orange-600'
                          : d.level === 'M'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-stone-100 text-stone-400'
                      "
                    >
                      {{ d.level }}
                    </span>
                  </div>
                  <div class="h-1.5 bg-orange-50 rounded-full overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400" :style="{ width: `${d.percentage}%` }" />
                  </div>
                  <div v-if="d.levelDesc" class="mt-2 text-[11px] text-stone-500 leading-relaxed">
                    {{ d.levelDesc }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div class="bg-white rounded-2xl shadow-sm p-5 border border-orange-50">
            <div class="font-black text-sm mb-3 text-orange-600">优势</div>
            <ul class="space-y-2">
              <li v-for="(s, i) in result.personality.strengths ?? []" :key="i" class="text-xs text-stone-600 flex items-start gap-2">
                <span class="text-orange-400 mt-0.5 font-bold">✓</span>{{ s }}
              </li>
            </ul>
          </div>
          <div class="bg-white rounded-2xl shadow-sm p-5 border border-orange-50">
            <div class="font-black text-sm mb-3 text-amber-600">注意</div>
            <ul class="space-y-2">
              <li v-for="(w, i) in result.personality.weaknesses ?? []" :key="i" class="text-xs text-stone-600 flex items-start gap-2">
                <span class="text-amber-400 mt-0.5 font-bold">!</span>{{ w }}
              </li>
            </ul>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm p-6 mb-5 border border-orange-50">
          <div class="mb-4">
            <div class="font-black text-xs text-stone-400 uppercase tracking-wider mb-1">技术栈</div>
            <div class="text-sm text-stone-700">{{ result.personality.techStack }}</div>
          </div>
          <div>
            <div class="font-black text-xs text-stone-400 uppercase tracking-wider mb-1">灵魂格言</div>
            <div class="text-sm text-stone-700 italic">「{{ result.personality.spirit }}」</div>
          </div>
        </div>

        <div class="flex gap-3 flex-wrap">
          <Button class="!rounded-full !font-black" @click="startTest">重新测试</Button>
          <Button class="!rounded-full !font-black" @click="openHistory">历史记录</Button>
          <Button type="primary" class="!rounded-full !font-black" @click="resetTest">回到首页</Button>
        </div>
      </div>

      <Modal v-model:open="typesVisible" title="全部人格类型" :footer="null" :width="980">
        <div class="text-stone-400 text-xs mb-4">点击人格卡片查看详情</div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5 mb-6">
          <button
            v-for="p in personalities"
            :key="p.code"
            class="bg-white rounded-xl p-3 text-center border-2 transition-all"
            :class="selectedType === p.code ? 'border-orange-400 shadow-sm shadow-orange-100' : 'border-transparent hover:border-orange-200'"
            @click="selectedType = selectedType === p.code ? null : p.code"
          >
            <div class="w-14 h-14 mx-auto mb-2 rounded-lg bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
              <img v-if="p.imageUrl" :src="p.imageUrl" class="w-full h-full object-contain" />
            </div>
            <div class="font-mono text-[10px] font-black" :style="{ color: p.color || '#f97316' }">{{ p.code }}</div>
            <div class="font-bold text-[10px] text-stone-600 truncate">{{ p.name }}</div>
            <span v-if="p.isSpecial" class="inline-block text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded mt-0.5 font-black">
              隐藏
            </span>
          </button>
        </div>

        <div v-if="currentTypeDetail" class="bg-white rounded-2xl border border-orange-100 p-6">
          <div class="flex items-center gap-5 mb-5">
            <div class="w-24 h-24 rounded-2xl bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
              <img v-if="currentTypeDetail.imageUrl" :src="currentTypeDetail.imageUrl" class="w-full h-full object-contain" />
            </div>
            <div>
              <div class="font-mono text-3xl font-black" :style="{ color: currentTypeDetail.color || '#f97316' }">
                {{ currentTypeDetail.code }}
              </div>
              <div class="text-xl font-black text-stone-800">{{ currentTypeDetail.name }}</div>
              <div class="text-sm text-stone-400 italic mt-0.5">「{{ currentTypeDetail.motto }}」</div>
            </div>
          </div>
          <div class="text-sm text-stone-600 leading-relaxed mb-5">{{ currentTypeDetail.description }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div class="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <div class="font-black text-xs text-orange-600 mb-2">优势</div>
              <ul class="space-y-1">
                <li v-for="(s, i) in currentTypeDetail.strengths ?? []" :key="i" class="text-[11px] text-stone-600">✓ {{ s }}</li>
              </ul>
            </div>
            <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div class="font-black text-xs text-amber-600 mb-2">注意</div>
              <ul class="space-y-1">
                <li v-for="(w, i) in currentTypeDetail.weaknesses ?? []" :key="i" class="text-[11px] text-stone-600">! {{ w }}</li>
              </ul>
            </div>
          </div>
          <div class="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <div class="text-[11px] text-stone-500 mb-1">🛠️ {{ currentTypeDetail.techStack }}</div>
            <div class="text-[11px] text-stone-500 italic">💬 「{{ currentTypeDetail.spirit }}」</div>
          </div>
        </div>
      </Modal>

      <Modal v-model:open="historyVisible" title="CBTI 测试历史" :footer="null" :width="900">
        <Spin :spinning="historyLoading">
          <Table :data-source="historyList" :columns="historyColumns" :pagination="{ pageSize: 10 }" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'personalityCode'">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
                    <img v-if="record.imageUrl" :src="record.imageUrl" class="w-full h-full object-contain" />
                  </div>
                  <span class="font-mono font-black" :style="{ color: record.color || '#f97316' }">
                    {{ record.personalityCode }}
                  </span>
                  <Tag v-if="record.isSpecial" color="gold">隐藏</Tag>
                </div>
              </template>
              <template v-else-if="column.key === 'similarity'">
                <span class="font-mono">{{ record.similarity }}%</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <Button type="link" size="small" @click="viewHistoryDetail(record)">查看</Button>
              </template>
            </template>
          </Table>
        </Spin>
      </Modal>

      <Modal v-model:open="adminVisible" title="CBTI 角色管理" :footer="null" :width="1000">
        <div class="flex items-center justify-between mb-3">
          <Button type="primary" @click="openCreatePersonality">新增角色</Button>
          <Button @click="loadAdminList">刷新</Button>
        </div>
        <Spin :spinning="adminLoading">
          <Table :data-source="adminList" :columns="adminColumns" :pagination="{ pageSize: 10 }" row-key="id">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'image'">
                <div class="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
                  <img v-if="record.imageUrl" :src="record.imageUrl" class="w-full h-full object-contain" />
                </div>
              </template>
              <template v-else-if="column.key === 'isSpecial'">
                <Tag v-if="record.isSpecial" color="gold">隐藏</Tag>
                <span v-else class="text-stone-400 text-xs">否</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <div class="flex items-center gap-2">
                  <Button size="small" @click="openEditPersonality(record)">编辑</Button>
                  <Popconfirm title="确认删除该角色？" ok-text="删除" cancel-text="取消" @confirm="deleteAdminPersonality(record)">
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                  <Upload
                    accept="image/*"
                    :show-upload-list="false"
                    :customRequest="async ({ file, onError, onSuccess }: any) => {
                      try {
                        await uploadAdminImage(record, file as File);
                        onSuccess?.(null, file);
                      } catch (e) {
                        onError?.(e);
                      }
                    }"
                  >
                    <Button size="small">上传图</Button>
                  </Upload>
                </div>
              </template>
            </template>
          </Table>
        </Spin>
      </Modal>

      <Modal
        v-model:open="adminEditVisible"
        :title="adminEditingId == null ? '新增角色' : '编辑角色'"
        ok-text="保存"
        cancel-text="取消"
        :confirm-loading="adminSaving"
        @ok="saveAdminPersonality"
      >
        <Form layout="vertical">
          <Form.Item label="Code">
            <Input v-model:value="adminForm.code" :disabled="adminEditingId != null" placeholder="例如 SUDO / 404 / NULL" />
          </Form.Item>
          <Form.Item label="名称">
            <Input v-model:value="adminForm.name" placeholder="人格名称" />
          </Form.Item>
          <Form.Item label="座右铭">
            <Input v-model:value="adminForm.motto" placeholder="一句话描述" />
          </Form.Item>
          <Form.Item label="主题色（HEX）">
            <Input v-model:value="adminForm.color" placeholder="#f97316" />
          </Form.Item>
          <Form.Item label="技术栈">
            <Input v-model:value="adminForm.techStack" placeholder="例如 Java / Vue / Go" />
          </Form.Item>
          <Form.Item label="灵魂格言">
            <Input v-model:value="adminForm.spirit" placeholder="一句话" />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea v-model:value="adminForm.description" :auto-size="{ minRows: 3, maxRows: 6 }" />
          </Form.Item>
          <Form.Item label="优势（每行一条）">
            <Input.TextArea v-model:value="adminStrengthsText" :auto-size="{ minRows: 3, maxRows: 6 }" />
          </Form.Item>
          <Form.Item label="注意（每行一条）">
            <Input.TextArea v-model:value="adminWeaknessesText" :auto-size="{ minRows: 3, maxRows: 6 }" />
          </Form.Item>
          <Form.Item label="Vector（JSON 数组，长度 15）">
            <Input.TextArea v-model:value="adminVectorText" :auto-size="{ minRows: 2, maxRows: 4 }" />
          </Form.Item>
          <Form.Item label="隐藏人格">
            <Switch v-model:checked="adminForm.isSpecial" />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  </div>
</template>
