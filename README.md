# ReplyoAI Backend

A minimal license-gate backend for ManyChat templates. This backend manages subscription licensing based on Instagram usernames.

## Architecture

- **Purpose**: License control based on Instagram username and subscription status
- **No Authentication**: Public endpoints for license checks and registration
- **Database**: PostgreSQL with Prisma ORM
- **Payment**: Stripe webhooks for subscription management

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Stripe account with webhook endpoint configured

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure your .env file with:
# - DATABASE_URL
# - STRIPE_SECRET_KEY  
# - STRIPE_WEBHOOK_SECRET

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Onboard Subscription
```
POST /api/onboard
Body: {
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...", // optional
  "plan": "basic" | "premium"
}
```

### Register Instagram Username
```
POST /api/register-ig
Body: {
  "ig_username": "example_business"
}
Logic: 
- Finds most recent ACTIVE subscription without ig_username
- Assigns ig_username to that subscription
```

### Check Access
```
POST /api/check-access
Body: {
  "ig_username": "example_business"
}
Response: {
  "success": true,
  "data": {
    "allowed": boolean
  }
}
Logic:
- If subscription exists AND status === ACTIVE → allowed: true
- Else → allowed: false
```

### Stripe Webhook
```
POST /api/webhooks/stripe
```

## Database Schema

### Subscriptions
- `id`: UUID primary key
- `stripeCustomerId`: Stripe customer ID (unique)
- `stripeSubscriptionId`: Stripe subscription ID (unique, nullable)
- `igUsername`: Instagram username (unique, nullable)
- `status`: PENDING | ACTIVE | INACTIVE | PAST_DUE
- `plan`: basic | premium
- `createdAt`, `updatedAt`: timestamps

## Licensing Logic

1. **Subscription Creation**: Frontend handles Stripe Checkout, then calls `/onboard` to store subscription
2. **Username Registration**: Call `/register-ig` to assign Instagram username to most recent active subscription
3. **Access Control**: ManyChat calls `/check-access` to verify if username has active license
4. **Webhook Processing**: Stripe webhooks update subscription status:
   - `invoice.paid` → ACTIVE
   - `invoice.payment_failed` → INACTIVE  
   - `customer.subscription.deleted` → INACTIVE

## Environment Variables

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
API_BASE_PATH=/api
CORS_ORIGIN=*
```