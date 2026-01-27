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

export const businessProfileSchema = z.union([
  // Flat JSON format
  z.object({
    ig_username: z.string().min(1, 'Instagram username is required').optional(),
    instagram_username: z.string().optional(),
    instagram: z.string().optional(),
    ig: z.string().optional(),
    business_name: z.string().optional(),
    company_name: z.string().optional(),
    name: z.string().optional(),
    booking_link: z.string().url('Invalid booking link URL').optional().or(z.literal('')),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    location: z.string().optional(),
    hours: z.string().optional(),
    tone: z.string().optional(),
    industry: z.string().optional(),
  }),
  // Fillout/webhook format with responses array
  z.object({
    responses: z.array(z.object({
      question: z.string().optional(),
      label: z.string().optional(), 
      name: z.string().optional(),
      fieldId: z.string().optional(),
      answer: z.any().optional(),
      value: z.any().optional(),
      response: z.any().optional(),
      data: z.any().optional(),
    })).min(1, 'At least one response is required')
  }),
  // Mixed format (responses + flat fields)
  z.object({
    responses: z.array(z.object({
      question: z.string().optional(),
      label: z.string().optional(),
      name: z.string().optional(),
      fieldId: z.string().optional(),
      answer: z.any().optional(),
      value: z.any().optional(),
      response: z.any().optional(),
      data: z.any().optional(),
    })).optional(),
    ig_username: z.string().optional(),
    business_name: z.string().optional(),
  }).refine(data => data.responses || data.ig_username, {
    message: "Either responses array or ig_username must be provided"
  })
]);

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