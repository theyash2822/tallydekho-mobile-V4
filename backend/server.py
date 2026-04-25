from fastapi import FastAPI, APIRouter, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ─── Models ────────────────────────────────────────────────────────────────────
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str


# ─── Dashboard Seed Data ───────────────────────────────────────────────────────
DASHBOARD_SEED = {
    "7D": {
        "kpi_strip": [
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹24,500",   "icon": "wallet-outline",         "trend": "+8.6%",  "positive": True,  "route": "/kpi/cash-in-hand"},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹1,85,300", "icon": "card-outline",           "trend": "+4.5%",  "positive": True,  "route": "/kpi/bank-balance"},
            {"id": "recv",     "label": "Receivables",   "amount": "₹67,200",   "icon": "arrow-down-circle-outline","trend": "-4.8%", "positive": False, "route": "/kpi/receivables"},
            {"id": "pay",      "label": "Payables",      "amount": "₹43,100",   "icon": "arrow-up-circle-outline", "trend": "+4.2%",  "positive": False, "route": "/kpi/payables"},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",      "trend": "+2.0%",  "positive": False,  "route": "/kpi/loans-ods"},
            {"id": "payments", "label": "Payments",      "amount": "₹38,500",   "icon": "send-outline",           "trend": "-10.9%", "positive": True, "route": "/kpi/payments"},
            {"id": "receipts", "label": "Receipts",      "amount": "₹52,000",   "icon": "checkmark-circle-outline","trend": "+16.5%", "positive": True, "route": "/kpi/receipts"},
        ],
        "metrics": [
            {"id": "sales",     "label": "Sales",     "icon": "trending-up",    "amount": "₹1.23L", "change": 12, "positive": True,  "route": "/sales"},
            {"id": "purchases", "label": "Purchases", "icon": "cart-outline",   "amount": "₹78,400","change": 3,  "positive": True,  "route": "/purchase"},
            {"id": "expenses",  "label": "Expenses",  "icon": "receipt-outline","amount": "₹45,200","change": 5,  "positive": False, "route": "/expenses"},
        ],
        "cashflow": {
            "netCash": 8500, "grossCash": 12300.0,
            "netRealisableBalance": 8100, "grossProfit": 18400, "netProfit": 6200,
            "incomePercentage": 76, "updatedAt": "5 mins. ago",
            "totalIncome": 12300, "totalExpense": 3800
        }
    },
    "1M": {
        "kpi_strip": [
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹32,800",   "icon": "wallet-outline",          "trend": "+19.5%", "positive": True,  "route": "/kpi/cash-in-hand"},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹2,45,600", "icon": "card-outline",            "trend": "+9.4%",  "positive": True,  "route": "/kpi/bank-balance"},
            {"id": "recv",     "label": "Receivables",   "amount": "₹1,24,500", "icon": "arrow-down-circle-outline","trend": "+11.4%", "positive": True,  "route": "/kpi/receivables"},
            {"id": "pay",      "label": "Payables",      "amount": "₹89,300",   "icon": "arrow-up-circle-outline",  "trend": "+9.6%",  "positive": False, "route": "/kpi/payables"},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False,  "route": "/kpi/loans-ods"},
            {"id": "payments", "label": "Payments",      "amount": "₹1,24,000", "icon": "send-outline",            "trend": "-10.0%", "positive": True, "route": "/kpi/payments"},
            {"id": "receipts", "label": "Receipts",      "amount": "₹1,82,000", "icon": "checkmark-circle-outline","trend": "+13.5%", "positive": True, "route": "/kpi/receipts"},
        ],
        "metrics": [
            {"id": "sales",     "label": "Sales",     "icon": "trending-up",    "amount": "₹4.23L", "change": 8,  "positive": True,  "route": "/sales"},
            {"id": "purchases", "label": "Purchases", "icon": "cart-outline",   "amount": "₹2.18L", "change": 6,  "positive": True,  "route": "/purchase"},
            {"id": "expenses",  "label": "Expenses",  "icon": "receipt-outline","amount": "₹1.45L", "change": 3,  "positive": False, "route": "/expenses"},
        ],
        "cashflow": {
            "netCash": 20830, "grossCash": 48200.0,
            "netRealisableBalance": 20021, "grossProfit": 470999, "netProfit": 130999,
            "incomePercentage": 68, "updatedAt": "2 mins. ago",
            "totalIncome": 48200, "totalExpense": 27370
        }
    },
    "3M": {
        "kpi_strip": [
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹45,200",   "icon": "wallet-outline",          "trend": "+28.3%", "positive": True,  "route": "/kpi/cash-in-hand"},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹3,89,700", "icon": "card-outline",            "trend": "+17.5%", "positive": True,  "route": "/kpi/bank-balance"},
            {"id": "recv",     "label": "Receivables",   "amount": "₹2,87,600", "icon": "arrow-down-circle-outline","trend": "+14.6%", "positive": True,  "route": "/kpi/receivables"},
            {"id": "pay",      "label": "Payables",      "amount": "₹1,98,400", "icon": "arrow-up-circle-outline",  "trend": "+12.3%", "positive": False, "route": "/kpi/payables"},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False,  "route": "/kpi/loans-ods"},
            {"id": "payments", "label": "Payments",      "amount": "₹3,45,000", "icon": "send-outline",            "trend": "-9.3%",  "positive": True, "route": "/kpi/payments"},
            {"id": "receipts", "label": "Receipts",      "amount": "₹4,12,000", "icon": "checkmark-circle-outline","trend": "+13.8%", "positive": True, "route": "/kpi/receipts"},
        ],
        "metrics": [
            {"id": "sales",     "label": "Sales",     "icon": "trending-up",    "amount": "₹12.45L","change": 15, "positive": True,  "route": "/sales"},
            {"id": "purchases", "label": "Purchases", "icon": "cart-outline",   "amount": "₹6.78L", "change": 11, "positive": True,  "route": "/purchase"},
            {"id": "expenses",  "label": "Expenses",  "icon": "receipt-outline","amount": "₹4.23L", "change": 2,  "positive": False, "route": "/expenses"},
        ],
        "cashflow": {
            "netCash": 65400, "grossCash": 89200.0,
            "netRealisableBalance": 63100, "grossProfit": 1245000, "netProfit": 387000,
            "incomePercentage": 65, "updatedAt": "10 mins. ago",
            "totalIncome": 145200, "totalExpense": 79800
        }
    },
    "6M": {
        "kpi_strip": [
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹67,800",   "icon": "wallet-outline",          "trend": "+41.9%", "positive": True,  "route": "/kpi/cash-in-hand"},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹5,12,300", "icon": "card-outline",            "trend": "+28.4%", "positive": True,  "route": "/kpi/bank-balance"},
            {"id": "recv",     "label": "Receivables",   "amount": "₹4,45,200", "icon": "arrow-down-circle-outline","trend": "+20.1%", "positive": True,  "route": "/kpi/receivables"},
            {"id": "pay",      "label": "Payables",      "amount": "₹3,12,600", "icon": "arrow-up-circle-outline",  "trend": "+17.3%", "positive": False, "route": "/kpi/payables"},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False,  "route": "/kpi/loans-ods"},
            {"id": "payments", "label": "Payments",      "amount": "₹6,78,000", "icon": "send-outline",            "trend": "-10.0%", "positive": True, "route": "/kpi/payments"},
            {"id": "receipts", "label": "Receipts",      "amount": "₹7,24,000", "icon": "checkmark-circle-outline","trend": "+13.0%", "positive": True, "route": "/kpi/receipts"},
        ],
        "metrics": [
            {"id": "sales",     "label": "Sales",     "icon": "trending-up",    "amount": "₹24.80L","change": 22, "positive": True,  "route": "/sales"},
            {"id": "purchases", "label": "Purchases", "icon": "cart-outline",   "amount": "₹13.20L","change": 18, "positive": True,  "route": "/purchase"},
            {"id": "expenses",  "label": "Expenses",  "icon": "receipt-outline","amount": "₹8.90L", "change": 5,  "positive": False, "route": "/expenses"},
        ],
        "cashflow": {
            "netCash": 142000, "grossCash": 198400.0,
            "netRealisableBalance": 138600, "grossProfit": 2890000, "netProfit": 876000,
            "incomePercentage": 64, "updatedAt": "15 mins. ago",
            "totalIncome": 320400, "totalExpense": 178400
        }
    }
}

