import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:format-list-checks',
      order: 1,
      title: '待办',
    },
    name: 'TaskCenter',
    path: '/task-center',
    redirect: '/task-center/todo',
    children: [
      {
        meta: {
          icon: 'mdi:format-list-checks',
          title: '待办清单',
        },
        name: 'TaskCenterTodo',
        path: '/task-center/todo',
        component: () => import('#/views/task-center/todo/index.vue'),
      },
      {
        meta: {
          icon: 'mdi:clipboard-alert-outline',
          title: '复盘',
        },
        name: 'TaskCenterTodoReview',
        path: '/task-center/todo/review',
        component: () => import('#/views/task-center/todo/review/index.vue'),
      },
      {
        meta: {
          icon: 'mdi:cog-outline',
          title: '配置',
        },
        name: 'TaskCenterTodoConfig',
        path: '/task-center/todo/config',
        component: () => import('#/views/task-center/todo/config/index.vue'),
      },
    ],
  },
];

export default routes;
