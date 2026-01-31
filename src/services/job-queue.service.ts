import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../utils/redis.js';
import { config } from '../config/index.js';
import { RevenueEstimator } from '../services/revenue-estimator.service.js';
import { prisma } from '../models/index.js';
import nodemailer from 'nodemailer';

// Job data interfaces
export interface FollowUpJobData {
  conversationId: string;
  businessId: string;
  userId: string;
  followUpType: 'first' | 'second';
  templateData?: Record<string, any>;
}

export interface StatsAggregationJobData {
  businessId?: string; // If undefined, aggregate for all businesses
  periodStart: string; // ISO date string
  periodEnd: string;   // ISO date string
  force?: boolean;     // Force re-calculation even if exists
}

export interface OnboardingEmailJobData {
  businessId: string;
  emailType: 'welcome' | 'setup_guide' | 'best_practices';
  delay?: number; // Delay in milliseconds
}

// Create job queues
const connection = { connection: redis };

export const followUpQueue = new Queue<FollowUpJobData>('follow-up', connection);
export const statsQueue = new Queue<StatsAggregationJobData>('stats-aggregation', connection);
export const emailQueue = new Queue<OnboardingEmailJobData>('onboarding-email', connection);

// Email transporter
const emailTransporter = config.email.user ? nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
}) : null;

