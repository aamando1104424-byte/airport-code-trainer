import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './trainer/styles.css';
import './app.css';

// No <StrictMode> on purpose: it mounts effects twice in development,
// which would start the game engine twice.
createRoot(document.getElementById('root')).render(<App />);
