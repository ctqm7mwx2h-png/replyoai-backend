// Global test teardown
export default async (): Promise<void> => {
  console.log('🧹 Global test teardown started...');
  
  // Clean up any global resources
  // Close database connections, etc.
  
  console.log('✅ Global test teardown completed');
};