RECENT_ACTIVITY_DATA = [
    {"id": "1", "type": "credit", "label": "Sales Invoice #INV-2847",      "amount": "+₹18,400", "date": "Today, 3:45 PM",       "party": "Mehta Enterprises"},
    {"id": "2", "type": "debit",  "label": "Purchase Order #PO-394",       "amount": "-₹9,200",  "date": "Today, 1:20 PM",       "party": "Shree Suppliers"},
    {"id": "3", "type": "credit", "label": "Payment Received #RCP-128",    "amount": "+₹32,000", "date": "Today, 11:05 AM",      "party": "Patel & Sons"},
    {"id": "4", "type": "debit",  "label": "Expense Voucher #EXP-056",     "amount": "-₹4,500",  "date": "Yesterday, 5:30 PM",   "party": "Office Supplies Co"},
    {"id": "5", "type": "credit", "label": "Sales Invoice #INV-2846",      "amount": "+₹27,800", "date": "Yesterday, 2:00 PM",   "party": "Kumar Trading"},
    {"id": "6", "type": "debit",  "label": "Bank Transfer #NEFT-089",      "amount": "-₹15,000", "date": "Yesterday, 10:00 AM",  "party": "HDFC Bank"},
    {"id": "7", "type": "credit", "label": "Sales Invoice #INV-2845",      "amount": "+₹11,200", "date": "2 days ago",           "party": "Singh Distributors"},
    {"id": "8", "type": "debit",  "label": "Purchase Invoice #PI-277",     "amount": "-₹22,400", "date": "2 days ago",           "party": "Raj Wholesalers"},
    {"id": "9", "type": "credit", "label": "Payment Received #RCP-127",    "amount": "+₹8,600",  "date": "3 days ago",           "party": "Sharma Traders"},
    {"id":"10", "type": "debit",  "label": "Expense Voucher #EXP-055",     "amount": "-₹3,200",  "date": "3 days ago",           "party": "Telecom Provider"},
]

