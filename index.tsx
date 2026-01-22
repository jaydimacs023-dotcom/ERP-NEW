
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import { NotificationProvider } from './components/NotificationContext';
import { NotificationList } from './components/NotificationList';

console.log("🚀 AccounTech ERP: Mounting React application...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  const errorMsg = "❌ Could not find root element to mount to";
  console.error(errorMsg);
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace; background: #ffe0e0;">${errorMsg}</div>`;
  throw new Error(errorMsg);
}

console.log("✅ Root element found, creating React root...");

const root = ReactDOM.createRoot(rootElement);

try {
  console.log("📦 Rendering App component...");
  root.render(
    <React.StrictMode>
      <NotificationProvider>
        <App />
        <NotificationList />
      </NotificationProvider>
    </React.StrictMode>
  );
  console.log("✅ App rendered successfully");
} catch (error) {
  const errorMsg = `❌ React render error: ${error instanceof Error ? error.message : String(error)}`;
  console.error(errorMsg, error);
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace; background: #ffe0e0; white-space: pre-wrap;">${errorMsg}\n\n${error instanceof Error ? error.stack : ''}</div>`;
}
