import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// Performance monitoring
if (import.meta.env.DEV) {
  // Add performance marks for development
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      console.log('Page load time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
    }, 0);
  });
}

// Error boundary for production
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // In production, you might want to send this to an error reporting service
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // In production, you might want to send this to an error reporting service
});

createRoot(document.getElementById("root")!).render(<App />);
