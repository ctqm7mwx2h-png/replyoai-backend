import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config/index.js';
import { prisma } from '../models/index.js';
import { defaultLogger } from '../utils/logger.js';

export class MetaOAuthController {
  /**
   * Handle OAuth callback from Meta
   * Exchange authorization code for long-lived access token
   */
  static async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code) {
        defaultLogger.warn('Meta OAuth callback missing code parameter');
        res.status(400).send(`
          <html>
            <body>
              <h1>OAuth Error</h1>
              <p>Missing authorization code. Please try connecting Instagram again.</p>
            </body>
          </html>
        `);
        return;
      }

      defaultLogger.info('Meta OAuth callback received', {
        code: code ? '[PROVIDED]' : '[MISSING]',
        state: state || '[NOT_PROVIDED]'
      });

      // Step 1: Exchange authorization code for short-lived access token
      const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          code,
          redirect_uri: config.meta.redirectUri,
        },
      });

      const { access_token: shortLivedToken } = tokenResponse.data;

      if (!shortLivedToken) {
        throw new Error('No access token received from Meta');
      }

      defaultLogger.info('Short-lived access token obtained successfully');

      // Step 2: Exchange short-lived token for long-lived token (60 days)
      const longLivedResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      const { access_token: longLivedToken } = longLivedResponse.data;

      if (!longLivedToken) {
        throw new Error('No long-lived access token received from Meta');
      }

      defaultLogger.info('Long-lived access token obtained successfully');

      // Step 3: Get Instagram account information
      const meResponse = await axios.get('https://graph.facebook.com/v19.0/me', {
        params: {
          fields: 'id,name,accounts{id,name,instagram_business_account{id,username}}',
          access_token: longLivedToken,
        },
      });

      const { accounts } = meResponse.data;
      
      if (!accounts || !accounts.data || accounts.data.length === 0) {
        throw new Error('No Facebook pages found for this account');
      }

      // Find the Instagram business account
      let instagramUsername: string | null = null;
      for (const page of accounts.data) {
        if (page.instagram_business_account) {
          instagramUsername = page.instagram_business_account.username;
          break;
        }
      }

      if (!instagramUsername) {
        throw new Error('No Instagram business account found on connected Facebook pages');
      }

      defaultLogger.info('Instagram account found', {
        username: instagramUsername
      });

      // Step 4: Save the long-lived token to database
      const businessProfile = await prisma.businessProfile.upsert({
        where: {
          igUsername: instagramUsername,
        },
        update: {
          instagramAccessToken: longLivedToken,
          updatedAt: new Date(),
        },
        create: {
          igUsername: instagramUsername,
          businessName: instagramUsername, // Use username as default business name
          instagramAccessToken: longLivedToken,
        },
      });

      defaultLogger.info('Instagram access token saved successfully', {
        businessId: businessProfile.id,
        igUsername: instagramUsername
      });

      // Step 5: Return success page
      res.send(`
        <html>
          <head>
            <title>Instagram Connected Successfully</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                max-width: 500px;
              }
              h1 {
                margin-bottom: 1rem;
                font-size: 2rem;
              }
              .success-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              .username {
                font-weight: bold;
                color: #ffd700;
              }
              .next-steps {
                margin-top: 2rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                font-size: 0.9rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">🎉</div>
              <h1>Instagram Connected Successfully!</h1>
              <p>Your Instagram account <span class="username">@${instagramUsername}</span> has been connected to ReplyoAI.</p>
              <div class="next-steps">
                <strong>What's Next?</strong>
                <ul style="text-align: left; margin-top: 0.5rem;">
                  <li>We'll automatically respond to your Instagram DMs</li>
                  <li>Qualify leads and book appointments</li>
                  <li>Send follow-up messages to increase conversions</li>
                  <li>Track your ROI with detailed analytics</li>
                </ul>
              </div>
              <p style="margin-top: 2rem; font-size: 0.8rem; opacity: 0.8;">
                You can now close this window and return to your dashboard.
              </p>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Log detailed error for debugging
      if (axios.isAxiosError(error)) {
        defaultLogger.error('Meta OAuth API error', error, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
      } else {
        defaultLogger.error('Meta OAuth callback error:', err);
      }

      // Return user-friendly error page
      res.status(500).send(`
        <html>
          <head>
            <title>Instagram Connection Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #ff7b7b 0%, #d63031 100%);
                color: white;
              }
              .container {
                text-align: center;
                padding: 2rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                max-width: 500px;
              }
              h1 {
                margin-bottom: 1rem;
                font-size: 2rem;
              }
              .error-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              .retry-btn {
                display: inline-block;
                margin-top: 2rem;
                padding: 12px 24px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                transition: background 0.3s;
              }
              .retry-btn:hover {
                background: rgba(255, 255, 255, 0.3);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error-icon">❌</div>
              <h1>Connection Failed</h1>
              <p>We couldn't connect your Instagram account. This might be because:</p>
              <ul style="text-align: left; margin: 1rem 0;">
                <li>You don't have an Instagram Business Account</li>
                <li>Your Instagram account isn't connected to a Facebook Page</li>
                <li>There was a temporary issue with Instagram's servers</li>
              </ul>
              <p><strong>Please try again or contact support if the issue persists.</strong></p>
              <a href="#" class="retry-btn" onclick="window.close()">Close Window</a>
            </div>
          </body>
        </html>
      `);
    }
  }
}