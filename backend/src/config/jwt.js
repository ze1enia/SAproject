module.exports = {
  secret: process.env.JWT_SECRET || 'fallback_secret',
  expiresIn: '1d'
};