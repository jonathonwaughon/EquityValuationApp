# File name:  pe_state.py
# Created:    2026-05-21 12:20 AM
# Purpose:    Store Step 1 data for Comparable Company Analysis.
# Notes:      --
# Used:       --

from dataclasses import dataclass, field


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