export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  durationMs: number;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach(l => l(items));
}

export function showToast(tone: ToastTone, title: string, message?: string, durationMs?: number) {
  const id = ++seq;
  const duration = durationMs ?? (tone === 'danger' ? 6500 : tone === 'warning' ? 5000 : 3500);
  items = [...items, { id, tone, title, message, durationMs: duration }].slice(-4);
  emit();
  setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number) {
  items = items.filter(t => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}
