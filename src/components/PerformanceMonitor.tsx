import { useEffect, useState } from 'react';

// Performance monitoring hook for development
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    domContentLoaded: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
  });

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Measure page load performance
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const paintEntries = performance.getEntriesByType('paint');

          setMetrics({
            loadTime: perfData.loadEventEnd - perfData.fetchStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
            firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
            firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
          });
        }, 0);
      });
    }
  }, []);

  return metrics;
}

// Performance display component for development
export function PerformanceMonitor() {
  const metrics = usePerformanceMonitor();

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded font-mono z-50 max-w-xs">
      <div>Load: {Math.round(metrics.loadTime)}ms</div>
      <div>DCL: {Math.round(metrics.domContentLoaded)}ms</div>
      <div>FP: {Math.round(metrics.firstPaint)}ms</div>
      <div>FCP: {Math.round(metrics.firstContentfulPaint)}ms</div>
    </div>
  );
}