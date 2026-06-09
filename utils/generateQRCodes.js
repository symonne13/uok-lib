const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../qrcodes");

// Create folder if not exists
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

for (let seatId = 1; seatId <= 50; seatId++) {
  QRCode.toFile(
    path.join(dir, `seat_${seatId}.png`),
    seatId.toString(),
    { width: 300 },
    (err) => {
      if (err) console.error(err);
      else console.log(`QR generated for seat ${seatId}`);
    },
  );
}
