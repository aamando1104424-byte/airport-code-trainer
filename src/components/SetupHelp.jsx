import Modal from './Modal';

export default function SetupHelp({ onClose }) {
  return (
    <Modal title="Turn on the leaderboard" onClose={onClose}>
      <ol className="steps">
        <li>In Supabase, open <b>SQL Editor</b>, paste everything from <code>supabase/schema.sql</code> and press <b>Run</b>.</li>
        <li>Copy <code>.env.example</code> to a new file named <code>.env.local</code>.</li>
        <li>Fill in your project URL and anon key from <b>Project Settings → API</b>.</li>
        <li>Stop the dev server and run <code>npm run dev</code> again.</li>
      </ol>
      <p className="note">Everything else in the app works without it.</p>
      <button className="btn primary big" onClick={onClose}>Got it</button>
    </Modal>
  );
}
