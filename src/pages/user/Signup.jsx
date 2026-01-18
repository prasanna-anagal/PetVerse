import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { showToast } from '../../utils/toast';
import './Login.css';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Username validation states
  const [usernameError, setUsernameError] = useState('');
  const [suggestedUsernames, setSuggestedUsernames] = useState([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameVerified, setUsernameVerified] = useState(false);

  // OTP Modal States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');

  // Email validation states
  const [emailError, setEmailError] = useState('');

  const { signup, login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Don't auto-redirect - let OTP flow complete first
  // React.useEffect(() => {
  //   if (isAuthenticated) navigate('/');
  // }, [isAuthenticated, navigate]);

  // Prevent body scrolling when OTP modal is open
  React.useEffect(() => {
    if (showOTPModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    // Cleanup on unmount
    return () => document.body.classList.remove('modal-open');
  }, [showOTPModal]);

  // Handle username change - convert to lowercase
  const handleUsernameChange = (e) => {
    const lowercaseUsername = e.target.value.toLowerCase().replace(/\s/g, ''); // No spaces, lowercase only
    setUsername(lowercaseUsername);
    setUsernameError('');
    setSuggestedUsernames([]);
    setUsernameVerified(false); // Reset verification when username changes
  };

  // Real-time username validation on blur
  const handleUsernameBlur = async () => {
    if (!username.trim()) return;

    setCheckingUsername(true);
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        setUsernameError('This username is already taken');
        setUsernameVerified(false);
        // Generate suggestions
        const suggestions = [];
        for (let i = 1; i <= 3; i++) {
          suggestions.push(`${username}${i}`);
        }
        suggestions.push(`${username}${Math.floor(Math.random() * 99) + 10}`);
        setSuggestedUsernames(suggestions);
      } else {
        setUsernameVerified(true); // Username is available!
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Select suggested username
  const selectSuggestedUsername = (suggested) => {
    setUsername(suggested);
    setUsernameError('');
    setSuggestedUsernames([]);
  };

  // Handle OTP change
  const handleOTPChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setOtp(value);
  };

  // Handle email change
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setEmailError('');
  };

  // Check if email already exists
  const checkEmailExists = async () => {
    if (!email.trim()) return;

    try {
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingEmail) {
        setEmailError('User with this email already exists. Please login.');
      }
    } catch (error) {
      console.error('Error checking email:', error);
    }
  };

  // Handle Signup
  const handleSignup = async (e) => {
    e.preventDefault();

    if (usernameError) {
      showToast('Please choose a different username', 'error');
      return;
    }

    if (emailError) {
      showToast('Please use a different email or login', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);

    try {
      // Check email exists first
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingEmail) {
        setEmailError('User with this email already exists. Please login.');
        showToast('Email already registered. Redirecting to login...', 'error');
        setTimeout(() => navigate('/login'), 2000);
        setLoading(false);
        return;
      }

      // Check username availability (lowercase)
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        setUsernameError('This username is already taken');
        const suggestions = [];
        for (let i = 1; i <= 3; i++) {
          suggestions.push(`${username.toLowerCase()}${i}`);
        }
        suggestions.push(`${username.toLowerCase()}${Math.floor(Math.random() * 99) + 10}`);
        setSuggestedUsernames(suggestions);
        setLoading(false);
        return;
      }

      const result = await signup(email, password, { username: username.trim().toLowerCase() });

      if (result.success) {
        setOtpEmail(email);
        setShowOTPModal(true);
        showToast('Account created! Check your email for verification.', 'success');
      }
    } catch (error) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('User already registered')) {
        showToast('Email already registered. Please login.', 'error');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        showToast('Signup failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verification
  const handleOTPVerification = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.verifyOTP(otpEmail, otp);
      if (result.success) {
        // Close OTP modal
        setShowOTPModal(false);

        // Get stored credentials for auto-login
        const storedData = localStorage.getItem('signup_otp');
        if (storedData) {
          const { email, password } = JSON.parse(storedData);

          // Auto-login the user (first-time only)
          try {
            await login(email, password);
            showToast('Account verified! Welcome to PetVerse!', 'success');
            // Redirect to home page
            setTimeout(() => {
              navigate('/');
            }, 1500);
          } catch (loginError) {
            // If auto-login fails, redirect to login page
            showToast('Account verified! Please login with your credentials.', 'success');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        } else {
          // Fallback: redirect to login
          showToast('Account verified! Please login with your credentials.', 'success');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      }
    } catch (error) {
      showToast(error.message || 'Invalid OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    try {
      await authService.resendOTP(otpEmail);
      showToast('New code sent!', 'success');
    } catch (error) {
      showToast('Failed to resend.', 'error');
    }
  };

  return (
    <div className="login-page-new">
      <div className="login-card signup-card">
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

        <h2 className="login-title">Create Account</h2>
        <p className="login-subtitle">Join our community of pet lovers</p>

        {/* Username Error */}
        {usernameError && (
          <div className="login-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{usernameError}</span>
          </div>
        )}

        {/* Suggested Usernames */}
        {suggestedUsernames.length > 0 && (
          <div className="username-suggestions">
            <span>Try: </span>
            {suggestedUsernames.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                className="suggestion-btn"
                onClick={() => selectSuggestedUsername(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="login-form-group">
            <label>Username</label>
            <div className="username-input-row">
              <input
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={handleUsernameChange}
                onBlur={handleUsernameBlur}
                required
                disabled={loading}
                className={usernameError ? 'input-error' : ''}
              />
              <button
                type="button"
                className="check-username-btn"
                onClick={handleUsernameBlur}
                disabled={!username.trim() || checkingUsername || loading}
              >
                {checkingUsername ? 'Checking...' : 'Check'}
              </button>
            </div>
            {checkingUsername && <span className="checking-text">Verifying username availability...</span>}
            {usernameVerified && !usernameError && (
              <span className="username-available">✓ Username available!</span>
            )}
          </div>

          <div className="login-form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={handleEmailChange}
              onBlur={checkEmailExists}
              required
              disabled={loading}
              className={emailError ? 'input-error' : ''}
            />
            {emailError && (
              <span className="login-error" style={{ marginTop: '8px', display: 'block', fontSize: '0.85rem' }}>
                {emailError}
              </span>
            )}
          </div>

          <div className="login-form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
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

          <div className="login-form-group">
            <label>Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? <span className="loading-spinner"></span> : 'Create Account'}
          </button>
        </form>

        <div className="login-footer">
          <p>Already have an account?</p>
          <Link to="/login" className="signup-link">Sign In</Link>
        </div>
      </div>

      {/* OTP Modal */}
      {showOTPModal && (
        <div className="otp-modal-overlay">
          <div className="otp-modal">
            <h3>Verify Your Email</h3>
            <p>Enter the 6-digit code sent to {otpEmail}</p>
            <form onSubmit={handleOTPVerification}>
              <input
                type="text"
                maxLength="6"
                value={otp}
                onChange={handleOTPChange}
                placeholder="000000"
                className="otp-input"
              />
              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
            <button className="resend-btn" onClick={handleResendOTP}>
              Resend Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signup;
