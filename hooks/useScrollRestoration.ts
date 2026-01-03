import { useEffect, useRef } from 'react';

/**
 * Hook to save and restore scroll position when switching between tabs/views
 * @param key - Unique identifier for this scroll position (e.g., "dashboard", "settings-rooms")
 * @param dependencies - Dependencies that trigger scroll position save
 */
export const useScrollRestoration = (key: string, dependencies: any[] = []) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Save scroll position before unmount or when dependencies change
  useEffect(() => {
    const container = scrollContainerRef.current;

    return () => {
      if (container) {
        const scrollPosition = {
          top: container.scrollTop,
          left: container.scrollLeft,
        };
        sessionStorage.setItem(`scroll-${key}`, JSON.stringify(scrollPosition));
      }
    };
  }, dependencies);

  // Restore scroll position on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const saved = sessionStorage.getItem(`scroll-${key}`);
      if (saved) {
        try {
          const { top, left } = JSON.parse(saved);
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            container.scrollTo({ top, left });
          });
        } catch (e) {
          console.error('Failed to restore scroll position:', e);
        }
      }
    }
  }, [key]);

  return scrollContainerRef;
};
