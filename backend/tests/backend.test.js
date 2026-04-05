require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

describe('Auth Routes', () => {
  const rnd = Date.now();

  test('POST /auth/signup — should register a new patient', async () => {
    const res = await axios.post(`${API_URL}/auth/signup`, {
      name: `Test Patient ${rnd}`, email: `patient_ut_${rnd}@test.com`,
      password: 'Password123', role: 'patient'
    });
    expect(res.status).toBe(201);
    expect(res.data.token).toBeDefined();
    expect(res.data.user.role).toBe('patient');
  });

  test('POST /auth/signup — should reject duplicate email', async () => {
    try {
      await axios.post(`${API_URL}/auth/signup`, {
        name: 'Dup', email: `patient_ut_${rnd}@test.com`,
        password: 'Password123', role: 'patient'
      });
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.error).toMatch(/already registered/i);
    }
  });

  test('POST /auth/login — should login successfully', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: `patient_ut_${rnd}@test.com`, password: 'Password123'
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeDefined();
  });

  test('POST /auth/login — should reject wrong password', async () => {
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: `patient_ut_${rnd}@test.com`, password: 'WrongPassword'
      });
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  test('GET /auth/profile — should require authentication', async () => {
    try {
      await axios.get(`${API_URL}/auth/profile`);
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.response.status).toBe(401);
    }
  });

  test('GET /auth/profile — should return profile with valid token', async () => {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: `patient_ut_${rnd}@test.com`, password: 'Password123'
    });
    const res = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    expect(res.status).toBe(200);
    expect(res.data.user.email).toBe(`patient_ut_${rnd}@test.com`);
  });
});

describe('Campaign Routes', () => {
  const rnd = Date.now() + 1;
  let token;

  beforeAll(async () => {
    await axios.post(`${API_URL}/auth/signup`, {
      name: `Campaign Patient ${rnd}`, email: `camp_pat_${rnd}@test.com`,
      password: 'Password123', role: 'patient'
    });
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: `camp_pat_${rnd}@test.com`, password: 'Password123'
    });
    token = res.data.token;
  });

  test('GET /campaigns — should return campaigns list', async () => {
    const res = await axios.get(`${API_URL}/campaigns`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.campaigns)).toBe(true);
  });

  test('GET /campaigns/:id — should return 404 for invalid id', async () => {
    try {
      await axios.get(`${API_URL}/campaigns/000000000000000000000000`);
      throw new Error('Should have failed');
    } catch (err) {
      expect(err.response.status).toBe(404);
    }
  });
});

describe('Health Check', () => {
  test('GET /health — should return status', async () => {
    const res = await axios.get(`${API_URL}/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBeDefined();
  });
});

describe('Encryption Utility', () => {
  const fs = require('fs');
  const path = require('path');
  const { encryptFile, decryptFile } = require('../utils/encryption');

  test('should encrypt and decrypt a file correctly', () => {
    const tmpFile = path.join(__dirname, 'test_encrypt_tmp.txt');
    const original = 'Patient Name: John Doe\nDiagnosis: Test data';
    fs.writeFileSync(tmpFile, original);

    encryptFile(tmpFile);
    const encrypted = fs.readFileSync(tmpFile);
    expect(encrypted.toString()).not.toBe(original);

    const decrypted = decryptFile(tmpFile);
    expect(decrypted.toString()).toBe(original);

    fs.unlinkSync(tmpFile);
  });
});
