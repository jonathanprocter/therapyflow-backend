/**
 * Structured Logging Service
 * Provides consistent logging across the application
 */

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class LoggerService {
  private logLevel: string;
  private logFormat: string;

  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFormat = process.env.LOG_FORMAT || 'pretty';
  }

  /**
   * Determine if a log level should be output
   */
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLog(entry: LogEntry): string {
    if (this.logFormat === 'json') {
      return JSON.stringify(entry);
    }

    // Pretty format for development
    const emoji = {
      error: '❌',
      warn: '⚠️ ',
      info: 'ℹ️ ',
      debug: '🔍'
    }[entry.level];

    let output = `${emoji} [${entry.timestamp}]`;
    
    if (entry.context) {
      output += ` [${entry.context}]`;
    }
    
    output += ` ${entry.message}`;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n   ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      output += `\n   Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n   ${entry.error.stack}`;
      }
    }

    return output;
  }

  /**
   * Create log entry
   */
  private createEntry(
    level: LogEntry['level'],
    message: string,
    context?: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context) {
      entry.context = context;
    }

    if (metadata) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Log error
   */
  error(message: string, error?: Error, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;

    const entry = this.createEntry('error', message, context, metadata, error);
    console.error(this.formatLog(entry));

    // In production, send to error tracking service (Sentry, etc.)
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      // TODO: Send to Sentry
    }
  }

  /**
   * Log warning
   */
  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;

    const entry = this.createEntry('warn', message, context, metadata);
    console.warn(this.formatLog(entry));
  }

  /**
   * Log info
   */
  info(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;

    const entry = this.createEntry('info', message, context, metadata);
    console.log(this.formatLog(entry));
  }

  /**
   * Log debug
   */
  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;

    const entry = this.createEntry('debug', message, context, metadata);
    console.log(this.formatLog(entry));
  }

  /**
   * Log HTTP request
   */
  http(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this[level](
      `${method} ${path} ${statusCode} - ${duration}ms`,
      'HTTP',
      metadata
    );
  }

  /**
   * Log database query (only in debug mode)
   */
  query(query: string, duration: number, params?: any[]): void {
    if (process.env.LOG_SQL_QUERIES !== 'true') return;

    this.debug(
      `Query executed in ${duration}ms`,
      'Database',
      {
        query: query.substring(0, 200), // Truncate long queries
        params,
        duration,
      }
    );
  }

  /**
   * Log AI service call
   */
  ai(
    service: string,
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    this.info(
      `${service} ${operation} completed in ${duration}ms`,
      'AI',
      metadata
    );
  }

  /**
   * Log cache operation
   */
  cache(operation: string, key: string, hit: boolean): void {
    this.debug(
      `Cache ${hit ? 'HIT' : 'MISS'}: ${operation}`,
      'Cache',
      { key, hit }
    );
  }

  /**
   * Log authentication event
   */
  auth(event: string, userId?: string, metadata?: Record<string, any>): void {
    this.info(
      `Auth event: ${event}`,
      'Auth',
      { userId, ...metadata }
    );
  }

  /**
   * Log security event
   */
  security(event: string, severity: 'low' | 'medium' | 'high', metadata?: Record<string, any>): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    
    this[level](
      `Security event: ${event}`,
      'Security',
      { severity, ...metadata }
    );
  }
}

// Export singleton instance
export const logger = new LoggerService();

/**
 * Express middleware for request logging
 */
export function requestLogger(req: any, res: any, next: any): void {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.http(
      req.method,
      req.path,
      res.statusCode,
      duration,
      {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        therapistId: req.therapistId || req.user?.id,
      }
    );
  });

  next();
}