SALES_INVOICES_DATA = [
    {"id": "INV-2847", "party": "Mehta Enterprises",  "amount": "₹18,400", "date": "17 Apr 2026", "status": "pending_irn", "dueDate": "24 Apr 2026"},
    {"id": "INV-2846", "party": "Kumar Trading",       "amount": "₹27,800", "date": "16 Apr 2026", "status": "pending_irn", "dueDate": "23 Apr 2026"},
    {"id": "INV-2845", "party": "Singh Distributors",  "amount": "₹11,200", "date": "15 Apr 2026", "status": "pending_irn", "dueDate": "22 Apr 2026"},
    {"id": "INV-2844", "party": "Gupta & Co",          "amount": "₹44,600", "date": "14 Apr 2026", "status": "generated",   "dueDate": "21 Apr 2026"},
    {"id": "INV-2843", "party": "Sharma Traders",      "amount": "₹8,900",  "date": "13 Apr 2026", "status": "pending_irn", "dueDate": "20 Apr 2026"},
    {"id": "INV-2842", "party": "Jain Brothers",       "amount": "₹31,200", "date": "12 Apr 2026", "status": "generated",   "dueDate": "19 Apr 2026"},
    {"id": "INV-2841", "party": "Patel & Sons",        "amount": "₹19,800", "date": "11 Apr 2026", "status": "pending_irn", "dueDate": "18 Apr 2026"},
    {"id": "INV-2840", "party": "Ram Enterprises",     "amount": "₹56,400", "date": "10 Apr 2026", "status": "generated",   "dueDate": "17 Apr 2026"},
    {"id": "INV-2839", "party": "Das Trading",         "amount": "₹12,600", "date": "9 Apr 2026",  "status": "pending_irn", "dueDate": "16 Apr 2026"},
    {"id": "INV-2838", "party": "Verma Corp",          "amount": "₹38,200", "date": "8 Apr 2026",  "status": "pending_irn", "dueDate": "15 Apr 2026"},
    {"id": "INV-2837", "party": "Tiwari Stores",       "amount": "₹7,800",  "date": "7 Apr 2026",  "status": "pending_irn", "dueDate": "14 Apr 2026"},
    {"id": "INV-2836", "party": "Mishra Wholesale",    "amount": "₹23,100", "date": "6 Apr 2026",  "status": "generated",   "dueDate": "13 Apr 2026"},
    {"id": "INV-2835", "party": "Bose Electronics",    "amount": "₹91,500", "date": "5 Apr 2026",  "status": "pending_irn", "dueDate": "12 Apr 2026"},
    {"id": "INV-2834", "party": "Anand Distributors",  "amount": "₹14,700", "date": "4 Apr 2026",  "status": "pending_irn", "dueDate": "11 Apr 2026"},
]


