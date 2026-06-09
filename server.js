const express = require("express");
const db = require('./config/db'); // or wherever your mysql file is saved
const cors = require("cors");
require("dotenv").config();
const userRoutes = require("./routes/user.routes");

const app = express();
app.use(cors());
app.use(express.json());
// Routes

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/reservations", require("./routes/reservation.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/user", userRoutes);
app.get("/", (req, res) => {
  res.send("Library Reservation System API is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is strictly listening on http://127.0.0.1:${PORT}`);
});
