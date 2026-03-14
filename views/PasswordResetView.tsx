/**
 * PasswordResetView - Password Reset UI for AT-ERP
 * 
 * Two modes:
 * 1. Request Reset - Enter email to receive reset link
 * 2. Reset Password - Enter new password (when accessed with reset token)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Lock, ArrowLeft, AlertCircle, CheckCircle, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { PasswordResetService } from '../services/PasswordResetService';
import { PasswordService } from '../services/PasswordService';

interface PasswordResetViewProps {
  onBackToLogin: () => void;
  resetToken?: string | null;
}

const PasswordResetView: React.FC<PasswordResetViewProps> = ({ onBackToLogin, resetToken }) => {
  // Request Reset State
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  
  // Reset Password State (when token is present)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  
  // Token validation state
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  
  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Password strength analysis
  const passwordStrength = useMemo(() => {
    if (!newPassword) return null;
    return PasswordService.analyzePasswordStrength(newPassword);
  }, [newPassword]);

  const strengthColors: Record<string, string> = {
    weak: 'bg-red-500',
    fair: 'bg-amber-500',
    good: 'bg-emerald-500',
    strong: 'bg-orange-500',
  };

  const strengthLabels: Record<string, string> = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
  };

  // Validate token on mount if present
  useEffect(() => {
    if (resetToken) {
      const validation = PasswordResetService.validateResetToken(resetToken);
      setTokenValid(validation.valid);
      if (!validation.valid) {
        setTokenError(validation.error || 'Invalid reset token');
      }
    }
  }, [resetToken]);

  // Handle Request Reset Form
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const result = await PasswordResetService.requestPasswordReset(email);
      
      if (result.success) {
        setRequestSent(true);
        setMessage(result.message);
        // In dev mode, show the reset link
        if (result.resetLink) {
          setResetLink(result.resetLink);
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Password reset request error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Form
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate password strength
    if (passwordStrength && passwordStrength.strength === 'weak') {
      setError('Password is too weak. Please use a stronger password.');
      return;
    }

    setLoading(true);

    try {
      const result = await PasswordResetService.resetPassword(resetToken!, newPassword);
      
      if (result.success) {
        setResetComplete(true);
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Render Request Reset Form
  const renderRequestForm = () => (
    <form onSubmit={handleRequestReset} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-500" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="you@example.com"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            <span>Sending...</span>
          </div>
        ) : (
          'Send Reset Link'
        )}
      </button>
    </form>
  );

  // Render Request Sent Confirmation
  const renderRequestSent = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-emerald-400" />
      </div>
      <h3 className="text-xl font-semibold text-white">Check Your Email</h3>
      <p className="text-slate-400">
        {message}
      </p>
      
      {/* Dev mode: Show reset link directly */}
      {resetLink && (
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-amber-400 text-sm font-medium mb-2">
            ðŸ”§ Development Mode - Reset Link:
          </p>
          <a
            href={resetLink}
            className="text-orange-400 hover:text-orange-300 text-sm break-all underline"
            onClick={(e) => {
              e.preventDefault();
              // Extract token and reload with it
              const url = new URL(resetLink);
              const token = url.searchParams.get('reset_token');
              if (token) {
                window.location.href = `?reset_token=${token}`;
              }
            }}
          >
            Click here to reset your password
          </a>
        </div>
      )}

      <button
        onClick={() => {
          setRequestSent(false);
          setEmail('');
          setResetLink(null);
        }}
        className="text-orange-400 hover:text-orange-300 text-sm"
      >
        Send another reset link
      </button>
    </div>
  );

  // Render Reset Password Form (when token is valid)
  const renderResetForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-5">
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400 mb-2">
          New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
          <input
            id="newPassword"
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="block w-full pl-10 pr-12 py-2.5 border border-gray-600 rounded bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="Enter new password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-400"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        
        {/* Password Strength Indicator */}
        {passwordStrength && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1">
              {['weak', 'fair', 'good', 'strong'].map((level, idx) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    idx <= ['weak', 'fair', 'good', 'strong'].indexOf(passwordStrength.strength)
                      ? strengthColors[passwordStrength.strength]
                      : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={`${
                passwordStrength.strength === 'weak' ? 'text-red-400' :
                passwordStrength.strength === 'fair' ? 'text-amber-400' :
                passwordStrength.strength === 'good' ? 'text-emerald-400' :
                'text-orange-400'
              }`}>
                {strengthLabels[passwordStrength.strength]} ({passwordStrength.score}/7)
              </span>
              {passwordStrength.feedback.length > 0 && (
                <span className="text-gray-500">{passwordStrength.feedback[0]}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-2">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ShieldCheck className="h-5 w-5 text-gray-500" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-600 rounded bg-gray-800/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            placeholder="Confirm new password"
          />
        </div>
        {confirmPassword && newPassword !== confirmPassword && (
          <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
        )}
        {confirmPassword && newPassword === confirmPassword && (
          <p className="mt-1 text-xs text-emerald-400">Passwords match âœ“</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || passwordStrength?.strength === 'weak'}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            <span>Resetting...</span>
          </div>
        ) : (
          'Reset Password'
        )}
      </button>
    </form>
  );

  // Render Reset Complete
  const renderResetComplete = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-emerald-400" />
      </div>
      <h3 className="text-xl font-semibold text-white">Password Reset Complete!</h3>
      <p className="text-gray-400">
        {message}
      </p>
      <button
        onClick={onBackToLogin}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all"
      >
        Back to Login
      </button>
    </div>
  );

  // Render Invalid Token
  const renderInvalidToken = () => (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <h3 className="text-xl font-semibold text-white">Invalid or Expired Link</h3>
      <p className="text-gray-400">
        {tokenError}
      </p>
      <button
        onClick={() => {
          // Clear the URL parameter and go back to request form
          window.history.replaceState({}, '', window.location.pathname);
          window.location.reload();
        }}
        className="text-orange-400 hover:text-orange-300 text-sm"
      >
        Request a new reset link
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-900 p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo/Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-500 rounded flex items-center justify-center shadow-lg mb-4">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {resetToken ? 'Reset Your Password' : 'Forgot Password?'}
          </h2>
          <p className="text-gray-400 mt-2">
            {resetToken
              ? 'Enter your new password below.'
              : "No worries! Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-md shadow-lg border border-gray-800/50 p-6">
          {resetToken ? (
            // Token present - show reset form or error
            tokenValid === null ? (
              // Loading token validation
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : tokenValid ? (
              // Valid token - show reset form or completion
              resetComplete ? renderResetComplete() : renderResetForm()
            ) : (
              // Invalid token
              renderInvalidToken()
            )
          ) : (
            // No token - show request form or sent confirmation
            requestSent ? renderRequestSent() : renderRequestForm()
          )}
        </div>

        {/* Back to Login Link */}
        {!resetComplete && (
          <div className="text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordResetView;

