// Global keyboard shortcut registry for power users.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { IS_DEV_AUTH, useDevAuth } from '../lib/devAuth';

interface Shortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

function useIsSignedInDev() {
  return useDevAuth().isSignedIn;
}

function useIsSignedInClerk() {
  return useUser().isSignedIn;
}

const useIsSignedIn = IS_DEV_AUTH ? useIsSignedInDev : useIsSignedInClerk;

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const isSignedIn = useIsSignedIn();

  useEffect(() => {
    if (!isSignedIn) return;

    const shortcuts: Shortcut[] = [
      { key: 'k', meta: true, description: 'Go to Applications', action: () => navigate('/applications') },
      { key: 'd', meta: true, description: 'Go to Dashboard', action: () => navigate('/dashboard') },
      { key: 'n', meta: true, shift: true, description: 'New Application', action: () => navigate('/applications/new') },
      { key: '/', description: 'Focus search', action: () => {
        const el = document.querySelector<HTMLInputElement>('input[placeholder*="search" i], input[placeholder*="Search" i]');
        if (el) { el.focus(); el.select(); }
      }},
    ];

    function handleKeyDown(e: KeyboardEvent) {
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
