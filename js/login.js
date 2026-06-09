document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (!loginForm) {
    console.error("Error: Could not find 'loginForm' element.");
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const reg_number = document.getElementById("reg_number").value.trim();
    const password   = document.getElementById("password").value;
    const alertEl    = document.getElementById("login-alert");

    function showAlert(msg, type = "error") {
      alertEl.innerHTML = `<div class="alert alert-${type}">
        <span>${type === "success" ? "✅" : "❌"}</span> ${msg}
      </div>`;
    }

    if (!reg_number || !password) {
      return showAlert("Registration number and password are required.");
    }

    try {
      const res = await fetch("http://127.0.0.1:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reg_number, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store token and full user object
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        showAlert("Login successful! Redirecting...", "success");

        setTimeout(() => {
          if (data.user.role === "admin") {
            window.location.href = "dashboard/admin-dashboard.html";
          } else {
            window.location.href = "dashboard/user-dashboard.html";
          }
        }, 1000);
      } else {
        showAlert(data.message || "Login failed. Please check your credentials.");
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      showAlert("Cannot connect to server. Ensure your backend is running on port 5000.");
    }
  });
});