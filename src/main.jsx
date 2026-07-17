import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './styles.css';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = '/assets/game/heart-pickup.png';
document.head.append(favicon);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
