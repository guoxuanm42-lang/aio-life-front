import { requestClient } from '#/api/request';

/**
 * 查询运动记录列表
 */
export async function query(data: any) {
  return await requestClient.post('/exerciseRecord/query', data);
}

/**
 * 获取运动记录统计数据，用于统计图表
 */
export async function getStatistics(data: any) {
  return await requestClient.post('/exerciseRecord/statistics', data);
}

/**
 * 获取轻量级运动记录统计数据，用于统计图表
 */
export async function getLightStatistics(data: any) {
  return await requestClient.post('/exerciseRecord/statistics/light', data);
}

/**
 * 获取所有运动记录（不分页），用于统计图表（已废弃，请使用 getStatistics）
 * @deprecated
 */
export async function getAll(data: any) {
  console.warn('getAll 方法已废弃，请使用 getStatistics 或 getLightStatistics');
  return await requestClient.post('/exerciseRecord/getAll', data);
}

/**
 * 新增运动记录
 */
export async function add(data: any) {
  return await requestClient.post('/exerciseRecord/add', data);
}

/**
 * 修改运动记录
 */
export async function update(data: any) {
  return await requestClient.post('/exerciseRecord/update', data);
}

/**
 * 删除运动记录
 */
export async function deleteData(data: any) {
  return await requestClient.post('/exerciseRecord/delete', data);
}

/**
 * 批量删除运动记录
 */
export async function deleteBatch(data: any) {
  return await requestClient.post('/exerciseRecord/deleteBatch', data);
}

/**
 * 获取运动记录详情
 */
export async function get(data: any) {
  return await requestClient.get(`/exerciseRecord/get/${data.id}`);
}
