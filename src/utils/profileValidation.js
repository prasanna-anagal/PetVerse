// src/utils/profileValidation.js

/**
 * Checks if a user profile is complete enough to proceed.
 * Mandatory fields: username, city, phone.
 * 
 * @param {Object} profile - The user profile object from Supabase/Context
 * @returns {boolean} - True if profile is complete, false otherwise
 */
export const isProfileComplete = (profile) => {
    if (!profile) return false;

    const requiredFields = ['username', 'city', 'phone'];

    for (const field of requiredFields) {
        if (!profile[field] || profile[field].trim() === '') {
            return false;
        }
    }

    return true;
};

/**
 * Checks if a user needs to fill out basic profile info (popup).
 * This is used for the ProfileCompletionPopup component.
 * 
 * @param {Object} profile - The user profile object from Supabase/Context
 * @returns {boolean} - True if user needs to fill basic info, false otherwise
 */
export const needsBasicProfileInfo = (profile) => {
    if (!profile) return true;

    // Check if username, city, and phone are missing
    const hasUsername = profile.username && profile.username.trim() !== '';
    const hasCity = profile.city && profile.city.trim() !== '';
    const hasPhone = profile.phone && profile.phone.trim() !== '';

    return !hasUsername || !hasCity || !hasPhone;
};
