// server.js

const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');


const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const {
  getUserByEmail,
  getUserById,
  createUser,
  updateUserCounter,
} = require('./db');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const RP_ID   = '0226e7e30a35.ngrok-free.app';
const ORIGIN  = ['android:apk-key-hash:qwH3axH7SbscX9IyKpDbKhZL-LzdDDJPr8JAVGZiyKQ',
  'https://0226e7e30a35.ngrok-free.app'
];
const HTTPS_PORT = 3000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
/**
 * Decode a base64url string into a Node.js Buffer.
 */
function base64urlToBuffer(b64u) {
  // If the input is already a Buffer, return it directly
  if (Buffer.isBuffer(b64u)) {
    return b64u;
  }
  // Convert from base64url to standard base64
  const padLength = (4 - (b64u.length % 4)) % 4;
  const base64   = b64u.replace(/-/g, '+').replace(/_/g, '/')
                     + '='.repeat(padLength);
  return Buffer.from(base64, 'base64');
}

/**
 * Encode a Buffer or Uint8Array into a base64url string.
 */
function bufferToBase64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── EXPRESS + HTTPS SETUP ───────────────────────────────────────────────────
const app = express();
const serverOptions = {
  key:  fs.readFileSync(path.join(__dirname, 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'server.crt')),
};
const server = https.createServer(serverOptions, app);

// Serve static files (your SPA / front-end assets)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/.well-known', express.static(
  path.join(__dirname, 'public', '.well-known'),
  {
    setHeaders: (res, filePath) => {
      
        res.type('application/json');
      
    },
  }
));

// Body & cookie parsing, CORS
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ORIGIN, credentials: true }));

// ─── REGISTRATION ────────────────────────────────────────────────────────────
app.get('/init-register', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const existingUser = getUserByEmail(email); // or getUserById(userIdBuffer)
console.log('inside init-register');
console.log(existingUser);
let excludeCredentials = [];

if (existingUser && existingUser.passKeys) {
  
  excludeCredentials = existingUser.passKeys.map(pk => ({
    id: pk.id, // base64url string
    type: 'public-key',
    transports: pk.transports || ['internal'], // optional
  }));
}


  // See if we already have a user; if not, create a placeholder
  
   //Derive a stable 16-byte ID from the user's email (or userId in your DB).
  //    You could also use user.id directly if it’s already a BufferSource.
  const userIdBuffer = crypto
    .createHash('sha256')
    .update(email, 'utf8')
    .digest()
    .slice(0, 16);
        // cut to 16 bytes (any length 1–64 works)
console.log('→ email:', email);
console.log('→ userIdBuffer (hex):', userIdBuffer.toString('hex'));



  const options = await generateRegistrationOptions({
    rpName: 'Biometric POC App',
    rpID: RP_ID,
    userID: userIdBuffer,
    userName: email,
    userDisplayName: email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey:      'preferred',
      userVerification: 'preferred',
    },excludeCredentials: excludeCredentials,

    
  });
console.log('raw options object:', JSON.stringify(options, null, 2));
console.log('options.user ===', options.user);

  // Store the challenge in a cookie for verification
  res.cookie('regInfo', JSON.stringify({
    userId:    options.user.id,
    email:     email,
    challenge: options.challenge,
  }), {
    httpOnly: true,
    secure:   true,
    sameSite: 'none',
    maxAge:   180000, // 3 minutes
  });

  res.json(options);
});

