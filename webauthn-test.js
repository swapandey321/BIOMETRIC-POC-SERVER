// webauthn-test.js
const crypto = require('crypto');
const { generateRegistrationOptions } = require('@simplewebauthn/server');

;(async () => {
  const opts = await generateRegistrationOptions({
    rpName:          'Test RP',
    rpID:            'localhost',
    userID:          crypto.randomBytes(16),
    userName:        'foo@example.com',
    userDisplayName: 'Foo Example',
    attestationType: 'none',
    timeout:         60000,
  });

  console.log('Opts:', opts);
})();