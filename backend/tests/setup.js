// Jest test setup file (setupFilesAfterEnv — runs before each test file)
// Keep NODE_ENV and DB URI set so requiring ../server does not call listen().

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/medtrust_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing';
process.env.PORT = '5001'; // Use different port for tests

// Increase timeout for blockchain operations
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

// Global cleanup
afterAll(async () => {
  console.log('Cleaning up test environment...');
});
