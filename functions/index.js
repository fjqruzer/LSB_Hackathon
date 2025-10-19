const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Brevo email service
const sendEmail = async (toEmail, subject, htmlContent, textContent) => {
  const BREVO_API_KEY = functions.config().brevo?.api_key || process.env.BREVO_API_KEY;
  
  if (!BREVO_API_KEY) {
    throw new Error('Brevo API key not configured');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: 'COPit',
        email: 'noreply@copit.app'
      },
      to: [
        {
          email: toEmail,
          name: toEmail
        }
      ],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error: ${error}`);
  }

  return await response.json();
};

// Send OTP email
exports.sendOTPEmail = functions.https.onCall(async (data, context) => {
  try {
    const { toEmail, otp, type } = data;

    if (!toEmail || !otp) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and OTP are required');
    }

    const subject = type === 'signup' 
      ? 'COPit - Verify Your Account' 
      : 'COPit - Sign In Code';

    const htmlContent = type === 'signup' 
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #83AFA7; margin: 0;">COPit</h1>
            <p style="color: #666; margin: 5px 0;">Your Ultimate Marketplace</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="color: #83AFA7; margin: 0 0 20px 0;">Welcome to COPit! 🎉</h2>
            <p style="font-size: 16px; margin: 0 0 20px 0;">Your verification code is:</p>
            <div style="background-color: #83AFA7; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 8px; letter-spacing: 3px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666; margin: 0;">This code will expire in 5 minutes.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px; margin: 0;">If you didn't request this code, please ignore this email.</p>
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Best regards,<br>The COPit Team</p>
          </div>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #83AFA7; margin: 0;">COPit</h1>
            <p style="color: #666; margin: 5px 0;">Your Ultimate Marketplace</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h2 style="color: #83AFA7; margin: 0 0 20px 0;">Sign In Code</h2>
            <p style="font-size: 16px; margin: 0 0 20px 0;">Your sign-in code is:</p>
            <div style="background-color: #83AFA7; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 8px; letter-spacing: 3px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666; margin: 0;">This code will expire in 5 minutes.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px; margin: 0;">If you didn't request this code, please ignore this email.</p>
            <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Best regards,<br>The COPit Team</p>
          </div>
        </div>
      `;

    const textContent = type === 'signup' 
      ? `Welcome to COPit! 🎉

Your verification code is: ${otp}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Best regards,
The COPit Team`
      : `Your sign-in code for COPit: ${otp}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Best regards,
The COPit Team`;

    const result = await sendEmail(toEmail, subject, htmlContent, textContent);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'OTP sent successfully!'
    };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Send welcome email
exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  try {
    const { toEmail, firstName } = data;

    if (!toEmail || !firstName) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and firstName are required');
    }

    const subject = 'Welcome to COPit! 🎉';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #83AFA7; margin: 0;">COPit</h1>
          <p style="color: #666; margin: 5px 0;">Your Ultimate Marketplace</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #83AFA7; margin: 0 0 20px 0;">Hi ${firstName}! 👋</h2>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Welcome to COPit - your ultimate marketplace for unique items and exciting auctions!
          </p>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            We're thrilled to have you join our community. Here's what you can do:
          </p>
          <ul style="color: #666; font-size: 14px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
            <li>🛍️ Browse amazing listings</li>
            <li>💰 Bid on items you love</li>
            <li>📱 Get real-time notifications</li>
            <li>💬 Connect with other users</li>
            <li>🏆 Discover trending items</li>
          </ul>
          <p style="font-size: 16px; line-height: 1.6; margin: 0;">
            Start exploring now and find your next favorite item!
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px; margin: 0;">Happy shopping,<br>The COPit Team</p>
        </div>
      </div>
    `;

    const textContent = `Hi ${firstName}! 👋

Welcome to COPit - your ultimate marketplace for unique items and exciting auctions!

We're thrilled to have you join our community. Here's what you can do:

🛍️ Browse amazing listings
💰 Bid on items you love
📱 Get real-time notifications
💬 Connect with other users
🏆 Discover trending items

Start exploring now and find your next favorite item!

Happy shopping,
The COPit Team`;

    const result = await sendEmail(toEmail, subject, htmlContent, textContent);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Welcome email sent successfully!'
    };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
