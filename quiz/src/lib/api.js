// ============================================================================
// 云端 API 客户端 v2 —— CloudBase Auth V2 + PostgreSQL（按 uid 多用户隔离）
// ============================================================================
//
// 与 v1 核心区别：
//   - 接入 CloudBase Auth V2，按登录用户的 uid 隔离 PostgreSQL 行级数据
//   - 不再使用硬编码的 anon Publishable Key；Auth 模式下 SDK 自动处理 token
//   - 新表：user_quiz_data（主数据）+ user_bindings（账号绑定）
//
// 初始化要求（CloudBase 控制台）：
//   1) 启用「用户名密码登录」和「邮箱验证码登录」
//      https://tcb.cloud.tencent.com/dev?envId=rain-d3ggdsj6a9cc1c4ea#/identity/login-manage
//   2) Web 安全域名加入生产域名
//   3) 邮箱验证码发件人配置（内置发件 SMTP 即可）
//   4) 执行 db/schema.sql 新建 user_quiz_data + user_bindings 表 + RLS 策略
//
// 部署要求（同源反代）：
//   线上环境浏览器直连 CloudBase 网关受「安全域名」限制，
//   沿用 /tcb/* 同源路径 + EdgeOne 边缘函数反代方案。
//   本地 localhost 默认可直连。
// ============================================================================

import cloudbase from '@cloudbase/js-sdk';

// ====== 环境配置 ======
const ENV_ID = 'rain-d3ggdsj6a9cc1c4ea';
const REGION = 'ap-shanghai';
// Publishable Key（JS SDK 初始化 PG RDB 网关必需）
// 虽然走 Auth V2 登录，但 rdb SDK 仍需要这个 key 来建立基础连接，
// 登录成功后 Auth token 会叠加上去做真正的身份鉴权。
const ACCESS_KEY =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE2ODE3OWYxLTEyZWMtNGU5ZC1iNGJhLTU2ZmZlMWE2NjljNiJ9.eyJpc3MiOiJodHRwczovL3JhaW4tZDNnZ2RzajZhOWNjMWM0ZWEuYXAtc2hhbmdoYWkudGNiLWFwaS50ZW5jZW50Y2xvdWRhcGkuY29tIiwic3ViIjoiYW5vbiIsImF1ZCI6InJhaW4tZDNnZ2RzajZhOWNjMWM0ZWEiLCJleHAiOjQwOTI4MjIzNzAsImlhdCI6MTc4OTEzOTE3MCwibm9uY2UiOiJqU2VQenE5SlFseVZsbllrbV9ReFRnIiwiYXRfaGFzaCI6ImpTZVB6cTlKUWx5VmxuWWttX1F4VGciLCJuYW1lIjoiQW5vbnltb3VzIiwic2NvcGUiOiJhbm9ueW1vdXMiLCJwcm9qZWN0X2lkIjoicmFpbi1kM2dnZHNqNmE5Y2MxYzRlYSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.MB6V-frDzhFe4ok1I5OQljIKIPHbzHGBBhugmlXjXjFhzUgu1mnDq4tvJZOfU__Hc8TRLlu8Q4WpHi43STUleuYlAD7MWvGj7cjAulx72E5vOZNbwty8RZAgd1lJmJenHFNLcHIe2l054zUMfmHLrJdYsaqSPcvUkMVHVkRJr_z6ywkUFA2i_VOr9cVKBrELMR_buiH0GWctO8ksstEsiTlE7NA5yJt6nus8esi_oXedyNZkXMoJddabVmxlwdjwDUvnBqqMeNBh7d_ddhcmu9tTMWkkuTl8fypN3Pnh-TWX01mDcr2gNu4WJkY4e3ChrUw6pdyP2C6oqF5YvcLwTA';

const TABLE_QUIZ = 'user_quiz_data';
const TABLE_BIND = 'user_bindings';

// 懒初始化（仅调用一次）
let app = null;
let auth = null;
let rdb = null;
let initPromise = null;

export async function initCloudBase() {
  if (app) return { app, auth, rdb };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    app = cloudbase.init({ env: ENV_ID, region: REGION, accessKey: ACCESS_KEY });
    auth = app.auth();

    // 线上同源反代（和 v1 方案保持一致，EdgeOne /tcb/* → CloudBase 网关）
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      const isLocal = !h || h === 'localhost' || h === '127.0.0.1';
      if (!isLocal) {
        app.registerEndPointWithKey({
          key: 'GATEWAY',
          url: `//${window.location.host}/tcb/v1`,
        });
      }
    }

    rdb = app.rdb();
    return { app, auth, rdb };
  })();

  return initPromise;
}

// 确保 init 完成后再继续（apiFns / cloudEnabled 内部调用）
async function ensureInit() {
  if (!app) await initCloudBase();
  return { auth, rdb };
}

