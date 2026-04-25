"""
TallyDekho API endpoint tests - all critical endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


@pytest.fixture
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# --- Auth endpoints ---

class TestAuth:
    """Auth endpoints: send-otp, verify-otp, register"""

    def test_send_otp(self, client):
        resp = client.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": "9999999999"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert "message" in data
        print(f"PASS send-otp: {data}")

    def test_verify_otp(self, client):
        resp = client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9999999999", "otp": "123456"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert "token" in data
        assert "isNewUser" in data
        print(f"PASS verify-otp: {data}")

    def test_register(self, client):
        resp = client.post(f"{BASE_URL}/api/auth/register", json={
            "phone": "9999999999",
            "name": "Test User",
            "businessName": "Test Biz",
            "token": "mock_token_123",
            "language": "en"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        assert "token" in data
        assert "user" in data
        print(f"PASS register: {data}")


# --- Stocks ---

class TestStocks:
    def test_get_stocks(self, client):
        resp = client.get(f"{BASE_URL}/api/stocks")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "totalSKUs" in data
        assert "totalValue" in data
        assert "totalWarehouses" in data
        assert "lowStockCount" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        print(f"PASS stocks: totalSKUs={data['totalSKUs']}, items={len(data['items'])}")


# --- Ledgers ---

class TestLedgers:
    def test_get_ledgers(self, client):
        resp = client.get(f"{BASE_URL}/api/ledgers")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 12, f"Expected 12 ledger records, got {len(data)}"
        for item in data:
            assert "id" in item
            assert "name" in item
            assert "group" in item
            assert "balance" in item
        print(f"PASS ledgers: {len(data)} records")


# --- Reports ---

class TestReports:
    def test_get_reports(self, client):
        resp = client.get(f"{BASE_URL}/api/reports")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "salesSummary" in data
        assert "ewayBills" in data
        assert "gst" in data
        print(f"PASS reports: keys={list(data.keys())}")

    def test_get_reports_financial(self, client):
        resp = client.get(f"{BASE_URL}/api/reports/financial")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "months" in data
        assert "revenue" in data
        assert "expenses" in data
        assert len(data["months"]) == 12, f"Expected 12 months, got {len(data['months'])}"
        print(f"PASS reports/financial: {len(data['months'])} months")

    def test_get_reports_financial_report(self, client):
        resp = client.get(f"{BASE_URL}/api/reports/financial-report")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "profitLoss" in data
        assert "balanceSheet" in data
        assert "trialBalance" in data
        print(f"PASS reports/financial-report: keys={list(data.keys())}")


# --- Notifications ---

class TestNotifications:
    def test_get_notifications(self, client):
        resp = client.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert "type" in item
            assert "title" in item
            assert "message" in item
        print(f"PASS notifications: {len(data)} items")


# --- Existing dashboard endpoints ---

class TestDashboard:
    def test_kpi_strip(self, client):
        resp = client.get(f"{BASE_URL}/api/dashboard/kpi-strip?period=7D")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS dashboard/kpi-strip")

    def test_metrics(self, client):
        resp = client.get(f"{BASE_URL}/api/dashboard/metrics?period=7D")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS dashboard/metrics")

    def test_cashflow(self, client):
        resp = client.get(f"{BASE_URL}/api/dashboard/cashflow?period=7D")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS dashboard/cashflow")

    def test_recent_activity(self, client):
        resp = client.get(f"{BASE_URL}/api/dashboard/recent-activity")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS dashboard/recent-activity")


# --- KPI endpoints ---

class TestKPI:
    def test_kpi_payables(self, client):
        resp = client.get(f"{BASE_URL}/api/kpi/payables")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS kpi/payables")

    def test_kpi_receivables(self, client):
        resp = client.get(f"{BASE_URL}/api/kpi/receivables")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS kpi/receivables")


# --- Sales ---

class TestSales:
    def test_sales_invoices(self, client):
        resp = client.get(f"{BASE_URL}/api/sales/invoices")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS sales/invoices")
