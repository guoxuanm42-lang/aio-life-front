import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/my-hub/photo-album/preview.vue'),
    meta: {
      hideInMenu: true,
      hideInTab: true,
      title: '相册预览',
    },
    name: 'photoAlbumPreview',
    path: '/my-hub/photo-album/preview',
  },
];

export default routes;