// ====== 导出 Auth 对象（供 LoginScreen 调用注册/登录/登出） ======
export function getAuth() {
  return auth;
}

// ====== 当前登录用户 uid（同步版，从 localStorage 读） ======
// CloudBase Auth V2 把登录信息存到 localStorage：
//   key:   user_info_<ENV_ID>
//   value: { version, content: { uid, sub, username, ... } }
// 直接读 localStorage 是同步的，不用调异步的 getLoginState()
export function getCurrentUid() {
  try {
    const raw = localStorage.getItem(`user_info_${ENV_ID}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const content = parsed?.content || parsed;
    return content?.uid ?? content?.sub ?? null;
  } catch {
    return null;
  }
}

// 异步兜底（等 getLoginState Promise resolve）
export async function getCurrentUidAsync() {
  const syncUid = getCurrentUid();
  if (syncUid) return syncUid;
  if (!auth) await initCloudBase();
  const state = await auth.getLoginState();
  return state?.user?.uid ?? state?.user?.sub ?? null;
}

// ====== 是否启用云端（= 已配置 Auth + 当前有有效登录态） ======
// 未登录时返回 false → 前端自动降级 localStorage 本地模式
export function cloudEnabled() {
  if (!ENV_ID) return false;
  const uid = getCurrentUid();
  return !!uid;
}

// ====== 核心：从 user_bindings 解析「主 uid」 ======
// 如果当前 uid 有绑定关系，返回 primary_uid；否则返回当前 uid
// 这使得邮箱登录(uid_B)自动路由到用户名密码账号(uid_A)的数据
async function resolvePrimaryUid(targetUid) {
  if (!targetUid) return null;
  const { rdb } = await ensureInit();
  try {
    const { data } = await rdb
      .from(TABLE_BIND)
      .select('primary_uid')
      .eq('bind_uid', targetUid)
      .limit(1);
    if (Array.isArray(data) && data.length > 0 && data[0].primary_uid) {
      return data[0].primary_uid;
    }
  } catch {
    // 绑定表可能还没数据，静默回退
  }
  return targetUid;
}

// ====== 通用请求：与 v1 保持 apiFns(path, {method, body}) 签名一致 ======
// path 参数目前只用 'state'（拉/存完整口算数据），
// 内部自动替换为 user_quiz_data / user_bindings 的具体表操作。
export async function apiFns(path, { method = 'GET', body } = {}) {
  const rawUid = getCurrentUid();
  if (!rawUid) return null;

  const { rdb } = await ensureInit();
  const uid = await resolvePrimaryUid(rawUid);

  // === GET state ===
  // 从 user_quiz_data 读当前 uid 的 user_json
  if (method === 'GET') {
    try {
      const { data, error } = await rdb
        .from(TABLE_QUIZ)
        .select('user_json,updated_at')
        .eq('uid', uid)
        .limit(1);
      if (error) return null;
      if (!Array.isArray(data) || data.length === 0) return null;
      return {
        user_json: data[0].user_json || {},
        updated_at: data[0].updated_at,
      };
    } catch {
      return null;
    }
  }

  // === PUT state ===
  // upsert user_quiz_data（按 uid）
  if (method === 'PUT') {
    try {
      const { error } = await rdb
        .from(TABLE_QUIZ)
        .upsert(
          { uid, user_json: body || {} },
          { onConflict: 'uid' }
        );
      if (error) throw error;
      return true;
    } catch (e) {
      throw e;
    }
  }

  return null;
}

// ====== 账号绑定：将 uid_B 绑定到 uid_A ======
// uid_B 是当前登录用户（邮箱登录拿到的），primaryUid 是目标主账号（用户名密码登录的）
// 返回 true 表示绑定成功；抛异常表示绑定失败
export async function bindUser(primaryUid) {
  const rawUid = getCurrentUid();
  if (!rawUid) return false;
  if (!primaryUid) return false;

  // 不能自己绑自己
  if (rawUid === primaryUid) return false;

  const { rdb } = await ensureInit();

  // 先检查 primary_uid 的 user_quiz_data 是否存在（验证目标账号有效）
  try {
    const { data, error } = await rdb
      .from(TABLE_QUIZ)
      .select('uid')
      .eq('uid', primaryUid)
      .limit(1);
    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('目标账号不存在');
    }
  } catch (e) {
    throw new Error('验证目标账号失败：' + (e.message || e));
  }

  // 创建绑定关系：bind_uid → primary_uid
  try {
    await rdb
      .from(TABLE_BIND)
      .upsert(
        { bind_uid: rawUid, primary_uid: primaryUid },
        { onConflict: 'bind_uid' }
      );
    return true;
  } catch (e) {
    throw e;
  }
}

// ====== 兼容导出 ======
export function cloudBase() {
  return ENV_ID ? 'cloudbase-auth-v2' : '';
}
