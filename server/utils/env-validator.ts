/**
 * Environment Variable Validator
 * Ensures all required environment variables are set on startup
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
}

const ENV_VARS: EnvVar[] = [
  // Critical
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection URL',
    validate: (val) => val.startsWith('postgres://') || val.startsWith('postgresql://')
  },
  {
    name: 'ENCRYPTION_KEY',
    required: true,
    description: 'Encryption key for sensitive data (32+ characters)',
    validate: (val) => val.length >= 32
  },
  
  // Server
  {
    name: 'PORT',
    required: false,
    description: 'Server port (default: 5000)',
    validate: (val) => !isNaN(parseInt(val))
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Environment: development, production, test'
  },
  
  // AI Services (at least one required)
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key for GPT models'
  },
  {
    name: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'Anthropic API key for Claude models'
  },
  
  // Optional but recommended
  {
    name: 'SESSION_SECRET',
    required: false,
    description: 'Session secret for authentication (recommended for production)'
  },
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis URL for caching (recommended for production)'
  }
];

export class EnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validate all environment variables
   */
  validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    this.errors = [];
    this.warnings = [];

    // Check required variables
    for (const envVar of ENV_VARS) {
      const value = process.env[envVar.name];

      if (envVar.required && !value) {
        this.errors.push(`❌ Missing required environment variable: ${envVar.name}`);
        this.errors.push(`   Description: ${envVar.description}`);
        continue;
      }

      if (value && envVar.validate && !envVar.validate(value)) {
        this.errors.push(`❌ Invalid value for ${envVar.name}`);
        this.errors.push(`   Description: ${envVar.description}`);
      }

      if (!envVar.required && !value) {
        this.warnings.push(`⚠️  Optional variable not set: ${envVar.name}`);
      }
    }

    // Check for at least one AI service
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    
    if (!hasOpenAI && !hasAnthropic) {
      this.warnings.push('⚠️  No AI service configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
      this.warnings.push('   Some features may not work without AI services');
    }

    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
      this.checkProductionRequirements();
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Check production-specific requirements
   */
  private checkProductionRequirements(): void {
    if (!process.env.SESSION_SECRET) {
      this.warnings.push('⚠️  SESSION_SECRET not set in production');
      this.warnings.push('   This is required for secure authentication');
    }

    if (!process.env.REDIS_URL) {
      this.warnings.push('⚠️  REDIS_URL not set in production');
      this.warnings.push('   Caching will use in-memory storage (not suitable for multiple instances)');
    }

    if (!process.env.SENTRY_DSN) {
      this.warnings.push('⚠️  SENTRY_DSN not set in production');
      this.warnings.push('   Error tracking is recommended for production');
    }

    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 64) {
      this.warnings.push('⚠️  ENCRYPTION_KEY should be at least 64 characters in production');
    }
  }

  /**
   * Print validation results to console
   */
  printResults(): void {
    console.log('\n🔍 Environment Variable Validation\n');

    if (this.errors.length > 0) {
      console.error('❌ ERRORS:\n');
      this.errors.forEach(error => console.error(error));
      console.error('\n');
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️  WARNINGS:\n');
      this.warnings.forEach(warning => console.warn(warning));
      console.warn('\n');
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All environment variables are properly configured\n');
    } else if (this.errors.length === 0) {
      console.log('✅ Required environment variables are set (with warnings)\n');
    }
  }

  /**
   * Get environment info for health check
   */
  static getEnvironmentInfo(): Record<string, any> {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      hasDatabase: !!process.env.DATABASE_URL,
      hasEncryption: !!process.env.ENCRYPTION_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
      hasRedis: !!process.env.REDIS_URL,
      hasGoogle: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      features: {
        fileWatcher: process.env.ENABLE_FILE_WATCHER !== 'false',
        drivePolling: process.env.ENABLE_DRIVE_POLLING === 'true',
        calendarReconciliation: process.env.ENABLE_CALENDAR_RECONCILIATION !== 'false'
      }
    };
  }
}

/**
 * Validate environment on module load
 * Exits process if critical variables are missing
 */
export function validateEnvironmentOnStartup(): void {
  const validator = new EnvironmentValidator();
  const result = validator.validate();

  validator.printResults();

  if (!result.valid) {
    console.error('❌ Environment validation failed. Please check your .env file.');
    console.error('   See .env.example for required variables.\n');
    process.exit(1);
  }
}

export const envValidator = new EnvironmentValidator();
