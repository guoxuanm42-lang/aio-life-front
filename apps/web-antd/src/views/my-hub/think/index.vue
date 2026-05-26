<script setup lang="ts">
import { useRouter } from 'vue-router';

import { Card } from 'ant-design-vue';

type ThemeKey = 'blue' | 'cyan' | 'green' | 'purple' | 'pink' | 'orange';

const router = useRouter();

const categories: Array<{
  key: string;
  title: string;
  desc: string;
  icon: string;
  tags: string;
  themeKey: ThemeKey;
  accent: string;
  rgb: string;
}> = [
  {
    key: 'work',
    title: '工作',
    desc: '工作想法、项目记录、会议灵感、临时事项',
    icon: '/thought-icons/work.png',
    tags: '公文包 / 文件',
    themeKey: 'blue',
    accent: '#1677ff',
    rgb: '22 119 255',
  },
  {
    key: 'life',
    title: '生活',
    desc: '日常琐事、生活感受、想买想做的事',
    icon: '/thought-icons/life.png',
    tags: '房子 / 咖啡 / 叶子',
    themeKey: 'cyan',
    accent: '#06b6d4',
    rgb: '6 182 212',
  },
  {
    key: 'study',
    title: '学习',
    desc: '想学的知识、技术点、资料线索、概念记录',
    icon: '/thought-icons/study.png',
    tags: '书 / 放大镜',
    themeKey: 'green',
    accent: '#22c55e',
    rgb: '34 197 94',
  },
  {
    key: 'social',
    title: '社交',
    desc: '人际关系、聊天记录、联系提醒、交流感受',
    icon: '/thought-icons/social.png',
    tags: '聊天 / 双人',
    themeKey: 'purple',
    accent: '#a855f7',
    rgb: '168 85 247',
  },
  {
    key: 'creation',
    title: '创作',
    desc: '写作、文章、视频、设计、产品创意、输出内容',
    icon: '/thought-icons/creation.png',
    tags: '画笔 / 火花',
    themeKey: 'pink',
    accent: '#ec4899',
    rgb: '236 72 153',
  },
  {
    key: 'travel',
    title: '旅行',
    desc: '想去的地方、旅行计划、路线灵感、旅途见闻',
    icon: '/thought-icons/travel.png',
    tags: '地图 / 飞机',
    themeKey: 'orange',
    accent: '#f97316',
    rgb: '249 115 22',
  },
];

const openCategory = (themeKey: ThemeKey) => {
  router.push({
    path: '/think/list',
    query: { themeKey },
  });
};
</script>

<template>
  <div class="think-category-page">
    <div class="category-grid">
      <Card
        v-for="item in categories"
        :key="item.key"
        hoverable
        :bordered="false"
        class="category-card"
        :style="{ '--accent': item.accent, '--accent-rgb': item.rgb }"
        @click="openCategory(item.themeKey)"
      >
        <div class="card-top">
          <div class="card-icon">
            <img :src="item.icon" :alt="item.title" class="card-icon-img" />
          </div>
          <div class="card-content">
            <div class="card-pill">{{ item.title }}</div>
            <div class="card-title">{{ item.title }}</div>
            <div class="card-desc">{{ item.desc }}</div>
          </div>
          <div class="card-badge">
            <img :src="item.icon" :alt="item.title" class="card-badge-img" />
          </div>
        </div>
        <div class="card-meta">
          <div class="card-meta-left">
            <span class="meta-dot" />
            <span class="meta-text">{{ item.tags }}</span>
          </div>
          <div class="card-meta-right">
            <span class="meta-enter">›</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.think-category-page {
  padding: 20px;
}

.category-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

@media (min-width: 640px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .category-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.category-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(135deg, rgb(255 255 255 / 70%), rgb(255 255 255 / 45%));
  box-shadow:
    0 14px 34px rgb(0 0 0 / 10%),
    0 10px 24px rgb(var(--accent-rgb) / 0.15);
  transition:
    transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1),
    box-shadow 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.category-card::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: radial-gradient(
    circle at 20% 10%,
    rgb(var(--accent-rgb) / 0.22) 0%,
    transparent 60%
  );
  opacity: 0.9;
  pointer-events: none;
}

.category-card :deep(.ant-card-body) {
  padding: 18px 18px 16px;
  position: relative;
  z-index: 1;
}

.category-card:hover {
  transform: translateY(-6px);
  box-shadow:
    0 18px 42px rgb(0 0 0 / 12%),
    0 18px 42px rgb(var(--accent-rgb) / 0.26);
}

.card-top {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding-right: 48px;
  position: relative;
}

.card-icon {
  width: 78px;
  height: 78px;
  flex: 0 0 78px;
  border-radius: 22px;
  background: rgb(255 255 255 / 55%);
  border: 1px solid rgb(255 255 255 / 65%);
  box-shadow:
    0 18px 35px rgb(var(--accent-rgb) / 0.18),
    inset 0 0 0 1px rgb(255 255 255 / 45%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-icon-img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.card-content {
  min-width: 0;
  flex: 1;
}

.card-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(var(--accent-rgb) / 0.92);
  background: rgb(var(--accent-rgb) / 0.12);
  border: 1px solid rgb(var(--accent-rgb) / 0.2);
}

.card-title {
  margin-top: 10px;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  color: rgb(0 0 0 / 0.82);
}

.card-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: rgb(0 0 0 / 0.55);
}

.card-badge {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  border-radius: 16px;
  background: rgb(255 255 255 / 55%);
  border: 1px solid rgb(255 255 255 / 65%);
  box-shadow:
    0 16px 30px rgb(var(--accent-rgb) / 0.18),
    inset 0 0 0 1px rgb(255 255 255 / 45%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-badge-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.card-meta {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgb(0 0 0 / 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card-meta-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.meta-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgb(var(--accent-rgb) / 0.75);
  box-shadow: 0 0 0 4px rgb(var(--accent-rgb) / 0.12);
  flex: 0 0 auto;
}

.meta-text {
  font-size: 12px;
  color: rgb(0 0 0 / 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-enter {
  font-size: 18px;
  line-height: 1;
  color: rgb(var(--accent-rgb) / 0.85);
}

@media (max-width: 768px) {
  .think-category-page {
    padding: 12px;
  }

  .category-card :deep(.ant-card-body) {
    padding: 14px;
  }

  .card-top {
    gap: 12px;
    padding-right: 44px;
  }

  .card-icon {
    width: 62px;
    height: 62px;
    border-radius: 18px;
    flex-basis: 62px;
  }

  .card-icon-img {
    width: 50px;
    height: 50px;
  }

  .card-title {
    font-size: 18px;
  }
}
</style>
