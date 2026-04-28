<script setup lang="ts">
import type { PasswordVault } from '#/api/core/password-manager';

import { onMounted, onUnmounted, ref, computed } from 'vue';

import { usePasswordVaultStore } from '#/store/password-vault';
import {
  decryptText,
  generateSalt,
} from '#/utils/crypto';
import {
  copyToClipboard,
} from '#/utils/clipboard';

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HeartFilled,
  HeartOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Tooltip,
} from 'ant-design-vue';
import { useRouter } from 'vue-router';

import {
  createPasswordApi,
  deletePasswordApi,
  getCategoriesApi,
  getPasswordListApi,
  updatePasswordApi,
} from '#/api/core/password-manager';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

interface DecryptedPassword extends PasswordVault {
  decryptedUsername?: string;
  decryptedPassword?: string;
  decryptedRemark?: string;
  showPassword?: boolean;
}

const router = useRouter();
const store = usePasswordVaultStore();

const passwords = ref<PasswordVault[]>([]);
const decryptedPasswords = ref<DecryptedPassword[]>([]);
const loading = ref(false);
const searchText = ref('');
const selectedCategory = ref<string | undefined>(undefined);
const categories = ref<string[]>([]);

const isFirstTime = computed(() => passwords.value.length === 0 && !loading.value);

const filteredPasswords = computed(() => {
  let result = decryptedPasswords.value;
  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    result = result.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        (p.website && p.website.toLowerCase().includes(search))
    );
  }
  if (selectedCategory.value) {
    result = result.filter((p) => p.category === selectedCategory.value);
  }
  return result;
});

const fetchPasswords = async () => {
  if (!store.isUnlocked) {
    router.push('/password-manager/lock');
    return;
  }

  loading.value = true;
  try {
    passwords.value = await getPasswordListApi();
    decryptedPasswords.value = passwords.value.map((p) => ({
      ...p,
      showPassword: false,
    }));
  } catch (error) {
    message.error('获取密码列表失败');
  } finally {
    loading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    categories.value = await getCategoriesApi();
  } catch (error) {
    categories.value = ['工作', '生活', '金融', '社交', '其他'];
  }
};

const decryptPasswords = async () => {
  if (!store.masterKey) return;

  for (const p of decryptedPasswords.value) {
    try {
      p.decryptedUsername = await decryptText(p.username, store.masterKey, p.salt);
      p.decryptedPassword = await decryptText(p.password, store.masterKey, p.salt);
      p.decryptedRemark = await decryptText(p.remark, store.masterKey, p.salt);
    } catch (error) {
      p.decryptedUsername = '解密失败';
      p.decryptedPassword = '解密失败';
      p.decryptedRemark = '解密失败';
    }
  }
};

const handleCopy = async (text: string, type: string) => {
  try {
    await copyToClipboard(text);
    message.success(`${type}已复制到剪贴板，30秒后自动清除`);
    setTimeout(() => {
      copyToClipboard('');
    }, 30000);
  } catch (error) {
    message.error('复制失败');
  }
};

const handleToggleFavorite = async (item: DecryptedPassword) => {
  try {
    await updatePasswordApi(item.id, {
      title: item.title,
      website: item.website,
      category: item.category,
      username: item.username,
      password: item.password,
      salt: item.salt,
      remark: item.remark,
      favorite: !item.favorite,
    });
    item.favorite = !item.favorite;
    message.success(item.favorite ? '已添加收藏' : '已取消收藏');
  } catch (error) {
    message.error('操作失败');
  }
};

const handleDelete = async (id: string) => {
  try {
    await deletePasswordApi(id);
    message.success('删除成功');
    fetchPasswords();
  } catch (error) {
    message.error('删除失败');
  }
};

const handleEdit = (id: string) => {
  store.updateActivity();
  router.push(`/password-manager/edit/${id}`);
};

const handleAdd = () => {
  store.updateActivity();
  router.push('/password-manager/add');
};

const formatTime = (time: string) => {
  try {
    return new Date(time).toLocaleString();
  } catch {
    return time;
  }
};

// Activity tracking for auto-lock
let activityCheckInterval: number;

onMounted(() => {
  fetchPasswords();
  fetchCategories();

  // Check for timeout every minute
  activityCheckInterval = window.setInterval(() => {
    if (store.checkTimeout()) {
      message.warning('由于长时间无操作，已自动锁定');
      router.push('/password-manager/lock');
    }
  }, 60000);

  // Track user activity
  const handleActivity = () => store.updateActivity();
  document.addEventListener('click', handleActivity);
  document.addEventListener('keypress', handleActivity);
});

