const mongoose = require('mongoose');
const Campaign = require('./models/Campaign');
const User = require('./models/User');

mongoose.connect('mongodb://127.0.0.1:27017/medtrust').then(async () => {
  try {
    const campaignId = '69d3e8e3c3b9b585294c1158';
    const c = await Campaign.findById(campaignId);
    if (!c) {
      console.log('Campaign not found');
      return process.exit(1);
    }
    
    // Give patient a wallet
    if (c.patientId) {
      await User.findByIdAndUpdate(c.patientId, {
        walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
      });
      console.log('Patient wallet added');
    }
    
    // Find or create hospital
    let h = await User.findOne({ role: 'hospital' });
    if (!h) {
      h = await User.create({
        email: 'hospital@medtrust.com',
        password: 'HospitalPassword123!',
        name: 'MedTrust Central Hospital',
        hospitalName: 'MedTrust Central Hospital',
        role: 'hospital',
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        verified: true,
        isActive: true
      });
    } else {
      h.walletAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      h.verified = true;
      await h.save();
    }
    
    c.hospitalId = h._id;
    await c.save();
    console.log('Hospital wallet assigned successfully');
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
});
