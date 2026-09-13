import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  GitBranch,
  User,
  Mail,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import './AuthPages.css';

export default function SignupPage() {
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Validation criteria
  const isMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const isMatch = password && confirmPassword && password === confirmPassword;

  // Password strength calculation
  const strengthScore = [isMinLength, hasNumber, hasUpper, hasLower].filter(Boolean).length;
  const strengthLabel = strengthScore <= 1 ? 'Weak' : strengthScore <= 3 ? 'Moderate' : 'Strong';
  const strengthColor = strengthScore <= 1 ? '#ef4444' : strengthScore <= 3 ? '#f59e0b' : '#22c55e';

  const isPasswordValid = isMinLength && hasNumber && hasUpper && hasLower;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must meet all complexity requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreed) {
      setError('Please agree to the Terms and Privacy Policy.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await signup({
        full_name: fullName,
        email,
        password,
        organization: organization || 'Enterprise Logistics',
      });

      if (res.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during signup.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card" style={{ maxWidth: '480px' }}>
        <div className="auth-card-header">
          <Link to="/" className="auth-brand-badge" title="Back to AtmoGraph Home">
            <div className="auth-logo-box">
              <GitBranch size={20} color="#fff" strokeWidth={2.4} />
            </div>
            <span className="auth-brand-name">AtmoGraph</span>
          </Link>
          <h2 className="auth-title">Create your AtmoGraph account</h2>
          <p className="auth-subtitle">
            Sign up to begin monitoring and predicting supply chain ripple effects.
          </p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">
              Full Name *
            </label>
            <div className="form-input-wrap">
              <User size={16} className="form-input-icon" />
              <input
                id="fullName"
                type="text"
                className="form-input"
                placeholder="Marcus Vance"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email *
            </label>
            <div className="form-input-wrap">
              <Mail size={16} className="form-input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="organization">
              Company / Organization
            </label>
            <div className="form-input-wrap">
              <Building2 size={16} className="form-input-icon" />
              <input
                id="organization"
                type="text"
                className="form-input"
                placeholder="Global Freight Solutions"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password *
            </label>
            <div className="form-input-wrap">
              <Lock size={16} className="form-input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="form-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password strength bar */}
            {password && (
              <div style={{ marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Password Strength</span>
                  <span style={{ color: strengthColor, fontWeight: 700 }}>{strengthLabel}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(strengthScore / 4) * 100}%`,
                      height: '100%',
                      background: strengthColor,
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Real-time password criteria checklist */}
          <div className="password-criteria-list">
            <div className={`criteria-item ${isMinLength ? 'valid' : 'invalid'}`}>
              {isMinLength ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>At least 8 characters</span>
            </div>
            <div className={`criteria-item ${hasUpper ? 'valid' : 'invalid'}`}>
              {hasUpper ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>Uppercase letter</span>
            </div>
            <div className={`criteria-item ${hasLower ? 'valid' : 'invalid'}`}>
              {hasLower ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>Lowercase letter</span>
            </div>
            <div className={`criteria-item ${hasNumber ? 'valid' : 'invalid'}`}>
              {hasNumber ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              <span>Number (0-9)</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">
              Confirm Password *
            </label>
            <div className="form-input-wrap">
              <Lock size={16} className="form-input-icon" />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: isMatch ? '#4ade80' : '#f87171' }}>
                {isMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '4px' }}>
            <input
              type="checkbox"
              id="terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#06b6d4', cursor: 'pointer' }}
            />
            <label htmlFor="terms" style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1.4 }}>
              I agree to the Terms and Privacy Policy
            </label>
          </div>

          <button
            type="submit"
            className="btn-auth-submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-text">
          Already have an account?{' '}
          <Link to="/signin" className="auth-link">
            Sign In
          </Link>
        </div>
      </div>

      <Link to="/" className="auth-back-link">
        <ArrowLeft size={14} />
        <span>Back to Home</span>
      </Link>
    </div>
  );
}
