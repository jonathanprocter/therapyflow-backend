/**
 * Utility functions to transform between snake_case and camelCase
 * Used to bridge the gap between backend (snake_case) and frontend (camelCase)
 */

/**
 * Convert a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Recursively transform all keys in an object from snake_case to camelCase
 */
export function transformKeysToCamel<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToCamel(item)) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = snakeToCamel(key);
        transformed[camelKey] = transformKeysToCamel(obj[key]);
      }
    }
    return transformed as T;
  }

  return obj;
}

/**
 * Recursively transform all keys in an object from camelCase to snake_case
 */
export function transformKeysToSnake<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToSnake(item)) as T;
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = camelToSnake(key);
        transformed[snakeKey] = transformKeysToSnake(obj[key]);
      }
    }
    return transformed as T;
  }

  return obj;
}

/**
 * Transform API response from snake_case to camelCase
 * This is the main function to use when receiving data from the backend
 */
export function transformApiResponse<T = any>(data: any): T {
  return transformKeysToCamel<T>(data);
}

/**
 * Transform API request from camelCase to snake_case
 * This is the main function to use when sending data to the backend
 */
export function transformApiRequest<T = any>(data: any): T {
  return transformKeysToSnake<T>(data);
}
