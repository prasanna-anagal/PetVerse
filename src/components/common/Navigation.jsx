import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserIcon, LogoutIcon, MenuIcon, CloseIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

const Navigation = () => {
  const { user, signOut, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // State to track if logo image fails
  const [logoError, setLogoError] = useState(false);

  const dropdownRef = useRef(null);

  // Check for saved theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      const logoutFunc = signOut || logout;
      if (logoutFunc) await logoutFunc();
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      setShowDropdown(false);
      navigate('/login');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';

  return (
    <nav className="navbar">
      <div className="nav-container">

        {/* LOGO SECTION */}
        <Link to="/" className="nav-logo">
          {!logoError ? (
            <img
              src="/images/Logo.jpg"
              alt="PetVerse"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="logo-text">PetVerse</span>
          )}
        </Link>

        {/* NAV LINKS */}
        <ul className={`nav-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <li><Link to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Home</Link></li>
          <li><Link to="/Adopt" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Adopt</Link></li>
          <li><Link to="/volunteer" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Volunteer</Link></li>
          <li><Link to="/donate" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Donate</Link></li>
          <li><Link to="/community" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Community</Link></li>
          <li><Link to="/lost-found" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Lost & Found</Link></li>
          {user && (
            <li><Link to="/myadoptions" className="nav-link" onClick={() => setMobileMenuOpen(false)}>My Adoptions</Link></li>
          )}
        </ul>

        {/* RIGHT SIDE ACTIONS - Order: Dark Mode Toggle → Profile → Logout (when logged in) */}
        <div className="nav-actions">

          {user ? (
            <>
              {/* 1. Dark Mode Toggle */}
              <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />

              {/* 2. Profile Icon - Direct Link to Profile */}
              <Link to="/profile" className="nav-action-btn nav-profile-btn" title="Profile">
                {(() => {
                  // Check localStorage for avatar first (from profile uploads)
                  const savedProfile = localStorage.getItem('petverse_profile');
                  let avatarUrl = null;
                  if (savedProfile) {
                    try {
                      const profileData = JSON.parse(savedProfile);
                      avatarUrl = profileData?.avatar_url;
                    } catch (e) { }
                  }
                  // Fall back to user_metadata avatar
                  if (!avatarUrl) {
                    avatarUrl = user?.user_metadata?.avatar_url;
                  }

                  if (avatarUrl) {
                    return (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="profile-avatar"
                      />
                    );
                  }
                  return <UserIcon size={20} />;
                })()}
              </Link>

              {/* 3. Logout Button */}
              <button onClick={handleLogout} className="nav-action-btn nav-logout-btn" title="Logout">
                <LogoutIcon size={18} />
                <span className="btn-label">Logout</span>
              </button>
            </>
          ) : (
            /* Dark Mode and Login when logged out */
            <>
              <ThemeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
              <Link to="/login" className="nav-login-btn">
                Login
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>

      </div>
    </nav>
  );
};

export default Navigation;