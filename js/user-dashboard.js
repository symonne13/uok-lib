// ============== CONFIG & STATE ==============
const API = 'http://localhost:5000/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || '{}');

let selectedSeatId = null;
let activeReservation = null;
let allSeats = [];
let scanner = null;
let starRating = 0;

// ============== GUARDS ==============
if (!token) { 
    window.location.href = '../login.html'; 
}
if (user.role === 'admin') { 
    window.location.href = 'admin-dashboard.html'; 
}

// Set UI Username
document.getElementById('nav-username').textContent = `👋 ${user.name || 'User'}`;

function authHeaders() {
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
    };
}

// ============== TOAST NOTIFICATIONS ==============
function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ============== PAGE NAVIGATION ==============
function showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${page}`);
    const navEl = document.getElementById(`nav-${page}`);
    
    if (targetPage) targetPage.classList.remove('hidden');
    if (navEl) navEl.classList.add('active');

    if (page === 'my-bookings') loadMyBookings();
    if (page === 'reserve') checkActiveReservation();
    if (page === 'profile') loadProfile();
    if (page === 'checkin') stopScanner();
}

function logout() {
    localStorage.clear();
    window.location.href = '../login.html';
}

// ============== RESERVATION LOGIC ==============

async function checkActiveReservation() {
  try {
    const res = await fetch(`${API}/reservations/my`, { headers: authHeaders() });
    if (!res.ok) return;

    const data = await res.json();
    const banner = document.getElementById('active-reservation-banner');
    const details = document.getElementById('active-res-details');

    if (Array.isArray(data)) {
      // Show banner for both pending and active reservations
      const activeRes = data.find(r => r.status === 'pending' || r.status === 'active');
      if (activeRes) {
        activeReservation = activeRes;
        banner.classList.remove('hidden');
        const statusLabel = activeRes.status === 'active' ? '✅ Active' : '⏳ Pending check-in';
        details.textContent = `${activeRes.seat_number} (${activeRes.section}) — ${statusLabel} — until ${new Date(activeRes.end_time).toLocaleTimeString()}`;
      } else {
        activeReservation = null;
        banner.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

// Also update getStatusClass to handle all statuses including expired
function getStatusClass(status) {
  const map = { 
    pending: 'badge-warning', 
    active: 'badge-success', 
    completed: 'badge-muted', 
    cancelled: 'badge-danger', 
    expired: 'badge-danger' 
  };
  return map[status] || 'badge-muted';
}

function setDefaultTimes() {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    document.getElementById('start_time').value = toLocalISO(now);
    document.getElementById('end_time').value = toLocalISO(end);
}

function toLocalISO(date) {
    const offset = date.getTimezoneOffset();
    const adjusted = new Date(date.getTime() - offset * 60000);
    return adjusted.toISOString().slice(0, 16);
}

async function loadAvailableSeats() {
    const start = document.getElementById('start_time').value;
    const end = document.getElementById('end_time').value;

    if (!start || !end) return toast('Please select start and end times', 'error');

    const startDate = new Date(start), endDate = new Date(end);
    if (endDate <= startDate) return toast('End time must be after start time', 'error');

    const diff = (endDate - startDate) / (1000 * 60 * 60);
    if (diff > 3) return toast('Maximum booking duration is 3 hours', 'error');

    try {
        const [allRes, availRes] = await Promise.all([
            fetch(`${API}/reservations/seats`, { headers: authHeaders() }),
            fetch(`${API}/reservations/seats/available?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`, { headers: authHeaders() })
        ]);
        
        allSeats = await allRes.json();
        const available = await availRes.json();
        const availIds = new Set(available.map(s => s.id));

        const seatData = allSeats.map(s => ({
            ...s,
            available_now: availIds.has(s.id)
        }));

        renderSeatGrid(seatData);
        document.getElementById('seats-section').classList.remove('hidden');
        selectedSeatId = null;
        document.getElementById('selected-seat-info').classList.add('hidden');
    } catch (e) {
        toast('Failed to load seats. Check server connection.', 'error');
    }
}

function renderSeatGrid(seats) {
    const sections = [...new Set(seats.map(s => s.section))];
    const tabsEl = document.getElementById('section-tabs');
    
    tabsEl.innerHTML = sections.map((sec, i) => `
        <button class="btn btn-sm ${i===0 ? 'btn-green' : 'btn-outline'}" 
            onclick="filterSection('${sec}', this)" data-section="${sec}">${sec}</button>
    `).join('');

    window._allSeatData = seats;
    renderSeatsForSection(seats, sections[0]);
}

function filterSection(section, btn) {
    document.querySelectorAll('#section-tabs button').forEach(b => {
        b.className = 'btn btn-sm btn-outline';
        b.style.cssText = 'color:var(--text); border-color:var(--border);';
    });
    btn.className = 'btn btn-sm btn-green';
    btn.style.cssText = '';
    renderSeatsForSection(window._allSeatData, section);
}
// UPDATE 1: Ensure we use 'seat_id' when rendering
function renderSeatsForSection(seats, section) {
    const gridEl = document.getElementById('seat-grid');
    const filtered = section ? seats.filter(s => s.section === section) : seats;

    gridEl.innerHTML = filtered.map(s => {
        const cls = s.available_now ? 'available' : (s.status === 'reserved' ? 'reserved' : 'occupied');
        const icon = cls === 'available' ? '🟢' : (cls === 'reserved' ? '🟡' : '🔴');
        
        // Pass s.seat_id (from your DB) into the selectSeat function
        return `
            <button class="seat-btn ${cls}" onclick="selectSeat(event, ${s.seat_id}, '${s.seat_number}', '${s.section}', '${cls}')">
                <span>${icon}</span>
                <span>${s.seat_number}</span>
            </button>`;
    }).join('');
}

// UPDATE 2: Fix the search logic in confirmReservation
function confirmReservation() {
    if (!selectedSeatId) return toast('Please select a seat', 'error');
    
    const start = document.getElementById('start_time').value;
    const end = document.getElementById('end_time').value;

    // Use Number() to ensure we are comparing numbers to numbers
    const seat = window._allSeatData.find(s => Number(s.seat_id) === Number(selectedSeatId));

    // Safety check: if seat is still undefined, stop here instead of crashing
    if (!seat) {
        console.error("Could not find seat with ID:", selectedSeatId, "in", window._allSeatData);
        return toast('Error: Seat data lost. Please refresh.', 'error');
    }

    document.getElementById('modal-details').innerHTML = `
        <strong>Seat:</strong> ${seat.seat_number} — ${seat.section}<br>
        <strong>From:</strong> ${new Date(start).toLocaleString()}<br>
        <strong>To:</strong> ${new Date(end).toLocaleString()}
    `;
    document.getElementById('confirm-modal').classList.remove('hidden');
}
// UPDATE: Handled 'event' to safely toggle CSS classes
function selectSeat(event, id, number, section, cls) {
    if (cls !== 'available') return toast('This seat is not available', 'error');

    selectedSeatId = id;
    document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('selected');
    }

    document.getElementById('selected-seat-label').textContent = `${number} (${section})`;
    document.getElementById('selected-seat-info').classList.remove('hidden');
}



function closeModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
}

// UPDATE: Improved logging and redirect logic
async function doReserve() {
    if (!selectedSeatId) return;
    
    const start = document.getElementById('start_time').value;
    const end = document.getElementById('end_time').value;

    try {
        const res = await fetch(`${API}/reservations`, {
            method: 'POST', 
            headers: authHeaders(),
            body: JSON.stringify({ seat_id: selectedSeatId, start_time: start, end_time: end })
        });
        const data = await res.json();
        
        if (res.ok) {
            closeModal();
            toast('Reservation confirmed! 🎉', 'success');
            
            // Refresh state
            loadAvailableSeats();
            checkActiveReservation();
            
            // Short delay so user sees the toast before redirecting
            setTimeout(() => showPage('my-bookings'), 1200);
        } else {
            toast(data.message || 'Reservation failed', 'error');
        }
    } catch (e) { 
        console.error("Reservation Error:", e);
        toast('Error making reservation. Check server.', 'error'); 
    }
}

// ============== QR SCANNER ==============
async function startScanner() {
    document.getElementById('start-scan-btn').classList.add('hidden');
    document.getElementById('stop-scan-btn').classList.remove('hidden');

    scanner = new Html5Qrcode('qr-reader');
    try {
        await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                await stopScanner();
                await processCheckin(decodedText);
            },
            () => {}
        );
    } catch (e) {
        toast('Camera error. Use manual entry.', 'error');
        stopScanner();
    }
}

async function stopScanner() {
    if (scanner) {
        try { await scanner.stop(); scanner.clear(); } catch (e) {}
        scanner = null;
    }
    document.getElementById('start-scan-btn').classList.remove('hidden');
    document.getElementById('stop-scan-btn').classList.add('hidden');
}

async function manualCheckin() {
    const qr = document.getElementById('manual-qr').value.trim();
    if (!qr) return toast('Enter a QR code', 'error');
    await processCheckin(qr);
}

async function processCheckin(qr_code) {
    const resultEl = document.getElementById('qr-result');
    resultEl.className = 'qr-result alert alert-info';
    resultEl.textContent = 'Processing...';
    resultEl.classList.remove('hidden');

    try {
        const res = await fetch(`${API}/reservations/checkin`, {
            method: 'POST', 
            headers: authHeaders(),
            body: JSON.stringify({ qr_code })
        });
        const data = await res.json();

        if (res.ok) {
            resultEl.className = 'qr-result alert alert-success';
            resultEl.innerHTML = `✅ ${data.message}`;
            toast(data.message, 'success');
            checkActiveReservation();
        } else {
            resultEl.className = 'qr-result alert alert-error';
            resultEl.innerHTML = `❌ ${data.message}`;
        }
    } catch (e) {
        resultEl.className = 'qr-result alert alert-error';
        resultEl.textContent = '❌ Server error.';
    }
}

// ============== MY BOOKINGS ==============
async function loadMyBookings() {
  const tbody = document.getElementById('bookings-tbody');
  try {
    const res = await fetch(`${API}/reservations/my`, { headers: authHeaders() });
    const data = await res.json();

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:40px;">No reservations yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => {
      const start = new Date(r.start_time).toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short' });
      const end = new Date(r.end_time).toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short' });
      const badge = `<span class="badge ${getStatusClass(r.status)}">${r.status}</span>`;

      let actions = '';
      if (r.status === 'pending') {
        actions = `<button class="btn btn-danger btn-sm" onclick="cancelReservation(${r.id})">Cancel</button>`;
      } else if (r.status === 'active') {
        actions = `<button class="btn btn-sm btn-green" onclick="checkoutReservation(${r.id})">Check Out</button>`;
      }

      return `<tr>
        <td><strong>${r.seat_number}</strong></td>
        <td>${r.section}</td>
        <td>${start}</td>
        <td>${end}</td>
        <td>${badge}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load bookings.</td></tr>`;
  }
}
function getStatusClass(status) {
    const map = { pending:'badge-warning', active:'badge-success', completed:'badge-muted', cancelled:'badge-danger', expired:'badge-danger' };
    return map[status] || 'badge-muted';
}

async function cancelReservation(id) {
    if (!confirm('Cancel this reservation?')) return;
    try {
        const res = await fetch(`${API}/reservations/${id}`, { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        toast(data.message, res.ok ? 'success' : 'error');
        if (res.ok) loadMyBookings();
    } catch (e) { toast('Error cancelling', 'error'); }
}

async function checkoutReservation(id) {
    try {
        const res = await fetch(`${API}/reservations/checkout`, {
            method: 'POST', 
            headers: authHeaders(),
            body: JSON.stringify({ reservation_id: id })
        });
        const data = await res.json();
        toast(data.message, res.ok ? 'success' : 'error');
        if (res.ok) { loadMyBookings(); checkActiveReservation(); }
    } catch (e) { toast('Error checking out', 'error'); }
}

// ============== FEEDBACK ==============
document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
        starRating = parseInt(star.dataset.val);
        document.querySelectorAll('.star').forEach((s, i) => {
            s.textContent = i < starRating ? '⭐' : '☆';
        });
    });
});

async function submitFeedback() {
    const msg = document.getElementById('feedback-msg').value.trim();
    if (!msg) return showFeedbackAlert('Please write a message', 'error');

    try {
        const res = await fetch(`${API}/users/feedback`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ message: msg, rating: starRating || null })
        });
        const data = await res.json();
        if (res.ok) {
            showFeedbackAlert(data.message, 'success');
            document.getElementById('feedback-msg').value = '';
            starRating = 0;
            document.querySelectorAll('.star').forEach(s => s.textContent = '☆');
        } else {
            showFeedbackAlert(data.message, 'error');
        }
    } catch (e) { showFeedbackAlert('Error submitting feedback', 'error'); }
}

function showFeedbackAlert(msg, type) {
    document.getElementById('feedback-alert').innerHTML = `
        <div class="alert alert-${type}"><span>${type==='success'?'✅':'❌'}</span> ${msg}</div>`;
}

// ============== PROFILE ==============
async function loadProfile() {
    try {
        const res = await fetch(`${API}/users/profile`, { headers: authHeaders() });
        const data = await res.json();
        document.getElementById('profile-name').value = data.name;
        document.getElementById('profile-email').value = data.email;
        document.getElementById('profile-reg').value = data.reg_number;
    } catch (e) {}
}

async function updateProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    try {
        const res = await fetch(`${API}/users/profile`, {
            method: 'PATCH', headers: authHeaders(),
            body: JSON.stringify({ name, email })
        });
        const data = await res.json();
        const alertEl = document.getElementById('profile-alert');
        alertEl.innerHTML = `<div class="alert alert-${res.ok?'success':'error'}"><span>${res.ok?'✅':'❌'}</span> ${data.message}</div>`;
        if (res.ok) { 
            user.name = name; 
            localStorage.setItem('user', JSON.stringify(user)); 
            document.getElementById('nav-username').textContent = `👋 ${name}`; 
        }
    } catch (e) {}
}

async function changePassword() {
    const current = document.getElementById('current-pw').value;
    const newPw = document.getElementById('new-pw').value;
    const confirm = document.getElementById('confirm-pw').value;
    const alertEl = document.getElementById('pw-alert');

    if (newPw !== confirm) { alertEl.innerHTML = `<div class="alert alert-error">❌ Passwords don't match</div>`; return; }
    if (newPw.length < 6) { alertEl.innerHTML = `<div class="alert alert-error">❌ Password too short</div>`; return; }

    try {
        const res = await fetch(`${API}/users/change-password`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ current_password: current, new_password: newPw })
        });
        const data = await res.json();
        alertEl.innerHTML = `<div class="alert alert-${res.ok?'success':'error'}"><span>${res.ok?'✅':'❌'}</span> ${data.message}</div>`;
        if (res.ok) {
            document.getElementById('current-pw').value='';
            document.getElementById('new-pw').value='';
            document.getElementById('confirm-pw').value='';
        }
    } catch (e) {}
}

// ============== INITIALIZATION ==============
setDefaultTimes();
checkActiveReservation();