const mongoose = require('mongoose');
const SmartContract = require('../models/SmartContract');
const { getContractMilestones } = require('./contractUtils');

/**
 * Real-Time Blockchain Indexer
 * Polls the Hardhat/Polygon blockchain for any external updates on our
 * deployed MedTrustFundEscrow contracts and syncs the status to MongoDB.
 */
let indexerInterval = null;

async function syncContracts() {
  try {
    const contracts = await SmartContract.find({ status: 'active' });
    
    if (contracts.length === 0) return;

    for (const contract of contracts) {
      if (!contract.contractAddress) continue;
      
      try {
        const chainMilestones = await getContractMilestones(contract.contractAddress);
        
        let requiresUpdate = false;
        
        // Loop through and sync each milestone confirmation back into our database
        for (let i = 0; i < chainMilestones.length; i++) {
          const dbMilestone = contract.milestones[i];
          const chainMilestone = chainMilestones[i];

          if (dbMilestone && chainMilestone && !dbMilestone.confirmed && chainMilestone.confirmed) {
            console.log(`[INDEXER] Milestone ${i} confirmed on-chain for contract ${contract.contractAddress}. Syncing to MongoDB...`);
            dbMilestone.confirmed = true;
            dbMilestone.releasedAt = new Date();
            requiresUpdate = true;
          }
        }
        
        if (requiresUpdate) {
          await contract.save();
        }

      } catch (err) {
        console.warn(`[INDEXER] Failed to poll contract ${contract.contractAddress}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('[INDEXER] Critical sync error:', error);
  }
}

function startIndexer(pollIntervalSeconds = 30) {
  if (indexerInterval) {
    console.log('[INDEXER] Already running.');
    return;
  }
  
  console.log(`[INDEXER] Starting real-time contract synchronization every ${pollIntervalSeconds} seconds...`);
  
  // Run immediately once
  syncContracts();
  
  // Schedule
  indexerInterval = setInterval(syncContracts, pollIntervalSeconds * 1000);
}

function stopIndexer() {
  if (indexerInterval) {
    clearInterval(indexerInterval);
    indexerInterval = null;
    console.log('[INDEXER] Stopped.');
  }
}

module.exports = {
  startIndexer,
  stopIndexer,
  syncContracts
};
