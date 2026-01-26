import { Request, Response } from 'express';
import { AccessService } from '../services/access.service.js';
import type { ApiResponse, CheckAccessResponse } from '../utils/validation.js';

export class AccessController {
  /**
   * Check access for Instagram page ID
   * POST /api/check-access
   */
  static async checkAccess(req: Request, res: Response) {
    try {
      const { instagramPageId } = req.body;

      const accessResult = await AccessService.checkAccess(instagramPageId);

      const response: ApiResponse<CheckAccessResponse> = {
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