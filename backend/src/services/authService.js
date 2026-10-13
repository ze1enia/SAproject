const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { secret, expiresIn } = require('../config/jwt');

const authService = {
  login: async (username, password) => {
    const user = await userModel.findByUsername(username);
    if (!user) {
      throw new Error('Incorrect username or password.');
    }

    if (password !== user.password_ori) {
      throw new Error('Incorrect username or password.');
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_id,
        branch: user.branch_id
      },
      secret,
      { expiresIn }
    );

    return {
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role_id,
        branch: user.branch_id
      }
    };
  }
};

module.exports = authService;