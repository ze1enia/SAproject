const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const { secret, expiresIn } = require('../config/jwt');

const AuthService = {
  register: async (name, email, password) => {
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('This email has already been used');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword
    });

    return { id: newUser.id, name: newUser.name, email: newUser.email };
  },

  login: async (email, password) => {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error("Email or password is incorrect");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Email or password is incorrect");
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };
  }
};

module.exports = AuthService;