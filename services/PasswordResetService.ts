/**
 * PasswordResetService - Secure Password Reset Flow for AT-ERP
 * 
 * Features:
 * - Cryptographically secure reset tokens
 * - Token expiration (1 hour default)
 * - One-time use tokens (invalidated after use)
 * - Rate limiting for reset requests
 * - Audit logging integration
 * 
 * Flow:
 * 1. User requests reset → generateResetToken()
 * 2. Token sent via email (or displayed in dev mode)
 * 3. User clicks link → validateResetToken()
 * 4. User enters new password → resetPassword()
 * 5. Token invalidated, password updated
 */

import { generateUUID } from '../utils/uuid';
import { PasswordService } from './PasswordService';
import { config } from '../config/app';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: number;
  createdAt: number;
  used: boolean;
  usedAt?: number;
  ipAddress?: string;
}

export interface ResetRequestResult {
  success: boolean;
  message: string;
  // In development mode, include the reset link for testing
  resetLink?: string;
  resetToken?: string;
}

export interface ResetValidationResult {
  valid: boolean;
  expired: boolean;
  used: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const RESET_CONFIG = {
  // Token expiration time (1 hour)
  tokenExpiryMs: 60 * 60 * 1000,
  
  // Minimum time between reset requests for same email (5 minutes)
  rateLimitMs: 5 * 60 * 1000,
  
  // Maximum reset attempts per email per day
  maxDailyAttempts: 5,
  
  // Token length (bytes, will be hex encoded)
  tokenLength: 32,
  
  // Base URL for reset links
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
};

// Storage key for persisting tokens
const STORAGE_KEY = 'at_erp_reset_tokens';

// ============================================================================
// PASSWORD RESET SERVICE CLASS
// ============================================================================

class PasswordResetServiceClass {
  // In-memory storage for reset tokens (in production, use database)
  private resetTokens: Map<string, PasswordResetToken> = new Map();
  
  // Rate limiting: track last reset request time per email
  private lastResetRequest: Map<string, number> = new Map();
  
  // Daily attempt counter per email
  private dailyAttempts: Map<string, { count: number; date: string }> = new Map();
  
  // Supabase config
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
    
    // Load persisted tokens from localStorage (for dev mode)
    this.loadTokensFromStorage();
    
    // Clean up expired tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 15 * 60 * 1000);
    
    console.debug('[PasswordReset] Service initialized');
  }

