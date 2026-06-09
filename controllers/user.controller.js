const db = require("../config/db");

// 1. Get User Profile (Moved outside and exported correctly)
exports.getUserProfile = (req, res) => {
  res.json({ message: "User route working" });
};

// 2. Get all reservations of the logged-in user
exports.getMyReservations = (req, res) => {
  const userId = req.user.user_id;

  const sql = `
    SELECT r.reservation_id, s.seat_number, r.start_time, r.end_time, r.status
    FROM reservations r
    JOIN seats s ON r.seat_id = s.seat_id
    WHERE r.user_id=?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

// 3. Submit feedback
exports.submitFeedback = (req, res) => {
  const userId = req.user.user_id;
  const { message } = req.body;

  const sql = "INSERT INTO feedback (user_id, message) VALUES (?,?)";
  db.query(sql, [userId, message], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Feedback submitted" });
  });
};