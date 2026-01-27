import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service.js';
import type { ApiResponse } from '../utils/validation.js';

export class LicenseController {
  /**
   * Register Instagram username to most recent active subscription
   * POST /api/register-ig
   */
  static async registerIg(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = req.body;

      await SubscriptionService.registerIgUsername(ig_username);

      const response: ApiResponse = {
        success: true,
        message: 'Instagram username registered successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error registering Instagram username:', error);
      
      let message = 'Error registering Instagram username';
      let status = 500;

      if (error instanceof Error) {
        if (error.message === 'No available subscription found') {
          message = 'No available subscription found';
          status = 404;
        }
      }

      const response: ApiResponse = {
        success: false,
        message,
      };

      res.status(status).json(response);
    }
  }

  /**
   * Check access for Instagram username
   * POST /api/check-access
   */
  static async checkAccess(req: Request, res: Response): Promise<void> {
    try {
      const { ig_username } = req.body;

      const accessResult = await SubscriptionService.checkAccessByUsername(ig_username);

      const response: ApiResponse = {
        success: true,
        data: accessResult,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error checking access:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Error checking access',
      };

      res.status(500).json(response);
    }
  }
}