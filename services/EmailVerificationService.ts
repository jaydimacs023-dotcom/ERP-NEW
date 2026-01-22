import { generateUUID } from '../utils/uuid';

export interface EmailVerificationToken {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours
const STORAGE_KEY = 'AT_ERP_EMAIL_VERIFICATION_TOKENS';

// Generate a random token string
function generateToken(): string {
  return `${generateUUID()}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

export class EmailVerificationService {
  private tokens: EmailVerificationToken[] = [];

  constructor() {
    this.loadTokensFromStorage();
  }

  private loadTokensFromStorage() {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.tokens = JSON.parse(raw);
        } catch {}
      }
    }
  }

  private saveTokensToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tokens));
    }
  }

  generateToken(userId: string, email: string): EmailVerificationToken {
    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + TOKEN_EXPIRY_MS;
    const entry: EmailVerificationToken = {
      token,
      userId,
      email,
      createdAt: now,
      expiresAt,
      used: false,
    };
    this.tokens.push(entry);
    this.saveTokensToStorage();
    return entry;
  }

  validateToken(token: string): EmailVerificationToken | null {
    const entry = this.tokens.find(t => t.token === token && !t.used && t.expiresAt > Date.now());
    return entry || null;
  }

  markTokenUsed(token: string) {
    const entry = this.tokens.find(t => t.token === token);
    if (entry) {
      entry.used = true;
      this.saveTokensToStorage();
    }
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    this.tokens = this.tokens.filter(t => !t.used && t.expiresAt > now);
    this.saveTokensToStorage();
  }
}

export const emailVerificationService = new EmailVerificationService();
