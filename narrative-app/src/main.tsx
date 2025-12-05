import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Load debug utilities (also in production for testing)
import './debug';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