# ─── Existing Routes ───────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ─── Dashboard Routes ──────────────────────────────────────────────────────────
@api_router.get("/dashboard/kpi-strip")
async def get_kpi_strip(period: Optional[str] = Query("7D")):
    data = DASHBOARD_SEED.get(period, DASHBOARD_SEED["7D"])
    return data["kpi_strip"]

@api_router.get("/dashboard/metrics")
async def get_metrics(period: Optional[str] = Query("7D")):
    data = DASHBOARD_SEED.get(period, DASHBOARD_SEED["7D"])
    return data["metrics"]

@api_router.get("/dashboard/cashflow")
async def get_cashflow(period: Optional[str] = Query("7D")):
    data = DASHBOARD_SEED.get(period, DASHBOARD_SEED["7D"])
    return data["cashflow"]

@api_router.get("/dashboard/recent-activity")
async def get_recent_activity():
    return RECENT_ACTIVITY_DATA

@api_router.get("/dashboard/search")
async def search_dashboard(q: Optional[str] = Query("")):
    if not q:
        return RECENT_ACTIVITY_DATA
    query = q.lower()
    return [item for item in RECENT_ACTIVITY_DATA
            if query in item["label"].lower()
            or query in item["party"].lower()
            or query in item["amount"].lower()]


# ─── Sales Routes ──────────────────────────────────────────────────────────────
@api_router.get("/sales/invoices")
async def get_sales_invoices():
    pending = [i for i in SALES_INVOICES_DATA if i["status"] == "pending_irn"]
    return {
        "invoices": SALES_INVOICES_DATA,
        "pending_irn_count": len(pending),
        "total": len(SALES_INVOICES_DATA),
    }


@api_router.get("/kpi/payables")
async def get_payables_kpi():
    return {
        "aging": [
            {"id": "total",  "label": "Total Due", "amount": "₹1,25,000", "trend": "+18%", "positive": True},
            {"id": "b1_30",  "label": "1-30d",     "amount": "₹45,000",   "trend": "+12%", "positive": True},
            {"id": "b31_60", "label": "31-60d",    "amount": "₹65,000",   "trend": "+25%", "positive": True},
            {"id": "b61_90", "label": "61-90d",    "amount": "₹55,000",   "trend": "-8%",  "positive": False},
            {"id": "b90p",   "label": "90+d",      "amount": "₹1,85,000", "trend": "+28%", "positive": True},
        ],
        "recent": [
            {"ref": "RC-1578", "party": "ABC Traders",   "date": "10 Nov", "amount": "₹54,000"},
            {"ref": "RC-1579", "party": "XYZ Retail",    "date": "12 Dec", "amount": "₹54,000"},
            {"ref": "RC-1580", "party": "ABC Traders",   "date": "15 Nov", "amount": "₹54,000"},
            {"ref": "RC-1581", "party": "XYZ Retail",    "date": "18 Dec", "amount": "₹54,000"},
        ],
        "overdue_parties": [
            {"party": "Tech Solutions Ltd", "days": "28d", "amount": "₹1,25 K"},
            {"party": "Global Suppliers",   "days": "35d", "amount": "₹95 K"},
            {"party": "Innovation Corp",    "days": "42d", "amount": "₹1,85 K"},
            {"party": "Quality Imports",    "days": "31d", "amount": "₹75 K"},
        ],
    }


