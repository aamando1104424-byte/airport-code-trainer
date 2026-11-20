import { useState } from 'react';
import Modal from './Modal';
import AccountFlow from './AccountFlow';

// "Pick a name" in the top bar
export default function SignInDialog({ onClose, onAccount, onBackedUp }) {
  const [locked, setLocked] = useState(false);
  return (
    <Modal title="Get on the leaderboard" onClose={onClose} locked={locked}>
      <AccountFlow
        onAccount={onAccount}
        onLock={setLocked}
        onFinish={(acc, isNew) => {
          if (isNew) onBackedUp?.();
          onClose(isNew ? `You're ${acc.name}. Your scores can go on the world board now.` : `Welcome back, ${acc.name}.`);
        }}
      />
    </Modal>
  );
}