app.post('/verify-register', async (req, res) => {
  console.log('inside pingone call')
  console.log(req.body);
  const regInfo = req.cookies.regInfo && JSON.parse(req.cookies.regInfo);
  if (!regInfo) {
    return res.status(400).json({ error: 'No registration in progress' });
  }
  

  try {
    const verification = await verifyRegistrationResponse({
      response:         req.body,
      expectedChallenge: regInfo.challenge,
      expectedOrigin:    ORIGIN,
      expectedRPID:      RP_ID,
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: 'Registration not verified' });
    }
    console.log(verification);

    // Persist the newly-registered credential on the user
    const { credential } = verification.registrationInfo;
    
    createUser(
  regInfo.userId,
  regInfo.email,
  {
    id:          credential.id,                            // base64url string
    publicKey:   bufferToBase64url(credential.publicKey),  // base64url string
    counter:     credential.counter,                       // number
    deviceType:  verification.registrationInfo.credentialDeviceType,
    backedUp:    verification.registrationInfo.credentialBackedUp,
    transports:  credential.transports,
  }
);


    const fetched = getUserById(regInfo.userId);
console.log('getUserById fetched:', fetched);
const fetched1 = getUserByEmail(regInfo.email);
console.log('getUserByEmail fetched:', fetched1);


// 4) (Optionally) inspect entire store
console.log('ALL USERS:', require('./db').users);


    // Clear the registration cookie
    res.clearCookie('regInfo');
    console.log('cookie deleted');

    return res.status(200).json({"verified": verification.verified,
            id: verification.registrationInfo.credential.id,
            publicKey: verification.registrationInfo.credential.publicKey,
            count: verification.registrationInfo.credential.counter,
            deviceType: verification.registrationInfo.credentialDeviceType,
            backedUp: verification.registrationInfo.credentialBackedUp,
            transports: req.body.transport,
          userName: fetched1.email});
  } catch (err) {
    console.error('Error in /verify-register:', err);
    return res.status(400).json({ error: err.message });
  }
});

// ─── AUTHENTICATION ─────────────────────────────────────────────────────────
app.get('/init-auth', async (req, res) => {
    console.log('init-auth')
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }


  const user = getUserByEmail(email);
  console.log('getUserByEmail fetched:', user);
  if (!user || !user.passKeys || user.passKeys.length === 0) {
  return res.status(404).json({ error: 'No registered credentials for this user' });
}


  console.log('user details from inline memory')
  console.log(JSON.stringify(user));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials:user.passKeys.map(pk => ({
    id: pk.id,
    type: 'public-key',
    transports: pk.transports,
  })),
  userVerification: 'required',
});


  // Store challenge for verification
  res.cookie('authInfo', JSON.stringify({
    userId:    user.id,
    challenge: options.challenge,
  }), {
    httpOnly: true,
    secure:   true,
    sameSite: 'none',
    maxAge:   180000,
  });

  res.json(options);
});

app.post('/verify-auth', async (req, res) => {
  const authInfo = req.cookies.authInfo && JSON.parse(req.cookies.authInfo);
  if (!authInfo) {
    return res.status(400).json({ error: 'No authentication in progress' });
  }
  

  const user = getUserById(authInfo.userId);
  if (!user || !user.passKeys || user.passKeys.length === 0) {
    return res.status(404).json({ error: 'User or credential not found' });
  }
  console.log('Incoming body:', req.body);
  console.log('typeof id:', typeof req.body.id, req.body.id);
  console.log('typeof rawId:', typeof req.body.rawId, req.body.rawId);
  console.log('authInfo from cookie:', authInfo);
  console.log('user fetched by ID:', user);
  // Find the matching credential by ID
  const credentialId = req.body.id || req.body.rawId;
  const matchingCredential = user.passKeys.find(pk => pk.id === credentialId);

  if (!matchingCredential) {
    return res.status(404).json({ error: 'Matching credential not found' });
  }




  try {
    const verification = await verifyAuthenticationResponse({
  response:          req.body,
  expectedChallenge: authInfo.challenge,
  expectedOrigin:    ORIGIN,
  expectedRPID:      RP_ID,

  // note the plural key!
  credential: {
      id:        base64urlToBuffer(matchingCredential.id),
      publicKey: base64urlToBuffer(matchingCredential.publicKey),
      counter:             matchingCredential.counter,
      transports:          matchingCredential.transports,
    },
  
});

console.log('after verify-auth');
console.log(verification);


    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: 'Authentication failed' });
    }

    // Update the stored signature counter
    updateUserCounter(user.id, verification.authenticationInfo.newCounter);

    // Clear the auth cookie
    res.clearCookie('authInfo');

    return res.json(verification);
  } catch (err) {
    console.error('Error in /verify-auth:', err);
    return res.status(400).json({ error: err.message });
  }
});

// ─── START SERVER ────────────────────────────────────────────────────────────
server.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTPS server listening on https://localhost:${HTTPS_PORT}`);
});
