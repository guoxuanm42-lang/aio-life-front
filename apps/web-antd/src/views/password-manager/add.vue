<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { usePasswordVaultStore } from '#/store/password-vault';
import {
  decryptText,
  encryptText,
  generateSalt,
  generatePassword,
  type PasswordGeneratorOptions,
} from '#/utils/crypto';

import {
  CopyOutlined,
  LockOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  SelectOption,
  Spin,
  Switch,
} from 'ant-design-vue';
import { useRouter } from 'vue-router';

import {
  createPasswordApi,
  getPasswordApi,
  getCategoriesApi,
  updatePasswordApi,
} from '#/api/core/password-manager';

const router = useRouter();
const store = usePasswordVaultStore();

const loading = ref(false);
const categories = ref<string[]>([]);
const showGenerator = ref(false);
const generatorLoading = ref(false);

// Form state
const formState = ref({
  title: '',
  website: '',
  category: '其他',
  username: '',
  password: '',
  salt: '',
  remark: '',
  favorite: false,
});

// Generator options
const generatorOptions = ref<PasswordGeneratorOptions>({
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: false,
  excludeAmbiguous: false,
});

const generatedPassword = ref('');

const isEdit = ref(false);
const editId = ref<string | null>(null);

const fetchCategories = async () => {
  try {
    categories.value = await getCategoriesApi();
  } catch {
    categories.value = ['工作', '生活', '金融', '社交', '其他'];
  }
};

const fetchPasswordForEdit = async (id: string) => {
  loading.value = true;
  try {
    const data = await getPasswordApi(id);
    editId.value = id;
    isEdit.value = true;

    // Decrypt existing values
    if (data.username && data.password && store.masterKey) {
      try {
        formState.value.username = await decryptText(data.username, store.masterKey, data.salt);
        formState.value.password = await decryptText(data.password, store.masterKey, data.salt);
        formState.value.remark = await decryptText(data.remark, store.masterKey, data.salt);
      } catch {
        message.error('解密失败，请检查主密码是否正确');
      }
    }

    formState.value.title = data.title;
    formState.value.website = data.website || '';
    formState.value.category = data.category || '其他';
    formState.value.salt = data.salt;
    formState.value.favorite = data.favorite || false;
  } catch {
    message.error('获取密码详情失败');
    router.back();
  } finally {
    loading.value = false;
  }
};

const handleGenerateSalt = () => {
  formState.value.salt = generateSalt();
};

const handleGeneratePassword = async () => {
  generatorLoading.value = true;
  try {
    generatedPassword.value = generatePassword(generatorOptions.value);
    formState.value.password = generatedPassword.value;
    if (!formState.value.salt) {
      formState.value.salt = generateSalt();
    }
  } finally {
    generatorLoading.value = false;
  }
};

const handleCopyGenerated = async () => {
  if (generatedPassword.value) {
    // Use clipboard API directly
    try {
      await navigator.clipboard.writeText(generatedPassword.value);
      message.success('密码已复制到剪贴板');
    } catch {
      message.error('复制失败');
    }
  }
};

