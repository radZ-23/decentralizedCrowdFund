// Runs before test files load (setupFiles) so require("../server") skips listen().
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medtrust_test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_for_testing";
process.env.PORT = process.env.PORT || "5001";
