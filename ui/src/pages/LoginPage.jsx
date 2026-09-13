import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  GitBranch,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import './AuthPages.css';

export default function LoginPage() {
  const { login, demoLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await login(email, password, rememberMe);
      if (res.success) {
        navigate(redirectPath, { replace: true });
      } else {
        setError(res.error || 'Invalid email or password.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoAccess = async () => {
    setError('');
    setEmail('demo@atmograph.ai');
    setPassword('Password123!');
    setDemoLoading(true);

    try {
      const res = await demoLogin();
      if (res.success) {
        navigate(redirectPath, { replace: true });
      } else {
        setError(res.error || 'Demo login failed.');
      }
    } catch (err) {
      setError(err.message || 'Could not initialize demo session.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-card-header">
          <Link to="/" className="auth-brand-badge" title="Back to AtmoGraph Home">
            <div className="auth-logo-box">
              <GitBranch size={20} color="#fff" strokeWidth={2.4} />
            </div>
            <span className="auth-brand-name">AtmoGraph</span>
          </Link>
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">
            Sign in to access your supply-chain intelligence platform.
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
            <label className="form-label" htmlFor="email">
              Email
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
            <label className="form-label" htmlFor="password">
              Password
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
                autoComplete="current-password"
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
          </div>

          <div className="form-row-remember">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            className="btn-auth-submit"
            disabled={submitting || demoLoading}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">or quick evaluation</div>

        <button
          type="button"
          className="btn-demo-login"
          onClick={handleDemoAccess}
          disabled={submitting || demoLoading}
        >
          {demoLoading ? (
            <>
              <Loader2 size={15} className="spin" color="#06b6d4" />
              <span>Launching Demo Environment...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} color="#06b6d4" />
              <span>Quick Demo Access (Enterprise Admin)</span>
            </>
          )}
        </button>

        <div className="auth-footer-text">
          Don't have an account?{' '}
          <Link to="/signup" className="auth-link">
            Sign Up
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
