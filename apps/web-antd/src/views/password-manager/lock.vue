<script setup lang="ts">
import { ref } from 'vue';

import { usePasswordVaultStore } from '#/store/password-vault';

import {
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Spin,
} from 'ant-design-vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const store = usePasswordVaultStore();

const loading = ref(false);
const masterPassword = ref('');
const confirmPassword = ref('');
const isFirstTime = ref(false);

const handleUnlock = async () => {
  if (!masterPassword.value) {
    message.warning('请输入主密码');
    return;
  }

  if (isFirstTime.value) {
    if (masterPassword.value !== confirmPassword.value) {
      message.warning('两次输入的密码不一致');
      return;
    }
    if (masterPassword.value.length < 6) {
      message.warning('主密码长度至少6位');
      return;
    }
  }

  loading.value = true;
  try {
    // Store the master key in memory
    store.unlock(masterPassword.value);
    message.success('解锁成功');
    router.push('/password-manager');
  } finally {
    loading.value = false;
  }
};

const handleLogout = () => {
  store.lock();
  router.push('/');
};

// Check if first time (no stored master password indicator)
const checkFirstTime = () => {
  // For zero-knowledge architecture, we can't really know if it's first time
  // This is just a UI indication - in real scenario, you'd ask user to confirm
  isFirstTime.value = !store.isUnlocked;
};

checkFirstTime();
</script>

<template>
  <div class="flex h-full items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-5 dark:from-slate-800 dark:to-slate-900">
    <div class="w-full max-w-md">
      <Spin :spinning="loading">
        <div class="rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div class="text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <LockOutlined class="text-3xl text-blue-500" />
            </div>
            <h1 class="mb-2 text-2xl font-bold">密码管理器</h1>
            <p class="mb-6 text-sm text-slate-500">
              {{ isFirstTime ? '首次使用，请设置主密码' : '请输入主密码解锁' }}
            </p>
          </div>

          <Form layout="vertical" @finish="handleUnlock">
            <FormItem
              :label="isFirstTime ? '设置主密码' : '主密码'"
              :rules="[{ required: true, message: '请输入主密码' }]"
            >
              <Input
                v-model:value="masterPassword"
                type="password"
                placeholder="请输入主密码"
                size="large"
                autocomplete="off"
              >
                <template #prefix><LockOutlined /></template>
              </Input>
            </FormItem>

            <FormItem
              v-if="isFirstTime"
              label="确认主密码"
              :rules="[{ required: true, message: '请再次输入主密码' }]"
            >
              <Input
                v-model:value="confirmPassword"
                type="password"
                placeholder="请再次输入主密码"
                size="large"
                autocomplete="off"
              >
                <template #prefix><LockOutlined /></template>
              </Input>
            </FormItem>

            <FormItem>
              <Button
                type="primary"
                html-type="submit"
                size="large"
                :loading="loading"
                class="w-full"
              >
                {{ isFirstTime ? '设置密码' : '解锁' }}
              </Button>
            </FormItem>
          </Form>

          <div class="mt-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <div class="flex items-start gap-2">
              <SafetyOutlined class="mt-0.5 text-amber-500" />
              <div class="text-xs text-amber-700 dark:text-amber-300">
                <p class="font-semibold">安全提示：</p>
                <ul class="mt-1 list-disc list-inside space-y-1">
                  <li>主密码不会传输到服务器</li>
                  <li>遗忘主密码将无法解密您的密码</li>
                  <li>关闭页面后需重新输入主密码</li>
                  <li>30分钟无操作将自动锁定</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Spin>
    </div>
  </div>
</template>

<style scoped>
</style>