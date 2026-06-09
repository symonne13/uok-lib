const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const db = require("../config/db");

// -------- HELPER: Auto-expire past pending reservations --------
async function expireOldReservations() {
  try {
    await db.execute(
      `UPDATE reservations 
       SET status = 'expired' 
       WHERE status = 'pending' AND end_time < NOW()`
    );
  } catch (err) {
    console.error("❌ EXPIRY ERROR:", err.message);
  }
}

// -------- 1. Get ALL seats --------
router.get("/seats", authenticateToken, async (req, res) => {
  await expireOldReservations(); // expire before serving seat data
  try {
    const [rows] = await db.execute("SELECT * FROM seats");
    res.json(rows);
  } catch (err) {
    console.error("❌ ERROR FETCHING SEATS:", err.message);
    res.status(500).json({ message: "Error fetching seats" });
  }
});

// -------- 2. Get AVAILABLE seats for a time range --------
router.get("/seats/available", authenticateToken, async (req, res) => {
  const { start_time, end_time } = req.query;
  await expireOldReservations();

  if (!start_time || !end_time) {
    return res.status(400).json({ message: "start_time and end_time are required" });
  }

  try {
    const query = `
      SELECT * FROM seats 
      WHERE seat_id NOT IN (
        SELECT seat_id FROM reservations 
        WHERE status IN ('pending', 'active') 
        AND NOT (end_time <= ? OR start_time >= ?)
      )`;

    const [rows] = await db.execute(query, [start_time, end_time]);
    res.json(rows);
  } catch (err) {
    console.error("❌ AVAILABILITY ERROR:", err.message);
    res.status(500).json({ message: "Error checking availability", error: err.message });
  }
});

// -------- 3. Create a new reservation --------
router.post("/", authenticateToken, async (req, res) => {
  const { seat_id, start_time, end_time } = req.body;
  const userId = req.user.id;

  if (!seat_id || !start_time || !end_time) {
    return res.status(400).json({ message: "seat_id, start_time, and end_time are required" });
  }

  try {
    const [conflict] = await db.execute(
      `SELECT reservation_id FROM reservations
       WHERE seat_id = ? AND status IN ('pending', 'active')
       AND NOT (end_time <= ? OR start_time >= ?)`,
      [seat_id, start_time, end_time]
    );

    if (conflict.length > 0) {
      return res.status(409).json({ message: "Seat is no longer available for that time slot." });
    }

    await db.execute(
      "INSERT INTO reservations (user_id, seat_id, start_time, end_time, status) VALUES (?, ?, ?, ?, 'pending')",
      [userId, seat_id, start_time, end_time]
    );

    res.json({ ok: true, message: "Reservation successful!" });
  } catch (err) {
    console.error("❌ RESERVATION ERROR:", err.message);
    res.status(500).json({ message: "Database error", error: err.message });
  }
});

// -------- 4. Get User's own bookings --------
router.get("/my", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  await expireOldReservations(); // always expire before showing bookings

  try {
    const [rows] = await db.execute(
      `SELECT r.reservation_id AS id, r.user_id, r.seat_id,
              r.start_time, r.end_time, r.status,
              s.seat_number, s.section
       FROM reservations r
       JOIN seats s ON r.seat_id = s.seat_id
       WHERE r.user_id = ?
       ORDER BY r.reservation_id DESC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ BACKEND ERROR:", err.message);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// -------- 5. Cancel a reservation --------
router.delete("/:id", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM reservations WHERE reservation_id = ? AND user_id = ?",
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    if (!['pending', 'active'].includes(rows[0].status)) {
      return res.status(400).json({ message: "Only pending/active bookings can be cancelled" });
    }

    await db.execute(
      "UPDATE reservations SET status = 'cancelled' WHERE reservation_id = ?",
      [id]
    );
    res.json({ message: "Reservation cancelled. Seat is now available." });
  } catch (err) {
    console.error("❌ CANCEL ERROR:", err.message);
    res.status(500).json({ message: "Error cancelling reservation" });
  }
});

// -------- 6. QR Check-in --------
router.post("/checkin", authenticateToken, async (req, res) => {
  const { qr_code } = req.body;
  const userId = req.user.id;

  if (!qr_code) {
    return res.status(400).json({ message: "QR code is required." });
  }

  try {
    // Match scanned QR directly against seats.qr_code_data
    const [resv] = await db.execute(
      `SELECT r.reservation_id, r.start_time, r.end_time
       FROM reservations r
       JOIN seats s ON r.seat_id = s.seat_id
       WHERE r.user_id = ? 
         AND s.qr_code_data = ?
         AND r.status = 'pending'`,
      [userId, qr_code]
    );

    if (resv.length === 0) {
      // Find out why — give specific error
      const [anyResv] = await db.execute(
        `SELECT r.status
         FROM reservations r
         JOIN seats s ON r.seat_id = s.seat_id
         WHERE r.user_id = ? AND s.qr_code_data = ?
         ORDER BY r.reservation_id DESC LIMIT 1`,
        [userId, qr_code]
      );

      if (anyResv.length > 0) {
        const status = anyResv[0].status;
        if (status === 'active')    return res.status(400).json({ message: "You are already checked in to this seat." });
        if (status === 'completed') return res.status(400).json({ message: "This reservation has already been completed." });
        if (status === 'cancelled') return res.status(400).json({ message: "This reservation was cancelled." });
        if (status === 'expired')   return res.status(400).json({ message: "This reservation has expired." });
      }

      return res.status(400).json({ 
        message: "No pending reservation found for this QR code." 
      });
    }

    await db.execute(
      "UPDATE reservations SET status = 'active' WHERE reservation_id = ?",
      [resv[0].reservation_id]
    );

    res.json({ message: "Checked in successfully! Enjoy your session 🎉" });
  } catch (err) {
    console.error("❌ CHECKIN ERROR:", err.message);
    res.status(500).json({ message: "Server error during check-in" });
  }
});


// -------- 7. Checkout --------
router.post("/checkout", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { reservation_id } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM reservations WHERE reservation_id = ? AND user_id = ? AND status = 'active'",
      [reservation_id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No active reservation found" });
    }

    await db.execute(
      "UPDATE reservations SET status = 'completed' WHERE reservation_id = ?",
      [reservation_id]
    );
    res.json({ message: "Checked out successfully! See you next time." });
  } catch (err) {
    console.error("❌ CHECKOUT ERROR:", err.message);
    res.status(500).json({ message: "Error during checkout" });
  }
});

module.exports = router;