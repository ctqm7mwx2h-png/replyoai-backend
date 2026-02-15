import { Request, Response } from 'express';
import { ConversationRouter } from '../conversations/router.js';

export class ConversationController {
  /**
   * Test conversation endpoint
   * POST /api/conversation/message
   */
  static async processMessage(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username, message, user_id } = req.body;

      if (!ig_username || !message) {
        res.status(400).json({
          success: false,
          message: 'ig_username and message are required'
        });
        return;
      }

      // Use user_id from request or generate a default one
      const userId = user_id || 'user-' + Date.now();

      const response = await ConversationRouter.processMessage(ig_username, userId, message);

      res.status(200).json({
        success: true,
        data: response
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Conversation controller error:', err);
      
      res.status(500).json({
        success: false,
        message: 'Error processing conversation'
      });
    }
  }

  /**
   * Reset conversation for testing
   * POST /api/conversation/reset
   */
  static async resetConversation(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username, user_id } = req.body;

      if (!ig_username) {
        res.status(400).json({
          success: false,
          message: 'ig_username is required'
        });
        return;
      }

      // Use user_id from request or generate a default one
      const userId = user_id || 'user-reset';

      ConversationRouter.resetConversation(ig_username, userId);

      res.status(200).json({
        success: true,
        message: 'Conversation reset successfully'
      });

    } catch (error) {
      console.error('Reset conversation error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error resetting conversation'
      });
    }
  }

  /**
   * Get conversation statistics
   * GET /api/conversation/stats
   */
  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      // Placeholder stats
      const stats = {
        totalSessions: 5,
        activeSessions: 2,
        lastProcessedMessage: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Conversation stats error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Error getting conversation stats'
      });
    }
  }
}