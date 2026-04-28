import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ant-design:key-outlined',
      order: 10,
      title: '密码管理',
    },
    name: 'PasswordManager',
    path: '/password-manager',
    children: [
      {
        meta: {
          icon: 'ant-design:key-outlined',
          title: '密码库',
          backTop: false,
        },
        name: 'password-vault',
        path: '/password-manager',
        component: () => import('#/views/password-manager/index.vue'),
      },
      {
        meta: {
          title: '添加密码',
          backTop: true,
          hideMenu: true,
        },
        name: 'password-add',
        path: '/password-manager/add',
        component: () => import('#/views/password-manager/add.vue'),
      },
      {
        meta: {
          title: '编辑密码',
          backTop: true,
          hideMenu: true,
        },
        name: 'password-edit',
        path: '/password-manager/edit/:id',
        component: () => import('#/views/password-manager/edit.vue'),
        props: true,
      },
      {
        meta: {
          title: '锁屏',
          backTop: false,
          hideMenu: true,
        },
        name: 'password-lock',
        path: '/password-manager/lock',
        component: () => import('#/views/password-manager/lock.vue'),
      },
    ],
  },
];

export default routes;