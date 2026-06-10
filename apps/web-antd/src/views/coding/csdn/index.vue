<script lang="ts" setup>
import type { CsdnArticle, CsdnStats } from '#/api/core/csdn';

import { onMounted, ref } from 'vue';

import {
  CommentOutlined,
  EditOutlined,
  EyeOutlined,
  LikeOutlined,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';
import { List, message } from 'ant-design-vue';

import { getCsdnArticlesApi, getCsdnStatsApi } from '#/api/core/csdn';
import { getUserBindListApi } from '#/api/core/user-bind';

import CodingDashboardLayout from '../components/CodingDashboardLayout.vue';
import DataListCard from '../components/DataListCard.vue';
import StatCard from '../components/StatCard.vue';

defineOptions({ name: 'Csdn' });

const username = ref('');
const loading = ref(false);
const statsLoading = ref(false);
const articlesLoading = ref(false);
const error = ref(false);
const errorMessage = ref('');

const stats = ref<CsdnStats | null>(null);
const articles = ref<CsdnArticle[]>([]);

function formatNumber(value?: number) {
  return Number(value || 0).toLocaleString();
}

async function fetchStats() {
  statsLoading.value = true;
  try {
    stats.value = await getCsdnStatsApi(username.value);
  } catch (error_: any) {
    console.error(error_);
    throw new Error(error_?.message || '获取 CSDN 统计数据失败');
  } finally {
    statsLoading.value = false;
  }
}

async function fetchArticles() {
  articlesLoading.value = true;
  try {
    articles.value = await getCsdnArticlesApi(username.value, 20);
  } catch (error_: any) {
    console.error(error_);
    throw new Error(error_?.message || '获取 CSDN 文章失败');
  } finally {
    articlesLoading.value = false;
  }
}

async function fetchData() {
  if (!username.value) {
    return;
  }

  loading.value = true;
  error.value = false;
  errorMessage.value = '';

  try {
    const [statsRes, articlesRes] = await Promise.allSettled([
      fetchStats(),
      fetchArticles(),
    ]);
    const failedMessages: string[] = [];

    if (statsRes.status === 'rejected') {
      failedMessages.push('统计');
    }

    if (articlesRes.status === 'rejected') {
      failedMessages.push('文章');
    }

    if (failedMessages.length > 0) {
      error.value = true;
      errorMessage.value = `获取 CSDN ${failedMessages.join('、')}失败`;
    }
  } finally {
    loading.value = false;
  }
}

async function loadUserBind() {
  const binds = await getUserBindListApi();
  const csdnBind = binds.find((item) => item.platform === 'csdn');
  username.value = csdnBind?.platformUsername || '';
}

onMounted(async () => {
  try {
    loading.value = true;
    await loadUserBind();

    if (username.value) {
      await fetchData();
    } else {
      message.warning('未绑定 CSDN 账号，请在个人中心绑定');
    }
  } catch (error_) {
    error.value = true;
    errorMessage.value = '获取 CSDN 绑定信息失败';
    console.error('获取绑定信息失败', error_);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <CodingDashboardLayout
    :error="error"
    :error-message="errorMessage"
    :loading="loading && !stats && articles.length === 0"
  >
    <template #skeleton>
      <div
        class="mb-7 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5"
      >
        <StatCard
          v-for="item in 5"
          :key="item"
          loading
          title="加载中"
          value="-"
        />
      </div>
      <DataListCard title="近期文章" loading />
    </template>

    <div
      class="mb-7 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-5"
    >
      <StatCard
        title="总访问量"
        :value="stats?.viewCount?.toLocaleString()"
        color="blue"
        :loading="statsLoading"
      >
        <template #icon><EyeOutlined /></template>
      </StatCard>

      <StatCard
        title="原创数"
        :value="stats?.originalCount?.toLocaleString()"
        color="green"
        :loading="statsLoading"
      >
        <template #icon><EditOutlined /></template>
      </StatCard>

      <StatCard
        title="全站排名"
        :value="stats?.rank?.toLocaleString()"
        color="orange"
        :loading="statsLoading"
      >
        <template #icon><TrophyOutlined /></template>
      </StatCard>

      <StatCard
        title="粉丝数"
        :value="stats?.fansCount?.toLocaleString()"
        color="cyan"
        :loading="statsLoading"
      >
        <template #icon><UserOutlined /></template>
      </StatCard>

      <StatCard
        title="获赞数"
        :value="stats?.likeCount?.toLocaleString()"
        color="red"
        :loading="statsLoading"
      >
        <template #icon><LikeOutlined /></template>
      </StatCard>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="lg:col-span-2">
        <DataListCard
          title="近期文章"
          :is-empty="articles.length === 0"
          :loading="articlesLoading"
          empty-text="暂无近期文章"
        >
          <List item-layout="horizontal" :data-source="articles">
            <template #renderItem="{ item }: { item: CsdnArticle }">
              <List.Item
                class="!px-5 !py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div class="w-full">
                  <div class="mb-2 flex items-center justify-between">
                    <a
                      class="min-w-0 flex-1 truncate pr-4 text-base font-medium text-blue-500 hover:underline md:text-lg"
                      :href="item.url"
                      target="_blank"
                      :title="item.title"
                    >
                      {{ item.title }}
                    </a>
                    <span class="shrink-0 text-sm text-gray-400">
                      {{ item.postTime || '-' }}
                    </span>
                  </div>

                  <div
                    class="mb-3 line-clamp-2 text-sm leading-6 text-gray-500 md:text-base dark:text-gray-400"
                    :title="item.description"
                  >
                    {{ item.description || '暂无摘要' }}
                  </div>

                  <div class="flex items-center gap-5 text-sm text-gray-400">
                    <span
                      v-if="item.viewCount !== undefined"
                      class="flex items-center gap-1"
                      title="阅读"
                    >
                      <EyeOutlined /> {{ formatNumber(item.viewCount) }}
                    </span>
                    <span
                      v-if="item.likeCount !== undefined"
                      class="flex items-center gap-1"
                      title="点赞"
                    >
                      <LikeOutlined /> {{ formatNumber(item.likeCount) }}
                    </span>
                    <span
                      v-if="item.commentCount !== undefined"
                      class="flex items-center gap-1"
                      title="评论"
                    >
                      <CommentOutlined /> {{ formatNumber(item.commentCount) }}
                    </span>
                    <span
                      v-if="item.collectCount !== undefined"
                      class="flex items-center gap-1"
                      title="收藏"
                    >
                      <StarOutlined /> {{ formatNumber(item.collectCount) }}
                    </span>
                  </div>
                </div>
              </List.Item>
            </template>
          </List>
        </DataListCard>
      </div>
    </div>
  </CodingDashboardLayout>
</template>
