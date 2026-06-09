const db = require("../config/db");

// Get available seats
exports.getAvailableSeats = (req, res) => {
  const { startTime, endTime } = req.body;

  const sql = `
    SELECT * FROM seats WHERE seat_id NOT IN (
      SELECT seat_id FROM reservations
      WHERE status IN ('reserved','active')
      AND NOT (end_time <= ? OR start_time >= ?)
    ) AND is_enabled = 1
  `;

  db.query(sql, [startTime, endTime], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

// Book seat
exports.bookSeat = (req, res) => {
  const { seatId, startTime, endTime } = req.body;
  const userId = req.user.user_id;

  // Check if user has active reservation
  const checkSql =
    "SELECT * FROM reservations WHERE user_id=? AND status IN ('reserved','active')";
  db.query(checkSql, [userId], (err, results) => {
    if (results.length > 0)
      return res
        .status(400)
        .json({ message: "You already have an active reservation" });

    const sql =
      "INSERT INTO reservations (user_id, seat_id, start_time, end_time) VALUES (?,?,?,?)";
    db.query(sql, [userId, seatId, startTime, endTime], (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Seat reserved" });
    });
  });
};

// Check-in
exports.checkInSeat = (req, res) => {
  const { seatId } = req.body;
  const userId = req.user.user_id;

  const sql =
    "SELECT * FROM reservations WHERE user_id=? AND seat_id=? AND status='reserved'";
  db.query(sql, [userId, seatId], (err, results) => {
    if (results.length === 0)
      return res
        .status(400)
        .json({ message: "No reservation found for this seat" });

    const updateRes =
      "UPDATE reservations SET status='active' WHERE reservation_id=?";
    db.query(updateRes, [results[0].reservation_id], () => {
      const updateSeat = "UPDATE seats SET status='active' WHERE seat_id=?";
      db.query(updateSeat, [seatId], () => {
        res.json({ message: "Checked in successfully!" });
      });
    });
  });
};

// Check-out early
exports.checkOutEarly = (req, res) => {
  const { reservationId } = req.body;

  const sql =
    "UPDATE reservations SET status='completed' WHERE reservation_id=?";
  db.query(sql, [reservationId], (err) => {
    if (err) return res.status(500).json(err);

    const seatUpdate =
      "UPDATE seats SET status='free' WHERE seat_id=(SELECT seat_id FROM reservations WHERE reservation_id=?)";
    db.query(seatUpdate, [reservationId], () => {
      res.json({ message: "Checked out successfully!" });
    });
  });
};
