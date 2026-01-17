import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { showToast, showLoginSuccess } from '../../utils/toast';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // Clear error on input change
  };

  // LOGIN HANDLER with specific error messages
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Try to login
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Fetch username from profiles table
        let displayName = formData.email.split('@')[0]; // Fallback to email prefix

        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('email', formData.email)
            .single();

          if (profileData?.username) {
            displayName = profileData.username;
          }
        } catch (err) {
          console.log('Could not fetch username, using email prefix');
        }

        await showLoginSuccess(displayName, result.isAdmin);

        if (result.isAdmin) {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      // Show the ACTUAL error message from AuthContext
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-new">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="4" r="2" />
            <circle cx="18" cy="8" r="2" />
            <circle cx="4" cy="8" r="2" />
            <path d="M12 12c-2-2-5.5-2.5-6 2-0.5 4.5 4 6 6 8 2-2 6.5-3.5 6-8-0.5-4.5-4-4-6-2z" />
          </svg>
          <h1>PetVerse</h1>
        </div>

        <h2 className="login-title">Welcome Back</h2>
        <p className="login-subtitle">Sign in to continue your journey</p>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="login-form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
              className={error && error.includes('Email') ? 'input-error' : ''}
            />
          </div>

          <div className="login-form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                className={error && error.includes('password') ? 'input-error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account?</p>
          <Link to="/signup" className="signup-link">Create Account</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
