/**
 * OTP (One-Time Password) Service
 * Handles OTP generation, validation, and storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import EmailService from './EmailService';

class OTPService {
  // OTP configuration
  static OTP_LENGTH = 6;
  static OTP_EXPIRY_MINUTES = 5;
  static STORAGE_KEY = 'otp_data';

  /**
   * Generate a random OTP code
   */
  static generateOTP() {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    // OTP generated successfully
    return otp;
  }

  /**
   * Save OTP data to storage
   */
  static async saveOTP(email, otp, type = 'signup') {
    try {
      const otpData = {
        email: email.toLowerCase(),
        otp: otp,
        type: type, // 'signup' or 'signin'
        createdAt: new Date().toISOString(),
        attempts: 0,
        verified: false
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(otpData));
      console.log('💾 OTP saved for:', email);
      return true;
    } catch (error) {
      console.error('❌ Error saving OTP:', error);
      return false;
    }
  }

  /**
   * Get OTP data from storage
   */
  static async getOTP() {
    try {
      const otpData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (otpData) {
        return JSON.parse(otpData);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting OTP:', error);
      return null;
    }
  }

  /**
   * Clear OTP data from storage
   */
  static async clearOTP() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ OTP data cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing OTP:', error);
      return false;
    }
  }

  /**
   * Verify OTP code
   */
  static async verifyOTP(email, inputOTP) {
    try {
      const otpData = await this.getOTP();
      
      if (!otpData) {
        console.log('❌ No OTP data found');
        return { success: false, message: 'No OTP found. Please request a new one.' };
      }

      // Check if email matches
      if (otpData.email !== email.toLowerCase()) {
        console.log('❌ Email mismatch');
        return { success: false, message: 'Email mismatch. Please request a new OTP.' };
      }

      // Check if already verified
      if (otpData.verified) {
        console.log('❌ OTP already verified');
        return { success: false, message: 'OTP already verified.' };
      }

      // Check attempts limit
      if (otpData.attempts >= 3) {
        console.log('❌ Too many attempts');
        return { success: false, message: 'Too many attempts. Please request a new OTP.' };
      }

      // Check if OTP is expired
      const now = new Date();
      const createdAt = new Date(otpData.createdAt);
      const expiryTime = new Date(createdAt.getTime() + (this.OTP_EXPIRY_MINUTES * 60 * 1000));
      
      if (now > expiryTime) {
        console.log('❌ OTP expired');
        await this.clearOTP();
        return { success: false, message: 'OTP expired. Please request a new one.' };
      }

      // Check if OTP matches
      if (otpData.otp === inputOTP) {
        // Mark as verified
        otpData.verified = true;
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(otpData));
        
        console.log('✅ OTP verified successfully');
        return { success: true, message: 'OTP verified successfully!' };
      } else {
        // Increment attempts
        otpData.attempts += 1;
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(otpData));
        
        const remainingAttempts = 3 - otpData.attempts;
        console.log('❌ Invalid OTP. Attempts remaining:', remainingAttempts);
        
        return { 
          success: false, 
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.` 
        };
      }
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      return { success: false, message: 'Error verifying OTP. Please try again.' };
    }
  }

  /**
   * Check if OTP is valid and not expired
   */
  static async isOTPValid(email) {
    try {
      const otpData = await this.getOTP();
      
      if (!otpData || otpData.email !== email.toLowerCase()) {
        return false;
      }

      if (otpData.verified) {
        return true;
      }

      // Check if expired
      const now = new Date();
      const createdAt = new Date(otpData.createdAt);
      const expiryTime = new Date(createdAt.getTime() + (this.OTP_EXPIRY_MINUTES * 60 * 1000));
      
      if (now > expiryTime) {
        await this.clearOTP();
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error checking OTP validity:', error);
      return false;
    }
  }

  /**
   * Get remaining time for OTP expiry
   */
  static async getRemainingTime(email) {
    try {
      const otpData = await this.getOTP();
      
      if (!otpData || otpData.email !== email.toLowerCase()) {
        return 0;
      }

      const now = new Date();
      const createdAt = new Date(otpData.createdAt);
      const expiryTime = new Date(createdAt.getTime() + (this.OTP_EXPIRY_MINUTES * 60 * 1000));
      
      const remainingMs = expiryTime.getTime() - now.getTime();
      return Math.max(0, Math.floor(remainingMs / 1000)); // Return seconds
    } catch (error) {
      console.error('❌ Error getting remaining time:', error);
      return 0;
    }
  }

  /**
   * Send OTP via email using device's email app
   */
  static async sendOTPEmail(email, otp, type = 'signup') {
    try {
      console.log(`📧 Sending OTP email via device email app to ${email}`);
      console.log(`📧 Type: ${type}`);
      
      const result = await EmailService.sendOTPEmail(email, otp, type);
      
      if (result.success) {
        console.log('✅ OTP email sent successfully via device email app');
        return { success: true, message: 'OTP sent to your email!' };
      } else {
        console.error('❌ Email app failed:', result.message);
        return { success: false, message: result.message || 'Failed to send OTP. Please try again.' };
      }
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      return { success: false, message: 'Failed to send OTP. Please try again.' };
    }
  }

  /**
   * Complete OTP flow - generate, save, and send
   */
  static async sendOTP(email, type = 'signup') {
    try {
      // Generate OTP
      const otp = this.generateOTP();
      
      // Save OTP data
      const saved = await this.saveOTP(email, otp, type);
      if (!saved) {
        return { success: false, message: 'Failed to save OTP. Please try again.' };
      }
      
      // Send OTP via email
      const emailResult = await this.sendOTPEmail(email, otp, type);
      if (!emailResult.success) {
        await this.clearOTP();
        return emailResult;
      }
      
      return { success: true, message: 'OTP sent successfully!' };
    } catch (error) {
      console.error('❌ Error in sendOTP:', error);
      return { success: false, message: 'Failed to send OTP. Please try again.' };
    }
  }
}

export default OTPService;
