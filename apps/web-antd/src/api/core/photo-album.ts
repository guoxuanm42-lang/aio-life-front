import { requestClient } from '#/api/request';

export interface PhotoFolder {
  coverImageId?: string;
  coverImageUrl?: string;
  createTime?: string;
  id?: string;
  imageCount?: number;
  name: string;
  parentId?: string;
  sortOrder?: number;
  updateTime?: string;
}

export interface PhotoFolderTree extends PhotoFolder {
  children?: PhotoFolderTree[];
}

export interface PhotoImage {
  bucketName?: string;
  caption?: string;
  contentType?: string;
  createTime?: string;
  fileSize?: number;
  folderId: string;
  id?: string;
  objectKey?: string;
  originalFilename?: string;
  sortOrder?: number;
  title?: string;
}

export interface PhotoImagePage {
  items: PhotoImage[];
  total: number;
}

export interface PhotoImageUploadFailure {
  filename: string;
  reason: string;
}

export interface PhotoImageUploadResult {
  failureList: PhotoImageUploadFailure[];
  successList: PhotoImage[];
}

export interface PhotoImageQueryParams {
  folderId: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function getPhotoFolderTree() {
  return await requestClient.get<PhotoFolderTree[]>('/photo-album/folder/tree');
}

export async function createPhotoFolder(data: {
  name: string;
  parentId?: string;
}) {
  return await requestClient.post<PhotoFolder>(
    '/photo-album/folder/create',
    data,
  );
}

export async function updatePhotoFolder(data: { id: string; name: string }) {
  return await requestClient.post<PhotoFolder>(
    '/photo-album/folder/update',
    data,
  );
}

export async function deletePhotoFolder(id: string) {
  return await requestClient.post<void>('/photo-album/folder/delete', { id });
}

export async function queryPhotoImages(data: PhotoImageQueryParams) {
  return await requestClient.post<PhotoImagePage>(
    '/photo-album/image/query',
    data,
  );
}

export async function updatePhotoImage(data: {
  caption?: string;
  id: string;
  title?: string;
}) {
  return await requestClient.post<PhotoImage>('/photo-album/image/update', data);
}

export async function movePhotoImage(data: {
  id: string;
  targetFolderId: string;
}) {
  return await requestClient.post<PhotoImage>('/photo-album/image/move', data);
}

export async function deletePhotoImage(id: string) {
  return await requestClient.post<void>('/photo-album/image/delete', { id });
}

export async function setPhotoFolderCover(data: {
  folderId: string;
  imageId: string;
}) {
  return await requestClient.post<PhotoFolder>(
    '/photo-album/folder/cover/set',
    data,
  );
}

export async function clearPhotoFolderCover(folderId: string) {
  return await requestClient.post<PhotoFolder>(
    '/photo-album/folder/cover/clear',
    { folderId },
  );
}

export async function uploadPhotoImages(data: FormData) {
  return await requestClient.post<PhotoImageUploadResult>(
    '/photo-album/image/upload-batch',
    data,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
}

export async function getPhotoImageBlob(id: string) {
  return await requestClient.download<Blob>('/photo-album/image/preview', {
    params: { id },
  });
}
