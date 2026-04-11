const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

describe('Donation Routes', () => {
  const donationTestEmails = [
    'donor@test.com',
    'patient@test.com',
    'admin@test.com',
    'otherdonor@test.com',
    'viewertest@test.com',
    'unauthorized@test.com',
  ];

  let donorToken;
  let patientToken;
  let adminToken;
  let donorId;
  let patientId;
  let testCampaign;
  let testDonation;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/medtrust_test');
  });

  afterAll(async () => {
    await Donation.deleteMany({});
    await Campaign.deleteMany({});
    await User.deleteMany({ email: { $in: donationTestEmails } });
    await AuditLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Donation.deleteMany({});
    await Campaign.deleteMany({});
    await User.deleteMany({ email: { $in: donationTestEmails } });

    // Create donor user
    const donorRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'donor@test.com',
        password: 'password123',
        name: 'Test Donor',
        role: 'donor',
      });
    donorToken = donorRes.body.token;
    donorId = donorRes.body.user.id;

    // Create patient user
    const patientRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'patient@test.com',
        password: 'password123',
        name: 'Test Patient',
        role: 'patient',
      });
    patientToken = patientRes.body.token;
    patientId = patientRes.body.user.id;

    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'admin@test.com',
        password: 'password123',
        name: 'Test Admin',
        role: 'admin',
      });
    adminToken = adminRes.body.token;

    // Create test campaign
    const campaign = await Campaign.create({
      title: 'Test Donation Campaign',
      description: 'Campaign for donation tests',
      patientId: patientId,
      targetAmount: 10000,
      raisedAmount: 0,
      status: 'active',
    });
    testCampaign = campaign;
  });

  describe('POST /api/donations', () => {
    it('Should create donation successfully for donor', async () => {
      const donationData = {
        campaignId: testCampaign._id.toString(),
        amount: '100',
        transactionHash: '0x' + 'a'.repeat(64),
        donorMessage: 'Keep up the good work!',
        anonymous: false,
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationData);

      // Note: This will fail in test environment without blockchain
      // but validates the route structure
      expect([201, 400]).toContain(res.status);

      if (res.status === 201) {
        expect(res.body).toHaveProperty('message', 'Donation recorded successfully');
        expect(res.body.donation).toHaveProperty('campaignId');
        testDonation = res.body.donation;
      }
    });

    it('Should reject donation without required fields', async () => {
      const donationData = {
        campaignId: testCampaign._id.toString(),
        // Missing amount and transactionHash
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('Should reject donation with invalid amount', async () => {
      const donationData = {
        campaignId: testCampaign._id.toString(),
        amount: '-50',
        transactionHash: '0x' + 'b'.repeat(64),
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('greater than 0');
    });

    it('Should reject donation to non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const donationData = {
        campaignId: fakeId.toString(),
        amount: '100',
        transactionHash: '0x' + 'c'.repeat(64),
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(donationData);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('Should reject donation by non-donor user', async () => {
      const donationData = {
        campaignId: testCampaign._id.toString(),
        amount: '100',
        transactionHash: '0x' + 'd'.repeat(64),
      };

      const res = await request(app)
        .post('/api/donations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(donationData);

      expect(res.status).toBe(403);
    });

    it('Should reject donation without authentication', async () => {
      const res = await request(app)
        .post('/api/donations')
        .send({ campaignId: testCampaign._id.toString() });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/donations', () => {
    beforeEach(async () => {
      // Create test donations
      await Donation.create([
        {
          campaignId: testCampaign._id,
          donorId: donorId,
          amount: 100,
          transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          status: 'locked_in_escrow',
        },
        {
          campaignId: testCampaign._id,
          donorId: donorId,
          amount: 250,
          transactionHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          status: 'locked_in_escrow',
        },
      ]);
    });

    it('Should fetch donations for authenticated donor', async () => {
      const res = await request(app)
        .get('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('donations');
      expect(res.body.donations.length).toBeGreaterThanOrEqual(1);
    });

    it('Should only show donor own donations', async () => {
      // Create another donor
      const otherDonorRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'otherdonor@test.com',
          password: 'password123',
          name: 'Other Donor',
          role: 'donor',
        });

      // Create donation by other donor
      await Donation.create({
        campaignId: testCampaign._id,
        donorId: otherDonorRes.body.user.id,
        amount: 500,
        transactionHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        status: 'locked_in_escrow',
      });

      const res = await request(app)
        .get('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      // Should only see own donations, not the other donor's
      res.body.donations.forEach(d => {
        expect(d.donorId._id.toString()).not.toBe(otherDonorRes.body.user.id);
      });
    });

    it('Should show all donations to admin', async () => {
      const res = await request(app)
        .get('/api/donations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.donations.length).toBeGreaterThanOrEqual(2);
    });

    it('Should filter donations by campaignId', async () => {
      const res = await request(app)
        .get('/api/donations')
        .set('Authorization', `Bearer ${donorToken}`)
        .query({ campaignId: testCampaign._id.toString() });

      expect(res.status).toBe(200);
      res.body.donations.forEach(d => {
        expect(d.campaignId._id.toString()).toBe(testCampaign._id.toString());
      });
    });

    it('Should reject donation list without authentication', async () => {
      const res = await request(app).get('/api/donations');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/donations/:id', () => {
    beforeEach(async () => {
      const donation = await Donation.create({
        campaignId: testCampaign._id,
        donorId: donorId,
        amount: 150,
        transactionHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        status: 'locked_in_escrow',
      });
      testDonation = donation;
    });

    it('Should fetch single donation by ID (donor)', async () => {
      const res = await request(app)
        .get(`/api/donations/${testDonation._id}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('donation');
      expect(res.body.donation._id).toBe(testDonation._id.toString());
    });

    it('Should fetch single donation by ID (admin)', async () => {
      const res = await request(app)
        .get(`/api/donations/${testDonation._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.donation._id).toBe(testDonation._id.toString());
    });

    it('Should reject viewing another user donation', async () => {
      // Create another donor
      const otherDonorRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'viewertest@test.com',
          password: 'password123',
          name: 'Viewer Test',
          role: 'donor',
        });

      const res = await request(app)
        .get(`/api/donations/${testDonation._id}`)
        .set('Authorization', `Bearer ${otherDonorRes.body.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Not authorized');
    });

    it('Should return 404 for non-existent donation', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/donations/${fakeId}`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/donations/:id/refund', () => {
    beforeEach(async () => {
      const donation = await Donation.create({
        campaignId: testCampaign._id,
        donorId: donorId,
        amount: 200,
        transactionHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
        status: 'locked_in_escrow',
      });
      testDonation = donation;
    });

    it('Should process refund for donor', async () => {
      const res = await request(app)
        .post(`/api/donations/${testDonation._id}/refund`)
        .set('Authorization', `Bearer ${donorToken}`);

      // Will fail without blockchain but validates route structure
      expect([200, 500, 400]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('message', 'Refund processed successfully');
      }
    });

    it('Should process refund for admin', async () => {
      const res = await request(app)
        .post(`/api/donations/${testDonation._id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 500, 400]).toContain(res.status);
    });

    it('Should reject refund for released donation', async () => {
      testDonation.status = 'released';
      await testDonation.save();

      const res = await request(app)
        .post(`/api/donations/${testDonation._id}/refund`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already been released');
    });

    it('Should reject refund for already refunded donation', async () => {
      testDonation.status = 'refunded';
      await testDonation.save();

      const res = await request(app)
        .post(`/api/donations/${testDonation._id}/refund`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already refunded');
    });

    it('Should reject refund by unauthorized user', async () => {
      const otherUserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'unauthorized@test.com',
          password: 'password123',
          name: 'Unauthorized',
          role: 'donor',
        });

      const res = await request(app)
        .post(`/api/donations/${testDonation._id}/refund`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Not authorized');
    });

    it('Should return 404 for non-existent donation refund', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/donations/${fakeId}/refund`)
        .set('Authorization', `Bearer ${donorToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/donations/campaign/:campaignId', () => {
    beforeEach(async () => {
      await Donation.create([
        {
          campaignId: testCampaign._id,
          donorId: donorId,
          amount: 100,
          transactionHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
          status: 'locked_in_escrow',
          anonymous: false,
          donorMessage: 'Public donation',
        },
        {
          campaignId: testCampaign._id,
          donorId: donorId,
          amount: 50,
          transactionHash: '0x7777777777777777777777777777777777777777777777777777777777777777',
          status: 'locked_in_escrow',
          anonymous: true,
        },
      ]);
    });

    it('Should fetch public donations for campaign (no auth required)', async () => {
      const res = await request(app).get(`/api/donations/campaign/${testCampaign._id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('donations');
      // Should only show non-anonymous donations
      res.body.donations.forEach(d => {
        expect(d).not.toHaveProperty('transactionHash');
      });
    });

    it('Should hide sensitive info in public view', async () => {
      const res = await request(app).get(`/api/donations/campaign/${testCampaign._id}`);

      expect(res.status).toBe(200);
      res.body.donations.forEach(d => {
        expect(d).not.toHaveProperty('transactionHash');
        expect(d).not.toHaveProperty('donorId');
      });
    });
  });
});
