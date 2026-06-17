# File name: main.py
# Created: 5/19/2026 3:01 PM
# Purpose: Acts as the entry point for all other modules
# Last edited: JR
# Notes:

from flask import Flask, jsonify, request, render_template, send_file, Response
from state.dcf_state import dcf_state
from state.pe_state import competitor, pe_state, prediction, financial_year
from werkzeug.utils import secure_filename
import html as html_lib
import io, os
import json
import re
from datetime import datetime, timezone
from urllib.request import Request, urlopen

current = None
dcf_current = None
pe_save_dir = "pe_saves"
dcf_upload_dir = "dcf_uploads"
autosave_dir = "autosaves"
edgar_data_dir = os.path.abspath(os.path.join(dcf_upload_dir, "edgar_data"))
edgar_cache_dir = os.path.abspath(os.path.join(dcf_upload_dir, "edgar_cache"))
os.makedirs(pe_save_dir, exist_ok=True)
os.makedirs(dcf_upload_dir, exist_ok=True)
os.makedirs(autosave_dir, exist_ok=True)
os.makedirs(edgar_data_dir, exist_ok=True)
os.makedirs(edgar_cache_dir, exist_ok=True)
os.environ.setdefault("EDGAR_LOCAL_DATA_DIR", edgar_data_dir)
os.environ.setdefault("EDGAR_CACHE_DIR", edgar_cache_dir)

app = Flask(__name__)




# FRONTEND ROUTES
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/pe")
def pe():
    step = request.args.get("step", "1")
    templates = {
        "1": "pe_page.html",
        "2": "pe_page2.html",
        "3": "pe_page3.html",
    }
    return render_template(templates.get(step, "pe_page.html"))

@app.route("/dcf")
def dcf():
    step = request.args.get("step", "1")
    templates = {
        "1": "dcf_page.html",
        "2": "dcf_page2.html",
    }
    return render_template(templates.get(step, "dcf_page.html"))



# BACKEND ROUTES

@app.route("/autosave-draft", methods=["POST"])
def autosave_draft():
    data = request.get_json(silent=True) or {}
    page = secure_filename(data.get("page", "draft")) or "draft"
    path = os.path.join(autosave_dir, f"{page}.json")
    payload = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "page": data.get("page", ""),
        "url": data.get("url", ""),
        "fields": data.get("fields", {}),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return jsonify({"status": "ok", "saved_at": payload["saved_at"]})

@app.route("/get-dcf-state")
def get_dcf_state():
    if dcf_current is None:
        return jsonify(None)
    return jsonify({
        "company_name":     dcf_current.company_name,
        "trading_exchange": dcf_current.trading_exchange,
        "ticker_symbol":    dcf_current.ticker_symbol,
        "primary_industry": dcf_current.primary_industry,
        "fiscal_year_end": dcf_current.fiscal_year_end,
        "most_recent_fiscal_year": dcf_current.most_recent_fiscal_year,
        "edgar_identity": dcf_current.edgar_identity,
        "ten_k_files": dcf_current.ten_k_files,
        "ten_k_filings": dcf_current.ten_k_filings,
        "ten_k_source_status": dcf_current.ten_k_source_status,
        "ten_k_source_message": dcf_current.ten_k_source_message,
        "financial_statement_files": dcf_current.financial_statement_files,
        "financial_source_status": dcf_current.financial_source_status,
        "financial_source_message": dcf_current.financial_source_message,
        "financial_statement_summaries": dcf_current.financial_statement_summaries,
        "macro_analysis": dcf_current.macro_analysis,
        "industry_competitors": dcf_current.industry_competitors,
        "dupont_data": dcf_current.dupont_data,
    })

