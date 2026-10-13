
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const SALT_ROUNDS = 10;
const force = process.argv.includes('--force');

// Pswd hashed --> bcrypt hashes always start with $2a$ / $2b$ / $2y$
const isHashed = (value) => typeof value === 'string' && value.startsWith('$2');

const seedPasswords = async () => {
  const [sourceRows] = await pool.query(
    'SELECT `user_id`, `username`, `password_ori` FROM `SA`'
  );

  if (sourceRows.length === 0) {
    throw new Error('The SA table is empty - import SAproject.sql first.');
  }

  const [targetRows] = await pool.query(
    'SELECT `user_id`, `password_hash` FROM `users`'
  );
  const existingHashes = new Map(
    targetRows.map((row) => [row.user_id, row.password_hash])
  );

  let updated = 0;
  let skipped = 0;

  for (const { user_id: userId, username, password_ori: plainPassword } of sourceRows) {
    if (!plainPassword) {
      console.warn(`- ${username} (${userId}): no password_ori, skipped`);
      skipped += 1;
      continue;
    }

    if (!existingHashes.has(userId)) {
      console.warn(`- ${username} (${userId}): no matching row in users, skipped`);
      skipped += 1;
      continue;
    }

    if (isHashed(existingHashes.get(userId)) && !force) {
      skipped += 1;
      continue;
    }

    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    await pool.query('UPDATE `users` SET `password_hash` = ? WHERE `user_id` = ?', [
      hash,
      userId
    ]);
    console.log(`- ${username} (${userId}): hashed`);
    updated += 1;
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
};

seedPasswords()
  .catch((error) => {
    console.error('Failed to seed passwords:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
