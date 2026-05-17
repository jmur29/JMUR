import { useState, useEffect } from 'react';
import Modal from './Modal';

interface ShortcutRow {
  keys: string[];
  description: string;
  group: 'Navigation' | 'Actions';
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['⌘', 'D'], description: 'Go to Dashboard', group: 'Navigation' },
  { keys: ['⌘', 'K'], description: 'Go to Applications', group: 'Navigation' },
  { keys: ['/'], description: 'Focus search (on list page)', group: 'Navigation' },
  { keys: ['⌘', '⇧', 'N'], description: 'New Application', group: 'Actions' },
  { keys: ['?'], description: 'Show keyboard shortcuts', group: 'Actions' },
];

const GROUPS: Array<'Navigation' | 'Actions'> = ['Navigation', 'Actions'];

function KeyChip({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded shadow-sm font-mono">
      {label}
    </kbd>
  );
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title="Keyboard Shortcuts"
      size="lg"
    >
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const rows = SHORTCUTS.filter((s) => s.group === group);
          return (
            <div key={group}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                {group}
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.description}>
                      <td className="py-2.5 pr-6 w-32">
                        <div className="flex items-center gap-1">
                          {row.keys.map((k, i) => (
                            <KeyChip key={i} label={k} />
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-700">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          ⌘ = Cmd on Mac, Ctrl on Windows/Linux
        </p>
      </div>
    </Modal>
  );
}
