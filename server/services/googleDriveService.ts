/**
 * Google Drive Service
 * Integrates with Google Drive for cloud-based document drop folder
 *
 * Features:
 * - Monitor a specific Google Drive folder for new documents
 * - Auto-download and process new files through the document pipeline
 * - Sync status back to Drive (move to processed folder)
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { fileWatcherService } from './fileWatcherService';
import { enhancedDocumentProcessor } from './enhanced-document-processor';
import { storage } from '../storage';
import { promises as fs } from 'fs';
import path from 'path';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface DriveConfig {
  watchFolderId: string | null;
  processedFolderId: string | null;
  pollIntervalMs: number;
  therapistId: string;
}

interface DriveStatus {
  connected: boolean;
  watchFolderName: string | null;
  watchFolderId: string | null;
  lastSync: Date | null;
  filesProcessed: number;
  isPolling: boolean;
}

class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private drive: any;
  private config: DriveConfig;
  private isPolling: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private processedFileIds: Set<string> = new Set();
  private lastSync: Date | null = null;
  private filesProcessed: number = 0;

  constructor() {
    const redirectUri = this.getRedirectUri();

    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Use existing refresh token if available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    this.config = {
      watchFolderId: process.env.GOOGLE_DRIVE_WATCH_FOLDER_ID || null,
      processedFolderId: process.env.GOOGLE_DRIVE_PROCESSED_FOLDER_ID || null,
      pollIntervalMs: parseInt(process.env.GOOGLE_DRIVE_POLL_INTERVAL || '60000'), // 1 minute default
      therapistId: process.env.DEFAULT_THERAPIST_ID || 'dr-jonathan-procter'
    };
  }

  private getRedirectUri(): string {
    if (process.env.RENDER_EXTERNAL_URL) {
      return `${process.env.RENDER_EXTERNAL_URL}/api/drive/callback`;
    }
    if (process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS}/api/drive/callback`;
    }
    return 'http://localhost:5000/api/drive/callback';
  }

  /**
   * Check if the service is properly configured and authenticated
   */
  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_REFRESH_TOKEN || this.oauth2Client.credentials.access_token)
    );
  }

  /**
   * Check if Drive integration is enabled (has watch folder configured)
   */
  isEnabled(): boolean {
    return this.isConfigured() && !!this.config.watchFolderId;
  }

  /**
   * Generate OAuth URL for Drive access (includes Drive scope)
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar', // Keep calendar access too
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      console.log('[GoogleDrive] New refresh token received. Save to GOOGLE_REFRESH_TOKEN.');
    }

    return tokens;
  }

  /**
   * List available folders in Drive root
   */
  async listFolders(): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'name'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('[GoogleDrive] Error listing folders:', error);
      throw error;
    }
  }

  /**
   * Create the TherapyFlow folder structure in Drive
   */
  async createWatchFolder(): Promise<{ watchFolder: DriveFile; processedFolder: DriveFile }> {
    try {
      // Create main watch folder
      const watchFolderResponse = await this.drive.files.create({
        requestBody: {
          name: 'TherapyFlow Documents',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id, name'
      });

      const watchFolder = watchFolderResponse.data;

      // Create processed subfolder
      const processedFolderResponse = await this.drive.files.create({
        requestBody: {
          name: 'Processed',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [watchFolder.id]
        },
        fields: 'id, name'
      });

      const processedFolder = processedFolderResponse.data;

      // Update config
      this.config.watchFolderId = watchFolder.id;
      this.config.processedFolderId = processedFolder.id;

      console.log(`[GoogleDrive] Created watch folder: ${watchFolder.name} (${watchFolder.id})`);
      console.log(`[GoogleDrive] Created processed folder: ${processedFolder.name} (${processedFolder.id})`);

      return { watchFolder, processedFolder };
    } catch (error) {
      console.error('[GoogleDrive] Error creating folders:', error);
      throw error;
    }
  }

  /**
   * Set the watch folder ID
   */
  setWatchFolder(folderId: string, processedFolderId?: string): void {
    this.config.watchFolderId = folderId;
    if (processedFolderId) {
      this.config.processedFolderId = processedFolderId;
    }
    console.log(`[GoogleDrive] Watch folder set to: ${folderId}`);
  }

  /**
   * Get files in the watch folder
   */
  async getFilesInWatchFolder(): Promise<DriveFile[]> {
    if (!this.config.watchFolderId) {
      throw new Error('Watch folder not configured');
    }

    try {
      const response = await this.drive.files.list({
        q: `'${this.config.watchFolderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('[GoogleDrive] Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download a file from Drive
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('[GoogleDrive] Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Move a file to the processed folder
   */
  async moveToProcessed(fileId: string): Promise<void> {
    if (!this.config.processedFolderId) {
      console.warn('[GoogleDrive] No processed folder configured, skipping move');
      return;
    }

    try {
      // Get current parents
      const file = await this.drive.files.get({
        fileId,
        fields: 'parents'
      });

      const previousParents = file.data.parents?.join(',') || '';

      // Move to processed folder
      await this.drive.files.update({
        fileId,
        addParents: this.config.processedFolderId,
        removeParents: previousParents,
        fields: 'id, parents'
      });

      console.log(`[GoogleDrive] Moved file ${fileId} to processed folder`);
    } catch (error) {
      console.error('[GoogleDrive] Error moving file:', error);
    }
  }

  /**
   * Process a single file from Drive
   */
  async processFile(file: DriveFile): Promise<{ success: boolean; message: string }> {
    console.log(`[GoogleDrive] Processing: ${file.name}`);

    try {
      // Download file content
      const buffer = await this.downloadFile(file.id);

      // Process through enhanced document processor
      const result = await enhancedDocumentProcessor.processDocument(
        buffer,
        file.name,
        this.config.therapistId
      );

      if (result.success) {
        // Move to processed folder
        await this.moveToProcessed(file.id);
        this.filesProcessed++;

        return {
          success: true,
          message: `Successfully processed ${file.name} (document)`
        };
      } else {
        return {
          success: false,
          message: `Failed to process ${file.name}: ${result.processingNotes || 'Unknown error'}`
        };
      }
    } catch (error) {
      console.error(`[GoogleDrive] Error processing ${file.name}:`, error);
      return {
        success: false,
        message: `Error processing ${file.name}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Scan and process new files in the watch folder
   */
  async scanAndProcess(): Promise<{ processed: number; errors: number; results: any[] }> {
    if (!this.config.watchFolderId) {
      throw new Error('Watch folder not configured');
    }

    const results: any[] = [];
    let processed = 0;
    let errors = 0;

    try {
      const files = await this.getFilesInWatchFolder();

      for (const file of files) {
        // Skip already processed files
        if (this.processedFileIds.has(file.id)) {
          continue;
        }

        // Check file extension
        const ext = path.extname(file.name).toLowerCase();
        if (!['.txt', '.docx', '.pdf', '.doc'].includes(ext)) {
          console.log(`[GoogleDrive] Skipping unsupported file: ${file.name}`);
          continue;
        }

        const result = await this.processFile(file);
        results.push({ file: file.name, ...result });

        if (result.success) {
          processed++;
          this.processedFileIds.add(file.id);
        } else {
          errors++;
        }
      }

      this.lastSync = new Date();

      return { processed, errors, results };
    } catch (error) {
      console.error('[GoogleDrive] Error during scan:', error);
      throw error;
    }
  }

  /**
   * Start polling the Drive folder
   */
  startPolling(): void {
    if (this.isPolling) {
      console.log('[GoogleDrive] Already polling');
      return;
    }

    if (!this.isEnabled()) {
      console.log('[GoogleDrive] Cannot start polling - not configured');
      return;
    }

    this.isPolling = true;
    console.log(`[GoogleDrive] Starting polling (interval: ${this.config.pollIntervalMs}ms)`);

    // Initial scan
    this.scanAndProcess().catch(err => {
      console.error('[GoogleDrive] Initial scan failed:', err);
    });

    // Set up polling interval
    this.pollInterval = setInterval(async () => {
      try {
        await this.scanAndProcess();
      } catch (error) {
        console.error('[GoogleDrive] Poll cycle failed:', error);
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('[GoogleDrive] Stopped polling');
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<DriveStatus> {
    let watchFolderName: string | null = null;

    if (this.config.watchFolderId && this.isConfigured()) {
      try {
        const folder = await this.drive.files.get({
          fileId: this.config.watchFolderId,
          fields: 'name'
        });
        watchFolderName = folder.data.name;
      } catch (error) {
        // Folder may not be accessible
      }
    }

    return {
      connected: this.isConfigured(),
      watchFolderName,
      watchFolderId: this.config.watchFolderId,
      lastSync: this.lastSync,
      filesProcessed: this.filesProcessed,
      isPolling: this.isPolling
    };
  }

  /**
   * Get folder info
   */
  async getFolderInfo(folderId: string): Promise<DriveFile | null> {
    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, createdTime, modifiedTime'
      });
      return response.data;
    } catch (error) {
      console.error('[GoogleDrive] Error getting folder info:', error);
      return null;
    }
  }

  /**
   * Get diagnostic info about Drive API access
   */
  async diagnose(): Promise<{
    config: any;
    tests: { about?: any; listFolders?: any };
    summary: string;
  }> {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      config: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
        isConfigured: this.isConfigured(),
        isEnabled: this.isEnabled()
      },
      tests: {}
    };

    // Test 1: Try to get about info (tests basic connectivity)
    try {
      const aboutResponse = await this.drive.about.get({
        fields: 'user,storageQuota'
      });
      diagnostics.tests.about = {
        success: true,
        user: aboutResponse.data.user?.emailAddress
      };
    } catch (error: any) {
      diagnostics.tests.about = {
        success: false,
        error: error?.response?.data?.error?.message || error?.message,
        code: error?.response?.data?.error?.code || error?.code
      };
    }

    // Test 2: Try to list folders (tests Drive API access)
    try {
      const folders = await this.listFolders();
      diagnostics.tests.listFolders = {
        success: true,
        folderCount: folders.length
      };
    } catch (error: any) {
      diagnostics.tests.listFolders = {
        success: false,
        error: error?.response?.data?.error?.message || error?.message,
        code: error?.response?.data?.error?.code || error?.code
      };
    }

    const allPassed = Object.values(diagnostics.tests).every((t: any) => t.success);
    diagnostics.summary = allPassed ? 'All tests passed' : 'Some tests failed';

    return diagnostics;
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;
