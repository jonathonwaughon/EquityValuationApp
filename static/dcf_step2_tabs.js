(function () {
  let targetCompany = {};
  let industryCompetitors = [];
  let dupontData = {};
  let cashFlowAnalysis = {};
  let activeCompanyKey = '';
  let fiscalYear = null;

  const RAW_ROWS = [
    ['net_income', 'Net Income'],
    ['sales', 'Sales'],
    ['assets', 'Assets'],
    ['equity', "Owner's Equity"],
  ];
  const RATIO_ROWS = [
    ['roe', 'ROE'],
    ['ros', 'ROS'],
    ['asset_turnover', 'Asset-turnover'],
    ['leverage', 'Leverage'],
  ];
  const CASH_FLOW_ROWS = [
    ['operating', 'Operating cash flow'],
    ['investing', 'Investing cash flow'],
    ['financing', 'Financing cash flow'],
  ];
  const COMPANY_COLOR_PALETTE = buildCompanyColorPalette();

  function companyKey(company) {
    return String(company.ticker_symbol || company.company_name || 'target').trim().toUpperCase();
  }

  function normalizeCompany(company) {
    return {
      company_name: company.company_name || '',
      trading_exchange: company.trading_exchange || '',
      ticker_symbol: String(company.ticker_symbol || '').toUpperCase(),
    };
  }

  function allCompanies() {
    return [targetCompany, ...industryCompetitors].filter(c => c && (c.company_name || c.ticker_symbol));
  }

  function companyLabel(company) {
    const name = company.company_name || 'Company';
    const ticker = company.ticker_symbol ? ` (${company.ticker_symbol})` : '';
    return `${name}${ticker}`;
  }

  function analysisYears() {
    const baseYear = Number(fiscalYear) || new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => String(baseYear - index));
  }

  function chronologicalYears() {
    return [...analysisYears()].reverse();
  }

  function relativeYearLabel(year) {
    return String(year);
  }

  function normalizeCompanyDupontData(companyData) {
    if (!companyData || typeof companyData !== 'object') return {};
    const years = analysisYears();
    const hasFlatMetrics = RAW_ROWS.some(([metric]) => Object.prototype.hasOwnProperty.call(companyData, metric));
    if (!hasFlatMetrics) return companyData;

    const normalized = {};
    normalized[years[0]] = {};
    RAW_ROWS.forEach(([metric]) => {
      if (companyData[metric] !== undefined) normalized[years[0]][metric] = companyData[metric];
    });
    years.forEach(year => {
      if (companyData[year] && typeof companyData[year] === 'object') normalized[year] = companyData[year];
    });
    return normalized;
  }

  function normalizeAllDupontData(rawData) {
    const normalized = {};
    Object.entries(rawData || {}).forEach(([key, value]) => {
      normalized[String(key).toUpperCase()] = normalizeCompanyDupontData(value);
    });
    return normalized;
  }

  function normalizeCashFlowData(rawData) {
    return {
      cash_flows: rawData?.cash_flows || {},
      explanations: rawData?.explanations || {},
      cash_negative: rawData?.cash_negative || '',
    };
  }

  function currentCompany() {
    return allCompanies().find(c => companyKey(c) === activeCompanyKey) || targetCompany;
  }

  function ensureYearData(company, year) {
    const key = companyKey(company);
    dupontData[key] = normalizeCompanyDupontData(dupontData[key]);
    dupontData[key][year] = dupontData[key][year] || {};
    return dupontData[key][year];
  }

  function getDupontValue(company, year, metric) {
    const companyData = normalizeCompanyDupontData(dupontData[companyKey(company)]);
    return (companyData[year] || {})[metric] || '';
  }

  function metricNumber(company, year, metric) {
    const value = Number(getDupontValue(company, year, metric));
    return Number.isFinite(value) ? value : null;
  }

  function ratioNumber(company, year, ratio) {
    const netIncome = metricNumber(company, year, 'net_income');
    const sales = metricNumber(company, year, 'sales');
    const assets = metricNumber(company, year, 'assets');
    const equity = metricNumber(company, year, 'equity');

    if (ratio === 'ros' && netIncome !== null && sales) return netIncome / sales;
    if (ratio === 'asset_turnover' && sales !== null && assets) return sales / assets;
    if (ratio === 'roe' && netIncome !== null && equity) return netIncome / equity;
    if (ratio === 'leverage' && assets !== null && equity) return assets / equity;
    return null;
  }

  function calculateRatio(company, year, ratio) {
    const value = ratioNumber(company, year, ratio);

    if (ratio === 'roe' && value !== null) return `${(value * 100).toFixed(2)}%`;
    if (ratio === 'ros' && value !== null) return `${(value * 100).toFixed(2)}%`;
    if (ratio === 'asset_turnover' && value !== null) return `${value.toFixed(2)}x`;
    if (ratio === 'leverage' && value !== null) return `${value.toFixed(2)}x`;
    return '';
  }

  function renderRatioRows() {
    const company = currentCompany();
    analysisYears().forEach(year => {
      RATIO_ROWS.forEach(([metric]) => {
        const cell = document.querySelector(`[data-ratio="${metric}"][data-year="${year}"]`);
        if (cell) cell.textContent = calculateRatio(company, year, metric);
      });
    });
  }

  function renderCompanyTabs() {
    const tabs = document.getElementById('company-tabs');
    const companies = allCompanies();
    if (!activeCompanyKey && companies.length) activeCompanyKey = companyKey(companies[0]);

    tabs.innerHTML = '';
    companies.forEach(company => {
      const key = companyKey(company);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `company-tab ${key === activeCompanyKey ? 'active' : ''}`;
      button.textContent = companyLabel(company);
      button.addEventListener('click', () => setActiveCompany(key));
      tabs.appendChild(button);
    });
  }

  function renderDupontTable() {
    const company = currentCompany();
    const years = analysisYears();
    const activeTitle = document.getElementById('active-company-title');
    const head = document.getElementById('dupont-head');
    const body = document.getElementById('dupont-body');

    if (!company || !head || !body) return;
    activeTitle.textContent = companyLabel(company);
    head.innerHTML = '';
    body.innerHTML = '';

    const headerRow = document.createElement('tr');
    const labelHeader = document.createElement('th');
    labelHeader.textContent = 'Label';
    headerRow.appendChild(labelHeader);
    years.forEach(year => {
      const th = document.createElement('th');
      th.textContent = `FY ${year}`;
      headerRow.appendChild(th);
    });
    head.appendChild(headerRow);

    RAW_ROWS.forEach(([metric, label]) => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = label;
      row.appendChild(labelCell);

      years.forEach(year => {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.value = getDupontValue(company, year, metric);
        input.addEventListener('input', () => {
          ensureYearData(currentCompany(), year)[metric] = input.value;
          renderRatioRows();
          refreshComparisonPlot();
        });
        cell.appendChild(input);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });

    RATIO_ROWS.forEach(([metric, label]) => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = label;
      row.appendChild(labelCell);

      years.forEach(year => {
        const cell = document.createElement('td');
        const value = document.createElement('div');
        value.className = 'ratio-cell';
        value.dataset.ratio = metric;
        value.dataset.year = year;
        value.textContent = calculateRatio(company, year, metric);
        cell.appendChild(value);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  function cashFlowValue(type, year) {
    return cashFlowAnalysis.cash_flows?.[type]?.[year] || '';
  }

  function cashFlowNumber(type, year) {
    const value = Number(cashFlowValue(type, year));
    return Number.isFinite(value) ? value : null;
  }

  function cashFlowSign(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    if (number > 0) return '+';
    if (number < 0) return '-';
    return '0';
  }

  function setCashFlowValue(type, year, value) {
    cashFlowAnalysis.cash_flows = cashFlowAnalysis.cash_flows || {};
    cashFlowAnalysis.cash_flows[type] = cashFlowAnalysis.cash_flows[type] || {};
    cashFlowAnalysis.cash_flows[type][year] = value;
    document.querySelectorAll(`[data-cash-input="${type}:${year}"]`).forEach(input => {
      if (document.activeElement !== input) input.value = value;
    });
    refreshCashFlowIndicators();
  }

  function setCashFlowExplanation(year, value) {
    cashFlowAnalysis.explanations = cashFlowAnalysis.explanations || {};
    cashFlowAnalysis.explanations[year] = value;
  }

  function renderCashFlowAnalysis() {
    const summary = document.getElementById('cash-flow-summary');
    const head = document.getElementById('cash-flow-head');
    const body = document.getElementById('cash-flow-body');
    const explanationBody = document.getElementById('cash-flow-explanation-body');
    const cashNegative = document.getElementById('cash-negative');
    if (!summary || !head || !body || !explanationBody || !cashNegative) return;

    cashFlowAnalysis = normalizeCashFlowData(cashFlowAnalysis);
    const years = chronologicalYears();
    summary.innerHTML = '';
    years.forEach(year => {
      const row = document.createElement('div');
      row.className = 'cash-flow-line';
      const label = document.createElement('span');
      label.textContent = `Operating cash flow for year ${relativeYearLabel(year)}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.dataset.cashInput = `operating:${year}`;
      input.value = cashFlowValue('operating', year);
      input.addEventListener('input', () => setCashFlowValue('operating', year, input.value));
      const sign = document.createElement('span');
      sign.className = 'cash-flow-sign';
      sign.dataset.cashSign = `operating:${year}`;
      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(sign);
      summary.appendChild(row);
    });

    head.innerHTML = '<tr><th>Cash Flow</th><th>Value</th><th>+ / -</th></tr>';
    body.innerHTML = '';
    CASH_FLOW_ROWS.forEach(([type, label]) => {
      years.forEach(year => {
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = `${label} for year ${relativeYearLabel(year)}`;
        const valueCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.dataset.cashInput = `${type}:${year}`;
        input.value = cashFlowValue(type, year);
        input.addEventListener('input', () => setCashFlowValue(type, year, input.value));
        valueCell.appendChild(input);
        const signCell = document.createElement('td');
        const sign = document.createElement('span');
        sign.className = 'cash-flow-sign';
        sign.dataset.cashSign = `${type}:${year}`;
        signCell.appendChild(sign);
        row.appendChild(labelCell);
        row.appendChild(valueCell);
        row.appendChild(signCell);
        body.appendChild(row);
      });
    });

    explanationBody.innerHTML = '';
    years.forEach(year => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = relativeYearLabel(year);
      const valueCell = document.createElement('td');
      const textarea = document.createElement('textarea');
      textarea.className = 'mini-textarea';
      textarea.value = cashFlowAnalysis.explanations?.[year] || '';
      textarea.addEventListener('input', () => setCashFlowExplanation(year, textarea.value));
      valueCell.appendChild(textarea);
      row.appendChild(labelCell);
      row.appendChild(valueCell);
      explanationBody.appendChild(row);
    });

    cashNegative.value = cashFlowAnalysis.cash_negative || '';
    cashNegative.oninput = () => {
      cashFlowAnalysis.cash_negative = cashNegative.value;
    };

    refreshCashFlowIndicators();
  }

  function refreshCashFlowIndicators() {
    document.querySelectorAll('[data-cash-sign]').forEach(node => {
      const [type, year] = node.dataset.cashSign.split(':');
      node.textContent = cashFlowSign(cashFlowValue(type, year));
    });

    const currentYear = analysisYears()[0];
    const operating = cashFlowNumber('operating', currentYear);
    const investing = cashFlowNumber('investing', currentYear);
    const combinedNote = document.getElementById('cash-flow-combined-note');
    const prompt = document.getElementById('cash-flow-prompt');
    if (!combinedNote || !prompt) return;

    if (operating === null || investing === null) {
      combinedNote.textContent = `Is investing and operating cash flow for year ${currentYear} + or -?`;
      prompt.textContent = `Fill operating and investing cash flow for year ${currentYear} to generate the follow-up question.`;
      return;
    }

    const combined = operating + investing;
    const sign = cashFlowSign(combined);
    combinedNote.textContent = `Is investing and operating cash flow for year ${currentYear} + or -? ${sign}`;
    prompt.textContent = combined >= 0
      ? 'If positive: What does the company plan to do with the extra cash? Go to MD&A in the 10-K statement.'
      : 'If negative: How is the cash shortfall going to be financed?';
  }

  function setActiveCompany(key) {
    activeCompanyKey = key;
    renderCompanyTabs();
    renderDupontTable();
    refreshComparisonPlot();
  }

  function openCompanyModal() {
    document.getElementById('new-company-name').value = '';
    document.getElementById('new-company-exchange').value = '';
    document.getElementById('new-company-ticker').value = '';
    document.getElementById('company-modal').classList.add('open');
    setTimeout(() => document.getElementById('new-company-name').focus(), 0);
  }

  function closeCompanyModal() {
    document.getElementById('company-modal').classList.remove('open');
  }

  function enterNewCompany() {
    const status = document.getElementById('dcf-quick-comps-status');
    const company = normalizeCompany({
      company_name: document.getElementById('new-company-name').value.trim(),
      trading_exchange: document.getElementById('new-company-exchange').value.trim(),
      ticker_symbol: document.getElementById('new-company-ticker').value.trim(),
    });
    if (!company.company_name && !company.ticker_symbol) {
      status.textContent = 'Enter a company name or ticker.';
      return;
    }

    const key = companyKey(company);
    const existingIndex = industryCompetitors.findIndex(c => companyKey(c) === key);
    if (existingIndex >= 0) {
      industryCompetitors[existingIndex] = company;
    } else if (companyKey(targetCompany) !== key) {
      industryCompetitors.push(company);
    }
    closeCompanyModal();
    setActiveCompany(key);
    saveIndustryAnalysis({ silent: true });
    refreshComparisonPlot();
  }

  async function uploadDcfQuickComps(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('dcf-quick-comps-status');
    status.textContent = 'Importing Quick Comps...';
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/upload-quick-comps', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.message || 'Could not import Quick Comps.';
        return;
      }
      industryCompetitors = data.competitors.map(normalizeCompany);
      if (industryCompetitors.length) activeCompanyKey = companyKey(industryCompetitors[0]);
      renderCompanyTabs();
      renderDupontTable();
      await saveIndustryAnalysis({ silent: true });
      refreshComparisonPlot();
      status.textContent = `Imported ${data.competitors.length} competitors from ${data.sheet_name}.`;
    } catch (err) {
      status.textContent = 'Could not reach the server.';
    } finally {
      input.value = '';
    }
  }

  async function autofillActiveCompanyFromEdgar() {
    const status = document.getElementById('dcf-quick-comps-status');
    const saved = await saveIndustryAnalysis({ silent: true });
    if (!saved) {
      status.textContent = 'Save company tabs before auto-sourcing financials.';
      return;
    }

    const company = currentCompany();
    status.textContent = `Auto-sourcing ${company.ticker_symbol || company.company_name} from EDGAR...`;

    try {
      const res = await fetch('/autofill-dcf-dupont-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          years: analysisYears(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') {
        status.textContent = data.message || 'Could not auto-source financials.';
        return;
      }

      const key = data.ticker || companyKey(company);
      dupontData[key] = normalizeCompanyDupontData(dupontData[key]);
      Object.entries(data.values || {}).forEach(([year, metrics]) => {
        dupontData[key][year] = {
          ...(dupontData[key][year] || {}),
          ...metrics,
        };
      });
      renderDupontTable();
      await saveIndustryAnalysis({ silent: true });
      refreshComparisonPlot();
      status.textContent = data.message;
    } catch (err) {
      status.textContent = 'Could not reach the server.';
    }
  }

  function collectDupontData() {
    document.querySelectorAll('#dupont-body input').forEach(input => {
      input.dispatchEvent(new Event('input'));
    });
    return dupontData;
  }

  function collectCashFlowData() {
    document.querySelectorAll('#cash-flow-body input, #cash-flow-summary input').forEach(input => {
      input.dispatchEvent(new Event('input'));
    });
    document.querySelectorAll('#cash-flow-explanation-body textarea, #cash-negative').forEach(input => {
      input.dispatchEvent(new Event('input'));
    });
    return normalizeCashFlowData(cashFlowAnalysis);
  }

  async function loadDcfState() {
    const res = await fetch('/get-dcf-state');
    const data = await res.json();
    if (!data) return;

    document.getElementById('macro_analysis').value = data.macro_analysis || '';
    targetCompany = normalizeCompany({
      company_name: data.company_name || 'Target Company',
      trading_exchange: data.trading_exchange || '',
      ticker_symbol: data.ticker_symbol || 'TARGET',
    });
    fiscalYear = data.most_recent_fiscal_year || null;
    industryCompetitors = (data.industry_competitors || []).map(normalizeCompany);
    dupontData = normalizeAllDupontData(data.dupont_data || {});
    cashFlowAnalysis = normalizeCashFlowData(data.cash_flow_analysis || {});
    activeCompanyKey = companyKey(targetCompany);
    renderCompanyTabs();
    renderDupontTable();
    refreshComparisonPlot();
    renderCashFlowAnalysis();
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function hslToHex(hue, saturation, lightness) {
    const s = saturation / 100;
    const l = lightness / 100;
    const c = (1 - Math.abs((2 * l) - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - (c / 2);
    let r = 0;
    let g = 0;
    let b = 0;

    if (hue < 60) [r, g, b] = [c, x, 0];
    else if (hue < 120) [r, g, b] = [x, c, 0];
    else if (hue < 180) [r, g, b] = [0, c, x];
    else if (hue < 240) [r, g, b] = [0, x, c];
    else if (hue < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return [r, g, b]
      .map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
      .join('');
  }

  function buildCompanyColorPalette() {
    const colors = [];
    const saturationBands = [62, 70, 56, 66];
    const lightnessBands = [50, 58, 45, 54];
    const goldenAngle = 137.508;

    for (let index = 0; index < 100; index += 1) {
      const hue = (index * goldenAngle) % 360;
      const saturation = saturationBands[index % saturationBands.length];
      const lightness = lightnessBands[Math.floor(index / saturationBands.length) % lightnessBands.length];
      colors.push(`#${hslToHex(hue, saturation, lightness)}`);
    }
    return colors;
  }

  function companyColor(company) {
    const companies = allCompanies();
    const index = Math.max(0, companies.findIndex(item => companyKey(item) === companyKey(company)));
    return COMPANY_COLOR_PALETTE[index % COMPANY_COLOR_PALETTE.length];
  }

  function plotPoints() {
    const points = [];
    allCompanies().forEach(company => {
      analysisYears().forEach(year => {
        const x = ratioNumber(company, year, 'asset_turnover');
        const y = ratioNumber(company, year, 'ros');
        if (x !== null && y !== null) {
          points.push({
            company,
            year,
            x,
            y,
            color: companyColor(company),
          });
        }
      });
    });
    return points;
  }

  function paddedRange(values, fallbackMin, fallbackMax) {
    if (!values.length) return [fallbackMin, fallbackMax];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      const pad = Math.max(Math.abs(min) * 0.15, 0.05);
      return [min - pad, max + pad];
    }
    const pad = (max - min) * 0.16;
    return [min - pad, max + pad];
  }

  function drawText(ctx, text, x, y, color, size = 12, align = 'left') {
    ctx.fillStyle = color;
    ctx.font = `${size}px DM Mono, monospace`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function refreshComparisonPlot() {
    const canvas = document.getElementById('comparison-plot');
    const legend = document.getElementById('comparison-legend');
    const status = document.getElementById('plot-status');
    if (!canvas || !legend) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width), 640);
    const height = Math.max(Math.floor(rect.height), 360);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    const points = plotPoints();
    const margins = { top: 54, right: 34, bottom: 64, left: 76 };
    const plotWidth = width - margins.left - margins.right;
    const plotHeight = height - margins.top - margins.bottom;

    drawText(ctx, 'ROS vs Asset-Turnover Comparison Plot', 22, 30, '#d5d7dc', 18);

    if (!points.length) {
      drawText(ctx, 'Enter or auto-source company financials to plot points.', margins.left, margins.top + 36, '#6b7280', 12);
      legend.innerHTML = '';
      if (status) status.textContent = 'No plot data yet.';
      return;
    }

    const [xMin, xMax] = paddedRange(points.map(point => point.x), 0, 1);
    const [yMin, yMax] = paddedRange(points.map(point => point.y), 0, 0.4);
    const toX = value => margins.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
    const toY = value => margins.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = 1;
    for (let tick = 0; tick <= 4; tick += 1) {
      const x = margins.left + (plotWidth * tick / 4);
      const y = margins.top + (plotHeight * tick / 4);
      ctx.beginPath();
      ctx.moveTo(x, margins.top);
      ctx.lineTo(x, margins.top + plotHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(margins.left, y);
      ctx.lineTo(margins.left + plotWidth, y);
      ctx.stroke();

      const xValue = xMin + ((xMax - xMin) * tick / 4);
      const yValue = yMax - ((yMax - yMin) * tick / 4);
      drawText(ctx, xValue.toFixed(2), x, margins.top + plotHeight + 24, '#d5d7dc', 11, 'center');
      drawText(ctx, yValue.toFixed(2), margins.left - 12, y + 4, '#d5d7dc', 11, 'right');
    }

    ctx.strokeStyle = '#bfc3ca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margins.left, margins.top);
    ctx.lineTo(margins.left, margins.top + plotHeight);
    ctx.lineTo(margins.left + plotWidth, margins.top + plotHeight);
    ctx.stroke();

    drawText(ctx, 'Asset Turnover', margins.left + plotWidth / 2, height - 18, '#f2f3f5', 12, 'center');
    ctx.save();
    ctx.translate(18, margins.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    drawText(ctx, 'Return on Sales (ROS)', 0, 0, '#f2f3f5', 12, 'center');
    ctx.restore();

    points.forEach(point => {
      const x = toX(point.x);
      const y = toY(point.y);
      ctx.fillStyle = point.color;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, point.year, x + 7, y - 8, point.color, 10);
    });

    legend.innerHTML = '';
    allCompanies().forEach(company => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.backgroundColor = companyColor(company);
      const label = document.createElement('span');
      label.textContent = companyLabel(company);
      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    });

    if (status) status.textContent = `Showing ${points.length} point${points.length === 1 ? '' : 's'}.`;
  }

  async function saveMacroAnalysis() {
    const textarea = document.getElementById('macro_analysis');
    const value = textarea.value.trim();

    if (!value) {
      textarea.classList.add('error');
      document.getElementById('save-status').textContent = 'Macro analysis is required before moving on.';
      return;
    }

    textarea.classList.remove('error');

    try {
      const res = await fetch('/submit-dcf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dcf_step2_macro',
          macro_analysis: value,
        }),
      });

      if (!res.ok) {
        document.getElementById('save-status').textContent = 'Could not save macro analysis.';
        return;
      }

      document.getElementById('save-status').textContent = 'Macro analysis saved.';
      const industrySaved = await saveIndustryAnalysis({ silent: true });
      const cashFlowSaved = await saveCashFlowAnalysis({ silent: true });
      document.getElementById('save-status').textContent = industrySaved && cashFlowSaved
        ? 'Step 2 saved.'
        : 'Macro saved, but part of Step 2 could not be saved.';
      if (industrySaved && cashFlowSaved) {
        window.location.href = '/dcf?step=3';
      }
    } catch (err) {
      document.getElementById('save-status').textContent = 'Could not reach the server.';
    }
  }

  async function saveIndustryAnalysis(options = {}) {
    const competitors = industryCompetitors.filter(c => c.company_name || c.ticker_symbol);
    const res = await fetch('/submit-dcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'dcf_step2_industry',
        industry_competitors: competitors,
        dupont_data: collectDupontData(),
      }),
    });

    if (!res.ok) {
      if (!options.silent) {
        document.getElementById('save-status').textContent = 'Macro saved, but industry analysis could not be saved.';
      }
      return false;
    }
    if (!options.silent) {
      document.getElementById('save-status').textContent = 'Step 2 saved.';
    }
    return true;
  }

  async function saveCashFlowAnalysis(options = {}) {
    const res = await fetch('/submit-dcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'dcf_step2_cash_flow',
        cash_flow_analysis: collectCashFlowData(),
      }),
    });

    if (!res.ok) {
      if (!options.silent) {
        document.getElementById('save-status').textContent = 'Cash flow analysis could not be saved.';
      }
      return false;
    }
    if (!options.silent) {
      document.getElementById('save-status').textContent = 'Cash flow analysis saved.';
    }
    return true;
  }

  function bindModalEvents() {
    const modal = document.getElementById('company-modal');
    modal.addEventListener('click', event => {
      if (event.target === modal) closeCompanyModal();
    });
    document.getElementById('new-company-ticker').addEventListener('input', event => {
      event.target.value = event.target.value.toUpperCase();
    });
    modal.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') enterNewCompany();
        if (event.key === 'Escape') closeCompanyModal();
      });
    });
  }

  window.renderIndustryCompetitors = function () {};
  window.renderDupontTable = renderDupontTable;
  window.uploadDcfQuickComps = uploadDcfQuickComps;
  window.openCompanyModal = openCompanyModal;
  window.closeCompanyModal = closeCompanyModal;
  window.enterNewCompany = enterNewCompany;
  window.autofillActiveCompanyFromEdgar = autofillActiveCompanyFromEdgar;
  window.refreshComparisonPlot = refreshComparisonPlot;
  window.saveMacroAnalysis = saveMacroAnalysis;
  window.saveIndustryAnalysis = saveIndustryAnalysis;
  window.saveCashFlowAnalysis = saveCashFlowAnalysis;

  bindModalEvents();
  window.addEventListener('resize', refreshComparisonPlot);
  loadDcfState();
})();
