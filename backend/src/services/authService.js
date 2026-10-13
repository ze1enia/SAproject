const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { secret, expiresIn } = require('../config/jwt');

//Shape sent to the client / embedded in the token
const toProfile = (user) => ({
  userId: user.user_id,
  username: user.username,
  role: user.role_id,
  branch: user.branch_id
});

const authService = {
  login: async (username, password) => {
    const user = await userModel.findByUsername(username);
    if (!user) {
      throw new Error('Incorrect username or password.');
    }

    //password_hash is empty until `npm run seed:passwords` has been run,
    //so flag that separately in the logs instead of silently rejecting.
    if (!user.password_hash) {
      console.warn(
        `User ${user.username} has no password_hash - run "npm run seed:passwords".`
      );
      throw new Error('Incorrect username or password.');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new Error('Incorrect username or password.');
    }

    const profile = toProfile(user);

    const token = jwt.sign(profile, secret, { expiresIn });

    return { token, user: profile };
  },

  //Re-reads the user from the database so the welcome page shows current data,
  //falling back to the token payload when the record cannot be loaded.
  getProfile: async (tokenPayload) => {
    const fallback = {
      userId: tokenPayload.userId,
      username: tokenPayload.username,
      role: tokenPayload.role,
      branch: tokenPayload.branch
    };

    try {
      const user = await userModel.findById(tokenPayload.userId);
      return user ? toProfile(user) : fallback;
    } catch (error) {
      return fallback;
    }
  }
};

module.exports = authService;