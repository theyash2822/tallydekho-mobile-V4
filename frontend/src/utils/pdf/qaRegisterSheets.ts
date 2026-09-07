/**
 * Offline smoke for Day Book / Stock register HTML.
 * Run: npx tsx src/utils/pdf/qaRegisterSheets.ts
 */
import { renderDayBookHTML } from './dayBookSheet';
import { renderStockRegisterHTML } from './stockRegisterSheet';

const company = {
  name: 'Yash Ki Company',
  address: 'New Bus Stand\nRajgarh',
  state: 'Madhya Pradesh',
  email: 'accounts@example.com',
};

const day = renderDayBookHTML({
  company,
  title: 'Sales Register',
  period: 'For 3-Sep-26',
  rows: [
    { date: '3-Sep-26', particulars: 'Cash', vchType: 'Contra', vchNo: '4', creditOrOutwards: 5000 },
    { date: '3-Sep-26', particulars: 'Mahadev BGII', vchType: 'Physical Stock', vchNo: '1', debitOrInwards: '24,298 nos' },
  ],
});

const stock = renderStockRegisterHTML({
  company,
  title: 'Stock Ledger',
  period: '1-Sep-26 to 3-Sep-26',
  rows: [
    { date: '3-Sep-26', particulars: 'Mahadev BGII 450GR', vchType: 'Physical Stock', vchNo: '1', inwardsQty: '24,298 nos' },
  ],
});

let fail = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    fail += 1;
    console.log('FAIL', msg);
  }
}

assert(day.includes('Sales Register'), 'day title');
assert(day.includes('Debit Amount'), 'day debit header');
assert(day.includes('Inwards Qty'), 'day inwards');
assert(day.includes('Cash'), 'day row');
assert(stock.includes('Stock Ledger'), 'stock title');
assert(stock.includes('Outwards'), 'stock outwards');
assert(stock.includes('Mahadev'), 'stock row');

console.log(fail === 0 ? 'QA register sheets: PASS' : `QA register sheets: FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
