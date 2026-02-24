import { Resend } from 'resend';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

// Initialize Resend client if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!resend) {
      logger.warn('Resend not configured, cannot send email', { to: options.to, subject: options.subject });
      return false;
    }

    const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || 'notifications@replyoai.com';
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      tags: options.tags
    });

    if (error) {
      logger.error('Email sending failed', new Error(error.message), {
        to: options.to,
        subject: options.subject,
        error: error.message
      });
      return false;
    }

    logger.info('Email sent successfully', {
      to: typeof options.to === 'string' ? options.to.replace(/.(?=.{4})/g, '*') : '[multiple]',
      subject: options.subject,
      emailId: data?.id
    });

    return true;
  } catch (error) {
    logger.error('Email service error', new Error('Email sending failed'), {
      to: options.to,
      subject: options.subject,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Send onboarding welcome email to new business profile
 */
export async function sendOnboardingEmail(businessProfileId: string, customerEmail: string): Promise<boolean> {
  const subject = '🎉 Welcome to ReplyoAI - Your Automation is Ready!';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ReplyoAI</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin: 0;">🚀 Welcome to ReplyoAI!</h1>
        <p style="color: #666; font-size: 18px; margin: 10px 0 0 0;">Your business automation is now live</p>
      </div>

      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0 0 15px 0;">🎉 Setup Complete!</h2>
        <p style="margin: 0; font-size: 16px;">Your conversational AI is ready to convert visitors into customers 24/7</p>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #2563eb; margin-bottom: 15px;">✅ What's Active Now:</h3>
        <ul style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">🤖 <strong>AI Conversation Flow</strong> - Qualifying leads automatically</li>
          <li style="margin-bottom: 8px;">🔥 <strong>Hot Lead Detection</strong> - Instant notifications for high-value prospects</li>
          <li style="margin-bottom: 8px;">📧 <strong>Smart Follow-ups</strong> - Automated nurture sequences</li>
          <li style="margin-bottom: 8px;">📊 <strong>Analytics Dashboard</strong> - Real-time performance tracking</li>
          <li style="margin-bottom: 8px;">💰 <strong>Revenue Optimization</strong> - Dynamic pricing & scarcity features</li>
        </ul>
      </div>

      <div style="background: #f8fafc; padding: 25px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 30px;">
        <h3 style="color: #047857; margin: 0 0 15px 0;">🎯 Next Steps:</h3>
        <ol style="margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 10px;">Check your dashboard for incoming leads</li>
          <li style="margin-bottom: 10px;">Customize your conversation flows (optional)</li>
          <li style="margin-bottom: 10px;">Set up webhook notifications for instant alerts</li>
          <li style="margin-bottom: 10px;">Review analytics to optimize performance</li>
        </ol>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="https://dashboard.replyoai.com" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 10px 10px 0;">
          📊 View Dashboard
        </a>
        <a href="https://docs.replyoai.com" style="display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          📚 Documentation
        </a>
      </div>

      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #f59e0b; margin-bottom: 30px;">
        <h4 style="color: #92400e; margin: 0 0 10px 0;">💡 Pro Tip:</h4>
        <p style="color: #92400e; margin: 0;">Most businesses see their first qualified lead within 24 hours. Make sure your booking calendar is ready!</p>
      </div>

      <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280;">
        <p style="margin: 0 0 10px 0;"><strong>Need help?</strong> Our team is here to support you.</p>
        <p style="margin: 0;">
          📧 <a href="mailto:support@replyoai.com" style="color: #2563eb;">support@replyoai.com</a> | 
          📞 <a href="tel:+44-xxx-xxx-xxxx" style="color: #2563eb;">+44 (xxx) xxx-xxxx</a>
        </p>
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #9ca3af;">
          Business Profile ID: ${businessProfileId}
        </p>
      </div>

    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject,
    html: htmlContent,
    tags: [
      { name: 'type', value: 'onboarding' },
      { name: 'business', value: businessProfileId }
    ]
  });
}

/**
 * Send hot lead notification email
 */
export async function sendHotLeadEmail(payload: {
  businessId: string;
  leadData: any;
  score: number;
  phone?: string;
  timestamp: string;
}): Promise<boolean> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    logger.info('Owner email not configured, skipping hot lead email', { businessId: payload.businessId });
    return false;
  }

  const subject = `🔥 Hot Lead Alert - Score: ${payload.score}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Hot Lead Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0;">🔥 Hot Lead Alert!</h1>
        <div style="font-size: 24px; font-weight: bold;">Score: ${payload.score}</div>
      </div>

      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
        <h3 style="color: #dc2626; margin: 0 0 15px 0;">Lead Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Business:</td>
            <td style="padding: 8px 0; color: #6b7280;">${payload.businessId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Service:</td>
            <td style="padding: 8px 0; color: #6b7280;">${payload.leadData.service_tier || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Phone:</td>
            <td style="padding: 8px 0; color: #6b7280;">${payload.phone || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Urgency:</td>
            <td style="padding: 8px 0; color: #6b7280;">${payload.leadData.urgency || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Time:</td>
            <td style="padding: 8px 0; color: #6b7280;">${new Date(payload.timestamp).toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #374151; margin-bottom: 15px;">📋 Full Lead Details</h3>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px;">
          ${Object.entries(payload.leadData)
            .filter(([key, value]) => value && key !== 'timestamp')
            .map(([key, value]) => `
              <div style="margin-bottom: 10px;">
                <strong style="color: #374151;">${key.replace(/_/g, ' ').toUpperCase()}:</strong>
                <span style="color: #6b7280; margin-left: 10px;">${value}</span>
              </div>
            `).join('')}
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 30px;">
        <p style="color: #dc2626; font-size: 16px; font-weight: bold; margin: 0;">
          ⚡ Respond quickly to maximize conversion!
        </p>
      </div>

    </body>
    </html>
  `;

  return sendEmail({
    to: ownerEmail,
    subject,
    html: htmlContent,
    tags: [
      { name: 'type', value: 'hot-lead' },
      { name: 'business', value: payload.businessId },
      { name: 'score', value: payload.score.toString() }
    ]
  });
}