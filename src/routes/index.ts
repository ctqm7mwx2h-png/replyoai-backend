import { Router } from 'express';
import { StripeController } from '../controllers/stripe.controller.js';
import { OnboardController, InstagramController } from '../controllers/onboard.controller.js';
import { AccessController } from '../controllers/access.controller.js';
import { validateRequest } from '../middleware/validation.js';
import { onboardSchema, connectInstagramSchema, checkAccessSchema } from '../utils/validation.js';

const router = Router();

// Stripe webhooks (raw body needed for signature verification)
router.post('/webhooks/stripe', StripeController.handleWebhook);

// Onboarding endpoint
router.post('/onboard', validateRequest(onboardSchema), OnboardController.onboard);

// Instagram connection endpoint
router.post('/connect-instagram', validateRequest(connectInstagramSchema), InstagramController.connectInstagram);

// Access control endpoint
router.post('/check-access', validateRequest(checkAccessSchema), AccessController.checkAccess);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ReplyoAI backend is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;