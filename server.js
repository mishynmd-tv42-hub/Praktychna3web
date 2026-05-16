const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ── Data file path ───────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'diagnostics.json');

// ── Helpers ──────────────────────────────────────────────────────────
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Помилка читання даних:', err);
    return [];
  }
}

function writeData(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Помилка запису даних:', err);
    return false;
  }
}

// Визначення статусу сповіщення за результатами діагностики
function calcNotification(result) {
  if (result === 'critical') return { level: 'critical', text: 'КРИТИЧНО — негайне втручання' };
  if (result === 'warning')  return { level: 'warning',  text: 'УВАГА — планове обслуговування' };
  return                            { level: 'ok',       text: 'НОРМА — відхилень не виявлено' };
}

// ── Routes ───────────────────────────────────────────────────────────

// GET  /api/diagnostics — отримати всі записи
app.get('/api/diagnostics', (req, res) => {
  res.json(readData());
});

// POST /api/diagnostics — додати новий запис
app.post('/api/diagnostics', (req, res) => {
  try {
    const { equipmentType, serialNumber, substationName,
            diagnosticDate, result, notes } = req.body;

    // Серверна валідація
    if (!equipmentType || !serialNumber || !substationName ||
        !diagnosticDate || !result) {
      return res.status(400).json({
        success: false,
        message: 'Усі обов\'язкові поля мають бути заповнені'
      });
    }

    const notification = calcNotification(result);

    const record = {
      id:             Date.now().toString(),
      equipmentType,
      serialNumber:   serialNumber.trim(),
      substationName: substationName.trim(),
      diagnosticDate,
      result,
      notes:          notes ? notes.trim() : '',
      notification,
      createdAt:      new Date().toISOString()
    };

    const data = readData();
    data.unshift(record); // нові записи вгорі

    if (writeData(data)) {
      res.status(201).json({
        success: true,
        message: 'Запис діагностики успішно збережено',
        data:    record
      });
    } else {
      throw new Error('Помилка запису у файл');
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Внутрішня помилка сервера',
      error:   err.message
    });
  }
});

// DELETE /api/diagnostics/:id — видалити запис
app.delete('/api/diagnostics/:id', (req, res) => {
  try {
    const data    = readData();
    const updated = data.filter(r => r.id !== req.params.id);

    if (data.length === updated.length) {
      return res.status(404).json({ success: false, message: 'Запис не знайдено' });
    }

    if (writeData(updated)) {
      res.json({ success: true, message: 'Запис видалено' });
    } else {
      throw new Error('Помилка запису у файл');
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Помилка видалення', error: err.message });
  }
});

// GET /api/diagnostics/stats — статистика для дашборду
app.get('/api/diagnostics/stats', (req, res) => {
  const data = readData();
  const stats = {
    total:    data.length,
    ok:       data.filter(r => r.result === 'ok').length,
    warning:  data.filter(r => r.result === 'warning').length,
    critical: data.filter(r => r.result === 'critical').length,
  };
  res.json(stats);
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
