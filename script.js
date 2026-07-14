// ===== Appointment Scheduler - Main Script =====

// --- State ---
var currentYear = new Date().getFullYear();
var currentMonth = new Date().getMonth(); // 0-indexed
var deleteTargetId = null;

// --- DOM References ---
var calendarBody = document.getElementById('calendar-body');
var currentMonthLabel = document.getElementById('current-month-label');
var calendarDoctorLabel = document.getElementById('calendar-doctor-label');
var modalOverlay = document.getElementById('modal-overlay');
var deleteOverlay = document.getElementById('delete-overlay');
var appointmentForm = document.getElementById('appointment-form');
var formAppointmentId = document.getElementById('form-appointment-id');
var modalTitle = document.getElementById('modal-title');

var filterPatient = document.getElementById('filter-patient');
var filterDoctor = document.getElementById('filter-doctor');
var filterDateFrom = document.getElementById('filter-date-from');
var filterDateTo = document.getElementById('filter-date-to');

var appointmentTbody = document.getElementById('appointment-tbody');
var emptyState = document.getElementById('empty-state');

// --- localStorage helpers ---
function getAppointments() {
    try {
        var data = localStorage.getItem('appointments');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveAppointments(list) {
    localStorage.setItem('appointments', JSON.stringify(list));
}

function generateId() {
    return 'appt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// --- Month names ---
var monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// --- Format helpers ---
function formatDate(dateStr) {
    // dateStr is "YYYY-MM-DD", return "DD/MM/YYYY"
    var parts = dateStr.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function formatTime(timeStr) {
    // timeStr is "HH:MM" (24h), return "HH:MM AM/PM"
    if (!timeStr) return '';
    var parts = timeStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + ampm;
}

function formatTimeRange(timeStr) {
    // Show as "HH:MM AM - HH:MM AM" (15 min slot)
    if (!timeStr) return '';
    var parts = timeStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);

    var startLabel = formatTime(timeStr);

    // End = start + 15 min
    var endM = m + 15;
    var endH = h;
    if (endM >= 60) {
        endM -= 60;
        endH += 1;
    }
    var endStr = (endH < 10 ? '0' + endH : endH) + ':' + (endM < 10 ? '0' + endM : endM);
    var endLabel = formatTime(endStr);

    return startLabel + ' - ' + endLabel;
}

// --- Calendar Rendering ---
function renderCalendar() {
    var year = currentYear;
    var month = currentMonth;

    // Update label
    var today = new Date();
    currentMonthLabel.textContent = monthNames[month] + ' ' + year;

    // First day of the month (0=Sun)
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();

    // Get appointments for this month and nearby
    var appointments = getAppointments();

    // Build a map: "YYYY-MM-DD" -> [appts]
    var apptMap = {};
    for (var i = 0; i < appointments.length; i++) {
        var a = appointments[i];
        if (!apptMap[a.date]) apptMap[a.date] = [];
        apptMap[a.date].push(a);
    }

    // Show a doctor label if all visible appointments have the same doctor
    var visibleDoctors = {};
    for (var key in apptMap) {
        var d = new Date(key);
        // Only check appointments in the visible range
        for (var j = 0; j < apptMap[key].length; j++) {
            visibleDoctors[apptMap[key][j].doctor] = true;
        }
    }
    var doctorNames = Object.keys(visibleDoctors);
    calendarDoctorLabel.textContent = doctorNames.length === 1 ? doctorNames[0] : '';

    calendarBody.innerHTML = '';

    // Total cells: we need 6 rows x 7 cols = 42 cells
    var totalCells = 42;

    for (var c = 0; c < totalCells; c++) {
        var cell = document.createElement('div');
        cell.className = 'calendar-cell';

        var dayNum, cellDate, isOtherMonth = false;

        if (c < firstDay) {
            // Previous month
            dayNum = daysInPrevMonth - firstDay + c + 1;
            var pm = month === 0 ? 11 : month - 1;
            var py = month === 0 ? year - 1 : year;
            cellDate = py + '-' + pad(pm + 1) + '-' + pad(dayNum);
            isOtherMonth = true;
        } else if (c - firstDay >= daysInMonth) {
            // Next month
            dayNum = c - firstDay - daysInMonth + 1;
            var nm = month === 11 ? 0 : month + 1;
            var ny = month === 11 ? year + 1 : year;
            cellDate = ny + '-' + pad(nm + 1) + '-' + pad(dayNum);
            isOtherMonth = true;
        } else {
            dayNum = c - firstDay + 1;
            cellDate = year + '-' + pad(month + 1) + '-' + pad(dayNum);
        }

        if (isOtherMonth) cell.classList.add('other-month');

        // Today highlight
        if (
            !isOtherMonth &&
            dayNum === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            cell.classList.add('today');
        }

        // Date label
        var dateLabel = document.createElement('div');
        dateLabel.className = 'cell-date';
        // Show "Mon D" for first day of a month, else just number
        if (dayNum === 1 && isOtherMonth) {
            dateLabel.textContent = monthNames[parseInt(cellDate.split('-')[1], 10) - 1].substring(0, 3) + ' ' + dayNum;
        } else if (dayNum === 1 && !isOtherMonth) {
            dateLabel.textContent = monthNames[month].substring(0, 3) + ' ' + dayNum;
        } else {
            dateLabel.textContent = dayNum;
        }
        cell.appendChild(dateLabel);

        // Appointments in this cell
        if (apptMap[cellDate]) {
            var dayAppts = apptMap[cellDate];
            for (var k = 0; k < dayAppts.length; k++) {
                var chip = createAppointmentChip(dayAppts[k]);
                cell.appendChild(chip);
            }
        }

        calendarBody.appendChild(cell);
    }
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function createAppointmentChip(appt) {
    var chip = document.createElement('div');
    chip.className = 'appt-chip';
    chip.title = appt.patient + ' / Dr. ' + appt.doctor + ' / ' + formatTime(appt.time);

    var text = document.createElement('span');
    text.className = 'chip-text';
    text.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 3px;"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"></path></svg>` + appt.patient + ' (Arrived) ' + formatTime(appt.time);
    chip.appendChild(text);

    var actions = document.createElement('div');
    actions.className = 'chip-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'chip-edit';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditModal(appt.id);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'chip-delete';
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    deleteBtn.title = 'Delete';
    deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openDeleteConfirm(appt.id);
    });

    var viewBtn = document.createElement('button');
    viewBtn.className = 'chip-view';
    viewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
    viewBtn.title = 'View';
    viewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditModal(appt.id); // reuse edit modal for viewing
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(viewBtn);
    chip.appendChild(actions);

    return chip;
}

// --- Dashboard Table ---
function renderDashboard() {
    var appointments = getFilteredAppointments();
    appointmentTbody.innerHTML = '';

    if (appointments.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
    }

    for (var i = 0; i < appointments.length; i++) {
        var appt = appointments[i];
        var tr = document.createElement('tr');

        tr.innerHTML =
            '<td><span class="link-blue">' + escapeHtml(appt.patient) + '</span></td>' +
            '<td><span class="link-blue">' + escapeHtml(appt.doctor) + '</span></td>' +
            '<td>' + escapeHtml(appt.hospital) + '</td>' +
            '<td>' + escapeHtml(appt.specialty) + '</td>' +
            '<td>' + formatDate(appt.date) + '</td>' +
            '<td><span class="time-green">' + formatTimeRange(appt.time) + '</span></td>' +
            '<td class="action-btns">' +
                '<button class="btn-edit-row" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>' +
                '<button class="btn-delete-row" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>' +
            '</td>';

        // Attach events
        (function (id) {
            var btns = tr.querySelectorAll('button');
            btns[0].addEventListener('click', function () { openEditModal(id); });
            btns[1].addEventListener('click', function () { openDeleteConfirm(id); });
        })(appt.id);

        appointmentTbody.appendChild(tr);
    }

    // Fill empty rows to match Figma (at least 8 visible rows)
    var totalRows = Math.max(8, appointments.length);
    for (var r = appointments.length; r < totalRows; r++) {
        var emptyTr = document.createElement('tr');
        emptyTr.className = 'empty-row';
        emptyTr.innerHTML = '<td colspan="7">&nbsp;</td>';
        appointmentTbody.appendChild(emptyTr);
    }
}

function getFilteredAppointments() {
    var all = getAppointments();
    var patientQuery = filterPatient.value.trim().toLowerCase();
    var doctorQuery = filterDoctor.value.trim().toLowerCase();
    var dateFrom = filterDateFrom.value;
    var dateTo = filterDateTo.value;

    return all.filter(function (appt) {
        if (patientQuery && appt.patient.toLowerCase().indexOf(patientQuery) === -1) return false;
        if (doctorQuery && appt.doctor.toLowerCase().indexOf(doctorQuery) === -1) return false;
        if (dateFrom && appt.date < dateFrom) return false;
        if (dateTo && appt.date > dateTo) return false;
        return true;
    });
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Modal ---
function openModal() {
    formAppointmentId.value = '';
    appointmentForm.reset();
    clearErrors();
    modalTitle.textContent = 'Schedule Appointment';
    modalOverlay.style.display = 'flex';
}

function closeModal() {
    modalOverlay.style.display = 'none';
    appointmentForm.reset();
    clearErrors();
}

function openEditModal(id) {
    var appointments = getAppointments();
    var appt = null;
    for (var i = 0; i < appointments.length; i++) {
        if (appointments[i].id === id) {
            appt = appointments[i];
            break;
        }
    }
    if (!appt) return;

    formAppointmentId.value = appt.id;
    document.getElementById('form-patient').value = appt.patient;
    document.getElementById('form-doctor').value = appt.doctor;
    document.getElementById('form-hospital').value = appt.hospital;
    document.getElementById('form-specialty').value = appt.specialty;
    document.getElementById('form-date').value = appt.date;
    document.getElementById('form-time').value = appt.time;
    document.getElementById('form-reason').value = appt.reason || '';

    modalTitle.textContent = 'Edit Appointment';
    clearErrors();
    modalOverlay.style.display = 'flex';
}

// --- Delete Confirmation ---
function openDeleteConfirm(id) {
    deleteTargetId = id;
    deleteOverlay.style.display = 'flex';
}

function closeDeleteConfirm() {
    deleteTargetId = null;
    deleteOverlay.style.display = 'none';
}

function confirmDelete() {
    if (!deleteTargetId) return;
    var appointments = getAppointments();
    appointments = appointments.filter(function (a) {
        return a.id !== deleteTargetId;
    });
    saveAppointments(appointments);
    closeDeleteConfirm();
    renderCalendar();
    renderDashboard();
}

// --- Form Validation & Save ---
function validateForm() {
    var valid = true;
    clearErrors();

    var fields = [
        { id: 'form-patient', errId: 'err-patient', msg: 'Patient name is required' },
        { id: 'form-doctor', errId: 'err-doctor', msg: 'Doctor name is required' },
        { id: 'form-hospital', errId: 'err-hospital', msg: 'Hospital name is required' },
        { id: 'form-specialty', errId: 'err-specialty', msg: 'Specialty is required' },
        { id: 'form-date', errId: 'err-date', msg: 'Date is required' },
        { id: 'form-time', errId: 'err-time', msg: 'Time is required' }
    ];

    for (var i = 0; i < fields.length; i++) {
        var el = document.getElementById(fields[i].id);
        var errEl = document.getElementById(fields[i].errId);
        if (!el.value.trim()) {
            errEl.textContent = fields[i].msg;
            el.closest('.form-group').classList.add('has-error');
            valid = false;
        }
    }

    // Date check: no past dates
    var dateVal = document.getElementById('form-date').value;
    if (dateVal) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var selected = new Date(dateVal + 'T00:00:00');
        if (selected < today) {
            document.getElementById('err-date').textContent = 'Date cannot be in the past';
            document.getElementById('form-date').closest('.form-group').classList.add('has-error');
            valid = false;
        }
    }

    return valid;
}

function clearErrors() {
    var errMsgs = document.querySelectorAll('.error-msg');
    for (var i = 0; i < errMsgs.length; i++) {
        errMsgs[i].textContent = '';
    }
    var groups = document.querySelectorAll('.form-group.has-error');
    for (var j = 0; j < groups.length; j++) {
        groups[j].classList.remove('has-error');
    }
}

function saveAppointment() {
    if (!validateForm()) return;

    var appt = {
        patient: document.getElementById('form-patient').value.trim(),
        doctor: document.getElementById('form-doctor').value.trim(),
        hospital: document.getElementById('form-hospital').value.trim(),
        specialty: document.getElementById('form-specialty').value.trim(),
        date: document.getElementById('form-date').value,
        time: document.getElementById('form-time').value,
        reason: document.getElementById('form-reason').value.trim()
    };

    var appointments = getAppointments();
    var editId = formAppointmentId.value;

    if (editId) {
        // Update existing
        for (var i = 0; i < appointments.length; i++) {
            if (appointments[i].id === editId) {
                appt.id = editId;
                appointments[i] = appt;
                break;
            }
        }
    } else {
        // New appointment
        appt.id = generateId();
        appointments.push(appt);
    }

    saveAppointments(appointments);
    closeModal();
    renderCalendar();
    renderDashboard();
}

// --- View Switching ---
function switchView(viewName) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
        views[i].classList.remove('active-view');
    }

    var links = document.querySelectorAll('.sidebar-link');
    for (var j = 0; j < links.length; j++) {
        links[j].classList.remove('active');
    }

    if (viewName === 'calendar') {
        document.getElementById('calendar-view').classList.add('active-view');
        document.getElementById('nav-calendar').classList.add('active');
        renderCalendar();
    } else {
        document.getElementById('dashboard-view').classList.add('active-view');
        document.getElementById('nav-dashboard').classList.add('active');
        renderDashboard();
    }
}

// --- Sidebar Toggle ---
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var isMobile = window.innerWidth <= 600;

    if (isMobile) {
        sidebar.classList.toggle('mobile-open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function () {
    // Initial render
    renderCalendar();
    renderDashboard();

    // Book Appointment button
    document.getElementById('btn-book-appointment').addEventListener('click', openModal);

    // Modal close
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-form').addEventListener('click', closeModal);

    // Modal overlay click to close
    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
    });

    // Form submit
    appointmentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        saveAppointment();
    });

    // Delete modal
    document.getElementById('btn-close-delete').addEventListener('click', closeDeleteConfirm);
    document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteConfirm);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmDelete);

    deleteOverlay.addEventListener('click', function (e) {
        if (e.target === deleteOverlay) closeDeleteConfirm();
    });

    // Calendar navigation
    document.getElementById('btn-prev-month').addEventListener('click', function () {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });

    document.getElementById('btn-next-month').addEventListener('click', function () {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });

    document.getElementById('btn-today').addEventListener('click', function () {
        var today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        renderCalendar();
    });

    // Sidebar toggle
    document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleSidebar);

    // Sidebar navigation
    document.getElementById('nav-calendar').addEventListener('click', function (e) {
        e.preventDefault();
        switchView('calendar');
    });

    document.getElementById('nav-dashboard').addEventListener('click', function (e) {
        e.preventDefault();
        switchView('dashboard');
    });

    // Dashboard live filters
    filterPatient.addEventListener('input', function () {
        renderDashboard();
    });

    filterDoctor.addEventListener('input', function () {
        renderDashboard();
    });

    // Update button applies date filter
    document.getElementById('btn-update-filter').addEventListener('click', function () {
        renderDashboard();
    });

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', function (e) {
        if (window.innerWidth <= 600) {
            var sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('mobile-open') &&
                !sidebar.contains(e.target) &&
                e.target.id !== 'btn-toggle-sidebar') {
                sidebar.classList.remove('mobile-open');
            }
        }
    });
});
