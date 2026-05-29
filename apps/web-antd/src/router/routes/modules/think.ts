import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      title: '闪念',
      icon: 'mdi:lightbulb-on-outline',
      backTop: false,
      order: 3,
    },
    name: 'think',
    path: '/think',
    component: 'BasicLayout' as any,
    redirect: '/think/all',
    children: [
      {
        meta: { title: '全部' },
        name: 'thinkAll',
        path: 'all',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '工作' },
        name: 'thinkWork',
        path: 'work',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '生活' },
        name: 'thinkLife',
        path: 'life',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '健康' },
        name: 'thinkHealthy',
        path: 'healthy',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '学习' },
        name: 'thinkStudy',
        path: 'study',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '社交' },
        name: 'thinkSocial',
        path: 'social',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '创作' },
        name: 'thinkCreation',
        path: 'creation',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: 'AIO-LIFE开发' },
        name: 'thinkAioLife',
        path: 'aio-life',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
      {
        meta: { title: '旅行' },
        name: 'thinkTravel',
        path: 'travel',
        component: () => import('#/views/my-hub/think/list.vue'),
      },
    ],
  },
  {
    meta: {
      title: '闪念',
      hideInMenu: true,
    },
    name: 'thinkLegacy',
    path: '/my-hub/think',
    redirect: '/think/all',
  },
  {
    meta: {
      title: '闪念列表',
      hideInMenu: true,
    },
    name: 'thinkListLegacy',
    path: '/my-hub/think/list',
    redirect: '/think/all',
  },
];

export default routes;