const handleSubmit = async () => {
  if (!formState.value.title) {
    message.warning('请输入标题');
    return;
  }
  if (!formState.value.password) {
    message.warning('请输入密码');
    return;
  }
  if (!formState.value.salt) {
    message.warning('请先生成盐值');
    return;
  }
  if (!store.masterKey) {
    message.warning('请先解锁');
    router.push('/password-manager/lock');
    return;
  }

  loading.value = true;
  try {
    // Encrypt sensitive fields
    const encryptedUsername = await encryptText(
      formState.value.username,
      store.masterKey,
      formState.value.salt
    );
    const encryptedPassword = await encryptText(
      formState.value.password,
      store.masterKey,
      formState.value.salt
    );
    const encryptedRemark = await encryptText(
      formState.value.remark || '',
      store.masterKey,
      formState.value.salt
    );

    const data = {
      title: formState.value.title,
      website: formState.value.website,
      category: formState.value.category,
      username: encryptedUsername,
      password: encryptedPassword,
      salt: formState.value.salt,
      remark: encryptedRemark,
      favorite: formState.value.favorite,
    };

    if (isEdit.value && editId.value) {
      await updatePasswordApi(editId.value, data);
      message.success('更新成功');
    } else {
      await createPasswordApi(data);
      message.success('添加成功');
    }

    store.updateActivity();
    router.push('/password-manager');
  } catch (error) {
    message.error(isEdit.value ? '更新失败' : '添加失败');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (!store.isUnlocked) {
    router.push('/password-manager/lock');
    return;
  }

  await fetchCategories();

  // Check if editing
  const path = router.currentRoute.value.path;
  if (path.includes('/edit/')) {
    const id = router.currentRoute.value.params.id as string;
    if (id) {
      await fetchPasswordForEdit(id);
    }
  } else {
    // Generate salt for new password
    handleGenerateSalt();
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden p-5">
    <div class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
      <Spin :spinning="loading">
        <div class="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
          <h2 class="mb-6 text-xl font-bold">
            {{ isEdit ? '编辑密码' : '添加密码' }}
          </h2>

          <Form layout="vertical">
            <FormItem label="标题" required>
              <Input
                v-model:value="formState.title"
                placeholder="如：GitHub"
              />
            </FormItem>

            <FormItem label="网站/应用">
              <Input
                v-model:value="formState.website"
                placeholder="如：https://github.com"
              />
            </FormItem>

            <FormItem label="分类">
              <Select v-model:value="formState.category">
                <SelectOption v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </SelectOption>
              </Select>
            </FormItem>

            <FormItem label="账号">
              <Input
                v-model:value="formState.username"
                placeholder="请输入账号"
              />
            </FormItem>

            <FormItem label="密码" required>
              <div class="flex gap-2">
                <Input
                  v-model:value="formState.password"
                  type="password"
                  placeholder="请输入密码"
                  class="flex-1"
                />
                <Button @click="showGenerator = true">
                  <LockOutlined /> 生成
                </Button>
              </div>
            </FormItem>

            <FormItem label="盐值" required>
              <div class="flex gap-2">
                <Input
                  v-model:value="formState.salt"
                  placeholder="自动生成的盐值"
                  class="flex-1"
                  readonly
                />
                <Button @click="handleGenerateSalt">
                  <SyncOutlined /> 重新生成
                </Button>
              </div>
              <p class="mt-1 text-xs text-slate-400">
                每个密码都有独立的盐值，用于派生解密密钥
              </p>
            </FormItem>

            <FormItem label="备注">
              <Input.TextArea
                v-model:value="formState.remark"
                placeholder="可选备注信息"
                :rows="3"
              />
            </FormItem>

            <FormItem label="收藏">
              <Switch v-model:checked="formState.favorite" />
            </FormItem>

            <FormItem>
              <div class="flex gap-3">
                <Button type="primary" @click="handleSubmit" :loading="loading">
                  {{ isEdit ? '保存' : '添加' }}
                </Button>
                <Button @click="router.back()">
                  取消
                </Button>
              </div>
            </FormItem>
          </Form>
        </div>
      </Spin>
    </div>

    <!-- Password Generator Modal -->
    <Modal
      v-model:open="showGenerator"
      title="密码生成器"
      :footer="null"
      width="400px"
    >
      <div class="space-y-4">
        <FormItem label="密码长度">
          <Input
            v-model:value="generatorOptions.length"
            type="number"
            :min="8"
            :max="32"
          />
        </FormItem>

        <FormItem label="字符类型">
          <div class="space-y-2">
            <div>
              <Switch v-model:checked="generatorOptions.uppercase" />
              <span class="ml-2">大写字母 (A-Z)</span>
            </div>
            <div>
              <Switch v-model:checked="generatorOptions.lowercase" />
              <span class="ml-2">小写字母 (a-z)</span>
            </div>
            <div>
              <Switch v-model:checked="generatorOptions.numbers" />
              <span class="ml-2">数字 (0-9)</span>
            </div>
            <div>
              <Switch v-model:checked="generatorOptions.symbols" />
              <span class="ml-2">特殊字符 (!@#$%^&*)</span>
            </div>
            <div>
              <Switch v-model:checked="generatorOptions.excludeAmbiguous" />
              <span class="ml-2">排除易混淆字符 (0/O, 1/l/I)</span>
            </div>
          </div>
        </FormItem>

        <div class="flex gap-2">
          <Button type="primary" @click="handleGeneratePassword" :loading="generatorLoading">
            生成
          </Button>
          <Button @click="handleCopyGenerated" :disabled="!generatedPassword">
            <CopyOutlined /> 复制
          </Button>
        </div>

        <div v-if="generatedPassword" class="rounded bg-slate-100 p-3 dark:bg-slate-700">
          <p class="text-sm text-slate-500">生成的密码：</p>
          <p class="break-all font-mono text-lg">{{ generatedPassword }}</p>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
</style>