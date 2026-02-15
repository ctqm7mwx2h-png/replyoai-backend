// Global test setup
export default async (): Promise<void> => {
  console.log('🧪 Global test setup started...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise during testing
  process.env.DISABLE_METRICS = 'true';
  process.env.DISABLE_BACKGROUND_JOBS = 'true';
  
  console.log('✅ Global test setup completed');
};