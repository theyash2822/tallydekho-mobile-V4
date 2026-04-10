#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  TallyDekho mobile app frontend in React Native (Expo). Full app skeleton with:
  - Auth flow (WhatsApp OTP)
  - Home Dashboard with KPI strip, metrics, cashflow, module navigation
  - Tabs: Home, Stocks, Ledger, Reports
  - Sales module: index hub, register, e-way bill, order, quotation, credit-note, delivery-note
  - Purchase module: index hub, register, order, debit-note
  - Vouchers module: index hub, payment, receipt, journal, contra
  - Settings module: index with all settings sections
  - QuickActions FAB modal with navigation to all sub-screens
  - Profile/Settings access from Header
  - Design system: pageBg #F5F4EF, white cards, #1A1A1A text

backend:
  - task: "NA - App is fully mocked frontend"
    implemented: false
    working: "NA"
    file: "N/A"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "No backend required - all data is mocked in frontend/src/data/mockData.ts"

frontend:
  - task: "Auth Screen (WhatsApp OTP Login)"
    implemented: true
    working: true
    file: "frontend/app/(auth)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Auth screen renders correctly with phone input and Send OTP button. Mock auth works."

  - task: "AsyncStorage web compatibility fix"
    implemented: true
    working: "NA"
    file: "frontend/src/context/AuthContext.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "AsyncStorage was hanging on web, keeping isLoading=true forever, causing blank screen. Fixed by adding localStorage fallback for web platform with 3s timeout."

  - task: "Home Dashboard with Modules section"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added MODULE_CARDS section (Sales, Purchase, Vouchers, Settings) with navigation. Removed dead showQuickActions state. Updated Header to use onSettingsPress."

  - task: "Header with Settings/Profile navigation"
    implemented: true
    working: "NA"
    file: "frontend/src/components/Header.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added onSettingsPress prop and handleSettings function. Changed menu icon to user avatar (A) that navigates to /settings."

  - task: "QuickActions FAB Modal with navigation"
    implemented: true
    working: "NA"
    file: "frontend/src/components/QuickActionsModal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Previously items pressed did nothing. Fixed by adding useRouter and router.push(item.route) on item press."

  - task: "Sales module screens (hub, register, ewaybill, order, quotation, credit-note, delivery-note)"
    implemented: true
    working: "NA"
    file: "frontend/app/sales/"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "All 7 Sales screens bulk-created. Needs visual verification."

  - task: "Purchase module screens (hub, register, order, debit-note)"
    implemented: true
    working: "NA"
    file: "frontend/app/purchase/"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "All 4 Purchase screens bulk-created. Needs visual verification."

  - task: "Vouchers module screens (hub, payment, receipt, journal, contra)"
    implemented: true
    working: "NA"
    file: "frontend/app/voucher/"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "All 5 Voucher screens bulk-created. Needs visual verification."

  - task: "Settings screen"
    implemented: true
    working: "NA"
    file: "frontend/app/settings/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Settings screen bulk-created with account, preferences, notifications, data sections."

  - task: "Tab navigation (Home, Stocks, Ledger, Reports)"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tabs layout unchanged from before but QuickActionsModal was updated. Needs verification."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "AsyncStorage web compatibility fix"
    - "Home Dashboard with Modules section"
    - "QuickActions FAB Modal with navigation"
    - "Sales module screens"
    - "Purchase module screens"
    - "Vouchers module screens"
    - "Settings screen"
  stuck_tasks:
    - "AsyncStorage web compatibility fix"
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      I've made the following changes that need testing:
      
      1. CRITICAL FIX: AsyncStorage was hanging on web - fixed in AuthContext.tsx with localStorage fallback
      2. QuickActionsModal - added useRouter so items navigate when pressed
      3. Header - added avatar button (A) that navigates to /settings
      4. Home screen - added MODULE_CARDS section (Sales, Purchase, Vouchers, Settings)
      5. RootNavigation - updated to handle all auth routing cases
      
      AUTH FLOW for testing:
      - Go to http://localhost:3000
      - Enter any 10-digit number (e.g. 9876543210)
      - Click Send OTP
      - On OTP screen, enter any 6 digits
      - Click Verify
      - If register screen appears, fill name and submit
      - This should navigate to the Home screen with tabs
      
      KEY THINGS TO VERIFY:
      1. Does the auth flow complete and navigate to Home screen?
      2. Does the Home screen show the Modules section (4 cards: Sales, Purchase, Vouchers, Settings)?
      3. Does clicking the FAB (+) open the Quick Actions modal?
      4. Does clicking items in the Quick Actions modal navigate to the correct screens?
      5. Do all Sales/Purchase/Voucher/Settings screens render without errors?
      6. Does the Header's avatar button navigate to Settings?
      
      KNOWN ISSUE: Screenshot tool shows blank screen after auth navigation - need testing agent to verify this.
      
      All screens use: pageBg #F5F4EF, white cards, #1A1A1A text
