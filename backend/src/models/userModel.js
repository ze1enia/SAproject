const pool = require('../config/db');

const userModel = {
  findByUsername: async (username) => {
    const sql = 'SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1';
    const [rows] = await pool.query(sql, [username.trim()]);
    return rows[0] || null;
  },

  findById: async (id) => {
    const sql = 'SELECT * FROM users WHERE user_id = ? LIMIT 1';
    const [rows] = await pool.query(sql, [id]);
    return rows[0] || null;
  }
};

module.exports = userModel;