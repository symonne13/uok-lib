const db = require("../config/db");

exports.getAdminStats = (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Access denied" });

  const sql = `
    SELECT s.seat_id, s.seat_number, s.status, u.full_name AS user, 
           CONCAT(r.start_time,' - ',r.end_time) AS time
    FROM seats s
    LEFT JOIN reservations r ON s.seat_id = r.seat_id AND r.status IN ('reserved','active')
    LEFT JOIN users u ON r.user_id = u.user_id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};
