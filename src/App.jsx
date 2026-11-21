import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boardName, dismissNotices, fmt, getBoards, getLeaderboard, getNotices, isBackedUp, loadAccount, loadProgress, onBoardChange,
  online, saveAccount, saveProgress, setLiveWanted, startRun, submitScore,
} from './leaderboard';
import Trainer from './components/Trainer';
import AccountBar from './components/AccountBar';
import Notices from './components/Notices';
import SignInDialog from './components/SignInDialog';
import SubmitDialog from './components/SubmitDialog';
import LeaderboardDialog from './components/LeaderboardDialog';
import AccountDialog from './components/AccountDialog';
import SetupHelp from './components/SetupHelp';

const NOTICE_EVERY = 3 * 60 * 1000;

export default function App() {
  const [account, setAccountState] = useState(loadAccount);
  const [dialog, setDialog] = useState(null); // { type: 'signin'|'submit'|'board'|'account'|'setup', ... }
  const [notices, setNotices] = useState([]);
  const [toast, setToast] = useState(null); // { text, action? }
  const [backed, setBacked] = useState(() => !account || isBackedUp(account.name, account.shared));

  const accountRef = useRef(account);
  accountRef.current = account;
  // the engine listens for account changes, so it can switch to that name's progress
  const accountFns = useRef(new Set());

  // how: 'new' (a name made just now), 'signin' (a name made before), or nothing
  const setAccount = useCallback((a, how) => {
    saveAccount(a);
    accountRef.current = a;
    setAccountState(a);
    accountFns.current.forEach((fn) => { try { fn(a, how); } catch (e) { /* the engine reports its own errors */ } });
    setBacked(!a || isBackedUp(a.name, a.shared));
    if (!a) setNotices([]);
  }, []);
  const refreshBackup = useCallback(() => {
    const a = accountRef.current;
    setBacked(!a || isBackedUp(a.name, a.shared));
  }, []);

  const showToast = useCallback((text, action) => {
    setToast({ text, action, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const openBoard = useCallback((game, level) => setDialog({ type: 'board', game, level }), []);

  // A round ended with a score. Signed in: post it right away. Guest: offer to post it.
  const onGameOver = useCallback(
    async (result) => {
      if (!online || !result || result.score <= 0) return;
      const acc = accountRef.current;
      if (!acc) {
        setDialog({ type: 'submit', result });
        return;
      }
      try {
        const r = await submitScore(acc, result);
        showToast(
          r.improved
            ? `Posted ${fmt(result.score)}. You're #${r.rank} on ${boardName(result.game, result.level)}.`
            : `Your best of ${fmt(r.best)} still stands at #${r.rank}.`,
          { label: 'See board', run: () => openBoard(result.game, result.level) },
        );
      } catch (x) {
        showToast(x.message);
      }
    },
    [showToast, openBoard],
  );
  const gameOverRef = useRef(onGameOver);
  gameOverRef.current = onGameOver;

  // The engine mounts once, so it talks to React only through this stable bridge.
  const bridge = useMemo(
    () => ({
      online,
      user: () => accountRef.current?.name ?? null,
      account: () => accountRef.current,
      onAccount: (fn) => { accountFns.current.add(fn); return () => accountFns.current.delete(fn); },
      progress: online ? { load: (acc, v) => loadProgress(acc, v), save: (acc, data, v) => saveProgress(acc, data, v) } : null,
      onGameOver: (r) => gameOverRef.current(r),
      openLeaderboard: (game, level) => openBoard(game, level),
      topScores: (game, level, n = 5) => getLeaderboard(game, level, n),
      topBoards: (keys, n = 5) => getBoards(keys, n),
      liveWanted: (on) => setLiveWanted(on),
      startRun: (game, level) => (online ? startRun(game, level) : Promise.resolve(null)),
      onBoardChange: (fn) => onBoardChange(fn),
      debug: import.meta.env.DEV,
    }),
    [openBoard],
  );

  // "Someone passed your score" notices: on sign-in, every few minutes, and when the tab comes back
  const lastCheck = useRef(0);
  const refreshNotices = useCallback(async (force) => {
    const acc = accountRef.current;
    if (!online || !acc) return;
    if (!force && Date.now() - lastCheck.current < 60000) return;
    lastCheck.current = Date.now();
    try {
      setNotices((await getNotices(acc)) || []);
    } catch (x) {
      if (x.code === 'bad_login') {
        setAccount(null);
        showToast('That account could not be verified, so you were signed out.');
      }
    }
  }, [setAccount, showToast]);
  useEffect(() => {
    if (!account) return undefined;
    refreshNotices(true);
    const iv = setInterval(() => document.visibilityState === 'visible' && refreshNotices(true), NOTICE_EVERY);
    const onVis = () => document.visibilityState === 'visible' && refreshNotices(false);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [account, refreshNotices]);

  async function dismiss() {
    const acc = accountRef.current;
    setNotices([]);
    if (acc) dismissNotices(acc).catch(() => {});
  }

  useEffect(() => {
    if (import.meta.env.DEV) window.__lb = { gameOver: (r) => gameOverRef.current(r) };
  }, []);

  const close = useCallback((msg) => {
    setDialog(null);
    if (typeof msg === 'string') showToast(msg);
  }, [showToast]);

  return (
    <>
      <AccountBar
        account={account}
        online={online}
        unread={notices.length}
        needsBackup={!backed}
        onSignIn={() => setDialog({ type: 'signin' })}
        onBoard={() => openBoard('defender')}
        onAccount={() => setDialog({ type: 'account' })}
        onSetup={() => setDialog({ type: 'setup' })}
      />
      <Notices account={account} notices={notices} onOpenBoard={openBoard} onDismiss={dismiss} />
      <Trainer bridge={bridge} />

      {dialog?.type === 'signin' && <SignInDialog onClose={close} onAccount={setAccount} onBackedUp={refreshBackup} />}
      {dialog?.type === 'submit' && (
        <SubmitDialog result={dialog.result} onClose={close} onAccount={setAccount} onOpenBoard={openBoard} onBackedUp={refreshBackup} />
      )}
      {dialog?.type === 'board' && (
        <LeaderboardDialog key={dialog.game + (dialog.level || '')} game={dialog.game} level={dialog.level} account={account} onClose={close} />
      )}
      {dialog?.type === 'account' && account && (
        <AccountDialog
          account={account}
          onClose={close}
          onOpenBoard={openBoard}
          onBackedUp={refreshBackup}
          onSignOut={() => {
            setAccount(null);
            close(`Signed out. Sign back in as ${account.name} to pick up your progress.`);
          }}
        />
      )}
      {dialog?.type === 'setup' && <SetupHelp onClose={close} />}

      {toast && (
        <div className="rtoast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" className="link inv" onClick={() => { toast.action.run(); setToast(null); }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </>
  );
}
