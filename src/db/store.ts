import { useMemo, useSyncExternalStore } from 'react';

// Contador de versão global: toda escrita chama bump() e as telas recalculam suas consultas.
let version = 0;
const subs = new Set<() => void>();

export function bump() {
  version++;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function useQuery<T>(fn: () => T, deps: unknown[] = []): T {
  const v = useVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, [v, ...deps]);
}
