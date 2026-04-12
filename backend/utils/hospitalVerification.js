/**
 * License verification sets profile.verified; admin KYC approval sets kyc.status.
 * Campaign assignment and dropdowns treat either as verified for hospital role.
 */
function isHospitalVerified(user) {
  if (!user || user.role !== 'hospital') return false;
  return user.profile?.verified === true || user.kyc?.status === 'approved';
}

function verifiedHospitalMongoFilter() {
  return {
    role: 'hospital',
    $or: [{ 'profile.verified': true }, { 'kyc.status': 'approved' }],
  };
}

module.exports = { isHospitalVerified, verifiedHospitalMongoFilter };