onUnmounted(() => {
  clearInterval(activityCheckInterval);
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden p-5">
    <!-- Header Search -->
    <div class="mb-4 flex gap-3">
      <Input
        v-model:value="searchText"
        placeholder="搜索标题或网站..."
        class="flex-1"
        allow-clear
      >
        <template #prefix><SearchOutlined /></template>
      </Input>
      <Select
        v-model:value="selectedCategory"
        placeholder="选择分类"
        class="w-32"
        allow-clear
      >
        <Select.Option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </Select.Option>
      </Select>
      <Button @click="fetchPasswords">
        刷新
      </Button>
    </div>

    <!-- Password List -->
    <div class="flex-1 overflow-y-auto">
      <Spin :spinning="loading">
        <div v-if="filteredPasswords.length > 0" class="space-y-3">
          <div
            v-for="item in filteredPasswords"
            :key="item.id"
            class="group rounded-lg border border-slate-200 bg-white p-4 transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-semibold">{{ item.title }}</h3>
                  <span
                    v-if="item.category"
                    class="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700"
                  >
                    {{ item.category }}
                  </span>
                </div>
                <p v-if="item.website" class="mt-1 text-sm text-slate-500">
                  {{ item.website }}
                </p>
                <div class="mt-2 flex gap-4">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-slate-500">账号：</span>
                    <span class="font-mono text-sm">{{ item.decryptedUsername || '******' }}</span>
                    <Tooltip v-if="item.decryptedUsername" title="复制账号">
                      <CopyOutlined
                        class="cursor-pointer text-slate-400 hover:text-blue-500"
                        @click="handleCopy(item.decryptedUsername!, '账号')"
                      />
                    </Tooltip>
                  </div>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span class="text-sm text-slate-500">密码：</span>
                  <span class="font-mono text-sm">
                    {{ item.showPassword ? (item.decryptedPassword || '******') : '******' }}
                  </span>
                  <Tooltip :title="item.showPassword ? '隐藏密码' : '显示密码'">
                    <EyeOutlined
                      v-if="!item.showPassword"
                      class="cursor-pointer text-slate-400 hover:text-blue-500"
                      @click="item.showPassword = true; store.updateActivity()"
                    />
                    <EyeInvisibleOutlined
                      v-else
                      class="cursor-pointer text-slate-400 hover:text-blue-500"
                      @click="item.showPassword = false; store.updateActivity()"
                    />
                  </Tooltip>
                  <Tooltip v-if="item.decryptedPassword" title="复制密码">
                    <CopyOutlined
                      class="cursor-pointer text-slate-400 hover:text-blue-500"
                      @click="handleCopy(item.decryptedPassword!, '密码')"
                    />
                  </Tooltip>
                </div>
                <p v-if="item.decryptedRemark && item.showPassword" class="mt-2 text-sm text-slate-400">
                  备注：{{ item.decryptedRemark }}
                </p>
              </div>
              <div class="flex flex-col gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Tooltip title="收藏">
                  <Button
                    type="text"
                    size="small"
                    @click="handleToggleFavorite(item)"
                  >
                    <template #icon>
                      <StarFilled v-if="item.favorite" class="text-yellow-500" />
                      <StarOutlined v-else />
                    </template>
                  </Button>
                </Tooltip>
                <Tooltip title="编辑">
                  <Button
                    type="text"
                    size="small"
                    @click="handleEdit(item.id)"
                  >
                    <template #icon><EditOutlined /></template>
                  </Button>
                </Tooltip>
                <Popconfirm
                  title="确定要删除这条记录吗？"
                  ok-text="是"
                  cancel-text="否"
                  @confirm="handleDelete(item.id)"
                >
                  <Tooltip title="删除">
                    <Button type="text" size="small" danger>
                      <template #icon><DeleteOutlined /></template>
                    </Button>
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
            <div class="mt-2 text-xs text-slate-400">
              更新时间：{{ formatTime(item.updateTime) }}
            </div>
          </div>
        </div>
        <Empty v-else-if="!loading" description="暂无密码">
          <Button type="primary" @click="handleAdd">
            <PlusOutlined /> 添加密码
          </Button>
        </Empty>
        <Empty v-else-if="isFirstTime && !loading" description="首次使用，请先设置主密码">
          <Button type="primary" @click="handleAdd">
            <PlusOutlined /> 添加密码
          </Button>
        </Empty>
      </Spin>
    </div>

    <GlobalFloatBtn @click="handleAdd" />
  </div>
</template>

<style scoped>
</style>