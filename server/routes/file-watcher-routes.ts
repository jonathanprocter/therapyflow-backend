/**
 * File Watcher API Routes
 * Provides endpoints to manage the document watch folder
 */

import type { Express, Request, Response } from 'express';
import { fileWatcherService } from '../services/fileWatcherService';

export function registerFileWatcherRoutes(app: Express) {
  /**
   * Get watch folder status
   */
  app.get('/api/file-watcher/status', (req: Request, res: Response) => {
    try {
      const status = fileWatcherService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting file watcher status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  /**
   * Start watching the folder
   */
  app.post('/api/file-watcher/start', async (req: Request, res: Response) => {
    try {
      await fileWatcherService.startWatching();
      res.json({
        success: true,
        message: 'File watcher started',
        watchPath: fileWatcherService.getWatchPath()
      });
    } catch (error) {
      console.error('Error starting file watcher:', error);
      res.status(500).json({ error: 'Failed to start file watcher' });
    }
  });

  /**
   * Stop watching the folder
   */
  app.post('/api/file-watcher/stop', (req: Request, res: Response) => {
    try {
      fileWatcherService.stopWatching();
      res.json({
        success: true,
        message: 'File watcher stopped'
      });
    } catch (error) {
      console.error('Error stopping file watcher:', error);
      res.status(500).json({ error: 'Failed to stop file watcher' });
    }
  });

  /**
   * Get the watch folder path
   */
  app.get('/api/file-watcher/path', (req: Request, res: Response) => {
    try {
      const watchPath = fileWatcherService.getWatchPath();
      res.json({
        path: watchPath,
        instructions: `Drop documents in this folder for automatic processing:

Supported file types:
- .txt - Session transcripts
- .docx - Word documents (transcripts, notes)
- .pdf - Progress notes, clinical documents

Naming convention (recommended):
- Include client name in filename
- Examples: "John Smith - Session 2024-01-15.txt"

Processed files are moved to: ${watchPath}/processed/
Files with errors are moved to: ${watchPath}/errors/`
      });
    } catch (error) {
      console.error('Error getting watch path:', error);
      res.status(500).json({ error: 'Failed to get watch path' });
    }
  });

  /**
   * Update configuration
   */
  app.post('/api/file-watcher/config', (req: Request, res: Response) => {
    try {
      const { path, pollIntervalMs } = req.body;

      const updates: any = {};
      if (path) updates.path = path;
      if (pollIntervalMs) updates.pollIntervalMs = parseInt(pollIntervalMs);

      fileWatcherService.updateConfig(updates);

      res.json({
        success: true,
        message: 'Configuration updated',
        status: fileWatcherService.getStatus()
      });
    } catch (error) {
      console.error('Error updating file watcher config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  console.log('[File Watcher Routes] Registered document watch folder routes');
}
