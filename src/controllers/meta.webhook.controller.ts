import { Request, Response } from 'express';
import { config } from '../config/index.js';
import { defaultLogger } from '../utils/logger.js';

export class MetaWebhookController {
  /**
   * Handle Meta webhook verification (GET)
   * Used by Meta to verify the webhook endpoint
   */
  static async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      defaultLogger.info('Meta webhook verification attempt', {
        mode,
        token: token ? '[REDACTED]' : 'missing',
        challenge: challenge ? '[PROVIDED]' : 'missing'
      });

      // Verify the token matches our configured token
      if (mode === 'subscribe' && token === config.meta.verifyToken) {
        defaultLogger.info('Meta webhook verification successful');
        res.status(200).send(challenge);
        return;
      }

      defaultLogger.warn('Meta webhook verification failed', {
        mode,
        expectedToken: config.meta.verifyToken ? '[SET]' : '[NOT_SET]',
        providedToken: token ? '[PROVIDED]' : '[MISSING]'
      });
      
      res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    } catch (error) {
      defaultLogger.error('Error in Meta webhook verification:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Handle Meta webhook events (POST)
   * Processes incoming webhook data from Meta
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Log the full request body for debugging
      defaultLogger.info('Meta webhook received', {
        body: req.body,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          'x-hub-signature-256': req.headers['x-hub-signature-256'] ? '[PRESENT]' : '[MISSING]'
        }
      });

      // TODO: Add webhook processing logic here
      // For now, just acknowledge receipt
      
      res.status(200).json({
        success: true,
        message: 'Webhook received'
      });
    } catch (error) {
      defaultLogger.error('Error processing Meta webhook:', error);
      
      // Still return 200 to prevent Meta from retrying
      res.status(200).json({
        success: false,
        message: 'Error processed'
      });
    }
  }
}
