# ReplyoAI Backend

A minimal access-control backend for ManyChat templates. This backend serves as the single source of truth for subscription management and Instagram page access control.

## Architecture

- **Purpose**: Access control for ManyChat templates based on Instagram Page ID and subscription status
- **No Authentication**: Public endpoints for access checks and webhooks
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

### Connect Instagram Page
```
POST /api/connect-instagram
Body: {
  "subscriptionId": "uuid",
  "instagramPageId": "string"
}
```

### Check Access
```
POST /api/check-access
Body: {
  "instagramPageId": "string"
}
Response: {
  "success": true,
  "data": {
    "allowed": boolean,
    "subscriptionStatus": "ACTIVE" | "CANCELLED" | "PAST_DUE" | null
  }
}
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
- `status`: PENDING | ACTIVE | CANCELLED | PAST_DUE
- `plan`: basic | premium
- `createdAt`, `updatedAt`: timestamps

### Instagram Pages
- `id`: UUID primary key
- `pageId`: Instagram page ID (unique)
- `subscriptionId`: Foreign key to subscriptions
- `connectedAt`: timestamp

## Data Flow

1. **Onboarding**: Frontend handles Stripe Checkout, then calls `/onboard` to store subscription metadata
2. **Instagram Connection**: Call `/connect-instagram` to link Instagram pages to subscriptions
3. **Access Control**: ManyChat calls `/check-access` to verify if a page can use templates
4. **Webhook Processing**: Stripe webhooks update subscription status automatically

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

## Production Deployment

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Database Migrations
```bash
# Production migration
npm run db:deploy
```

### Health Monitoring
- Health check endpoint: `/api/health`
- Database connection verification on startup
- Graceful shutdown handling

## Development Notes

- No user authentication required
- Minimal error handling with structured responses
- Type-safe with TypeScript and Zod validation
- Production-ready logging and error handling
- Stripe webhook signature verification
- Database connection pooling with Prisma