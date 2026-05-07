import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App';

// Remove qualquer resquício do tema escuro (descontinuado)
try {
  document.documentElement.removeAttribute('data-theme');
  localStorage.removeItem('clareza_theme');
} catch {}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