@app.route("/submit-dcf", methods=["POST"])
def submit_dcf():
    global dcf_current
    data = request.json
    submit_type = data.get("type")

    if submit_type == "dcf_step1":
        prior = dcf_current
        dcf_current = dcf_state(
            company_name     = data["company_name"],
            trading_exchange = data["trading_exchange"],
            ticker_symbol    = data["ticker_symbol"],
            primary_industry = data["primary_industry"],
        )
        if prior is not None:
            dcf_current.fiscal_year_end = prior.fiscal_year_end
            dcf_current.most_recent_fiscal_year = prior.most_recent_fiscal_year
            dcf_current.edgar_identity = prior.edgar_identity
            dcf_current.ten_k_files = prior.ten_k_files
            dcf_current.ten_k_filings = prior.ten_k_filings
            dcf_current.ten_k_source_status = prior.ten_k_source_status
            dcf_current.ten_k_source_message = prior.ten_k_source_message
            dcf_current.financial_statement_files = prior.financial_statement_files
            dcf_current.financial_source_status = prior.financial_source_status
            dcf_current.financial_source_message = prior.financial_source_message
            dcf_current.financial_statement_summaries = prior.financial_statement_summaries
            dcf_current.macro_analysis = prior.macro_analysis
            dcf_current.industry_competitors = prior.industry_competitors
            dcf_current.dupont_data = prior.dupont_data

    elif submit_type == "dcf_step2":
        if dcf_current is None:
            return jsonify({"status": "error", "message": "Save UI1-1 before UI1-2."}), 400
        dcf_current.fiscal_year_end = data["fiscal_year_end"]
        dcf_current.most_recent_fiscal_year = int(data["most_recent_fiscal_year"])
        dcf_current.edgar_identity = data.get("edgar_identity", dcf_current.edgar_identity)

    elif submit_type == "dcf_step2_macro":
        if dcf_current is None:
            return jsonify({"status": "error", "message": "Complete Step 1 before Step 2."}), 400
        dcf_current.macro_analysis = data.get("macro_analysis", "")

    elif submit_type == "dcf_step2_industry":
        if dcf_current is None:
            return jsonify({"status": "error", "message": "Complete Step 1 before Step 2."}), 400
        dcf_current.industry_competitors = data.get("industry_competitors", [])
        dcf_current.dupont_data = data.get("dupont_data", {})

    else:
        return jsonify({"status": "error", "message": f"Unknown type '{submit_type}'"}), 400

    print(dcf_current)
    return jsonify({"status": "ok"})

def _parse_company_label(value):
    text = str(value or "").strip()
    if not text or text.lower() in {"company name", "summary statistics", "high", "mean", "median", "low"}:
        return None

    match = re.match(r"^(.*?)\s*\(([^:()]+):([^()]+)\)\s*$", text)
    if not match:
        return None

    return {
        "company_name": match.group(1).strip(),
        "trading_exchange": match.group(2).strip(),
        "ticker_symbol": match.group(3).strip(),
    }

def _parse_quick_comps_file(file):
    import pandas as pd

    filename = secure_filename(file.filename or "quick_comps.xls")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    engine = "xlrd" if ext == "xls" else None
    workbook = pd.ExcelFile(file, engine=engine)

    for sheet_name in workbook.sheet_names:
        df = pd.read_excel(workbook, sheet_name=sheet_name, header=None)
        marker_positions = []
        for row_idx, row in df.iterrows():
            for col_idx, value in row.items():
                if str(value).strip().lower() == "company comp set":
                    marker_positions.append((row_idx, col_idx))

        for marker_row, marker_col in marker_positions:
            header_row = marker_row + 1
            if header_row >= len(df.index):
                continue

            company_col = None
            for col_idx, value in df.iloc[header_row].items():
                if str(value).strip().lower() == "company name":
                    company_col = col_idx
                    break
            if company_col is None:
                continue

            competitors = []
            for row_idx in range(header_row + 1, len(df.index)):
                raw_value = df.iat[row_idx, company_col]
                if pd.isna(raw_value) or str(raw_value).strip() == "":
                    if competitors:
                        break
                    continue
                parsed = _parse_company_label(raw_value)
                if parsed:
                    competitors.append(parsed)

            if competitors:
                return {
                    "sheet_name": sheet_name,
                    "competitors": competitors,
                }

    return {
        "sheet_name": "",
        "competitors": [],
    }

