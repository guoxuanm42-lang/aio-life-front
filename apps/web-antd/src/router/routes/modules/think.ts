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
    path: '/think/all',
    component: () => import('#/views/my-hub/think/list.vue'),
  },
  {
    meta: {
      title: '闪念',
      hideInMenu: true,
    },
    name: 'thinkRootLegacy',
    path: '/think',
    redirect: '/think/all',
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
