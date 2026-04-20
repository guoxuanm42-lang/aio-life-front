<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Button, Form, Input, InputNumber, Modal, Select, Spin, Switch, Table, TreeSelect, message } from 'ant-design-vue';

import { createMenuApi, getMenuAdminTreeApi, updateMenuApi, updateMenuStatusApi, type SysMenuAdminItem, type SysMenuSaveReq } from '#/api/core/menu';

const loading = ref(false);
const list = ref<SysMenuAdminItem[]>([]);

const editVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const statusChanging = ref<Record<number, boolean>>({});

const form = ref<SysMenuSaveReq>({
  name: '',
  path: '',
  parentId: 0,
  status: 1,
  sort: 0,
  roles: '',
  component: '',
  redirect: '',
  meta: {},
});

const metaText = ref('{}');

const protectedPaths = new Set(['/system', '/system/menu']);
const isProtectedMenu = (row: { path?: string }) => protectedPaths.has(String(row?.path || ''));

const columns: any[] = [
  { title: '标题', key: 'title', width: 220 },
  { title: 'Path', dataIndex: 'path', key: 'path', width: 260 },
  { title: 'Component', dataIndex: 'component', key: 'component', width: 220 },
  { title: 'Roles', dataIndex: 'roles', key: 'roles', width: 160 },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 90 },
  { title: '启用', dataIndex: 'status', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 120 },
];