// Job processors
export class JobProcessors {
  /**
   * Process follow-up jobs
   */
  static async processFollowUp(job: Job<FollowUpJobData>): Promise<void> {
    const { conversationId, businessId, userId, followUpType } = job.data;

    try {
      // Check if conversation is still eligible for follow-up
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          business: {
            select: {
              igUsername: true,
              businessName: true,
              industry: true,
              tone: true,
            },
          },
        },
      });

      if (!conversation) {
        console.log(`Conversation ${conversationId} not found, skipping follow-up`);
        return;
      }

      // Skip if customer has already booked
      if (conversation.hasBooked) {
        console.log(`Conversation ${conversationId} already converted, skipping follow-up`);
        return;
      }

      // Skip if conversation has ended
      if (conversation.currentState === 'END') {
        console.log(`Conversation ${conversationId} has ended, skipping follow-up`);
        return;
      }

      // Generate follow-up message based on type and business context
      const followUpMessage = this.generateFollowUpMessage(
        followUpType,
        conversation.business.industry || 'default',
        conversation.business.tone || 'friendly',
        conversation.leadService
      );

      // TODO: Send actual message via Instagram API
      // For now, log the follow-up
      console.log(`Follow-up ${followUpType} for conversation ${conversationId}: ${followUpMessage}`);

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          followUpCount: { increment: 1 },
          lastMessageAt: new Date(),
          nextFollowUpAt: followUpType === 'first' 
            ? new Date(Date.now() + config.defaults.JOBS.FOLLOW_UP_DELAYS.second)
            : null, // No more follow-ups after second
        },
      });

      // Add message to conversation history
      await prisma.conversationMessage.create({
        data: {
          conversationId,
          fromBusiness: true,
          message: followUpMessage,
          state: 'FOLLOW_UP',
        },
      });

      // Schedule second follow-up if this was the first
      if (followUpType === 'first') {
        await followUpQueue.add(
          'follow-up-second',
          {
            conversationId,
            businessId,
            userId,
            followUpType: 'second',
          },
          {
            delay: config.defaults.JOBS.FOLLOW_UP_DELAYS.second,
            attempts: config.defaults.JOBS.MAX_ATTEMPTS,
          }
        );
      }

      console.log(`Processed follow-up ${followUpType} for conversation ${conversationId}`);
    } catch (error) {
      console.error(`Error processing follow-up for conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Process stats aggregation jobs
   */
  static async processStatsAggregation(job: Job<StatsAggregationJobData>): Promise<void> {
    const { businessId, periodStart, periodEnd } = job.data;

    try {
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);

      if (businessId) {
        // Aggregate for specific business
        console.log(`Aggregating stats for business ${businessId}, period ${periodStart} to ${periodEnd}`);
        
        const result = await RevenueEstimator.aggregateStatsForPeriod(
          businessId,
          startDate,
          endDate
        );

        if (result) {
          console.log(`Created aggregated stats record ${result.id}`);
        } else {
          console.log(`No stats to aggregate for business ${businessId}`);
        }
      } else {
        // Aggregate for all businesses
        console.log(`Aggregating stats for all businesses, period ${periodStart} to ${periodEnd}`);
        
        const businesses = await prisma.businessProfile.findMany({
          select: { id: true, igUsername: true },
        });

        for (const business of businesses) {
          try {
            const result = await RevenueEstimator.aggregateStatsForPeriod(
              business.id,
              startDate,
              endDate
            );

            if (result) {
              console.log(`Created aggregated stats for ${business.igUsername}: ${result.id}`);
            }
          } catch (error) {
            console.error(`Error aggregating stats for business ${business.id}:`, error);
            // Continue with other businesses
          }
        }
      }
    } catch (error) {
      console.error(`Error processing stats aggregation:`, error);
      throw error;
    }
  }

  /**
   * Process onboarding email jobs
   */
  static async processOnboardingEmail(job: Job<OnboardingEmailJobData>): Promise<void> {
    const { businessId, emailType } = job.data;

    try {
      if (!emailTransporter) {
        console.log(`Email transporter not configured, skipping onboarding email for business ${businessId}`);
        return;
      }

      const business = await prisma.businessProfile.findUnique({
        where: { id: businessId },
        select: {
          businessName: true,
          email: true,
          igUsername: true,
        },
      });

      if (!business || !business.email) {
        console.log(`Business ${businessId} not found or no email, skipping onboarding email`);
        return;
      }

      const emailContent = this.getOnboardingEmailContent(emailType, business);

      await emailTransporter.sendMail({
        from: config.email.from,
        to: business.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(`Sent onboarding email ${emailType} to ${business.email}`);
    } catch (error) {
      console.error(`Error sending onboarding email for business ${businessId}:`, error);
      throw error;
    }
  }

  /**
   * Generate follow-up messages based on context
   */
  private static generateFollowUpMessage(
    followUpType: 'first' | 'second',
    industry: string,
    _tone: string,
    _service?: string | null
  ): string {
    const messages = {
      first: {
        beauty: "Hi! Just wanted to follow up on your beauty treatment inquiry. We have some great availability this week. Would you like me to check our calendar? 💄✨",
        hair: "Hello! Following up on your hair appointment inquiry. Our stylists have some openings this week. Shall I check what's available for you? 💇‍♀️",
        fitness: "Hey! Just checking in about your fitness consultation. We'd love to help you reach your goals. Want to schedule a quick chat? 💪",
        cleaning: "Hi there! Following up on your cleaning service inquiry. We have some slots available this week. Would you like me to check our schedule? 🧽",
        plumbing: "Hi! Just wanted to follow up on your plumbing inquiry. We can typically get someone out within 24-48 hours. Need us to check availability? 🔧",
        electrical: "Hello! Following up on your electrical work inquiry. We have certified electricians available this week. Want to schedule an estimate? ⚡",
        detailing: "Hi! Just checking in about your car detailing inquiry. We have some great packages available. Would you like to hear about our current specials? 🚗",
        default: "Hi! Just wanted to follow up on your inquiry. We'd love to help you with your needs. Are you still interested in learning more?",
      },
      second: {
        beauty: "Last chance! We have a few spots left this week for beauty treatments. Don't miss out on looking your absolute best! Book now? 💅",
        hair: "Final reminder - we have limited availability for hair appointments this week. Our stylists are booking up fast! Ready to secure your spot? ✂️",
        fitness: "This week only - special offer on fitness consultations! Don't let another week go by without taking the first step. Ready to start your transformation? 🏋️‍♀️",
        cleaning: "Final call - we have just a few cleaning slots left this week. Your home deserves the deep clean it needs! Shall we book you in? 🏠",
        plumbing: "Final reminder - plumbing issues only get worse with time. We have emergency slots available. Want us to take a look before it becomes a bigger problem? 🚨",
        electrical: "Last chance - electrical issues can be safety hazards. We have qualified electricians ready to help. Book your safety inspection today? ⚠️",
        detailing: "Final opportunity - your car deserves the premium treatment! We have limited slots for detailing this week. Ready to make it shine? ✨",
        default: "Last chance to take advantage of our services! We'd hate for you to miss out. Are you ready to move forward?",
      },
    };

    const industryMessages = messages[followUpType][industry as keyof typeof messages.first] || 
                           messages[followUpType].default;

    return industryMessages;
  }

  /**
   * Get onboarding email content
   */
  private static getOnboardingEmailContent(
    emailType: 'welcome' | 'setup_guide' | 'best_practices',
    business: { businessName: string; igUsername: string }
  ) {
    const content = {
      welcome: {
        subject: `Welcome to ReplyoAI, ${business.businessName}! 🎉`,
        html: `
          <h2>Welcome to ReplyoAI!</h2>
          <p>Hi ${business.businessName} team,</p>
          <p>We're excited to help you automate your Instagram DMs and grow your business! 🚀</p>
          <p>Your Instagram account (@${business.igUsername}) is now connected to our intelligent conversation system.</p>
          <h3>What happens next?</h3>
          <ul>
            <li>We'll automatically respond to your Instagram DMs</li>
            <li>Qualify leads and book appointments for you</li>
            <li>Send follow-up messages to increase conversions</li>
            <li>Track your ROI with detailed analytics</li>
          </ul>
          <p>Need help? Just reply to this email and our team will assist you!</p>
          <p>Best regards,<br>The ReplyoAI Team</p>
        `,
        text: `Welcome to ReplyoAI, ${business.businessName}! We're excited to help you automate your Instagram DMs and grow your business. Your account (@${business.igUsername}) is now connected to our system.`,
      },
      setup_guide: {
        subject: `Setup Guide: Maximize Your ReplyoAI Results`,
        html: `
          <h2>Quick Setup Guide</h2>
          <p>Hi ${business.businessName} team,</p>
          <p>To get the most out of ReplyoAI, here's your quick setup checklist:</p>
          <h3>✅ Optimization Checklist</h3>
          <ol>
            <li><strong>Booking Link:</strong> Make sure your booking link is working</li>
            <li><strong>Business Hours:</strong> Update your availability</li>
            <li><strong>Services:</strong> List your main services clearly</li>
            <li><strong>Pricing:</strong> Have clear pricing information ready</li>
          </ol>
          <h3>🎯 Best Practices</h3>
          <ul>
            <li>Respond to manual messages quickly when flagged</li>
            <li>Review your conversation history regularly</li>
            <li>Update your booking availability</li>
          </ul>
          <p>Questions? We're here to help!</p>
          <p>Best regards,<br>The ReplyoAI Team</p>
        `,
        text: `Quick setup guide for ${business.businessName}: Make sure your booking link works, update business hours, list services clearly, and have pricing ready. Questions? Just reply!`,
      },
      best_practices: {
        subject: `How to Maximize Your Bookings with ReplyoAI`,
        html: `
          <h2>Maximize Your Results</h2>
          <p>Hi ${business.businessName} team,</p>
          <p>Here's how to get the most bookings from your Instagram automation:</p>
          <h3>📈 Revenue Boosting Tips</h3>
          <ol>
            <li><strong>Keep booking links updated</strong> - Broken links = lost revenue</li>
            <li><strong>Respond to escalated conversations</strong> - Some leads need human touch</li>
            <li><strong>Post engaging content</strong> - More DMs = more potential customers</li>
            <li><strong>Use Instagram Stories</strong> - Encourage people to DM you</li>
          </ol>
          <h3>🔍 Monitor Your Analytics</h3>
          <p>Check your ReplyoAI dashboard regularly to see:</p>
          <ul>
            <li>Conversion rates by service</li>
            <li>Peak inquiry times</li>
            <li>Revenue estimates</li>
            <li>Follow-up effectiveness</li>
          </ul>
          <p>Need a dashboard walkthrough? Just reply to this email!</p>
          <p>Best regards,<br>The ReplyoAI Team</p>
        `,
        text: `Maximize your ReplyoAI results: Keep booking links updated, respond to escalated conversations, post engaging content, and monitor your analytics dashboard regularly.`,
      },
    };

    return content[emailType];
  }
}

