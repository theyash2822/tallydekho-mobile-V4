"""
Comprehensive TallyDekho Frontend Test Script
Tests all 30+ screens and key features
"""

import asyncio
from playwright.async_api import async_playwright

BASE_URL = "https://dekho-frontend-build.preview.emergentagent.com"

results = {}

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 375, "height": 667})
        page = await context.new_page()
        
        page.on("console", lambda msg: print(f"CONSOLE [{msg.type}]: {msg.text}") if msg.type == "error" else None)
        
        # ===== AUTH FLOW =====
        print("\n=== AUTH FLOW ===")
        await page.goto(BASE_URL)
        await page.wait_for_timeout(2000)
        
        # Phone entry
        phone_input = await page.query_selector('input')
        await phone_input.fill("9876543210")
        await page.get_by_text("Send OTP").click(force=True)
        await page.wait_for_timeout(2000)
        
        # OTP
        await page.mouse.click(70, 405)
        await page.wait_for_timeout(300)
        for d in ["1","2","3","4"]:
            await page.keyboard.press(d)
            await page.wait_for_timeout(150)
        await page.get_by_text("Continue").click(force=True)
        await page.wait_for_timeout(2000)
        
        if "register" in page.url:
            # Fill registration
            name_input = await page.query_selector('input[placeholder*="full name"]')
            if name_input:
                await name_input.fill("Test User")
            email_input = await page.query_selector('input[placeholder*="example"]')
            if email_input:
                await email_input.fill("test@example.com")
            await page.mouse.click(52, 519)
            await page.wait_for_timeout(300)
            await page.get_by_text("Login").click(force=True)
            await page.wait_for_timeout(2000)
        
        if "tally-sync" in page.url:
            await page.get_by_text("Skip").click(force=True)
            await page.wait_for_timeout(2000)
        
        home_body = await page.evaluate("() => document.body.innerText.substring(0, 200)")
        results["auth_flow"] = "PASS" if "Cash In Hand" in home_body or "Sales" in home_body else f"FAIL - got: {home_body[:100]}"
        print(f"Auth: {results['auth_flow']}")
        
        # ===== HOME SCREEN =====
        print("\n=== HOME SCREEN ===")
        results["home_kpi_carousel"] = "PASS" if "Cash In Hand" in home_body else "FAIL"
        print(f"Home KPI Carousel: {results['home_kpi_carousel']}")
        
        # ===== TABS =====
        print("\n=== TABS ===")
        
        # Ledger Tab
        try:
            await page.get_by_text("Ledger", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            ledger_body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
            results["ledger_tab"] = "PASS" if "Ledger" in ledger_body or "ledger" in ledger_body.lower() else f"FAIL: {ledger_body[:100]}"
            print(f"Ledger tab: {results['ledger_tab']}")
            await page.screenshot(path="/tmp/tab_ledger.png", quality=40, full_page=False)
        except Exception as e:
            results["ledger_tab"] = f"FAIL: {e}"
            print(f"Ledger tab: FAIL - {e}")
        
        # Stocks Tab
        try:
            await page.get_by_text("Stocks", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            stocks_body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
            results["stocks_tab"] = "PASS" if "Stock" in stocks_body else f"FAIL: {stocks_body[:100]}"
            print(f"Stocks tab: {results['stocks_tab']}")
        except Exception as e:
            results["stocks_tab"] = f"FAIL: {e}"
            print(f"Stocks tab: FAIL - {e}")
        
        # Reports Tab
        try:
            await page.get_by_text("Reports", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            reports_body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
            results["reports_tab"] = "PASS" if "Report" in reports_body or "report" in reports_body.lower() else f"FAIL: {reports_body[:100]}"
            print(f"Reports tab: {results['reports_tab']}")
        except Exception as e:
            results["reports_tab"] = f"FAIL: {e}"
            print(f"Reports tab: FAIL - {e}")
        
        # Home Tab
        try:
            await page.get_by_text("Home", exact=True).click(force=True)
            await page.wait_for_timeout(1500)
            results["home_tab"] = "PASS"
            print(f"Home tab: PASS")
        except Exception as e:
            results["home_tab"] = f"FAIL: {e}"
        
        # ===== FAB / QUICK ACTIONS =====
        print("\n=== FAB QUICK ACTIONS ===")
        try:
            # FAB is the center button in tab bar
            fab = await page.query_selector('[data-testid="fab-button"]')
            if not fab:
                # Try to find by class or position - click the + icon in tab bar
                await page.mouse.click(187, 635)
            else:
                await fab.click(force=True)
            await page.wait_for_timeout(1500)
            fab_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            # Quick actions should show items like Sale, Purchase, etc.
            has_quick_actions = any(x in fab_body for x in ["Sale", "Invoice", "Receipt", "Payment", "Voucher", "New"])
            results["fab_quick_actions"] = "PASS" if has_quick_actions else f"Partial - got: {fab_body[:150]}"
            print(f"FAB: {results['fab_quick_actions']}")
            await page.screenshot(path="/tmp/fab_modal.png", quality=40, full_page=False)
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)
        except Exception as e:
            results["fab_quick_actions"] = f"FAIL: {e}"
            print(f"FAB: FAIL - {e}")
        
        # ===== LEDGER TAB - + BUTTON (CreateLedgerModal) =====
        print("\n=== LEDGER CREATE MODAL ===")
        try:
            await page.get_by_text("Ledger", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            
            # Find + button in ledger tab
            plus_btn = await page.query_selector('[data-testid="create-ledger-btn"]')
            if not plus_btn:
                # Try finding by text or icon
                plus_buttons = await page.query_selector_all('text=+')
                print(f"Plus buttons found: {len(plus_buttons)}")
                if plus_buttons:
                    await plus_buttons[0].click(force=True)
                else:
                    await page.screenshot(path="/tmp/ledger_no_plus.png", quality=40, full_page=False)
            else:
                await plus_btn.click(force=True)
            
            await page.wait_for_timeout(1500)
            modal_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            has_modal = any(x in modal_body for x in ["Create Ledger", "Ledger Name", "Group", "Nature"])
            results["ledger_create_modal"] = "PASS" if has_modal else f"No modal - got: {modal_body[:150]}"
            print(f"CreateLedgerModal: {results['ledger_create_modal']}")
            await page.screenshot(path="/tmp/ledger_create_modal.png", quality=40, full_page=False)
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(500)
        except Exception as e:
            results["ledger_create_modal"] = f"FAIL: {e}"
            print(f"CreateLedgerModal: FAIL - {e}")
        
        # ===== LEDGER FILTER =====
        print("\n=== LEDGER FILTER ===")
        try:
            # Should still be on ledger tab
            filter_btn = await page.query_selector('[data-testid="filter-btn"]')
            if not filter_btn:
                filter_btn = await page.get_by_text("Filter")
            if filter_btn:
                await filter_btn.click(force=True)
                await page.wait_for_timeout(1500)
                filter_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
                has_filter = any(x in filter_body for x in ["Nature", "Group", "Filter"])
                results["ledger_filter"] = "PASS" if has_filter else f"No filter - got: {filter_body[:150]}"
                print(f"Ledger Filter: {results['ledger_filter']}")
                await page.screenshot(path="/tmp/ledger_filter.png", quality=40, full_page=False)
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(500)
            else:
                results["ledger_filter"] = "FAIL: Filter button not found"
                print(f"Ledger Filter: FAIL - button not found")
        except Exception as e:
            results["ledger_filter"] = f"FAIL: {e}"
            print(f"Ledger Filter: FAIL - {e}")
        
        # ===== LEDGER DETAIL =====
        print("\n=== LEDGER DETAIL ===")
        try:
            await page.wait_for_timeout(500)
            # Click first ledger item
            ledger_items = await page.query_selector_all('[data-testid*="ledger-item"]')
            if not ledger_items:
                # Try clicking on any ledger name in the list
                await page.wait_for_timeout(500)
                body_items = await page.evaluate("() => document.body.innerText")
                print(f"Ledger body: {body_items[:300]}")
            if ledger_items:
                await ledger_items[0].click(force=True)
            else:
                # Try clicking first item in the list by coordinates
                await page.mouse.click(187, 200)
            await page.wait_for_timeout(2000)
            detail_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            has_detail = any(x in detail_body for x in ["Transaction", "Balance", "Opening", "Closing"])
            results["ledger_detail"] = "PASS" if has_detail else f"Unknown - got: {detail_body[:150]}"
            print(f"Ledger Detail: {results['ledger_detail']}")
            await page.screenshot(path="/tmp/ledger_detail.png", quality=40, full_page=False)
            
            # Test ℹ button for LedgerInfoModal
            info_btn = await page.query_selector('[data-testid="ledger-info-btn"]')
            if not info_btn:
                info_btn = await page.query_selector('text=ℹ')
            if info_btn:
                await info_btn.click(force=True)
                await page.wait_for_timeout(1000)
                info_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
                has_info = any(x in info_body for x in ["Info", "Group", "Opening Balance"])
                results["ledger_info_modal"] = "PASS" if has_info else f"No modal - got: {info_body[:150]}"
                print(f"LedgerInfoModal: {results['ledger_info_modal']}")
                await page.screenshot(path="/tmp/ledger_info_modal.png", quality=40, full_page=False)
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(500)
            else:
                results["ledger_info_modal"] = "INFO button not found"
                print("LedgerInfoModal: INFO button not found")
        except Exception as e:
            results["ledger_detail"] = f"FAIL: {e}"
            print(f"Ledger Detail: FAIL - {e}")
        
        # ===== STOCKS TOTAL STOCK FILTER =====
        print("\n=== STOCKS FILTER ===")
        try:
            await page.get_by_text("Stocks", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            stocks_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            print(f"Stocks body: {stocks_body[:200]}")
            await page.screenshot(path="/tmp/stocks_tab.png", quality=40, full_page=False)
            
            # Find Total Stock link
            total_stock = await page.query_selector('text=Total Stock')
            if total_stock:
                await total_stock.click(force=True)
                await page.wait_for_timeout(2000)
                # Find Filter button
                filter_btn = await page.get_by_text("Filter")
                if filter_btn:
                    await filter_btn.click(force=True)
                    await page.wait_for_timeout(1500)
                    filter_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
                    has_filter = any(x in filter_body for x in ["Warehouse", "Category", "Group", "Filter"])
                    results["stocks_filter"] = "PASS" if has_filter else f"No filter - got: {filter_body[:150]}"
                    print(f"Stocks Filter: {results['stocks_filter']}")
                    await page.screenshot(path="/tmp/stocks_filter.png", quality=40, full_page=False)
                    await page.keyboard.press("Escape")
                    await page.wait_for_timeout(500)
                else:
                    results["stocks_filter"] = "Filter button not found"
            else:
                results["stocks_filter"] = "Total Stock link not found"
                print(f"Stocks Filter: {results['stocks_filter']}")
        except Exception as e:
            results["stocks_filter"] = f"FAIL: {e}"
            print(f"Stocks Filter: FAIL - {e}")
        
        # ===== REPORTS → AUDIT TRAIL =====
        print("\n=== REPORTS AUDIT TRAIL ===")
        try:
            await page.get_by_text("Reports", exact=True).click(force=True)
            await page.wait_for_timeout(2000)
            await page.screenshot(path="/tmp/reports_tab.png", quality=40, full_page=False)
            
            audit_link = await page.query_selector('text=Audit Trail')
            if audit_link:
                await audit_link.click(force=True)
                await page.wait_for_timeout(2000)
                audit_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
                results["audit_trail"] = "PASS" if "Audit" in audit_body else f"FAIL: {audit_body[:150]}"
                print(f"Audit Trail: {results['audit_trail']}")
                await page.screenshot(path="/tmp/audit_trail.png", quality=40, full_page=False)
                await page.go_back()
                await page.wait_for_timeout(1000)
            else:
                results["audit_trail"] = "Audit Trail link not found"
                print(f"Audit Trail: Not found in reports")
        except Exception as e:
            results["audit_trail"] = f"FAIL: {e}"
            print(f"Audit Trail: FAIL - {e}")
        
        # ===== SETTINGS =====
        print("\n=== SETTINGS ===")
        try:
            await page.get_by_text("Home", exact=True).click(force=True)
            await page.wait_for_timeout(1000)
            # Click the user avatar in top-right
            avatar = await page.query_selector('[data-testid="user-avatar"]')
            if not avatar:
                # Try clicking at top-right
                await page.mouse.click(342, 28)
            else:
                await avatar.click(force=True)
            await page.wait_for_timeout(2000)
            settings_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            has_settings = any(x in settings_body for x in ["Settings", "Profile", "Preferences"])
            results["settings_screen"] = "PASS" if has_settings else f"FAIL: {settings_body[:150]}"
            print(f"Settings: {results['settings_screen']}")
            await page.screenshot(path="/tmp/settings.png", quality=40, full_page=False)
        except Exception as e:
            results["settings_screen"] = f"FAIL: {e}"
            print(f"Settings: FAIL - {e}")
        
        # ===== SETTINGS → PREFERENCES → HOME SCREEN SECTION =====
        print("\n=== SETTINGS PREFERENCES ===")
        try:
            # Navigate to preferences
            prefs = await page.query_selector('text=Preferences')
            if prefs:
                await prefs.click(force=True)
                await page.wait_for_timeout(2000)
                prefs_body = await page.evaluate("() => document.body.innerText.substring(0, 600)")
                print(f"Prefs body: {prefs_body[:300]}")
                
                # Scroll to bottom to find Home Screen section
                await page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1000)
                prefs_body2 = await page.evaluate("() => document.body.innerText")
                has_home_section = "Home Screen" in prefs_body2 or "Auto-Scroll" in prefs_body2
                results["preferences_home_section"] = "PASS" if has_home_section else f"Not found - got: {prefs_body2[-300:]}"
                print(f"Preferences Home Section: {results['preferences_home_section']}")
                await page.screenshot(path="/tmp/prefs_bottom.png", quality=40, full_page=False)
                await page.go_back()
                await page.wait_for_timeout(1000)
            else:
                # Try navigating directly
                await page.goto(f"{BASE_URL}/settings/preferences")
                await page.wait_for_timeout(2000)
                prefs_body = await page.evaluate("() => document.body.innerText")
                has_home_section = "Home Screen" in prefs_body or "Auto-Scroll" in prefs_body
                results["preferences_home_section"] = "PASS" if has_home_section else f"Not found"
                print(f"Preferences Home Section: {results['preferences_home_section']}")
        except Exception as e:
            results["preferences_home_section"] = f"FAIL: {e}"
            print(f"Preferences: FAIL - {e}")
        
        # ===== SETTINGS → TALLY SYNC =====
        print("\n=== SETTINGS TALLY SYNC ===")
        try:
            await page.goto(f"{BASE_URL}/settings/tally-sync")
            await page.wait_for_timeout(2000)
            tally_body = await page.evaluate("() => document.body.innerText.substring(0, 400)")
            has_tally = any(x in tally_body for x in ["Tally", "TallyPrime", "Sync", "Connect"])
            results["settings_tally_sync"] = "PASS" if has_tally else f"FAIL: {tally_body[:150]}"
            print(f"Tally Sync: {results['settings_tally_sync']}")
            await page.screenshot(path="/tmp/tally_sync.png", quality=40, full_page=False)
        except Exception as e:
            results["settings_tally_sync"] = f"FAIL: {e}"
            print(f"Tally Sync: FAIL - {e}")
        
        # ===== VOUCHERS =====
        print("\n=== VOUCHERS ===")
        for voucher in ["payment", "receipt", "journal", "contra"]:
            try:
                await page.goto(f"{BASE_URL}/vouchers/{voucher}")
                await page.wait_for_timeout(2000)
                v_body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
                has_voucher = any(x in v_body.lower() for x in [voucher, "voucher", "amount", "party"])
                results[f"voucher_{voucher}"] = "PASS" if has_voucher else f"FAIL: {v_body[:100]}"
                print(f"Voucher {voucher}: {results[f'voucher_{voucher}']}")
            except Exception as e:
                results[f"voucher_{voucher}"] = f"FAIL: {e}"
                print(f"Voucher {voucher}: FAIL - {e}")
        
        # ===== SALES MODULE =====
        print("\n=== SALES MODULE ===")
        for route in ["sales", "sales/register", "sales/create-invoice"]:
            try:
                await page.goto(f"{BASE_URL}/{route}")
                await page.wait_for_timeout(2000)
                body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
                has_content = len(body.strip()) > 20 and "Send OTP" not in body
                results[f"route_{route.replace('/', '_')}"] = "PASS" if has_content else f"FAIL/redirect: {body[:80]}"
                key = f"route_{route.replace('/', '_')}"
                print(f"Route /{route}: {results[key]}")
            except Exception as e:
                results[f"route_{route.replace('/', '_')}"] = f"FAIL: {e}"
        
        # ===== PURCHASES MODULE =====
        print("\n=== PURCHASES MODULE ===")
        for route in ["purchases", "purchases/register", "purchases/create-invoice"]:
            try:
                await page.goto(f"{BASE_URL}/{route}")
                await page.wait_for_timeout(2000)
                body = await page.evaluate("() => document.body.innerText.substring(0, 300)")
                has_content = len(body.strip()) > 20 and "Send OTP" not in body
                results[f"route_{route.replace('/', '_')}"] = "PASS" if has_content else f"FAIL/redirect: {body[:80]}"
                key = f"route_{route.replace('/', '_')}"
                print(f"Route /{route}: {results[key]}")
            except Exception as e:
                results[f"route_{route.replace('/', '_')}"] = f"FAIL: {e}"
        
        # ===== FINAL SUMMARY =====
        print("\n=== RESULTS SUMMARY ===")
        passed = sum(1 for v in results.values() if v == "PASS")
        total = len(results)
        print(f"Passed: {passed}/{total}")
        for k, v in results.items():
            status = "✅" if v == "PASS" else "⚠️" if "Partial" in str(v) or "not found" in str(v).lower() else "❌"
            print(f"{status} {k}: {v}")
        
        await browser.close()
        return results

asyncio.run(run_tests())
