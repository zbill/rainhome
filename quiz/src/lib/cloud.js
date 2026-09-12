// ============================================================================
// 云同步层 v2 —— CloudBase Auth V2 多用户隔离
// ============================================================================
//
// v2 与 v1 核心区别：
//   - syncPull/syncPush 从 getCurrentUid() 取 CloudBase 登录用户 uid，
//     不再接受外部传入的 userId 参数
//   - 未登录状态直接 return false，不发起网络请求
//   - 云端数据以 { user_json, updated_at } 结构存储在 user_quiz_data 表
//   - 冲突策略：云端 updated_at > 本地 lastSync → 云端覆盖本地
//   - 账号绑定自动生效（apiFns 内部通过 user_bindings 解析 primary_uid）
//
// 本地 localStorage 仍然是离线权威存储；云端同步是附加能力。
// ============================================================================

import { apiFns, cloudEnabled, getCurrentUid } from './api';
import { dumpUserState, loadUserState } from './store';

let busy = false;

// uid 对应的本地最后同步时间 key
const lastSyncKey = (uid) => `mq_last_sync_${uid}`;

function readLastSync(uid) {
  try {
    const raw = localStorage.getItem(lastSyncKey(uid));
    return raw ? new Date(raw).getTime() : 0;
  } catch {
    return 0;
  }
}

function writeLastSync(uid, timestamp) {
  try {
    localStorage.setItem(lastSyncKey(uid), new Date(timestamp).toISOString());
  } catch {
    // ignore
  }
}

// 把 { user_json, updated_at } 还原为 loadUserState 需要的格式
function extractUserState(userJson) {
  if (!userJson || typeof userJson !== 'object') return null;
  return userJson;
}

/**
 * 拉取云端最新数据 → 本地
 * 冲突策略：云端 updated_at > 本地 lastSync → 云端覆盖本地；否则跳过
 * @returns {Promise<boolean>} true=从云端拉到了数据并合并；false=未登录/失败/无需同步
 */
export async function syncPull() {
  if (!cloudEnabled() || busy) return false;
  const uid = getCurrentUid();
  if (!uid) return false;

  busy = true;
  try {
    const lastLocal = readLastSync(uid);
    const cloud = await apiFns('state', { method: 'GET' });

    if (!cloud) {
      // 云端还没数据，不覆盖本地
      return false;
    }

    const cloudTime = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;

    // 冲突：云端更新时间更近 → 覆盖本地
    if (cloudTime > lastLocal) {
      const state = extractUserState(cloud.user_json);
      if (state) {
        loadUserState(uid, state);
        writeLastSync(uid, cloudTime);
        return true;
      }
    }

    return false;
  } catch (e) {
    console.warn('云拉取失败(忽略)', e);
    return false;
  } finally {
    busy = false;
  }
}

/**
 * 推送本地完整 state → 云端
 * @returns {Promise<boolean>} true=推送成功；false=未登录/失败
 */
export async function syncPush() {
  if (!cloudEnabled() || busy) return false;
  const uid = getCurrentUid();
  if (!uid) return false;

  busy = true;
  try {
    const localState = dumpUserState(uid);
    const result = await apiFns('state', {
      method: 'PUT',
      body: localState,
    });
    if (result === true) {
      writeLastSync(uid, Date.now());
      return true;
    }
    return false;
  } catch (e) {
    console.warn('云推送失败(忽略)', e);
    return false;
  } finally {
    busy = false;
  }
}
