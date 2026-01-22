/**
 * PasswordService: Secure Password Hashing using bcrypt
 * 
 * This service provides secure password hashing and verification using the bcrypt algorithm.
 * bcrypt is designed to be computationally expensive to protect against brute-force attacks.
 * 
 * Features:
 * - Secure password hashing with configurable salt rounds
 * - Password verification against stored hashes
 * - Async operations for non-blocking hashing
 * - Compatible with browser and Node.js environments
 */

import bcrypt from 'bcryptjs';

// Cost factor for bcrypt (10-12 is recommended for production)
// Higher values = more secure but slower
const SALT_ROUNDS = 12;

export class PasswordService {
  /**
   * Hash a plain text password using bcrypt
   * 
   * @param plainPassword - The plain text password to hash
   * @returns Promise<string> - The hashed password (includes salt)
   * 
   * @example
   * const hash = await PasswordService.hashPassword('mySecurePassword123');
   * // Returns something like: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.GJwNDGJH8K9pKq
   */
  static async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || plainPassword.length === 0) {
      throw new Error('Password cannot be empty');
    }
    
    // Generate salt and hash in one step
    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hash;
  }

  /**
   * Synchronous version of hashPassword for cases where async is not practical
   * Note: This blocks the main thread - prefer async version when possible
   * 
   * @param plainPassword - The plain text password to hash
   * @returns string - The hashed password
   */
  static hashPasswordSync(plainPassword: string): string {
    if (!plainPassword || plainPassword.length === 0) {
      throw new Error('Password cannot be empty');
    }
    
    const salt = bcrypt.genSaltSync(SALT_ROUNDS);
    return bcrypt.hashSync(plainPassword, salt);
  }

  /**
   * Verify a plain text password against a bcrypt hash
   * 
   * @param plainPassword - The plain text password to verify
   * @param hashedPassword - The stored bcrypt hash to compare against
   * @returns Promise<boolean> - True if password matches, false otherwise
   * 
   * @example
   * const isValid = await PasswordService.verifyPassword('myPassword', storedHash);
   * if (isValid) {
   *   // Password is correct
   * }
   */
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    try {
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      return isMatch;
    } catch (error) {
      console.error('[PasswordService] Error verifying password:', error);
      return false;
    }
  }

  /**
   * Synchronous version of verifyPassword
   * Note: This blocks the main thread - prefer async version when possible
   * 
   * @param plainPassword - The plain text password to verify
   * @param hashedPassword - The stored bcrypt hash
   * @returns boolean - True if password matches
   */
  static verifyPasswordSync(plainPassword: string, hashedPassword: string): boolean {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    try {
      return bcrypt.compareSync(plainPassword, hashedPassword);
    } catch (error) {
      console.error('[PasswordService] Error verifying password:', error);
      return false;
    }
  }

  /**
   * Check if a string is a valid bcrypt hash
   * Useful for migrating from plain text or other hash formats
   * 
   * @param hash - The string to check
   * @returns boolean - True if it looks like a bcrypt hash
   */
  static isBcryptHash(hash: string): boolean {
    if (!hash || hash.length < 50) {
      return false;
    }
    // bcrypt hashes start with $2a$, $2b$, or $2y$ followed by the cost factor
    const bcryptPattern = /^\$2[aby]?\$\d{1,2}\$/;
    return bcryptPattern.test(hash);
  }

  /**
   * Legacy password verification for migration purposes
   * Checks against old base64 encoded passwords and plain text
   * 
   * @param plainPassword - The password to verify
   * @param storedPassword - The stored password (may be plain, base64, or bcrypt)
   * @returns Promise<{isValid: boolean, needsMigration: boolean}>
   */
  static async verifyWithLegacySupport(
    plainPassword: string, 
    storedPassword: string
  ): Promise<{ isValid: boolean; needsMigration: boolean }> {
    if (!plainPassword || !storedPassword) {
      return { isValid: false, needsMigration: false };
    }

    // Check if it's a bcrypt hash
    if (this.isBcryptHash(storedPassword)) {
      const isValid = await this.verifyPassword(plainPassword, storedPassword);
      return { isValid, needsMigration: false };
    }

    // Check base64 encoded password (legacy format)
    try {
      const base64Encoded = btoa(plainPassword);
      if (storedPassword === base64Encoded) {
        return { isValid: true, needsMigration: true };
      }
    } catch {
      // btoa may fail with certain characters, continue to plain text check
    }

    // Check plain text (very legacy)
    if (storedPassword === plainPassword) {
      return { isValid: true, needsMigration: true };
    }

    return { isValid: false, needsMigration: false };
  }

  /**
   * Generate password strength information
   * 
   * @param password - The password to analyze
   * @returns Object with strength score and feedback
   */
  static analyzePasswordStrength(password: string): {
    score: number;
    strength: 'weak' | 'fair' | 'good' | 'strong';
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (!password) {
      return { score: 0, strength: 'weak', feedback: ['Password is required'] };
    }

    // Length checks
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (password.length < 8) feedback.push('Password should be at least 8 characters');

    // Character type checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Add special characters (!@#$%^&*)');

    // Common patterns to avoid
    if (/^[a-zA-Z]+$/.test(password)) {
      score -= 1;
      feedback.push('Avoid using only letters');
    }
    if (/^[0-9]+$/.test(password)) {
      score -= 1;
      feedback.push('Avoid using only numbers');
    }
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Avoid repeated characters');
    }

    // Determine strength level
    let strength: 'weak' | 'fair' | 'good' | 'strong';
    if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'fair';
    else if (score <= 6) strength = 'good';
    else strength = 'strong';

    return { score: Math.max(0, score), strength, feedback };
  }
}

export default PasswordService;
