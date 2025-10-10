import express from 'express';
import type { Request, Response } from 'express';
import { IBKRService } from '../services/IBKRService.js';
import { BarSizeSetting } from '@stoqey/ib';

const router = express.Router();

// Store IBKR service instance (in production, use proper session management)
let ibkrService: IBKRService | null = null;

// Track SSE clients
const sseClients = new Set<Response>();

// Helper to broadcast events to all SSE clients
function broadcastToClients(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    client.write(message);
  });
}

// Get connection defaults from environment
router.get('/config/defaults', (req: Request, res: Response) => {
  res.json({
    host: process.env.IBKR_HOST || '127.0.0.1',
    port: parseInt(process.env.IBKR_PORT || '7496', 10),
  });
});

// Connect to IBKR
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { host, port, clientId } = req.body;

    if (!host || !port || clientId === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: host, port, clientId',
      });
    }

    ibkrService = new IBKRService({ host, port, clientId });

    // Listen for account updates and broadcast to SSE clients
    ibkrService.on('accountUpdate', (summary) => {
      console.log('[Router] Broadcasting account update to SSE clients');
      broadcastToClients('accountUpdate', summary);
    });

    await ibkrService.connect();

    res.json({
      success: true,
      message: 'Connected to IBKR successfully',
    });
  } catch (error) {
    console.error('Failed to connect to IBKR:', error);
    res.status(500).json({
      error: 'Failed to connect to IBKR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Disconnect from IBKR
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    if (ibkrService) {
      ibkrService.removeAllListeners('accountUpdate');
      await ibkrService.disconnect();
      ibkrService = null;
    }

    res.json({
      success: true,
      message: 'Disconnected from IBKR',
    });
  } catch (error) {
    console.error('Failed to disconnect from IBKR:', error);
    res.status(500).json({
      error: 'Failed to disconnect from IBKR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get connection status
router.get('/status', (req: Request, res: Response) => {
  const isConnected = ibkrService?.getConnectionStatus() || false;
  res.json({
    connected: isConnected,
  });
});

// SSE endpoint for real-time account and portfolio updates
router.get('/stream', (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

  // Add client to set
  sseClients.add(res);
  console.log(`[SSE] Client connected. Total clients: ${sseClients.size}`);

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  // Send current state if available
  if (ibkrService) {
    const summary = ibkrService.getCachedAccountSummary();
    if (summary) {
      res.write(`event: accountUpdate\ndata: ${JSON.stringify(summary)}\n\n`);
    }
  }

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected. Total clients: ${sseClients.size}`);
  });
});

// Get historical data for a symbol
router.get('/historical/:symbol', async (req: Request, res: Response) => {
  try {
    if (!ibkrService) {
      return res.status(400).json({
        error: 'Not connected to IBKR. Please connect first.',
      });
    }

    const { symbol } = req.params;
    const {
      endDateTime = '',
      duration = '1 M',
      barSize = 'DAYS_ONE',
    } = req.query;

    // Map string barSize to BarSizeSetting enum
    const barSizeKey = (barSize as string).toUpperCase();
    const barSizeSetting = BarSizeSetting[barSizeKey as keyof typeof BarSizeSetting] || BarSizeSetting.DAYS_ONE;

    const historicalData = await ibkrService.getHistoricalData(
      symbol,
      endDateTime as string,
      duration as string,
      barSizeSetting
    );

    res.json(historicalData);
  } catch (error) {
    console.error('Failed to get historical data:', error);
    res.status(500).json({
      error: 'Failed to get historical data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
