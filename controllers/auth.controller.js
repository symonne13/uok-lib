const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// -------- REGISTER --------
exports.register = async (req, res) => {
  const { name, reg_number, email, password } = req.body;

  if (!name || !reg_number || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  try {
    // Check if email already exists
    const [existingEmail] = await db.query(
      'SELECT user_id FROM users WHERE email = ?', [email]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    // Check if reg_number already exists
    const [existingReg] = await db.query(
      'SELECT user_id FROM users WHERE reg_number = ?', [reg_number]
    );
    if (existingReg.length > 0) {
      return res.status(409).json({ message: "This registration number is already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (username, reg_number, email, password, role) VALUES (?, ?, ?, ?, 'student')",
      [name, reg_number, email, hashed]
    );

    res.status(201).json({ message: "Account created successfully!" });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err.message);
    res.status(500).json({ message: "Server error during registration." });
  }
};

// -------- LOGIN --------
exports.login = async (req, res) => {
  const { reg_number, email, password } = req.body;

  if ((!reg_number && !email) || !password) {
    return res.status(400).json({ message: "Credentials and password are required." });
  }

  try {
    // Allow login by either reg_number or email
    const field = reg_number ? 'reg_number' : 'email';
    const value = reg_number || email;

    const [users] = await db.query(
      `SELECT * FROM users WHERE ${field} = ?`, [value]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '3h' }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        name: user.username,
        email: user.email,
        reg_number: user.reg_number,
        role: user.role
      }
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Server error during login." });
  }
};