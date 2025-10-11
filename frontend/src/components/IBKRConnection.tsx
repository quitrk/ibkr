import { useState, useEffect, useRef, useCallback } from 'react';
import {
  connectToIBKR,
  disconnectFromIBKR,
  getIBKRConnectionStatus,
  getIBKRDefaults,
} from '../api/ibkrApi';
import type { IBKRConnectionConfig } from '../types/trackers';
import { useIBKRStream } from '../hooks/useIBKRStream';
import './IBKRConnection.css';

interface IBKRConnectionProps {
  onPortfolioUpdate?: (summary: any) => void;
}

export function IBKRConnection({ onPortfolioUpdate }: IBKRConnectionProps) {
  const [clientId] = useState(() => Math.floor(Math.random() * 32).toString());
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConnectAttempted = useRef(false);
  const configRef = useRef<{ host: string; port: number } | null>(null);

  // Setup SSE stream for real-time updates
  useIBKRStream({
    enabled: connected,
    onAccountUpdate: useCallback((summary) => {
      if (onPortfolioUpdate) {
        onPortfolioUpdate(summary);
      }
    }, [onPortfolioUpdate]),
    onError: useCallback(() => {
      console.error('[IBKRConnection] SSE connection error');
    }, []),
  });
  
  // Load defaults from backend and auto-connect if enabled
  useEffect(() => {
    const init = async () => {
      // Prevent duplicate auto-connect attempts
      if (autoConnectAttempted.current) {
        console.log('[IBKRConnection] Auto-connect already attempted, skipping');
        return;
      }

      try {
        // Load defaults from backend
        const defaults = await getIBKRDefaults();
        console.log('[IBKRConnection] Loaded defaults from backend:', defaults);
        configRef.current = defaults;

        // Check connection status
        console.log('[IBKRConnection] Checking connection status...');
        const status = await checkConnectionStatus();
        console.log('[IBKRConnection] Current status:', status ? 'connected' : 'disconnected');

        // Only auto-connect if enabled, not already connected, and not currently connecting
        if (!status && !connecting) {
          console.log('[IBKRConnection] Starting auto-connect with clientId:', clientId);
          autoConnectAttempted.current = true;
          await handleConnect();
        } else {
          console.log('[IBKRConnection] Skipping auto-connect:', {
            alreadyConnected: status,
            currentlyConnecting: connecting
          });
        }
      } catch (err) {
        console.error('[IBKRConnection] Failed to initialize:', err);
      }
    };

    init();

    // Cleanup: disconnect when component unmounts
    return () => {
      console.log('[IBKRConnection] Component unmounting, disconnecting from IBKR');
      disconnectFromIBKR().catch((err) => {
        console.error('[IBKRConnection] Failed to disconnect on unmount:', err);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const status = await getIBKRConnectionStatus();
      setConnected(status.connected);
      return status.connected;
    } catch (err) {
      console.error('Failed to check connection status:', err);
      return false;
    }
  };

  const handleConnect = async () => {
    // Guard against duplicate connection attempts
    if (connecting) {
      console.log('[IBKRConnection] Already connecting, ignoring duplicate request');
      return;
    }

    if (connected) {
      console.log('[IBKRConnection] Already connected, ignoring duplicate request');
      return;
    }

    // Load config if not already loaded
    if (!configRef.current) {
      console.log('[IBKRConnection] No defaults found.');
      return;
    }

    console.log('[IBKRConnection] Initiating connection with clientId:', clientId);
    setConnecting(true);
    setError(null);

    try {
      const config: IBKRConnectionConfig = {
        host: configRef.current.host,
        port: configRef.current.port,
        clientId: parseInt(clientId, 10),
      };

      console.log('[IBKRConnection] Connecting to IBKR with config:', config);
      await connectToIBKR(config);
      console.log('[IBKRConnection] Successfully connected to IBKR');
      setConnected(true);
      // Portfolio updates will be received via SSE stream
    } catch (err) {
      console.error('[IBKRConnection] Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div
      className={`connection-status-toggle ${connected ? 'connected' : 'disconnected'}`}
      onClick={connected ? undefined : handleConnect}
      title={connected ? 'Connected to IBKR' : 'Click to connect to IBKR'}
    >
      <span className={`status-dot ${connected ? 'connected' : ''}`} />
      <span className="status-text">
        {connecting ? 'Connecting...' : connected ? 'Connected' : 'Connect'}
      </span>
      {error && (
        <span className="status-error" title={error}>⚠️</span>
      )}
    </div>
  );
}