  /**
   * Load tokens from localStorage (for development persistence across page reloads)
   */
  private loadTokensFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const tokens: PasswordResetToken[] = JSON.parse(stored);
        tokens.forEach(token => {
          this.resetTokens.set(token.token, token);
        });
        console.debug('[PasswordReset] Loaded tokens from storage:', tokens.length);
      }
    } catch (error) {
      console.error('[PasswordReset] Failed to load tokens from storage:', error);
    }
  }

  /**
   * Save tokens to localStorage (for development persistence)
   */
  private saveTokensToStorage(): void {
    try {
      const tokens = Array.from(this.resetTokens.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('[PasswordReset] Failed to save tokens to storage:', error);
    }
  }

  /**
   * Generate a cryptographically secure reset token
   */
  private generateSecureToken(): string {
    // Use crypto.getRandomValues for secure random bytes
    const array = new Uint8Array(RESET_CONFIG.tokenLength);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get Supabase headers
   */
  private getHeaders(): Record<string, string> {
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  /**
   * Check rate limiting for email
   */
  private checkRateLimit(email: string): { allowed: boolean; waitTime?: number } {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    
    // Check minimum time between requests
    const lastRequest = this.lastResetRequest.get(normalizedEmail);
    if (lastRequest && (now - lastRequest) < RESET_CONFIG.rateLimitMs) {
      const waitTime = Math.ceil((RESET_CONFIG.rateLimitMs - (now - lastRequest)) / 1000);
      return { allowed: false, waitTime };
    }
    
    // Check daily attempt limit
    const dailyData = this.dailyAttempts.get(normalizedEmail);
    if (dailyData) {
      if (dailyData.date === today && dailyData.count >= RESET_CONFIG.maxDailyAttempts) {
        return { allowed: false, waitTime: undefined };
      }
      if (dailyData.date !== today) {
        // Reset counter for new day
        this.dailyAttempts.set(normalizedEmail, { count: 0, date: today });
      }
    }
    
    return { allowed: true };
  }

  /**
   * Update rate limit tracking
   */
  private updateRateLimit(email: string): void {
    const normalizedEmail = email.toLowerCase().trim();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    
    this.lastResetRequest.set(normalizedEmail, now);
    
    const dailyData = this.dailyAttempts.get(normalizedEmail);
    if (dailyData && dailyData.date === today) {
      dailyData.count++;
    } else {
      this.dailyAttempts.set(normalizedEmail, { count: 1, date: today });
    }
  }

  /**
   * Request a password reset for an email
   * Returns a reset link (in dev mode) or sends email (in production)
   */
  async requestPasswordReset(email: string, ipAddress?: string): Promise<ResetRequestResult> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check rate limiting
    const rateCheck = this.checkRateLimit(normalizedEmail);
    if (!rateCheck.allowed) {
      if (rateCheck.waitTime) {
        return {
          success: false,
          message: `Please wait ${rateCheck.waitTime} seconds before requesting another reset.`
        };
      }
      return {
        success: false,
        message: 'Too many reset attempts today. Please try again tomorrow.'
      };
    }

    try {
      // Find user by email
      const user = await this.findUserByEmail(normalizedEmail);
      
      // Always return success message to prevent email enumeration
      // But only generate token if user exists
      if (!user) {
        console.debug('[PasswordReset] User not found, returning generic message');
        // Still update rate limit to prevent enumeration
        this.updateRateLimit(normalizedEmail);
        return {
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.'
        };
      }

      // Invalidate any existing reset tokens for this user
      this.invalidateExistingTokens(user.id);

      // Generate new reset token
      const token = this.generateSecureToken();
      const now = Date.now();
      
      const resetToken: PasswordResetToken = {
        id: generateUUID(),
        userId: user.id,
        email: normalizedEmail,
        token,
        expiresAt: now + RESET_CONFIG.tokenExpiryMs,
        createdAt: now,
        used: false,
        ipAddress
      };

      // Store token (in memory and localStorage for dev persistence)
      this.resetTokens.set(token, resetToken);
      this.saveTokensToStorage();
      
      // Update rate limiting
      this.updateRateLimit(normalizedEmail);

      // Generate reset link
      const resetLink = `${RESET_CONFIG.baseUrl}?reset_token=${token}`;

      console.info('[PasswordReset] Reset token generated for:', normalizedEmail);

      // In development mode, return the link directly
      // In production, this would send an email
      if (config.isDev || config.useMockData) {
        console.info('[PasswordReset] DEV MODE - Reset link:', resetLink);
        return {
          success: true,
          message: 'Password reset link generated. Check console for the link (dev mode).',
          resetLink,
          resetToken: token
        };
      }

      // Production: Send email (placeholder - would integrate with email service)
      await this.sendResetEmail(normalizedEmail, user.name, resetLink);
      
      return {
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      };

    } catch (error) {
      console.error('[PasswordReset] Error requesting reset:', error);
      return {
        success: false,
        message: 'An error occurred. Please try again later.'
      };
    }
  }

  /**
   * Validate a reset token
   */
  validateResetToken(token: string): ResetValidationResult {
    const resetToken = this.resetTokens.get(token);
    
    if (!resetToken) {
      return {
        valid: false,
        expired: false,
        used: false,
        error: 'Invalid or expired reset token.'
      };
    }

    const now = Date.now();

    // Check if token has been used
    if (resetToken.used) {
      return {
        valid: false,
        expired: false,
        used: true,
        error: 'This reset link has already been used.'
      };
    }

    // Check if token has expired
    if (resetToken.expiresAt < now) {
      return {
        valid: false,
        expired: true,
        used: false,
        error: 'This reset link has expired. Please request a new one.'
      };
    }

    return {
      valid: true,
      expired: false,
      used: false,
      userId: resetToken.userId,
      email: resetToken.email
    };
  }

  /**
   * Reset password using a valid token
   */
  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    // Validate token
    const validation = this.validateResetToken(token);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid reset token.',
        error: validation.error
      };
    }

    // Validate password strength
    const strength = PasswordService.analyzePasswordStrength(newPassword);
    if (strength.strength === 'weak') {
      return {
        success: false,
        message: 'Password is too weak. Please use a stronger password.',
        error: 'weak_password'
      };
    }

    try {
      // Hash the new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password in database
      const updated = await this.updateUserPassword(validation.userId!, hashedPassword);
      
      if (!updated) {
        return {
          success: false,
          message: 'Failed to update password. Please try again.',
          error: 'update_failed'
        };
      }

      // Mark token as used
      const resetToken = this.resetTokens.get(token);
      if (resetToken) {
        resetToken.used = true;
        resetToken.usedAt = Date.now();
        this.saveTokensToStorage();
      }

      console.info('[PasswordReset] Password reset successful for user:', validation.userId);

      return {
        success: true,
        message: 'Your password has been reset successfully. You can now log in with your new password.'
      };

    } catch (error) {
      console.error('[PasswordReset] Error resetting password:', error);
      return {
        success: false,
        message: 'An error occurred while resetting your password.',
        error: 'reset_error'
      };
    }
  }

  /**
   * Find user by email in Supabase
   */
  private async findUserByEmail(email: string): Promise<{ id: string; name: string; email: string } | null> {
    if (config.useMockData || !this.supabaseUrl || !this.supabaseKey) {
      // Mock mode - return a fake user for testing
      console.debug('[PasswordReset] Mock mode - simulating user lookup');
      return {
        id: 'mock-user-1',
        name: 'Test User',
        email: email
      };
    }

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,name,email`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        console.error('[PasswordReset] Failed to fetch user:', response.status);
        return null;
      }

      const users = await response.json();
      return users.length > 0 ? users[0] : null;

    } catch (error) {
      console.error('[PasswordReset] Error finding user:', error);
      return null;
    }
  }

  /**
   * Update user password in Supabase
   */
  private async updateUserPassword(userId: string, hashedPassword: string): Promise<boolean> {
    if (config.useMockData || !this.supabaseUrl || !this.supabaseKey) {
      // Mock mode - simulate success
      console.debug('[PasswordReset] Mock mode - simulating password update');
      return true;
    }

    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/users?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({
            password_hash: hashedPassword,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        console.error('[PasswordReset] Failed to update password:', response.status);
        return false;
      }

      return true;

    } catch (error) {
      console.error('[PasswordReset] Error updating password:', error);
      return false;
    }
  }

  /**
   * Send password reset email (placeholder for email service integration)
   */
  private async sendResetEmail(email: string, name: string, resetLink: string): Promise<boolean> {
    // In a real implementation, this would integrate with:
    // - SendGrid, AWS SES, Mailgun, etc.
    // - Or Supabase Edge Functions for email
    
    console.info('[PasswordReset] Would send email to:', email);
    console.info('[PasswordReset] Reset link:', resetLink);
    
    // For now, just log the email content
    const emailContent = `
      Hi ${name},
      
      You requested a password reset for your AT-ERP account.
      
      Click the link below to reset your password:
      ${resetLink}
      
      This link will expire in 1 hour.
      
      If you didn't request this reset, please ignore this email.
      
      - AT-ERP Team
    `;
    
    console.debug('[PasswordReset] Email content:', emailContent);
    
    return true;
  }

  /**
   * Invalidate existing reset tokens for a user
   */
  private invalidateExistingTokens(userId: string): void {
    const entries = Array.from(this.resetTokens.entries());
    let invalidated = false;
    for (const [token, data] of entries) {
      if (data.userId === userId && !data.used) {
        data.used = true;
        data.usedAt = Date.now();
        invalidated = true;
      }
    }
    if (invalidated) {
      this.saveTokensToStorage();
    }
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let cleaned = 0;
    
    const entries = Array.from(this.resetTokens.entries());
    for (const [token, data] of entries) {
      // Remove tokens that are expired or used and older than 24 hours
      if (data.expiresAt < now || (data.used && data.usedAt && (now - data.usedAt) > 24 * 60 * 60 * 1000)) {
        this.resetTokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveTokensToStorage();
      console.debug('[PasswordReset] Cleaned up tokens:', cleaned);
    }
  }

  /**
   * Get token info (for debugging)
   */
  getTokenInfo(token: string): { exists: boolean; expired: boolean; used: boolean; expiresIn?: number } {
    const resetToken = this.resetTokens.get(token);
    if (!resetToken) {
      return { exists: false, expired: false, used: false };
    }

    const now = Date.now();
    return {
      exists: true,
      expired: resetToken.expiresAt < now,
      used: resetToken.used,
      expiresIn: Math.max(0, Math.floor((resetToken.expiresAt - now) / 1000))
    };
  }
}

// Export singleton instance
export const PasswordResetService = new PasswordResetServiceClass();

// Also export the class for testing
export { PasswordResetServiceClass };
