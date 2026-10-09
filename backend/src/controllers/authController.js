const AuthService = require('../services/authService');

const AuthController = {
  //Register Management
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Please fill in all the information" });
      }

      const user = await AuthService.register(name, email, password);
      return res.status(201).json({
        success: true,
        message: "Registration successful",
        data: user
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  //Login Management
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: "Please enter your email and password" });
      }

      const result = await AuthService.login(email, password);
      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: result
      });
    } catch (error) {
      return res.status(401).json({ success: false, message: error.message });
    }
  }
};

module.exports = AuthController;