// ============================================================================
// 登录/注册页面 v3 — 修正 CloudBase Auth V2 API 适配
// ============================================================================
//
// CloudBase Auth V2 注册规则（来自官方文档）：
//   - signUp 必须传 email 或 phone_number + verification_code + verification_token
//   - username / password / name 都是可选的附加字段
//   - 不存在纯用户名密码注册！必须先邮箱/手机验证码验证
//
// 登录方式：
//   - 用户名 + 密码（需要注册时设了 password）
//   - 邮箱 + 密码（同上）
//   - 邮箱 + 验证码（无需密码）
//   - signIn 返回值结构：{ data: { session, user }, error } 或直接 { user, credential }
//     实测用 console.log 看具体结构
// ============================================================================

import { useState } from 'react';
import { Icon } from '../components/Icon';
import { initCloudBase, getCurrentUid, bindUser } from '../lib/api';
import { syncPull, syncPush } from '../lib/cloud';
import { settingsStore } from '../lib/store';

// CloudBase 密码规则：8-32 位，必须同时包含字母和数字
function validatePassword(pwd) {
  if (!pwd) return null; // 密码可选（只走验证码登录也行）
  if (pwd.length < 8) return '密码至少 8 位';
  if (pwd.length > 32) return '密码最多 32 位';
  if (!/[a-zA-Z]/.test(pwd)) return '密码需包含字母';
  if (!/\d/.test(pwd)) return '密码需包含数字';
  return null;
}

// 用户名校验：1-32 位，字母/数字/_-，不能纯数字，首尾不能是 _-
function validateUsername(u) {
  if (!u) return null; // 可选
  if (u.length < 1) return '用户名不能为空';
  if (u.length > 32) return '用户名最多 32 位';
  if (/^\d+$/.test(u)) return '用户名不能是纯数字';
  if (/^[_\-]/.test(u) || /[_\-]$/.test(u)) return '用户名下划线和横线不能在首尾';
  if (!/^[a-zA-Z0-9_\-]+$/.test(u)) return '用户名只能含字母、数字、_、-';
  return null;
}

function validateEmail(e) {
  if (!e) return '请输入邮箱';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return '邮箱格式不正确';
  return null;
}

function friendlyError(err) {
  const msg = err?.message || String(err) || '';
  const code = err?.code || err?.error_code || '';
  const codeMap = {
    USER_NOT_FOUND: '用户不存在，请检查用户名/邮箱',
    INVALID_USERNAME_OR_PASSWORD: '用户名/邮箱或密码不正确',
    USER_EXISTS: '该邮箱已被注册',
    INVALID_PASSWORD: '密码不符合规则（8-32 位，字母+数字）',
    PASSWORD_TOO_WEAK: '密码需同时包含字母和数字',
    EMAIL_NOT_VERIFIED: '邮箱尚未验证，请先查收验证码',
    INVALID_VERIFICATION_CODE: '验证码不正确或已过期',
    VERIFICATION_CODE_EXPIRED: '验证码已过期，请重新获取',
    NETWORK_ERROR: '网络异常，请检查网络连接',
  };
  if (codeMap[code]) return codeMap[code];
  const lower = msg.toLowerCase();
  const kwMap = [
    ['password', '密码不符合规则'],
    ['already', '已被注册'],
    ['not found', '用户不存在'],
    ['incorrect', '用户名/邮箱或密码不正确'],
    ['verification', '验证码无效'],
    ['network', '网络异常'],
    ['email or phone', '必须提供邮箱或手机号'],
    ['email', '邮箱格式不正确'],
  ];
  for (const [kw, hint] of kwMap) {
    if (lower.includes(kw)) return hint;
  }
  return msg || '操作失败，请稍后重试';
}

