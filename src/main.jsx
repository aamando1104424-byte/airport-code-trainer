import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyMode, applyTheme, getModePref, getTheme } from './themes';
import './trainer/tokens.css';
import './trainer/styles.css';
import './app.css';

// No <StrictMode> on purpose: it mounts effects twice in development,
// which would start the game engine twice.
// index.html already set the mode and color theme before the first paint; this also syncs the phone's browser bar color.
applyTheme(getTheme());
applyMode(getModePref());

createRoot(document.getElementById('root')).render(<App />);
