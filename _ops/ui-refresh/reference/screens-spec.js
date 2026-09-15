/* Screen data for "Jayhind ERP — All Screens". Route keys mirror navigation.config.ts. */
(function () {
  var S = {};
  var list = function (title, sub, cols, rows, opts) {
    var o = opts || {};
    o.kind = 'list'; o.title = title; o.sub = sub; o.cols = cols; o.rows = rows;
    return o;
  };
  var master = function (title, sub, cols, rows) {
    return list(title, sub, cols, rows, {
      views: [['All', ''], ['Active', ''], ['Archived', '']],
      filters: [['Add filter', 'add']],
      actions: [['Add', 'add', 1], ['Import', 'upload', 0]],
    });
  };

  /* ───────── Home ───────── */
  S['dashboard'] = {
    kind: 'dash', title: 'Business overview', sub: 'Monday, 17 August 2026',
    kpis: [
      { label: 'Cash & bank', icon: 'account_balance', value: '₹48,26,400', hint: '4 accounts', iconStyle: 'color:var(--primary);' },
      { label: 'Receivable', icon: 'call_received', value: '₹31,84,250', hint: '₹8.4L overdue', iconStyle: 'color:var(--success);' },
      { label: 'Payable', icon: 'call_made', value: '₹19,72,800', hint: '₹2.1L due this week', iconStyle: 'color:var(--warning);' },
      { label: 'Net profit MTD', icon: 'paid', value: '₹8,42,300', hint: '+12.4% vs July', iconStyle: 'color:var(--success);' },
      { label: 'Stock value', icon: 'inventory_2', value: '₹64,10,900', hint: '12 below reorder', iconStyle: 'color:var(--info);' },
      { label: 'GST liability', icon: 'summarize', value: '₹3,19,450', hint: 'GSTR-3B due 20 Aug', iconStyle: 'color:var(--warning);', valueStyle: 'color:var(--warning);' },
    ],
    queue: [
      { icon: 'fact_check', title: 'Purchase bill PB-0312 · Mahavir Steel', meta: 'Above your ₹2L limit · waiting 2 days', amount: '₹2,84,600', action: 'Approve', tone: 'warning' },
      { icon: 'event_busy', title: 'Patel Auto Components · INV-2526-0147', meta: 'Payment overdue by 6 days', amount: '₹1,38,400', action: 'Remind', tone: 'error' },
      { icon: 'summarize', title: 'GSTR-3B for July', meta: 'Due 20 Aug · 3 invoices unmatched', amount: '₹3,19,450', action: 'Review', tone: 'info' },
      { icon: 'inventory', title: '12 products below reorder level', meta: 'Est. 4 days cover on MS Flange 6"', amount: '12 SKUs', action: 'Plan', tone: 'primary' },
      { icon: 'document_scanner', title: '5 scanned invoices ready to post', meta: 'OCR confidence above 95%', amount: '₹96,200', action: 'Post', tone: 'success' },
    ],
    panelTitle: 'Cash position',
    bars: [
      { name: 'HDFC · Current', value: '₹28,41,000', barStyle: 'width:59%;' },
      { name: 'ICICI · OD', value: '₹12,40,400', barStyle: 'width:26%;' },
      { name: 'Cash in hand', value: '₹4,86,000', barStyle: 'width:10%;' },
      { name: 'UPI wallet', value: '₹2,59,000', barStyle: 'width:5%;' },
    ],
    chartTitle: 'Sales vs purchases',
  };
  S['approvals'] = list('Pending approvals', 'Everything waiting on a decision', ['Voucher', 'Party', 'Raised by', 'Waiting', 'Type', '>Amount', 'Status'], [
    ['!PB-0312', 'Mahavir Steel Traders', 'Meera S.', '2 days', 'Purchase bill', '$₹2,84,600', '@warn:Awaiting you'],
    ['!SO-0188', 'Rajkot Tools & Dies', 'Nikita R.', '1 day', 'Sales order', '$₹7,34,120', '@warn:Awaiting you'],
    ['!PO-0421', 'Girnar Castings', 'Harsh P.', '4 hours', 'Purchase order', '$₹1,12,000', '@info:With finance'],
    ['!JV-0077', '—', 'Meera S.', '3 days', 'Journal', '$₹42,000', '@warn:Awaiting you'],
    ['!CN-0031', 'Yash Fabricators', 'Nikita R.', '6 hours', 'Credit note', '$₹18,900', '@info:With finance'],
  ], { views: [['Awaiting me', 14], ['All pending', 23], ['Approved today', 9]], actions: [['Approve selected', 'check', 1], ['Reject', 'close', 0]] });
  S['dues'] = list('Dues', 'Money owed to and by you, by date', ['Party', 'Voucher', 'Due date', 'Overdue by', 'Direction', '>Amount', 'Status'], [
    ['Patel Auto Components', 'INV-2526-0147', '11-08-2026', '6 days', 'Receivable', '$₹1,38,400', '@bad:Overdue'],
    ['Kiran Metal Works', 'INV-2526-0146', '22-08-2026', '—', 'Receivable', '$₹96,750', '@ok:On time'],
    ['Mahavir Steel Traders', 'PB-0298', '19-08-2026', '—', 'Payable', '$₹2,10,000', '@warn:Due soon'],
    ['Yash Fabricators', 'INV-2526-0145', '26-08-2026', '—', 'Receivable', '$₹58,900', '@ok:On time'],
    ['Girnar Castings', 'PB-0301', '09-08-2026', '8 days', 'Payable', '$₹74,300', '@bad:Overdue'],
  ], { summary: [['Receivable due', '₹31,84,250'], ['Overdue', '₹8,42,100', 'error'], ['Payable due', '₹19,72,800'], ['Next 7 days', '₹6,18,400', 'warning']] });

  /* ───────── Transaction ───────── */
  S['transaction/dashboard'] = S['dashboard'];
  var voucherCols = ['Voucher no', 'Party', 'Date', 'Status', '>Amount', '>Balance', 'e-Invoice', 'e-Way Bill'];
  var mkVoucher = function (title, sub, prefix, rows, opts) {
    var o = opts || {};
    o.summary = o.summary || [['Vouchers', '143'], ['Total', '₹84,21,340'], ['Paid', '₹52,37,100', 'success'], ['Outstanding', '₹31,84,240', 'warning']];
    o.views = o.views || [['All', 143], ['Unpaid', 38], ['Awaiting approval', 14], ['Drafts', 9]];
    o.actions = o.actions || [['New ' + title.toLowerCase(), 'add', 1], ['Export', 'download', 0], ['Configure', 'settings', 0]];
    return list(title, sub, voucherCols, rows, o);
  };
  S['sales'] = mkVoucher('Sales', 'Customer invoices · F8', 'INV', [
    ['!INV-2526-0148', 'Shree Balaji Engineering', '~14 Aug', '@ok:Approved', '$₹4,12,500', '#—', '@ok:Registered', '@ok:Generated'],
    ['!INV-2526-0147', 'Patel Auto Components', '~13 Aug', '@ok:Approved', '$₹2,68,400', '#₹1,38,400', '@ok:Registered', '@ok:Generated'],
    ['!INV-2526-0146', 'Kiran Metal Works', '~13 Aug', '@warn:Pending', '$₹96,750', '#₹96,750', '@mute:—', '@mute:—'],
    ['!INV-2526-0145', 'Yash Fabricators', '~12 Aug', '@ok:Approved', '$₹58,900', '#₹58,900', '@ok:Registered', '@warn:Pending'],
    ['!INV-2526-0144', 'Rajkot Tools & Dies', '~11 Aug', '@ok:Approved', '$₹7,34,120', '#₹2,34,120', '@ok:Registered', '@ok:Generated'],
    ['!INV-2526-0143', 'Anand Precision Pvt Ltd', '~10 Aug', '@mute:Draft', '$₹1,41,000', '#₹1,41,000', '@mute:—', '@mute:—'],
    ['!INV-2526-0142', 'Suryodaya Steels', '~09 Aug', '@ok:Approved', '$₹3,22,600', '#—', '@ok:Registered', '@bad:Cancelled'],
    ['!INV-2526-0141', 'Neelkanth Enterprise', '~08 Aug', '@bad:Rejected', '$₹47,250', '#₹47,250', '@mute:—', '@mute:—'],
  ]);
  S['purchase'] = mkVoucher('Purchase', 'Vendor bills · F9', 'PB', [
    ['!PB-0312', 'Mahavir Steel Traders', '~14 Aug', '@warn:Pending', '$₹2,84,600', '#₹2,84,600', '@ok:Matched', '@mute:—'],
    ['!PB-0311', 'Girnar Castings', '~12 Aug', '@ok:Approved', '$₹1,12,000', '#₹74,300', '@ok:Matched', '@mute:—'],
    ['!PB-0310', 'Sanghavi Alloys', '~11 Aug', '@ok:Approved', '$₹3,96,200', '#—', '@warn:Unmatched', '@mute:—'],
    ['!PB-0309', 'Rathi Bearings', '~09 Aug', '@ok:Approved', '$₹68,400', '#—', '@ok:Matched', '@mute:—'],
    ['!PB-0308', 'Tejas Hardware', '~08 Aug', '@mute:Draft', '$₹22,150', '#₹22,150', '@mute:—', '@mute:—'],
  ], { actions: [['New purchase', 'add', 1], ['Scan invoice', 'document_scanner', 0], ['Export', 'download', 0]] });
  S['quotation'] = mkVoucher('Quotation', 'Price quotes sent to customers', 'QT', [
    ['!QT-0219', 'Rajkot Tools & Dies', '~14 Aug', '@info:Sent', '$₹8,12,000', '#—', '@mute:—', '@mute:—'],
    ['!QT-0218', 'Shree Balaji Engineering', '~13 Aug', '@ok:Accepted', '$₹2,44,000', '#—', '@mute:—', '@mute:—'],
    ['!QT-0217', 'Neelkanth Enterprise', '~11 Aug', '@bad:Lost', '$₹1,08,600', '#—', '@mute:—', '@mute:—'],
    ['!QT-0216', 'Anand Precision Pvt Ltd', '~09 Aug', '@info:Sent', '$₹4,72,300', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 62], ['Open', 18], ['Accepted', 31], ['Lost', 13]] });
  S['sales-order'] = mkVoucher('Sales Order', 'Confirmed customer orders awaiting delivery', 'SO', [
    ['!SO-0188', 'Rajkot Tools & Dies', '~14 Aug', '@warn:Pending', '$₹7,34,120', '#₹7,34,120', '@mute:—', '@mute:—'],
    ['!SO-0187', 'Patel Auto Components', '~13 Aug', '@ok:Approved', '$₹2,68,400', '#₹1,30,000', '@mute:—', '@mute:—'],
    ['!SO-0186', 'Kiran Metal Works', '~12 Aug', '@info:Part delivered', '$₹96,750', '#₹48,000', '@mute:—', '@mute:—'],
    ['!SO-0185', 'Suryodaya Steels', '~10 Aug', '@ok:Delivered', '$₹3,22,600', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 74], ['Open', 22], ['Part delivered', 9], ['Closed', 43]] });
  S['delivery-challan'] = mkVoucher('Delivery Challan', 'Goods dispatched to customers', 'DC', [
    ['!DC-0402', 'Shree Balaji Engineering', '~14 Aug', '@ok:Dispatched', '$₹4,12,500', '#—', '@mute:—', '@ok:Generated'],
    ['!DC-0401', 'Rajkot Tools & Dies', '~13 Aug', '@ok:Delivered', '$₹5,00,000', '#—', '@mute:—', '@ok:Generated'],
    ['!DC-0400', 'Yash Fabricators', '~12 Aug', '@warn:In transit', '$₹58,900', '#—', '@mute:—', '@warn:Pending'],
  ], { views: [['All', 51], ['In transit', 6], ['Delivered', 45]] });
  S['credit-note'] = mkVoucher('Credit Note', 'Sales returns and rate corrections', 'CN', [
    ['!CN-0031', 'Yash Fabricators', '~13 Aug', '@warn:Pending', '$₹18,900', '#₹18,900', '@mute:—', '@mute:—'],
    ['!CN-0030', 'Patel Auto Components', '~10 Aug', '@ok:Approved', '$₹9,400', '#—', '@ok:Registered', '@mute:—'],
    ['!CN-0029', 'Kiran Metal Works', '~06 Aug', '@ok:Approved', '$₹32,100', '#—', '@ok:Registered', '@mute:—'],
  ], { views: [['All', 31], ['Pending', 4], ['Approved', 27]] });
  S['purchase-requisition'] = mkVoucher('Purchase Requisition', 'Internal requests to buy', 'PR', [
    ['!PR-0122', '~Production', '~14 Aug', '@warn:Pending', '$₹1,42,000', '#—', '@mute:—', '@mute:—'],
    ['!PR-0121', '~Maintenance', '~13 Aug', '@ok:Approved', '$₹28,600', '#—', '@mute:—', '@mute:—'],
    ['!PR-0120', '~Stores', '~11 Aug', '@ok:Converted to PO', '$₹96,400', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 48], ['Pending', 7], ['Converted', 38]] });
  S['purchase-order'] = mkVoucher('Purchase Order', 'Orders placed with vendors', 'PO', [
    ['!PO-0421', 'Girnar Castings', '~14 Aug', '@warn:Pending', '$₹1,12,000', '#₹1,12,000', '@mute:—', '@mute:—'],
    ['!PO-0420', 'Mahavir Steel Traders', '~12 Aug', '@ok:Approved', '$₹2,84,600', '#₹2,84,600', '@mute:—', '@mute:—'],
    ['!PO-0419', 'Sanghavi Alloys', '~10 Aug', '@info:Part received', '$₹3,96,200', '#₹1,20,000', '@mute:—', '@mute:—'],
    ['!PO-0418', 'Rathi Bearings', '~08 Aug', '@ok:Closed', '$₹68,400', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 96], ['Open', 12], ['Part received', 4], ['Closed', 80]] });
  S['goods-receipt'] = mkVoucher('Goods Receipt', 'Material received against purchase orders', 'GRN', [
    ['!GRN-0288', 'Mahavir Steel Traders', '~14 Aug', '@ok:Accepted', '$₹2,84,600', '#—', '@mute:—', '@mute:—'],
    ['!GRN-0287', 'Sanghavi Alloys', '~12 Aug', '@warn:Short received', '$₹1,20,000', '#₹2,76,200', '@mute:—', '@mute:—'],
    ['!GRN-0286', 'Rathi Bearings', '~09 Aug', '@ok:Accepted', '$₹68,400', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 88], ['Short', 5], ['Accepted', 83]] });
  S['debit-note'] = mkVoucher('Debit Note', 'Purchase returns to vendors', 'DN', [
    ['!DN-0018', 'Sanghavi Alloys', '~12 Aug', '@warn:Pending', '$₹41,200', '#₹41,200', '@mute:—', '@mute:—'],
    ['!DN-0017', 'Tejas Hardware', '~07 Aug', '@ok:Approved', '$₹6,850', '#—', '@mute:—', '@mute:—'],
  ], { views: [['All', 18], ['Pending', 2], ['Approved', 16]] });

  var moneyCols = ['Voucher no', 'Party / account', 'Date', 'Mode', 'Reference', '>Amount', 'Status'];
  S['payment'] = list('Payment', 'Money paid out · F5', moneyCols, [
    ['!PAY-0233', 'Mahavir Steel Traders', '~14 Aug', 'NEFT', 'HDFC ****4412', '$₹2,10,000', '@ok:Cleared'],
    ['!PAY-0232', 'Girnar Castings', '~13 Aug', 'RTGS', 'HDFC ****4412', '$₹74,300', '@ok:Cleared'],
    ['!PAY-0231', 'Tejas Hardware', '~12 Aug', 'Cash', 'Cash in hand', '$₹22,150', '@ok:Cleared'],
    ['!PAY-0230', 'Rathi Bearings', '~11 Aug', 'Cheque', 'CHQ 448120', '$₹68,400', '@warn:In clearing'],
  ], { summary: [['Payments', '233'], ['This month', '₹18,42,600'], ['In clearing', '₹68,400', 'warning']], views: [['All', 233], ['This month', 24], ['In clearing', 3]], actions: [['New payment', 'add', 1], ['Export', 'download', 0]] });
  S['receipt'] = list('Receipt', 'Money received · F6', moneyCols, [
    ['!RCP-0519', 'Shree Balaji Engineering', '~14 Aug', 'NEFT', 'HDFC ****4412', '$₹4,12,500', '@ok:Cleared'],
    ['!RCP-0518', 'Rajkot Tools & Dies', '~13 Aug', 'RTGS', 'HDFC ****4412', '$₹5,00,000', '@ok:Cleared'],
    ['!RCP-0517', 'Patel Auto Components', '~12 Aug', 'UPI', 'UPI wallet', '$₹1,30,000', '@ok:Cleared'],
    ['!RCP-0516', 'Suryodaya Steels', '~10 Aug', 'Cheque', 'CHQ 771204', '$₹3,22,600', '@warn:In clearing'],
  ], { summary: [['Receipts', '519'], ['This month', '₹41,08,200'], ['In clearing', '₹3,22,600', 'warning']], views: [['All', 519], ['This month', 38], ['In clearing', 2]], actions: [['New receipt', 'add', 1], ['Export', 'download', 0]] });
  S['journal'] = list('Journal', 'Direct entries · F7', ['Voucher no', 'Narration', 'Date', 'Debit account', 'Credit account', '>Amount', 'Status'], [
    ['!JV-0077', 'Diesel for generator', '~14 Aug', 'Fuel expenses', 'Cash in hand', '$₹42,000', '@warn:Pending'],
    ['!JV-0076', 'Depreciation — Aug', '~13 Aug', 'Depreciation', 'Plant & machinery', '$₹1,18,400', '@ok:Approved'],
    ['!JV-0075', 'Tea & refreshments', '~12 Aug', 'Staff welfare', 'Cash in hand', '$₹3,240', '@ok:Approved'],
    ['!JV-0074', 'Bank charges', '~11 Aug', 'Bank charges', 'HDFC Current', '$₹1,062', '@ok:Approved'],
  ], { views: [['All', 77], ['Pending', 1], ['Approved', 76]], actions: [['New journal', 'add', 1], ['Export', 'download', 0]] });
  S['contra'] = list('Contra', 'Transfers between your own accounts · F4', ['Voucher no', 'From account', 'To account', 'Date', 'Mode', '>Amount', 'Status'], [
    ['!CTR-0044', 'HDFC Current', 'Cash in hand', '~14 Aug', 'Cash withdrawal', '$₹1,00,000', '@ok:Done'],
    ['!CTR-0043', 'Cash in hand', 'ICICI OD', '~12 Aug', 'Cash deposit', '$₹2,50,000', '@ok:Done'],
    ['!CTR-0042', 'HDFC Current', 'ICICI OD', '~09 Aug', 'Bank transfer', '$₹5,00,000', '@ok:Done'],
  ], { views: [['All', 44], ['This month', 6]], actions: [['New contra', 'add', 1]] });

  S['outstanding'] = list('Outstanding', 'Balance by party, oldest first', ['Party', 'Type', 'Open vouchers', 'Oldest', '0–30 d', '31–60 d', '60+ d', '>Balance'], [
    ['Rajkot Tools & Dies', 'Customer', '#6', '~11 Aug', '#₹2,34,120', '#₹0', '#₹0', '$₹2,34,120'],
    ['Patel Auto Components', 'Customer', '#3', '~28 Jun', '#₹0', '#₹1,38,400', '#₹0', '$₹1,38,400'],
    ['Kiran Metal Works', 'Customer', '#2', '~13 Aug', '#₹96,750', '#₹0', '#₹0', '$₹96,750'],
    ['Mahavir Steel Traders', 'Vendor', '#4', '~19 Jul', '#₹0', '#₹2,10,000', '#₹0', '$₹2,10,000'],
    ['Girnar Castings', 'Vendor', '#2', '~02 May', '#₹0', '#₹0', '#₹74,300', '$₹74,300'],
  ], { summary: [['Receivable', '₹31,84,250', 'success'], ['Payable', '₹19,72,800', 'warning'], ['Net position', '₹12,11,450'], ['Parties', '48']], views: [['All', 48], ['Customers', 31], ['Vendors', 17]] });
  S['party-statement'] = list('Party Statement', 'Rajkot Tools & Dies · 01 Apr 2026 – 17 Aug 2026', ['Date', 'Particulars', 'Voucher', '>Debit', '>Credit', '>Balance'], [
    ['~01 Apr', 'Opening balance', '~—', '#—', '#—', '$₹4,12,000'],
    ['~18 Apr', 'Sales invoice', 'INV-2526-0022', '#₹6,18,400', '#—', '$₹10,30,400'],
    ['~02 May', 'Receipt — RTGS', 'RCP-0388', '#—', '#₹6,00,000', '$₹4,30,400'],
    ['~11 Aug', 'Sales invoice', 'INV-2526-0144', '#₹7,34,120', '#—', '$₹11,64,520'],
    ['~13 Aug', 'Receipt — RTGS', 'RCP-0518', '#—', '#₹5,00,000', '$₹6,64,520'],
    ['~17 Aug', 'Closing balance', '~—', '#—', '#—', '$₹6,64,520'],
  ], { summary: [['Opening', '₹4,12,000'], ['Debit', '₹13,52,520'], ['Credit', '₹11,00,000'], ['Closing', '₹6,64,520', 'warning']], views: [['This year', ''], ['Last 90 days', ''], ['All', '']], actions: [['Print statement', 'print', 1], ['Email', 'mail', 0]] });
  S['chart-of-accounts'] = list('Chart of Accounts', 'The general ledger account tree', ['Code', 'Account', 'Group', 'Type', 'Nature', '>Balance', 'Status'], [
    ['#1100', '!Cash in hand', 'Current assets', 'Asset', 'Debit', '$₹4,86,000', '@ok:Active'],
    ['#1110', '!HDFC Current ****4412', 'Bank accounts', 'Asset', 'Debit', '$₹28,41,000', '@ok:Active'],
    ['#1200', '!Sundry debtors', 'Current assets', 'Asset', 'Debit', '$₹31,84,250', '@ok:Active'],
    ['#2100', '!Sundry creditors', 'Current liabilities', 'Liability', 'Credit', '$₹19,72,800', '@ok:Active'],
    ['#2200', '!GST payable', 'Duties & taxes', 'Liability', 'Credit', '$₹3,19,450', '@ok:Active'],
    ['#4100', '!Sales — machined parts', 'Direct income', 'Income', 'Credit', '$₹4,21,08,000', '@ok:Active'],
    ['#5100', '!Raw material purchases', 'Direct expense', 'Expense', 'Debit', '$₹2,86,44,000', '@ok:Active'],
  ], { views: [['All', 214], ['Assets', 42], ['Liabilities', 28], ['Income', 19], ['Expense', 125]] });
  S['gst-returns'] = list('GST Returns', 'GSTR-1 and GSTR-3B for July 2026', ['Return', 'Period', 'Due date', 'Invoices', '>Taxable', '>Tax', 'Status'], [
    ['!GSTR-1', 'Jul 2026', '11-08-2026', '#148', '$₹68,42,100', '$₹12,31,578', '@ok:Filed'],
    ['!GSTR-3B', 'Jul 2026', '20-08-2026', '#148', '$₹68,42,100', '$₹3,19,450', '@warn:Draft ready'],
    ['!GSTR-2B', 'Jul 2026', '—', '#96', '$₹41,08,200', '$₹7,39,476', '@info:Reconciled'],
    ['!GSTR-1', 'Jun 2026', '11-07-2026', '#132', '$₹61,20,400', '$₹11,01,672', '@ok:Filed'],
  ], { summary: [['Output tax', '₹12,31,578'], ['Input credit', '₹9,12,128'], ['Net payable', '₹3,19,450', 'warning'], ['Unmatched', '3', 'error']], views: [['This year', ''], ['Filed', ''], ['Pending', 1]], actions: [['Generate GSTR-3B', 'summarize', 1], ['Download JSON', 'download', 0]] });
  S['invoice-scanning'] = {
    kind: 'scan', title: 'Invoice Scanning', sub: 'Read a vendor bill and post it without typing',
    scanLines: [
      { name: 'MS Plate 12mm × 1500 × 3000', amount: '1,42,400.00' },
      { name: 'MS Angle 50×50×6', amount: '68,200.00' },
      { name: 'Round Bar EN8 40mm', amount: '31,800.00' },
      { name: 'Freight & handling', amount: '4,800.00' },
    ],
    scanFields: [
      { label: 'Vendor', value: 'Mahavir Steel Traders', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'GSTIN', value: '24AABCM1234K1ZP', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'Invoice no', value: 'MST/25-26/0412', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'Invoice date', value: '08-08-2026', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'Taxable value', value: '₹2,41,186.44', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'GST 18%', value: '₹43,413.56', icon: 'edit', iconStyle: 'color:var(--warning);', style: 'border-color:var(--warning);background:var(--warning-bg);' },
      { label: 'Total', value: '₹2,84,600.00', icon: 'check_circle', iconStyle: 'color:var(--success);' },
      { label: 'Purchase order', value: 'PO-0420 — matched', icon: 'link', iconStyle: 'color:var(--success);' },
      { label: 'Expense head', value: 'Raw material purchases', icon: 'edit', iconStyle: 'color:var(--warning);', style: 'border-color:var(--warning);background:var(--warning-bg);' },
    ],
  };

  /* reports */
  S['trial-balance'] = list('Trial Balance', 'As on 17 August 2026', ['Code', 'Account', 'Group', '>Debit', '>Credit'], [
    ['#1100', 'Cash in hand', 'Current assets', '#₹4,86,000', '#—'],
    ['#1110', 'HDFC Current', 'Bank accounts', '#₹28,41,000', '#—'],
    ['#1200', 'Sundry debtors', 'Current assets', '#₹31,84,250', '#—'],
    ['#1300', 'Closing stock', 'Current assets', '#₹64,10,900', '#—'],
    ['#2100', 'Sundry creditors', 'Current liabilities', '#—', '#₹19,72,800'],
    ['#2200', 'GST payable', 'Duties & taxes', '#—', '#₹3,19,450'],
    ['#3100', 'Capital account', 'Capital', '#—', '#₹80,00,000'],
    ['#4100', 'Sales', 'Direct income', '#—', '#₹4,21,08,000'],
    ['#5100', 'Purchases', 'Direct expense', '#₹2,86,44,000', '#—'],
  ], { summary: [['Total debit', '₹5,24,00,250'], ['Total credit', '₹5,24,00,250'], ['Difference', '₹0', 'success']], views: [['As on date', ''], ['This year', ''], ['Last year', '']], actions: [['Print', 'print', 1], ['Export', 'download', 0]] });
  S['profit-and-loss'] = list('Profit & Loss', '01 April 2026 – 17 August 2026', ['Particulars', 'Group', '>This period', '>Last period', '>Change'], [
    ['!Sales', 'Direct income', '$₹4,21,08,000', '#₹3,68,20,000', '#+14.4%'],
    ['Less: Purchases', 'Direct expense', '#₹2,86,44,000', '#₹2,58,10,000', '#+11.0%'],
    ['!Gross profit', '—', '$₹1,34,64,000', '#₹1,10,10,000', '#+22.3%'],
    ['Salaries & wages', 'Indirect expense', '#₹42,18,000', '#₹38,40,000', '#+9.8%'],
    ['Power & fuel', 'Indirect expense', '#₹18,62,000', '#₹17,10,000', '#+8.9%'],
    ['Freight outward', 'Indirect expense', '#₹9,84,000', '#₹8,20,000', '#+20.0%'],
    ['!Net profit', '—', '$₹42,18,400', '#₹31,60,000', '#+33.5%'],
  ], { summary: [['Revenue', '₹4,21,08,000'], ['Gross margin', '32.0%'], ['Net profit', '₹42,18,400', 'success'], ['Net margin', '10.0%']], actions: [['Print', 'print', 1], ['Export', 'download', 0]] });
  S['balance-sheet'] = list('Balance Sheet', 'As on 17 August 2026', ['Particulars', 'Group', '>Amount', '>Previous year'], [
    ['!Capital account', 'Equity', '$₹80,00,000', '#₹80,00,000'],
    ['Reserves & surplus', 'Equity', '#₹42,18,400', '#₹31,60,000'],
    ['!Sundry creditors', 'Current liabilities', '$₹19,72,800', '#₹22,40,000'],
    ['GST payable', 'Duties & taxes', '#₹3,19,450', '#₹2,80,100'],
    ['!Fixed assets', 'Assets', '$₹68,40,000', '#₹71,20,000'],
    ['Closing stock', 'Current assets', '#₹64,10,900', '#₹58,90,000'],
    ['Sundry debtors', 'Current assets', '#₹31,84,250', '#₹28,10,400'],
    ['Cash & bank', 'Current assets', '#₹48,26,400', '#₹42,18,000'],
  ], { summary: [['Total assets', '₹2,12,61,550'], ['Total liabilities', '₹2,12,61,550'], ['Working capital', '₹1,24,48,750', 'success']], actions: [['Print', 'print', 1], ['Export', 'download', 0]] });
  S['day-book'] = list('Day Book', 'All vouchers posted on 14 August 2026', ['Time', 'Voucher', 'Type', 'Party / account', 'Prepared by', '>Amount'], [
    ['~09:12', '!RCP-0519', 'Receipt', 'Shree Balaji Engineering', 'Meera S.', '$₹4,12,500'],
    ['~10:04', '!INV-2526-0148', 'Sales', 'Shree Balaji Engineering', 'Nikita R.', '$₹4,12,500'],
    ['~11:36', '!PB-0312', 'Purchase', 'Mahavir Steel Traders', 'Meera S.', '$₹2,84,600'],
    ['~14:20', '!JV-0077', 'Journal', 'Fuel expenses', 'Meera S.', '$₹42,000'],
    ['~16:48', '!CTR-0044', 'Contra', 'HDFC → Cash', 'Harsh P.', '$₹1,00,000'],
  ], { summary: [['Vouchers', '18'], ['Receipts', '₹9,42,500', 'success'], ['Payments', '₹3,84,750', 'warning']], views: [['Today', ''], ['Yesterday', ''], ['Pick a date', '']] });
  S['stock-ledger'] = list('Stock Ledger', 'MS Flange 6" ANSI 150 · movement this month', ['Date', 'Voucher', 'Party', '>In', '>Out', '>Balance', '>Rate', '>Value'], [
    ['~01 Aug', 'Opening', '~—', '#—', '#—', '#420', '#₹1,240', '$₹5,20,800'],
    ['~04 Aug', 'GRN-0284', 'Sanghavi Alloys', '#300', '#—', '#720', '#₹1,262', '$₹9,08,640'],
    ['~09 Aug', 'INV-2526-0142', 'Suryodaya Steels', '#—', '#180', '#540', '#₹1,262', '$₹6,81,480'],
    ['~14 Aug', 'INV-2526-0148', 'Shree Balaji Engineering', '#—', '#260', '#280', '#₹1,262', '$₹3,53,360'],
  ], { summary: [['Opening', '420 nos'], ['Received', '300 nos'], ['Issued', '440 nos'], ['Closing', '280 nos', 'warning']] });
  S['valuation-summary'] = list('Valuation Summary', 'Stock value by category', ['Category', 'SKUs', '>Quantity', '>Avg rate', '>Value', 'Share'], [
    ['Flanges & fittings', '#42', '#3,180', '#₹1,262', '$₹40,13,160', '@info:62%'],
    ['Machined housings', '#18', '#620', '#₹2,140', '$₹13,26,800', '@info:21%'],
    ['Bearings & bushes', '#64', '#8,940', '#₹94', '$₹8,40,360', '@info:13%'],
    ['Consumables', '#128', '#12,400', '#₹18', '$₹2,30,580', '@info:4%'],
  ], { summary: [['Total value', '₹64,10,900'], ['SKUs', '252'], ['Slow moving', '₹6,18,400', 'warning']] });
  S['reorder-alerts'] = list('Reorder Alerts', 'Products at or below reorder level', ['Product', 'Category', '>On hand', '>Reorder level', '>Days cover', 'Preferred vendor', 'Status'], [
    ['MS Flange 6" ANSI 150', 'Flanges', '#280', '#400', '#4', 'Sanghavi Alloys', '@bad:Critical'],
    ['Precision Bush PB-18', 'Bushes', '#1,240', '#1,500', '#9', 'Rathi Bearings', '@warn:Low'],
    ['Hydraulic Rod 40mm', 'Rods', '#96', '#150', '#6', 'Mahavir Steel', '@warn:Low'],
    ['Gearbox Casing GC-220', 'Housings', '#18', '#40', '#3', 'Girnar Castings', '@bad:Critical'],
  ], { summary: [['Below level', '12', 'error'], ['Critical', '4', 'error'], ['Suggested PO value', '₹8,42,000']], actions: [['Create purchase orders', 'shopping_cart', 1], ['Export', 'download', 0]] });
  var genericReport = function (title, sub) {
    return list(title, sub, ['Date', 'Voucher', 'Particulars', '>Debit', '>Credit', '>Balance'], [
      ['~01 Aug', '~Opening', 'Opening balance', '#—', '#—', '$₹4,86,000'],
      ['~04 Aug', 'RCP-0512', 'Received from Kiran Metal Works', '#₹96,750', '#—', '$₹5,82,750'],
      ['~08 Aug', 'PAY-0228', 'Paid to Tejas Hardware', '#—', '#₹22,150', '$₹5,60,600'],
      ['~12 Aug', 'JV-0075', 'Staff welfare', '#—', '#₹3,240', '$₹5,57,360'],
      ['~14 Aug', 'CTR-0044', 'Cash withdrawn from HDFC', '#₹1,00,000', '#—', '$₹6,57,360'],
    ], { views: [['This month', ''], ['Last month', ''], ['This year', '']], actions: [['Print', 'print', 1], ['Export', 'download', 0]] });
  };
  S['group-statement'] = genericReport('Group Statement', 'Movement by account group');
  S['cash-book'] = genericReport('Cash Book', 'Cash in hand · August 2026');
  S['bank-book'] = genericReport('Bank Book', 'HDFC Current ****4412 · August 2026');
  S['daily-cash'] = genericReport('Daily Cash', 'Opening, movement and closing per day');
  S['payment-register'] = genericReport('Payment Register', 'Every payment in the period');
  S['receipt-register'] = genericReport('Receipt Register', 'Every receipt in the period');

  S['trx-nature'] = master('Nature', 'How a voucher type behaves in the ledger', ['Name', 'Applies to', 'Effect', 'Vouchers', 'Status'], [
    ['!Sales', 'Sales, Credit note', 'Dr debtor · Cr income', '#412', '@ok:Active'],
    ['!Purchase', 'Purchase, Debit note', 'Dr expense · Cr creditor', '#318', '@ok:Active'],
    ['!Receipt', 'Receipt', 'Dr cash/bank · Cr debtor', '#519', '@ok:Active'],
    ['!Payment', 'Payment', 'Dr creditor · Cr cash/bank', '#233', '@ok:Active'],
  ]);
  S['trx-group'] = master('Transaction Group', 'Grouping used across reports and the rail', ['Name', 'Voucher types', 'Sort', 'Visible', 'Status'], [
    ['!Purchase', '#5', '#1', 'Yes', '@ok:Active'],
    ['!Sales', '#5', '#2', 'Yes', '@ok:Active'],
    ['!Cash & Accounting', '#4', '#3', 'Yes', '@ok:Active'],
  ]);
  S['financial-year'] = master('Financial Year', 'Books periods and their lock state', ['Year', 'From', 'To', 'Vouchers', 'Status'], [
    ['!FY 2025-26', '01-04-2025', '31-03-2026', '#4,182', '@ok:Current'],
    ['!FY 2024-25', '01-04-2024', '31-03-2025', '#3,940', '@mute:Closed'],
    ['!FY 2023-24', '01-04-2023', '31-03-2024', '#3,412', '@mute:Closed'],
  ]);
  S['tax-rates'] = master('GST Rates', 'Read-only — the rate follows the HSN/SAC code', ['HSN / SAC', 'Description', '>CGST', '>SGST', '>IGST', 'Status'], [
    ['#7307', 'Tube or pipe fittings of iron or steel', '#9%', '#9%', '#18%', '@ok:Active'],
    ['#8483', 'Transmission shafts and gears', '#9%', '#9%', '#18%', '@ok:Active'],
    ['#7326', 'Other articles of iron or steel', '#9%', '#9%', '#18%', '@ok:Active'],
    ['#9988', 'Job work — manufacturing services', '#6%', '#6%', '#12%', '@ok:Active'],
  ], { actions: [['Export', 'download', 0]] });
  S['transaction-config'] = {
    kind: 'settings', title: 'Transaction Configuration', sub: 'Which voucher types appear, and how each behaves',
    settingGroups: [
      { label: 'Visible voucher types', items: [
        { label: 'Quotation', hint: 'Show in the rail and the new-voucher menu', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Purchase requisition', hint: 'Internal request before a purchase order', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Delivery challan', hint: 'Separate dispatch document before the invoice', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
        { label: 'Job work challan', hint: 'Material movement to and from vendors', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
      ] },
      { label: 'Numbering', items: [
        { label: 'Sales invoice prefix', hint: 'Resets every financial year', isValue: true, value: 'INV-2526-' },
        { label: 'Purchase bill prefix', hint: 'Vendor bill numbering', isValue: true, value: 'PB-' },
        { label: 'Number gaps', hint: 'Whether cancelled numbers can be reused', isValue: true, value: 'Never reuse' },
      ] },
      { label: 'Approval rules', items: [
        { label: 'Require approval above', hint: 'Vouchers over this value need a second pair of eyes', isValue: true, value: '₹2,00,000' },
        { label: 'Lock approved vouchers', hint: 'Edits after approval create a revision instead', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Allow back-dated entry', hint: 'Posting into a closed period', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
      ] },
    ],
  };
  S['data-import'] = {
    kind: 'settings', title: 'Data Import', sub: 'Bring historical data in from Tally Prime (more ERPs soon)',
    settingGroups: [
      { label: 'Source', items: [
        { label: 'Source system', hint: 'Where the historical books live today', isValue: true, value: 'Tally Prime' },
        { label: 'Financial years to import', hint: 'Older years import as opening balances only', isValue: true, value: 'FY 2023-24 →' },
      ] },
      { label: 'What to bring across', items: [
        { label: 'Masters — parties, products, accounts', hint: '2,184 records detected', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Opening balances', hint: 'Party and ledger balances as on 01 Apr', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Transactions', hint: '11,534 vouchers detected', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Attachments', hint: 'Scanned copies linked to vouchers', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
      ] },
    ],
  };

  /* voucher entry */
  S['sales-entry'] = {
    kind: 'form', title: 'New sales invoice',
    headerFields: [
      { label: 'Customer', value: 'Rajkot Tools & Dies', icon: 'search', hint: 'Balance ₹6,64,520 · 30-day credit' },
      { label: 'Invoice no', value: 'INV-2526-0149', icon: 'lock', hint: 'Auto — next in series' },
      { label: 'Invoice date', value: '17-08-2026', icon: 'calendar_today', hint: '' },
      { label: 'Due date', value: '16-09-2026', icon: 'calendar_today', hint: 'From 30-day terms' },
      { label: 'Place of supply', value: 'Gujarat (24)', icon: 'expand_more', hint: 'Intra-state — CGST + SGST' },
      { label: 'Against order', value: 'SO-0188', icon: 'link', hint: '4 of 6 lines pulled in' },
      { label: 'Dispatch through', value: 'Shree Transport', icon: 'expand_more', hint: '' },
      { label: 'Vehicle no', value: 'GJ-03-AB-4412', icon: 'local_shipping', hint: 'Needed for the e-Way Bill' },
    ],
    itemCols: ['#', 'Product', 'HSN', '>Qty', 'Unit', '>Rate', '>Disc', '>GST', '>Amount'],
    itemRows: [
      ['#1', 'MS Flange 6" ANSI 150', '#7307', '#260', 'nos', '#1,480.00', '#2%', '#18%', '$3,77,062.40'],
      ['#2', 'CNC Machined Housing A2', '#8483', '#40', 'nos', '#2,140.00', '#0%', '#18%', '$1,01,008.00'],
      ['#3', 'Precision Bush PB-18', '#8483', '#600', 'nos', '#94.00', '#5%', '#18%', '$63,178.80'],
      ['#4', 'Freight & handling', '#9965', '#1', 'lot', '#6,800.00', '#0%', '#18%', '$8,024.00'],
    ],
    totals: [
      { label: 'Taxable value', value: '₹4,70,570.17' },
      { label: 'CGST 9%', value: '₹42,351.32' },
      { label: 'SGST 9%', value: '₹42,351.31' },
      { label: 'Round off', value: '₹0.20' },
      { label: 'Invoice total', value: '₹5,49,273.00', style: 'font-size:16px;font-weight:700;', labelStyle: 'font-weight:600;color:var(--on-surface);', rowStyle: 'margin-top:6px;padding-top:8px;border-top:1px solid var(--border);' },
      { label: 'Amount in words', value: 'Five lakh forty-nine thousand two hundred seventy-three only', stacked: true, style: 'font-size:11px;color:var(--muted);white-space:normal;line-height:1.4;' },
    ],
    formCompliance: [
      { icon: 'verified', label: 'e-Invoice will be registered', value: 'IRN requested automatically on approval', tone: 'success' },
      { icon: 'local_shipping', label: 'e-Way Bill required', value: 'Value above ₹50,000 · vehicle number captured', tone: 'warning' },
      { icon: 'inventory_2', label: 'Stock check passed', value: 'All 4 lines available at Rajkot store', tone: 'success' },
    ],
  };

  /* ───────── Product & Service ───────── */
  S['product/dashboard'] = {
    kind: 'dash', title: 'Product dashboard', sub: 'Catalogue and stock health',
    kpis: [
      { label: 'Products', icon: 'inventory_2', value: '252', hint: '18 added this month', iconStyle: 'color:var(--primary);' },
      { label: 'Services', icon: 'handyman', value: '14', hint: 'Job work and freight', iconStyle: 'color:var(--info);' },
      { label: 'Stock value', icon: 'price_check', value: '₹64,10,900', hint: 'At weighted average cost', iconStyle: 'color:var(--success);' },
      { label: 'Below reorder', icon: 'warning', value: '12', hint: '4 critical', iconStyle: 'color:var(--error);', valueStyle: 'color:var(--error);' },
      { label: 'Slow moving', icon: 'hourglass_bottom', value: '₹6,18,400', hint: 'No movement in 90 days', iconStyle: 'color:var(--warning);' },
      { label: 'Price changes', icon: 'sell', value: '8', hint: 'Awaiting approval', iconStyle: 'color:var(--warning);' },
    ],
    queueTitle: 'Stock needing action',
    queue: [
      { icon: 'warning', title: 'MS Flange 6" ANSI 150', meta: '280 on hand · 4 days cover', amount: '₹3,53,360', action: 'Order', tone: 'error' },
      { icon: 'warning', title: 'Gearbox Casing GC-220', meta: '18 on hand · 3 days cover', amount: '₹38,520', action: 'Order', tone: 'error' },
      { icon: 'hourglass_bottom', title: 'Bearing Housing BH-90', meta: 'No movement in 128 days', amount: '₹1,84,200', action: 'Review', tone: 'warning' },
      { icon: 'sell', title: '8 price revisions pending', meta: 'Raised by Nikita R. on 14 Aug', amount: '—', action: 'Approve', tone: 'info' },
    ],
    panelTitle: 'Value by category',
    bars: [
      { name: 'Flanges', value: '₹40,13,160', barStyle: 'width:62%;' },
      { name: 'Housings', value: '₹13,26,800', barStyle: 'width:21%;' },
      { name: 'Bearings', value: '₹8,40,360', barStyle: 'width:13%;' },
      { name: 'Consumables', value: '₹2,30,580', barStyle: 'width:4%;' },
    ],
    chartTitle: 'Stock in vs out', seriesA: 'Received', seriesB: 'Issued',
  };
  S['product-list'] = list('Product List', 'Everything you buy, make or sell', ['Code', 'Product', 'Category', 'HSN', 'Unit', '>On hand', '>Rate', 'Status'], [
    ['#FLG-6150', '!MS Flange 6" ANSI 150', 'Flanges', '#7307', 'nos', '#280', '$₹1,480', '@bad:Below reorder'],
    ['#HSG-A2', '!CNC Machined Housing A2', 'Housings', '#8483', 'nos', '#160', '$₹2,140', '@ok:In stock'],
    ['#ROD-40', '!Hydraulic Cylinder Rod 40mm', 'Rods', '#7228', 'nos', '#96', '$₹880', '@warn:Low'],
    ['#GC-220', '!Gearbox Casing GC-220', 'Housings', '#8483', 'nos', '#18', '$₹2,140', '@bad:Below reorder'],
    ['#PB-18', '!Precision Bush PB-18', 'Bushes', '#8483', 'nos', '#1,240', '$₹94', '@warn:Low'],
    ['#ANG-50', '!MS Angle 50×50×6', 'Sections', '#7216', 'kg', '#4,820', '$₹68', '@ok:In stock'],
  ], { summary: [['Products', '252'], ['In stock', '218', 'success'], ['Below reorder', '12', 'error'], ['Stock value', '₹64,10,900']], views: [['All', 252], ['In stock', 218], ['Below reorder', 12], ['Archived', 22]] });
  S['service-list'] = list('Service List', 'Non-stock items you bill for', ['Code', 'Service', 'SAC', 'Unit', '>Rate', '>GST', 'Status'], [
    ['#SRV-JW', '!CNC machining — job work', '#9988', 'hour', '$₹640', '#12%', '@ok:Active'],
    ['#SRV-FR', '!Freight & handling', '#9965', 'lot', '$₹6,800', '#18%', '@ok:Active'],
    ['#SRV-INS', '!Inspection & certification', '#9983', 'lot', '$₹2,400', '#18%', '@ok:Active'],
  ]);
  S['quantity'] = list('Quantity', 'Stock on hand by store', ['Product', 'Store', '>On hand', '>Reserved', '>Available', '>Reorder level', 'Status'], [
    ['MS Flange 6" ANSI 150', 'Rajkot main', '#280', '#180', '#100', '#400', '@bad:Below reorder'],
    ['CNC Machined Housing A2', 'Rajkot main', '#160', '#40', '#120', '#100', '@ok:Healthy'],
    ['Precision Bush PB-18', 'Rajkot main', '#1,240', '#600', '#640', '#1,500', '@warn:Low'],
    ['MS Angle 50×50×6', 'Yard', '#4,820', '#0', '#4,820', '#2,000', '@ok:Healthy'],
  ], { actions: [['Stock adjustment', 'tune', 1], ['Export', 'download', 0]] });
  S['product-price'] = list('Price', 'Selling and purchase rates with effective dates', ['Product', 'Price list', '>Purchase rate', '>Selling rate', '>Margin', 'Effective from', 'Status'], [
    ['MS Flange 6" ANSI 150', 'Standard', '#₹1,262', '#₹1,480', '#17.3%', '~01 Aug 2026', '@ok:Live'],
    ['MS Flange 6" ANSI 150', 'Dealer', '#₹1,262', '#₹1,410', '#11.7%', '~01 Aug 2026', '@ok:Live'],
    ['CNC Machined Housing A2', 'Standard', '#₹1,840', '#₹2,140', '#16.3%', '~01 Jul 2026', '@ok:Live'],
    ['Precision Bush PB-18', 'Standard', '#₹78', '#₹94', '#20.5%', '~18 Aug 2026', '@warn:Pending approval'],
  ], { views: [['All', 486], ['Live', 478], ['Pending', 8]] });
  S['product-media'] = { kind: 'files', title: 'Product Media', sub: 'Photos and drawings attached to catalogue items', files: [
    { name: 'FLG-6150 front.jpg', meta: '1.2 MB · 14 Aug', icon: 'image', thumbStyle: 'background:var(--surface-2);', iconStyle: 'color:var(--muted);' },
    { name: 'FLG-6150 drawing.pdf', meta: '480 KB · 14 Aug', icon: 'picture_as_pdf', thumbStyle: 'background:var(--error-bg);', iconStyle: 'color:var(--error);' },
    { name: 'HSG-A2 render.png', meta: '2.4 MB · 12 Aug', icon: 'image', thumbStyle: 'background:var(--surface-2);', iconStyle: 'color:var(--muted);' },
    { name: 'GC-220 section.dwg', meta: '3.1 MB · 09 Aug', icon: 'architecture', thumbStyle: 'background:var(--info-bg);', iconStyle: 'color:var(--info);' },
    { name: 'PB-18 catalogue.pdf', meta: '860 KB · 04 Aug', icon: 'picture_as_pdf', thumbStyle: 'background:var(--error-bg);', iconStyle: 'color:var(--error);' },
    { name: 'ROD-40 photo.jpg', meta: '1.8 MB · 02 Aug', icon: 'image', thumbStyle: 'background:var(--surface-2);', iconStyle: 'color:var(--muted);' },
  ] };
  S['conversions'] = list('Stock Conversions', 'Components consumed, finished goods produced', ['Voucher', 'Finished product', '>Produced', 'Components', 'Date', '>Cost', 'Status'], [
    ['!CNV-0142', 'Gearbox Assembly GA-40', '#24', '#6 items', '~14 Aug', '$₹1,84,200', '@ok:Posted'],
    ['!CNV-0141', 'Flange Kit FK-6', '#120', '#3 items', '~12 Aug', '$₹2,41,600', '@ok:Posted'],
    ['!CNV-0140', 'Bush Set BS-18', '#400', '#2 items', '~09 Aug', '$₹38,400', '@mute:Draft'],
  ], { actions: [['New conversion', 'add', 1]] });
  S['bom-templates'] = master('BOM Templates', 'Standard recipes used by stock conversion', ['Template', 'Finished product', 'Components', '>Std cost', 'Status'], [
    ['!BOM-GA40', 'Gearbox Assembly GA-40', '#6', '$₹7,675', '@ok:Active'],
    ['!BOM-FK6', 'Flange Kit FK-6', '#3', '$₹2,013', '@ok:Active'],
    ['!BOM-BS18', 'Bush Set BS-18', '#2', '$₹96', '@ok:Active'],
  ]);
  S['manufacturer'] = master('Manufacturer', 'Brands behind the products you stock', ['Name', 'Country', 'Products', 'Contact', 'Status'], [
    ['!Sanghavi Alloys', 'India', '#42', 'sales@sanghavi.in', '@ok:Active'],
    ['!Rathi Bearings', 'India', '#64', 'info@rathi.co.in', '@ok:Active'],
    ['!SKF', 'Sweden', '#18', 'india@skf.com', '@ok:Active'],
  ]);
  S['measurementUnit'] = master('Measurement Unit', 'Units used across the catalogue', ['Unit', 'Short', 'Decimals', 'Used by', 'Status'], [
    ['!Numbers', 'nos', '#0', '#182 products', '@ok:Active'],
    ['!Kilogram', 'kg', '#3', '#48 products', '@ok:Active'],
    ['!Metre', 'mtr', '#2', '#12 products', '@ok:Active'],
    ['!Hour', 'hr', '#2', '#8 services', '@ok:Active'],
  ]);
  S['returnPolicy'] = master('Return Policy', 'What a customer may send back, and when', ['Policy', 'Window', 'Restocking fee', 'Applies to', 'Status'], [
    ['!Standard 15 days', '#15 days', '#0%', '#182 products', '@ok:Active'],
    ['!Made to order', '#No return', '#—', '#42 products', '@ok:Active'],
    ['!Consumables', '#7 days', '#10%', '#28 products', '@ok:Active'],
  ]);
  S['productCondition'] = master('Product Condition', 'Condition grades for stock', ['Condition', 'Sellable', 'Discount', 'Items', 'Status'], [
    ['!New', 'Yes', '#0%', '#248', '@ok:Active'],
    ['!Refurbished', 'Yes', '#15%', '#4', '@ok:Active'],
    ['!Scrap', 'No', '#—', '#0', '@mute:Inactive'],
  ]);
  S['productWarranty'] = master('Product Warranty', 'Warranty terms offered on sale', ['Warranty', 'Duration', 'Covers', 'Products', 'Status'], [
    ['!12 months standard', '#12 months', 'Manufacturing defects', '#182', '@ok:Active'],
    ['!6 months job work', '#6 months', 'Machining accuracy', '#42', '@ok:Active'],
    ['!No warranty', '#—', '—', '#28', '@ok:Active'],
  ]);
  S['categorys-tags'] = master('Categories & Tags', 'How the catalogue is organised', ['Name', 'Type', 'Parent', 'Products', 'Status'], [
    ['!Flanges & fittings', 'Category', '—', '#42', '@ok:Active'],
    ['!Machined housings', 'Category', '—', '#18', '@ok:Active'],
    ['!Bearings & bushes', 'Category', '—', '#64', '@ok:Active'],
    ['!Export grade', 'Tag', '—', '#22', '@ok:Active'],
  ]);
  S['general-settings'] = {
    kind: 'settings', title: 'Product Configuration', sub: 'Catalogue behaviour and stock rules',
    settingGroups: [
      { label: 'Catalogue', items: [
        { label: 'Auto-generate product codes', hint: 'Category prefix plus a running number', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Require HSN on every product', hint: 'Blocks saving without a valid HSN/SAC', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Default unit', hint: 'Pre-filled on a new product', isValue: true, value: 'Numbers (nos)' },
      ] },
      { label: 'Stock', items: [
        { label: 'Valuation method', hint: 'How issue cost is computed', isValue: true, value: 'Weighted average' },
        { label: 'Allow negative stock', hint: 'Issue more than you hold', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
        { label: 'Reserve stock on sales order', hint: 'Hold quantity before dispatch', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
      ] },
    ],
  };
  S['dynamic-fields'] = master('Dynamic Fields', 'Extra fields added to the product form', ['Field', 'Type', 'Applies to', 'Required', 'Status'], [
    ['!Drawing number', 'Text', 'Machined housings', 'Yes', '@ok:Active'],
    ['!Material grade', 'Dropdown', 'All products', 'Yes', '@ok:Active'],
    ['!Heat number', 'Text', 'Flanges & fittings', 'No', '@ok:Active'],
  ]);

  /* ───────── Job Work ───────── */
  S['job-work/dashboard'] = {
    kind: 'dash', title: 'Job Work dashboard', sub: 'Shop floor at a glance',
    kpis: [
      { label: 'Live orders', icon: 'precision_manufacturing', value: '38', hint: 'Across 6 operations', iconStyle: 'color:var(--primary);' },
      { label: 'Overdue', icon: 'event_busy', value: '5', hint: 'Promised date passed', iconStyle: 'color:var(--error);', valueStyle: 'color:var(--error);' },
      { label: 'At risk', icon: 'warning', value: '7', hint: 'Due within 2 days', iconStyle: 'color:var(--warning);' },
      { label: 'WIP value', icon: 'inventory', value: '₹18,42,600', hint: 'Material at vendors', iconStyle: 'color:var(--info);' },
      { label: 'Ready to bill', icon: 'receipt_long', value: '₹4,86,200', hint: '11 delivered orders', iconStyle: 'color:var(--success);' },
      { label: 'Rejection rate', icon: 'thumb_down', value: '1.8%', hint: 'Last 30 days', iconStyle: 'color:var(--warning);' },
    ],
    queueTitle: 'Orders needing a decision',
    queue: [
      { icon: 'event_busy', title: 'JW-0412 · Gearbox Casing GC-220', meta: 'Overdue 3 days at Krishna Engineering', amount: '240 nos', action: 'Chase', tone: 'error' },
      { icon: 'warning', title: 'JW-0409 · Housing A2 — grinding', meta: 'Due tomorrow · 60% complete', amount: '400 nos', action: 'Open', tone: 'warning' },
      { icon: 'local_shipping', title: 'Challan CH-0288 not returned', meta: 'Material out 22 days · 180 kg', amount: '₹2,18,400', action: 'Follow up', tone: 'warning' },
      { icon: 'receipt_long', title: '11 delivered orders ready to bill', meta: 'Patel Auto — monthly billing cycle', amount: '₹4,86,200', action: 'Bill', tone: 'success' },
    ],
    panelTitle: 'WIP by operation',
    bars: [
      { name: 'CNC turning', value: '₹7,42,000', barStyle: 'width:40%;' },
      { name: 'Grinding', value: '₹5,18,600', barStyle: 'width:28%;' },
      { name: 'Heat treatment', value: '₹3,84,000', barStyle: 'width:21%;' },
      { name: 'Plating', value: '₹1,98,000', barStyle: 'width:11%;' },
    ],
    chartTitle: 'Orders in vs delivered', seriesA: 'Received', seriesB: 'Delivered',
  };
  S['board'] = {
    kind: 'board', title: 'Job Work Board', sub: 'Every live order, where it is and what it needs next',
    boardCols: [
      { label: 'Planned', count: 8, dotStyle: 'background:var(--muted);', cards: [
        { no: 'JW-0421', part: 'Flange Kit FK-6', party: 'Rajkot Tools & Dies', qty: '0 / 600', due: '24 Aug', tag: 'New', tagStyle: 'color:var(--muted);background:var(--surface-2);', barStyle: 'width:0%;' },
        { no: 'JW-0420', part: 'Bush Set BS-18', party: 'Patel Auto Components', qty: '0 / 1200', due: '26 Aug', tag: 'New', tagStyle: 'color:var(--muted);background:var(--surface-2);', barStyle: 'width:0%;' },
      ] },
      { label: 'Material issued', count: 9, dotStyle: 'background:var(--info);', cards: [
        { no: 'JW-0418', part: 'Housing A2 — turning', party: 'Shree Balaji Eng.', qty: '0 / 400', due: '22 Aug', tag: 'CH-0292', tagStyle: 'color:var(--info);background:var(--info-bg);', barStyle: 'width:4%;' },
        { no: 'JW-0417', part: 'Rod 40mm — grinding', party: 'Kiran Metal Works', qty: '0 / 260', due: '21 Aug', tag: 'CH-0291', tagStyle: 'color:var(--info);background:var(--info-bg);', barStyle: 'width:2%;' },
      ] },
      { label: 'In process', count: 12, dotStyle: 'background:var(--primary);', cards: [
        { no: 'JW-0412', part: 'Gearbox Casing GC-220', party: 'Anand Precision', qty: '180 / 240', due: 'Overdue 3d', dueStyle: 'color:var(--error);', tag: 'Late', tagStyle: 'color:var(--error);background:var(--error-bg);', barStyle: 'width:75%;' },
        { no: 'JW-0409', part: 'Housing A2 — grinding', party: 'Suryodaya Steels', qty: '240 / 400', due: 'Tomorrow', dueStyle: 'color:var(--warning);', tag: 'At risk', tagStyle: 'color:var(--warning);background:var(--warning-bg);', barStyle: 'width:60%;' },
        { no: 'JW-0405', part: 'Flange 6" — drilling', party: 'Rajkot Tools & Dies', qty: '520 / 600', due: '23 Aug', tag: 'OK', tagStyle: 'color:var(--success);background:var(--success-bg);', barStyle: 'width:87%;' },
      ] },
      { label: 'Received back', count: 6, dotStyle: 'background:var(--warning);', cards: [
        { no: 'JW-0398', part: 'Bush PB-18 — plating', party: 'Yash Fabricators', qty: '1200 / 1200', due: 'QC pending', dueStyle: 'color:var(--warning);', tag: 'QC', tagStyle: 'color:var(--warning);background:var(--warning-bg);', barStyle: 'width:100%;' },
      ] },
      { label: 'Delivered', count: 11, dotStyle: 'background:var(--success);', cards: [
        { no: 'JW-0391', part: 'Housing A2 — finish', party: 'Patel Auto Components', qty: '400 / 400', due: 'To bill', dueStyle: 'color:var(--success);', tag: 'Bill', tagStyle: 'color:var(--success);background:var(--success-bg);', barStyle: 'width:100%;' },
        { no: 'JW-0388', part: 'Flange Kit FK-6', party: 'Shree Balaji Eng.', qty: '600 / 600', due: 'Billed', tag: 'Done', tagStyle: 'color:var(--success);background:var(--success-bg);', barStyle: 'width:100%;' },
      ] },
    ],
  };
  S['ready-queue'] = list('Ready Queue', 'What can be worked on right now', ['Order', 'Part', 'Operation', 'Machine', '>Pending qty', 'Due', 'Priority'], [
    ['!JW-0412', 'Gearbox Casing GC-220', 'CNC turning', 'VMC-02', '#60', '~Overdue 3d', '@bad:Urgent'],
    ['!JW-0409', 'Housing A2', 'Grinding', 'SG-01', '#160', '~Tomorrow', '@warn:High'],
    ['!JW-0405', 'Flange 6"', 'Drilling', 'RD-03', '#80', '~23 Aug', '@ok:Normal'],
    ['!JW-0418', 'Housing A2', 'CNC turning', 'VMC-01', '#400', '~22 Aug', '@ok:Normal'],
  ], { summary: [['Ready orders', '8'], ['Urgent', '2', 'error'], ['Total pending', '2,140 nos']], actions: [['Start job', 'play_arrow', 1]] });
  S['challans'] = list('Challans', 'Every movement of material across the gate', ['Challan', 'Direction', 'Party', 'Date', 'Items', '>Value', 'Status'], [
    ['!CH-0292', 'Outward', 'Shree Balaji Engineering', '~14 Aug', '#2', '$₹4,18,000', '@warn:Not returned'],
    ['!CH-0291', 'Outward', 'Kiran Metal Works', '~13 Aug', '#1', '$₹2,18,400', '@warn:Not returned'],
    ['!CH-0290', 'Inward', 'Yash Fabricators', '~12 Aug', '#1', '$₹1,84,200', '@ok:Received'],
    ['!CH-0288', 'Outward', 'Anand Precision Pvt Ltd', '~26 Jul', '#3', '$₹2,18,400', '@bad:Overdue 22d'],
  ], { summary: [['Open challans', '14'], ['Material out', '₹18,42,600', 'warning'], ['Overdue', '3', 'error']], views: [['All', 292], ['Open', 14], ['Overdue', 3]] });
  S['billing-run'] = list('Billing Run', 'Consolidated invoicing over a party billing cycle', ['Party', 'Cycle', 'Delivered orders', 'Period', '>Billable', 'Last run', 'Status'], [
    ['Patel Auto Components', 'Monthly', '#11', '~01–31 Jul', '$₹4,86,200', '~01 Aug', '@warn:Ready to bill'],
    ['Rajkot Tools & Dies', 'Fortnightly', '#6', '~01–15 Aug', '$₹2,41,800', '~01 Aug', '@warn:Ready to bill'],
    ['Shree Balaji Engineering', 'Monthly', '#0', '~01–31 Jul', '$₹0', '~01 Aug', '@ok:Billed'],
  ], { summary: [['Ready to bill', '₹7,28,000', 'warning'], ['Parties', '2'], ['Orders', '17']], actions: [['Run billing', 'receipt_long', 1]] });
  S['reports'] = list('Job Work Reports', 'Register, WIP, ageing and profitability', ['Report', 'Covers', 'Period', 'Rows', 'Last run', 'Status'], [
    ['!Job work register', 'All orders', '~This month', '#38', '~Today', '@ok:Ready'],
    ['!WIP statement', 'Material at vendors', '~As on today', '#14', '~Today', '@ok:Ready'],
    ['!Challan ageing', 'Outward challans', '~As on today', '#14', '~Today', '@ok:Ready'],
    ['!Vendor profitability', 'Costing vs billing', '~This year', '#12', '~Yesterday', '@ok:Ready'],
    ['!Rejection analysis', 'QC results', '~Last 90 days', '#28', '~Today', '@ok:Ready'],
  ], { actions: [['Run report', 'play_arrow', 1], ['Schedule', 'schedule', 0]] });
  S['operation-types'] = master('Operation Types', 'The processes a part can go through', ['Operation', 'Default machine', 'Rate basis', '>Std rate', 'Status'], [
    ['!CNC turning', 'VMC-01', 'Per piece', '$₹64', '@ok:Active'],
    ['!Grinding', 'SG-01', 'Per piece', '$₹28', '@ok:Active'],
    ['!Heat treatment', 'Outsourced', 'Per kg', '$₹18', '@ok:Active'],
    ['!Plating', 'Outsourced', 'Per piece', '$₹12', '@ok:Active'],
  ]);
  S['machines'] = master('Machines', 'Shop floor capacity', ['Machine', 'Type', 'Capacity / shift', 'Operator', 'Status'], [
    ['!VMC-01', 'CNC vertical mill', '#240 pcs', 'Ramesh B.', '@ok:Running'],
    ['!VMC-02', 'CNC vertical mill', '#240 pcs', 'Dinesh P.', '@warn:Maintenance'],
    ['!SG-01', 'Surface grinder', '#180 pcs', 'Alpesh M.', '@ok:Running'],
    ['!RD-03', 'Radial drill', '#320 pcs', 'Jignesh V.', '@ok:Running'],
  ]);
  S['vendor-capabilities'] = master('Vendor Capabilities', 'Who can do which operation, at what rate', ['Vendor', 'Operation', '>Rate', 'Lead time', 'Status'], [
    ['!Krishna Engineering', 'Heat treatment', '$₹18/kg', '#5 days', '@ok:Approved'],
    ['!Yash Fabricators', 'Plating', '$₹12/pc', '#4 days', '@ok:Approved'],
    ['!Anand Precision', 'CNC turning', '$₹58/pc', '#7 days', '@warn:On watch'],
  ]);
  S['route-templates'] = master('Route Templates', 'Standard operation sequences per part', ['Template', 'Part', 'Steps', '>Std cost', 'Status'], [
    ['!RT-GC220', 'Gearbox Casing GC-220', '#4', '$₹186', '@ok:Active'],
    ['!RT-HSGA2', 'CNC Machined Housing A2', '#3', '$₹142', '@ok:Active'],
    ['!RT-PB18', 'Precision Bush PB-18', '#2', '$₹40', '@ok:Active'],
  ]);
  S['party-settings'] = master('Party Billing Settings', 'How each party is invoiced for job work', ['Party', 'Cycle', 'Billing day', 'Rate card', 'Status'], [
    ['!Patel Auto Components', 'Monthly', '~1st', 'Standard', '@ok:Active'],
    ['!Rajkot Tools & Dies', 'Fortnightly', '~1st & 16th', 'Dealer', '@ok:Active'],
    ['!Shree Balaji Engineering', 'Per order', '~On delivery', 'Standard', '@ok:Active'],
  ]);
  S['configuration'] = {
    kind: 'settings', title: 'Job Work Settings', sub: 'Shop floor rules and defaults',
    settingGroups: [
      { label: 'Orders', items: [
        { label: 'Require route template', hint: 'A new order must follow a defined sequence', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Auto-close on full delivery', hint: 'Close the order once quantity is met', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Default promise days', hint: 'Used when no date is entered', isValue: true, value: '7 days' },
      ] },
      { label: 'Challans', items: [
        { label: 'Warn when material out beyond', hint: 'GST rules require return within 180 days', isValue: true, value: '20 days' },
        { label: 'Block dispatch without challan', hint: 'No material leaves without paperwork', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
      ] },
    ],
  };

  /* ───────── HR ───────── */
  S['hr/dashboard'] = {
    kind: 'dash', title: 'HR dashboard', sub: 'People, attendance and payroll',
    kpis: [
      { label: 'Employees', icon: 'badge', value: '84', hint: '6 joined this quarter', iconStyle: 'color:var(--primary);' },
      { label: 'Present today', icon: 'how_to_reg', value: '76', hint: '90.5% attendance', iconStyle: 'color:var(--success);' },
      { label: 'On leave', icon: 'event_busy', value: '5', hint: '3 planned, 2 sick', iconStyle: 'color:var(--warning);' },
      { label: 'Absent', icon: 'person_off', value: '3', hint: 'No intimation', iconStyle: 'color:var(--error);', valueStyle: 'color:var(--error);' },
      { label: 'Payroll — Aug', icon: 'payments', value: '₹42,18,000', hint: 'Draft, runs on 31 Aug', iconStyle: 'color:var(--info);' },
      { label: 'Pending approvals', icon: 'fact_check', value: '5', hint: 'Leave applications', iconStyle: 'color:var(--warning);' },
    ],
    queueTitle: 'Waiting on HR',
    queue: [
      { icon: 'fact_check', title: 'Ramesh Bhatt · 3 days casual leave', meta: '19–21 Aug · applied 2 days ago', amount: '3 days', action: 'Approve', tone: 'warning' },
      { icon: 'person_off', title: '3 absent without intimation', meta: 'Shift A · production', amount: '3', action: 'Review', tone: 'error' },
      { icon: 'payments', title: 'August payroll draft ready', meta: '84 employees · runs 31 Aug', amount: '₹42,18,000', action: 'Review', tone: 'info' },
      { icon: 'badge', title: '2 probation reviews due', meta: 'Dinesh P., Alpesh M.', amount: '2', action: 'Open', tone: 'primary' },
    ],
    panelTitle: 'Headcount by department',
    bars: [
      { name: 'Production', value: '48', barStyle: 'width:57%;' },
      { name: 'Quality', value: '12', barStyle: 'width:14%;' },
      { name: 'Stores', value: '10', barStyle: 'width:12%;' },
      { name: 'Office', value: '14', barStyle: 'width:17%;' },
    ],
    chartTitle: 'Attendance trend', seriesA: 'Present', seriesB: 'Absent',
  };
  S['self-service'] = {
    kind: 'dash', title: 'My Self-Service', sub: 'Harsh Patel · EMP-0004',
    kpis: [
      { label: 'Leave balance', icon: 'event_available', value: '12.5', hint: 'Casual 6 · Earned 6.5', iconStyle: 'color:var(--success);' },
      { label: 'This month', icon: 'how_to_reg', value: '14 / 15', hint: 'Days present', iconStyle: 'color:var(--primary);' },
      { label: 'Last payslip', icon: 'payments', value: '₹1,42,800', hint: 'July 2026', iconStyle: 'color:var(--info);' },
      { label: 'Pending requests', icon: 'pending_actions', value: '1', hint: 'Leave · awaiting approval', iconStyle: 'color:var(--warning);' },
    ],
    queueTitle: 'My requests',
    queue: [
      { icon: 'event_busy', title: 'Casual leave · 19–21 Aug', meta: 'Applied 15 Aug · with Meera S.', amount: '3 days', action: 'Withdraw', tone: 'warning' },
      { icon: 'receipt', title: 'Expense claim · client visit', meta: 'Submitted 12 Aug · reimbursed', amount: '₹4,820', action: 'View', tone: 'success' },
      { icon: 'schedule', title: 'Shift change request', meta: 'A → B from 01 Sep', amount: '—', action: 'View', tone: 'info' },
    ],
    panelTitle: 'Leave used this year',
    bars: [
      { name: 'Casual', value: '6 / 12', barStyle: 'width:50%;' },
      { name: 'Earned', value: '5.5 / 12', barStyle: 'width:46%;' },
      { name: 'Sick', value: '2 / 6', barStyle: 'width:33%;' },
    ],
    chartTitle: 'My attendance', seriesA: 'Present', seriesB: 'Leave',
  };
  S['employees'] = list('Employees', 'Everyone on the rolls', ['Code', 'Name', 'Department', 'Designation', 'Shift', 'Joined', 'Status'], [
    ['#EMP-0004', '!Harsh Patel', 'Office', 'Director', 'General', '~01 Apr 2018', '@ok:Active'],
    ['#EMP-0021', '!Meera Shah', 'Office', 'Accounts manager', 'General', '~14 Jun 2020', '@ok:Active'],
    ['#EMP-0044', '!Ramesh Bhatt', 'Production', 'CNC operator', 'Shift A', '~02 Feb 2022', '@warn:On leave'],
    ['#EMP-0052', '!Dinesh Parmar', 'Production', 'CNC operator', 'Shift B', '~18 Jul 2026', '@info:Probation'],
    ['#EMP-0061', '!Alpesh Makwana', 'Quality', 'QC inspector', 'Shift A', '~01 Aug 2026', '@info:Probation'],
  ], { summary: [['Employees', '84'], ['Active', '79', 'success'], ['Probation', '5'], ['Attrition YTD', '4.2%']], views: [['All', 84], ['Active', 79], ['Probation', 5], ['Exited', 11]] });
  S['daily'] = list('Daily Attendance', '17 August 2026 · Shift A and B', ['Code', 'Employee', 'Shift', 'In', 'Out', '>Hours', '>OT', 'Status'], [
    ['#EMP-0044', 'Ramesh Bhatt', 'Shift A', '~—', '~—', '#0.0', '#0.0', '@warn:On leave'],
    ['#EMP-0052', 'Dinesh Parmar', 'Shift B', '~14:02', '~22:10', '#8.1', '#0.0', '@ok:Present'],
    ['#EMP-0061', 'Alpesh Makwana', 'Shift A', '~06:58', '~15:34', '#8.6', '#0.6', '@ok:Present'],
    ['#EMP-0070', 'Jignesh Vora', 'Shift A', '~—', '~—', '#0.0', '#0.0', '@bad:Absent'],
  ], { summary: [['Present', '76', 'success'], ['On leave', '5', 'warning'], ['Absent', '3', 'error'], ['Overtime', '18.4 hrs']], actions: [['Mark attendance', 'how_to_reg', 1], ['Import punches', 'upload', 0]] });
  S['attendance-reports'] = list('Attendance Reports', 'Monthly summary per employee', ['Code', 'Employee', '>Present', '>Leave', '>Absent', '>OT hours', '>Payable days'], [
    ['#EMP-0044', 'Ramesh Bhatt', '#14', '#2', '#0', '#4.2', '#16'],
    ['#EMP-0052', 'Dinesh Parmar', '#15', '#0', '#1', '#8.6', '#15'],
    ['#EMP-0061', 'Alpesh Makwana', '#16', '#0', '#0', '#12.4', '#16'],
    ['#EMP-0070', 'Jignesh Vora', '#12', '#1', '#3', '#0.0', '#13'],
  ], { views: [['August', ''], ['July', ''], ['June', '']], actions: [['Export', 'download', 1]] });
  S['shifts'] = master('Shifts', 'Working patterns', ['Shift', 'Start', 'End', 'Break', 'Employees', 'Status'], [
    ['!Shift A', '~07:00', '~15:30', '#30 min', '#38', '@ok:Active'],
    ['!Shift B', '~14:00', '~22:30', '#30 min', '#32', '@ok:Active'],
    ['!General', '~09:30', '~18:30', '#60 min', '#14', '@ok:Active'],
  ]);
  S['applications'] = list('Leave Applications', 'Requests waiting on a decision', ['Employee', 'Type', 'From', 'To', '>Days', 'Applied', 'Status'], [
    ['Ramesh Bhatt', 'Casual', '~19 Aug', '~21 Aug', '#3', '~15 Aug', '@warn:Pending'],
    ['Jignesh Vora', 'Sick', '~14 Aug', '~14 Aug', '#1', '~14 Aug', '@warn:Pending'],
    ['Meera Shah', 'Earned', '~01 Sep', '~05 Sep', '#5', '~12 Aug', '@ok:Approved'],
    ['Dinesh Parmar', 'Casual', '~08 Aug', '~08 Aug', '#1', '~06 Aug', '@bad:Rejected'],
  ], { summary: [['Pending', '5', 'warning'], ['Approved MTD', '18'], ['Rejected MTD', '2']], views: [['Pending', 5], ['Approved', 18], ['All', 62]], actions: [['Approve', 'check', 1], ['Reject', 'close', 0]] });
  S['calendar'] = list('Leave Calendar', 'Who is away, and when', ['Employee', 'Department', 'Type', 'From', 'To', '>Days', 'Cover'], [
    ['Ramesh Bhatt', 'Production', 'Casual', '~19 Aug', '~21 Aug', '#3', 'Dinesh P.'],
    ['Meera Shah', 'Office', 'Earned', '~01 Sep', '~05 Sep', '#5', 'Nikita R.'],
    ['Alpesh Makwana', 'Quality', 'Casual', '~28 Aug', '~28 Aug', '#1', '—'],
  ], { views: [['This month', ''], ['Next month', ''], ['Department', '']] });
  S['leave-types'] = master('Leave Types', 'Entitlements and rules', ['Type', 'Annual quota', 'Carry forward', 'Paid', 'Status'], [
    ['!Casual', '#12 days', 'No', 'Yes', '@ok:Active'],
    ['!Earned', '#12 days', 'Up to 30', 'Yes', '@ok:Active'],
    ['!Sick', '#6 days', 'No', 'Yes', '@ok:Active'],
    ['!Loss of pay', '#—', 'No', 'No', '@ok:Active'],
  ]);
  S['holidays'] = master('Holidays', 'Company holiday calendar 2026', ['Holiday', 'Date', 'Day', 'Type', 'Status'], [
    ['!Independence Day', '~15 Aug 2026', 'Saturday', 'National', '@ok:Declared'],
    ['!Ganesh Chaturthi', '~14 Sep 2026', 'Monday', 'Festival', '@ok:Declared'],
    ['!Diwali', '~08 Nov 2026', 'Sunday', 'Festival', '@ok:Declared'],
    ['!Uttarayan', '~14 Jan 2027', 'Thursday', 'Regional', '@ok:Declared'],
  ]);
  S['runs'] = list('Payroll Runs', 'Monthly salary processing', ['Period', 'Employees', '>Gross', '>Deductions', '>Net payable', 'Run on', 'Status'], [
    ['!August 2026', '#84', '$₹46,82,000', '#₹4,64,000', '$₹42,18,000', '~31 Aug', '@mute:Draft'],
    ['!July 2026', '#84', '$₹46,20,400', '#₹4,58,200', '$₹41,62,200', '~31 Jul', '@ok:Paid'],
    ['!June 2026', '#82', '$₹45,10,800', '#₹4,42,600', '$₹40,68,200', '~30 Jun', '@ok:Paid'],
  ], { summary: [['This month gross', '₹46,82,000'], ['Deductions', '₹4,64,000'], ['Net payable', '₹42,18,000', 'success'], ['PF + ESI', '₹3,18,400']], actions: [['Run payroll', 'play_arrow', 1], ['Bank file', 'download', 0]] });
  S['salary-structures'] = master('Salary Structures', 'How a CTC is split into components', ['Structure', 'Applies to', 'Components', '>Example CTC', 'Status'], [
    ['!Staff — monthly', 'Office, Quality', '#6', '$₹6,00,000', '@ok:Active'],
    ['!Workman — daily', 'Production', '#5', '$₹3,60,000', '@ok:Active'],
    ['!Contract', 'Temporary', '#3', '$₹2,40,000', '@ok:Active'],
  ]);
  S['salary-components'] = master('Salary Components', 'Earnings and deductions', ['Component', 'Type', 'Calculation', 'Taxable', 'Status'], [
    ['!Basic', 'Earning', '50% of CTC', 'Yes', '@ok:Active'],
    ['!HRA', 'Earning', '40% of basic', 'Partly', '@ok:Active'],
    ['!Overtime', 'Earning', 'Hours × rate', 'Yes', '@ok:Active'],
    ['!Provident fund', 'Deduction', '12% of basic', 'No', '@ok:Active'],
    ['!Professional tax', 'Deduction', 'Slab — Gujarat', 'No', '@ok:Active'],
  ]);
  S['departments'] = master('Departments', 'Organisation structure', ['Department', 'Head', 'Employees', 'Cost centre', 'Status'], [
    ['!Production', 'Ramesh Bhatt', '#48', 'CC-100', '@ok:Active'],
    ['!Quality', 'Alpesh Makwana', '#12', 'CC-200', '@ok:Active'],
    ['!Stores', 'Jignesh Vora', '#10', 'CC-300', '@ok:Active'],
    ['!Office', 'Meera Shah', '#14', 'CC-400', '@ok:Active'],
  ]);
  S['designations'] = master('Designations', 'Job titles and grades', ['Designation', 'Department', 'Grade', 'Employees', 'Status'], [
    ['!CNC operator', 'Production', 'W-3', '#22', '@ok:Active'],
    ['!QC inspector', 'Quality', 'S-2', '#8', '@ok:Active'],
    ['!Accounts manager', 'Office', 'M-1', '#1', '@ok:Active'],
    ['!Store keeper', 'Stores', 'S-1', '#4', '@ok:Active'],
  ]);
  S['employment-types'] = master('Employment Types', 'How people are engaged', ['Type', 'Notice period', 'Probation', 'Employees', 'Status'], [
    ['!Permanent', '#30 days', '#6 months', '#68', '@ok:Active'],
    ['!Contract', '#7 days', '#—', '#12', '@ok:Active'],
    ['!Apprentice', '#7 days', '#12 months', '#4', '@ok:Active'],
  ]);

  /* ───────── Users & Roles ───────── */
  S['users-roles/dashboard'] = {
    kind: 'dash', title: 'Access dashboard', sub: 'Who can reach what',
    kpis: [
      { label: 'Users', icon: 'manage_accounts', value: '32', hint: '28 staff · 4 party', iconStyle: 'color:var(--primary);' },
      { label: 'Roles', icon: 'admin_panel_settings', value: '7', hint: '2 custom', iconStyle: 'color:var(--info);' },
      { label: 'Active today', icon: 'bolt', value: '19', hint: 'Signed in since 06:00', iconStyle: 'color:var(--success);' },
      { label: 'Locked out', icon: 'lock', value: '1', hint: 'Failed password attempts', iconStyle: 'color:var(--error);', valueStyle: 'color:var(--error);' },
      { label: 'No 2FA', icon: 'shield', value: '6', hint: 'Admin accounts at risk', iconStyle: 'color:var(--warning);' },
      { label: 'Invites pending', icon: 'mail', value: '2', hint: 'Sent this week', iconStyle: 'color:var(--warning);' },
    ],
    queueTitle: 'Access to review',
    queue: [
      { icon: 'lock', title: 'Jignesh Vora locked out', meta: '5 failed attempts · 09:14 today', amount: '—', action: 'Unlock', tone: 'error' },
      { icon: 'shield', title: '6 admins without 2FA', meta: 'Policy requires it for admin roles', amount: '6', action: 'Enforce', tone: 'warning' },
      { icon: 'mail', title: '2 invitations not accepted', meta: 'Sent 5 days ago', amount: '2', action: 'Resend', tone: 'info' },
    ],
    panelTitle: 'Users by role',
    bars: [
      { name: 'Staff', value: '18', barStyle: 'width:56%;' },
      { name: 'Accounts', value: '6', barStyle: 'width:19%;' },
      { name: 'Admin', value: '4', barStyle: 'width:13%;' },
      { name: 'Party', value: '4', barStyle: 'width:12%;' },
    ],
    chartTitle: 'Sign-ins', seriesA: 'Staff', seriesB: 'Party',
  };
  S['users'] = list('Users', 'People who can sign in', ['Name', 'Email', 'Role', 'Kind', 'Last seen', '2FA', 'Status'], [
    ['!Harsh Patel', 'harsh@jayhind.co.in', 'Admin', 'Staff', '~2 min ago', '@ok:On', '@ok:Active'],
    ['!Meera Shah', 'meera@jayhind.co.in', 'Accounts', 'Staff', '~14 min ago', '@ok:On', '@ok:Active'],
    ['!Nikita Rathod', 'nikita@jayhind.co.in', 'Sales', 'Staff', '~1 hour ago', '@warn:Off', '@ok:Active'],
    ['!Jignesh Vora', 'jignesh@jayhind.co.in', 'Stores', 'Staff', '~09:14 today', '@warn:Off', '@bad:Locked'],
    ['!Rajkot Tools & Dies', 'accounts@rajkottools.in', 'Party portal', 'Party', '~Yesterday', '@ok:On', '@ok:Active'],
  ], { summary: [['Users', '32'], ['Staff', '28'], ['Party', '4'], ['Locked', '1', 'error']], views: [['All', 32], ['Staff', 28], ['Party', 4], ['Disabled', 3]], actions: [['Invite user', 'person_add', 1], ['Export', 'download', 0]] });
  S['roles'] = list('Roles', 'Permission sets applied to users', ['Role', 'Users', 'Modules', 'Can approve', 'Value limit', 'Kind', 'Status'], [
    ['!Admin', '#4', '#All', 'Yes', '$Unlimited', 'System', '@ok:Active'],
    ['!Accounts', '#6', '#4', 'Yes', '$₹2,00,000', 'System', '@ok:Active'],
    ['!Sales', '#8', '#3', 'No', '$—', 'System', '@ok:Active'],
    ['!Stores', '#6', '#2', 'No', '$—', 'System', '@ok:Active'],
    ['!Shop supervisor', '#4', '#2', 'Yes', '$₹50,000', 'Custom', '@ok:Active'],
    ['!Party portal', '#4', '#1', 'No', '$—', 'System', '@ok:Active'],
  ], { actions: [['New role', 'add', 1], ['Permission matrix', 'grid_on', 0]] });
  S['user-configuration'] = {
    kind: 'settings', title: 'User Configuration', sub: 'Sign-in and session policy',
    settingGroups: [
      { label: 'Security', items: [
        { label: 'Require two-factor for admins', hint: 'Authenticator app at sign-in', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Lock after failed attempts', hint: 'Account locks until an admin releases it', isValue: true, value: '5 attempts' },
        { label: 'Password expiry', hint: 'Force a change on this cycle', isValue: true, value: '90 days' },
      ] },
      { label: 'Sessions', items: [
        { label: 'Idle timeout', hint: 'Sign out after inactivity', isValue: true, value: '30 minutes' },
        { label: 'Allow multiple devices', hint: 'Same account signed in twice', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Restrict party portal by IP', hint: 'Only from the party office network', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
      ] },
    ],
  };

  /* ───────── Company / misc ───────── */
  S['site-configrations'] = {
    kind: 'settings', title: 'Company Configuration', sub: 'Legal identity, defaults and branding',
    settingGroups: [
      { label: 'Identity', items: [
        { label: 'Legal name', hint: 'Printed on every statutory document', isValue: true, value: 'Jayhind Industries' },
        { label: 'GSTIN', hint: 'Gujarat · verified 12 Aug 2026', isValue: true, value: '24AACFJ8821K1Z9' },
        { label: 'PAN', hint: '', isValue: true, value: 'AACFJ8821K' },
        { label: 'Financial year starts', hint: '', isValue: true, value: '1 April' },
      ] },
      { label: 'Documents', items: [
        { label: 'Invoice template', hint: 'Used for print and PDF', isValue: true, value: 'GST Tax Invoice — A4' },
        { label: 'Show bank details on invoice', hint: 'Account number, IFSC and UPI QR', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Digital signature', hint: 'Applied to outgoing PDFs', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
      ] },
      { label: 'Compliance', items: [
        { label: 'e-Invoice registration', hint: 'Register with the IRP on approval', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'e-Way Bill threshold', hint: 'Above this value a bill is required', isValue: true, value: '₹50,000' },
        { label: 'Auto-file GSTR-1', hint: 'File on the 10th once reviewed', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
      ] },
    ],
  };
  S['chat'] = {
    kind: 'chat', title: 'Chat', sub: 'Internal messaging',
    threads: [
      { initials: 'AT', name: 'Accounts team', last: 'Meera: PB-0312 needs your approval', when: '09:42', style: 'background:var(--primary-container);' },
      { initials: 'SF', name: 'Shop floor', last: 'Ramesh: VMC-02 down for maintenance', when: '09:10' },
      { initials: 'NR', name: 'Nikita Rathod', last: 'Sent the Rajkot quotation', when: 'Yest.' },
      { initials: 'ST', name: 'Stores', last: 'Jignesh: flange stock at 280', when: 'Yest.' },
      { initials: 'QC', name: 'Quality', last: 'Alpesh: 2 rejections on GC-220', when: 'Fri' },
    ],
    messages: [
      { who: 'Meera Shah', text: 'PB-0312 from Mahavir Steel is above your limit — ₹2,84,600. Can you approve?', when: '09:31', rowStyle: 'justify-content:flex-start;', bubbleStyle: 'background:var(--surface); border:1px solid var(--border);' },
      { who: 'You', text: 'Is it matched against PO-0420?', when: '09:36', rowStyle: 'justify-content:flex-end;', bubbleStyle: 'background:var(--primary); color:var(--on-primary);' },
      { who: 'Meera Shah', text: 'Yes, matched. Rate is ₹4 higher per kg than the PO — freight was billed separately.', when: '09:38', rowStyle: 'justify-content:flex-start;', bubbleStyle: 'background:var(--surface); border:1px solid var(--border);' },
      { who: 'You', text: 'Fine. Approving now — attach the freight bill to the voucher.', when: '09:41', rowStyle: 'justify-content:flex-end;', bubbleStyle: 'background:var(--primary); color:var(--on-primary);' },
      { who: 'Meera Shah', text: 'Done. Also GSTR-3B draft is ready for review.', when: '09:42', rowStyle: 'justify-content:flex-start;', bubbleStyle: 'background:var(--surface); border:1px solid var(--border);' },
    ],
  };
  S['file-manager'] = { kind: 'files', title: 'Files', sub: 'Every document uploaded against a voucher, product or party', files: [
    { name: 'MST-0412 scan.pdf', meta: '1.4 MB · 14 Aug', icon: 'picture_as_pdf', thumbStyle: 'background:var(--error-bg);', iconStyle: 'color:var(--error);' },
    { name: 'INV-2526-0148.pdf', meta: '220 KB · 14 Aug', icon: 'receipt_long', thumbStyle: 'background:var(--primary-container);', iconStyle: 'color:var(--primary);' },
    { name: 'PO-0420 signed.pdf', meta: '640 KB · 12 Aug', icon: 'picture_as_pdf', thumbStyle: 'background:var(--error-bg);', iconStyle: 'color:var(--error);' },
    { name: 'GC-220 drawing.dwg', meta: '3.1 MB · 09 Aug', icon: 'architecture', thumbStyle: 'background:var(--info-bg);', iconStyle: 'color:var(--info);' },
    { name: 'Bank statement Jul.xlsx', meta: '84 KB · 02 Aug', icon: 'table_chart', thumbStyle: 'background:var(--success-bg);', iconStyle: 'color:var(--success);' },
    { name: 'GSTR-1 Jul.json', meta: '412 KB · 11 Aug', icon: 'data_object', thumbStyle: 'background:var(--surface-2);', iconStyle: 'color:var(--muted);' },
    { name: 'Challan CH-0292.pdf', meta: '180 KB · 14 Aug', icon: 'local_shipping', thumbStyle: 'background:var(--warning-bg);', iconStyle: 'color:var(--warning);' },
    { name: 'Company PAN.jpg', meta: '620 KB · 04 Apr', icon: 'image', thumbStyle: 'background:var(--surface-2);', iconStyle: 'color:var(--muted);' },
  ] };
  S['audit-logs'] = list('Audit Log', 'Every change, with who and when', ['When', 'User', 'Action', 'Record', 'Field', 'Old → new', 'Source'], [
    ['~09:41 today', 'Harsh Patel', '@ok:Approved', 'PB-0312', '~status', 'Pending → Approved', 'Web'],
    ['~09:12 today', 'Meera Shah', '@info:Created', 'RCP-0519', '~—', '—', 'Web'],
    ['~08:58 today', 'Nikita Rathod', '@warn:Edited', 'INV-2526-0146', '~rate', '₹1,480 → ₹1,440', 'Web'],
    ['~Yesterday', 'System', '@info:Registered', 'INV-2526-0148', '~irn', '— → 1a2b3c4d…', 'IRP'],
    ['~Yesterday', 'Jignesh Vora', '@bad:Failed sign-in', 'jignesh@…', '~—', '5 attempts', 'Mobile'],
  ], { summary: [['Events today', '184'], ['Edits', '22', 'warning'], ['Deletions', '0'], ['Failed sign-ins', '5', 'error']], views: [['All', ''], ['Approvals', ''], ['Edits', ''], ['Sign-ins', '']] });
  S['company-export'] = {
    kind: 'settings', title: 'Export / Offboarding', sub: 'Take your books with you, any time',
    settingGroups: [
      { label: 'What to include', items: [
        { label: 'Masters', hint: 'Parties, products, accounts — 2,184 records', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Transactions', hint: 'All vouchers across every financial year', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Attachments', hint: '4.2 GB of scans and documents', isToggle: true, toggleStyle: 'background:var(--primary);', knobStyle: 'right:2px;' },
        { label: 'Audit log', hint: 'Full change history', isToggle: true, toggleStyle: 'background:var(--surface-2);', knobStyle: 'left:2px;' },
      ] },
      { label: 'Format', items: [
        { label: 'Export format', hint: 'CSV opens anywhere; Tally XML imports directly', isValue: true, value: 'CSV + Tally XML' },
        { label: 'Delivery', hint: 'Where the archive is placed', isValue: true, value: 'Download link' },
      ] },
    ],
  };

  /* ───────── Party portal ───────── */
  S['party-dashboard'] = {
    kind: 'dash', title: 'My account', sub: 'Rajkot Tools & Dies · self-service',
    kpis: [
      { label: 'Outstanding', icon: 'account_balance', value: '₹6,64,520', hint: '6 open invoices', iconStyle: 'color:var(--warning);', valueStyle: 'color:var(--warning);' },
      { label: 'Overdue', icon: 'event_busy', value: '₹0', hint: 'Nothing past due', iconStyle: 'color:var(--success);' },
      { label: 'Credit limit', icon: 'credit_score', value: '₹10,00,000', hint: '66% used', iconStyle: 'color:var(--info);' },
      { label: 'Purchases YTD', icon: 'trending_up', value: '₹21,84,000', hint: 'Since 1 April', iconStyle: 'color:var(--primary);' },
      { label: 'Open orders', icon: 'list_alt', value: '2', hint: 'Next delivery 22 Aug', iconStyle: 'color:var(--info);' },
      { label: 'Job work', icon: 'precision_manufacturing', value: '4', hint: 'Orders in process', iconStyle: 'color:var(--primary);' },
    ],
    queueTitle: 'Recent activity',
    queue: [
      { icon: 'receipt_long', title: 'Invoice INV-2526-0144', meta: 'Due 30 Aug · part paid', amount: '₹2,34,120', action: 'Pay', tone: 'warning' },
      { icon: 'local_shipping', title: 'Delivery challan DC-0401', meta: 'Delivered 13 Aug', amount: '₹5,00,000', action: 'View', tone: 'success' },
      { icon: 'payments', title: 'Receipt RCP-0518 recorded', meta: 'RTGS · 13 Aug', amount: '₹5,00,000', action: 'View', tone: 'success' },
      { icon: 'precision_manufacturing', title: 'JW-0405 · Flange 6" drilling', meta: '520 of 600 done · due 23 Aug', amount: '87%', action: 'Track', tone: 'primary' },
    ],
    panelTitle: 'Balance ageing',
    bars: [
      { name: '0–30 days', value: '₹6,64,520', barStyle: 'width:100%;' },
      { name: '31–60 days', value: '₹0', barStyle: 'width:0%;' },
      { name: '60+ days', value: '₹0', barStyle: 'width:0%;' },
    ],
    chartTitle: 'My purchases', seriesA: 'Invoiced', seriesB: 'Paid',
  };
  S['transactions'] = list('My Transactions', 'Everything billed to Rajkot Tools & Dies', ['Voucher', 'Type', 'Date', 'Due date', '>Amount', '>Balance', 'Status'], [
    ['!INV-2526-0144', 'Sales invoice', '~11 Aug', '~30 Aug', '$₹7,34,120', '#₹2,34,120', '@warn:Part paid'],
    ['!DC-0401', 'Delivery challan', '~13 Aug', '~—', '$₹5,00,000', '#—', '@ok:Delivered'],
    ['!INV-2526-0022', 'Sales invoice', '~18 Apr', '~18 May', '$₹6,18,400', '#—', '@ok:Paid'],
    ['!QT-0219', 'Quotation', '~14 Aug', '~28 Aug', '$₹8,12,000', '#—', '@info:Open'],
  ], { views: [['All', 42], ['Unpaid', 6], ['Paid', 36]], actions: [['Download PDF', 'download', 1]] });
  S['payments'] = list('Payments & Receipts', 'Money you have sent us', ['Reference', 'Date', 'Mode', 'Against', '>Amount', 'Status'], [
    ['!RCP-0518', '~13 Aug', 'RTGS', 'INV-2526-0144', '$₹5,00,000', '@ok:Received'],
    ['!RCP-0388', '~02 May', 'RTGS', 'INV-2526-0022', '$₹6,00,000', '@ok:Received'],
    ['!RCP-0241', '~14 Apr', 'Cheque', 'Opening balance', '$₹4,12,000', '@ok:Received'],
  ], { summary: [['Paid YTD', '₹15,12,000'], ['Outstanding', '₹6,64,520', 'warning']], actions: [['Pay now', 'payments', 1]] });
  S['statement'] = S['party-statement'];
  S['party-job-work'] = list('My Job Work', 'Orders we are running for you', ['Order', 'Part', 'Operation', '>Ordered', '>Completed', 'Promised', 'Status'], [
    ['!JW-0405', 'Flange 6"', 'Drilling', '#600', '#520', '~23 Aug', '@ok:On track'],
    ['!JW-0418', 'Housing A2', 'CNC turning', '#400', '#0', '~22 Aug', '@info:Material issued'],
    ['!JW-0421', 'Flange Kit FK-6', 'Assembly', '#600', '#0', '~24 Aug', '@mute:Planned'],
    ['!JW-0391', 'Housing A2', 'Finishing', '#400', '#400', '~10 Aug', '@ok:Delivered'],
  ], { summary: [['Live orders', '4'], ['Completed qty', '920'], ['Due this week', '2', 'warning']] });

  var alias = {
    'pending-approvals': 'approvals',
    'transaction/dues': 'dues',
    'product/product-list': 'product-list',
    'sales-entry': 'sales-entry'
  };
  Object.keys(alias).forEach(function (k) { if (!S[k] && S[alias[k]]) S[k] = S[alias[k]]; });

  window.__JH_SCREENS = S;
})();
