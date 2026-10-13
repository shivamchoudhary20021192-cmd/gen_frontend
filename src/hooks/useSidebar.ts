import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'veylog.sidebar_state';

interface SidebarState {
  isCollapsed: boolean;
  isHovering: boolean;
}

export function useSidebar() {
  // Load from localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial: SidebarState = stored 
    ? JSON.parse(stored) 
    : { isCollapsed: false, isHovering: false };

  const [state, setState] = useState<SidebarState>(initial);

  // Toggle collapsed
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, isCollapsed: !prev.isCollapsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Set hovering
  const setHovering = useCallback((hovering: boolean) => {
    setState(prev => ({ ...prev, isHovering: hovering }));
  }, []);

  // Calculate actual width
  const width = state.isCollapsed && !state.isHovering ? 64 : 232;

  // Keyboard shortcut: Ctrl+B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  return {
    ...state,
    width,
    toggleCollapse,
    setHovering,
  };
}
