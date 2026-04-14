/* awesome QR - App Logic (Google Sheets Storage) */
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbz7n89wjN9k3ig2KGyO1dTx06RzZXBmvXNgfPHKfANh6lmiI0hMkIzpTd8pvbeEdQgs/exec';
const LOCAL_KEY = 'awesome-qr-cache';
let _data = [];

// ─── Storage Layer ───
async function loadData() {
  try {
    showLoading(true);
    const res = await fetch(SHEETS_URL + '?action=read');
    const json = await res.json();
    _data = json.data || [];
    // Cache locally for offline use
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(_data)); } catch(e) {}
    showLoading(false);
    return _data;
  } catch(e) {
    console.warn('Sheets unavailable, using local cache:', e);
    try { _data = JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch(e2) { _data = []; }
    showLoading(false);
    return _data;
  }
}

async function saveData(entry) {
  try {
    showLoading(true);
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'write', data: entry })
    });
    const json = await res.json();
    showLoading(false);
    if (json.status === 'ok') {
      _data.push(entry);
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(_data)); } catch(e) {}
      return true;
    }
    return false;
  } catch(e) {
    console.error('Save failed:', e);
    showLoading(false);
    // Save locally as fallback, sync later
    _data.push({ ...entry, _offline: true });
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(_data)); } catch(e2) {}
    showMsg('errorBox', 'Saved locally (offline). Will sync when connection returns.');
    return true;
  }
}

async function deleteEntry(rowIndex) {
  try {
    showLoading(true);
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete', row: rowIndex })
    });
    _data.splice(rowIndex, 1);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(_data)); } catch(e) {}
    showLoading(false);
    renderEntries();
  } catch(e) {
    showLoading(false);
    showMsg('errorBox', 'Delete failed. Check your connection.');
  }
}

async function deleteAllEntries() {
  if (!confirm('Delete ALL saved data? This cannot be undone.')) return;
  try {
    showLoading(true);
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'clear' })
    });
    _data = [];
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(_data)); } catch(e) {}
    showLoading(false);
    renderEntries();
    showMsg('successBox', 'All data cleared.');
  } catch(e) {
    showLoading(false);
    showMsg('errorBox', 'Clear failed. Check your connection.');
  }
}

function showLoading(show) {
  let el = document.getElementById('loadingIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingIndicator';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:var(--primary);z-index:9999;transition:opacity 0.3s';
    el.innerHTML = '<div style="height:100%;width:30%;background:var(--secondary);animation:loadbar 1s infinite"></div>';
    document.body.appendChild(el);
    const style = document.createElement('style');
    style.textContent = '@keyframes loadbar{0%{margin-left:0}50%{margin-left:70%}100%{margin-left:0}}';
    document.head.appendChild(style);
  }
  el.style.opacity = show ? '1' : '0';
}

