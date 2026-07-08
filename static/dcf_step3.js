(function () {
  let fiscalYear = null;
  let forecastAssumptions = {};
  let fcfForecast = {};
  let estimateSummary = {};

  const ASSUMPTION_ROWS = [
    ['sales', 'Sales'],
    ['sales_growth_rate', 'Sales growth rate'],
    ['ebitda', 'EBITDA'],
    ['ebitda_sales', 'EBITDA/Sales'],
    ['nwc', 'NWC'],
    ['nwc_revenue', 'NWC/Revenue'],
    ['depreciation', 'Depreciation'],
    ['capex', 'Capex'],
    ['tax_rate', 'Tax rate'],
  ];
  const FCF_ROWS = [
    ['ebit_after_tax', 'EBIT*(1-T)'],
    ['depreciation', 'Depreciation'],
    ['depreciation_change', 'depreciation%change YOY'],
    ['change_nwc', 'Change in NWC'],
    ['investment', 'Investment'],
    ['fcf', 'FCF'],
  ];

  function forecastYears() {
    const baseYear = Number(fiscalYear) || new Date().getFullYear();
    return Array.from({ length: 11 }, (_, index) => String(baseYear + index));
  }

  function forecastPeriods() {
    return Array.from({ length: 11 }, (_, index) => String(index));
  }

  function numberValue(collection, key, year) {
    const value = Number(collection?.[key]?.[year]);
    return Number.isFinite(value) ? value : null;
  }

  function displayValue(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    if (Math.abs(value) < 1 && value !== 0) return String(Math.round(value * 10000) / 10000);
    return String(Math.round(value * 100) / 100);
  }

  function ensureRow(collection, key) {
    collection[key] = collection[key] || {};
    return collection[key];
  }

  function setBlankValue(collection, key, year, value) {
    const row = ensureRow(collection, key);
    if (row[year] === undefined || row[year] === '') {
      row[year] = value;
    }
  }

  function renderHead(headId) {
    const head = document.getElementById(headId);
    const years = forecastYears();
    const periods = forecastPeriods();
    head.innerHTML = '';

    const yearRow = document.createElement('tr');
    const labelHead = document.createElement('th');
    labelHead.textContent = 'Forecasts (in millions)';
    yearRow.appendChild(labelHead);
    years.forEach(year => {
      const th = document.createElement('th');
      th.textContent = year;
      yearRow.appendChild(th);
    });
    head.appendChild(yearRow);

    const periodRow = document.createElement('tr');
    const periodLabel = document.createElement('th');
    periodLabel.textContent = 'Year';
    periodRow.appendChild(periodLabel);
    periods.forEach(period => {
      const th = document.createElement('th');
      th.textContent = period;
      periodRow.appendChild(th);
    });
    head.appendChild(periodRow);
  }

  function renderEditableTable(bodyId, rows, data, onChange) {
    const body = document.getElementById(bodyId);
    const years = forecastYears();
    body.innerHTML = '';

    rows.forEach(([key, label]) => {
      const tr = document.createElement('tr');
      const labelCell = document.createElement('td');
      labelCell.textContent = label;
      tr.appendChild(labelCell);
      years.forEach(year => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.0001';
        input.value = data?.[key]?.[year] || '';
        input.dataset.rowKey = key;
        input.dataset.year = year;
        input.addEventListener('input', () => onChange(key, year, input.value));
        td.appendChild(input);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function renderTables() {
    renderHead('assumptions-head');
    renderHead('fcf-head');
    renderEditableTable('assumptions-body', ASSUMPTION_ROWS, forecastAssumptions, (key, year, value) => {
      ensureRow(forecastAssumptions, key)[year] = value;
      recalculateForecasts();
      syncTableInputs();
    });
    renderEditableTable('fcf-body', FCF_ROWS, fcfForecast, (key, year, value) => {
      ensureRow(fcfForecast, key)[year] = value;
    });
    recalculateForecasts();
    syncTableInputs();
  }

  function recalculateForecasts() {
    const years = forecastYears();
    years.forEach((year, index) => {
      const priorYear = years[index - 1];
      const sales = numberValue(forecastAssumptions, 'sales', year);
      const priorSales = priorYear ? numberValue(forecastAssumptions, 'sales', priorYear) : null;
      const ebitda = numberValue(forecastAssumptions, 'ebitda', year);
      const nwc = numberValue(forecastAssumptions, 'nwc', year);
      const priorNwc = priorYear ? numberValue(forecastAssumptions, 'nwc', priorYear) : null;
      const depreciation = numberValue(forecastAssumptions, 'depreciation', year);
      const priorDepreciation = priorYear ? numberValue(forecastAssumptions, 'depreciation', priorYear) : null;
      const capex = numberValue(forecastAssumptions, 'capex', year);
      const taxRate = numberValue(forecastAssumptions, 'tax_rate', year);

      if (sales !== null && priorSales) ensureRow(forecastAssumptions, 'sales_growth_rate')[year] = displayValue((sales / priorSales) - 1);
      if (ebitda !== null && sales) ensureRow(forecastAssumptions, 'ebitda_sales')[year] = displayValue(ebitda / sales);
      if (nwc !== null && sales) ensureRow(forecastAssumptions, 'nwc_revenue')[year] = displayValue(nwc / sales);

      if (ebitda !== null && depreciation !== null && taxRate !== null) {
        setBlankValue(fcfForecast, 'ebit_after_tax', year, displayValue((ebitda - depreciation) * (1 - taxRate)));
      }
      if (depreciation !== null) setBlankValue(fcfForecast, 'depreciation', year, displayValue(depreciation));
      if (depreciation !== null && priorDepreciation) {
        setBlankValue(fcfForecast, 'depreciation_change', year, displayValue((depreciation / priorDepreciation) - 1));
      }
      if (nwc !== null && priorNwc !== null) setBlankValue(fcfForecast, 'change_nwc', year, displayValue(nwc - priorNwc));
      if (capex !== null) setBlankValue(fcfForecast, 'investment', year, displayValue(capex));

      const ebitAfterTax = numberValue(fcfForecast, 'ebit_after_tax', year);
      const fcfDepreciation = numberValue(fcfForecast, 'depreciation', year);
      const changeNwc = numberValue(fcfForecast, 'change_nwc', year);
      const investment = numberValue(fcfForecast, 'investment', year);
      if (ebitAfterTax !== null && fcfDepreciation !== null && changeNwc !== null && investment !== null) {
        setBlankValue(fcfForecast, 'fcf', year, displayValue(ebitAfterTax + fcfDepreciation + changeNwc - investment));
      }
    });
  }

  function syncTableInputs() {
    document.querySelectorAll('#assumptions-body input').forEach(input => {
      input.value = forecastAssumptions?.[input.dataset.rowKey]?.[input.dataset.year] || '';
    });
    document.querySelectorAll('#fcf-body input').forEach(input => {
      input.value = fcfForecast?.[input.dataset.rowKey]?.[input.dataset.year] || '';
    });
  }

  function renderEstimateSummary() {
    const container = document.getElementById('estimate-summary');
    const rows = estimateSummary?.rows || [];
    const valuation = estimateSummary?.valuation || {};
    container.innerHTML = '';

    if (!rows.length && !valuation.source) {
      const empty = document.createElement('div');
      empty.className = 'parsed-item';
      empty.textContent = 'No analyst estimate rows loaded yet.';
      container.appendChild(empty);
      return;
    }

    if (valuation.source) {
      const item = document.createElement('div');
      item.className = 'parsed-item';
      const assumptionCount = Object.keys(valuation.forecast_assumptions || {}).length;
      const fcfCount = Object.keys(valuation.fcf_forecast || {}).length;
      item.textContent = `Valuation sheet parsed: ${assumptionCount} assumption rows and ${fcfCount} FCF forecast rows.`;
      container.appendChild(item);
    }

    rows.forEach(row => {
      const item = document.createElement('div');
      item.className = 'parsed-item';
      item.textContent = `${row.label} (${row.sheet}, row ${row.row}): ${row.values.join(', ')}`;
      container.appendChild(item);
    });
  }

  function applyEstimateSummary(summary) {
    const years = forecastYears();
    (summary?.rows || []).forEach(row => {
      const label = String(row.label || '').toLowerCase();
      let target = '';
      if (label === 'revenue') target = 'sales';
      if (label === 'ebitda') target = 'ebitda';
      if (!target) return;
      row.values.forEach((value, index) => {
        const year = years[index + 1] || years[index];
        ensureRow(forecastAssumptions, target)[year] = value;
      });
    });
    Object.entries(summary?.valuation?.forecast_assumptions || {}).forEach(([key, values]) => {
      forecastAssumptions[key] = {
        ...(forecastAssumptions[key] || {}),
        ...values,
      };
    });
    recalculateForecasts();
    Object.entries(summary?.valuation?.fcf_forecast || {}).forEach(([key, values]) => {
      fcfForecast[key] = {
        ...(fcfForecast[key] || {}),
        ...values,
      };
    });
    syncTableInputs();
  }

  async function uploadAnalystEstimates(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('estimate-upload-status');
    status.textContent = 'Uploading estimates...';
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/upload-dcf-estimates', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.message || 'Could not upload estimates.';
        return;
      }
      estimateSummary = data.summary || {};
      renderEstimateSummary();
      applyEstimateSummary(estimateSummary);
      status.textContent = data.message || 'Estimates uploaded.';
      await saveStep3({ silent: true });
    } catch (err) {
      status.textContent = 'Could not reach the server.';
    } finally {
      input.value = '';
    }
  }

  async function loadState() {
    const res = await fetch('/get-dcf-state');
    const data = await res.json();
    if (!data) return;
    fiscalYear = data.most_recent_fiscal_year || null;
    forecastAssumptions = data.forecast_assumptions || {};
    fcfForecast = data.fcf_forecast || {};
    estimateSummary = data.analyst_estimate_summary || {};
    renderTables();
    renderEstimateSummary();
  }

  async function saveStep3(options = {}) {
    recalculateForecasts();
    syncTableInputs();
    const res = await fetch('/submit-dcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'dcf_step3',
        forecast_assumptions: forecastAssumptions,
        fcf_forecast: fcfForecast,
      }),
    });

    const status = document.getElementById('save-status');
    if (!res.ok) {
      if (!options.silent) status.textContent = 'Could not save Step 3.';
      return false;
    }
    if (!options.silent) {
      status.textContent = 'Step 3 saved.';
      window.location.href = '/dcf?step=4';
    }
    return true;
  }

  window.uploadAnalystEstimates = uploadAnalystEstimates;
  window.saveStep3 = saveStep3;

  loadState();
})();
