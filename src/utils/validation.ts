import { z } from 'zod';

// Request validation schemas
export const onboardSchema = z.object({
  stripeCustomerId: z.string().min(1, 'Stripe customer ID is required'),
  stripeSubscriptionId: z.string().optional(),
  plan: z.enum(['basic', 'premium'], {
    required_error: 'Plan must be either basic or premium',
  }),
});

export const registerIgSchema = z.object({
  ig_username: z.string().min(1, 'Instagram username is required'),
});

export const checkAccessSchema = z.object({
  ig_username: z.string().min(1, 'Instagram username is required'),
});

export const businessProfileSchema = z.object({
  ig_username: z.string().min(1, 'Instagram username is required'),
  business_name: z.string().min(1, 'Business name is required'),
  booking_link: z.string().url('Invalid booking link URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  hours: z.string().optional(),
  tone: z.string().optional(),
  industry: z.string().optional(),
});

export const getBusinessDataSchema = z.object({
  ig_username: z.string().min(1, 'Instagram username is required'),
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
}