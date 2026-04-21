import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:clipboard-text-clock-outline',
      title: '任务中心',
      order: 1,
    },
    name: 'TaskCenter',
    path: '/task-center',
    children: [
      {
        meta: {
          title: '待办',
          icon: 'mdi:format-list-checks',
        },
        name: 'TaskCenterTodo',
        path: '/task-center/todo',
        component: () => import('#/views/task-center/todo/index.vue'),
      },
      {
        meta: {
          title: '目标管理',
          icon: 'mdi:target',
        },
        name: 'TaskCenterGoal',
        path: '/task-center/goal',
        component: () => import('#/views/task-center/goal/index.vue'),
      },
    ],
  },
];

export default routes;
