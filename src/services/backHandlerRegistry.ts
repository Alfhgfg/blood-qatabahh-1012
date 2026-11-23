import { useEffect, useRef } from 'react';

interface RegisteredBackHandler {
  id: string;
  priority: number;
  onBack: () => void;
}

class BackHandlerRegistry {
  private handlers: RegisteredBackHandler[] = [];
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  register(id: string, priority: number, onBack: () => void): () => void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, priority, onBack });
    this.notify();

    return () => {
      const before = this.handlers.length;
      this.handlers = this.handlers.filter((h) => h.id !== id);
      if (this.handlers.length !== before) {
        this.notify();
      }
    };
  }

  hasActiveHandlers(): boolean {
    return this.handlers.length > 0;
  }

  handleTop(): boolean {
    if (this.handlers.length === 0) return false;
    const sorted = [...this.handlers].sort((a, b) => b.priority - a.priority);
    const top = sorted[0];
    if (top) {
      top.onBack();
      return true;
    }
    return false;
  }
}

export const backHandlerRegistry = new BackHandlerRegistry();

/**
 * Registers a back button / gesture interceptor while `isActive` is true.
 * Higher `priority` values are closed first.
 */
export function useRegisterBackHandler(
  id: string,
  isActive: boolean,
  onBack: () => void,
  priority = 10
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isActive) return;
    return backHandlerRegistry.register(id, priority, () => {
      onBackRef.current();
    });
  }, [id, isActive, priority]);
}
