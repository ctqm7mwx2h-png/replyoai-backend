import { Request, Response } from 'express';
import { z } from 'zod';

const TriggerInstallSchema = z.object({
  businessId: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

export class InstallationController {
  static async triggerInstallation(req: Request, res: Response): Promise<void> {
    try {
      const { businessId, force } = TriggerInstallSchema.parse(req.body);

      console.log(`Processing installation for business ${businessId}, force: ${force}`);

      // Placeholder installation logic
      const installationResult = {
        success: true,
        data: {
          installation: {
            id: 'installation-123',
            status: 'INSTALLED',
            message: 'Installation completed successfully',
          },
        },
      };

      res.json(installationResult);
    } catch (error) {
      console.error('Installation trigger error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getInstallationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;

      console.log(`Getting installation status for business ${businessId}`);

      // Placeholder status check
      const statusResult = {
        success: true,
        data: {
          installation: {
            id: 'installation-123',
            status: 'INSTALLED',
            webhookVerified: true,
            onboardingEmailsSent: 3,
            manualRequired: false,
            disabled: false,
          },
        },
      };

      res.json(statusResult);
    } catch (error) {
      console.error('Installation status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async markInstallationComplete(req: Request, res: Response): Promise<void> {
    try {
      const { businessId } = req.params;

      console.log(`Marking installation complete for business ${businessId}`);

      // Placeholder completion logic
      const completionResult = {
        success: true,
        data: {
          installation: {
            id: 'installation-123',
            status: 'INSTALLED',
            message: 'Installation marked as complete',
          },
        },
      };

      res.json(completionResult);
    } catch (error) {
      console.error('Mark complete error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}