// Load environment variables from .env file (for local development)
require('dotenv').config();

const express = require('express');
const Mailjet = require('node-mailjet');
const cors = require('cors');

const app = express();

// Allow CORS from anywhere (or restrict to your domain)
app.use(cors());
app.use(express.json());

// Mailjet API configuration
const MAILJET_API_KEY = process.env.MAILJET_API_KEY || '529bb6f33ce3f95df4f5c85b56ac7d92';
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY || 'f00ae6504de7534e5d4a7d0be445ad56';
const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL || 'petverse29@gmail.com';
const FROM_NAME = process.env.MAILJET_FROM_NAME || 'PetVerse Team';

// Initialize Mailjet
const mailjet = Mailjet.apiConnect(MAILJET_API_KEY, MAILJET_SECRET_KEY);

console.log('✅ Mailjet API initialized');
console.log(`📧 Sending emails from: ${FROM_NAME} <${FROM_EMAIL}>`);

// ============================================
// HELPER FUNCTION - Send Email via Mailjet
// ============================================
async function sendEmail({ to, subject, html, from = `${FROM_NAME} <${FROM_EMAIL}>` }) {
  try {
    const request = mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: FROM_EMAIL,
              Name: FROM_NAME
            },
            To: [
              {
                Email: to,
                Name: to.split('@')[0]
              }
            ],
            Subject: subject,
            HTMLPart: html
          }
        ]
      });

    await request;
    console.log(`✅ Email sent successfully to: ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Mailjet Error:', error.statusCode, error.message);
    throw error;
  }
}

// ============================================
// VOLUNTEER EMAILS
// ============================================

// Volunteer status email (acceptance/rejection)
app.post('/api/email/volunteer-status', async (req, res) => {
  const { to, volunteerName, status, contactEmail } = req.body;

  try {
    const subject = status === 'approved'
      ? '🎉 Welcome to the PetVerse Volunteer Team!'
      : 'Thank you for your interest in PetVerse';

    const html = status === 'approved'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5fbf;">Congratulations, ${volunteerName}! 🎉</h2>
          <p>We're thrilled to welcome you to the <strong>PetVerse Volunteer Team</strong>!</p>
          <p>Your application has been <strong style="color: #28a745;">approved</strong>. We're excited to have you join our mission to help pets find loving homes.</p>
          <h3>What's Next?</h3>
          <ul>
            <li>You'll receive event invitations via email</li>
            <li>Check your dashboard for upcoming volunteer opportunities</li>
            <li>Connect with our community of animal lovers</li>
          </ul>
          <p>If you have any questions, reach out to us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>
          <br>
          <p>With gratitude,<br><strong>The PetVerse Team</strong></p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5fbf;">Thank You, ${volunteerName}</h2>
          <p>We appreciate your interest in volunteering with PetVerse.</p>
          <p>Unfortunately, we're unable to accept your application at this time. This could be due to limited positions or timing.</p>
          <p>We encourage you to apply again in the future or explore other ways to support our mission.</p>
          <p>Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>
          <br>
          <p>Best regards,<br><strong>The PetVerse Team</strong></p>
        </div>
      `;

    await sendEmail({ to, subject, html });

    console.log(`✅ Volunteer ${status} email sent to: ${to}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Volunteer event notification email (mass email)
app.post('/api/email/volunteer-event', async (req, res) => {
  const { recipients, event, customMessage, contactEmail } = req.body;

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5fbf;">🐾 Volunteer Opportunity: ${event.title}</h2>
        
        ${customMessage ? `<p style="background: #f8f4ff; padding: 15px; border-radius: 8px;">${customMessage}</p>` : ''}
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Event Details</h3>
          <p><strong>📅 Date:</strong> ${event.date}</p>
          <p><strong>🕐 Time:</strong> ${event.time || 'TBD'}</p>
          <p><strong>📍 Location:</strong> ${event.location}</p>
          ${event.address ? `<p><strong>🏠 Address:</strong> ${event.address}</p>` : ''}
          ${event.description ? `<p><strong>📝 Description:</strong> ${event.description}</p>` : ''}
          ${event.responsibilities ? `<p><strong>✅ Responsibilities:</strong> ${event.responsibilities}</p>` : ''}
        </div>
        
        <p>We hope to see you there! Your contribution makes a real difference in the lives of animals.</p>
        
        <p>Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>
        
        <br>
        <p>Best regards,<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    const subject = `🐾 Volunteer Event: ${event.title}`;

    // Send to all recipients
    const emailPromises = recipients.map(email =>
      sendEmail({ to: email, subject, html })
    );

    await Promise.all(emailPromises);

    console.log(`✅ Event emails sent to ${recipients.length} volunteers`);
    res.json({ success: true, message: `Emails sent to ${recipients.length} recipients` });
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LOST & FOUND EMAILS
// ============================================

// Lost/Found report status email
app.post('/api/email/lost-found-status', async (req, res) => {
  const { to, petName, status, reportType, contactEmail } = req.body;

  try {
    const isApproved = status === 'approved';
    const isLost = reportType === 'lost';

    const subject = isApproved
      ? `✅ Your ${isLost ? 'Lost' : 'Found'} Pet Report Has Been Approved`
      : `Update on Your ${isLost ? 'Lost' : 'Found'} Pet Report`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C07E60;">Pet Report Update</h2>
        
        <p>Your <strong>${isLost ? 'lost' : 'found'}</strong> pet report ${petName ? `for <strong>${petName}</strong>` : ''} has been <strong style="color: ${isApproved ? '#28a745' : '#dc3545'};">${status}</strong>.</p>
        
        ${isApproved && isLost ? `
          <div style="background: #f0fff4; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Good news!</strong> Your report is now visible to the community. We've also posted it to help spread the word.</p>
          </div>
        ` : ''}
        
        ${!isApproved ? `
          <p>If you believe this was a mistake or need more information, please contact us.</p>
        ` : ''}
        
        <p>Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>
        
        <br>
        <p>Best regards,<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    await sendEmail({ to, subject, html });

    console.log(`✅ Lost/Found status email sent to: ${to}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pet found match notification (notify original owner)
app.post('/api/email/pet-found-match', async (req, res) => {
  const { to, petName, finderPhone, finderEmail, location, contactEmail } = req.body;

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">🎉 Great News! Someone May Have Found ${petName || 'Your Pet'}!</h2>
        
        <p>A community member has reported finding a pet that matches your lost pet report.</p>
        
        <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="margin-top: 0; color: #28a745;">Finder's Contact Information</h3>
          <p><strong>📞 Phone:</strong> ${finderPhone}</p>
          <p><strong>📧 Email:</strong> <a href="mailto:${finderEmail}">${finderEmail}</a></p>
          <p><strong>📍 Found Location:</strong> ${location}</p>
        </div>
        
        <p><strong>What to do next:</strong></p>
        <ol>
          <li>Contact the finder immediately using the details above</li>
          <li>Arrange a safe meeting to identify your pet</li>
          <li>Bring any proof of ownership (photos, vet records, etc.)</li>
        </ol>
        
        <p>We hope you'll be reunited with your beloved pet soon! 🐾</p>
        
        <p>Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a></p>
        
        <br>
        <p>With hope,<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    const subject = `🎉 Someone May Have Found ${petName || 'Your Pet'}!`;

    await sendEmail({ to, subject, html });

    console.log(`✅ Pet found match email sent to: ${to}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OTP / AUTHENTICATION EMAILS
// ============================================

// OTP verification email with welcome message
app.post('/api/email/otp', async (req, res) => {
  const { to, otp, userName } = req.body;

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5fbf;">🎉 Welcome to PetVerse, ${userName || 'there'}!</h2>
        
        <p>We're thrilled to have you join our community of pet lovers!</p>
        
        <div style="background: #f8f4ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="margin-top: 0;">What you can do on PetVerse:</h3>
          <ul>
            <li>🐾 Adopt loving pets looking for homes</li>
            <li>🔍 Report and find lost pets</li>
            <li>🤝 Volunteer for pet events</li>
            <li>💬 Connect with our community</li>
            <li>💖 Donate to support our mission</li>
          </ul>
        </div>
        
        <h3 style="color: #8b5fbf;">🔐 Verify Your Account</h3>
        <p>To complete your registration, please enter this verification code:</p>
        
        <div style="background: linear-gradient(135deg, #8b5fbf, #6d4c9f); padding: 30px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <span style="font-size: 36px; letter-spacing: 8px; color: white; font-weight: bold;">${otp}</span>
        </div>
        
        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
        
        <p>If you didn't create an account, you can safely ignore this email.</p>
        
        <br>
        <p>Welcome aboard!<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    const subject = '🎉 Welcome to PetVerse - Verify Your Account';

    await sendEmail({ to, subject, html });

    console.log(`✅ OTP + Welcome email sent to: ${to}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('❌ OTP email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Password reset email
app.post('/api/email/password-reset', async (req, res) => {
  const { to, resetLink } = req.body;

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5fbf;">Reset Your Password</h2>
        
        <p>We received a request to reset your PetVerse account password.</p>
        
        <p>Click the button below to set a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #8b5fbf, #6d4c9f); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        
        <br>
        <p>Best regards,<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    const subject = 'Reset Your PetVerse Password';

    await sendEmail({ to, subject, html });

    console.log(`✅ Password reset email sent to: ${to}`);
    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('❌ Password reset email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Welcome email (NOT USED - combined with OTP)
app.post('/api/email/welcome', async (req, res) => {
  const { to, userName } = req.body;

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8b5fbf;">🎉 Welcome to PetVerse, ${userName || 'Friend'}!</h2>
        
        <p>We're thrilled to have you join our community of pet lovers!</p>
        
        <div style="background: #f8f4ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h3 style="margin-top: 0;">What you can do on PetVerse:</h3>
          <ul>
            <li>🐾 Adopt loving pets looking for homes</li>
            <li>🔍 Report and find lost pets</li>
            <li>🤝 Volunteer for pet events</li>
            <li>💬 Connect with our community</li>
            <li>💖 Donate to support our mission</li>
          </ul>
        </div>
        
        <p>Start exploring and make a difference in a pet's life today!</p>
        
        <br>
        <p>With love,<br><strong>The PetVerse Team</strong></p>
      </div>
    `;

    const subject = '🎉 Welcome to PetVerse!';

    await sendEmail({ to, subject, html });

    console.log(`✅ Welcome email sent to: ${to}`);
    res.json({ success: true, message: 'Welcome email sent' });
  } catch (error) {
    console.error('❌ Welcome email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root route - Backend is live message
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PetVerse Backend</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 3rem 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
          max-width: 500px;
          width: 90%;
        }
        .status-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 2rem;
        }
        .status-badge {
          display: inline-block;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 0.5rem 1.5rem;
          border-radius: 50px;
          font-weight: 600;
          margin: 1rem 0;
          font-size: 1.1rem;
        }
        .info {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 1.5rem;
          margin-top: 2rem;
          text-align: left;
        }
        .info-item {
          margin: 0.5rem 0;
          color: #555;
        }
        .info-label {
          font-weight: 600;
          color: #333;
        }
        .app-link {
          display: inline-block;
          margin-top: 2rem;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #C07E60 0%, #A66B52 100%);
          color: white;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1rem;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(192, 126, 96, 0.3);
        }
        .app-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(192, 126, 96, 0.4);
        }
        .app-link-icon {
          margin-right: 0.5rem;
        }
        .timestamp {
          color: #888;
          font-size: 0.9rem;
          margin-top: 1.5rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="status-icon">🚀</div>
        <h1>PetVerse Backend</h1>
        <div class="status-badge">✓ Backend is Live</div>
        
        <div class="info">
          <div class="info-item">
            <span class="info-label">Service:</span> Email Server
          </div>
          <div class="info-item">
            <span class="info-label">Provider:</span> Mailjet API
          </div>
          <div class="info-item">
            <span class="info-label">Status:</span> Running
          </div>
          <div class="info-item">
            <span class="info-label">Health Check:</span> <a href="/api/health" style="color: #667eea; text-decoration: none;">/api/health</a>
          </div>
        </div>
        
        <a href="https://petverse-frontend-wiwp.onrender.com/" class="app-link" target="_blank" rel="noopener noreferrer">
          <span class="app-link-icon">🐾</span>
          Access PetVerse Application
        </a>
        
        <div class="timestamp">
          Server Time: ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PetVerse Email Server (Mailjet API)',
    provider: 'Mailjet',
    from: `${FROM_NAME} <${FROM_EMAIL}>`
  });
});

// Export the app for Vercel/serverless
module.exports = app;

// For local testing only - start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Email server running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}
