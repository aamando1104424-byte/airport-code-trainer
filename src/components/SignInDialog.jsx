import { useState } from 'react';
import Modal from './Modal';
import NameForm from './NameForm';
import NewAccount from './NewAccount';

export default function SignInDialog({ onClose, onAccount }) {
  const [created, setCreated] = useState(null);
  return (
    <Modal title={created ? 'Name saved' : 'Sign in'} onClose={onClose}>
      {created ? (
        <>
          <NewAccount account={created} />
          <button className="btn primary big" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <p className="lead">Pick a name for the world leaderboard. You can keep playing without one.</p>
          <NameForm
            onSignedIn={(acc, isNew) => {
              onAccount(acc);
              if (isNew) setCreated(acc);
              else onClose(`Welcome back, ${acc.name}.`);
            }}
          />
        </>
      )}
    </Modal>
  );
}
