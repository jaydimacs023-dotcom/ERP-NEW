// Add this debugging to index.tsx to see if React is mounting
// Replace the entire content of index.tsx with this:

import React from 'react';
import ReactDOM from 'react-dom/client';

console.log('index.tsx loaded');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
} else {
  console.log('Root element found:', rootElement);
}

// Simple test component
const TestApp = () => {
  console.log('TestApp component rendering');
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', border: '2px solid red' }}>
      <h1>React is Working!</h1>
      <p>If you can see this, React is mounting successfully.</p>
      <button onClick={() => alert('Button clicked!')}>Test Button</button>
    </div>
  );
};

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('Root created, rendering TestApp');
  root.render(<TestApp />);
  console.log('TestApp rendered successfully');
} catch (error) {
  console.error('Error rendering React app:', error);
}
