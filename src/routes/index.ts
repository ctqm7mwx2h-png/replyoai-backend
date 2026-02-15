import { Router } from 'express';
import { StripeController } from '../controllers/stripe.controller.js';
import { OnboardController } from '../controllers/onboard.controller.js';
import { LicenseController } from '../controllers/license.controller.js';
import { BusinessProfileController } from '../controllers/business-profile.controller.js';
import { ConversationController } from '../controllers/conversation.controller.js';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { BillingController } from '../controllers/billing.controller.js';
import { InstallationController } from '../controllers/installation.controller.js';
import { MetaWebhookController } from '../controllers/meta.webhook.controller.js';
import { MetaOAuthController } from '../controllers/meta.oauth.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { 
  onboardSchema, 
  registerIgSchema, 
  checkAccessSchema,
  getBusinessDataSchema
} from '../utils/validation.js';

const router = Router();

// Stripe webhooks (raw body needed for signature verification)
router.post('/webhooks/stripe', StripeController.handleWebhook);

// Meta webhooks (Facebook/Instagram)
router.get('/webhook/meta', MetaWebhookController.verifyWebhook);
router.post('/webhook/meta', MetaWebhookController.handleWebhook);

// Meta OAuth (Instagram connection)
router.get('/meta/oauth/callback', MetaOAuthController.handleCallback);

// Onboarding endpoint (for subscription creation)
router.post('/onboard', validateRequest(onboardSchema), OnboardController.onboard);

// License endpoints
router.post('/register-ig', validateRequest(registerIgSchema), LicenseController.registerIg);
router.post('/check-access', validateRequest(checkAccessSchema), LicenseController.checkAccess);

// Business profile endpoints
router.post('/business-profile', BusinessProfileController.upsertBusinessProfile);
router.post('/get-business-data', validateRequest(getBusinessDataSchema), BusinessProfileController.getBusinessData);

// Fillout webhook endpoint (no validation - accepts any payload)
router.post('/fillout-webhook', BusinessProfileController.handleFilloutWebhook);

// Conversation engine endpoints (multi-tenant safe)
router.post('/conversation/message', ConversationController.processMessage);
router.post('/conversation/reset', ConversationController.resetConversation);

// Dashboard endpoints
router.get('/dashboard/:ig_username', DashboardController.getDashboard);
router.get('/dashboard/:ig_username/export', DashboardController.exportStats);

// Billing endpoints
router.get('/check-access/:ig_username', BillingController.checkAccess);
router.post('/billing/webhook', BillingController.handleStripeWebhook);

// Installation endpoints
router.post('/install/trigger', InstallationController.triggerInstallation);
router.get('/install/status/:businessId', InstallationController.getInstallationStatus);
router.post('/install/mark-complete/:businessId', InstallationController.markInstallationComplete);

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
      'POST /api/fillout-webhook',
      'POST /api/conversation/message',
      'POST /api/conversation/reset',
      'GET /api/conversation/stats',
      'GET /api/health'
    ]
  });
});

export default router;