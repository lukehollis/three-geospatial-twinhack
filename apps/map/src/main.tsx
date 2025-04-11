import { createRoot } from 'react-dom/client'
import App from './App'
import './tailwind.css'
import './styles.css'
import { Leva } from 'leva'
import { Provider, createStore } from 'jotai'
import { BrowserRouter } from 'react-router'
// Import build information
import buildInfo from './buildInfo.json'

// Create a Jotai store and make it globally available
const jotaiStore = createStore();
// Make the store globally available for components that need it outside of React context
window.jotaiStore = jotaiStore;

// Log build information to console
console.log('%c 🚀 App Build Information', 'background: #222; color: #bada55; font-size: 16px; padding: 4px;');
console.log(`Build ID: ${buildInfo.buildId}`);
console.log(`Build Timestamp: ${buildInfo.buildTimestamp}`);
console.log(`Build Date: ${buildInfo.buildDate}`);

// Add build info to window for debugging
window.buildInfo = buildInfo;

createRoot(document.getElementById('root')!).render(
  <Provider store={jotaiStore}>
      <Leva hidden={import.meta.env['VITE_DEBUG_MODE'] !== 'true'} collapsed={import.meta.env['VITE_DEBUG_MODE'] === 'true'} />
    <BrowserRouter>
        <App />
    </BrowserRouter>
  </Provider>
)