@app.route("/upload-quick-comps", methods=["POST"])
def upload_quick_comps():
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No Quick Comps file provided."}), 400

    try:
        parsed = _parse_quick_comps_file(request.files["file"])
    except Exception as e:
        return jsonify({"status": "error", "message": f"Could not parse Quick Comps file: {e}"}), 400

    if not parsed["competitors"]:
        return jsonify({"status": "error", "message": "No company comp set was found in the workbook."}), 400

    return jsonify({
        "status": "ok",
        "sheet_name": parsed["sheet_name"],
        "competitors": parsed["competitors"],
    })

@app.route("/upload-dcf-10ks", methods=["POST"])
def upload_dcf_10ks():
    if dcf_current is None:
        return jsonify({"status": "error", "message": "Save UI1-1 before uploading 10-Ks."}), 400

    files = request.files.getlist("ten_k_files")
    if not files:
        return jsonify({"status": "error", "message": "No 10-K files provided."}), 400

    ticker = secure_filename(dcf_current.ticker_symbol.upper()) or "target"
    target_dir = os.path.join(dcf_upload_dir, ticker, "10k")
    os.makedirs(target_dir, exist_ok=True)

    saved = []
    for file in files:
        if not file.filename:
            continue
        filename = secure_filename(file.filename)
        path = os.path.join(target_dir, filename)
        file.save(path)
        saved.append({
            "filename": filename,
            "path": path,
            "preview_url": f"/preview-dcf-file-html/10k/{filename}",
            "open_url": f"/preview-dcf-file/10k/{filename}",
        })

    dcf_current.ten_k_files = saved
    dcf_current.ten_k_source_status = "manual"
    dcf_current.ten_k_source_message = f"Uploaded {len(saved)} 10-K file(s) manually."
    return jsonify({"status": "ok", "files": saved})

def _filing_value(filing, *names):
    for name in names:
        value = getattr(filing, name, None)
        if callable(value):
            try:
                value = value()
            except TypeError:
                value = None
        if value:
            return str(value)
    return ""

def _filing_metadata(filing):
    accession_number = _filing_value(filing, "accession_number", "accession_no", "accession")
    cik = _filing_value(filing, "cik", "company_cik").lstrip("0")
    primary_document = _filing_value(filing, "primary_document", "primary_doc")
    preview_url = ""
    if accession_number and cik and primary_document:
        accession_path = accession_number.replace("-", "")
        sec_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_path}/{primary_document}"
        preview_url = f"/preview-dcf-sec/{cik}/{accession_path}/{primary_document}"
    else:
        sec_url = ""

    return {
        "accession_number": accession_number,
        "cik": cik,
        "primary_document": primary_document,
        "filing_date": _filing_value(filing, "filing_date", "date"),
        "form": _filing_value(filing, "form", "form_type"),
        "period": _filing_value(filing, "period_of_report", "report_date", "period"),
        "company": _filing_value(filing, "company", "company_name"),
        "preview_url": preview_url,
        "open_url": sec_url,
    }

@app.route("/preview-dcf-file/<category>/<filename>")
def preview_dcf_file(category, filename):
    if dcf_current is None:
        return jsonify({"status": "error", "message": "No active DCF session."}), 400

    allowed_categories = {
        "10k": "10k",
        "financials": "financials",
    }
    if category not in allowed_categories:
        return jsonify({"status": "error", "message": "Unknown preview category."}), 404

    ticker = secure_filename(dcf_current.ticker_symbol.upper()) or "target"
    safe_filename = secure_filename(filename)
    path = os.path.abspath(os.path.join(dcf_upload_dir, ticker, allowed_categories[category], safe_filename))
    base_dir = os.path.abspath(os.path.join(dcf_upload_dir, ticker, allowed_categories[category]))

    if not path.startswith(base_dir) or not os.path.exists(path):
        return jsonify({"status": "error", "message": "Preview file not found."}), 404

    return send_file(path)

