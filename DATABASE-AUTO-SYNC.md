# Automatic Database Schema Synchronization

The application now automatically synchronizes the database schema on startup using Prisma's `db push` functionality.

## How It Works

The application will automatically run `prisma db push` on startup in the following conditions:

1. **Production Mode**: When `NODE_ENV=production`
2. **Explicit Enable**: When `AUTO_DB_SYNC=true`
3. **Production Database**: When `DATABASE_URL` contains `postgresql://`

## Environment Variables

- `NODE_ENV=production` - Enables automatic schema sync in production
- `AUTO_DB_SYNC=true` - Forces schema sync regardless of environment
- `DATABASE_URL` - If contains PostgreSQL URL, enables auto-sync

## Startup Sequence

1. **Database Connection Test** - Verifies database connectivity
2. **Schema Synchronization** - Runs `prisma db push` if conditions are met
3. **Server Start** - Starts the HTTP server

## Logging

The system provides detailed logging:

- ✅ `"Database connected successfully"` - Connection established
- ✅ `"Database schema synchronized successfully"` - Schema updated
- ⚠️ `"Database schema is already synchronized"` - No changes needed
- ⚠️ `"Skipping database schema sync (development mode)"` - Disabled in dev
- ❌ `"Database schema sync failed"` - Error occurred (continues startup)

## Error Handling

- **Graceful Degradation**: Schema sync failures don't prevent server startup
- **Connectivity Check**: Validates database accessibility after sync failures
- **Timeout Protection**: 60-second timeout prevents hanging
- **Specific Error Handling**: Recognizes "already in sync" vs real errors

## Example Usage

### Production Deployment
```bash
NODE_ENV=production npm start
# Automatically runs schema sync
```

### Development with Auto-Sync
```bash
AUTO_DB_SYNC=true npm run dev
# Forces schema sync in development
```

### Development (Default)
```bash
npm run dev
# Skips schema sync in development
```

## Benefits

1. **Zero-Downtime Deployment**: Schema updates applied automatically
2. **Production Safety**: Runs only when explicitly enabled
3. **Error Resilience**: Continues startup even if sync fails
4. **Comprehensive Logging**: Full visibility into sync process
5. **Performance**: Runs only once on startup, not on every request

## Migration from Manual Process

Previously, you needed to run:
```bash
npx prisma db push
npm start
```

Now, just run:
```bash
NODE_ENV=production npm start
```

The schema synchronization happens automatically before the server starts.