import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mdi:shield-account-outline',
      keepAlive: true,
      order: 10,
      title: '系统管理',
      authority: ['admin'],
    },
    name: 'System',
    path: '/system',
    children: [
      {
        meta: {
          icon: 'mdi:account-group-outline',
          title: '用户中心',
        },
        name: 'UserCenter',
        path: '/system/user',
        component: () => import('#/views/system/user/index.vue'),
      },
      {
        meta: {
          icon: 'mdi:menu-open',
          title: '权限菜单',
          authority: ['admin'],
        },
        name: 'MenuManagement',
        path: '/system/menu',
        component: () => import('#/views/system/menu/index.vue'),
      },
    ],
  },
];

export default routes;
