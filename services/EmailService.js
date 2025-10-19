console.log('📧 EmailService module loaded');

class EmailService {
  // Express server URL (deployed on Render.com)
  static EMAIL_SERVER_URL = 'https://copit-email-server.onrender.com';

  /**
   * Send OTP via Express server (Brevo)
   */
  static async sendOTPEmail(email, otp, type = 'signup') {
    try {
      console.log(`📧 Sending OTP email to ${email} via Express server (Brevo)`);
      
      const response = await fetch(`${EmailService.EMAIL_SERVER_URL}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: email,
          otp: otp,
          type: type
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Email sent successfully via Express server:', result);
        return {
          success: true,
          message: 'OTP sent to your email!'
        };
      } else {
        const error = await response.text();
        console.error('❌ Express server error:', error);
        throw new Error('Email service failed');
      }
    } catch (error) {
      console.error('❌ Error sending OTP email via Express server:', error);
      
      // Return error instead of showing OTP in alert
      return {
        success: false,
        message: 'Failed to send OTP email. Please check your internet connection and try again.'
      };
    }
  }

  /**
   * Send welcome email via Express server (Brevo)
   */
  static async sendWelcomeEmail(email, firstName) {
    try {
      console.log(`📧 Sending welcome email to ${firstName} (${email}) via Express server (Brevo)`);
      
      const response = await fetch(`${EmailService.EMAIL_SERVER_URL}/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: email,
          firstName: firstName
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Welcome email sent successfully via Express server:', result);
        return {
          success: true,
          message: 'Welcome email sent!'
        };
      } else {
        const error = await response.text();
        console.error('❌ Express server error:', error);
        throw new Error('Email service failed');
      }
    } catch (error) {
      console.error('❌ Error sending welcome email via Express server:', error);
      
      // Fallback: Just log the welcome
      console.log(`🎉 Welcome to COPit, ${firstName}! (Email service unavailable)`);
      
      return {
        success: true,
        message: 'Welcome message logged (email service unavailable)'
      };
    }
  }
}

export default EmailService;
