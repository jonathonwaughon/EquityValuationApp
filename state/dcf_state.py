# File name:  dcf_state.py
# Purpose:    Store DCF workflow state.

from dataclasses import dataclass, field


@dataclass
class dcf_state:
    company_name: str
    trading_exchange: str
    ticker_symbol: str
    primary_industry: str
    fiscal_year_end: str = ""
    most_recent_fiscal_year: int | None = None
    edgar_identity: str = ""
    ten_k_files: list[dict[str, str]] = field(default_factory=list)
    ten_k_filings: list[dict[str, str]] = field(default_factory=list)
    ten_k_source_status: str = "not_started"
    ten_k_source_message: str = ""
    financial_statement_files: list[dict[str, str]] = field(default_factory=list)
    financial_source_status: str = "not_started"
    financial_source_message: str = ""
    financial_statement_summaries: list[dict[str, str]] = field(default_factory=list)
    macro_analysis: str = ""
    industry_competitors: list[dict[str, str]] = field(default_factory=list)
    dupont_data: dict[str, dict[str, str]] = field(default_factory=dict)
