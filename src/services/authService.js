// src/services/authService.js - Create profile AFTER OTP verification
import { supabase } from './supabase';

export const authService = {
  // Verify OTP and CREATE PROFILE
  async verifyOTP(email, token) {
    try {
      const stored = localStorage.getItem('signup_otp');
      if (!stored) {
        throw new Error('No OTP found. Please sign up again.');
      }

      const otpData = JSON.parse(stored);

      // Check expiration (10 minutes)
      if (Date.now() - otpData.timestamp > otpData.expiresIn) {
        localStorage.removeItem('signup_otp');
        throw new Error('OTP expired. Please sign up again.');
      }

      // Verify OTP matches
      if (otpData.otp !== token || otpData.email !== email) {
        throw new Error('Invalid OTP code');
      }

      console.log('✅ OTP verified - creating profile...');

      // OTP verified! NOW create the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: otpData.userId,
          username: otpData.username,
          email: otpData.email,
          created_at: new Date().toISOString()
        }]);

      if (profileError) {
        // Check if profile already exists
        if (profileError.code === '23505') { // Duplicate key error
          console.log('Profile already exists');
        } else {
          console.error('Profile creation error:', profileError);
          throw new Error('Failed to create profile');
        }
      } else {
        console.log('✅ Profile created successfully');
      }

      // Clear OTP data
      localStorage.removeItem('signup_otp');

      console.log('✅ Account fully verified and created');

      return {
        success: true,
        verified: true,
        email,
        username: otpData.username
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      throw error;
    }
  },

  // Resend OTP
  async resendOTP(email) {
    try {
      const stored = localStorage.getItem('signup_otp');
      if (!stored) {
        throw new Error('No signup session found');
      }

      const otpData = JSON.parse(stored);

      // Generate new OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

      // Update stored OTP
      otpData.otp = newOtp;
      otpData.timestamp = Date.now();
      localStorage.setItem('signup_otp', JSON.stringify(otpData));

      // Send new OTP email via MailJet
      const emailService = await import('./emailService').then(m => m.emailService);
      await emailService.sendOtpEmail(email, newOtp, otpData.username);

      console.log('📧 New OTP sent via MailJet');
      return { success: true };
    } catch (error) {
      console.error('Resend OTP error:', error);
      throw error;
    }
  },

  // Reset password - DISABLED
  async resetPassword(email) {
    throw new Error('Password reset is currently disabled. Please contact support.');
  },

  // Update password
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  },

  // Check if user is admin
  isAdmin() {
    return localStorage.getItem('adminToken') === 'petverse-admin-token-2024';
  },

  // Get admin data
  getAdminData() {
    const data = localStorage.getItem('adminData');
    return data ? JSON.parse(data) : null;
  }
};