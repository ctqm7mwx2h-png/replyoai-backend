import { z } from 'zod';

// Request validation schemas
export const onboardSchema = z.object({
  stripeCustomerId: z.string().min(1, 'Stripe customer ID is required'),
  stripeSubscriptionId: z.string().optional(),
  plan: z.enum(['basic', 'premium'], {
    required_error: 'Plan must be either basic or premium',
  }),
});

export const connectInstagramSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID format'),
  instagramPageId: z.string().min(1, 'Instagram page ID is required'),
});

export const checkAccessSchema = z.object({
  instagramPageId: z.string().min(1, 'Instagram page ID is required'),
});

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

export interface CheckAccessResponse {
  allowed: boolean;
  subscriptionStatus: string | null;
}