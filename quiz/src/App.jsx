// ============================================================================
// 主应用组件 v2 — CloudBase Auth V2
// ============================================================================
//
// v2 核心变化：
//   - 启动时通过 CloudBase Auth 检测登录态，不再依赖本地 sessionStore
//   - 用户标识统一为 CloudBase Auth 返回的 uid（字符串）
//   - syncPull/syncPush 不再接受 uid 参数，cloud.js 内部自动取
//   - 登出调用 auth.signOut()，清除 Auth token + 本地 lastSync 标记
//   - 设置页展示 CloudBase 用户信息 + 登出按钮 + 账户绑定入口
// ============================================================================

import { useState, useEffect } from 'react';
import { recordStore, wrongStore, unlockStore, settingsStore } from './lib/store';
import { buildSessionRecord, summarize } from './lib/analytics';
import { syncPull, syncPush } from './lib/cloud';
import { initCloudBase, cloudEnabled, getCurrentUid, bindUser } from './lib/api';
import { Icon } from './components/Icon';
import LoginScreen from './screens/LoginScreen';
import SetupScreen from './screens/SetupScreen';
import QuizScreen from './screens/QuizScreen';
import ResultScreen from './screens/ResultScreen';
import StatsScreen from './screens/StatsScreen';
import WrongScreen from './screens/WrongScreen';
import SettingsScreen from './screens/SettingsScreen';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null); // { uid, name, nickname }
  const [tab, setTab] = useState('setup');
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(null);
  const [unlockMap, setUnlockMap] = useState({});
  const [checking, setChecking] = useState(true); // 启动时检测登录态

  // ====== 启动时：初始化 CloudBase + 检查登录态 ======
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await initCloudBase();
        // getCurrentUid() 现在从 localStorage 同步读，不需要 await
        const uid = getCurrentUid();
        if (uid) {
          // 有登录态 → 先拉云端数据
          await syncPull();

          // 组装 user 对象
          const prefs = settingsStore.userPrefs(uid);
          setUser({ uid, name: prefs.nickname || uid.slice(0, 8) });
          setUnlockMap(unlockStore.all(uid));
        } else {
          // 无登录态 → 显示登录页
          setUser(null);
        }
      } catch (e) {
        console.warn('启动初始化失败', e);
        // 初始化失败也让用户看到登录页，保持可操作
        setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // ====== 登录 ======
  const login = async (uid) => {
    await syncPull();
    const prefs = settingsStore.userPrefs(uid);
    setUser({ uid, name: prefs.nickname || uid.slice(0, 8) });
    setUnlockMap(unlockStore.all(uid));
    setTab('setup');
  };

  // ====== 登出 ======
  const logout = async () => {
    // 退出前推送最后状态
    try { await syncPush(); } catch { /* ignore */ }

    // 清除 CloudBase 会话
    try {
      const { auth } = await initCloudBase();
      await auth.signOut();
    } catch {
      // signOut 失败也继续清除本地
    }

    // 清除本地 lastSync 标记
    try { localStorage.removeItem(`mq_last_sync_${user?.uid}`); } catch { /* ignore */ }

    setUser(null);
    setSession(null);
    setUnlockMap({});
    setTab('login');
  };

  // ====== 开始答题 ======
  const start = (questions, s) => {
    setSettings(s);
    setSession({ questions, settings: s });
    setTab('quiz');
  };

  // ====== 解锁进度 ======
  const onUnlock = (op, correct) => {
    if (!op || !user) return;
    const settings = settingsStore.get();
    const need = settings.unlockPerStage || 20;
    const threshold = (settings.unlockThreshold || 90) / 100;
    const st = unlockStore.record(user.uid, op, correct, need);
    if (st.recent.length >= need) {
      const correctCount = st.recent.reduce((s, v) => s + v, 0);
      const rate = correctCount / need;
      if (st.stage < 3 && rate >= threshold) unlockStore.advance(user.uid, op);
      else if (st.stage > 0 && rate < threshold) unlockStore.downgrade(user.uid, op);
    }
    setUnlockMap(unlockStore.all(user.uid));
  };

  // ====== 答题完成 ======
  const finish = (answered, answeredRef, early = false) => {
    const qs = (answeredRef || answered).map(({ idx, rec }) => {
      const q = session.questions[idx];
      return { ...q, ...rec };
    });
    const sessionId = `u${Date.now()}`;
    const rec = buildSessionRecord({
      userId: user.uid,
      sessionId,
      questions: qs,
      settings: session.settings,
    });
    recordStore.add(rec);

    const date = rec.date;
    qs.forEach((q) => {
      if (!q.op) return;
      wrongStore.track(user.uid, q, q.correct, date);
    });

    setSession({
      ...session,
      questions: qs,
      questionsOriginal: session.questions,
      saved: true,
      completed: true,
    });
    setTab(early ? 'setup' : 'result');
    syncPush(); // 答题结束推送云端
  };

  // ====== 账号绑定入口：从设置页调用 ======
  const doBindFromSettings = async (primaryUid) => {
    try {
      await bindUser(primaryUid);
      await syncPull();
      const prefs = settingsStore.userPrefs(user.uid);
      setUser({ uid: user.uid, name: prefs.nickname || primaryUid.slice(0, 8) });
      return true;
    } catch (e) {
      throw e;
    }
  };

  // 底部导航
  const tabs = [
    { key: 'setup', label: '出题', icon: 'home' },
    { key: 'stats', label: '统计', icon: 'chart' },
    { key: 'wrong', label: '错题', icon: 'book' },
    { key: 'settings', label: '设置', icon: 'user' },
  ];

  // ====== 启动中 ======
  if (checking) {
    return (
      <div className="page flat" style={{ paddingTop: 80, textAlign: 'center' }}>
        <Icon name="target" size={48} />
        <div style={{ marginTop: 16, color: 'var(--ink-2)' }}>正在加载...</div>
      </div>
    );
  }

  // ====== 未登录 ======
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // ====== 主界面 ======
  return (
    <div className="app-shell">
      {tab === 'quiz' ? (
        <>
          <div className="topbar hide-desktop">
            <div className="title">口算挑战</div>
            <div className="user">{user.name}</div>
          </div>
          <QuizScreen
            questions={session.questions}
            settings={session.settings}
            unlockRatio={(op) => unlockStore.ratio(user.uid, op)}
            onUnlock={onUnlock}
            onFinish={finish}
            onExit={() => setTab('setup')}
          />
        </>
      ) : tab === 'result' ? (
        <div className="page-with-bar">
          <div className="topbar">
            <div className="title">答题结果</div>
            <div className="user">{user.name}</div>
          </div>
          <ResultScreen
            session={session}
            user={user}
            onDone={() => setTab('setup')}
            onReviewWrong={() => setTab('wrong')}
            onSetup={() => setTab('setup')}
          />
          <Tabbar tabs={tabs} active="setup" onTab={setTab} />
        </div>
      ) : (
        <div className="page-with-bar">
          <div className="topbar">
            <div className="title">
              {tab === 'stats' ? '统计' : tab === 'wrong' ? '错题' : tab === 'settings' ? '设置' : '口算挑战'}
            </div>
            <div className="user">{user.name}</div>
          </div>
          <div className="content-area">
            {tab === 'setup' && <SetupScreen user={user} onStart={start} onNeedUser={() => {}} />}
            {tab === 'stats' && <StatsScreen user={user} goPractice={() => setTab('setup')} />}
            {tab === 'wrong' && <WrongScreen user={user} />}
            {tab === 'settings' && (
              <SettingsScreen
                user={user}
                unlockMap={unlockMap}
                onLogout={logout}
                onRename={() => {}}
                onBind={doBindFromSettings}
              />
            )}
          </div>
          <Tabbar tabs={tabs} active={tab} onTab={setTab} />
        </div>
      )}
    </div>
  );
}

function Tabbar({ tabs, active, onTab }) {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onTab(t.key)}>
          <Icon name={t.icon} size={22} className="ico" />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
