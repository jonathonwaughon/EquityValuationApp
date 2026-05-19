# File name: main.py
# Created: 5/19/2026 3:01 PM
# Purpose: Acts as the entry point for all other modules
# Last edited: JR
# Notes:

from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ping-test")
def ping_test():
    return jsonify({"status": "ok", "message": "pong"})

if __name__ == "__main__":
    app.run(debug=True)
