const crypto = require('crypto');

// Generate a random 32-byte (256-bit) key and encode it as base64
const secretKey = crypto.randomBytes(32).toString('base64');

console.log('Generated Secret Key:', secretKey);
console.log('Copy this key and add it to your .env file as:');
console.log('REACT_APP_SECRET_KEY=' + secretKey);