@api_router.get("/kpi/receivables")
async def get_receivables_kpi():
    return {
        "aging": [
            {"id": "total",  "label": "Total Due", "amount": "₹75,000",   "trend": "+12%", "positive": True},
            {"id": "b1_30",  "label": "1-30d",     "amount": "₹28,000",   "trend": "+8%",  "positive": True},
            {"id": "b31_60", "label": "31-60d",    "amount": "₹22,000",   "trend": "+15%", "positive": True},
            {"id": "b61_90", "label": "61-90d",    "amount": "₹18,000",   "trend": "-5%",  "positive": False},
            {"id": "b90p",   "label": "90+d",      "amount": "₹7,000",    "trend": "+20%", "positive": True},
        ],
        "recent": [
            {"ref": "RC-1578", "party": "ABC Traders",  "date": "10 Nov", "amount": "₹54,000"},
            {"ref": "RC-1579", "party": "XYZ Retail",   "date": "12 Dec", "amount": "₹54,000"},
            {"ref": "RC-1580", "party": "Metro Infra",  "date": "20 Nov", "amount": "₹42,000"},
            {"ref": "RC-1581", "party": "AGL Traders",  "date": "22 Dec", "amount": "₹28,500"},
        ],
        "overdue_parties": [
            {"party": "ABC Traders",      "days": "35d", "amount": "₹3,75 K"},
            {"party": "PQR Exports",      "days": "42d", "amount": "₹3,75 K"},
            {"party": "XYZ Warehousing",  "days": "28d", "amount": "₹3,75 K"},
            {"party": "LMN Distributors", "days": "55d", "amount": "₹3,75 K"},
        ],
    }


# ─── Auth Routes ───────────────────────────────────────────────────────────────
class OTPRequest(BaseModel):
    phone: str

class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str

class RegisterRequest(BaseModel):
    name: str
    language: str
    phone: str

@api_router.post("/auth/send-otp")
async def send_otp(body: OTPRequest):
    return {"success": True, "message": "OTP sent successfully"}

@api_router.post("/auth/verify-otp")
async def verify_otp(body: OTPVerifyRequest):
    return {"success": True, "token": "mock_token_123", "isNewUser": True}

@api_router.post("/auth/register")
async def register_user(body: RegisterRequest):
    return {
        "success": True,
        "token": "mock_token_123",
        "user": {"id": "user_001", "name": body.name, "phone": body.phone, "language": body.language}
    }


