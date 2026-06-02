# File name:  pe_state.py
# Created:    2026-05-21 12:20 AM
# Purpose:    Store Step 1 data for Comparable Company Analysis.
# Notes:      --
# Used:       --

from dataclasses import dataclass, field
import json
 

@dataclass
class financial_year:
    earnings: float = 0.0
    price: float = 0.0

    @property
    def pe(self):
        if self.earnings == 0:
            return None
        return self.price / self.earnings


@dataclass
class prediction:
    pe_t1: float = 0.0
    eps_t1: float = 0.0
    price_t1: float = 0.0
 
@dataclass
class competitor:
    company_name: str
    trading_exchange: str
    ticker_symbol: str
 
 
@dataclass
class pe_state:
    company_name: str
    trading_exchange: str
    ticker_symbol: str
    primary_industry: str
    fiscal_year: int
    longlist: list[competitor] = field(default_factory=list)
 
    # JR: Key is the company's ticker
    reverse_lookup: dict[str, list[competitor]] = field(default_factory=dict)
    shortlist: list[competitor] = field(default_factory=list)

    # financial_data[ticker] = [financial_year(t-2), financial_year(t-1), financial_year(t)]
    financial_data: dict[str, list[financial_year]] = field(default_factory=dict)
    prediction: prediction = field(default_factory=prediction)
 
    def build_shortlist(self):
        self.shortlist = [
            comp for comp in self.longlist
            if any(
                c.ticker_symbol.upper() == self.ticker_symbol.upper()
                for c in self.reverse_lookup.get(comp.ticker_symbol, [])
            )
        ]

    def to_json(self) -> str:
        return json.dumps({
            "company_name":     self.company_name,
            "trading_exchange": self.trading_exchange,
            "ticker_symbol":    self.ticker_symbol,
            "primary_industry": self.primary_industry,
            "fiscal_year":      self.fiscal_year,
            "longlist": [
                {"company_name": c.company_name, "trading_exchange": c.trading_exchange, "ticker_symbol": c.ticker_symbol}
                for c in self.longlist
            ],
            "shortlist": [
                {"company_name": c.company_name, "trading_exchange": c.trading_exchange, "ticker_symbol": c.ticker_symbol}
                for c in self.shortlist
            ],
            "reverse_lookup": {
                ticker: [{"company_name": c.company_name, "trading_exchange": c.trading_exchange, "ticker_symbol": c.ticker_symbol}
                for c in comps]
                for ticker, comps in self.reverse_lookup.items()
            },
            "financial_data": {
                ticker: [{"earnings": y.earnings, "price": y.price} for y in years]
                for ticker, years in self.financial_data.items()
            },
            "prediction": {
                "pe_t1":    self.prediction.pe_t1,
                "eps_t1":   self.prediction.eps_t1,
                "price_t1": self.prediction.price_t1,
            }
        }, indent=2)

    @staticmethod
    def from_json(raw: str) -> "pe_state":
        d = json.loads(raw)
        state = pe_state(
            company_name     = d["company_name"],
            trading_exchange = d["trading_exchange"],
            ticker_symbol    = d["ticker_symbol"],
            primary_industry = d["primary_industry"],
            fiscal_year      = d["fiscal_year"],
        )
        state.longlist  = [competitor(**c) for c in d.get("longlist", [])]
        state.shortlist = [competitor(**c) for c in d.get("shortlist", [])]
        state.reverse_lookup = {
            ticker: [competitor(**c) for c in comps]
            for ticker, comps in d.get("reverse_lookup", {}).items()
        }
        state.financial_data = {
            ticker: [financial_year(**y) for y in years]
            for ticker, years in d.get("financial_data", {}).items()
        }
        pred = d.get("prediction", {})
        state.prediction = prediction(**pred)
        return state
 