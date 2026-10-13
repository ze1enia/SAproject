const authService = require('../services/authService');

const authController = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please enter your username and password.' 
        });
      }

      const result = await authService.login(username, password);
      return res.status(200).json({
        success: true,
        message: 'Login Sucessfully',
        data: result
      });
    } catch (error) {
      return res.status(401).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
};

module.exports = authController;