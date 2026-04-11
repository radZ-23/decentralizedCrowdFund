const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // For development/testing without SMTP
  if (!process.env.SMTP_USER) {
    logger.warn('SMTP not configured. Emails will be logged but not sent.');
    return {
      sendMail: async (mailOptions) => {
        logger.info('[Email Mock]', mailOptions);
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

/**
 * Send email notification
 */
const sendEmail = async (options) => {
  const { to, subject, html, text } = options;

  const mailOptions = {
    from: process.env.SMTP_FROM || 'MedTrustFund <noreply@medtrustfund.org>',
    to,
    subject,
    html,
    text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${subject}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Email Templates
 */

// Campaign Approval Email
const sendCampaignApprovalEmail = async (userEmail, campaignTitle) => {
  const subject = 'Campaign Approved - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">🎉 Your Campaign Has Been Approved!</h2>
      <p>Dear Supporter,</p>
      <p>Great news! Your campaign <strong>"${campaignTitle}"</strong> has been approved and is now live on MedTrustFund.</p>
      <p>You can now start receiving donations and make a difference.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Your Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">Thank you for using MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Campaign Rejection Email
const sendCampaignRejectionEmail = async (userEmail, campaignTitle, reason) => {
  const subject = 'Campaign Update - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Campaign Review Update</h2>
      <p>Dear Supporter,</p>
      <p>We have reviewed your campaign <strong>"${campaignTitle}"</strong>.</p>
      <p style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 16px 0;">
        <strong>Reason:</strong> ${reason || 'Please contact admin for more details.'}
      </p>
      <p>You can edit and resubmit your campaign for review.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Edit Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Donation Received Email (for campaign owner)
const sendDonationReceivedEmail = async (userEmail, campaignTitle, amount, donorName) => {
  const subject = 'New Donation Received - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">💰 New Donation Received!</h2>
      <p>Great news! Your campaign <strong>"${campaignTitle}"</strong> has received a new donation.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 18px;"><strong>Amount: ${amount} ETH</strong></p>
        <p style="margin: 8px 0 0 0; color: #666;">From: ${donorName || 'Anonymous Donor'}</p>
      </div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Donation Confirmation Email (for donor)
const sendDonationConfirmationEmail = async (donorEmail, campaignTitle, amount, txHash) => {
  const subject = 'Donation Confirmation - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">🙏 Thank You for Your Donation!</h2>
      <p>Your generous donation has been received.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Campaign:</strong> ${campaignTitle}</p>
        <p style="margin: 8px 0;"><strong>Amount:</strong> ${amount} ETH</p>
        ${txHash ? `<p style="margin: 8px 0;"><strong>TX Hash:</strong> <a href="https://etherscan.io/tx/${txHash}" target="_blank">${txHash.slice(0, 10)}...${txHash.slice(-8)}</a></p>` : ''}
      </div>
      <p>Your contribution is making a real difference in someone's life.</p>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: donorEmail, subject, html });
};

// Milestone Confirmed Email
const sendMilestoneConfirmedEmail = async (userEmail, campaignTitle, milestoneDescription, amount) => {
  const subject = 'Milestone Confirmed - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">✅ Milestone Confirmed</h2>
      <p>A milestone has been confirmed for your campaign <strong>"${campaignTitle}"</strong>.</p>
      <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Milestone:</strong> ${milestoneDescription}</p>
        <p style="margin: 8px 0;"><strong>Amount Released:</strong> ${amount} ETH</p>
      </div>
      <p>Funds have been released to the hospital.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Funds Released Email
const sendFundsReleasedEmail = async (userEmail, campaignTitle, milestoneDescription, amount) => {
  const subject = 'Funds Released - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">💰 Funds Released</h2>
      <p>Funds have been released for your campaign <strong>"${campaignTitle}"</strong>.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Milestone:</strong> ${milestoneDescription}</p>
        <p style="margin: 8px 0;"><strong>Amount Released:</strong> ${amount} ETH</p>
      </div>
      <p>The funds have been transferred successfully.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// KYC Status Changed Email
const sendKYCStatusEmail = async (userEmail, status, reason) => {
  const subject = `KYC Verification ${status === 'approved' ? 'Successful' : 'Update'} - MedTrustFund`;

  let content;
  if (status === 'approved') {
    content = `
      <h2 style="color: #16a34a;">✅ KYC Verified Successfully</h2>
      <p>Your identity verification has been approved. You now have full access to all MedTrustFund features.</p>
    `;
  } else if (status === 'rejected') {
    content = `
      <h2 style="color: #dc2626;">KYC Verification Update</h2>
      <p>Your KYC submission requires attention.</p>
      ${reason ? `<div style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; margin: 16px 0;"><strong>Reason:</strong> ${reason}</div>` : ''}
      <p>Please review the requirements and resubmit your documents.</p>
    `;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${content}
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Profile
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Welcome Email
const sendWelcomeEmail = async (userEmail, userName) => {
  const subject = 'Welcome to MedTrustFund!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Welcome to MedTrustFund, ${userName}!</h2>
      <p>Thank you for joining our platform. Together, we can make healthcare accessible to everyone.</p>
      <p>Here's what you can do:</p>
      <ul>
        <li>Create campaigns for medical treatments</li>
        <li>Donate to causes you care about</li>
        <li>Track milestones and fund releases</li>
        <li>Verify documents with AI-powered fraud detection</li>
      </ul>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Get Started
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund Team</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Refund Processed Email
const sendRefundEmail = async (donorEmail, campaignTitle, amount, reason) => {
  const subject = 'Refund Processed - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Refund Processed</h2>
      <p>Your donation to <strong>"${campaignTitle}"</strong> has been refunded.</p>
      <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Refund Amount:</strong> ${amount} ETH</p>
        ${reason ? `<p style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
      </div>
      <p>The funds have been returned to your wallet. Please allow a few moments for the transaction to be confirmed on the blockchain.</p>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: donorEmail, subject, html });
};

// Campaign Target Reached Email
const sendCampaignTargetReachedEmail = async (userEmail, campaignTitle, targetAmount) => {
  const subject = '🎉 Campaign Goal Reached! - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">🎉 Campaign Goal Reached!</h2>
      <p>Congratulations! Your campaign <strong>"${campaignTitle}"</strong> has reached its funding goal.</p>
      <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 18px;"><strong>Target Achieved: ${targetAmount} ETH</strong></p>
      </div>
      <p>All milestones are now ready to be executed. The funds will be released according to the milestone schedule.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Campaign Expiring Soon Email
const sendCampaignExpiringEmail = async (userEmail, campaignTitle, daysRemaining) => {
  const subject = 'Campaign Expiring Soon - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⏰ Campaign Expiring Soon</h2>
      <p>Your campaign <strong>"${campaignTitle}"</strong> will expire in <strong>${daysRemaining} days</strong>.</p>
      <p>If you need more time, please contact support or extend your campaign.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-campaigns"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Manage Campaign
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

// Hospital Assigned to Campaign Email
const sendHospitalAssignedEmail = async (hospitalEmail, campaignTitle, patientName) => {
  const subject = 'New Campaign Assigned - MedTrustFund';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">New Campaign Assigned</h2>
      <p>Your hospital has been assigned to a new campaign.</p>
      <div style="background-color: #f5f3ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Campaign:</strong> ${campaignTitle}</p>
        <p style="margin: 8px 0;"><strong>Patient:</strong> ${patientName}</p>
      </div>
      <p>You will receive funds directly from the smart contract when milestones are confirmed.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/hospital/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Dashboard
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: hospitalEmail, subject, html });
};

// Bulk Email Sender for Notifications
const sendBulkEmail = async (recipients, subject, htmlTemplate) => {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Process in batches to avoid overwhelming SMTP
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const promises = batch.map(async (email) => {
      try {
        const html = typeof htmlTemplate === 'function' ? htmlTemplate(email) : htmlTemplate;
        await sendEmail({ to: email, subject, html });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ email, error: error.message });
      }
    });
    await Promise.all(promises);
  }

  return results;
};

// Weekly Digest Email
const sendWeeklyDigestEmail = async (userEmail, userName, stats) => {
  const subject = 'Your Weekly MedTrustFund Update';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Weekly Update, ${userName}!</h2>
      <p>Here's what happened this week:</p>
      <div style="background-color: #f5f3ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${stats.newDonations ? `<p style="margin: 8px 0;"><strong>New Donations:</strong> ${stats.newDonations}</p>` : ''}
        ${stats.amountRaised ? `<p style="margin: 8px 0;"><strong>Amount Raised:</strong> ${stats.amountRaised} ETH</p>` : ''}
        ${stats.milestonesCompleted ? `<p style="margin: 8px 0;"><strong>Milestones Completed:</strong> ${stats.milestonesCompleted}</p>` : ''}
        ${stats.campaignViews ? `<p style="margin: 8px 0;"><strong>Campaign Views:</strong> ${stats.campaignViews}</p>` : ''}
      </div>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Full Dashboard
      </a>
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #666; font-size: 14px;">MedTrustFund</p>
    </div>
  `;

  return sendEmail({ to: userEmail, subject, html });
};

const sendPasswordResetEmail = async (userEmail, resetToken) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const link = `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = 'Reset your MedTrustFund password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7c3aed;">Password reset</h2>
      <p>We received a request to reset your password. Click the button below to choose a new password.</p>
      <p style="color:#64748b;font-size:13px;">This link expires in one hour. If you did not request this, you can ignore this email.</p>
      <a href="${link}"
         style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        Reset password
      </a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;word-break:break-all;">${link}</p>
    </div>
  `;
  const text = `Reset your password: ${link}`;
  return sendEmail({ to: userEmail, subject, html, text });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendCampaignApprovalEmail,
  sendCampaignRejectionEmail,
  sendDonationReceivedEmail,
  sendDonationConfirmationEmail,
  sendMilestoneConfirmedEmail,
  sendFundsReleasedEmail,
  sendKYCStatusEmail,
  sendWelcomeEmail,
  sendRefundEmail,
  sendCampaignTargetReachedEmail,
  sendCampaignExpiringEmail,
  sendHospitalAssignedEmail,
  sendBulkEmail,
  sendWeeklyDigestEmail,
};
