import { sendHotLeadEmail } from './email.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export interface NotificationPayload {
  businessId: string;
  leadData: any;
  score: number;
  phone?: string;
  timestamp: string;
}

/**
 * Send SMS notification via Twilio if configured
 */
async function sendTwilioSMS(payload: NotificationPayload): Promise<boolean> {
  try {
    const twilioConfig: TwilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
    };

    // Check if Twilio is configured
    if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.phoneNumber) {
      logger.info('Twilio not configured, skipping SMS', { businessId: payload.businessId });
      return false;
    }

    const ownerPhone = process.env.OWNER_PHONE_NUMBER;
    if (!ownerPhone) {
      logger.info('Owner phone not configured, skipping SMS', { businessId: payload.businessId });
      return false;
    }

    // Create SMS message
    const smsBody = `🔥 HOT LEAD ALERT! Score: ${payload.score}
` +
                   `Business: ${payload.businessId}
` +
                   `Service: ${payload.leadData.service_tier || 'Unknown'}
` +
                   `Phone: ${payload.phone || 'Not provided'}
` +
                   `Urgency: ${payload.leadData.urgency || 'Unknown'}
` +
                   `Time: ${new Date().toLocaleTimeString()}`;

    // Send SMS using Twilio API
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        From: twilioConfig.phoneNumber,
        To: ownerPhone,
        Body: smsBody
      })
    });

    if (response.ok) {
      logger.info('Twilio SMS sent successfully', { 
        businessId: payload.businessId, 
        score: payload.score,
        to: ownerPhone.replace(/.(?=.{4})/g, '*') // Mask phone for security
      });
      return true;
    } else {
      const errorData = await response.text();
      logger.warn('Twilio SMS failed', { 
        businessId: payload.businessId, 
        status: response.status,
        error: errorData
      });
      return false;
    }
  } catch (error) {
    logger.error('Twilio SMS error', new Error('SMS sending failed'), { 
      businessId: payload.businessId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}
/**
 * Notify business owner of hot lead
 * @param businessId - Business identifier
 * @param leadData - Lead qualification data
 * @param score - Lead score
 * @param phone - Customer phone number
 */
export async function notifyOwner(
  businessId: string,
  leadData: any,
  score: number,
  phone?: string
): Promise<void> {
  const payload: NotificationPayload = {
    businessId,
    leadData,
    score,
    phone,
    timestamp: new Date().toISOString()
  };

  logger.info('Hot lead notification triggered', { 
    businessId, 
    score,
    hasPhone: !!phone,
    urgency: leadData.urgency,
    serviceTier: leadData.service_tier
  });

  let webhookSuccess = false;
  let smsSuccess = false;
  let emailSuccess = false;

  // Try webhook notification
  try {
    const webhookUrl = process.env.OWNER_WEBHOOK_URL;
    
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReplyoAI/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        webhookSuccess = true;
        logger.info('Owner webhook notification sent successfully', { 
          businessId, 
          score,
          webhookUrl: webhookUrl.replace(/\/\/.*@/, '//***@') // Mask credentials
        });
      } else {
        logger.warn('Owner webhook notification failed', { 
          businessId, 
          score, 
          status: response.status,
          statusText: response.statusText
        });
      }
    } else {
      logger.info('Owner webhook URL not configured, skipping webhook', { businessId, score });
    }
  } catch (webhookError) {
    logger.error('Owner webhook notification error', new Error('Webhook failed'), { 
      businessId, 
      score,
      errorMessage: webhookError instanceof Error ? webhookError.message : 'Unknown error'
    });
  }

  // Try email notification
  try {
    emailSuccess = await sendHotLeadEmail(payload);
  } catch (emailError) {
    logger.error('Email notification error', new Error('Email failed'), { 
      businessId, 
      score,
      errorMessage: emailError instanceof Error ? emailError.message : 'Unknown error'
    });
  }

  // Try SMS notification
  try {
    smsSuccess = await sendTwilioSMS(payload);
  } catch (smsError) {
    logger.error('SMS notification error', new Error('SMS failed'), { 
      businessId, 
      score,
      errorMessage: smsError instanceof Error ? smsError.message : 'Unknown error'
    });
  }

  // Log final notification status
  if (webhookSuccess || emailSuccess || smsSuccess) {
    logger.info('Hot lead notification completed successfully', { 
      businessId, 
      score,
      webhookSuccess,
      emailSuccess,
      smsSuccess
    });
  } else {
    logger.warn('All notification methods failed', { 
      businessId, 
      score,
      webhookConfigured: !!process.env.OWNER_WEBHOOK_URL,
      resendConfigured: !!process.env.RESEND_API_KEY,
      twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    });
  }
}