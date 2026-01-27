import { Router } from 'express';
import { StripeController } from '../controllers/stripe.controller.js';
import { OnboardController } from '../controllers/onboard.controller.js';
import { LicenseController } from '../controllers/license.controller.js';
import { BusinessProfileController } from '../controllers/business-profile.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { 
  onboardSchema, 
  registerIgSchema, 
  checkAccessSchema,
  businessProfileSchema,
  getBusinessDataSchema
} from '../utils/validation.js';

const router = Router();

// Stripe webhooks (raw body needed for signature verification)
router.post('/webhooks/stripe', StripeController.handleWebhook);

// Onboarding endpoint (for subscription creation)
router.post('/onboard', validateRequest(onboardSchema), OnboardController.onboard);

// License endpoints
router.post('/register-ig', validateRequest(registerIgSchema), LicenseController.registerIg);
router.post('/check-access', validateRequest(checkAccessSchema), LicenseController.checkAccess);

// Business profile endpoints
router.post('/business-profile', validateRequest(businessProfileSchema), BusinessProfileController.upsertBusinessProfile);
router.post('/get-business-data', validateRequest(getBusinessDataSchema), BusinessProfileController.getBusinessData);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'ReplyoAI backend is healthy',
    timestamp: new Date().toISOString(),
    routes: [
      'POST /api/webhooks/stripe',
      'POST /api/onboard',
      'POST /api/register-ig',
      'POST /api/check-access',
      'POST /api/business-profile',
      'POST /api/get-business-data',
      'GET /api/health'
    ]
  });
});

export default router;