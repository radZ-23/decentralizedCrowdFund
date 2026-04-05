const crypto = require('crypto');
const fs = require('fs');

const ALGORITHM = 'aes-256-cbc';

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    // Generate a deterministic fallback for development (NOT for production)
    return crypto.createHash('sha256').update('medtrust_dev_encryption_key').digest();
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a file in-place. Prepends a 16-byte IV to the ciphertext.
 * @param {string} filePath - path to the file to encrypt
 */
function encryptFile(filePath) {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const input = fs.readFileSync(filePath);
  const encrypted = Buffer.concat([iv, cipher.update(input), cipher.final()]);
  fs.writeFileSync(filePath, encrypted);
  return filePath;
}

/**
 * Decrypt a file and return a Buffer of the plaintext.
 * @param {string} filePath - path to the encrypted file
 * @returns {Buffer} decrypted content
 */
function decryptFile(filePath) {
  const key = getKey();
  const data = fs.readFileSync(filePath);
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encryptFile, decryptFile };
