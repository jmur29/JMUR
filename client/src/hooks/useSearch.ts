// Debounced search hook for ApplicationList and global search.
import { useState, useEffect, useRef } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useSearch(initialQ = '') {
  const [query, setQuery] = useState(initialQ);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  function focus() { inputRef.current?.focus(); }
  function clear() { setQuery(''); inputRef.current?.focus(); }

  return { query, setQuery, debouncedQuery, inputRef, focus, clear };
}
