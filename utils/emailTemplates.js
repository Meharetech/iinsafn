const nodemailer = require("nodemailer");

// Create transporter once for better performance
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Base email template with modern design
const getBaseTemplate = (title, content, footerText = "This is an automated message from iinsaf Platform") => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8f9fa;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px 20px;
          text-align: center;
          color: white;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .header p {
          font-size: 16px;
          opacity: 0.9;
          margin: 0;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .content h2 {
          color: #2c3e50;
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: 600;
        }
        
        .content p {
          color: #555;
          font-size: 16px;
          margin-bottom: 20px;
          line-height: 1.7;
        }
        
        .otp-container {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border: 2px dashed #667eea;
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
          position: relative;
        }
        
        .otp-container::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 12px;
          z-index: -1;
        }
        
        .otp-label {
          color: #495057;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .otp-code {
          color: #667eea;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 8px;
          margin: 0;
          text-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
        }
        
        .info-box {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .info-box p {
          color: #856404;
          font-size: 14px;
          margin: 0;
          font-weight: 500;
        }
        
        .security-notice {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin: 25px 0;
        }
        
        .security-notice p {
          color: #0c5460;
          font-size: 14px;
          margin: 0;
          font-weight: 500;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          transition: all 0.3s ease;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        
        .footer {
          background-color: #f8f9fa;
          padding: 25px 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        
        .footer p {
          color: #6c757d;
          font-size: 12px;
          margin: 0;
        }
        
        .logo {
          width: 60px;
          height: 60px;
          background: white;
          border-radius: 50%;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #667eea;
        }
        
        @media (max-width: 600px) {
          .email-container {
            margin: 10px;
            border-radius: 8px;
          }
          
          .header {
            padding: 20px 15px;
          }
          
          .header h1 {
            font-size: 24px;
          }
          
          .content {
            padding: 30px 20px;
          }
          
          .otp-code {
            font-size: 28px;
            letter-spacing: 4px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo">i</div>
          <h1>iinsaf Platform</h1>
          <p>${title}</p>
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          <p>${footerText}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// OTP Email Template
const getOtpTemplate = (userName, otp, purpose, validityMinutes = 10) => {
  const content = `
    <h2>Hello ${userName}!</h2>
    <p>You have requested to ${purpose}. Please use the following OTP to complete your request:</p>
    
    <div class="otp-container">
      <p class="otp-label">Your OTP Code</p>
      <p class="otp-code">${otp}</p>
    </div>
    
    <div class="info-box">
      <p><strong>Important:</strong> This OTP is valid for <strong>${validityMinutes} minutes</strong> only.</p>
    </div>
    
    <div class="security-notice">
      <p><strong>Security Notice:</strong> If you did not request this action, please ignore this email. Your account remains secure.</p>
    </div>
    
    <p>If you have any questions or need assistance, please contact our support team.</p>
  `;

  return getBaseTemplate("OTP Verification", content);
};

// Registration Success Template
const getRegistrationSuccessTemplate = (userName, userRole) => {
  const content = `
    <h2>Welcome to iinsaf Platform, ${userName}!</h2>
    <p>Congratulations! Your registration as a <strong>${userRole}</strong> has been completed successfully.</p>
    
    <div class="info-box">
      <p><strong>What's Next?</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Complete your profile setup</li>
        <li>Explore our platform features</li>
        <li>Start connecting with other users</li>
      </ul>
    </div>
    
    <p>We're excited to have you on board! If you have any questions, feel free to reach out to our support team.</p>
  `;

  return getBaseTemplate("Registration Successful", content);
};

// Password Reset Template
const getPasswordResetTemplate = (userName, otp) => {
  const content = `
    <h2>Password Reset Request</h2>
    <p>Hello ${userName},</p>
    <p>We received a request to reset your password for your iinsaf Platform account.</p>
    
    <div class="otp-container">
      <p class="otp-label">Your Reset Code</p>
      <p class="otp-code">${otp}</p>
    </div>
    
    <div class="info-box">
      <p><strong>Important:</strong> This reset code is valid for <strong>15 minutes</strong> only.</p>
    </div>
    
    <div class="security-notice">
      <p><strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your account remains secure.</p>
    </div>
    
    <p>If you continue to have issues, please contact our support team for assistance.</p>
  `;

  return getBaseTemplate("Password Reset", content);
};

// Notification Template
const getNotificationTemplate = (title, message, actionText = null, actionUrl = null) => {
  let content = `
    <h2>${title}</h2>
    <p>${message}</p>
  `;

  if (actionText && actionUrl) {
    content += `<a href="${actionUrl}" class="button">${actionText}</a>`;
  }

  return getBaseTemplate(title, content);
};

// Press Conference Template
const getPressConferenceTemplate = (userName, otp, purpose) => {
  const content = `
    <h2>Press Conference Platform</h2>
    <p>Hello ${userName},</p>
    <p>You have requested to ${purpose} for the Press Conference platform.</p>
    
    <div class="otp-container">
      <p class="otp-label">Your Verification Code</p>
      <p class="otp-code">${otp}</p>
    </div>
    
    <div class="info-box">
      <p><strong>Important:</strong> This code is valid for <strong>10 minutes</strong> only.</p>
    </div>
    
    <div class="security-notice">
      <p><strong>Security Notice:</strong> If you did not request this action, please ignore this email.</p>
    </div>
    
    <p>Thank you for using our Press Conference platform!</p>
  `;

  return getBaseTemplate("Press Conference Verification", content);
};

// Podcast Template
const getPodcastTemplate = (userName, otp, purpose) => {
  const content = `
    <h2>Podcast Platform</h2>
    <p>Hello ${userName},</p>
    <p>You have requested to ${purpose} for the Podcast platform.</p>
    
    <div class="otp-container">
      <p class="otp-label">Your Verification Code</p>
      <p class="otp-code">${otp}</p>
    </div>
    
    <div class="info-box">
      <p><strong>Important:</strong> This code is valid for <strong>3 minutes</strong> only.</p>
    </div>
    
    <div class="security-notice">
      <p><strong>Security Notice:</strong> If you did not request this action, please ignore this email.</p>
    </div>
    
    <p>Welcome to our Podcast platform! We're excited to have you join our community.</p>
  `;

  return getBaseTemplate("Podcast Platform Verification", content);
};

// Raise Your Voice Notification Template
const getRaiseYourVoiceTemplate = (adminName, userName, userEmail, description) => {
  const content = `
    <h2>New Raise Your Voice Post</h2>
    <p>Hello ${adminName},</p>
    <p>A new "Raise Your Voice" post has been submitted and requires your attention.</p>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #495057; margin-bottom: 15px;">Post Details:</h3>
      <p><strong>Submitted by:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Description:</strong></p>
      <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
        ${description}
      </div>
    </div>
    
    <div class="info-box">
      <p><strong>Action Required:</strong> Please review this post in the admin dashboard and take appropriate action.</p>
    </div>
    
    <p>Thank you for maintaining the quality of our platform.</p>
  `;

  return getBaseTemplate("New Raise Your Voice Post", content);
};

// Enhanced sendEmail function
const sendEmail = async (to, subject, text, html) => {
  try {
    await transporter.sendMail({
      from: `"iinsaf Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`✅ Email sent to ${to} | Content: ${text}`);
    return true;
  } catch (err) {
    console.error("❌ Email error:", err.message);
    return false;
  }
};

module.exports = {
  sendEmail,
  getOtpTemplate,
  getRegistrationSuccessTemplate,
  getPasswordResetTemplate,
  getNotificationTemplate,
  getPressConferenceTemplate,
  getPodcastTemplate,
  getRaiseYourVoiceTemplate,
  transporter
};
