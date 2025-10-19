const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'COPit Email Server is running!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Send OTP email endpoint
app.post('/send-otp', async (req, res) => {
  try {
    const { email, otp, type = 'signup' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    if (!BREVO_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured'
      });
    }

    const subject = type === 'signup' 
      ? 'Welcome to COPit - Verify Your Email' 
      : 'COPit - Your Verification Code';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #83AFA7; margin-bottom: 10px;">COPit</h1>
          <h2 style="color: #333; margin-bottom: 20px;">${type === 'signup' ? 'Welcome to COPit!' : 'Email Verification'}</h2>
        </div>
        
        <div style="background-color: #FEF4D8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
            ${type === 'signup' 
              ? 'Thank you for signing up for COPit! To complete your registration, please verify your email address using the code below:'
              : 'Please use the following verification code to complete your action:'
            }
          </p>
          
          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; background-color: #83AFA7; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 15px;">
            This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by COPit. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    const emailData = {
      sender: {
        name: 'COPit',
        email: 'noreply@copit.app'
      },
      to: [
        {
          email: email,
          name: email.split('@')[0]
        }
      ],
      subject: subject,
      htmlContent: htmlContent
    };

    const response = await axios.post(BREVO_API_URL, emailData, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('✅ Email sent successfully:', response.data);

    res.json({
      success: true,
      message: 'OTP email sent successfully',
      messageId: response.data.messageId
    });

  } catch (error) {
    console.error('❌ Error sending email:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.response?.data?.message || error.message
    });
  }
});

// Send notification email endpoint
app.post('/send-notification', async (req, res) => {
  try {
    const { email, subject, message, type = 'notification' } = req.body;

    if (!email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Email, subject, and message are required'
      });
    }

    if (!BREVO_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Email service not configured'
      });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #83AFA7; margin-bottom: 10px;">COPit</h1>
          <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
        </div>
        
        <div style="background-color: #FEF4D8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            ${message}
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by COPit. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    const emailData = {
      sender: {
        name: 'COPit',
        email: 'noreply@copit.app'
      },
      to: [
        {
          email: email,
          name: email.split('@')[0]
        }
      ],
      subject: subject,
      htmlContent: htmlContent
    };

    const response = await axios.post(BREVO_API_URL, emailData, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('✅ Notification email sent successfully:', response.data);

    res.json({
      success: true,
      message: 'Notification email sent successfully',
      messageId: response.data.messageId
    });

  } catch (error) {
    console.error('❌ Error sending notification email:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send notification email',
      error: error.response?.data?.message || error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 COPit Email Server running on port ${PORT}`);
  console.log(`📧 Brevo API configured: ${BREVO_API_KEY ? 'Yes' : 'No'}`);
});

module.exports = app;
