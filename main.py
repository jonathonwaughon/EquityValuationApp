# File name: main.py
# Created: 5/19/2026 3:01 PM
# Purpose: Acts as the entry point for all other modules
# Last edited: JR
# Notes:

from flask import Flask, jsonify, request, render_template, send_file
from state.pe_state import competitor, pe_state, prediction, financial_year
import io, os

current = None
pe_save_dir = "pe_saves"
os.makedirs(pe_save_dir, exist_ok=True)

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



# BACKEND ROUTES

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
