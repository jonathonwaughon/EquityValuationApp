(function () {
  let fiscalYear = null;
  let fcfForecast = {};
  let valuation = {};

  const INPUT_ROWS = [
    ['wacc', 'Discount rate (WACC)', '0.10'],
    ['terminal_growth', 'Steady-state growth rate', '0.035'],
    ['non_operating_assets', 'Value of non-operating assets', ''],
    ['debt', 'Value of debt', ''],
    ['shares', 'Shares outstanding (fully diluted)', ''],
    ['market_price', 'Compared with market price', ''],
  ];

  function forecastYears() {
    const baseYear = Number(fiscalYear) || new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => String(baseYear + index + 1));
  }

  function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function displayValue(value, decimals = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return Number(value).toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    });
  }

  function rawValue(key) {
    if (valuation[key] !== undefined && valuation[key] !== '') return valuation[key];
    const row = INPUT_ROWS.find(([rowKey]) => rowKey === key);
    return row ? row[2] : '';
  }

  function fcfForYear(year) {
    return numberValue(fcfForecast?.fcf?.[year]);
  }

  function calculateValuation() {
    const years = forecastYears();
    const wacc = numberValue(rawValue('wacc'));
    const terminalGrowth = numberValue(rawValue('terminal_growth'));
    const nonOperatingAssets = numberValue(rawValue('non_operating_assets')) || 0;
    const debt = numberValue(rawValue('debt')) || 0;
    const shares = numberValue(rawValue('shares'));
    const pvFcf = {};

    let sumPvFcf = 0;
    years.forEach((year, index) => {
      const fcf = fcfForYear(year);
      if (fcf !== null && wacc !== null) {
        const pv = fcf / Math.pow(1 + wacc, index + 1);
        pvFcf[year] = pv;
        sumPvFcf += pv;
      }
    });

    const lastYear = years[years.length - 1];
    const lastFcf = fcfForYear(lastYear);
    let continuationValue = null;
    let pvContinuationValue = null;
    if (lastFcf !== null && wacc !== null && terminalGrowth !== null && wacc > terminalGrowth) {
      continuationValue = (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
      pvContinuationValue = continuationValue / Math.pow(1 + wacc, years.length);
    }

    const intrinsicOperations = sumPvFcf + (pvContinuationValue || 0);
    const firmValue = intrinsicOperations + nonOperatingAssets;
    const equityValue = firmValue - debt;
    const intrinsicPrice = shares ? equityValue / shares : null;

    return {
      pvFcf,
      sumPvFcf,
      continuationValue,
      pvContinuationValue,
      intrinsicOperations,
      firmValue,
      equityValue,
      intrinsicPrice,
    };
  }

  function renderYearTable() {
    const years = forecastYears();
    const calculations = calculateValuation();
    const head = document.getElementById('valuation-year-head');
    const body = document.getElementById('valuation-year-body');
    head.innerHTML = '';
    body.innerHTML = '';

    const header = document.createElement('tr');
    const label = document.createElement('th');
    label.textContent = 'Year';
    header.appendChild(label);
    years.forEach((year, index) => {
      const th = document.createElement('th');
      th.textContent = `${year} (${index + 1})`;
      header.appendChild(th);
    });
    head.appendChild(header);

    const fcfRow = document.createElement('tr');
    const fcfLabel = document.createElement('td');
    fcfLabel.textContent = 'FCF';
    fcfRow.appendChild(fcfLabel);
    years.forEach(year => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.value = fcfForecast?.fcf?.[year] || '';
      input.addEventListener('input', () => {
        fcfForecast.fcf = fcfForecast.fcf || {};
        fcfForecast.fcf[year] = input.value;
      });
      input.addEventListener('change', renderAll);
      td.appendChild(input);
      fcfRow.appendChild(td);
    });
    body.appendChild(fcfRow);

    const pvRow = document.createElement('tr');
    const pvLabel = document.createElement('td');
    pvLabel.textContent = 'PV(FCF)';
    pvRow.appendChild(pvLabel);
    years.forEach(year => {
      const td = document.createElement('td');
      const value = document.createElement('div');
      value.className = 'computed';
      value.textContent = displayValue(calculations.pvFcf[year]);
      td.appendChild(value);
      pvRow.appendChild(td);
    });
    body.appendChild(pvRow);
  }

  function inputRow(key, label) {
    const tr = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    const valueCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = key === 'market_price' ? 'text' : 'number';
    input.step = '0.0001';
    input.value = rawValue(key);
    input.addEventListener('input', () => {
      valuation[key] = input.value;
    });
    input.addEventListener('change', renderAll);
    valueCell.appendChild(input);
    tr.appendChild(labelCell);
    tr.appendChild(valueCell);
    return tr;
  }

  function computedRow(label, value, decimals = 2) {
    const tr = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.textContent = label;
    const valueCell = document.createElement('td');
    const div = document.createElement('div');
    div.className = 'computed';
    div.textContent = displayValue(value, decimals);
    valueCell.appendChild(div);
    tr.appendChild(labelCell);
    tr.appendChild(valueCell);
    return tr;
  }

  function renderSummaryTable() {
    const body = document.getElementById('valuation-summary-body');
    const calculations = calculateValuation();
    body.innerHTML = '';

    body.appendChild(inputRow('wacc', 'Discount rate (WACC)'));
    body.appendChild(inputRow('terminal_growth', 'Steady-state growth rate'));
    body.appendChild(computedRow('Sum of PV(FCF) for years 1 to 10', calculations.sumPvFcf));
    body.appendChild(computedRow('Continuation value', calculations.continuationValue));
    body.appendChild(computedRow('PV(continuation value)', calculations.pvContinuationValue));
    body.appendChild(computedRow('Intrinsic value of operations', calculations.intrinsicOperations));
    body.appendChild(inputRow('non_operating_assets', 'Value of non-operating assets'));
    body.appendChild(computedRow('Intrinsic firm value', calculations.firmValue));
    body.appendChild(inputRow('debt', 'Value of debt'));
    body.appendChild(computedRow('Intrinsic value of equity', calculations.equityValue));
    body.appendChild(inputRow('shares', 'Shares outstanding (fully diluted)'));
    body.appendChild(computedRow('Intrinsic stock price', calculations.intrinsicPrice));
    body.appendChild(inputRow('market_price', 'Compared with market price'));

    document.getElementById('intrinsic-price-output').textContent = calculations.intrinsicPrice === null
      ? 'Intrinsic stock price: -'
      : `Intrinsic stock price: ${displayValue(calculations.intrinsicPrice, 2)}`;
  }

  function renderAll() {
    renderYearTable();
    renderSummaryTable();
  }

  async function loadState() {
    const res = await fetch('/get-dcf-state');
    const data = await res.json();
    if (!data) return;
    fiscalYear = data.most_recent_fiscal_year || null;
    fcfForecast = data.fcf_forecast || {};
    valuation = data.dcf_valuation || {};
    renderAll();
  }

  async function saveStep4() {
    const calculations = calculateValuation();
    valuation.fcf_forecast = fcfForecast.fcf || {};
    valuation.calculated = {
      pv_fcf: calculations.pvFcf,
      sum_pv_fcf: displayValue(calculations.sumPvFcf, 4),
      continuation_value: displayValue(calculations.continuationValue, 4),
      pv_continuation_value: displayValue(calculations.pvContinuationValue, 4),
      intrinsic_value_operations: displayValue(calculations.intrinsicOperations, 4),
      intrinsic_firm_value: displayValue(calculations.firmValue, 4),
      intrinsic_equity_value: displayValue(calculations.equityValue, 4),
      intrinsic_stock_price: displayValue(calculations.intrinsicPrice, 4),
    };

    const res = await fetch('/submit-dcf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'dcf_step4',
        dcf_valuation: valuation,
      }),
    });

    document.getElementById('save-status').textContent = res.ok
      ? 'Valuation saved.'
      : 'Could not save valuation.';
  }

  window.saveStep4 = saveStep4;
  loadState();
})();
