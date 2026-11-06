import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { boardName, dismissNotices, fmt, getLeaderboard, getNotices, loadAccount, onBoardChange, saveAccount, startRun, submitScore } from './leaderboard';
import Trainer from './components/Trainer';
import AccountBar from './components/AccountBar';
import Notices from './components/Notices';
import SignInDialog from './components/SignInDialog';
import SubmitDialog from './components/SubmitDialog';
import LeaderboardDialog from './components/LeaderboardDialog';
import AccountDialog from './components/AccountDialog';
import SetupHelp from './components/SetupHelp';

const online = !!supabase;

export default function App() {
  const [account, setAccountState] = useState(loadAccount);
  const [dialog, setDialog] = useState(null); // { type: 'signin'|'submit'|'board'|'account'|'setup', ... }
  const [notices, setNotices] = useState([]);
  const [toast, setToast] = useState(null); // { text, action? }

  const accountRef = useRef(account);
  accountRef.current = account;

  const setAccount = useCallback((a) => {
    saveAccount(a);
    setAccountState(a);
    if (!a) setNotices([]);
  }, []);

  const showToast = useCallback((text, action) => {
    setToast({ text, action, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openBoard = useCallback((game, level) => setDialog({ type: 'board', game, level }), []);

  // A run ended with a score. Signed in: post it right away. Guest: offer to post it.
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
      onGameOver: (r) => gameOverRef.current(r),
      openLeaderboard: (game, level) => openBoard(game, level),
      topScores: (game, level, n = 5) => getLeaderboard(game, level, n),
      startRun: (game, level) => (online ? startRun(game, level) : Promise.resolve(null)),
      onBoardChange: (fn) => onBoardChange(fn),
      debug: import.meta.env.DEV,
    }),
    [openBoard],
  );

  // "Someone beat your score" notices: on sign-in, every minute, and when the tab comes back
  const refreshNotices = useCallback(async () => {
    const acc = accountRef.current;
    if (!online || !acc) return;
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
    if (!account) return;
    refreshNotices();
    const iv = setInterval(refreshNotices, 60000);
    const onVis = () => document.visibilityState === 'visible' && refreshNotices();
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
        onSignIn={() => setDialog({ type: 'signin' })}
        onBoard={() => openBoard('defender')}
        onAccount={() => setDialog({ type: 'account' })}
        onSetup={() => setDialog({ type: 'setup' })}
      />
      <Notices account={account} notices={notices} onOpenBoard={openBoard} onDismiss={dismiss} />
      <Trainer bridge={bridge} />

      {dialog?.type === 'signin' && <SignInDialog onClose={close} onAccount={setAccount} />}
      {dialog?.type === 'submit' && (
        <SubmitDialog result={dialog.result} onClose={close} onAccount={setAccount} onOpenBoard={openBoard} />
      )}
      {dialog?.type === 'board' && (
        <LeaderboardDialog key={dialog.game + (dialog.level || '')} game={dialog.game} level={dialog.level} account={account} onClose={close} />
      )}
      {dialog?.type === 'account' && account && (
        <AccountDialog
          account={account}
          onClose={close}
          onOpenBoard={openBoard}
          onSignOut={() => {
            setAccount(null);
            close('Signed out. You can keep playing as a guest.');
          }}
        />
      )}
      {dialog?.type === 'setup' && <SetupHelp onClose={close} />}

      {toast && (
        <div className="rtoast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button className="link inv" onClick={() => { toast.action.run(); setToast(null); }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </>
  );
}
