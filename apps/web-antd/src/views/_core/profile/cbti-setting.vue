<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Button, Form, Input, Modal, Popconfirm, Space, Spin, Switch, Table, Tag, Upload, message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import QRCode from 'qrcode';

import {
  cbtiTestApi,
  createCbtiPersonalityApi,
  deleteCbtiHistoryApi,
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

const shareCopied = ref(false);
const posterGenerating = ref(false);
const posterVisible = ref(false);
const posterUrl = ref<string | null>(null);

const getSiteUrl = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/profile?tab=cbti`;
};

const buildShareText = (r: CbtiTestResult) => {
  const p = r.personality;
  const url = getSiteUrl();
  const sitePart = url ? `\n\n你是 SUDO 还是 NULL？来测测 👉 ${url}` : '';
  return `我在 CBTI 程序员人格测试中测出了【${p.code} · ${p.name}】！\n「${p.motto}」\n匹配度 ${r.similarity}%${sitePart}`;
};

const shareText = computed(() => (result.value ? buildShareText(result.value) : ''));

const copyShareText = async () => {
  const text = shareText.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  shareCopied.value = true;
  message.success('已复制文案');
  setTimeout(() => {
    shareCopied.value = false;
  }, 2000);
};

const downloadPoster = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
};

const savePoster = () => {
  if (!posterUrl.value || !result.value) return;
  downloadPoster(posterUrl.value, `CBTI-${result.value.personality.code}.png`);
};

const loadImage = async (src: string) => {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
  return img;
};

const drawRoundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const generatePoster = async () => {
  if (!result.value || posterGenerating.value) return;
  posterGenerating.value = true;
  try {
    const r = result.value;
    const p = r.personality;
    const siteUrl = getSiteUrl();

    const S = 3;
    const W = 750 * S;
    const H = 1334 * S;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas context');
    const f = (v: number) => v * S;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff7ed');
    bg.addColorStop(1, '#fffbf5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, '#f97316');
    bar.addColorStop(1, '#fbbf24');
    ctx.fillStyle = bar;
    ctx.fillRect(0, 0, W, f(8));

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f97316';
    ctx.font = `900 ${f(28)}px system-ui, sans-serif`;
    ctx.fillText('CBTI · 程序员行为类型测试', W / 2, f(55));

    try {
      if (p.imageUrl) {
        const charImg = await loadImage(p.imageUrl);
        const imgH = f(300);
        const imgW = imgH * (charImg.width / charImg.height);
        ctx.drawImage(charImg, (W - imgW) / 2, f(110), imgW, imgH);
      }
    } catch {}

    ctx.fillStyle = p.color || '#f97316';
    ctx.font = `900 ${f(88)}px ui-monospace, monospace`;
    ctx.fillText(p.code, W / 2, f(475));

    ctx.fillStyle = '#1c1917';
    ctx.font = `900 ${f(44)}px system-ui, sans-serif`;
    ctx.fillText(p.name, W / 2, f(530));

    ctx.fillStyle = '#78716c';
    ctx.font = `${f(22)}px system-ui, sans-serif`;
    ctx.fillText(`「${p.motto}」`, W / 2, f(570));

    ctx.fillStyle = p.color || '#f97316';
    ctx.font = `900 ${f(64)}px system-ui, sans-serif`;
    ctx.fillText(`${r.similarity}%`, W / 2, f(650));
    ctx.fillStyle = '#a8a29e';
    ctx.font = `${f(20)}px system-ui, sans-serif`;
    ctx.fillText('匹配度', W / 2, f(680));

    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = f(2);
    ctx.beginPath();
    ctx.moveTo(f(60), f(710));
    ctx.lineTo(W - f(60), f(710));
    ctx.stroke();

    ctx.fillStyle = '#57534e';
    ctx.font = `${f(21)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    const maxTW = W - f(120);
    const description = (p.description || '').slice(0, 180) + ((p.description || '').length > 180 ? '...' : '');
    let line = '';
    let ty = f(750);
    for (const char of description) {
      const test = line + char;
      if (ctx.measureText(test).width > maxTW) {
        ctx.fillText(line, f(60), ty);
        line = char;
        ty += f(32);
        if (ty > f(900)) {
          ctx.fillText(line + '...', f(60), ty);
          line = '';
          break;
        }
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, f(60), ty);

    const strengths = (p.strengths ?? []).slice(0, 3);
    const weaknesses = (p.weaknesses ?? []).slice(0, 3);

    ctx.fillStyle = '#f97316';
    ctx.font = `900 ${f(24)}px system-ui, sans-serif`;
    ctx.fillText('优势', f(60), f(960));
    ctx.fillStyle = '#57534e';
    ctx.font = `${f(20)}px system-ui, sans-serif`;
    strengths.forEach((s, i) => {
      ctx.fillText(`✓  ${s}`, f(85), f(995 + i * 34));
    });

    ctx.fillStyle = '#d97706';
    ctx.font = `900 ${f(24)}px system-ui, sans-serif`;
    ctx.fillText('注意', W / 2 + f(10), f(960));
    ctx.fillStyle = '#57534e';
    ctx.font = `${f(20)}px system-ui, sans-serif`;
    weaknesses.forEach((w, i) => {
      ctx.fillText(`!  ${w}`, W / 2 + f(35), f(995 + i * 34));
    });

    const bottomY = f(1110);
    const qrSize = f(140);
    try {
      if (siteUrl) {
        const qrDataUrl = await QRCode.toDataURL(siteUrl, {
          width: qrSize,
          margin: 1,
          color: { dark: '#f97316', light: '#ffffff' },
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.fillStyle = '#fff7ed';
        drawRoundRect(ctx, f(50), bottomY - f(10), qrSize + f(20), qrSize + f(20), f(12));
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = f(2);
        ctx.stroke();
        ctx.drawImage(qrImg, f(60), bottomY, qrSize, qrSize);
      }
    } catch {}

    const ctaX = f(60) + qrSize + f(40);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1c1917';
    ctx.font = `900 ${f(28)}px system-ui, sans-serif`;
    ctx.fillText('你是什么类型的程序员？', ctaX, bottomY + f(50));

    const host = typeof window !== 'undefined' ? window.location.host : '';
    ctx.fillStyle = '#f97316';
    ctx.font = `900 ${f(22)}px system-ui, sans-serif`;
    ctx.fillText('扫码或访问', ctaX, bottomY + f(90));
    if (host) ctx.fillText(host, ctaX, bottomY + f(120));

    ctx.fillStyle = '#a8a29e';
    ctx.font = `${f(18)}px system-ui, sans-serif`;
    ctx.fillText('30 道题 · 27 种编程人格', ctaX, bottomY + f(160));

    ctx.textAlign = 'center';
    ctx.fillStyle = '#d6d3d1';
    ctx.font = `${f(16)}px system-ui, sans-serif`;
    ctx.fillText('CBTI · 程序员行为类型测试', W / 2, H - f(30));

    posterUrl.value = canvas.toDataURL('image/png', 1.0);
    posterVisible.value = true;
  } catch (e: any) {
    message.error(e?.message || '生成海报失败');
  } finally {
    posterGenerating.value = false;
  }
};

const typesVisible = ref(false);
const selectedType = ref<string | null>(null);

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyList = ref<CbtiHistoryItem[]>([]);
const historyDeleting = ref<Record<string, boolean>>({});

const userStore = useUserStore();
const isAdmin = computed(() => (userStore.userInfo?.roles ?? []).includes('admin'));

const adminVisible = ref(false);
const adminLoading = ref(false);
const adminList = ref<CbtiAdminPersonality[]>([]);
const adminKeyword = ref('');

const adminImagePreviewVisible = ref(false);
const adminImagePreviewUrl = ref<string | null>(null);
const adminImagePreviewTitle = ref('图片预览');

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

const adminListShown = computed(() => {
  const kw = adminKeyword.value.trim().toLowerCase();
  if (!kw) return adminList.value;
  return (adminList.value || []).filter((x) => {
    const code = String(x.code ?? '').toLowerCase();
    const name = String(x.name ?? '').toLowerCase();
    return code.includes(kw) || name.includes(kw);
  });
});

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const normalizeHex6 = (hex: string) => {
  const v = (hex || '').trim();
  if (!hexColorRegex.test(v)) return null;
  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return v.toUpperCase();
};

const adminColorValid = computed(() => {
  const raw = (adminForm.value.color || '').trim();
  if (!raw) return true;
  return hexColorRegex.test(raw);
});

const adminColorPreview = computed(() => {
  const raw = (adminForm.value.color || '').trim();
  return normalizeHex6(raw) ?? '#F97316';
});

const adminColorPickerValue = computed(() => {
  const raw = (adminForm.value.color || '').trim();
  return normalizeHex6(raw) ?? '#F97316';
});

const adminColorValidateStatus = computed(() => {
  const raw = (adminForm.value.color || '').trim();
  if (!raw) return undefined;
  return adminColorValid.value ? undefined : 'error';
});

const adminColorHelp = computed(() => {
  const raw = (adminForm.value.color || '').trim();
  if (!raw) return '支持 #RGB 或 #RRGGBB，可直接使用右侧取色器';
  if (adminColorValid.value) return '支持 #RGB 或 #RRGGBB';
  return '格式不正确，例如 #f97316 / #fff';
});

const onAdminPickColor = (e: Event) => {
  const v = (e.target as HTMLInputElement | null)?.value;
  if (!v) return;
  adminForm.value.color = v.toUpperCase();
};

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
  { title: '图片', key: 'image', width: 96 },
  { title: 'Code', dataIndex: 'code', key: 'code', width: 150 },
  { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '隐藏', dataIndex: 'isSpecial', key: 'isSpecial', width: 90 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 190 },
  { title: '操作', key: 'action', width: 300, fixed: 'right' },
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
  adminKeyword.value = '';
  await loadAdminList();
  adminVisible.value = true;
};

const openAdminImagePreview = (row: any) => {
  const r = row as CbtiAdminPersonality;
  if (!r?.imageUrl) return;
  adminImagePreviewUrl.value = r.imageUrl;
  adminImagePreviewTitle.value = `${r.code || ''} 图片预览`;
  adminImagePreviewVisible.value = true;
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
  shareCopied.value = false;
  posterGenerating.value = false;
  posterVisible.value = false;
  posterUrl.value = null;
};

const startTest = async () => {
  await init();
  currentIndex.value = 0;
  answers.value = {};
  hiddenAnswers.value = {};
  result.value = null;
  showDetails.value = false;
  shareCopied.value = false;
  posterGenerating.value = false;
  posterVisible.value = false;
  posterUrl.value = null;
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

const deleteHistoryItem = async (record: any) => {
  const id = String((record as CbtiHistoryItem).id);
  historyDeleting.value = { ...historyDeleting.value, [id]: true };
  try {
    await deleteCbtiHistoryApi(id);
    message.success('删除成功');
    historyList.value = await getCbtiHistoryApi();
  } catch (e: any) {
    message.error(e?.message || '删除失败');
  } finally {
    historyDeleting.value = { ...historyDeleting.value, [id]: false };
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

        <div
          class="rounded-3xl overflow-hidden shadow-sm border border-orange-100 mb-5"
          :style="{ background: 'linear-gradient(135deg, #f97316, #fbbf24)' }"
        >
          <div class="p-6 text-white">
            <div class="text-lg font-black mb-1">分享你的编程人格</div>
            <div class="text-sm text-white/80 mb-4">让更多程序员发现自己的类型</div>
            <div class="bg-white/15 border border-white/20 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line mb-4">
              {{ shareText }}
            </div>
            <div class="flex flex-wrap gap-3">
              <button
                class="px-5 py-2.5 rounded-full bg-white text-orange-600 font-black text-sm hover:bg-orange-50 transition disabled:opacity-60"
                @click="copyShareText"
              >
                {{ shareCopied ? '已复制' : '复制文案' }}
              </button>
              <button
                class="px-5 py-2.5 rounded-full bg-white/20 border border-white/30 text-white font-black text-sm hover:bg-white/25 transition disabled:opacity-60"
                :disabled="posterGenerating"
                @click="posterUrl ? savePoster() : generatePoster()"
              >
                {{ posterUrl ? '保存海报' : posterGenerating ? '生成中...' : '生成海报' }}
              </button>
              <button
                v-if="posterUrl"
                class="px-5 py-2.5 rounded-full bg-white/10 border border-white/25 text-white font-black text-sm hover:bg-white/15 transition"
                @click="posterVisible = true"
              >
                预览
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-3 flex-wrap">
          <Button class="!rounded-full !font-black" @click="startTest">重新测试</Button>
          <Button class="!rounded-full !font-black" @click="openHistory">历史记录</Button>
          <Button type="primary" class="!rounded-full !font-black" @click="resetTest">回到首页</Button>
        </div>

        <Modal v-model:open="posterVisible" title="CBTI 海报" :footer="null" :width="820">
          <div class="text-xs text-stone-400 mb-3">移动端可长按保存到相册</div>
          <img v-if="posterUrl" :src="posterUrl" class="w-full rounded-2xl border border-orange-100 bg-white" />
          <div class="flex justify-end gap-2 mt-4">
            <Button class="!rounded-full !font-black" @click="posterVisible = false">关闭</Button>
            <Button type="primary" class="!rounded-full !font-black" :disabled="!posterUrl" @click="savePoster">下载</Button>
          </div>
        </Modal>
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
                <div class="flex items-center gap-2">
                  <Button type="link" size="small" @click="viewHistoryDetail(record)">查看</Button>
                  <Popconfirm
                    title="确认删除该条历史记录？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="deleteHistoryItem(record)"
                  >
                    <Button type="link" size="small" danger :disabled="historyDeleting[String(record.id)] === true">
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </template>
            </template>
          </Table>
        </Spin>
      </Modal>

      <Modal
        v-model:open="adminVisible"
        title="CBTI 角色管理"
        :footer="null"
        :width="1100"
        centered
        :body-style="{ padding: '12px 16px' }"
      >
        <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Space wrap>
            <Button type="primary" @click="openCreatePersonality">
              <template #icon><PlusOutlined /></template>
              新增角色
            </Button>
            <Input v-model:value="adminKeyword" allow-clear class="w-full md:w-[260px]" placeholder="搜索 Code / 名称">
              <template #prefix><SearchOutlined class="text-stone-400" /></template>
            </Input>
          </Space>
          <Button :loading="adminLoading" @click="loadAdminList">
            <template #icon><ReloadOutlined /></template>
            刷新
          </Button>
        </div>

        <div class="rounded-xl border border-stone-200 overflow-hidden bg-white">
          <Spin :spinning="adminLoading">
            <Table
              class="cbti-admin-table"
              :data-source="adminListShown"
              :columns="adminColumns"
              :pagination="{ pageSize: 10, showSizeChanger: true }"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'image'">
                  <button
                    type="button"
                    class="w-14 h-14 rounded-xl bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center cursor-zoom-in"
                    :class="record.imageUrl ? 'hover:shadow-sm hover:border-orange-200' : ''"
                    @click="openAdminImagePreview(record)"
                  >
                    <img v-if="record.imageUrl" :src="record.imageUrl" class="w-full h-full object-contain" />
                    <span v-else class="text-stone-400 text-xs">无图</span>
                  </button>
                </template>
                <template v-else-if="column.key === 'code'">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-black" :style="{ color: record.color || '#f97316' }">{{ record.code }}</span>
                    <Tag v-if="record.isSpecial" color="gold">隐藏</Tag>
                  </div>
                </template>
                <template v-else-if="column.key === 'updateTime'">
                  <div class="text-xs text-stone-500">
                    <div class="leading-5">{{ String(record.updateTime || '').split(' ')[0] }}</div>
                    <div class="leading-5 font-mono">{{ String(record.updateTime || '').split(' ')[1] }}</div>
                  </div>
                </template>
                <template v-else-if="column.key === 'isSpecial'">
                  <span v-if="record.isSpecial" class="text-xs text-amber-600 font-medium">是</span>
                  <span v-else class="text-stone-400 text-xs">否</span>
                </template>
                <template v-else-if="column.key === 'action'">
                  <Space size="small" class="whitespace-nowrap">
                    <Button type="link" size="small" @click="openEditPersonality(record)">
                      <template #icon><EditOutlined /></template>
                      编辑
                    </Button>
                    <Popconfirm title="确认删除该角色？" ok-text="删除" cancel-text="取消" @confirm="deleteAdminPersonality(record)">
                      <Button type="link" size="small" danger>
                        <template #icon><DeleteOutlined /></template>
                        删除
                      </Button>
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
                      <Button type="link" size="small">
                        上传图
                      </Button>
                    </Upload>
                  </Space>
                </template>
              </template>
            </Table>
          </Spin>
        </div>

        <Modal
          v-model:open="adminImagePreviewVisible"
          :title="adminImagePreviewTitle"
          :footer="null"
          :width="760"
          centered
          :body-style="{ padding: '12px' }"
        >
          <div class="w-full h-[70vh] rounded-xl border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center">
            <img v-if="adminImagePreviewUrl" :src="adminImagePreviewUrl" class="max-w-full max-h-[70vh] object-contain" />
          </div>
        </Modal>
      </Modal>

      <Modal
        v-model:open="adminEditVisible"
        :title="adminEditingId == null ? '新增角色' : '编辑角色'"
        ok-text="保存"
        cancel-text="取消"
        :confirm-loading="adminSaving"
        :width="900"
        centered
        :body-style="{ maxHeight: '72vh', overflowY: 'auto', padding: '16px 20px' }"
        @ok="saveAdminPersonality"
      >
        <div class="mb-4 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <div class="w-11 h-11 rounded-xl bg-white border border-stone-200 overflow-hidden flex items-center justify-center">
            <span class="font-mono font-black text-[13px]" :style="{ color: adminColorPreview }">
              {{ (adminForm.code || 'CODE').slice(0, 10) }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <div class="text-base font-semibold text-stone-900 truncate">{{ adminForm.name || '未命名角色' }}</div>
              <Tag v-if="adminForm.isSpecial" color="gold">隐藏</Tag>
            </div>
            <div class="text-xs text-stone-500 truncate">{{ adminForm.motto || '一句话描述…' }}</div>
          </div>
          <div class="w-9 h-9 rounded-xl border border-stone-200 bg-white" :style="{ backgroundColor: adminColorPreview }" />
        </div>

        <Form layout="vertical">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
            <Form.Item label="Code">
              <Input
                v-model:value="adminForm.code"
                class="font-mono"
                :maxlength="32"
                :disabled="adminEditingId != null"
                placeholder="例如 SUDO / 404 / NULL"
              />
            </Form.Item>

            <Form.Item label="名称">
              <Input v-model:value="adminForm.name" :maxlength="32" placeholder="人格名称" />
            </Form.Item>

            <Form.Item label="座右铭" class="md:col-span-2">
              <Input v-model:value="adminForm.motto" :maxlength="80" placeholder="一句话描述" />
            </Form.Item>

            <Form.Item label="主题色" :help="adminColorHelp" :validate-status="adminColorValidateStatus">
              <Input v-model:value="adminForm.color" class="font-mono" placeholder="#f97316">
                <template #addonAfter>
                  <div class="flex items-center gap-2">
                    <div class="w-5 h-5 rounded border border-stone-200" :style="{ backgroundColor: adminColorPreview }" />
                    <input
                      type="color"
                      :value="adminColorPickerValue"
                      class="h-6 w-8 cursor-pointer bg-transparent border-0 p-0"
                      @input="onAdminPickColor"
                    />
                  </div>
                </template>
              </Input>
            </Form.Item>

            <Form.Item label="技术栈">
              <Input v-model:value="adminForm.techStack" :maxlength="120" placeholder="例如 Java / Vue / Go" />
            </Form.Item>

            <Form.Item label="灵魂格言" class="md:col-span-2">
              <Input v-model:value="adminForm.spirit" :maxlength="120" placeholder="一句话" />
            </Form.Item>

            <Form.Item label="描述" class="md:col-span-2">
              <Input.TextArea v-model:value="adminForm.description" :auto-size="{ minRows: 3, maxRows: 6 }" />
            </Form.Item>

            <Form.Item label="优势（每行一条）" class="md:col-span-2">
              <Input.TextArea v-model:value="adminStrengthsText" :auto-size="{ minRows: 3, maxRows: 6 }" />
            </Form.Item>

            <Form.Item label="注意（每行一条）" class="md:col-span-2">
              <Input.TextArea v-model:value="adminWeaknessesText" :auto-size="{ minRows: 3, maxRows: 6 }" />
            </Form.Item>

            <Form.Item label="Vector（JSON 数组，长度 15）" class="md:col-span-2">
              <Input.TextArea v-model:value="adminVectorText" class="font-mono text-xs" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </Form.Item>

            <Form.Item label="隐藏人格" class="md:col-span-2">
              <div class="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
                <span class="text-xs text-stone-500">对普通用户隐藏，仅管理员可见</span>
                <Switch v-model:checked="adminForm.isSpecial" />
              </div>
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </Spin>
  </div>
</template>
