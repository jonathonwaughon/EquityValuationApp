# File name: main.py
# Created: 5/19/2026 3:01 PM
# Purpose: Acts as the entry point for all other modules
# Last edited: JR
# Notes:

from flask import Flask, jsonify, request, render_template
from state.pe_state import competitor, pe_state

current = None

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/pe")
def pe():
    return render_template("pe_page.html")

@app.route("/submit", methods = ["POST"])
def submit():
    # Dont touch this function -JR
    global current 
    data = request.json
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
    print(current)
    return jsonify({"status": "ok"})


@app.route("/ping-test")
def ping_test():
    return jsonify({"status": "ok", "message": "pong"})

if __name__ == "__main__":
    app.run(debug=True)