const flatten = (nodes: SysMenuAdminItem[]) => {
  const result: SysMenuAdminItem[] = [];
  const walk = (arr: SysMenuAdminItem[]) => {
    for (const n of arr) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return result;
};

const flatList = computed(() => flatten(list.value));
const parentOptions = computed(() => [
  { label: '根节点 (0)', value: 0 },
  ...flatList.value.map((x) => ({
    label: `${x.name} (${x.path}) [${x.id}]`,
    value: x.id,
  })),
]);

const roleTags = computed<string[]>({
  get: () => {
    const raw = form.value.roles?.trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  },
  set: (arr) => {
    form.value.roles = arr.join(',');
  },
});

const roleOptions = [
  { label: 'admin', value: 'admin' },
  { label: 'user', value: 'user' },
];

type ParentTreeNode = {
  children?: ParentTreeNode[];
  key: number;
  title: string;
  value: number;
};

const parentTreeOptions = computed<ParentTreeNode[]>(() => {
  const build = (nodes: SysMenuAdminItem[]): ParentTreeNode[] =>
    nodes.map((x) => ({
      key: x.id,
      title: `${x.name} (${x.path})`,
      value: x.id,
      children: x.children?.length ? build(x.children) : undefined,
    }));
  return [
    {
      key: 0,
      title: '根节点 (0)',
      value: 0,
      children: build(list.value),
    },
  ];
});

const load = async () => {
  loading.value = true;
  try {
    list.value = await getMenuAdminTreeApi();
  } catch (e: any) {
    message.error(e?.message || '加载菜单失败');
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  editingId.value = null;
  form.value = {
    name: '',
    path: '',
    parentId: 0,
    status: 1,
    sort: 0,
    roles: '',
    component: '',
    redirect: '',
    meta: {},
  };
  metaText.value = '{}';
  editVisible.value = true;
};

const openEdit = (row: any) => {
  const r = row as SysMenuAdminItem;
  editingId.value = r.id;
  form.value = {
    id: r.id,
    name: r.name,
    path: r.path,
    parentId: r.parentId ?? 0,
    status: r.status ?? 1,
    sort: r.sort ?? 0,
    roles: r.roles ?? '',
    component: r.component ?? '',
    redirect: r.redirect ?? '',
    meta: r.meta ?? {},
  };
  metaText.value = JSON.stringify(form.value.meta ?? {}, null, 2);
  editVisible.value = true;
};

const isProtectedEditing = computed(() => isProtectedMenu(form.value));

const parseMeta = () => {
  const raw = (metaText.value || '').trim();
  if (!raw) return {};
  const obj = JSON.parse(raw) as any;
  if (obj == null || Array.isArray(obj) || typeof obj !== 'object') {
    throw new Error('meta 必须是 JSON 对象');
  }
  return obj as Record<string, any>;
};

const save = async () => {
  saving.value = true;
  try {
    const payload: SysMenuSaveReq = {
      ...form.value,
      name: form.value.name?.trim(),
      path: form.value.path?.trim(),
      component: form.value.component?.trim(),
      redirect: form.value.redirect?.trim(),
      roles: form.value.roles?.trim(),
      meta: parseMeta(),
    };
    if (isProtectedMenu(payload)) {
      payload.status = 1;
    }
    if (!payload.name || !payload.path) {
      message.error('name/path 不能为空');
      return;
    }
    if (editingId.value == null) {
      await createMenuApi(payload);
      message.success('新增成功');
    } else {
      await updateMenuApi(editingId.value, payload);
      message.success('更新成功');
    }
    editVisible.value = false;
    await load();
  } catch (e: any) {
    message.error(e?.message || '保存失败');
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (row: SysMenuAdminItem, status: number) => {
  const id = row.id;
  statusChanging.value = { ...statusChanging.value, [id]: true };
  try {
    await updateMenuStatusApi(id, status);
    message.success(status === 1 ? '已启用' : '已禁用');
    await load();
  } catch (e: any) {
    message.error(e?.message || '更新状态失败');
    await load();
  } finally {
    statusChanging.value = { ...statusChanging.value, [id]: false };
  }
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="p-4">
    <div class="flex items-center justify-between mb-3">
      <div class="text-lg font-bold">权限菜单</div>
      <div class="flex items-center gap-2">
        <Button @click="load">刷新</Button>
        <Button type="primary" @click="openCreate">新增</Button>
      </div>
    </div>

    <Spin :spinning="loading">
      <Table
        :data-source="list"
        :columns="columns"
        :pagination="false"
        row-key="id"
        :default-expand-all-rows="true"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="font-medium">{{ record.meta?.title ?? record.name }}</div>
            <div class="text-xs text-stone-400">{{ record.name }}</div>
          </template>
          <template v-else-if="column.key === 'status'">
            <Switch
              :checked="record.status === 1"
              :disabled="isProtectedMenu(record) || statusChanging[record.id] === true"
              @change="(checked: boolean) => toggleStatus(record, checked ? 1 : 0)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="flex items-center gap-2">
              <Button size="small" @click="openEdit(record)">编辑</Button>
            </div>
          </template>
        </template>
      </Table>
    </Spin>

    <Modal
      v-model:open="editVisible"
      :title="editingId == null ? '新增菜单' : '编辑菜单'"
      :confirm-loading="saving"
      :width="820"
      @ok="save"
    >
      <div class="text-xs text-stone-400 mb-3">
        建议优先填写 Name、Path、Component；只有启用状态的菜单会在前端侧边栏显示。
      </div>
      <Form layout="vertical">
        <div class="rounded-md border border-stone-200 p-3 mb-3">
          <div class="text-sm font-semibold mb-3">基本信息</div>
          <div class="grid grid-cols-2 gap-x-4">
            <Form.Item label="父节点">
              <TreeSelect
                v-model:value="form.parentId"
                :tree-data="parentTreeOptions"
                tree-default-expand-all
                show-search
                allow-clear
              />
            </Form.Item>
            <Form.Item label="Name（路由 name）">
              <Input v-model:value="form.name" placeholder="例如 TimeManagement" />
            </Form.Item>
          </div>
          <div class="grid grid-cols-2 gap-x-4">
            <Form.Item label="Path（路由 path）">
              <Input v-model:value="form.path" :disabled="editingId != null" placeholder="例如 /time-management" />
            </Form.Item>
            <Form.Item label="Component">
              <Input v-model:value="form.component" placeholder="例如 BasicLayout 或 system/menu/index" />
            </Form.Item>
          </div>
        </div>

        <div class="rounded-md border border-stone-200 p-3 mb-3">
          <div class="text-sm font-semibold mb-3">路由与权限</div>
          <div class="grid grid-cols-2 gap-x-4">
            <Form.Item label="Redirect（可选）">
              <Input v-model:value="form.redirect" placeholder="例如 /time-management/time-tracker" />
            </Form.Item>
            <Form.Item label="Roles（空=所有）">
              <Select
                v-model:value="roleTags"
                mode="tags"
                :options="roleOptions"
                :token-separators="[',']"
                placeholder="输入角色后回车，例如 admin,user"
              />
            </Form.Item>
          </div>
          <div class="grid grid-cols-2 gap-x-4">
            <Form.Item label="排序 sort">
              <InputNumber v-model:value="form.sort" class="w-full" :min="-9999" :max="9999" />
            </Form.Item>
            <Form.Item label="启用状态">
              <Switch
                v-model:checked="form.status"
                :checked-value="1"
                :un-checked-value="0"
                :disabled="isProtectedEditing"
                checked-children="启用"
                un-checked-children="禁用"
              />
            </Form.Item>
          </div>
        </div>

        <div class="rounded-md border border-stone-200 p-3">
          <div class="text-sm font-semibold mb-2">Meta 配置（JSON）</div>
          <div class="text-xs text-stone-400 mb-2">
            常见字段：title / icon / order / hideInMenu / keepAlive / link
          </div>
          <Form.Item class="!mb-0">
            <Input.TextArea
              v-model:value="metaText"
              :auto-size="{ minRows: 7, maxRows: 14 }"
              class="font-mono"
              placeholder="{&quot;title&quot;:&quot;时间&quot;,&quot;icon&quot;:&quot;mdi:clock-outline&quot;}"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  </div>
</template>
