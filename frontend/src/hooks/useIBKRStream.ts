import { useEffect, useRef, useCallback } from 'react';
import type { IBKRAccountSummary } from '../types/trackers';

interface UseIBKRStreamOptions {
  enabled: boolean;
  onAccountUpdate: (summary: IBKRAccountSummary) => void;
  onError?: () => void;
}

export function useIBKRStream({ enabled, onAccountUpdate, onError }: UseIBKRStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectDelay = 30000; // 30 seconds max
  const baseReconnectDelay = 1000; // Start at 1 second

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('[useIBKRStream] Closing EventSource connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

    cleanup();

    console.log('[useIBKRStream] Opening SSE connection to /api/ibkr/stream');
    const eventSource = new EventSource('/api/ibkr/stream');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      console.log('[useIBKRStream] Connected to SSE stream');
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
    });

    eventSource.addEventListener('accountUpdate', (event) => {
      try {
        const summary = JSON.parse(event.data) as IBKRAccountSummary;
        console.log('[useIBKRStream] Received account update:', summary);
        onAccountUpdate(summary);
      } catch (error) {
        console.error('[useIBKRStream] Failed to parse account update:', error);
      }
    });

    eventSource.onerror = () => {
      console.error('[useIBKRStream] SSE error');

      if (onError) {
        onError();
      }

      // Close the current connection
      eventSource.close();
      eventSourceRef.current = null;

      // Attempt to reconnect with exponential backoff
      if (enabled) {
        const delay = Math.min(
          baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          maxReconnectDelay
        );
        reconnectAttemptsRef.current++;

        console.log(`[useIBKRStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [enabled, onAccountUpdate, onError, cleanup]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return {
    disconnect: cleanup,
    reconnect: connect,
  };
}
