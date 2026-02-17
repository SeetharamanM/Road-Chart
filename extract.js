(function () {
  'use strict';

  const COMPLETED_YEAR_COL = 'Completed Year';
  const LENGTH_COL = 'Length';
  const ROAD_NO_COL = 'Road_No';
  const NAME_OF_ROAD_COL = 'Name of road';

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { rows: [], columns: [] };
    const header = lines[0];
    const cols = [];
    let i = 0;
    let inQuotes = false;
    let col = '';
    for (let j = 0; j <= header.length; j++) {
      const c = header[j];
      if (c === '"') inQuotes = !inQuotes;
      else if ((c === ',' || c === undefined) && !inQuotes) {
        cols.push(col.trim());
        col = '';
      } else if (c) col += c;
    }
    if (col) cols.push(col.trim());

    const rows = [];
    for (let L = 1; L < lines.length; L++) {
      const line = lines[L];
      const values = [];
      let val = '';
      inQuotes = false;
      for (let j = 0; j <= line.length; j++) {
        const c = line[j];
        if (c === '"') inQuotes = !inQuotes;
        else if ((c === ',' || c === undefined) && !inQuotes) {
          values.push(val.trim());
          val = '';
        } else if (c) val += c;
      }
      if (val) values.push(val.trim());
      const row = {};
      cols.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
      rows.push(row);
    }
    return { rows, columns: cols };
  }

  function parseYear(value) {
    const n = parseInt(String(value).trim(), 10);
    return isNaN(n) ? null : n;
  }

  function extractByCompletedYear(rows, columns, year) {
    if (!columns.includes(COMPLETED_YEAR_COL) || !columns.includes(LENGTH_COL)) {
      return {
        error: 'CSV must have columns "Completed Year" and "Length".'
      };
    }

    const matched = rows.filter(row => {
      const completed = parseYear(row[COMPLETED_YEAR_COL]);
      return completed !== null && completed < year;
    });

    const byRoad = new Map();
    for (const row of matched) {
      const key = `${row[ROAD_NO_COL] || ''}\t${row[NAME_OF_ROAD_COL] || ''}`.trim() || 'Unknown';
      if (!byRoad.has(key)) {
        byRoad.set(key, { roadNo: row[ROAD_NO_COL], name: row[NAME_OF_ROAD_COL], rows: [], lengthSum: 0 });
      }
      const rec = byRoad.get(key);
      rec.rows.push(row);
      const len = parseFloat(String(row[LENGTH_COL]).trim());
      rec.lengthSum += isNaN(len) ? 0 : len;
    }

    let totalLength = 0;
    const summary = [];
    for (const [key, rec] of byRoad.entries()) {
      totalLength += rec.lengthSum;
      summary.push({
        roadNo: rec.roadNo,
        name: rec.name,
        lengthOfStretch: rec.lengthSum,
        rowCount: rec.rows.length,
        rows: rec.rows
      });
    }

    summary.sort((a, b) => (b.lengthOfStretch - a.lengthOfStretch) || String(a.roadNo).localeCompare(b.roadNo));

    return {
      matched,
      summary,
      totalLength,
      columns
    };
  }

  const STRETCH_COL = 'Stretch';
  const STRETCH_COLS = ['Stretch', 'Length', 'Scheme', 'Completed Year'];

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function stretchColumns(columns) {
    return STRETCH_COLS.filter(c => columns.includes(c)).length ? STRETCH_COLS.filter(c => columns.includes(c)) : ['Stretch', 'Length'];
  }

  function renderSummary(summary, year) {
    if (!summary.length) return '<p class="hint">No rows where Completed Year &lt; ' + escapeHtml(String(year)) + '.</p>';
    const allCols = summary[0].rows && summary[0].rows[0] ? Object.keys(summary[0].rows[0]) : [];
    const cols = stretchColumns(allCols).length ? stretchColumns(allCols) : ['Stretch', 'Length'];
    let html = '';
    summary.forEach(s => {
      const roadTitle = [s.roadNo, s.name].filter(Boolean).join(' — ') || 'Road';
      html += '<div class="road-block">';
      html += '<h4 class="road-name">' + escapeHtml(roadTitle) + '</h4>';
      if (s.rows && s.rows.length) {
        html += '<div class="table-wrap"><table class="stretch-table"><thead><tr>';
        cols.forEach(c => { html += '<th>' + escapeHtml(c) + (c === 'Length' ? ' (km)' : '') + '</th>'; });
        html += '</tr></thead><tbody>';
        s.rows.forEach(row => {
          html += '<tr>';
          cols.forEach(col => {
            const val = row[col];
            html += '<td>' + escapeHtml(String(val ?? '')) + '</td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '<p class="road-total">Total length: <strong>' + Number(s.lengthOfStretch).toFixed(2) + ' km</strong></p>';
      html += '</div>';
    });
    return html;
  }

  function renderDataTable(rows, columns) {
    if (!rows.length) return '<p class="hint">No matching rows.</p>';
    let html = '<div class="table-wrap"><table><thead><tr>';
    columns.forEach(c => {
      html += '<th>' + escapeHtml(c) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        html += '<td>' + escapeHtml(String(row[col] ?? '')) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="row-count">' + rows.length + ' row(s)</p>';
    return html;
  }

  let loaded = null;
  let lastResult = null;

  const yearInput = document.getElementById('yearInput');
  const csvFile = document.getElementById('csvFile');
  const loadStatus = document.getElementById('loadStatus');
  const extractBtn = document.getElementById('extractBtn');
  const yearLabel = document.getElementById('yearLabel');
  const summaryOutput = document.getElementById('summaryOutput');
  const totalLengthEl = document.getElementById('totalLength');
  const dataOutput = document.getElementById('dataOutput');
  const reportActions = document.getElementById('reportActions');
  const printReportBtn = document.getElementById('printReportBtn');
  const downloadReportBtn = document.getElementById('downloadReportBtn');
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  function showPanel(id) {
    panels.forEach(p => p.classList.toggle('active', p.id === id + 'Panel'));
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => showPanel(tab.dataset.tab));
  });

  function applyLoadedCSV(data, sourceName) {
    loaded = data;
    loadStatus.textContent = sourceName ? 'Loaded: ' + sourceName + ' (' + loaded.rows.length + ' rows)' : loaded.rows.length + ' rows';
    loadStatus.classList.add('loaded');
  }

  csvFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyLoadedCSV(parseCSV(ev.target.result), file.name);
      } catch (err) {
        loadStatus.textContent = 'Error: ' + err.message;
        loadStatus.classList.remove('loaded');
      }
    };
    reader.readAsText(file, 'UTF-8');
  });

  // Load default data file when served from same origin
  function loadDefaultCSV() {
    const names = ['Road Chart.csv', 'Road Chart.CSV'];
    function tryNext(i) {
      if (i >= names.length) { loadStatus.textContent = 'Load a CSV file or open this app from a server to use default data.'; return; }
      fetch(names[i]).then(r => {
        if (r.ok) return r.text();
        throw new Error('Not found');
      }).then(text => { applyLoadedCSV(parseCSV(text), names[i]); })
        .catch(() => tryNext(i + 1));
    }
    tryNext(0);
  }
  loadDefaultCSV();

  extractBtn.addEventListener('click', () => {
    const year = parseYear(yearInput.value);
    if (year === null) {
      summaryOutput.innerHTML = '<p class="error-msg">Enter a valid year.</p>';
      totalLengthEl.textContent = '';
      return;
    }

    if (!loaded || !loaded.rows.length) {
      summaryOutput.innerHTML = '<p class="error-msg">Load a CSV file first (e.g. Road Chart.csv).</p>';
      totalLengthEl.textContent = '';
      return;
    }

    const result = extractByCompletedYear(loaded.rows, loaded.columns, year);

    if (result.error) {
      summaryOutput.innerHTML = '<p class="error-msg">' + escapeHtml(result.error) + '</p>';
      totalLengthEl.textContent = '';
      dataOutput.innerHTML = '<p class="hint">—</p>';
      return;
    }

    yearLabel.textContent = year;
    summaryOutput.innerHTML = renderSummary(result.summary, year);
    totalLengthEl.innerHTML = '<strong>Total length (all roads): ' + Number(result.totalLength).toFixed(2) + ' km</strong>';
    totalLengthEl.className = 'total-length';
    dataOutput.innerHTML = renderDataTable(result.matched, result.columns);
    lastResult = { year, ...result };
    reportActions.style.display = 'flex';
    showPanel('summary');
  });

  function formatReportDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return day + '-' + month + '-' + year;
  }

  function buildReportHTML(result) {
    const date = formatReportDate(new Date());
    const cols = result.summary[0] && result.summary[0].rows && result.summary[0].rows[0]
      ? stretchColumns(result.columns)
      : STRETCH_COLS.filter(c => result.columns.includes(c));
    let roadSections = '';
    result.summary.forEach(s => {
      const roadTitle = [s.roadNo, s.name].filter(Boolean).join(' — ') || 'Road';
      roadSections += '<div class="road-section">';
      roadSections += '<h3 class="road-heading">' + escapeHtml(roadTitle) + '</h3>';
      if (s.rows && s.rows.length) {
        const stretchHeaders = cols.map(c => '<th>' + escapeHtml(c) + (c === 'Length' ? ' (km)' : '') + '</th>').join('');
        let stretchRows = '';
        s.rows.forEach(row => {
          stretchRows += '<tr>';
          cols.forEach(col => { stretchRows += '<td>' + escapeHtml(String(row[col] ?? '')) + '</td>'; });
          stretchRows += '</tr>';
        });
        roadSections += '<table><thead><tr>' + stretchHeaders + '</tr></thead><tbody>' + stretchRows + '</tbody></table>';
      }
      roadSections += '<p class="road-total">Total length: <strong>' + Number(s.lengthOfStretch).toFixed(2) + ' km</strong></p>';
      roadSections += '</div>';
    });
    const detailHeaders = result.columns.map(c => '<th>' + escapeHtml(c) + '</th>').join('');
    let detailRows = '';
    result.matched.forEach(row => {
      detailRows += '<tr>';
      result.columns.forEach(col => { detailRows += '<td>' + escapeHtml(String(row[col] ?? '')) + '</td>'; });
      detailRows += '</tr>';
    });

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Road Chart - Summary Report</title><style>' +
      'body{font-family:Georgia,serif;max-width:900px;margin:0 auto;padding:2rem;color:#222;font-size:12pt;line-height:1.4;}' +
      '.letterhead{border-bottom:2px solid #1a365d;padding-bottom:0.75rem;margin-bottom:1.5rem;}' +
      '.letterhead h1{margin:0;font-size:1.5rem;color:#1a365d;}' +
      '.letterhead .sub{color:#4a5568;font-size:0.9rem;margin-top:0.25rem;}' +
      '.meta{margin-bottom:1.5rem;color:#4a5568;font-size:0.95rem;}' +
      '.road-section{margin-bottom:2rem;}' +
      '.road-heading{font-size:1.1rem;color:#1a365d;margin:0 0 0.5rem;border-bottom:1px solid #e2e8f0;padding-bottom:0.25rem;}' +
      '.road-total{margin:0.5rem 0 0;font-size:11pt;}' +
      'table{width:100%;border-collapse:collapse;margin:0.25rem 0 0.5rem;font-size:11pt;}' +
      'th,td{border:1px solid #cbd5e0;padding:0.4rem 0.5rem;text-align:left;}' +
      'th{background:#edf2f7;font-weight:600;}' +
      'h2{font-size:1.1rem;color:#1a365d;margin:1.5rem 0 0.5rem;}' +
      '.grand-total{margin-top:1.5rem;padding:0.5rem 0;font-size:1rem;font-weight:600;}' +
      '.footer{margin-top:2rem;padding-top:0.75rem;border-top:1px solid #e2e8f0;font-size:0.9rem;color:#718096;}' +
      '@media print{.road-section{page-break-inside:avoid;} .page-break{page-break-before:always;}}' +
      '</style></head><body>' +
      '<div class="letterhead">' +
      '<h1>Road Chart — Summary Report</h1>' +
      '<div class="sub">Extracted data by completed year (Completed Year &lt; ' + result.year + ')</div>' +
      '</div>' +
      '<div class="meta"><strong>Report date:</strong> ' + date + '</div>' +
      '<h2>Summary by road</h2>' +
      '<p>Each road is listed with its extracted stretches and length. Total length is given per road and overall.</p>' +
      roadSections +
      '<p class="grand-total">Total length (all roads): ' + Number(result.totalLength).toFixed(2) + ' km</p>' +
      '<h2 class="page-break">Detailed data (all stretches)</h2>' +
      '<table><thead><tr>' + detailHeaders + '</tr></thead><tbody>' + detailRows + '</tbody></table>' +
      '<div class="footer">Generated on ' + date + ' — Road Chart Summary Report.</div>' +
      '</body></html>';
  }

  function openReportPrint(result) {
    const html = buildReportHTML(result);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); w.close(); }, 250);
  }

  function downloadReport(result) {
    const html = buildReportHTML(result);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const name = 'Road_Chart_Report_Completed_Before_' + result.year + '_' + formatReportDate(new Date()).replace(/-/g, '') + '.html';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  printReportBtn.addEventListener('click', () => {
    if (!lastResult) return;
    openReportPrint(lastResult);
  });

  downloadReportBtn.addEventListener('click', () => {
    if (!lastResult) return;
    downloadReport(lastResult);
  });
})();
