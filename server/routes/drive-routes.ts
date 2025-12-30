/**
 * Google Drive Integration Routes
 * Provides endpoints for cloud document folder management
 */

import type { Express, Request, Response } from 'express';
import { googleDriveService } from '../services/googleDriveService';

export function registerDriveRoutes(app: Express) {
  /**
   * Get Drive integration status
   */
  app.get('/api/drive/status', async (req: Request, res: Response) => {
    try {
      const status = await googleDriveService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting Drive status:', error);
      res.status(500).json({ error: 'Failed to get Drive status' });
    }
  });

  /**
   * Get OAuth URL for Drive authorization
   */
  app.get('/api/drive/auth-url', (req: Request, res: Response) => {
    try {
      const url = googleDriveService.getAuthUrl();
      res.json({ url });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  /**
   * OAuth callback for Drive
   */
  app.get('/api/drive/callback', async (req: Request, res: Response) => {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        return res.status(400).send('Authorization code missing');
      }

      const tokens = await googleDriveService.exchangeCodeForTokens(code);

      // Return success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Drive Connected</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; text-align: center; }
            .success { color: #059669; font-size: 24px; margin-bottom: 20px; }
            .info { color: #6b7280; margin-bottom: 30px; }
            .token-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; text-align: left; }
            pre { overflow-x: auto; word-break: break-all; white-space: pre-wrap; }
            button { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; }
            button:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="success">✓ Google Drive Connected Successfully!</div>
          <p class="info">TherapyFlow can now access your Google Drive for document processing.</p>
          ${tokens.refresh_token ? `
          <div class="token-box">
            <strong>Important:</strong> Save this refresh token to your environment variables as <code>GOOGLE_REFRESH_TOKEN</code>:
            <pre>${tokens.refresh_token}</pre>
          </div>
          ` : ''}
          <button onclick="window.close()">Close Window</button>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'drive-connected' }, '*');
              }
            }, 1000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Drive OAuth callback error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authorization Failed</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">Authorization Failed</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px;">Close</button>
        </body>
        </html>
      `);
    }
  });

  /**
   * List available Drive folders
   */
  app.get('/api/drive/folders', async (req: Request, res: Response) => {
    try {
      if (!googleDriveService.isConfigured()) {
        return res.status(401).json({ error: 'Google Drive not connected' });
      }

      const folders = await googleDriveService.listFolders();
      res.json({ folders });
    } catch (error) {
      console.error('Error listing folders:', error);
      res.status(500).json({ error: 'Failed to list folders' });
    }
  });

  /**
   * Create TherapyFlow folder structure in Drive
   */
  app.post('/api/drive/create-folder', async (req: Request, res: Response) => {
    try {
      if (!googleDriveService.isConfigured()) {
        return res.status(401).json({ error: 'Google Drive not connected' });
      }

      const folders = await googleDriveService.createWatchFolder();
      res.json({
        success: true,
        message: 'TherapyFlow folders created in Google Drive',
        watchFolder: folders.watchFolder,
        processedFolder: folders.processedFolder,
        instructions: `
Drop documents into the "TherapyFlow Documents" folder in your Google Drive.
Supported file types: .txt, .docx, .pdf, .doc

Processed files will be moved to the "Processed" subfolder automatically.
        `.trim()
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({ error: 'Failed to create folder' });
    }
  });

  /**
   * Set the watch folder
   */
  app.post('/api/drive/set-folder', async (req: Request, res: Response) => {
    try {
      const { folderId, processedFolderId } = req.body;

      if (!folderId) {
        return res.status(400).json({ error: 'Folder ID required' });
      }

      googleDriveService.setWatchFolder(folderId, processedFolderId);

      const folderInfo = await googleDriveService.getFolderInfo(folderId);

      res.json({
        success: true,
        message: `Watch folder set to: ${folderInfo?.name || folderId}`,
        folder: folderInfo
      });
    } catch (error) {
      console.error('Error setting folder:', error);
      res.status(500).json({ error: 'Failed to set folder' });
    }
  });

  /**
   * Get files in watch folder
   */
  app.get('/api/drive/files', async (req: Request, res: Response) => {
    try {
      if (!googleDriveService.isEnabled()) {
        return res.status(400).json({ error: 'Watch folder not configured' });
      }

      const files = await googleDriveService.getFilesInWatchFolder();
      res.json({ files });
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  /**
   * Manually trigger sync
   */
  app.post('/api/drive/sync', async (req: Request, res: Response) => {
    try {
      if (!googleDriveService.isEnabled()) {
        return res.status(400).json({ error: 'Watch folder not configured' });
      }

      const result = await googleDriveService.scanAndProcess();
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error syncing:', error);
      res.status(500).json({ error: 'Failed to sync' });
    }
  });

  /**
   * Start auto-polling
   */
  app.post('/api/drive/start-polling', (req: Request, res: Response) => {
    try {
      googleDriveService.startPolling();
      res.json({
        success: true,
        message: 'Drive polling started'
      });
    } catch (error) {
      console.error('Error starting polling:', error);
      res.status(500).json({ error: 'Failed to start polling' });
    }
  });

  /**
   * Stop auto-polling
   */
  app.post('/api/drive/stop-polling', (req: Request, res: Response) => {
    try {
      googleDriveService.stopPolling();
      res.json({
        success: true,
        message: 'Drive polling stopped'
      });
    } catch (error) {
      console.error('Error stopping polling:', error);
      res.status(500).json({ error: 'Failed to stop polling' });
    }
  });

  console.log('[Drive Routes] Registered Google Drive integration routes');
}
