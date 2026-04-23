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
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹24,500",   "icon": "wallet-outline",         "trend": "+8.6%",  "positive": True},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹1,85,300", "icon": "card-outline",           "trend": "+4.5%",  "positive": True},
            {"id": "recv",     "label": "Receivables",   "amount": "₹67,200",   "icon": "arrow-down-circle-outline","trend": "-4.8%", "positive": False},
            {"id": "pay",      "label": "Payables",      "amount": "₹43,100",   "icon": "arrow-up-circle-outline", "trend": "+4.2%",  "positive": False},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",      "trend": "+2.0%",  "positive": False},
            {"id": "payments", "label": "Payments",      "amount": "₹38,500",   "icon": "send-outline",           "trend": "-10.9%", "positive": True},
            {"id": "receipts", "label": "Receipts",      "amount": "₹52,000",   "icon": "checkmark-circle-outline","trend": "+16.5%", "positive": True},
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
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹32,800",   "icon": "wallet-outline",          "trend": "+19.5%", "positive": True},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹2,45,600", "icon": "card-outline",            "trend": "+9.4%",  "positive": True},
            {"id": "recv",     "label": "Receivables",   "amount": "₹1,24,500", "icon": "arrow-down-circle-outline","trend": "+11.4%", "positive": True},
            {"id": "pay",      "label": "Payables",      "amount": "₹89,300",   "icon": "arrow-up-circle-outline",  "trend": "+9.6%",  "positive": False},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False},
            {"id": "payments", "label": "Payments",      "amount": "₹1,24,000", "icon": "send-outline",            "trend": "-10.0%", "positive": True},
            {"id": "receipts", "label": "Receipts",      "amount": "₹1,82,000", "icon": "checkmark-circle-outline","trend": "+13.5%", "positive": True},
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
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹45,200",   "icon": "wallet-outline",          "trend": "+28.3%", "positive": True},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹3,89,700", "icon": "card-outline",            "trend": "+17.5%", "positive": True},
            {"id": "recv",     "label": "Receivables",   "amount": "₹2,87,600", "icon": "arrow-down-circle-outline","trend": "+14.6%", "positive": True},
            {"id": "pay",      "label": "Payables",      "amount": "₹1,98,400", "icon": "arrow-up-circle-outline",  "trend": "+12.3%", "positive": False},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False},
            {"id": "payments", "label": "Payments",      "amount": "₹3,45,000", "icon": "send-outline",            "trend": "-9.3%",  "positive": True},
            {"id": "receipts", "label": "Receipts",      "amount": "₹4,12,000", "icon": "checkmark-circle-outline","trend": "+13.8%", "positive": True},
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
            {"id": "cash",     "label": "Cash In Hand", "amount": "₹67,800",   "icon": "wallet-outline",          "trend": "+41.9%", "positive": True},
            {"id": "bank",     "label": "Bank Balance",  "amount": "₹5,12,300", "icon": "card-outline",            "trend": "+28.4%", "positive": True},
            {"id": "recv",     "label": "Receivables",   "amount": "₹4,45,200", "icon": "arrow-down-circle-outline","trend": "+20.1%", "positive": True},
            {"id": "pay",      "label": "Payables",      "amount": "₹3,12,600", "icon": "arrow-up-circle-outline",  "trend": "+17.3%", "positive": False},
            {"id": "loans",    "label": "Loans & OD",    "amount": "₹2,50,000", "icon": "briefcase-outline",       "trend": "+2.0%",  "positive": False},
            {"id": "payments", "label": "Payments",      "amount": "₹6,78,000", "icon": "send-outline",            "trend": "-10.0%", "positive": True},
            {"id": "receipts", "label": "Receipts",      "amount": "₹7,24,000", "icon": "checkmark-circle-outline","trend": "+13.0%", "positive": True},
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
