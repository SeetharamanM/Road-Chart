(function () {
  'use strict';

  const SQL_KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ORDER', 'BY',
    'ASC', 'DESC', 'LIMIT', 'OFFSET', 'AS', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
    'ON', 'GROUP', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'TABLE', 'DROP', 'NULL', 'TRUE', 'FALSE', 'BETWEEN', 'IS', 'DISTINCT'
  ]);

  function tokenize(sql) {
    const tokens = [];
    let i = 0;
    const s = String(sql).trim();

    while (i < s.length) {
      const start = i;

      // Whitespace
      if (/\s/.test(s[i])) {
        while (i < s.length && /\s/.test(s[i])) i++;
        continue;
      }

      // Single-line comment
      if (s.substring(i, i + 2) === '--') {
        while (i < s.length && s[i] !== '\n') i++;
        continue;
      }

      // Block comment
      if (s.substring(i, i + 2) === '/*') {
        i += 2;
        while (i < s.length - 1 && s.substring(i, i + 2) !== '*/') i++;
        i += 2;
        continue;
      }

      // Double-quoted string
      if (s[i] === '"') {
        i++;
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') i++;
          i++;
        }
        if (i < s.length) i++;
        tokens.push({ type: 'string', value: s.slice(start, i), raw: s.slice(start + 1, i - 1) });
        continue;
      }

      // Single-quoted string
      if (s[i] === "'") {
        i++;
        while (i < s.length && s[i] !== "'") {
          if (s[i] === '\\') i++;
          i++;
        }
        if (i < s.length) i++;
        tokens.push({ type: 'string', value: s.slice(start, i), raw: s.slice(start + 1, i - 1) });
        continue;
      }

      // Number
      if (/[0-9.]/.test(s[i])) {
        while (i < s.length && /[0-9.]/.test(s[i])) i++;
        tokens.push({ type: 'number', value: s.slice(start, i) });
        continue;
      }

      // Operators and punctuation
      if (/[=<>!]/.test(s[i])) {
        if (s.substring(i, i + 2) === '==' || s.substring(i, i + 2) === '!=' ||
            s.substring(i, i + 2) === '<=' || s.substring(i, i + 2) === '>=') {
          i += 2;
        } else {
          i++;
        }
        tokens.push({ type: 'operator', value: s.slice(start, i) });
        continue;
      }

      if (/[(),;*.]/.test(s[i])) {
        tokens.push({ type: 'punctuation', value: s[i] });
        i++;
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_\u0080-\uFFFF]/.test(s[i])) {
        while (i < s.length && /[a-zA-Z0-9_\u0080-\uFFFF]/.test(s[i])) i++;
        const raw = s.slice(start, i);
        const upper = raw.toUpperCase();
        const type = SQL_KEYWORDS.has(upper) ? 'keyword' : 'identifier';
        tokens.push({ type, value: raw });
        continue;
      }

      i++;
    }

    return tokens;
  }

  function analyzeQuery(sql) {
    const tokens = tokenize(sql);
    const result = {
      queryType: null,
      tables: [],
      columns: [],
      conditions: [],
      orderBy: [],
      limit: null,
      errors: []
    };

    const t = tokens.filter(x => x.type !== 'punctuation' || !['(', ')', ','].includes(x.value));
    let i = 0;
    const next = () => t[i++];
    const peek = () => t[i];
    const is = (type, val) => {
      const x = peek();
      return x && x.type === type && (val == null || x.value.toUpperCase() === val);
    };

    if (is('keyword', 'SELECT')) {
      result.queryType = 'SELECT';
      i++;
      if (is('keyword', 'DISTINCT')) i++;
      const colList = [];
      while (peek() && !is('keyword', 'FROM')) {
        const n = next();
        if (n.type === 'identifier' || n.type === 'keyword') colList.push(n.value);
        else if (n.type === 'punctuation' && n.value === '*') colList.push('*');
      }
      if (colList.length) result.columns = colList.filter(c => c !== ',');

      if (is('keyword', 'FROM')) {
        i++;
        const tbl = next();
        if (tbl && (tbl.type === 'identifier' || tbl.type === 'keyword'))
          result.tables.push(tbl.value);
      }

      while (i < t.length) {
        if (is('keyword', 'WHERE')) {
          i++;
          const cond = [];
          while (peek() && !is('keyword', 'ORDER') && !is('keyword', 'LIMIT'))
            cond.push(next().value);
          if (cond.length) result.conditions = cond;
        } else if (is('keyword', 'ORDER')) {
          i++;
          if (is('keyword', 'BY')) i++;
          const cols = [];
          while (peek() && peek().type === 'identifier') cols.push(next().value);
          if (is('keyword', 'ASC') || is('keyword', 'DESC')) next();
          result.orderBy = cols;
        } else if (is('keyword', 'LIMIT')) {
          i++;
          const num = next();
          if (num && num.type === 'number') result.limit = parseInt(num.value, 10);
        } else {
          i++;
        }
      }
    } else if (peek() && peek().type === 'keyword') {
      const kw = peek().value.toUpperCase();
      if (['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'].includes(kw))
        result.queryType = kw;
      else
        result.queryType = 'UNKNOWN';
    }

    if (!result.queryType && tokens.length)
      result.errors.push('Could not determine query type. Start with SELECT, INSERT, etc.');

    return { analysis: result, tokens };
  }

  function renderAnalysis(analysis) {
    const a = analysis.analysis;
    const lines = [];

    lines.push({ label: 'Query type', value: a.queryType || '—', cls: 'keyword' });
    if (a.tables.length)
      lines.push({ label: 'Table(s)', value: a.tables.join(', ') });
    if (a.columns.length)
      lines.push({ label: 'Columns', value: a.columns.join(', ') });
    if (a.conditions.length)
      lines.push({ label: 'WHERE', value: a.conditions.join(' '), cls: 'keyword' });
    if (a.orderBy.length)
      lines.push({ label: 'ORDER BY', value: a.orderBy.join(', ') });
    if (a.limit != null)
      lines.push({ label: 'LIMIT', value: String(a.limit) });
    if (a.errors.length)
      a.errors.forEach(e => lines.push({ label: 'Error', value: e, cls: 'error' }));

    return lines;
  }

  function renderTokens(tokens) {
    return tokens.map(t => ({
      type: t.type,
      value: t.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }));
  }

  // ----- CSV & simple query execution -----

  let loadedData = null;
  let loadedColumns = null;

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
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' || c === undefined) && !inQuotes) {
        cols.push(col.trim());
        col = '';
      } else if (c) {
        col += c;
      }
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
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if ((c === ',' || c === undefined) && !inQuotes) {
          values.push(val.trim());
          val = '';
        } else if (c) {
          val += c;
        }
      }
      if (val) values.push(val.trim());
      const row = {};
      cols.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
      rows.push(row);
    }
    return { rows, columns: cols };
  }

  function runSelect(sql, data, columns) {
    const { analysis, tokens } = analyzeQuery(sql);
    const a = analysis.analysis;
    if (a.queryType !== 'SELECT') {
      return { error: 'Only SELECT queries are supported for execution.' };
    }

    let rows = data.map(r => ({ ...r }));

    // WHERE: simple col = 'value' / col = number
    const whereTokens = a.conditions;
    if (whereTokens.length >= 3) {
      const col = whereTokens[0];
      const op = whereTokens[1];
          const val = whereTokens[2];
      const numVal = parseFloat(val);
      const isNum = !isNaN(numVal);
      const compare = (cell) => {
        if (op === '=') {
          if (isNum) return parseFloat(cell) === numVal;
          return String(cell).trim() === val.replace(/^['"]|['"]$/g, '');
        }
        if (op === '!=' || op === '<>') {
          if (isNum) return parseFloat(cell) !== numVal;
          return String(cell).trim() !== val.replace(/^['"]|['"]$/g, '');
        }
        if (op === '>') return parseFloat(cell) > numVal;
        if (op === '<') return parseFloat(cell) < numVal;
        if (op === '>=') return parseFloat(cell) >= numVal;
        if (op === '<=') return parseFloat(cell) <= numVal;
        return true;
      };
      if (columns.includes(col)) {
        const literal = val.replace(/^['"]|['"]$/g, '');
        rows = rows.filter(r => compare(r[col]));
      }
    }

    // ORDER BY
    if (a.orderBy.length && columns.includes(a.orderBy[0])) {
      const key = a.orderBy[0];
      rows.sort((x, y) => {
        const a2 = x[key], b2 = y[key];
        const na = parseFloat(a2), nb = parseFloat(b2);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a2).localeCompare(String(b2));
      });
    }

    // LIMIT
    if (a.limit != null) rows = rows.slice(0, a.limit);

    // SELECT columns
    let outCols = a.columns.filter(c => c !== '*');
    if (a.columns.some(c => c === '*') || !outCols.length) outCols = columns;
    else outCols = outCols.filter(c => columns.includes(c));
    if (!outCols.length) outCols = columns;

    rows = rows.map(r => {
      const o = {};
      outCols.forEach(c => { o[c] = r[c]; });
      return o;
    });

    return { rows, columns: outCols };
  }

  function renderTable(rows, columns) {
    if (!rows.length) return '<p class="hint">No rows.</p>';
    let html = '<div class="table-wrap"><table><thead><tr>';
    columns.forEach(c => {
      html += `<th>${escapeHtml(c)}</th>`;
    });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        html += `<td>${escapeHtml(String(row[col] ?? ''))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += `<p class="row-count">${rows.length} row(s)</p>`;
    return html;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ----- DOM -----

  const queryInput = document.getElementById('queryInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const runBtn = document.getElementById('runBtn');
  const csvFile = document.getElementById('csvFile');
  const loadStatus = document.getElementById('loadStatus');
  const analysisOutput = document.getElementById('analysisOutput');
  const tokensOutput = document.getElementById('tokensOutput');
  const dataOutput = document.getElementById('dataOutput');
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  function showPanel(id) {
    panels.forEach(p => {
      p.classList.toggle('active', p.id === id + 'Panel');
    });
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === id);
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => showPanel(tab.dataset.tab));
  });

  analyzeBtn.addEventListener('click', () => {
    const sql = queryInput.value.trim();
    if (!sql) {
      analysisOutput.innerHTML = '<p class="hint">Enter a query first.</p>';
      showPanel('analysis');
      return;
    }
    const { analysis, tokens } = analyzeQuery(sql);
    const lines = renderAnalysis(analysis);
    analysisOutput.innerHTML = lines.map(l =>
      `<div class="analysis-item"><span class="analysis-label">${escapeHtml(l.label)}</span><span class="analysis-value ${l.cls || ''}">${escapeHtml(l.value)}</span></div>`
    ).join('');
    const tokenEls = renderTokens(tokens).map(t =>
      `<span class="token ${t.type}" title="${t.type}">${t.value}</span>`
    );
    tokensOutput.innerHTML = tokenEls.join('');
    showPanel('analysis');
  });

  runBtn.addEventListener('click', () => {
    if (!loadedData || !loadedColumns) {
      dataOutput.innerHTML = '<p class="error-msg">Load a CSV file first (e.g. Road Chart.csv).</p>';
      showPanel('data');
      return;
    }
    const sql = queryInput.value.trim();
    if (!sql) {
      dataOutput.innerHTML = '<p class="hint">Enter a SELECT query and click Run.</p>';
      showPanel('data');
      return;
    }
    const result = runSelect(sql, loadedData, loadedColumns);
    if (result.error) {
      dataOutput.innerHTML = `<p class="error-msg">${escapeHtml(result.error)}</p>`;
    } else {
      dataOutput.innerHTML = renderTable(result.rows, result.columns);
    }
    showPanel('data');
  });

  function applyLoadedCSV(rows, columns, sourceName) {
    loadedData = rows;
    loadedColumns = columns;
    loadStatus.textContent = sourceName ? `Loaded: ${sourceName} (${rows.length} rows, ${columns.length} columns)` : `${rows.length} rows, ${columns.length} columns`;
    loadStatus.classList.add('loaded');
  }

  csvFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { rows, columns } = parseCSV(ev.target.result);
        applyLoadedCSV(rows, columns, file.name);
      } catch (err) {
        loadStatus.textContent = 'Error: ' + err.message;
        loadStatus.classList.remove('loaded');
      }
    };
    reader.readAsText(file, 'UTF-8');
  });

  // Load default data file when served from same origin (e.g. Netlify, local server)
  function loadDefaultCSV() {
    const names = ['Road Chart.csv', 'Road Chart.CSV'];
    function tryNext(i) {
      if (i >= names.length) { loadStatus.textContent = 'Load a CSV file or open this app from a server to use default data.'; return; }
      fetch(names[i]).then(r => {
        if (r.ok) return r.text();
        throw new Error('Not found');
      }).then(text => {
        const { rows, columns } = parseCSV(text);
        applyLoadedCSV(rows, columns, names[i]);
      }).catch(() => tryNext(i + 1));
    }
    tryNext(0);
  }
  loadDefaultCSV();

  // Default query
  queryInput.value = 'SELECT Road_No, "Name of road", Scheme, Year FROM data WHERE Scheme = \'CRIDP\' ORDER BY Year LIMIT 10';
})();
