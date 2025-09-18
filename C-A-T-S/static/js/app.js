// --- UTILITIES ---
const getJSON = async (url) => { try { const res = await fetch(url); if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); return await res.json(); } catch (e) { console.error("API Error:", e); return null; } };
const postJSON = async (url, body) => {
    try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } catch (e) { console.error("API Error:", e); return null; }
};
const ymdToDmy = (ymd) => { if (!ymd) return ""; const [y, m, d] = ymd.split("-"); return `${d}-${m}-${y}`; };
async function loadSubjects(selectEl) {
    if (!selectEl) return;
    const currentVal = selectEl.value;
    const subs = await getJSON("/api/subjects");
    if (subs) { 
        selectEl.innerHTML = '<option value="">Select Subject</option>' + subs.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
        if (currentVal) selectEl.value = currentVal;
    }
}


// --- MAIN LOGIC ---
document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    // --- Splash Screen Animation ---
    if (page === 'home') {
        const logo = document.querySelector('.splash-logo');
        const mainContent = document.querySelector('.home-hero');
        if (logo && mainContent) {
            setTimeout(() => {
                logo.classList.add('fade-out');
            }, 1000);
            logo.addEventListener('transitionend', () => {
                logo.style.display = 'none';
                mainContent.style.opacity = '1';
                mainContent.style.visibility = 'visible';
            });
        }
    }

    // --- ATTENDANCE: Store Page ---
    if (page === "store") {
        const subjSel = document.getElementById("subjectSelect");
        const dateInp = document.getElementById("attendanceDate");
        const bodyEl = document.getElementById("studentBody");
        const saveBtn = document.getElementById("saveBtn");
        const statusMsg = document.getElementById("statusMessage");
        const fmtTodayForInput = () => new Date().toISOString().split('T')[0];
        if (dateInp) dateInp.value = fmtTodayForInput();
        async function loadStudents(tbodyEl) {
            const sts = await getJSON("/api/students");
            if(!sts) { tbodyEl.innerHTML = '<tr><td colspan="6">Could not load students.</td></tr>'; return; }
            tbodyEl.innerHTML = sts.map((s, idx) => `
                <tr data-student-id="${s.id}">
                <td>${idx + 1}</td><td>${s.roll_no}</td><td>${s.name}</td>
                <td style="text-align:center;"><input type="radio" name="st_${s.id}" value="Present"></td>
                <td style="text-align:center;"><input type="radio" name="st_${s.id}" value="Absent Informed"></td>
                <td style="text-align:center;"><input type="radio" name="st_${s.id}" value="Absent Uninformed"></td>
                </tr>`).join("");
        }
        function wireValidation(tbodyEl, saveBtn) {
            const update = () => {
                const rows = [...tbodyEl.querySelectorAll("tr")];
                if (rows.length === 0 || !rows[0].dataset.studentId) { saveBtn.disabled = true; }
                else { saveBtn.disabled = !rows.every(r => !!r.querySelector(`input[name="st_${r.dataset.studentId}"]:checked`)); }
                saveBtn.classList.toggle("disabled", saveBtn.disabled);
            };
            tbodyEl.addEventListener("change", update);
            update();
        }
        loadSubjects(subjSel);
        wireValidation(bodyEl, saveBtn);
        const checkExistingAttendance = async () => {
            const subject_id = subjSel.value;
            const selectedDate = dateInp.value;
            if (!subject_id || !selectedDate) {
                bodyEl.innerHTML = ""; if (statusMsg) statusMsg.innerHTML = "Please select a subject and a date.";
                wireValidation(bodyEl, saveBtn); return;
            }
            await loadStudents(bodyEl);
            const date = ymdToDmy(selectedDate);
            const data = await getJSON(`/api/get_attendance_for_store?subject_id=${subject_id}&date=${date}`);
            if (data && data.ok && data.records) {
                let attendanceTaken = data.records.some(r => r.status !== 'none');
                data.records.forEach(r => { if (r.status !== 'none') { const radio = document.querySelector(`tr[data-student-id="${r.student_id}"] input[value="${r.status}"]`); if (radio) radio.checked = true; } });
                if (statusMsg) { statusMsg.innerHTML = attendanceTaken ? `✅ Attendance for ${date} already exists. You can edit it.` : `ℹ️ No attendance found for ${date}. Please mark it below.`; }
                wireValidation(bodyEl, saveBtn);
            }
        };
        subjSel.addEventListener("change", checkExistingAttendance);
        dateInp.addEventListener("change", checkExistingAttendance);
        document.getElementById("attendanceForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const date = ymdToDmy(dateInp.value);
            const subject_id = parseInt(subjSel.value, 10);
            const marks = [...bodyEl.querySelectorAll("tr")].map(r => ({ student_id: parseInt(r.dataset.studentId, 10), status: r.querySelector(`input[name="st_${r.dataset.studentId}"]:checked`).value }));
            const resp = await postJSON("/api/save_attendance", { date, subject_id, marks });
            if (resp && resp.ok) { alert("✅ Attendance stored successfully!"); if(statusMsg) statusMsg.innerHTML = `✅ Attendance for ${date} already exists. You can edit it.`; }
            else { alert("❌ Failed to store: " + (resp ? resp.error : "Unknown error")); }
        });
    }

    // --- ATTENDANCE: View Page ---
    if (page === "view") {
        const subjSel = document.getElementById("viewSubject");
        const showBtn = document.getElementById("showRecords");
        const area = document.getElementById("recordsArea");
        const filterTypeSel = document.getElementById("filterType");
        const dayControls = document.getElementById("dayFilterControls");
        const monthControls = document.getElementById("monthFilterControls");
        const yearControls = document.getElementById("yearFilterControls");
        
        loadSubjects(subjSel);
        
        const currentYear = new Date().getFullYear();
        document.getElementById('viewYearMonth').value = currentYear;
        document.getElementById('viewYear').value = currentYear;
        document.getElementById('viewDate').valueAsDate = new Date();

        filterTypeSel.addEventListener('change', () => {
            dayControls.style.display = 'none';
            monthControls.style.display = 'none';
            yearControls.style.display = 'none';
            if (filterTypeSel.value === 'day') dayControls.style.display = 'inline-block';
            if (filterTypeSel.value === 'month') monthControls.style.display = 'inline-block';
            if (filterTypeSel.value === 'year') yearControls.style.display = 'inline-block';
        });

        showBtn.addEventListener("click", async () => {
            const subject_id = subjSel.value;
            const filter_type = filterTypeSel.value;
            if (!subject_id) { alert("Please select a subject."); return; }

            const params = new URLSearchParams({ subject_id, filter_type });
            let reportTitle = `Records for ${subjSel.options[subjSel.selectedIndex].text}`;

            if (filter_type === 'day') {
                const date = document.getElementById('viewDate').value;
                if (!date) { alert('Please select a date.'); return; }
                params.append('date', ymdToDmy(date));
            } else if (filter_type === 'month') {
                const year = document.getElementById('viewYearMonth').value;
                const month = document.getElementById('viewMonth').value;
                if (!year || !month) { alert('Please select a year and month.'); return; }
                params.append('year', year); params.append('month', month);
            } else if (filter_type === 'year') {
                const year = document.getElementById('viewYear').value;
                if (!year) { alert('Please select a year.'); return; }
                params.append('year', year);
            }

            area.innerHTML = "<p>Loading...</p>";
            const data = await getJSON(`/api/get_attendance?${params.toString()}`);
            
            if (!data || !data.ok) { area.innerHTML = `<p>Error: ${data ? data.error : "failed"}</p>`; return; }
            const rows = data.records;
            if (!rows || rows.length === 0) { area.innerHTML = `<p>No records found.</p>`; return; }
            
            let html = `<h3>${reportTitle}</h3>`;
            if (filter_type === "day") {
                if (rows.every(r => r.status === 'Absent Uninformed')) { area.innerHTML = `<p>No attendance taken for this date.</p>`; return; }
                html += `<table class="table"><thead><tr><th>S.No</th><th>Roll No</th><th>Name</th><th>Status</th></tr></thead><tbody>`;
                rows.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${r.roll_no}</td><td>${r.name}</td><td>${r.status}</td></tr>`; });
            } else {
                html += `<table class="table"><thead><tr><th>S.No</th><th>Date</th><th>Roll No</th><th>Name</th><th>Status</th></tr></thead><tbody>`;
                rows.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${r.date}</td><td>${r.roll_no}</td><td>${r.name}</td><td>${r.status}</td></tr>`; });
            }
            html += `</tbody></table>`;
            area.innerHTML = html;
        });
    }

    // --- ATTENDANCE: Individual Report Page ---
    if (page === "individual") {
        const subjectSelect = document.getElementById("subjectSelect");
        loadSubjects(subjectSelect).then(() => { if (subjectSelect.options.length > 0) subjectSelect.options[0].textContent = 'All Subjects'; });

        const dateType = document.getElementById("dateType");
        const dateInputContainer = document.getElementById("dateInputContainer");
        const monthYearInputContainer = document.getElementById("monthYearInputContainer");
        const yearInputContainer = document.getElementById("yearInputContainer");

        dateType.addEventListener("change", function() {
            dateInputContainer.style.display = "none";
            monthYearInputContainer.style.display = "none";
            yearInputContainer.style.display = "none";
            if (this.value === "date") dateInputContainer.style.display = "inline-block";
            if (this.value === "month") monthYearInputContainer.style.display = "inline-block";
            if (this.value === "year") yearInputContainer.style.display = "inline-block";
        });

        document.getElementById("searchBtn").addEventListener("click", async () => {
            const info = document.getElementById("studentInfo");
            const rep = document.getElementById("studentReport");
            const query = document.getElementById("searchQuery").value.trim();
            if (!query) { info.innerHTML = "<p>Please enter a name or roll number.</p>"; return; }

            const params = new URLSearchParams({
                query: query,
                subject_id: subjectSelect.value,
                dateType: dateType.value,
                year: document.getElementById('yearInputMonth').value || document.getElementById('yearInput').value,
                month: document.getElementById('monthInput').value,
                date: document.getElementById('dateInput').value,
            });

            info.innerHTML = "Searching…";
            rep.innerHTML = "";
            const data = await getJSON(`/api/student_report?${params.toString()}`);
            
            if (!data || !data.ok) { info.innerHTML = `<p>Error: ${data ? data.error : "failed"}</p>`; return; }
            if (!data.student) { info.innerHTML = `<p>No matching student found.</p>`; return; }
            
            const s = data.student;
            info.innerHTML = `<div><strong>${s.name}</strong> — Roll No: <strong>${s.roll_no}</strong></div>`;
            const rows = data.rows;
            if (rows.length === 0) { rep.innerHTML = "<p>No attendance records found for this filter.</p>"; return; }
            
            let html = `<h4>Detailed Records</h4><table class="table"><thead><tr><th>S.No</th><th>Date</th><th>Subject</th><th>Status</th></tr></thead><tbody>`;
            rows.forEach((r, i) => { html += `<tr><td>${i+1}</td><td>${r.date}</td><td>${r.subject}</td><td>${r.status}</td></tr>`; });
            html += `</tbody></table>`;
            rep.innerHTML = html;
        });
    }
    
    // --- HOMEWORK: Manage Page ---
    if (page === 'manage_homework') {
        // Tab functionality
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(button.dataset.target).classList.add('active');
            });
        });

        // Form elements
        const form = document.getElementById('homeworkForm');
        const homeworkIdField = document.getElementById('homeworkId');
        const formTitle = document.getElementById('form-title');
        const submitBtn = document.getElementById('submitBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const subjectSel = document.getElementById('hwSubject');
        const titleField = document.getElementById('hwTitle');
        const descriptionField = document.getElementById('hwDescription');
        const dueDateField = document.getElementById('hwDueDate');
        
        // Filter elements
        const subjectFilter = document.getElementById('subjectFilter');
        const dateFilter = document.getElementById('dateFilter');
        const assignmentsList = document.getElementById('assignmentsList');

        // Initial population
        loadSubjects(subjectSel);
        loadSubjects(subjectFilter);

        // Form logic
        const resetForm = () => { form.reset(); homeworkIdField.value = ''; formTitle.textContent = 'Post New Homework'; submitBtn.textContent = 'Save Homework'; cancelBtn.style.display = 'none'; };
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const homeworkId = homeworkIdField.value;
            const data = {
                subject_id: subjectSel.value, title: titleField.value,
                description: descriptionField.value, due_date: dueDateField.value,
            };
            const url = homeworkId ? `/api/homework/${homeworkId}` : '/api/homework';
            const resp = await postJSON(url, data);
            if (resp && resp.ok) { 
                alert(`Homework ${homeworkId ? 'updated' : 'posted'} successfully!`); 
                window.location.href = '/homework/manage?tab=gradebook'; // Reload to gradebook
            } else { 
                alert('Error: Operation failed.'); 
            }
        });
        cancelBtn.addEventListener('click', resetForm);

        // Filter button logic
        document.getElementById('filterBtn').addEventListener('click', () => {
            const params = new URLSearchParams();
            if (subjectFilter.value) params.append('subject_id', subjectFilter.value);
            if (dateFilter.value) params.append('date', dateFilter.value);
            params.append('tab', 'gradebook'); // This is CRUCIAL to stay on the correct tab
            window.location.href = `/homework/manage?${params.toString()}`;
        });

        // Event delegation for the entire assignments list
        assignmentsList.addEventListener('click', (e) => {
            const target = e.target;
            const assignmentItem = target.closest('.assignment-item');
            if (!assignmentItem) return;

            const homeworkId = assignmentItem.dataset.homeworkId;

            // Handle Grade button click
            if (target.classList.contains('btn-grade')) {
                const gradingPanel = assignmentItem.querySelector('.assignment-grading-panel');
                if (gradingPanel) {
                    gradingPanel.style.display = gradingPanel.style.display === 'none' ? 'block' : 'none';
                }
            }
            
            // Handle Delete button click
            if (target.classList.contains('btn-delete')) {
                if (confirm('Are you sure you want to delete this homework? This will delete all related grades and doubts.')) {
                    fetch(`/api/homework/${homeworkId}`, { method: 'DELETE' })
                        .then(res => res.json())
                        .then(data => { 
                            if(data && data.ok) {
                                assignmentItem.remove(); 
                            } else {
                                alert('Failed to delete homework.');
                            }
                        });
                }
            }

            // Handle Edit button click
            if (target.classList.contains('btn-edit')) {
                // Populate the form with data from the assignment item's data attributes
                homeworkIdField.value = homeworkId;
                titleField.value = assignmentItem.dataset.title;
                subjectSel.value = assignmentItem.dataset.subjectId;
                descriptionField.value = assignmentItem.dataset.description;
                const [d, m, y] = assignmentItem.dataset.dueDate.split('-');
                dueDateField.value = `${y}-${m}-${d}`;
                
                // Update form UI
                formTitle.textContent = 'Edit Homework';
                submitBtn.textContent = 'Update Homework';
                cancelBtn.style.display = 'inline-block';
                
                // Switch to the form tab and scroll to top
                document.querySelector('.tab-button[data-target="post-homework"]').click();
                window.scrollTo(0, 0);
            }
        });

        // Event delegation for grade inputs
        assignmentsList.addEventListener('change', async (e) => {
            if (e.target.classList.contains('grade-input')) {
                const input = e.target;
                const result = await postJSON('/api/homework/grade', {
                    homework_id: input.dataset.homeworkId, 
                    student_id: input.dataset.studentId,
                    grade: input.value === '' ? null : parseInt(input.value, 10)
                });
                
                if (result && result.ok) {
                    input.style.backgroundColor = '#d4edda'; // Green flash for success
                    setTimeout(() => { input.style.backgroundColor = ''; }, 1000);
                } else {
                    input.style.backgroundColor = '#f8d7da'; // Red flash for error
                    setTimeout(() => { input.style.backgroundColor = ''; }, 1000);
                }
            }
        });
    }
    
    // --- HOMEWORK: Status Page ---
    if (page === 'homework_status') {
        document.querySelector('.homework-status-list')?.addEventListener('change', async (e) => {
            if (e.target.classList.contains('status-toggle')) {
                const checkbox = e.target;
                const homeworkItem = checkbox.closest('.homework-item');
                const result = await postJSON('/api/homework_status', {
                    homework_id: homeworkItem.dataset.homeworkId,
                    status: checkbox.checked ? 'Completed' : 'Pending'
                });
                if (result && result.ok) { 
                    homeworkItem.classList.toggle('completed', checkbox.checked); 
                } else { 
                    alert('Failed to update status.'); checkbox.checked = !checkbox.checked; 
                }
            }
        });
    }
    
    // --- HOMEWORK: Doubts Page ---
    if (page === "homework_doubts") {
        const doubtsList = document.getElementById('doubts-list');
        const doubtForm = document.getElementById('doubt-form');
        if (doubtForm) {
            doubtForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const student_id = document.getElementById('studentSelector').value;
                if (!student_id) { alert("Please select a student."); return; }
                const result = await postJSON('/api/doubts/ask', {
                    homework_id: form.dataset.homeworkId, student_id: student_id,
                    question: form.querySelector('textarea').value
                });
                if (result && result.ok) location.reload(); else alert("Failed to post doubt.");
            });
        }
        if (doubtsList) {
            doubtsList.addEventListener('click', (e) => {
                const target = e.target;
                const doubtCard = target.closest('.doubt-card');
                if (!doubtCard) return;
                const doubtId = doubtCard.dataset.doubtId;
                if (target.classList.contains('btn-delete-doubt')) {
                    if (confirm("Are you sure?")) {
                        fetch(`/api/doubts/${doubtId}`, { method: 'DELETE' })
                            .then(res => res.json())
                            .then(data => { if (data && data.ok) doubtCard.remove(); else alert("Failed to delete doubt."); });
                    }
                }
                if (target.classList.contains('btn-edit-doubt')) {
                    doubtCard.querySelector('.question').style.display = 'none';
                    doubtCard.querySelector('.doubt-actions').style.display = 'none';
                    doubtCard.querySelector('.edit-doubt-form').style.display = 'block';
                    doubtCard.querySelector('.edit-doubt-form textarea').focus();
                }
                if (target.classList.contains('btn-cancel-edit')) {
                    doubtCard.querySelector('.question').style.display = 'block';
                    doubtCard.querySelector('.doubt-actions').style.display = 'flex';
                    doubtCard.querySelector('.edit-doubt-form').style.display = 'none';
                }
            });
            doubtsList.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                if (form.classList.contains('edit-doubt-form')) {
                    const doubtId = form.dataset.doubtId;
                    const question = form.querySelector('textarea').value;
                    const result = await postJSON(`/api/doubts/${doubtId}`, { question });
                    if (result && result.ok) {
                        const questionP = form.closest('.doubt-card').querySelector('.question');
                        questionP.textContent = `Q: ${question}`;
                        questionP.style.display = 'block';
                        form.style.display = 'none';
                        form.closest('.doubt-card').querySelector('.doubt-actions').style.display = 'flex';
                    } else { alert("Failed to update doubt."); }
                }
                if (form.classList.contains('answer-form')) {
                    const result = await postJSON('/api/doubts/answer', {
                        doubt_id: form.dataset.doubtId,
                        answer: form.querySelector('textarea').value
                    });
                    if (result && result.ok) location.reload(); else alert("Failed to post answer.");
                }
            });
        }
    }
    
    // --- HOMEWORK: Calendar Page ---
    if (page === 'homework_calendar') {
        const calendarEl = document.getElementById('calendar');
        if (typeof FullCalendar !== 'undefined' && calendarEl) {
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listWeek' },
                events: '/api/homework/events',
                eventClick: function(info) {
                    info.jsEvent.preventDefault(); 
                    if (info.event.url) window.location.href = info.event.url;
                }
            });
            calendar.render();
        }
    }
});