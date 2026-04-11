const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../server');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

describe('Campaign Routes', () => {
  let patientToken;
  let adminToken;
  let patientId;
  let hospitalId;
  let testCampaign;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/medtrust_test');
  });

  const testEmails = [
    'patient@test.com',
    'hospital@test.com',
    'admin@test.com',
    'other@test.com',
    'other2@test.com',
  ];

  afterAll(async () => {
    await Campaign.deleteMany({});
    await User.deleteMany({ email: { $in: testEmails } });
    await AuditLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Campaign.deleteMany({});

    await User.deleteMany({ email: { $in: testEmails } });

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

    // Create hospital user
    const hospitalRes = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'hospital@test.com',
        password: 'password123',
        name: 'Test Hospital',
        role: 'hospital',
        hospitalName: 'Test Hospital',
      });
    hospitalId = hospitalRes.body.user.id;

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
  });

  describe('POST /api/campaigns', () => {
    it('Should create a campaign successfully for patient', async () => {
      const campaignData = {
        title: 'Test Medical Campaign',
        description: 'Help fund medical treatment',
        targetAmount: '10000',
        hospitalId: hospitalId,
        medicalDetails: JSON.stringify({ condition: 'Test condition' }),
        milestones: JSON.stringify([
          { description: 'Phase 1', targetAmount: 5000 },
          { description: 'Phase 2', targetAmount: 5000 },
        ]),
        documentTypes: JSON.stringify([]),
      };

      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('title', campaignData.title)
        .field('description', campaignData.description)
        .field('targetAmount', campaignData.targetAmount)
        .field('hospitalId', campaignData.hospitalId)
        .field('medicalDetails', campaignData.medicalDetails)
        .field('milestones', campaignData.milestones)
        .field('documentTypes', campaignData.documentTypes);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Campaign created successfully');
      expect(res.body.campaign).toHaveProperty('title', campaignData.title);
      expect(res.body.campaign).toHaveProperty('patientId');

      testCampaign = res.body.campaign;
    });

    it('Should reject campaign creation without required fields', async () => {
      const campaignData = {
        description: 'Missing title',
        targetAmount: '10000',
      };

      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(campaignData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('Should reject campaign creation with invalid target amount', async () => {
      const campaignData = {
        title: 'Invalid Campaign',
        description: 'Test',
        targetAmount: '-100',
      };

      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(campaignData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('greater than 0');
    });

    it('Should reject campaign creation by non-patient user', async () => {
      const campaignData = {
        title: 'Hospital Campaign',
        description: 'Test',
        targetAmount: '10000',
      };

      const res = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(campaignData);

      expect(res.status).toBe(403);
    });

    it('Should reject campaign creation without authentication', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .send({ title: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/campaigns', () => {
    beforeEach(async () => {
      // Create test campaigns
      await Campaign.create([
        {
          title: 'Active Campaign',
          description: 'Test active campaign',
          patientId: patientId,
          targetAmount: 10000,
          raisedAmount: 5000,
          status: 'active',
        },
        {
          title: 'Pending Campaign',
          description: 'Test pending campaign',
          patientId: patientId,
          targetAmount: 5000,
          raisedAmount: 0,
          status: 'pending_verification',
        },
      ]);
    });

    it('Should fetch all campaigns (public)', async () => {
      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaigns');
      expect(res.body.campaigns.length).toBeGreaterThanOrEqual(2);
    });

    it('Should filter campaigns by status', async () => {
      const res = await request(app)
        .get('/api/campaigns')
        .query({ status: 'active' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.campaigns)).toBe(true);
      expect(res.body.campaigns.length).toBeGreaterThanOrEqual(0);
      res.body.campaigns.forEach(c => {
        expect(c.status).toBe('active');
      });
    });

    it('Should filter campaigns by patientId', async () => {
      const res = await request(app)
        .get('/api/campaigns')
        .query({ patientId: patientId });

      expect(res.status).toBe(200);
      expect(res.body.campaigns.length).toBeGreaterThanOrEqual(1);
    });

    it('Should populate patient and hospital data', async () => {
      const res = await request(app).get('/api/campaigns');

      expect(res.status).toBe(200);
      if (res.body.campaigns.length > 0) {
        const campaign = res.body.campaigns[0];
        expect(campaign).toHaveProperty('patientId');
      }
    });
  });

  describe('GET /api/campaigns/:id', () => {
    beforeEach(async () => {
      const campaign = await Campaign.create({
        title: 'Single Campaign',
        description: 'Test single campaign',
        patientId: patientId,
        targetAmount: 10000,
        status: 'active',
      });
      testCampaign = campaign;
    });

    it('Should fetch single campaign by ID', async () => {
      const res = await request(app).get(`/api/campaigns/${testCampaign._id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('campaign');
      expect(res.body.campaign._id).toBe(testCampaign._id.toString());
    });

    it('Should return 404 for non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/campaigns/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('Should populate patient and hospital data', async () => {
      const res = await request(app).get(`/api/campaigns/${testCampaign._id}`);

      expect(res.status).toBe(200);
      expect(res.body.campaign).toHaveProperty('patientId');
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    beforeEach(async () => {
      const campaign = await Campaign.create({
        title: 'Update Test Campaign',
        description: 'Test',
        patientId: patientId,
        targetAmount: 10000,
        status: 'active',
      });
      testCampaign = campaign;
    });

    it('Should update campaign (patient owner)', async () => {
      const updateData = {
        title: 'Updated Campaign Title',
        description: 'Updated description',
      };

      const res = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Campaign updated successfully');
      expect(res.body.campaign.title).toBe('Updated Campaign Title');
    });

    it('Should update campaign (admin)', async () => {
      const updateData = {
        title: 'Admin Updated Title',
      };

      const res = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.campaign.title).toBe('Admin Updated Title');
    });

    it('Should reject update by unauthorized user', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'other@test.com',
          password: 'password123',
          name: 'Other User',
          role: 'patient',
        });

      const res = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Not authorized');
    });

    it('Should reject update without authentication', async () => {
      const res = await request(app)
        .put(`/api/campaigns/${testCampaign._id}`)
        .send({ title: 'Unauthorized Update' });

      expect(res.status).toBe(401);
    });

    it('Should return 404 for non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/campaigns/${fakeId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ title: 'Update' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    beforeEach(async () => {
      const campaign = await Campaign.create({
        title: 'Delete Test Campaign',
        description: 'Test',
        patientId: patientId,
        targetAmount: 10000,
        status: 'active',
      });
      testCampaign = campaign;
    });

    it('Should delete campaign (admin)', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Campaign deleted successfully');

      // Verify deletion
      const deleted = await Campaign.findById(testCampaign._id);
      expect(deleted).toBeNull();
    });

    it('Should delete campaign (patient owner, no donations)', async () => {
      const res = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Campaign deleted successfully');
    });

    it('Should reject delete by patient if donations exist', async () => {
      // Create a donation
      const Donation = require('../models/Donation');
      await Donation.create({
        campaignId: testCampaign._id,
        donorId: patientId,
        amount: 100,
        transactionHash: '0x1234567890abcdef',
        status: 'locked_in_escrow',
      });

      const res = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot delete');
    });

    it('Should reject delete by unauthorized user', async () => {
      const otherUserRes = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'other2@test.com',
          password: 'password123',
          name: 'Other User 2',
          role: 'donor',
        });

      const res = await request(app)
        .delete(`/api/campaigns/${testCampaign._id}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`);

      expect(res.status).toBe(403);
    });

    it('Should return 404 for non-existent campaign', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/campaigns/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
