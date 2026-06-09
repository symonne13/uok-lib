const contentDiv = document.getElementById("content");
const tabSeats = document.getElementById("tab-seats");
const tabUsers = document.getElementById("tab-users");

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

// Guard: must be logged in as admin
if (!token || user.role !== "admin") {
  window.location.href = "../login.html";
}

// Helper function for authenticated requests
async function authFetch(url, options = {}) {
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "../login.html";
  }
  return res.json();
}

tabSeats.addEventListener("click", showSeats);
tabUsers.addEventListener("click", showUsers);

async function showSeats() {
  contentDiv.innerHTML = `<h3>Seat Status</h3><div id="seat-grid" style="display:flex; flex-wrap:wrap; gap:10px;"></div>`;
  const grid = document.getElementById("seat-grid");

  try {
    const seats = await authFetch("http://localhost:5000/api/reservations/seats");
    
    if (!seats.length) {
      grid.innerHTML = "<p>No seats found.</p>";
      return;
    }

    seats.forEach((seat) => {
      const seatBtn = document.createElement("button");
      seatBtn.textContent = seat.seat_number;
      seatBtn.style.width = "70px";
      seatBtn.style.height = "70px";
      seatBtn.style.borderRadius = "6px";
      seatBtn.style.color = "white";
      seatBtn.style.border = "none";
      seatBtn.style.cursor = "default";
      seatBtn.style.fontSize = "0.75rem";

      switch (seat.status) {
        case "available":
          seatBtn.style.backgroundColor = "green";
          break;
        case "pending":
          seatBtn.style.backgroundColor = "goldenrod";
          break;
        case "active":
          seatBtn.style.backgroundColor = "red";
          break;
        default:
          seatBtn.style.backgroundColor = "gray";
      }

      grid.appendChild(seatBtn);
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = "<p>Error loading seats.</p>";
  }
}

async function showUsers() {
  contentDiv.innerHTML = `<h3>Manage Users</h3><div id="users-table">Loading users...</div>`;
  const tableDiv = document.getElementById("users-table");

  try {
    const users = await authFetch("http://localhost:5000/api/admin/users");

    if (!Array.isArray(users) || !users.length) {
      tableDiv.innerHTML = "<p>No users found.</p>";
      return;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Reg Number</th>
          <th>Email</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    users.forEach((u) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${u.user_id}</td>
        <td>${u.username}</td>
        <td>${u.reg_number}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
      `;
      tbody.appendChild(row);
    });

    tableDiv.innerHTML = "";
    tableDiv.appendChild(table);
  } catch (err) {
    console.error(err);
    tableDiv.innerHTML = "<p>Error loading users.</p>";
  }
}

// Auto-refresh seat grid every 10 seconds
setInterval(() => {
  if (document.getElementById("seat-grid")) showSeats();
}, 10000);

// Load seats by default on page load
showSeats();