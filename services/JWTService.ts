/**
 * JWTService - JSON Web Token Implementation for AT-ERP
 * 
 * Implements proper JWT authentication with:
 * - HMAC-SHA256 signature verification (HS256)
 * - Access tokens (short-lived, 15 minutes)
 * - Refresh tokens (longer-lived, 7 days)
 * - Token rotation on refresh
 * - Secure payload encoding
 * 
 * Note: For production with Supabase, you would typically use Supabase Auth.
 * This implementation provides a self-contained JWT solution for the ERP.
 */

import { User } from '../types';
import { generateUUID } from '../utils/uuid';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface JWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface JWTPayload {
  // Standard JWT claims
  iss: string;           // Issuer
  sub: string;           // Subject (user ID)
  aud: string;           // Audience
  exp: number;           // Expiration time (Unix timestamp)
  iat: number;           // Issued at (Unix timestamp)
  nbf: number;           // Not before (Unix timestamp)
  jti: string;           // JWT ID (unique identifier)
  
  // Custom claims
  email: string;
  name: string;
  role: string;
  orgId: string;
  studentId?: string;
  trainerId?: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;      // Access token expiry in seconds
  refreshExpiresIn: number; // Refresh token expiry in seconds
  tokenType: 'Bearer';
}

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  payload?: JWTPayload;
  error?: string;
}

export interface RefreshResult {
  success: boolean;
  tokens?: TokenPair;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_CONFIG = {
  // Secret key for signing tokens
  // In production, this should come from environment variables
  secretKey: 'AT-ERP-JWT-SECRET-KEY-2024-CHANGE-IN-PRODUCTION',
  
  // Token lifetimes
  accessTokenExpiry: 15 * 60,           // 15 minutes in seconds
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days in seconds
  
  // Token metadata
  issuer: 'AT-ERP',
  audience: 'AT-ERP-Client',
};

// ============================================================================
// CRYPTO UTILITIES (Browser-compatible HMAC-SHA256)
// ============================================================================

/**
 * Base64URL encode (JWT-safe encoding)
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return atob(base64);
}

/**
 * Convert string to Uint8Array
 */
function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA256 signature using Web Crypto API
 */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to base64url
  const signatureArray = new Uint8Array(signature);
  const signatureString = Array.from(signatureArray).map(b => String.fromCharCode(b)).join('');
  return base64UrlEncode(signatureString);
}