// Create workers
export function createWorkers() {
  const followUpWorker = new Worker<FollowUpJobData>(
    'follow-up',
    JobProcessors.processFollowUp,
    {
      connection: redis,
      concurrency: 5,
    }
  );

  const statsWorker = new Worker<StatsAggregationJobData>(
    'stats-aggregation',
    JobProcessors.processStatsAggregation,
    {
      connection: redis,
      concurrency: 2,
    }
  );

  const emailWorker = new Worker<OnboardingEmailJobData>(
    'onboarding-email',
    JobProcessors.processOnboardingEmail,
    {
      connection: redis,
      concurrency: 3,
    }
  );

  // Worker event handlers
  followUpWorker.on('completed', (job) => {
    console.log(`Follow-up job ${job.id} completed`);
  });

  followUpWorker.on('failed', (job, err) => {
    console.error(`Follow-up job ${job?.id} failed:`, err);
  });

  statsWorker.on('completed', (job) => {
    console.log(`Stats aggregation job ${job.id} completed`);
  });

  statsWorker.on('failed', (job, err) => {
    console.error(`Stats aggregation job ${job?.id} failed:`, err);
  });

  emailWorker.on('completed', (job) => {
    console.log(`Onboarding email job ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`Onboarding email job ${job?.id} failed:`, err);
  });

  return {
    followUpWorker,
    statsWorker,
    emailWorker,
  };
}

// Utility functions for scheduling jobs
export class JobScheduler {
  static async scheduleFollowUp(conversationId: string, businessId: string, userId: string): Promise<void> {
    await followUpQueue.add(
      'follow-up-first',
      {
        conversationId,
        businessId,
        userId,
        followUpType: 'first',
      },
      {
        delay: config.defaults.JOBS.FOLLOW_UP_DELAYS.first,
        attempts: config.defaults.JOBS.MAX_ATTEMPTS,
      }
    );
  }

  static async scheduleStatsAggregation(businessId?: string): Promise<void> {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    await statsQueue.add(
      'hourly-stats-aggregation',
      {
        businessId,
        periodStart: hourAgo.toISOString(),
        periodEnd: now.toISOString(),
      },
      {
        attempts: config.defaults.JOBS.MAX_ATTEMPTS,
      }
    );
  }

  static async scheduleOnboardingEmails(businessId: string): Promise<void> {
    const emails = config.defaults.EMAIL_TEMPLATES.ONBOARDING;

    for (const email of emails) {
      await emailQueue.add(
        `onboarding-${email.template}`,
        {
          businessId,
          emailType: email.template as 'welcome' | 'setup_guide' | 'best_practices',
        },
        {
          delay: email.delay,
          attempts: config.defaults.JOBS.MAX_ATTEMPTS,
        }
      );
    }
  }
}