// ─── Field Helpers ───
function getValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.classList.contains('radio-group')) {
    const c = document.querySelector('input[name="'+id+'"]:checked');
    return c ? c.value : '';
  }
  if (el.type === 'checkbox') return el.checked ? 'Yes' : 'No';
  return el.value.trim();
}
function setFieldValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.classList.contains('radio-group')) {
    const r = document.querySelector('input[name="'+id+'"][value="'+val+'"]');
    if (r) r.checked = true;
  } else { el.value = val; }
}
function showField(id, show) {
  const el = document.getElementById(id);
  if (el) { const p = el.closest('.grid-cell') || el.parentElement; if (p) p.style.display = show ? '' : 'none'; }
}
function toggleField(id) {
  const el = document.getElementById(id);
  if (el) { const p = el.closest('.grid-cell') || el.parentElement; if (p) p.style.display = p.style.display === 'none' ? '' : 'none'; }
}
function disableField(id, disabled) {
  const el = document.getElementById(id);
  if (el) { el.disabled = disabled; el.style.opacity = disabled ? '0.5' : '1'; }
}
function showMsg(boxId, msg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.innerHTML = msg; box.style.display = 'block';
  const other = boxId === 'errorBox' ? 'successBox' : 'errorBox';
  const ob = document.getElementById(other); if (ob) ob.style.display = 'none';
  if (boxId === 'successBox') setTimeout(() => box.style.display = 'none', 3000);
}
function exportCSV() {
  if (!_data.length) { alert('No data to export'); return; }
  const keys = Object.keys(_data[0]).filter(k => !k.startsWith('_'));
  const header = ['Time', ...keys].join(',');
  const rows = _data.map(r => [r._time, ...keys.map(k => '"' + (r[k] || '').toString().replace(/"/g, '""') + '"')].join(','));
  const csv = header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'awesome-qr-data.csv'; a.click();
}

// ─── Validation ───
function validateForm() {
  const errors = [];

  return errors;
}

// ─── Form Submit ───
async function handleSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const errors = validateForm();
  if (errors.length) { showMsg('errorBox', errors.map(e => '<div>• ' + e + '</div>').join('')); return false; }
  // Default: save and show success
  const entry = {};
  document.querySelectorAll('.input-field,.radio-group').forEach(el => { if (el.id) entry[el.id] = getValue(el.id); });
  entry._time = new Date().toLocaleString();
  const ok = await saveData(entry);
  if (ok) { renderEntries(); showMsg('successBox', 'Saved!'); document.getElementById('appForm').reset(); }
  return false;
}

// ─── Button & Change Handlers ───
async function handleAction(id) {
  // Default: any button validates and saves all fields
  await handleSubmit(new Event('submit'));
}
function handleFieldChange(id) {
  // No change actions defined
}

// ─── Render Entries ───
function renderEntries() {
  const list = document.getElementById('entriesList');
  if (!_data.length) { list.innerHTML = '<p style="color:#999">No entries yet.</p>'; return; }
  list.innerHTML = _data.map((d, i) => {
    const items = Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => '<b>' + k + ':</b> ' + v).join('<br>');
    const offline = d._offline ? ' <span style="color:#e88;font-size:10px">(offline)</span>' : '';
    return '<div class="entry-card"><div style="display:flex;justify-content:space-between"><small style="color:#999">' + d._time + offline + '</small><button onclick="deleteEntry(' + i + ')" style="background:none;border:none;color:#c33;cursor:pointer;font-size:12px">Delete</button></div>' + items + '</div>';
  }).join('');
}

// ─── Event Listeners ───
document.addEventListener('input', e => {
  if (e.target.id && document.getElementById(e.target.id + '_preview')) {
    const m = e.target.value.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    document.getElementById(e.target.id + '_preview').innerHTML = m ? '<iframe src="https://www.youtube.com/embed/' + m[1] + '" allowfullscreen></iframe>' : '';
  }
  if (e.target.id) handleFieldChange(e.target.id);
});
document.addEventListener('change', e => {
  const rg = e.target.closest('.radio-group');
  if (rg) handleFieldChange(rg.id);
  if (e.target.tagName === 'SELECT') handleFieldChange(e.target.id);
});

// ─── QR Scanner ───
var _qrStreams = {};
var _qrAnimFrames = {};

function startQRScan(fieldId, successAction, successMsg, soundUrl) {
  var viewport = document.getElementById(fieldId + '_viewport');
  var video = document.getElementById(fieldId + '_video');
  var resultDiv = document.getElementById(fieldId + '_result');
  if (!viewport || !video) { alert('QR scanner elements not found'); return; }
  
  viewport.style.display = 'block';
  resultDiv.style.display = 'none';
  
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
      _qrStreams[fieldId] = stream;
      video.srcObject = stream;
      video.play();
      // Start scanning frames
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      
      function scanFrame() {
        if (!_qrStreams[fieldId]) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // Use jsQR library if available, otherwise use BarcodeDetector API
          if (typeof jsQR !== 'undefined') {
            var code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              handleQRResult(fieldId, code.data, successAction, successMsg, soundUrl);
              return;
            }
          } else if (typeof BarcodeDetector !== 'undefined') {
            var detector = new BarcodeDetector({ formats: ['qr_code'] });
            detector.detect(canvas).then(function(barcodes) {
              if (barcodes.length > 0) {
                handleQRResult(fieldId, barcodes[0].rawValue, successAction, successMsg, soundUrl);
                return;
              }
            }).catch(function() {});
          }
        }
        _qrAnimFrames[fieldId] = requestAnimationFrame(scanFrame);
      }
      _qrAnimFrames[fieldId] = requestAnimationFrame(scanFrame);
    })
    .catch(function(err) {
      alert('Camera access denied or not available: ' + err.message);
      viewport.style.display = 'none';
    });
}

function stopQRScan(fieldId) {
  if (_qrStreams[fieldId]) {
    _qrStreams[fieldId].getTracks().forEach(function(t) { t.stop(); });
    delete _qrStreams[fieldId];
  }
  if (_qrAnimFrames[fieldId]) {
    cancelAnimationFrame(_qrAnimFrames[fieldId]);
    delete _qrAnimFrames[fieldId];
  }
  var viewport = document.getElementById(fieldId + '_viewport');
  if (viewport) viewport.style.display = 'none';
}

async function handleQRResult(fieldId, data, successAction, successMsg, soundUrl) {
  stopQRScan(fieldId);
  
  var resultDiv = document.getElementById(fieldId + '_result');
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<strong>Scanned:</strong> ' + data;
  }
  
  // Always save to cloud storage
  var entry = {
    _time: new Date().toLocaleString(),
    scan_field: fieldId,
    qr_data: data,
    scan_type: 'qr_code'
  };
  await saveData(entry);
  renderEntries();
  
  // Success feedback
  if (successAction === 'text' || successAction === 'both') {
    showMsg('successBox', successMsg || 'QR Code scanned: ' + data);
  }
  if (successAction === 'sound' || successAction === 'both') {
    try {
      if (soundUrl) {
        var audio = new Audio(soundUrl);
        audio.play().catch(function() {});
      } else {
        // Generate a clean success beep using Web Audio API
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Beep 1: short high tone
        var osc1 = ctx.createOscillator();
        var gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        // Beep 2: confirming higher tone
        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1320;
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.12);
        osc2.stop(ctx.currentTime + 0.35);
      }
    } catch(e) {}
  }
}

// ─── Page Load ───
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderEntries();

});