def _preview_file_path(category, filename):
    if dcf_current is None:
        return None, None

    allowed_categories = {
        "10k": "10k",
        "financials": "financials",
    }
    if category not in allowed_categories:
        return None, None

    ticker = secure_filename(dcf_current.ticker_symbol.upper()) or "target"
    safe_filename = secure_filename(filename)
    path = os.path.abspath(os.path.join(dcf_upload_dir, ticker, allowed_categories[category], safe_filename))
    base_dir = os.path.abspath(os.path.join(dcf_upload_dir, ticker, allowed_categories[category]))

    if not path.startswith(base_dir) or not os.path.exists(path):
        return None, None
    return path, safe_filename

def _html_page(title, body):
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ background:#fff; color:#111; font-family:Arial, sans-serif; margin:18px; }}
    table {{ border-collapse:collapse; font-size:12px; width:100%; }}
    th, td {{ border:1px solid #ddd; padding:6px 8px; text-align:left; vertical-align:top; }}
    th {{ background:#f4f4f4; position:sticky; top:0; }}
    .note {{ color:#555; line-height:1.5; max-width:760px; }}
    a {{ color:#2563eb; }}
  </style>
  <title>{html_lib.escape(title)}</title>
</head>
<body>{body}</body>
</html>"""

@app.route("/preview-dcf-file-html/<category>/<filename>")
def preview_dcf_file_html(category, filename):
    path, safe_filename = _preview_file_path(category, filename)
    if path is None:
        return Response(_html_page("Preview unavailable", "<p class='note'>Preview file not found.</p>"), mimetype="text/html")

    ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
    if ext in {"pdf", "htm", "html", "txt", "xml", "xbrl"}:
        return send_file(path)

    if ext in {"csv", "xls", "xlsx"}:
        try:
            import pandas as pd
            if ext == "csv":
                df = pd.read_csv(path)
            else:
                df = pd.read_excel(path)
            body = f"<h2>{html_lib.escape(safe_filename)}</h2>{df.head(200).fillna('').to_html(index=False, escape=True)}"
            return Response(_html_page(safe_filename, body), mimetype="text/html")
        except Exception as e:
            message = html_lib.escape(str(e))
            body = (
                f"<h2>{html_lib.escape(safe_filename)}</h2>"
                "<p class='note'>This spreadsheet cannot be rendered inside the popup on this machine. "
                "Use the Open button to view or download the original file.</p>"
                f"<p class='note'>Preview error: {message}</p>"
            )
            return Response(_html_page(safe_filename, body), mimetype="text/html")

    body = f"<p class='note'>No inline preview is available for {html_lib.escape(safe_filename)}. Use Open to view the file.</p>"
    return Response(_html_page(safe_filename, body), mimetype="text/html")

@app.route("/preview-dcf-sec/<cik>/<accession>/<document>")
def preview_dcf_sec(cik, accession, document):
    safe_cik = secure_filename(cik)
    safe_accession = secure_filename(accession)
    safe_document = secure_filename(document)
    sec_url = f"https://www.sec.gov/Archives/edgar/data/{safe_cik}/{safe_accession}/{safe_document}"
    base_url = f"https://www.sec.gov/Archives/edgar/data/{safe_cik}/{safe_accession}/"
    identity = ""
    if dcf_current is not None:
        identity = dcf_current.edgar_identity
    identity = identity or os.environ.get("EDGAR_IDENTITY") or "Equity Valuation Tool contact@example.com"

    try:
        req = Request(sec_url, headers={"User-Agent": identity})
        with urlopen(req, timeout=20) as res:
            content = res.read()
            content_type = res.headers.get("Content-Type", "text/html")

        if "html" in content_type.lower() or safe_document.lower().endswith((".htm", ".html")):
            text = content.decode("utf-8", errors="replace")
            if "<head" in text.lower():
                text = text.replace("<head>", f"<head><base href=\"{base_url}\">", 1)
                text = text.replace("<HEAD>", f"<HEAD><base href=\"{base_url}\">", 1)
            else:
                text = f"<base href=\"{base_url}\">" + text
            return Response(text, mimetype="text/html")

        return Response(content, content_type=content_type)

    except Exception as e:
        message = html_lib.escape(str(e))
        body = (
            "<p class='note'>The SEC filing could not be embedded in the popup. "
            f"<a href='{html_lib.escape(sec_url)}' target='_blank' rel='noopener'>Open the filing directly</a>.</p>"
            f"<p class='note'>Preview error: {message}</p>"
        )
        return Response(_html_page("SEC preview unavailable", body), mimetype="text/html")

@app.route("/upload-dcf-financials", methods=["POST"])
def upload_dcf_financials():
    if dcf_current is None:
        return jsonify({"status": "error", "message": "Save UI1-1 before uploading financial statements."}), 400

    files = request.files.getlist("financial_statement_files")
    if not files:
        return jsonify({"status": "error", "message": "No financial statement files provided."}), 400

    allowed = {"xls", "xlsx", "csv"}
    ticker = secure_filename(dcf_current.ticker_symbol.upper()) or "target"
    target_dir = os.path.join(dcf_upload_dir, ticker, "financials")
    os.makedirs(target_dir, exist_ok=True)

    saved = []
    for file in files:
        if not file.filename:
            continue
        filename = secure_filename(file.filename)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in allowed:
            return jsonify({"status": "error", "message": f"Unsupported financial statement file: {filename}"}), 400
        path = os.path.join(target_dir, filename)
        file.save(path)
        saved.append({
            "filename": filename,
            "path": path,
            "preview_url": f"/preview-dcf-file-html/financials/{filename}",
            "open_url": f"/preview-dcf-file/financials/{filename}",
        })

    dcf_current.financial_statement_files = saved
    dcf_current.financial_source_status = "manual"
    dcf_current.financial_source_message = f"Uploaded {len(saved)} financial statement file(s) manually."
    return jsonify({"status": "ok", "files": saved})

def _dataframe_preview(df, limit=8):
    rows = []
    try:
        preview = df.head(limit).fillna("")
        for row in preview.to_dict(orient="records"):
            rows.append({str(k): str(v) for k, v in row.items()})
    except Exception:
        return []
    return rows

def _statement_summary(statement, statement_key, filename):
    df = statement.to_dataframe()
    return {
        "statement": statement_key,
        "title": str(getattr(statement, "title", statement_key)),
        "periods": [str(period) for period in getattr(statement, "periods", [])],
        "rows": str(len(df.index)),
        "columns": str(len(df.columns)),
        "filename": filename,
        "preview_url": f"/preview-dcf-file-html/financials/{filename}",
        "open_url": f"/preview-dcf-file/financials/{filename}",
        "preview_rows": _dataframe_preview(df),
    }

def _clean_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

def _first_numeric(value):
    try:
        if value == "" or value is None:
            return None
        number = float(value)
        if number != number:
            return None
        return number
    except Exception:
        return None

def _latest_statement_column(df):
    metadata_cols = {"label", "concept", "standard_concept", "preferred_sign"}
    date_cols = [col for col in df.columns if str(col).lower() not in metadata_cols and re.match(r"^\d{4}(-\d{2}-\d{2})?$", str(col))]
    if date_cols:
        return date_cols[0]
    for col in df.columns:
        if str(col).lower() in metadata_cols:
            continue
        if any(_first_numeric(v) is not None for v in df[col].head(25)):
            return col
    return None

def _metric_candidates(metric):
    return {
        "net_income": {
            "standard": ["netincome"],
            "label": ["net income", "net earnings"],
        },
        "sales": {
            "standard": ["revenue", "totalrevenue"],
            "label": ["net sales", "total revenue", "revenue", "sales"],
        },
        "assets": {
            "standard": ["assets"],
            "label": ["total assets"],
        },
        "equity": {
            "standard": ["allequitybalance", "stockholdersequity", "shareholdersequity", "totalequity"],
            "label": ["total shareholders equity", "total stockholders equity", "shareholders equity", "stockholders equity", "owners equity", "owner s equity", "total equity"],
        },
    }[metric]

def _extract_metric_from_statement_df(df, metric):
    if df is None or df.empty:
        return None

    value_col = _latest_statement_column(df)
    if value_col is None:
        return None

    candidates = _metric_candidates(metric)
    for _, row in df.iterrows():
        standard = _clean_text(row.get("standard_concept", ""))
        label = _clean_text(row.get("label", ""))
        if standard and any(standard == _clean_text(candidate) for candidate in candidates["standard"]):
            number = _first_numeric(row.get(value_col))
            if number is not None:
                return number, str(value_col), str(row.get("label", ""))
        if label and any(label == _clean_text(candidate) for candidate in candidates["label"]):
            number = _first_numeric(row.get(value_col))
            if number is not None:
                return number, str(value_col), str(row.get("label", ""))

    for _, row in df.iterrows():
        label_cells = " ".join(_clean_text(v) for v in row.values[:4])
        if any(candidate in label_cells for candidate in candidates["label"]):
            for value in row.values:
                number = _first_numeric(value)
                if number is not None:
                    return number, str(value_col), label_cells
    return None

def _read_financial_source_dataframe(path):
    import pandas as pd
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if ext == "csv":
        return [pd.read_csv(path)]
    if ext == "xls":
        sheets = pd.read_excel(path, sheet_name=None, header=None, engine="xlrd")
        return list(sheets.values())
    if ext == "xlsx":
        sheets = pd.read_excel(path, sheet_name=None, header=None)
        return list(sheets.values())
    return []

@app.route("/autofill-dcf-dupont-target", methods=["POST"])
def autofill_dcf_dupont_target():
    if dcf_current is None:
        return jsonify({"status": "error", "message": "Complete Step 1 before autofilling DuPont data."}), 400

    ticker = secure_filename(dcf_current.ticker_symbol.upper()) or "target"
    files = []
    for summary in dcf_current.financial_statement_summaries:
        filename = summary.get("filename")
        if filename:
            files.append(os.path.join(dcf_upload_dir, ticker, "financials", secure_filename(filename)))
    for item in dcf_current.financial_statement_files:
        path = item.get("path")
        if path:
            files.append(path)

    found = {}
    sources = {}
    for path in files:
        if not os.path.exists(path):
            continue
        try:
            dataframes = _read_financial_source_dataframe(path)
        except Exception:
            continue
        for df in dataframes:
            for metric in ["net_income", "sales", "assets", "equity"]:
                if metric in found:
                    continue
                extracted = _extract_metric_from_statement_df(df, metric)
                if extracted:
                    number, period, label = extracted
                    found[metric] = str(round(number, 2))
                    sources[metric] = {
                        "file": os.path.basename(path),
                        "period": period,
                        "label": label,
                    }

    if not found:
        return jsonify({
            "status": "manual_required",
            "message": "Could not find DuPont inputs in the Step 1 financial statements. Enter them manually.",
            "values": {},
            "sources": {},
        }), 200

    dcf_current.dupont_data[ticker] = {
        **dcf_current.dupont_data.get(ticker, {}),
        **found,
    }
    return jsonify({
        "status": "ok",
        "message": f"Autofilled {len(found)} target company DuPont input(s) from Step 1 financial statements.",
        "ticker": ticker,
        "values": found,
        "sources": sources,
    })

@app.route("/autosource-dcf-financials", methods=["POST"])
def autosource_dcf_financials():
    if dcf_current is None:
        return jsonify({"status": "error", "message": "Save Step 1 before auto-sourcing financial statements."}), 400

    data = request.get_json(silent=True) or {}
    identity = data.get("edgar_identity") or dcf_current.edgar_identity or os.environ.get("EDGAR_IDENTITY")
    if identity:
        dcf_current.edgar_identity = identity
        os.environ["EDGAR_IDENTITY"] = identity

    try:
        from edgar import Company
        from edgar.xbrl import XBRLS
    except Exception as e:
        dcf_current.financial_source_status = "manual_required"
        dcf_current.financial_source_message = f"EdgarTools is unavailable: {e}. Upload CapitalIQ financials manually."
        return jsonify({
            "status": "manual_required",
            "message": dcf_current.financial_source_message,
            "statements": [],
        }), 200

    try:
        ticker = dcf_current.ticker_symbol.upper()
        company = Company(ticker)
        filings = list(company.get_filings(form="10-K").head(5))
        if not filings:
            dcf_current.financial_source_status = "manual_required"
            dcf_current.financial_source_message = f"No 10-K filings were found for {ticker}. Upload CapitalIQ financials manually."
            return jsonify({
                "status": "manual_required",
                "message": dcf_current.financial_source_message,
                "statements": [],
            }), 200

        xbrls = XBRLS.from_filings(filings)
        statements = [
            ("Income Statement", xbrls.statements.income_statement),
            ("Balance Sheet", xbrls.statements.balance_sheet),
            ("Cash Flow Statement", xbrls.statements.cash_flow_statement),
        ]

        ticker_dir = secure_filename(ticker) or "target"
        target_dir = os.path.join(dcf_upload_dir, ticker_dir, "financials")
        os.makedirs(target_dir, exist_ok=True)

        summaries = []
        for statement_key, statement_getter in statements:
            statement = statement_getter()
            filename = secure_filename(f"{ticker}_{statement_key.lower().replace(' ', '_')}_edgar.csv")
            path = os.path.join(target_dir, filename)
            statement.to_dataframe().to_csv(path, index=False)
            summaries.append(_statement_summary(statement, statement_key, filename))

        dcf_current.financial_statement_summaries = summaries
        dcf_current.financial_source_status = "auto"
        dcf_current.financial_source_message = f"Auto-sourced {len(summaries)} financial statements for {ticker} from EDGAR XBRL."
        return jsonify({
            "status": "auto",
            "message": dcf_current.financial_source_message,
            "statements": summaries,
        })

    except Exception as e:
        dcf_current.financial_source_status = "manual_required"
        dcf_current.financial_source_message = f"Could not auto-source financial statements from EDGAR: {e}"
        return jsonify({
            "status": "manual_required",
            "message": dcf_current.financial_source_message,
            "statements": [],
        }), 200

@app.route("/autosource-dcf-10ks", methods=["POST"])
def autosource_dcf_10ks():
    if dcf_current is None:
        return jsonify({"status": "error", "message": "Save UI1-1 before auto-sourcing 10-Ks."}), 400

    data = request.get_json(silent=True) or {}
    identity = data.get("edgar_identity") or dcf_current.edgar_identity or os.environ.get("EDGAR_IDENTITY")
    if identity:
        dcf_current.edgar_identity = identity
        os.environ["EDGAR_IDENTITY"] = identity

    try:
        from edgar import Company
        from edgar.xbrl import XBRLS
    except Exception:
        dcf_current.ten_k_source_status = "manual_required"
        dcf_current.ten_k_source_message = "EdgarTools is not installed. Install requirements, then try auto-source again."
        return jsonify({
            "status": "manual_required",
            "message": dcf_current.ten_k_source_message,
            "filings": [],
        }), 200

    try:
        ticker = dcf_current.ticker_symbol.upper()
        company = Company(ticker)
        filings = company.get_filings(form="10-K").head(5)
        filings_list = list(filings)

        if not filings_list:
            dcf_current.ten_k_filings = []
            dcf_current.ten_k_source_status = "manual_required"
            dcf_current.ten_k_source_message = f"No 10-K filings were found for {ticker}. Please upload them manually."
            return jsonify({
                "status": "manual_required",
                "message": dcf_current.ten_k_source_message,
                "filings": [],
            }), 200

        # This confirms that XBRL can be parsed/stiched for the retrieved filings.
        XBRLS.from_filings(filings_list)

        filing_data = [_filing_metadata(filing) for filing in filings_list]
        dcf_current.ten_k_filings = filing_data
        if len(filing_data) >= 5:
            dcf_current.ten_k_source_status = "auto"
            dcf_current.ten_k_source_message = f"Found {len(filing_data)} 10-K filings for {ticker} from EDGAR."
        else:
            dcf_current.ten_k_source_status = "partial"
            dcf_current.ten_k_source_message = f"Found {len(filing_data)} 10-K filing(s) for {ticker}. Upload any missing years manually."

        return jsonify({
            "status": dcf_current.ten_k_source_status,
            "message": dcf_current.ten_k_source_message,
            "filings": filing_data,
        })

    except Exception as e:
        dcf_current.ten_k_filings = []
        dcf_current.ten_k_source_status = "manual_required"
        dcf_current.ten_k_source_message = f"Could not auto-source 10-Ks from EDGAR: {e}"
        return jsonify({
            "status": "manual_required",
            "message": dcf_current.ten_k_source_message,
            "filings": [],
        }), 200

@app.route("/get-state")
def get_state():
    if current is None:
        return jsonify(None)
    return jsonify({
        "company_name":     current.company_name,
        "trading_exchange": current.trading_exchange,
        "ticker_symbol":    current.ticker_symbol,
        "primary_industry": current.primary_industry,
        "fiscal_year":      current.fiscal_year,
        "longlist": [
            {"company_name": c.company_name, "trading_exchange": c.trading_exchange, "ticker_symbol": c.ticker_symbol}
            for c in current.longlist
        ],
        "shortlist": [
            {"company_name": c.company_name, "trading_exchange": c.trading_exchange, "ticker_symbol": c.ticker_symbol}
            for c in current.shortlist
        ],
    })

@app.route("/submit", methods=["POST"])
def submit():
    # Dont touch this function -JR
    global current
    data = request.json
    submit_type = data.get("type")

    if submit_type == "pe_step1":
        current = pe_state(
            company_name     = data["company_name"],
            trading_exchange = data["trading_exchange"],
            ticker_symbol    = data["ticker_symbol"],
            primary_industry = data["primary_industry"],
            fiscal_year      = int(data["fiscal_year"]),
        )
        for c in data.get("longlist", []):
            if c.get("company_name"):
                current.longlist.append(competitor(
                    company_name     = c["company_name"],
                    trading_exchange = c["trading_exchange"],
                    ticker_symbol    = c["ticker_symbol"],
                ))

    elif submit_type == "pe_step2": # Note: Have the compt
        for ticker, comps in data.get("reverse_lookup", {}).items():
            current.reverse_lookup[ticker] = [
                competitor(
                    company_name     = c["company_name"],
                    trading_exchange = c["trading_exchange"],
                    ticker_symbol    = c["ticker_symbol"],
                ) for c in comps if c.get("company_name")
            ]
        current.build_shortlist()

    elif submit_type == "pe_step3":
        for ticker, years in data.get("financial_data", {}).items():
            current.financial_data[ticker] = [
                financial_year(
                    earnings = float(y.get("earnings") or 0),
                    price    = float(y.get("price") or 0),
                ) for y in years
            ]

        pred = data.get("prediction", {})
        current.prediction = prediction(
            pe_t1    = float(pred.get("pe_t1")    or 0),
            eps_t1   = float(pred.get("eps_t1")   or 0),
            price_t1 = float(pred.get("price_t1") or 0),
        )
    else:
        return jsonify({"status": "error", "message": f"Unknown type '{submit_type}'"}), 400

    print(current)
    return jsonify({"status": "ok"})

@app.route("/save-session", methods=["POST"])
def save_session():
    if current is None:
        return jsonify({"status": "error", "message": "No active session."}), 400
    filename = f"{current.ticker_symbol}_session.json"
    path = os.path.join(pe_save_dir, filename)
    with open(path, "w") as f:
        f.write(current.to_json())
    return send_file(path, as_attachment=True, download_name=filename)

@app.route("/load-session", methods=["POST"])
def load_session():
    global current
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file provided."}), 400
    raw = request.files["file"].read().decode("utf-8")
    try:
        current = pe_state.from_json(raw)
        return jsonify({"status": "ok", "ticker": current.ticker_symbol})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/ping-test")
def ping_test():
    return jsonify({"status": "ok", "message": "pong"})

if __name__ == "__main__":
    app.run(debug=True)
