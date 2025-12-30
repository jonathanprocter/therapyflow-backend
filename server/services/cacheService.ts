/**
 * Unified Caching Service
 * Supports Redis (production) and in-memory cache (development)
 */

import NodeCache from 'node-cache';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespacing
}

export class CacheService {
  private memoryCache: NodeCache;
  private redisClient: any = null;
  private useRedis: boolean = false;
  private defaultTTL: number;

  constructor() {
    // Default TTL: 5 minutes
    this.defaultTTL = parseInt(process.env.CACHE_TTL || '300');
    
    // Initialize in-memory cache
    this.memoryCache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 120,
      useClones: false
    });

    // Try to initialize Redis if URL is provided
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection if available
   */
  private async initializeRedis(): Promise<void> {
    if (!process.env.REDIS_URL) {
      console.log('📦 Cache: Using in-memory storage (Redis not configured)');
      return;
    }

    try {
      // Dynamically import redis only if needed
      const redis = await import('redis');
      
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.redisClient.on('error', (err: Error) => {
        console.error('❌ Redis error:', err.message);
        this.useRedis = false;
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Redis: Connected successfully');
        this.useRedis = true;
      });

      this.redisClient.on('disconnect', () => {
        console.warn('⚠️  Redis: Disconnected, falling back to memory cache');
        this.useRedis = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      console.warn('⚠️  Redis initialization failed, using memory cache:', error);
      this.useRedis = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      if (this.useRedis && this.redisClient) {
        const value = await this.redisClient.get(fullKey);
        return value ? JSON.parse(value) : null;
      } else {
        return this.memoryCache.get<T>(fullKey) || null;
      }
    } catch (error) {
      console.error(`Cache get error for key ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl || this.defaultTTL;

    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.setEx(fullKey, ttl, JSON.stringify(value));
        return true;
      } else {
        return this.memoryCache.set(fullKey, value, ttl);
      }
    } catch (error) {
      console.error(`Cache set error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(fullKey);
        return true;
      } else {
        return this.memoryCache.del(fullKey) > 0;
      }
    } catch (error) {
      console.error(`Cache delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string, options?: CacheOptions): Promise<number> {
    const fullPattern = this.buildKey(pattern, options?.prefix);

    try {
      if (this.useRedis && this.redisClient) {
        const keys = await this.redisClient.keys(fullPattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
        return keys.length;
      } else {
        const keys = this.memoryCache.keys().filter(k => k.includes(pattern));
        this.memoryCache.del(keys);
        return keys.length;
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${fullPattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.exists(fullKey) === 1;
      } else {
        return this.memoryCache.has(fullKey);
      }
    } catch (error) {
      console.error(`Cache has error for key ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.flushDb();
      } else {
        this.memoryCache.flushAll();
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    if (this.useRedis) {
      return {
        type: 'redis',
        connected: this.useRedis,
        url: process.env.REDIS_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]'
      };
    } else {
      const stats = this.memoryCache.getStats();
      return {
        type: 'memory',
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hits / (stats.hits + stats.misses) || 0
      };
    }
  }

  /**
   * Build full cache key with optional prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    this.memoryCache.close();
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Predefined cache prefixes for different data types
export const CachePrefix = {
  CLIENTS: 'clients',
  SESSIONS: 'sessions',
  PROGRESS_NOTES: 'notes',
  DASHBOARD_STATS: 'stats',
  THERAPEUTIC_INSIGHTS: 'insights',
  AI_RESULTS: 'ai',
  DOCUMENTS: 'docs'
} as const;

// Predefined TTL values (in seconds)
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  VERY_LONG: 86400     // 24 hours
} as const;
