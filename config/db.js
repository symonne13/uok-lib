const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Ruth@6078', // <-- DOUBLE CHECK THIS
  database: 'library_db'
});

const promisePool = pool.promise();

// ADD THIS TEST BLOCK:
promisePool.getConnection()
  .then(connection => {
    console.log('✅ Successfully connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = promisePool;