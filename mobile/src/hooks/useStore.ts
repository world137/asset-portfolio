import { useEffect, useReducer } from 'react';
import Store from '../core/store';

// Triggers a re-render whenever Store emits.
export function useStore() {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  useEffect(() => {
    const unsub = Store.subscribe(forceUpdate);
    return () => { unsub(); };
  }, []);
  return Store;
}
