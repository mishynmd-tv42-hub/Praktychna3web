// ── DOM references ────────────────────────────────────────────────────
const form        = document.getElementById('diagForm');
const messageDiv  = document.getElementById('message');
const recordsList = document.getElementById('recordsList');
const filterSel   = document.getElementById('filterResult');

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Встановлюємо сьогоднішню дату за замовчуванням
  document.getElementById('diagnosticDate').valueAsDate = new Date();
  loadAll();
});

// ── Form submit ───────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  if (!validateForm()) return;

  const data = Object.fromEntries(new FormData(form));

  try {
    const res    = await fetch('/api/diagnostics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
      showMessage('success', result.message);
      form.reset();
      document.getElementById('diagnosticDate').valueAsDate = new Date();
      loadAll();
    } else {
      showMessage('error', result.message);
    }
  } catch (err) {
    showMessage('error', 'Помилка з\'єднання з сервером');
    console.error(err);
  }
});

// ── Filter ────────────────────────────────────────────────────────────
filterSel.addEventListener('change', loadAll);

// ── Load & display ────────────────────────────────────────────────────
async function loadAll() {
  try {
    const [records, stats] = await Promise.all([
      fetch('/api/diagnostics').then(r => r.json()),
      fetch('/api/diagnostics/stats').then(r => r.json())
    ]);
    updateStats(stats);
    displayRecords(records);
  } catch (err) {
    console.error('Помилка завантаження:', err);
  }
}

function updateStats(s) {
  document.getElementById('statTotal').textContent    = s.total;
  document.getElementById('statOk').textContent       = s.ok;
  document.getElementById('statWarning').textContent  = s.warning;
  document.getElementById('statCritical').textContent = s.critical;
}

function displayRecords(records) {
  const filter = filterSel.value;
  const shown  = filter ? records.filter(r => r.result === filter) : records;

  if (shown.length === 0) {
    recordsList.innerHTML = '<div class="empty-state">Записів не знайдено</div>';
    return;
  }

  const LABELS = { ok: 'Норма', warning: 'Увага', critical: 'Критично' };
  const TYPES  = {
    ups_online:  'ДБЖ онлайн (On-line)',
    ups_line:    'ДБЖ лінійно-інтерактивний',
    battery:     'Акумуляторна батарея',
    inverter:    'Інвертор',
    rectifier:   'Випрямляч',
    bypass:      'Модуль байпасу'
  };

  recordsList.innerHTML = shown.map(r => `
    <div class="record-card ${r.result}">
      <div class="record-top">
        <span class="record-title">${TYPES[r.equipmentType] || r.equipmentType}</span>
        <span class="badge badge-${r.result}">${LABELS[r.result]}</span>
      </div>
      <div class="record-meta">
        <span>📋 №${r.serialNumber}</span>
        <span>🏭 ${r.substationName}</span>
        <span>📅 ${formatDate(r.diagnosticDate)}</span>
      </div>
      ${r.notes ? `<div class="record-note">💬 ${r.notes}</div>` : ''}
      <div class="notification-bar ${r.notification.level}">🔔 ${r.notification.text}</div>
      <button class="btn btn-delete" onclick="deleteRecord('${r.id}')">🗑 Видалити</button>
    </div>
  `).join('');
}

// ── Delete ────────────────────────────────────────────────────────────
async function deleteRecord(id) {
  if (!confirm('Видалити цей запис діагностики?')) return;
  try {
    const res    = await fetch(`/api/diagnostics/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showMessage('success', result.message);
      loadAll();
    } else {
      showMessage('error', result.message || 'Помилка видалення');
    }
  } catch (err) {
    showMessage('error', 'Помилка з\'єднання з сервером');
  }
}

// ── Validation ────────────────────────────────────────────────────────
function validateForm() {
  let valid = true;

  const fields = [
    { id: 'equipmentType',  msg: 'Оберіть тип обладнання' },
    { id: 'serialNumber',   msg: 'Введіть серійний номер' },
    { id: 'diagnosticDate', msg: 'Вкажіть дату діагностики' },
    { id: 'substationName', msg: 'Введіть назву підстанції' },
  ];

  fields.forEach(({ id, msg }) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      setError(id, msg);
      el.classList.add('invalid');
      valid = false;
    }
  });

  // Перевірка radio
  if (!form.querySelector('input[name="result"]:checked')) {
    setError('result', 'Оберіть результат діагностики');
    valid = false;
  }

  // Перевірка дати — не в майбутньому
  const dateVal = document.getElementById('diagnosticDate').value;
  if (dateVal && new Date(dateVal) > new Date()) {
    setError('diagnosticDate', 'Дата не може бути в майбутньому');
    document.getElementById('diagnosticDate').classList.add('invalid');
    valid = false;
  }

  return valid;
}

function setError(fieldId, msg) {
  const el = document.getElementById('err-' + fieldId);
  if (el) el.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.err').forEach(el => el.textContent = '');
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

// ── Helpers ───────────────────────────────────────────────────────────
function showMessage(type, text) {
  messageDiv.className    = `message ${type}`;
  messageDiv.textContent  = text;
  setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
}

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}