export default function LoginScreen({ onLogin }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  // ========== 登录 Tab ==========
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'email'
  const [loginUser, setLoginUser] = useState('');     // 用户名 或 邮箱
  const [loginPwd, setLoginPwd] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loading, setLoading] = useState(false);

  // ========== 登录-邮箱验证码子模式 ==========
  const [loginEmail, setLoginEmail] = useState('');
  const [loginEmailCode, setLoginEmailCode] = useState('');
  const [loginEmailVerification, setLoginEmailVerification] = useState(null);
  const [loginEmailCoolDown, setLoginEmailCoolDown] = useState(0);

  // ========== 注册 Tab ==========
  const [regEmail, setRegEmail] = useState('');
  const [regUser, setRegUser] = useState('');   // 可选，用户名（留空=用邮箱前缀）
  const [regPwd, setRegPwd] = useState('');     // 可选，密码
  const [regNick, setRegNick] = useState('');   // 可选，昵称
  const [regErr, setRegErr] = useState('');
  const [regVerification, setRegVerification] = useState(null);  // getVerification 返回
  const [regVerifyRes, setRegVerifyRes] = useState(null);        // verify 返回的 token
  const [regCoolDown, setRegCoolDown] = useState(0);
  const [regCode, setRegCode] = useState('');

  // ========== 账号绑定弹窗 ==========
  const [showBind, setShowBind] = useState(false);
  const [bindUid, setBindUid] = useState('');
  const [bindErr, setBindErr] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  // 倒计时
  const startCoolDown = (setter) => {
    setter(60);
    const timer = setInterval(() => {
      setter((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ========== 发送邮箱验证码（通用） ==========
  async function sendEmailCode(email, errorSetter, coolDownSetter, verificationSetter) {
    errorSetter('');
    const e = email.trim();
    const err = validateEmail(e);
    if (err) { errorSetter(err); return; }
    setLoading(true);
    try {
      const { auth } = await initCloudBase();
      const res = await auth.getVerification({ email: e });
      verificationSetter(res);
      startCoolDown(coolDownSetter);
    } catch (err) {
      errorSetter(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ========== 用户名密码登录 ==========
  const doLogin = async () => {
    setLoginErr('');
    const u = loginUser.trim();
    const p = loginPwd.trim();
    if (!u || !p) { setLoginErr('请输入用户名/邮箱和密码'); return; }

    setLoading(true);
    try {
      const { auth } = await initCloudBase();
      await auth.signIn({ username: u, password: p });
      const uid = extractUid();
      if (!uid) throw new Error('登录成功但未获取到用户标识');

      await syncPull();
      await postLogin(uid, u);
    } catch (e) {
      setLoginErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  // ========== 邮箱验证码登录 ==========
  const doEmailLogin = async () => {
    setLoginErr('');
    if (!loginEmailVerification) { setLoginErr('请先获取验证码'); return; }
    const code = loginEmailCode.trim();
    if (!code) { setLoginErr('请输入验证码'); return; }

    setLoading(true);
    try {
      const { auth } = await initCloudBase();
      const verifyRes = await auth.verify({
        verification_id: loginEmailVerification.verification_id,
        verification_code: code,
      });
      if (loginEmailVerification.is_user) {
        await auth.signIn({
          username: loginEmail.trim(),
          verification_token: verifyRes.verification_token,
        });
      } else {
        throw new Error('该邮箱尚未注册，请先去注册页面');
      }

      const uid = extractUid();
      if (!uid) throw new Error('登录成功但未获取到用户标识');

      await syncPull();
      await postLogin(uid, loginEmail.trim());
    } catch (e) {
      setLoginErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  // ========== 注册 ==========
  const doRegister = async () => {
    setRegErr('');
    const email = regEmail.trim();
    const user = regUser.trim();
    const pwd = regPwd.trim();
    const nick = regNick.trim();
    const code = regCode.trim();

    const eErr = validateEmail(email);
    if (eErr) { setRegErr(eErr); return; }
    const uErr = validateUsername(user);
    if (uErr) { setRegErr(uErr); return; }
    const pErr = validatePassword(pwd);
    if (pErr) { setRegErr(pErr); return; }
    if (!regVerification) { setRegErr('请先获取邮箱验证码'); return; }
    if (!code) { setRegErr('请输入验证码'); return; }

    setLoading(true);
    try {
      const { auth } = await initCloudBase();

      const verifyRes = await auth.verify({
        verification_id: regVerification.verification_id,
        verification_code: code,
      });

      const signupParams = {
        email,
        verification_code: code,
        verification_token: verifyRes.verification_token,
      };
      if (user) signupParams.username = user;
      else signupParams.username = email.split('@')[0];
      if (pwd) signupParams.password = pwd;
      signupParams.name = nick || user || email.split('@')[0];

      await auth.signUp(signupParams);

      const uid = extractUid();
      if (!uid) throw new Error('注册成功但未获取到用户标识');

      await syncPush(); // 首次推送
      await postLogin(uid, signupParams.username);
    } catch (e) {
      setRegErr(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  // ========== 提取 uid ==========
  // 登录/注册成功后，CloudBase Auth V2 会立刻把用户信息写入 localStorage，
  // 直接从 localStorage 同步读最可靠（避免 signIn 返回值结构不确定的问题）
  function extractUid() {
    return getCurrentUid();
  }

  // ========== 登录成功后的通用收尾 ==========
  async function postLogin(uid, displayName) {
    // 存昵称
    try {
      const { auth } = await initCloudBase();
      const state = await auth.getLoginState();
      const cloudNick = state?.user?.name ?? state?.user?.nickname ?? displayName;
      settingsStore.userPrefs(uid, { nickname: cloudNick || displayName });
    } catch {
      settingsStore.userPrefs(uid, { nickname: displayName });
    }
    onLogin(uid);
  }

  // ========== 账号绑定 ==========
  const doBindByUid = async (targetPrimaryUid) => {
    setBindErr('');
    if (!targetPrimaryUid) { setBindErr('请输入主账号 ID'); return; }
    if (targetPrimaryUid === loginUser.trim() || targetPrimaryUid === loginEmail.trim()) {
      // 不能绑自己
    }
    setBindLoading(true);
    try {
      await bindUser(targetPrimaryUid);
      await syncPull();
      setShowBind(false);
      setBindUid('');
      return true;
    } catch (e) {
      setBindErr(e?.message || '绑定失败');
    } finally {
      setBindLoading(false);
    }
  };

  return (
    <div className="page flat" style={{ paddingTop: 40 }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <Icon name="target" size={56} />
        <div style={{ fontSize: 24, fontWeight: 800, marginTop: 12 }}>口算挑战</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>登录或注册开始</div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 12px' }}>
        <button
          className="row-btn"
          style={{
            flex: 1,
            justifyContent: 'center',
            borderBottom: tab === 'login' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'login' ? 'var(--accent)' : 'var(--ink-2)',
            fontWeight: tab === 'login' ? 600 : 400,
          }}
          onClick={() => { setTab('login'); setLoginErr(''); setRegErr(''); }}
        >登录</button>
        <button
          className="row-btn"
          style={{
            flex: 1,
            justifyContent: 'center',
            borderBottom: tab === 'register' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'register' ? 'var(--accent)' : 'var(--ink-2)',
            fontWeight: tab === 'register' ? 600 : 400,
          }}
          onClick={() => { setTab('register'); setLoginErr(''); setRegErr(''); }}
        >注册</button>
      </div>

      {tab === 'login' ? (
        <div className="card">
          {loginMode === 'password' ? (
            <>
              <div className="group-label">用户名 / 邮箱 + 密码</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="input" placeholder="用户名 或 邮箱" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
                <input className="input" type="password" placeholder="密码" value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                {loginErr && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loginErr}</div>}
                <button className="big-btn" onClick={doLogin} disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </button>
                <button className="link-btn" onClick={() => { setLoginMode('email'); setLoginErr(''); }}>
                  用邮箱验证码登录 / 找回密码
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="group-label">邮箱验证码登录</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="input" placeholder="邮箱地址" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" style={{ width: 'auto', flex: '1 1 auto', minWidth: 0 }} placeholder="验证码" value={loginEmailCode} onChange={(e) => setLoginEmailCode(e.target.value)} />
                  <button
                    className="big-btn ghost"
                    onClick={() => sendEmailCode(loginEmail, setLoginErr, setLoginEmailCoolDown, setLoginEmailVerification)}
                    disabled={loginEmailCoolDown > 0 || loading}
                    style={{ width: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '12px 16px', fontSize: 15, boxShadow: 'none' }}
                  >
                    {loginEmailCoolDown > 0 ? `${loginEmailCoolDown}s 后重发` : '获取验证码'}
                  </button>
                </div>
                {loginErr && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loginErr}</div>}
                <button className="big-btn" onClick={doEmailLogin} disabled={loading}>
                  {loading ? '处理中...' : '登录'}
                </button>
                <button className="link-btn" onClick={() => { setLoginMode('password'); setLoginErr(''); }}>
                  返回用户名密码登录
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="group-label">注册新账号</div>
          <div className="hint" style={{ marginBottom: 10 }}>
            注册需要邮箱验证。用户名和密码可选，设置后可以用「用户名 + 密码」直接登录。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 邮箱（必填） */}
            <input className="input" placeholder="邮箱地址（必填）" value={regEmail} onChange={(e) => { setRegEmail(e.target.value); setRegVerification(null); setRegCode(''); }} />

            {/* 验证码行 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" style={{ width: 'auto', flex: '1 1 auto', minWidth: 0 }} placeholder="邮箱验证码" value={regCode} onChange={(e) => setRegCode(e.target.value)} />
              <button
                className="big-btn ghost"
                onClick={() => sendEmailCode(regEmail, setRegErr, setRegCoolDown, setRegVerification)}
                disabled={regCoolDown > 0 || loading}
                style={{ width: 'auto', flex: '0 0 auto', whiteSpace: 'nowrap', padding: '12px 16px', fontSize: 15, boxShadow: 'none' }}
              >
                {regCoolDown > 0 ? `${regCoolDown}s 后重发` : '获取验证码'}
              </button>
            </div>

            {/* 昵称（可选） */}
            <input className="input" placeholder="昵称（可选）" value={regNick} onChange={(e) => setRegNick(e.target.value)} />

            {/* 用户名（可选） */}
            <input className="input" placeholder="用户名（可选，留空则用邮箱前缀）" value={regUser} onChange={(e) => setRegUser(e.target.value)} />

            {/* 密码（可选） */}
            <input className="input" type="password" placeholder="密码（可选，8-32 位，字母+数字）" value={regPwd} onChange={(e) => setRegPwd(e.target.value)} />

            {regErr && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{regErr}</div>}
            <button className="big-btn" onClick={doRegister} disabled={loading}>
              {loading ? '注册中...' : '注册并登录'}
            </button>
            <button className="link-btn" onClick={() => setTab('login')}>已有账号？去登录</button>
          </div>
        </div>
      )}

      {/* 返回 Rainlet 首页（页面底部） */}
      <div style={{ textAlign: 'center', marginTop: 28, paddingBottom: 16 }}>
        <a className="home-link" href="/">← 返回 Rainlet 首页</a>
      </div>

      {/* 账号绑定弹窗 */}
      {showBind && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowBind(false)}>
          <div className="card" style={{ maxWidth: 360, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="group-label">绑定到已有账号</div>
            <div className="hint" style={{ marginBottom: 12 }}>
              请在另一台设备的设置页复制主账号的 ID，填到这里。绑定后两种登录方式都会路由到同一套数据。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="input"
                placeholder="主账号 ID"
                value={bindUid}
                onChange={(e) => setBindUid(e.target.value)}
              />
              {bindErr && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{bindErr}</div>}
              <button className="big-btn" onClick={() => doBindByUid(bindUid.trim())} disabled={bindLoading}>
                {bindLoading ? '绑定中...' : '确认绑定'}
              </button>
              <button className="link-btn" onClick={() => setShowBind(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
