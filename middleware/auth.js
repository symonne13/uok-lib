const jwt = require('jsonwebtoken');

// 1. Define the function
const authenticateToken = (req, res, next) => {
    // Get the token from the 'Authorization' header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    // Verify the token using your secret key from .env
    // If you don't have JWT_SECRET in .env, replace process.env.JWT_SECRET with a string like 'your_secret'
    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey', (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        
        // Add the user data to the request object
        req.user = user;
        next();
    });
};

// 2. Export it so other files can use it
module.exports = { authenticateToken };