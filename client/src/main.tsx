/**
 * Module purpose: Starts React, provides the authentication and routing contexts, and mounts the application in the HTML root element.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#14233B', color: '#fff', fontSize: '0.875rem', borderRadius: '6px' },
            success: { iconTheme: { primary: '#2F8A61', secondary: '#fff' } },
            error: { iconTheme: { primary: '#B42318', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