/**
 * Timing-safe comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// JWT SERVICE CLASS
// ============================================================================

class JWTServiceClass {
  private revokedTokens: Set<string> = new Set();
  private refreshTokenStore: Map<string, { userId: string; expiresAt: number }> = new Map();

  /**
   * Create a JWT token
   */
  private async createToken(payload: JWTPayload): Promise<string> {
    const header: JWTHeader = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const signature = await hmacSha256(signatureInput, JWT_CONFIG.secretKey);
    
    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<TokenValidationResult> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, expired: false, error: 'Invalid token format' };
      }

      const [headerEncoded, payloadEncoded, signature] = parts;

      // Verify signature
      const signatureInput = `${headerEncoded}.${payloadEncoded}`;
      const expectedSignature = await hmacSha256(signatureInput, JWT_CONFIG.secretKey);
      
      if (!timingSafeEqual(signature, expectedSignature)) {
        return { valid: false, expired: false, error: 'Invalid signature' };
      }

      // Decode payload
      const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadEncoded));
      
      // Check if token is revoked
      if (this.revokedTokens.has(payload.jti)) {
        return { valid: false, expired: false, error: 'Token has been revoked' };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { valid: false, expired: true, error: 'Token has expired' };
      }

      // Check not before
      if (payload.nbf > now) {
        return { valid: false, expired: false, error: 'Token not yet valid' };
      }

      // Check issuer and audience
      if (payload.iss !== JWT_CONFIG.issuer || payload.aud !== JWT_CONFIG.audience) {
        return { valid: false, expired: false, error: 'Invalid issuer or audience' };
      }

      return { valid: true, expired: false, payload };
    } catch (error) {
      console.error('[JWT] Token verification error:', error);
      return { valid: false, expired: false, error: 'Token verification failed' };
    }
  }

  /**
   * Generate access and refresh token pair for a user
   */
  async generateTokenPair(user: User): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenId = generateUUID();
    const refreshTokenId = generateUUID();

    // Create access token payload
    const accessPayload: JWTPayload = {
      iss: JWT_CONFIG.issuer,
      sub: user.id,
      aud: JWT_CONFIG.audience,
      exp: now + JWT_CONFIG.accessTokenExpiry,
      iat: now,
      nbf: now,
      jti: accessTokenId,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      studentId: user.studentId,
      trainerId: user.trainerId,
      type: 'access'
    };

    // Create refresh token payload
    const refreshPayload: JWTPayload = {
      iss: JWT_CONFIG.issuer,
      sub: user.id,
      aud: JWT_CONFIG.audience,
      exp: now + JWT_CONFIG.refreshTokenExpiry,
      iat: now,
      nbf: now,
      jti: refreshTokenId,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      studentId: user.studentId,
      trainerId: user.trainerId,
      type: 'refresh'
    };

    const accessToken = await this.createToken(accessPayload);
    const refreshToken = await this.createToken(refreshPayload);

    // Store refresh token for validation
    this.refreshTokenStore.set(refreshTokenId, {
      userId: user.id,
      expiresAt: now + JWT_CONFIG.refreshTokenExpiry
    });

    console.debug('[JWT] Token pair generated for user:', user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      refreshExpiresIn: JWT_CONFIG.refreshTokenExpiry,
      tokenType: 'Bearer'
    };
  }

  /**
   * Refresh tokens using a valid refresh token
   * Implements token rotation - old refresh token is invalidated
   */
  async refreshTokens(refreshToken: string): Promise<RefreshResult> {
    // Verify the refresh token
    const validation = await this.verifyToken(refreshToken);
    
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.error || 'Invalid refresh token' 
      };
    }

    const payload = validation.payload!;

    // Verify it's a refresh token
    if (payload.type !== 'refresh') {
      return { success: false, error: 'Not a refresh token' };
    }

    // Check if refresh token exists in store
    const storedToken = this.refreshTokenStore.get(payload.jti);
    if (!storedToken) {
      return { success: false, error: 'Refresh token not found or already used' };
    }

    // Revoke old refresh token (token rotation)
    this.refreshTokenStore.delete(payload.jti);
    this.revokedTokens.add(payload.jti);

    // Generate new token pair
    const user: User = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as User['role'],
      orgId: payload.orgId,
      studentId: payload.studentId,
      trainerId: payload.trainerId
    };

    const tokens = await this.generateTokenPair(user);

    console.debug('[JWT] Tokens refreshed for user:', user.id);

    return { success: true, tokens };
  }

  /**
   * Revoke a token (logout, security breach, etc.)
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const validation = await this.verifyToken(token);
      if (validation.payload) {
        this.revokedTokens.add(validation.payload.jti);
        
        // If it's a refresh token, remove from store
        if (validation.payload.type === 'refresh') {
          this.refreshTokenStore.delete(validation.payload.jti);
        }
        
        console.debug('[JWT] Token revoked:', validation.payload.jti);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Revoke all tokens for a user (password change, account compromise)
   */
  revokeAllUserTokens(userId: string): void {
    // Mark all refresh tokens for this user as revoked
    const entries = Array.from(this.refreshTokenStore.entries());
    for (const [tokenId, data] of entries) {
      if (data.userId === userId) {
        this.refreshTokenStore.delete(tokenId);
        this.revokedTokens.add(tokenId);
      }
    }
    console.debug('[JWT] All tokens revoked for user:', userId);
  }

  /**
   * Extract user from access token
   */
  async extractUser(accessToken: string): Promise<User | null> {
    const validation = await this.verifyToken(accessToken);
    
    if (!validation.valid || !validation.payload) {
      return null;
    }

    if (validation.payload.type !== 'access') {
      return null;
    }

    return {
      id: validation.payload.sub,
      email: validation.payload.email,
      name: validation.payload.name,
      role: validation.payload.role as User['role'],
      orgId: validation.payload.orgId,
      studentId: validation.payload.studentId,
      trainerId: validation.payload.trainerId
    };
  }

  /**
   * Check if a token is about to expire (within threshold)
   */
  async isTokenExpiringSoon(token: string, thresholdSeconds: number = 60): Promise<boolean> {
    const validation = await this.verifyToken(token);
    if (!validation.valid || !validation.payload) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return (validation.payload.exp - now) <= thresholdSeconds;
  }

  /**
   * Decode token without verification (for debugging/display)
   * WARNING: Do not use this for security decisions
   */
  decodeWithoutVerification(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Clean up expired tokens from memory
   * Should be called periodically
   */
  cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    let cleaned = 0;

    const entries = Array.from(this.refreshTokenStore.entries());
    for (const [tokenId, data] of entries) {
      if (data.expiresAt < now) {
        this.refreshTokenStore.delete(tokenId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug('[JWT] Cleaned up expired tokens:', cleaned);
    }
  }

  /**
   * Get token statistics (for debugging/monitoring)
   */
  getStats(): { activeRefreshTokens: number; revokedTokens: number } {
    return {
      activeRefreshTokens: this.refreshTokenStore.size,
      revokedTokens: this.revokedTokens.size
    };
  }
}

// Export singleton instance
export const JWTService = new JWTServiceClass();

// Also export the class for testing
export { JWTServiceClass };
