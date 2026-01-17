// src/components/common/ProfileCompletionPopup.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { showToast } from '../../utils/toast';
import './ProfileCompletionPopup.css';

const ProfileCompletionPopup = ({ user, onComplete }) => {
    const [formData, setFormData] = useState({
        username: '',
        city: '',
        phone: ''
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [usernameFromSignup, setUsernameFromSignup] = useState(false);

    // Load existing profile data on mount
    useEffect(() => {
        const loadExistingProfile = async () => {
            if (!user?.id) return;

            try {
                // Check localStorage first
                const storedProfile = localStorage.getItem('petverse_profile');
                if (storedProfile) {
                    const profile = JSON.parse(storedProfile);
                    if (profile.username) {
                        setFormData(prev => ({ ...prev, username: profile.username }));
                        setUsernameFromSignup(true);
                    }
                    if (profile.city) setFormData(prev => ({ ...prev, city: profile.city }));
                    if (profile.phone) setFormData(prev => ({ ...prev, phone: profile.phone }));
                    return;
                }

                // Fetch from database
                const { data, error } = await supabase
                    .from('profiles')
                    .select('username, city, phone')
                    .eq('id', user.id)
                    .single();

                if (!error && data) {
                    if (data.username) {
                        setFormData(prev => ({ ...prev, username: data.username }));
                        setUsernameFromSignup(true);
                    }
                    if (data.city) setFormData(prev => ({ ...prev, city: data.city }));
                    if (data.phone) setFormData(prev => ({ ...prev, phone: data.phone }));
                }
            } catch (err) {
                console.error('Error loading profile:', err);
            }
        };

        loadExistingProfile();
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        }
        if (!formData.city.trim()) {
            newErrors.city = 'City is required';
        }
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^[0-9]{10}$/.test(formData.phone.replace(/\D/g, ''))) {
            newErrors.phone = 'Enter a valid 10-digit phone number';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    email: user.email,
                    username: formData.username.trim(),
                    city: formData.city.trim(),
                    phone: formData.phone.trim(),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            // Update localStorage
            const currentProfile = JSON.parse(localStorage.getItem('petverse_profile')) || {};
            localStorage.setItem('petverse_profile', JSON.stringify({
                ...currentProfile,
                username: formData.username.trim(),
                city: formData.city.trim(),
                phone: formData.phone.trim()
            }));

            showToast('Profile updated successfully!', 'success');
            onComplete();
        } catch (error) {
            console.error('Error saving profile:', error);
            showToast('Failed to save profile: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-popup-overlay">
            <div className="profile-popup-card">
                <div className="profile-popup-header">
                    <div className="profile-popup-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    </div>
                    <h2>Welcome to PetVerse!</h2>
                    <p>Just a few quick details to get you started</p>
                </div>

                <form className="profile-popup-form" onSubmit={handleSubmit}>
                    <div className="popup-form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            readOnly
                            className="readonly-input"
                        />
                    </div>

                    <div className="popup-form-group">
                        <label>Username <span>*</span></label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Your username"
                            disabled={saving || usernameFromSignup}
                            readOnly={usernameFromSignup}
                            className={`${errors.username ? 'error' : ''} ${usernameFromSignup ? 'readonly-input' : ''}`}
                        />
                        {usernameFromSignup && <span className="helper-text">Username set during signup</span>}
                        {errors.username && <span className="error-text">{errors.username}</span>}
                    </div>

                    <div className="popup-form-group">
                        <label>Phone <span>*</span></label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Your phone number"
                            disabled={saving}
                            className={errors.phone ? 'error' : ''}
                        />
                        {errors.phone && <span className="error-text">{errors.phone}</span>}
                    </div>

                    <div className="popup-form-group">
                        <label>City <span>*</span></label>
                        <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="Your city"
                            disabled={saving}
                            className={errors.city ? 'error' : ''}
                        />
                        {errors.city && <span className="error-text">{errors.city}</span>}
                    </div>

                    <button type="submit" className="popup-submit-btn" disabled={saving}>
                        {saving ? 'Saving...' : 'Get Started'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProfileCompletionPopup;
