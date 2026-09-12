// ============================================================================
// 设置页 v2 — 适配 CloudBase Auth V2
// ============================================================================
//
// v2 变化：
//   - 展示 CloudBase uid（方便用户复制去做账号绑定）
//   - 新增「绑定到已有账号」入口（输入主账号 uid 即可）
//   - syncPush 不再传 userId 参数（cloud.js 内部自动取）
//   - 登出按钮走 App 传下来的 onLogout
// ============================================================================

import { useState } from 'react';
import { unlockStore, settingsStore } from '../lib/store';
import { cloudEnabled } from '../lib/api';
import { syncPush } from '../lib/cloud';
import { Icon } from '../components/Icon';

const OPS_LABEL = { add: '加法', sub: '减法', mul: '乘法', div: '除法' };
const RATIO_LABEL = { 0: '全选项', 1: '50%手填', 2: '75%手填', 3: '全手填' };

export default function SettingsScreen({ user, unlockMap, onLogout, onRename, onBind }) {
  const [threshold, setThreshold] = useState(
    () => settingsStore.get().unlockThreshold || 90
  );
  const [perStage, setPerStage] = useState(
    () => settingsStore.get().unlockPerStage || 20
  );
  const [saved, setSaved] = useState(false);

  // 绑定弹窗状态
  const [showBind, setShowBind] = useState(false);
  const [bindUid, setBindUid] = useState('');
  const [bindErr, setBindErr] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  const saveThreshold = () => {
    settingsStore.set({ unlockThreshold: threshold, unlockPerStage: perStage });
    syncPush();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const doBind = async () => {
    setBindErr('');
    const target = bindUid.trim();
    if (!target) { setBindErr('请输入主账号 ID'); return; }
    if (target === user?.uid) { setBindErr('不能绑定到自己'); return; }

    setBindLoading(true);
    try {
      if (onBind) {
        await onBind(target);
        setShowBind(false);
        setBindUid('');
      }
    } catch (e) {
      setBindErr(e?.message || '绑定失败');
    } finally {
      setBindLoading(false);
    }
  };

  const copyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      alert('账号 ID 已复制到剪贴板');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = user.uid;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); alert('账号 ID 已复制到剪贴板'); } catch { alert('复制失败，请手动选择文本复制'); }
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="page">
      {/* 当前使用者 + 账户信息 */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="group-label">当前使用者</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div className="avatar">{user?.name?.[0] || '口'}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {cloudEnabled() ? '云端同步已开启 · 多设备数据互通' : '本地模式'}
            </div>
          </div>
        </div>

        {/* 账户 ID（可复制） */}
        <div style={{
          background: 'var(--bg-2)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 4,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>账户 ID</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ink-2)', wordBreak: 'break-all' }}>
              {user?.uid || '—'}
            </div>
          </div>
          <button className="link-btn" onClick={copyUid} style={{ whiteSpace: 'nowrap' }}>复制</button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          用这个 ID 可以在其他设备绑定到同一账号。
        </div>
      </div>

      {/* 绑定到已有账号 */}
      {onBind && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="group-label">账号绑定</div>
          <div className="hint" style={{ marginBottom: 8 }}>
            如果这个账号是邮箱验证码注册的，可以绑定到已有的用户名密码账号。绑定后两种登录方式都会路由到同一套数据。
          </div>
          <button className="big-btn ghost" onClick={() => { setShowBind(true); setBindUid(''); setBindErr(''); }}>
            绑定到已有账号
          </button>
        </div>
      )}

      {/* 分阶段解锁规则 */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="group-label">分阶段解锁设置</div>
        <div className="hint" style={{ marginBottom: 12 }}>
          每个题型：最近做满「每档题数」道，这 N 道正确率达到「达标正确率」就升一档；低于达标就降一档。档位越高手填越多，最后全手填。
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <label style={{ flex: 1 }}>
            <div className="hint" style={{ marginBottom: 4 }}>每档题数</div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={perStage}
              onChange={(e) => setPerStage(Math.max(1, Math.min(999, Number(e.target.value))))}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div className="hint" style={{ marginBottom: 4 }}>达标正确率 %</div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={threshold}
              onChange={(e) => setThreshold(Math.min(100, Math.max(50, Number(e.target.value))))}
            />
          </label>
        </div>
        <button className="big-btn ghost" style={{ marginTop: 12 }} onClick={saveThreshold}>
          保存设置
        </button>
        {saved && <div className="hint" style={{ color: 'var(--good)', marginTop: 8 }}>已保存 ✓</div>}
      </div>

      {/* 分阶段解锁进度 */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="group-label">各题型解锁阶段</div>
        {Object.entries(OPS_LABEL).map(([op, label]) => {
          const st = unlockMap?.[op];
          const stage = st?.stage ?? 0;
          const recent = st?.recent || [];
          const need = perStage;
          const done = recent.length;
          const rate = recent.length
            ? Math.round((recent.reduce((s, v) => s + v, 0) / recent.length) * 100)
            : 0;
          return (
            <div key={op} className="unlock-row">
              <div className="op-name">{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span className="unlock-badge on">{RATIO_LABEL[stage]}</span>
                {stage < 3 ? (
                  <span className="unlock-progress">
                    本档 {done}/{need} 题 · 正确率 {rate}%
                  </span>
                ) : (
                  <span className="unlock-progress muted">已到最高档</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 关于 + 登出 */}
      <div className="card" style={{ marginTop: 14, marginBottom: 30 }}>
        <div className="group-label">关于</div>
        <div className="hint">
          {cloudEnabled()
            ? '口算挑战 v0.3。答题数据自动在云端备份并在多台设备间同步；离线时使用本机缓存，联网登录后自动恢复。'
            : '口算挑战 v0.3。当前为本地模式，数据仅保存在本机浏览器中；配置云端后可实现多设备同步。'}
        </div>
        {onLogout && (
          <button className="big-btn ghost" style={{ marginTop: 12 }} onClick={onLogout}>
            <Icon name="user" size={20} /> 退出登录
          </button>
        )}
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
              请在另一台设备的设置页复制主账号的 ID，填到这里。绑定后，两种登录方式都会路由到同一套答题数据。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="input"
                placeholder="主账号 ID"
                value={bindUid}
                onChange={(e) => setBindUid(e.target.value)}
              />
              {bindErr && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{bindErr}</div>}
              <button className="big-btn" onClick={doBind} disabled={bindLoading}>
                {bindLoading ? '绑定中...' : '确认绑定'}
              </button>
              <button className="link-btn" onClick={() => setShowBind(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 返回 Rainlet 首页（页面底部） */}
      <div style={{ textAlign: 'center', marginTop: 28, paddingBottom: 16 }}>
        <a className="home-link" href="/">← 返回 Rainlet 首页</a>
      </div>
    </div>
  );
}
