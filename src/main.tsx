import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {TermsPage} from './components/TermsPage.tsx';
import './index.css';

// The emails link straight to /terms. Every other path is the campaign flow.
const isTermsPage = /^\/terms\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTermsPage ? <TermsPage /> : <App />}
  </StrictMode>,
);
