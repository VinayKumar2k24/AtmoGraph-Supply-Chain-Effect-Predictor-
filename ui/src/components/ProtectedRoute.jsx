import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#090d16',
        color: '#94a3b8',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 28px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
        }}>
          <Loader2 size={22} className="spin" color="#06b6d4" />
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#e2e8f0', letterSpacing: '0.02em' }}>
            Authenticating Enterprise Session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