# ─── Stocks Routes ─────────────────────────────────────────────────────────────
STOCKS_DATA = {
    "totalValue": "₹6,06,210",
    "totalSKUs": 56,
    "totalWarehouses": 3,
    "lowStockCount": 8,
    "items": [
        {"id": "SI01", "name": "Black JBL Speaker",      "sku": "PRD-1002-ABC", "price": "₹4,200",  "stock": 85,  "status": "in_stock",    "warehouse": "WH01 – Mumbai"},
        {"id": "SI02", "name": "USB-C Cable 3A",          "sku": "USB-3A-1M",   "price": "₹450",    "stock": 320, "status": "in_stock",    "warehouse": "WH01 – Mumbai"},
        {"id": "SI03", "name": "Wireless Mouse M220",     "sku": "LOG-M220",    "price": "₹2,800",  "stock": 64,  "status": "in_stock",    "warehouse": "WH02 – Delhi"},
        {"id": "SI04", "name": "HDMI Cable 1.5m",         "sku": "HDM-1.5",     "price": "₹780",    "stock": 140, "status": "in_stock",    "warehouse": "WH02 – Delhi"},
        {"id": "SI05", "name": "Laptop Stand Adjustable", "sku": "LST-ADJ01",   "price": "₹5,400",  "stock": 28,  "status": "low_stock",   "warehouse": "WH01 – Mumbai"},
        {"id": "SI06", "name": "Mechanical Keyboard",     "sku": "LOG-MK235",   "price": "₹6,900",  "stock": 42,  "status": "in_stock",    "warehouse": "WH03 – Bangalore"},
        {"id": "SI07", "name": "Power Bank 20000mAh",     "sku": "AMZ-PB20K",   "price": "₹1,800",  "stock": 95,  "status": "in_stock",    "warehouse": "WH03 – Bangalore"},
        {"id": "SI08", "name": "Monitor 27\" IPS",        "sku": "BNQ-27IPS",   "price": "₹21,000", "stock": 12,  "status": "low_stock",   "warehouse": "WH01 – Mumbai"},
        {"id": "SI09", "name": "TWS Earbuds Pro",         "sku": "TWS-PRO-01",  "price": "₹2,200",  "stock": 58,  "status": "in_stock",    "warehouse": "WH02 – Delhi"},
        {"id": "SI10", "name": "Type-C Hub 7-in-1",       "sku": "USB-C71",     "price": "₹1,600",  "stock": 76,  "status": "in_stock",    "warehouse": "WH04 – Hyderabad"},
    ],
}

@api_router.get("/stocks")
async def get_stocks():
    return STOCKS_DATA


# ─── Ledger Routes ─────────────────────────────────────────────────────────────
LEDGERS_DATA = [
    {"id": "LED001", "name": "Indian Export House", "group": "Sundry Creditor",  "balance": "₹34,000", "type": "credit", "nature": "Liabilities", "phone": "9876543210", "lastUpdated": "08/28"},
    {"id": "LED002", "name": "Raj Enterprises",     "group": "Sundry Debtor",    "balance": "₹12,500", "type": "debit",  "nature": "Assets",      "phone": "9845012345", "lastUpdated": "08/25"},
    {"id": "LED003", "name": "Cash",                "group": "Cash-in-hand",     "balance": "₹0",      "type": "debit",  "nature": "Assets",      "phone": "",           "lastUpdated": "08/22"},
    {"id": "LED004", "name": "ABC Traders",         "group": "Sundry Creditor",  "balance": "₹34,000", "type": "credit", "nature": "Liabilities", "phone": "9811223344", "lastUpdated": "08/20"},
    {"id": "LED005", "name": "Kumar & Sons",        "group": "Sundry Debtor",    "balance": "₹8,000",  "type": "debit",  "nature": "Assets",      "phone": "9900112233", "lastUpdated": "08/18"},
    {"id": "LED006", "name": "Sharma Electronics",  "group": "Capital Account",  "balance": "₹0",      "type": "credit", "nature": "Liabilities", "phone": "9712345678", "lastUpdated": "08/17"},
    {"id": "LED007", "name": "Delhi Suppliers",     "group": "Sundry Creditor",  "balance": "₹22,000", "type": "credit", "nature": "Liabilities", "phone": "9988776655", "lastUpdated": "08/10"},
    {"id": "LED008", "name": "Sales Revenue",       "group": "Sales Accounts",   "balance": "₹92,000", "type": "credit", "nature": "Income",      "phone": "",           "lastUpdated": "08/08"},
    {"id": "LED009", "name": "Office Expenses",     "group": "Indirect Expenses","balance": "₹14,200", "type": "debit",  "nature": "Expense",     "phone": "",           "lastUpdated": "08/05"},
    {"id": "LED010", "name": "Mehta Enterprises",   "group": "Sundry Debtor",    "balance": "₹18,400", "type": "debit",  "nature": "Assets",      "phone": "9001122334", "lastUpdated": "08/03"},
    {"id": "LED011", "name": "PQR Exports",         "group": "Sundry Creditor",  "balance": "₹28,000", "type": "credit", "nature": "Liabilities", "phone": "9112233445", "lastUpdated": "08/01"},
    {"id": "LED012", "name": "HDFC Bank",           "group": "Bank Accounts",    "balance": "₹1,85,300","type":"debit",  "nature": "Assets",      "phone": "",           "lastUpdated": "07/31"},
]

