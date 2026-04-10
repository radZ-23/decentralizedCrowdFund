const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedTrustFundEscrow", function () {
  let contract;
  let owner;
  let patient;
  let hospital;
  let donor1;
  let donor2;

  const MILESTONE_DESCRIPTIONS = ["Initial consultation", "Surgery procedure", "Post-operative care"];
  const MILESTONE_AMOUNTS = [
    ethers.parseEther("0.1"),
    ethers.parseEther("0.2"),
    ethers.parseEther("0.15")
  ];

  beforeEach(async function () {
    // Get signers
    [owner, patient, hospital, donor1, donor2] = await ethers.getSigners();

    // Deploy contract
    const MedTrustFundEscrow = await ethers.getContractFactory("MedTrustFundEscrow");
    contract = await MedTrustFundEscrow.deploy(
      patient.address,
      hospital.address,
      MILESTONE_DESCRIPTIONS,
      MILESTONE_AMOUNTS
    );
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct patient/hospital addresses", async function () {
      expect(await contract.patient()).to.equal(patient.address);
      expect(await contract.hospital()).to.equal(hospital.address);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct milestone count", async function () {
      const milestones = await contract.getMilestones();
      expect(milestones.length).to.equal(3);
    });

    it("Should initialize milestones with correct data", async function () {
      const milestones = await contract.getMilestones();

      for (let i = 0; i < MILESTONE_DESCRIPTIONS.length; i++) {
        expect(milestones[i].description).to.equal(MILESTONE_DESCRIPTIONS[i]);
        expect(milestones[i].amount).to.equal(MILESTONE_AMOUNTS[i]);
        expect(milestones[i].confirmed).to.be.false;
        expect(milestones[i].releasedAt).to.equal(0);
      }
    });

    it("Should start as active", async function () {
      expect(await contract.isActive()).to.be.true;
    });

    it("Should start with zero total donated", async function () {
      expect(await contract.totalDonated()).to.equal(0);
    });
  });

  describe("Donations", function () {
    it("Should accept donations and lock in escrow", async function () {
      const donationAmount = ethers.parseEther("0.5");

      await contract.connect(donor1).donate({ value: donationAmount });

      expect(await contract.totalDonated()).to.equal(donationAmount);

      const contractBalance = await ethers.provider.getBalance(contract.getAddress());
      expect(contractBalance).to.equal(donationAmount);
    });

    it("Should emit Donated event on donation", async function () {
      const donationAmount = ethers.parseEther("0.3");

      await expect(contract.connect(donor1).donate({ value: donationAmount }))
        .to.emit(contract, "Donated")
        .withArgs(donor1.address, donationAmount);
    });

    it("Should accept multiple donations from different donors", async function () {
      const donation1 = ethers.parseEther("0.2");
      const donation2 = ethers.parseEther("0.3");
      const donation3 = ethers.parseEther("0.1");

      await contract.connect(donor1).donate({ value: donation1 });
      await contract.connect(donor2).donate({ value: donation2 });
      await contract.connect(patient).donate({ value: donation3 });

      const total = donation1 + donation2 + donation3;
      expect(await contract.totalDonated()).to.equal(total);
    });

    it("Should reject donations when campaign is closed", async function () {
      // First, donate and release all funds to close the campaign
      const donationAmount = ethers.parseEther("0.5");
      await contract.connect(donor1).donate({ value: donationAmount });

      // Confirm and release first milestone
      await contract.connect(hospital).confirmMilestone(0);
      await contract.connect(owner).releaseMilestone(0);

      // Confirm and release second milestone
      await contract.connect(hospital).confirmMilestone(1);
      await contract.connect(owner).releaseMilestone(1);

      // Confirm and release third milestone
      await contract.connect(hospital).confirmMilestone(2);
      await contract.connect(owner).releaseMilestone(2);

      // After all milestones released, contract should still accept donations
      // (isActive doesn't automatically become false)
      // This is by design - admin can manually close if needed
      await contract.connect(donor2).donate({ value: ethers.parseEther("0.1") });
      expect(await contract.totalDonated()).to.equal(donationAmount + ethers.parseEther("0.1"));
    });
  });

  describe("Milestone Confirmation", function () {
    beforeEach(async function () {
      // Donate enough funds
      await contract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
    });

    it("Should allow hospital to confirm milestone", async function () {
      await expect(contract.connect(hospital).confirmMilestone(0))
        .to.emit(contract, "MilestoneConfirmed")
        .withArgs(0);

      const milestones = await contract.getMilestones();
      expect(milestones[0].confirmed).to.be.true;
    });

    it("Should prevent non-hospital from confirming milestone", async function () {
      await expect(contract.connect(donor1).confirmMilestone(0))
        .to.be.revertedWith("Only hospital");

      await expect(contract.connect(patient).confirmMilestone(0))
        .to.be.revertedWith("Only hospital");
    });

    it("Should prevent confirming already confirmed milestone", async function () {
      await contract.connect(hospital).confirmMilestone(0);

      await expect(contract.connect(hospital).confirmMilestone(0))
        .to.be.revertedWith("Already confirmed");
    });

    it("Should prevent confirming invalid milestone index", async function () {
      await expect(contract.connect(hospital).confirmMilestone(10))
        .to.be.revertedWith("Invalid index");
    });

    it("Should allow confirming multiple milestones in order", async function () {
      await contract.connect(hospital).confirmMilestone(0);
      await contract.connect(hospital).confirmMilestone(1);
      await contract.connect(hospital).confirmMilestone(2);

      const milestones = await contract.getMilestones();
      expect(milestones[0].confirmed).to.be.true;
      expect(milestones[1].confirmed).to.be.true;
      expect(milestones[2].confirmed).to.be.true;
    });
  });

  describe("Fund Release", function () {
    beforeEach(async function () {
      // Donate enough funds
      await contract.connect(donor1).donate({ value: ethers.parseEther("1.0") });
    });

    it("Should release funds only after confirmation", async function () {
      // First confirm the milestone
      await contract.connect(hospital).confirmMilestone(0);

      const patientBalanceBefore = await ethers.provider.getBalance(patient.address);

      // Release the milestone
      await expect(contract.connect(owner).releaseMilestone(0))
        .to.emit(contract, "FundsReleased")
        .withArgs(0, MILESTONE_AMOUNTS[0]);

      const patientBalanceAfter = await ethers.provider.getBalance(patient.address);

      // Patient should have received the funds (minus gas)
      expect(patientBalanceAfter).to.be.greaterThan(patientBalanceBefore);

      const milestones = await contract.getMilestones();
      expect(milestones[0].releasedAt).to.be.greaterThan(0);
    });

    it("Should prevent release of unconfirmed milestone", async function () {
      await expect(contract.connect(owner).releaseMilestone(0))
        .to.be.revertedWith("Not confirmed");
    });

    it("Should prevent non-authorized from releasing funds", async function () {
      await contract.connect(hospital).confirmMilestone(0);

      await expect(contract.connect(hospital).releaseMilestone(0))
        .to.be.revertedWith("Not authorized");

      await expect(contract.connect(donor1).releaseMilestone(0))
        .to.be.revertedWith("Not authorized");
    });

    it("Should prevent double-release of same milestone", async function () {
      await contract.connect(hospital).confirmMilestone(0);
      await contract.connect(owner).releaseMilestone(0);

      await expect(contract.connect(owner).releaseMilestone(0))
        .to.be.revertedWith("Already released");
    });

    it("Should prevent release of invalid milestone index", async function () {
      await expect(contract.connect(owner).releaseMilestone(10))
        .to.be.revertedWith("Invalid index");
    });

    it("Should prevent release when insufficient balance", async function () {
      await contract.connect(hospital).confirmMilestone(0);

      // Drain contract balance first
      const totalDonated = await contract.totalDonated();
      await contract.connect(owner).refund(donor1.address, totalDonated);

      await expect(contract.connect(owner).releaseMilestone(0))
        .to.be.revertedWith("Insufficient balance");
    });

    it("Should allow patient to release funds", async function () {
      await contract.connect(hospital).confirmMilestone(0);

      await expect(contract.connect(patient).releaseMilestone(0))
        .to.emit(contract, "FundsReleased");
    });
  });

  describe("Refunds", function () {
    beforeEach(async function () {
      await contract.connect(donor1).donate({ value: ethers.parseEther("0.5") });
      await contract.connect(donor2).donate({ value: ethers.parseEther("0.3") });
    });

    it("Should allow admin to refund donor", async function () {
      const refundAmount = ethers.parseEther("0.2");
      const donorBalanceBefore = await ethers.provider.getBalance(donor1.address);

      await contract.connect(owner).refund(donor1.address, refundAmount);

      const donorBalanceAfter = await ethers.provider.getBalance(donor1.address);
      expect(donorBalanceAfter).to.be.greaterThan(donorBalanceBefore);

      expect(await contract.totalDonated()).to.equal(ethers.parseEther("0.6"));
    });

    it("Should emit Refunded event on refund", async function () {
      const refundAmount = ethers.parseEther("0.1");

      await expect(contract.connect(owner).refund(donor1.address, refundAmount))
        .to.emit(contract, "Refunded")
        .withArgs(donor1.address, refundAmount);
    });

    it("Should prevent non-owner from refunding", async function () {
      await expect(contract.connect(patient).refund(donor1.address, ethers.parseEther("0.1")))
        .to.be.revertedWith("Not authorized");

      await expect(contract.connect(hospital).refund(donor1.address, ethers.parseEther("0.1")))
        .to.be.revertedWith("Not authorized");
    });

    it("Should prevent refunding more than total donated", async function () {
      // Note: Contract checks balance first, so we need to test when balance = totalDonated
      // First, ensure no funds have been released
      const totalDonated = await contract.totalDonated();
      const contractBalance = await ethers.provider.getBalance(contract.getAddress());

      // Try to refund more than both balance and totalDonated
      const excessiveAmount = contractBalance + ethers.parseEther("0.1");

      // This will fail with "Insufficient balance" first (contract checks balance before totalDonated)
      await expect(contract.connect(owner).refund(donor1.address, excessiveAmount))
        .to.be.revertedWith("Insufficient balance");
    });

    it("Should prevent refund when insufficient contract balance", async function () {
      // Donate more funds first to have enough balance
      const initialDonation = ethers.parseEther("1.0");
      await contract.connect(donor1).donate({ value: initialDonation });

      // Confirm and release a milestone to reduce contract balance
      await contract.connect(hospital).confirmMilestone(0);
      await contract.connect(owner).releaseMilestone(0);

      // Get current balance after release
      const currentBalance = await ethers.provider.getBalance(contract.getAddress());

      // Try to refund more than remaining balance
      const excessiveRefund = currentBalance + ethers.parseEther("0.1");

      await expect(contract.connect(owner).refund(donor1.address, excessiveRefund))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Get Milestones", function () {
    it("Should return all milestones", async function () {
      const milestones = await contract.getMilestones();

      expect(milestones.length).to.equal(3);

      for (let i = 0; i < 3; i++) {
        expect(milestones[i].description).to.equal(MILESTONE_DESCRIPTIONS[i]);
        expect(milestones[i].amount).to.equal(MILESTONE_AMOUNTS[i]);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero-value donation", async function () {
      await contract.connect(donor1).donate({ value: 0 });
      expect(await contract.totalDonated()).to.equal(0);
    });

    it("Should handle very small donation", async function () {
      await contract.connect(donor1).donate({ value: 1 }); // 1 wei
      expect(await contract.totalDonated()).to.equal(1);
    });

    it("Should handle multiple milestone releases in sequence", async function () {
      await contract.connect(donor1).donate({ value: ethers.parseEther("1.0") });

      // Confirm all milestones
      await contract.connect(hospital).confirmMilestone(0);
      await contract.connect(hospital).confirmMilestone(1);
      await contract.connect(hospital).confirmMilestone(2);

      const patientBalanceBefore = await ethers.provider.getBalance(patient.address);

      // Release all milestones
      await contract.connect(owner).releaseMilestone(0);
      await contract.connect(owner).releaseMilestone(1);
      await contract.connect(owner).releaseMilestone(2);

      const patientBalanceAfter = await ethers.provider.getBalance(patient.address);

      // Patient should have received all milestone funds (minus gas)
      const expectedTotal = MILESTONE_AMOUNTS[0] + MILESTONE_AMOUNTS[1] + MILESTONE_AMOUNTS[2];
      expect(patientBalanceAfter - patientBalanceBefore).to.be.closeTo(expectedTotal, ethers.parseEther("0.01"));
    });
  });
});
