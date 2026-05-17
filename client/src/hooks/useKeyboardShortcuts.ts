// Global keyboard shortcut registry for power users.
// Usage: useKeyboardShortcuts() in App.tsx root.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

interface Shortcut {
  key: string;
  meta?: boolean;   // Cmd on Mac, Ctrl on Windows
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn) return;

    const shortcuts: Shortcut[] = [
      { key: 'k', meta: true, description: 'Go to Applications', action: () => navigate('/applications') },
      { key: 'd', meta: true, description: 'Go to Dashboard', action: () => navigate('/dashboard') },
      { key: 'n', meta: true, shift: true, description: 'New Application', action: () => navigate('/applications/new') },
      { key: '/', description: 'Focus search (when on list page)', action: () => {
        const search = document.querySelector<HTMLInputElement>('input[placeholder*="search" i], input[placeholder*="Search" i]');
        if (search) { search.focus(); search.select(); }
      }},
    ];

    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : (!e.metaKey && !e.ctrlKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        if (e.key === shortcut.key && metaMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSignedIn, navigate]);
}