@api_router.get("/ledgers")
async def get_ledgers():
    return LEDGERS_DATA


# ─── Notifications Routes ──────────────────────────────────────────────────────
NOTIFICATIONS_DATA = [
    {"id": "N001", "type": "warning", "title": "Budget Overspend Warning",   "message": "Budget Alert: You've exceeded your monthly marketing budget by ₹2,000. Tap to adjust your plan!", "time": "5 mins.", "actionLabel": "Adjust plan"},
    {"id": "N002", "type": "urgent",  "title": "Daily Summary Alert",        "message": "Your daily financial summary is ready! Tap to review today's income, expenses, and cash flow insights.", "time": "12:02 PM", "actionLabel": None},
    {"id": "N003", "type": "info",    "title": "Goal Progress Update",       "message": "Great news! You're 75% closer to your savings goal for this month. Keep up the momentum!", "time": "Jan 20, 2025", "actionLabel": None},
    {"id": "N004", "type": "warning", "title": "Low Stock Alert",            "message": "8 items are running low on stock. Reorder soon to avoid stockouts.", "time": "2h ago", "actionLabel": "View items"},
    {"id": "N005", "type": "info",    "title": "GST Filing Reminder",        "message": "GSTR-1 filing due in 3 days. Ensure all invoices are reconciled.", "time": "Yesterday", "actionLabel": "File now"},
]

@api_router.get("/notifications")
async def get_notifications():
    return NOTIFICATIONS_DATA


# ─── Reports Routes ────────────────────────────────────────────────────────────
REPORTS_SUMMARY = {
    "salesSummary": {
        "today": "₹92,000", "mtd": "₹1.27M", "ytd": "₹7.4M",
        "avgTicket": "₹14,350", "creditNotes": 3, "outstanding": "₹812K"
    },
    "ewayBills": {"generated": 265, "pending": 33, "errors": 9, "expiring": 12},
    "gst": {
        "igst": "₹1,82,000", "cgst": "₹90,000", "sgst": "₹90,000",
        "totalTaxCollected": "₹3,62,000"
    },
}

FINANCIAL_MONTHLY = {
    "months":   ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
    "revenue":  [450000, 520000, 480000, 610000, 580000, 640000, 720000, 680000, 750000, 820000, 790000, 950000],
    "expenses": [380000, 420000, 410000, 490000, 460000, 510000, 580000, 545000, 600000, 660000, 630000, 720000],
}

FINANCIAL_REPORT_DATA = {
    "profitLoss": {
        "revenue": "₹12,74,560",
        "expenses": "₹9,42,800",
        "netProfit": "₹3,31,760",
        "grossProfit": "₹4,68,000",
        "margin": 26.0,
    },
    "balanceSheet": {
        "totalAssets": "₹28,45,000",
        "totalLiabilities": "₹12,80,000",
        "equity": "₹15,65,000",
    },
    "trialBalance": {
        "totalDebit": "₹41,25,000",
        "totalCredit": "₹41,25,000",
        "balanced": True,
    },
}

@api_router.get("/reports")
async def get_reports():
    return REPORTS_SUMMARY

@api_router.get("/reports/financial")
async def get_financial_data():
    return FINANCIAL_MONTHLY

@api_router.get("/reports/financial-report")
async def get_financial_report(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
):
    return FINANCIAL_REPORT_DATA


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
