// src/contexts/AuthContext.jsx - FORCE EMAIL CONFIRMED
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { emailService } from '../services/emailService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState('en');
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                if (localStorage.getItem('supabase_logout_flag') === 'true') {
                    localStorage.removeItem('supabase_logout_flag');
                }

                let retries = 0;
                const maxRetries = 3;

                const getSessionWithRetry = async () => {
                    while (retries < maxRetries) {
                        try {
                            const { data: { session }, error } = await supabase.auth.getSession();
                            if (error) throw error;
                            return session;
                        } catch (error) {
                            retries++;
                            if (retries >= maxRetries) throw error;
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                };

                const session = await getSessionWithRetry();

                if (mounted && session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (mounted) {
                    setUser(null);
                    setProfile(null);
                }
            } catch (error) {
                if (mounted) {
                    setUser(null);
                    setProfile(null);
                }
            } finally {
                if (mounted) {
                    // Reduced from 300ms to 100ms for faster loading
                    setTimeout(() => {
                        setLoading(false);
                        setIsInitialized(true);
                    }, 100);
                }
            }
        };

        initializeAuth();

        const savedLang = localStorage.getItem('preferred_language') || 'en';
        setLanguage(savedLang);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                    localStorage.removeItem('petverse_profile');
                }

                setLoading(false);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            // Try to get from localStorage first
            const cached = localStorage.getItem('petverse_profile');
            if (cached) {
                try {
                    const profileData = JSON.parse(cached);
                    if (profileData?.id === userId) {
                        setProfile(profileData);
                    }
                } catch (e) {
                    // Invalid cache, ignore
                }
            }

            // Fetch from Supabase with timeout (CRITICAL: prevents hanging)
            const profilePromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            // Reduced timeout from 5000ms to 2500ms for faster loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2500)
            );

            const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

            if (error) throw error;

            if (data) {
                setProfile(data);
                localStorage.setItem('petverse_profile', JSON.stringify(data));
            }
        } catch (error) {
            console.warn('Profile fetch warning:', error.message);
            // Don't throw, just continue without profile
        }
    };

    const login = async (email, password) => {
        try {
            const ADMIN_CREDENTIALS = {
                email: "admin@petverse.com",
                password: "admin123"
            };

            if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
                localStorage.setItem('adminToken', 'petverse-admin-token-2024');
                localStorage.setItem('adminData', JSON.stringify({
                    email: ADMIN_CREDENTIALS.email,
                    name: "PetVerse Administrator",
                    role: "super_admin"
                }));

                const mockAdminUser = {
                    id: 'admin-001',
                    email: ADMIN_CREDENTIALS.email,
                    user_metadata: { role: 'admin', is_admin: true, name: 'PetVerse Administrator' }
                };

                setUser(mockAdminUser);
                return { success: true, isAdmin: true, user: mockAdminUser };
            }

            // PROFILES TABLE ONLY: Check if email exists
            console.log('🔐 Checking profiles table for email:', email);

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (profileError) {
                console.error('Profile query error:', profileError);
                throw new Error('Login failed');
            }

            // CRITICAL: If email NOT in profiles, fail immediately
            if (!profileData) {
                console.log('❌ Email NOT found in profiles table');
                throw new Error('Email not registered. Please sign up first.');
            }

            console.log('✅ Email found in profiles table');

            // Only NOW verify password with Supabase auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                console.error('Password verification failed:', authError);
                throw new Error('Invalid email or password');
            }

            console.log('✅ Password verified');

            // Set user from auth data
            if (authData.user) {
                setUser(authData.user);
                setProfile(profileData);
                localStorage.setItem('petverse_profile', JSON.stringify(profileData));
            }

            return { success: true, isAdmin: false, user: authData.user };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const signup = async (email, password, metadata) => {
        try {
            console.log('🚀 Signup started');

            if (email === "admin@petverse.com") {
                throw new Error("This email cannot be used for registration");
            }

            const username = metadata?.username || metadata;

            // ONLY check profiles table - ignore Supabase auth.users
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('username, email')
                .or(`username.eq.${username},email.eq.${email}`)
                .maybeSingle();

            if (existingUser) {
                if (existingUser.email === email) {
                    throw new Error("EMAIL_TAKEN");
                }
                if (existingUser.username === username) {
                    throw new Error("USERNAME_TAKEN");
                }
            }

            // Sign up - may fail if email exists in auth.users, but we'll handle that
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        email_confirmed: true
                    },
                    emailRedirectTo: undefined
                }
            });

            // If signup fails because user exists in auth but not profiles, ignore error
            if (error) {
                // Check if it's "user already exists" error
                if (error.message?.includes('already registered') ||
                    error.message?.includes('already exists') ||
                    error.status === 422) {
                    // Email exists in auth.users but not in profiles - this is OK
                    // We'll create the profile anyway with a new signup
                    console.log('⚠️ Email in auth.users but not profiles - proceeding anyway');
                } else {
                    // Real error - throw it
                    console.error('Supabase signup error:', error);
                    throw error;
                }
            }

            console.log('✅ Account prepared for verification');

            // DON'T create profile yet - only after OTP verification
            let userId = data?.user?.id;

            // If user already existed in auth, get their ID
            if (!userId && error) {
                try {
                    const { data: signInData } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });
                    userId = signInData?.user?.id;
                } catch (e) {
                    console.error('Could not get user ID:', e);
                }
            }

            if (!userId) {
                throw new Error('Failed to create account. Please try again.');
            }

            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            // CRITICAL: Sign out user immediately - they must verify OTP first
            await supabase.auth.signOut();
            console.log('🚪 User signed out - must verify OTP before login');

            // Store signup data for profile creation AFTER OTP verification
            const signupData = {
                otp,
                email,
                password,
                username,
                userId,
                timestamp: Date.now(),
                expiresIn: 10 * 60 * 1000,
                verified: false // Mark as not verified
            };
            localStorage.setItem('signup_otp', JSON.stringify(signupData));
            console.log('🔐 OTP stored - profile will be created after verification');

            // Send OTP email (non-blocking)
            setTimeout(async () => {
                try {
                    await emailService.sendOtpEmail(email, otp, username);
                    console.log('📧 MailJet OTP sent');
                } catch (err) {
                    console.error('Email error:', err);
                }
            }, 100);

            console.log('✅ Signup complete');
            return {
                success: true,
                data,
                message: 'Account created! Check your email for verification code.'
            };
        } catch (error) {
            console.error('❌ Signup error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
            setUser(null);
            setProfile(null);
            supabase.auth.signOut().catch(() => { });
            localStorage.setItem('supabase_logout_flag', 'true');
            window.location.href = '/';
        } catch (error) {
            localStorage.clear();
            window.location.href = '/';
        }
    };

    const updateLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('preferred_language', lang);
    };

    const waitForAuth = async () => {
        if (!loading && isInitialized) return true;
        return new Promise((resolve) => {
            const check = () => {
                if (!loading && isInitialized) {
                    resolve(true);
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    };

    const value = {
        user,
        profile,
        loading,
        language,
        setLanguage: updateLanguage,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isAdmin: !!localStorage.getItem('adminToken'),
        waitForAuth, // Add this to prevent infinite loading
        isInitialized // Add this to check if auth is ready
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
