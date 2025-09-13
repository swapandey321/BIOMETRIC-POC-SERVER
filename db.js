const USERS = []

function getUserByEmail(email) {
    return USERS.find(user => user.email === email)
}

function getUserById(id) {
    return USERS.find(user => user.id === id)
}

function createUser(id, email, passKey) {
    const existingUser = getUserByEmail(email);
      if (existingUser) {
    // Append new credential
    existingUser.passKeys = existingUser.passKeys || [];
    existingUser.passKeys.push(passKey);
  } else {
    // Create new user with passKeys array
    USERS.push({
      id,
      email,
      passKeys: [passKey],
    });
  }

}

function updateUserCounter(userId, newCounter, credentialId) {
  const user = getUserById(userId);
  if (!user || !user.passKeys) return;

  const credential = user.passKeys.find(pk => pk.id === credentialId);
  if (credential) {
    credential.counter = newCounter;
  }
}

module.exports = {
    getUserByEmail,
    getUserById,
    createUser,
    updateUserCounter,
}
