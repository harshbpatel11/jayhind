/* Dialogs, popups, menus and toasts for "Jayhind ERP — All Screens". Loads after erp-screens.js. */
(function () {
  var D = {};
  var S = window.__JH_DIALOG_SCREENS = {};

  var f = function (label, value, icon, hint, full) {
    return { label: label, value: value, icon: icon || '', hint: hint || '', full: !!full };
  };
  var note = function (tone, icon, text) { return { kind: 'note', tone: tone, icon: icon, text: text }; };
  var fields = function (title, items) { return { kind: 'fields', title: title, items: items }; };
  var picker = function (placeholder, cols, rows, footNote) {
    return { kind: 'picker', placeholder: placeholder, cols: cols, rows: rows, footNote: footNote || '' };
  };
  var table = function (title, cols, rows) { return { kind: 'table', title: title, cols: cols, rows: rows }; };
  var toggles = function (title, items) { return { kind: 'toggles', title: title, items: items }; };
  var steps = function (title, items) { return { kind: 'steps', title: title, items: items }; };
  var on = function (label, hint) { return { label: label, hint: hint || '', on: true }; };
  var off = function (label, hint) { return { label: label, hint: hint || '', on: false }; };

  var dlg = function (id, group, name, desc, title, sub, width, sections, footer) {
    D[id] = { id: id, group: group, name: name, desc: desc, title: title, sub: sub, width: width, sections: sections, footer: footer };
  };

  /* ─────────── Pickers ─────────── */
  dlg('party-picker', 'Pickers', 'Party picker', 'Search customers and vendors while entering a voucher',
    'Select customer', 'Type to search, or press ↓ to browse', 560, [
      picker('Search by name, GSTIN or phone…',
        ['Party', 'GSTIN', 'City', '>Balance', 'Terms'], [
          ['!Rajkot Tools & Dies', '~24AABCR4412J1Z8', 'Rajkot', '$₹6,64,520', '~30 days'],
          ['!Shree Balaji Engineering', '~24AABCS1188K1ZQ', 'Ahmedabad', '$₹0', '~15 days'],
          ['!Patel Auto Components', '~24AABCP7741L1ZR', 'Rajkot', '$₹1,38,400', '~30 days'],
          ['!Kiran Metal Works', '~24AABCK2210M1ZT', 'Jamnagar', '$₹96,750', '~45 days'],
          ['!Suryodaya Steels', '~24AABCS9930N1ZU', 'Morbi', '$₹0', '~30 days'],
        ], 'Enter to select · ⌘N to create a new party'),
    ], [['Cancel', '', 'ghost'], ['Create new party', 'person_add', 'ghost'], ['Select', 'check', 'primary']]);

  dlg('product-picker', 'Pickers', 'Product picker', 'Add a line item by name, code or barcode',
    'Add item', 'Stock shown for Rajkot main store', 620, [
      picker('Search product, code or scan barcode…',
        ['Code', 'Product', 'HSN', '>Available', '>Rate'], [
          ['#FLG-6150', '!MS Flange 6" ANSI 150', '#7307', '#100', '$₹1,480'],
          ['#HSG-A2', '!CNC Machined Housing A2', '#8483', '#120', '$₹2,140'],
          ['#PB-18', '!Precision Bush PB-18', '#8483', '#640', '$₹94'],
          ['#ROD-40', '!Hydraulic Cylinder Rod 40mm', '#7228', '#96', '$₹880'],
          ['#ANG-50', '!MS Angle 50×50×6', '#7216', '#4,820', '$₹68'],
        ], 'Reserved quantity is already excluded from Available'),
      fields('Line details', [f('Quantity', '260', '', 'Available 100 — short by 160'), f('Rate', '₹1,480.00', '', 'Standard price list'), f('Discount', '2%', '', ''), f('GST', '18% (9 + 9)', 'lock', 'From HSN 7307')]),
    ], [['Cancel', '', 'ghost'], ['Add & new', 'add', 'ghost'], ['Add line', 'check', 'primary']]);

  dlg('account-picker', 'Pickers', 'Ledger account picker', 'Pick a general ledger account on journal and contra entries',
    'Select account', 'Chart of accounts · 214 accounts', 520, [
      picker('Search account or code…',
        ['Code', 'Account', 'Group', '>Balance'], [
          ['#1100', '!Cash in hand', 'Current assets', '$₹4,86,000'],
          ['#1110', '!HDFC Current ****4412', 'Bank accounts', '$₹28,41,000'],
          ['#5210', '!Fuel expenses', 'Indirect expense', '$₹18,62,000'],
          ['#5240', '!Staff welfare', 'Indirect expense', '$₹3,84,200'],
          ['#5310', '!Bank charges', 'Indirect expense', '$₹42,180'],
        ], ''),
    ], [['Cancel', '', 'ghost'], ['Select', 'check', 'primary']]);

  dlg('command-palette', 'Pickers', 'Command palette', 'The ⌘K jump bar — screens, records and actions in one list',
    'Jump to…', '', 560, [
      picker('Type a screen, party, invoice or command…',
        ['', 'Result', 'Type', 'Shortcut'], [
          ['@info:Go', '!Sales invoice list', 'Screen', '~G then S'],
          ['@info:Go', '!Pending approvals', 'Screen', '~G then A'],
          ['@ok:New', '!New sales invoice', 'Action', '~F8'],
          ['@ok:New', '!New purchase bill', 'Action', '~F9'],
          ['@mute:Record', '!INV-2526-0148 · Shree Balaji', 'Invoice', '~—'],
          ['@mute:Record', '!Rajkot Tools & Dies', 'Party', '~—'],
        ], '↑↓ to move · Enter to open · Esc to close'),
    ], []);

  /* ─────────── Voucher actions ─────────── */
  dlg('approve-voucher', 'Voucher actions', 'Approve voucher', 'Second-pair-of-eyes approval above the value limit',
    'Approve PB-0312?', 'Mahavir Steel Traders · ₹2,84,600', 460, [
      note('warning', 'info', 'This is above your ₹2,00,000 limit, so the approval is logged against your name in the audit trail.'),
      table('What you are approving', ['Item', '>Value'], [
        ['Taxable value', '#₹2,41,186.44'],
        ['CGST + SGST 18%', '#₹43,413.56'],
        ['!Total', '$₹2,84,600.00'],
        ['Matched against', '~PO-0420'],
      ]),
      fields('', [f('Remark', 'Rate ₹4/kg above PO — freight billed separately', '', 'Visible to the preparer', true)]),
    ], [['Cancel', '', 'ghost'], ['Reject', 'close', 'danger'], ['Approve', 'check', 'primary']]);

  dlg('reject-voucher', 'Voucher actions', 'Reject voucher', 'Send a voucher back with a reason',
    'Reject PB-0312?', 'It returns to Meera S. as a draft', 440, [
      note('error', 'warning', 'Rejecting releases any reserved stock and cancels the linked e-Way Bill request.'),
      fields('', [f('Reason', 'Rate mismatch against PO-0420', 'expand_more', ''), f('Note to preparer', 'Please confirm the revised rate in writing before resubmitting.', '', '', true)]),
    ], [['Cancel', '', 'ghost'], ['Reject voucher', 'close', 'danger']]);

  dlg('cancel-voucher', 'Voucher actions', 'Cancel voucher', 'Cancel an approved voucher and reverse its effect',
    'Cancel INV-2526-0142?', 'Suryodaya Steels · ₹3,22,600', 460, [
      note('error', 'warning', 'The e-Invoice can only be cancelled within 24 hours of registration. This one was registered 8 days ago — you will need a credit note instead.'),
      fields('', [f('Cancellation reason', 'Duplicate invoice', 'expand_more', ''), f('Remark', '', '', 'Recorded on the audit log', true)]),
    ], [['Keep voucher', '', 'ghost'], ['Raise credit note', 'arrow_downward', 'primary']]);

  dlg('record-payment', 'Voucher actions', 'Record receipt / payment', 'Allocate money against open invoices',
    'Record receipt', 'Rajkot Tools & Dies · outstanding ₹6,64,520', 620, [
      fields('Receipt', [f('Amount', '₹5,00,000.00', '', ''), f('Date', '17-08-2026', 'calendar_today', ''), f('Mode', 'RTGS', 'expand_more', ''), f('Deposit to', 'HDFC Current ****4412', 'expand_more', ''), f('Reference', 'UTR 448120993', '', ''), f('Notify party', 'Email + WhatsApp', 'expand_more', '')]),
      table('Allocate against', ['Invoice', 'Due', '>Balance', '>Allocating'], [
        ['!INV-2526-0144', '~30 Aug', '#₹2,34,120', '$₹2,34,120'],
        ['!INV-2526-0148', '~13 Sep', '#₹4,12,500', '$₹2,65,880'],
        ['!INV-2526-0146', '~22 Aug', '#₹96,750', '$₹0'],
        ['!Unallocated', '~—', '#—', '$₹0'],
      ]),
    ], [['Cancel', '', 'ghost'], ['Save & print receipt', 'print', 'ghost'], ['Save receipt', 'check', 'primary']]);

  dlg('e-invoice', 'Compliance', 'Register e-Invoice', 'Send the invoice to the IRP and pull back the IRN',
    'Register e-Invoice', 'INV-2526-0149 · ₹5,49,273.00', 480, [
      steps('Progress', [
        { label: 'Validating GSTIN and HSN codes', state: 'done' },
        { label: 'Building the IRN payload', state: 'done' },
        { label: 'Sending to the IRP', state: 'active' },
        { label: 'Storing IRN, QR code and signed JSON', state: 'todo' },
      ]),
      note('info', 'info', 'Once registered, the invoice cannot be edited — corrections need a credit note or a cancellation within 24 hours.'),
    ], [['Run in background', '', 'ghost'], ['Cancel', 'close', 'danger']]);

  dlg('e-way-bill', 'Compliance', 'Generate e-Way Bill', 'Transport details needed before dispatch',
    'Generate e-Way Bill', 'INV-2526-0149 · ₹5,49,273.00 · above the ₹50,000 threshold', 560, [
      fields('Transport', [f('Transport mode', 'Road', 'expand_more', ''), f('Vehicle number', 'GJ-03-AB-4412', '', 'Last used for this party'), f('Transporter', 'Shree Transport', 'expand_more', 'GSTIN 24AABCS4412J1Z2'), f('Distance', '182 km', '', 'Rajkot → Ahmedabad'), f('Validity', '2 days', 'lock', 'From distance slab'), f('Dispatch from', 'Rajkot main store', 'expand_more', '')]),
      note('warning', 'schedule', 'Part-B must be filled before the vehicle leaves. Generating now locks the invoice against edits.'),
    ], [['Cancel', '', 'ghost'], ['Generate Part-A only', '', 'ghost'], ['Generate', 'local_shipping', 'primary']]);

  dlg('gst-file', 'Compliance', 'File GST return', 'Final confirmation before filing with the portal',
    'File GSTR-3B for July 2026?', 'Net payable ₹3,19,450 · due 20 Aug', 500, [
      table('Summary', ['Head', '>Output', '>Input credit', '>Net'], [
        ['IGST', '#₹0', '#₹0', '#₹0'],
        ['CGST', '#₹6,15,789', '#₹4,56,064', '#₹1,59,725'],
        ['SGST', '#₹6,15,789', '#₹4,56,064', '#₹1,59,725'],
        ['!Total', '$₹12,31,578', '$₹9,12,128', '$₹3,19,450'],
      ]),
      note('warning', 'warning', '3 purchase invoices are unmatched against GSTR-2B. Filing now forfeits ₹41,200 of input credit for this period.'),
    ], [['Review unmatched', '', 'ghost'], ['Save draft', '', 'ghost'], ['File return', 'check', 'primary']]);

  /* ─────────── Data & grid ─────────── */
  dlg('column-config', 'Data & grid', 'Configure columns', 'Choose, reorder and freeze grid columns',
    'Configure columns', 'Sales invoice list', 460, [
      toggles('Visible columns', [
        on('Invoice no', 'Frozen · always first'), on('Party', 'Frozen'), on('Date', ''), on('Status', ''),
        on('Amount', ''), on('Balance', ''), on('e-Invoice', ''), on('e-Way Bill', ''),
        off('Prepared by', ''), off('Remarks', ''), off('Place of supply', ''), off('Due date', ''),
      ]),
      note('info', 'drag_indicator', 'Drag a row to reorder. Column choices are saved per user, per screen.'),
    ], [['Reset to default', '', 'ghost'], ['Cancel', '', 'ghost'], ['Apply', 'check', 'primary']]);

  dlg('filter-builder', 'Data & grid', 'Advanced filter', 'Build a multi-condition filter and save it as a view',
    'Filter sales invoices', 'All conditions must match', 560, [
      table('Conditions', ['Field', 'Operator', 'Value', ''], [
        ['Date', 'is between', '01-08-2026 → 31-08-2026', '@mute:×'],
        ['Status', 'is any of', 'Approved, Pending', '@mute:×'],
        ['Balance', 'is greater than', '₹0', '@mute:×'],
        ['Party', 'is', 'Rajkot Tools & Dies', '@mute:×'],
      ]),
      fields('Save as a view', [f('View name', 'Rajkot — unpaid this month', '', ''), f('Share with', 'Only me', 'expand_more', '')]),
    ], [['Clear all', '', 'ghost'], ['Apply once', '', 'ghost'], ['Save view', 'bookmark', 'primary']]);

  dlg('export', 'Data & grid', 'Export', 'Download the current grid or a full report',
    'Export sales invoices', '143 rows match the current filter', 460, [
      fields('', [f('Format', 'Excel (.xlsx)', 'expand_more', ''), f('Range', 'All 143 filtered rows', 'expand_more', 'Or just this page'), f('Delivery', 'Download now', 'expand_more', 'Large exports arrive by email')]),
      toggles('Include', [on('Visible columns only', ''), off('Line items (one row per item)', 'Turns 143 rows into 612'), on('Totals row', ''), off('Applied filters as a header', '')]),
    ], [['Cancel', '', 'ghost'], ['Export', 'download', 'primary']]);

  dlg('import', 'Data & grid', 'Import from file', 'Map spreadsheet columns to fields before importing',
    'Import products', 'catalogue-aug.xlsx · 248 rows detected', 560, [
      table('Column mapping', ['Spreadsheet column', 'Maps to', 'Sample', 'Status'], [
        ['Item Code', 'Product code', 'FLG-6150', '@ok:Mapped'],
        ['Description', 'Product name', 'MS Flange 6"…', '@ok:Mapped'],
        ['HSN', 'HSN code', '7307', '@ok:Mapped'],
        ['UOM', 'Measurement unit', 'NOS', '@warn:Fuzzy match'],
        ['Rate', 'Selling rate', '1480', '@ok:Mapped'],
        ['Ignore', '—', '—', '@mute:Skipped'],
      ]),
      note('warning', 'warning', '6 rows have an unknown unit and will be skipped unless you map UOM manually.'),
    ], [['Back', '', 'ghost'], ['Validate only', '', 'ghost'], ['Import 242 rows', 'upload', 'primary']]);

  dlg('bulk-action', 'Data & grid', 'Bulk action', 'Apply one action to many selected rows',
    'Approve 6 vouchers?', 'Selected on the pending approvals grid', 480, [
      table('Selection', ['Voucher', 'Party', '>Amount', 'Check'], [
        ['!PB-0312', 'Mahavir Steel Traders', '$₹2,84,600', '@warn:Above your limit'],
        ['!SO-0188', 'Rajkot Tools & Dies', '$₹7,34,120', '@warn:Above your limit'],
        ['!PO-0421', 'Girnar Castings', '$₹1,12,000', '@ok:Within limit'],
        ['!JV-0077', '—', '$₹42,000', '@ok:Within limit'],
        ['!CN-0031', 'Yash Fabricators', '$₹18,900', '@ok:Within limit'],
        ['!PR-0122', 'Production', '$₹1,42,000', '@ok:Within limit'],
      ]),
      note('info', 'info', 'Each approval is recorded separately in the audit log with your name and the current time.'),
    ], [['Cancel', '', 'ghost'], ['Approve all 6', 'check', 'primary']]);

  dlg('delete-confirm', 'Data & grid', 'Delete confirmation', 'The destructive-action guard',
    'Delete draft INV-2526-0143?', 'Anand Precision Pvt Ltd · ₹1,41,000', 420, [
      note('error', 'delete', 'This cannot be undone. Drafts are removed completely; approved vouchers can only be cancelled, never deleted.'),
      fields('', [f('Type the voucher number to confirm', 'INV-2526-0143', '', '')]),
    ], [['Keep it', '', 'ghost'], ['Delete draft', 'delete', 'danger']]);

  dlg('unsaved-changes', 'Data & grid', 'Unsaved changes', 'Guard when leaving a half-filled form',
    'Leave without saving?', 'New sales invoice · 4 line items entered', 420, [
      note('warning', 'warning', 'Your invoice has not been saved. Leaving now discards the party, the four line items and the transport details.'),
    ], [['Keep editing', '', 'ghost'], ['Discard', 'close', 'danger'], ['Save draft & leave', 'save', 'primary']]);

  /* ─────────── Print & share ─────────── */
  dlg('print-preview', 'Print & share', 'Print preview', 'Choose a template and copies before printing',
    'Print INV-2526-0148', 'Shree Balaji Engineering · ₹4,12,500', 520, [
      fields('', [f('Template', 'GST Tax Invoice — A4', 'expand_more', ''), f('Copies', 'Original + Duplicate + Triplicate', 'expand_more', ''), f('Printer', 'Front office — HP LaserJet', 'expand_more', ''), f('Paper', 'A4', 'expand_more', '')]),
      toggles('Include', [on('Bank details and UPI QR', ''), on('e-Invoice QR code', ''), on('Digital signature', ''), off('Terms & conditions on a second page', '')]),
    ], [['Cancel', '', 'ghost'], ['Download PDF', 'download', 'ghost'], ['Print', 'print', 'primary']]);

  dlg('share-invoice', 'Print & share', 'Send to party', 'Email or WhatsApp the document to the party',
    'Send INV-2526-0148', 'Shree Balaji Engineering', 480, [
      fields('', [f('Channel', 'Email + WhatsApp', 'expand_more', ''), f('To', 'accounts@balajieng.in', '', 'Primary billing contact'), f('WhatsApp', '+91 98250 44120', '', ''), f('Subject', 'Invoice INV-2526-0148 from Jayhind Industries', '', '', true), f('Message', 'Please find attached our invoice for ₹4,12,500 due on 13 September 2026.', '', '', true)]),
      toggles('Attach', [on('Tax invoice PDF', ''), on('e-Way Bill', ''), off('Delivery challan', ''), off('Statement of account', '')]),
    ], [['Cancel', '', 'ghost'], ['Send', 'send', 'primary']]);

  dlg('payment-reminder', 'Print & share', 'Payment reminder', 'Chase an overdue invoice',
    'Send a reminder', 'Patel Auto Components · ₹1,38,400 overdue by 6 days', 480, [
      fields('', [f('Tone', 'Firm — second reminder', 'expand_more', ''), f('Channel', 'Email + WhatsApp', 'expand_more', ''), f('To', 'accounts@patelauto.in', '', ''), f('Schedule', 'Send now', 'expand_more', 'Or queue for 10:00 tomorrow')]),
      note('info', 'history', 'First reminder was sent on 13 Aug. No reply recorded since.'),
    ], [['Cancel', '', 'ghost'], ['Preview', '', 'ghost'], ['Send reminder', 'send', 'primary']]);

  /* ─────────── Stock & shop floor ─────────── */
  dlg('stock-adjustment', 'Stock & shop floor', 'Stock adjustment', 'Correct on-hand quantity after a physical count',
    'Adjust stock', 'MS Flange 6" ANSI 150 · Rajkot main', 520, [
      fields('', [f('System quantity', '280 nos', 'lock', ''), f('Counted quantity', '274 nos', '', 'Physical count on 17 Aug'), f('Difference', '−6 nos', 'lock', 'Value ₹7,572 at ₹1,262'), f('Reason', 'Damage in handling', 'expand_more', ''), f('Charge to', 'Stock loss account', 'expand_more', ''), f('Counted by', 'Jignesh Vora', 'expand_more', '')]),
      note('warning', 'warning', 'Adjustments post a journal entry and are permanently visible in the stock ledger.'),
    ], [['Cancel', '', 'ghost'], ['Post adjustment', 'check', 'primary']]);

  dlg('reorder-po', 'Stock & shop floor', 'Create POs from reorder', 'Turn reorder alerts into draft purchase orders',
    'Create purchase orders', '12 products below reorder level · grouped into 4 vendors', 580, [
      table('Suggested orders', ['Vendor', 'Items', '>Suggested qty', '>Value', 'Lead time'], [
        ['!Sanghavi Alloys', '#4', '#1,240', '$₹4,18,000', '~5 days'],
        ['!Rathi Bearings', '#3', '#2,400', '$₹1,92,000', '~4 days'],
        ['!Mahavir Steel Traders', '#3', '#380', '$₹1,84,000', '~3 days'],
        ['!Girnar Castings', '#2', '#60', '$₹48,000', '~7 days'],
      ]),
      note('info', 'info', 'Quantities are suggested from 30-day consumption plus lead time. Each order is created as a draft for review.'),
    ], [['Cancel', '', 'ghost'], ['Create 4 draft POs', 'shopping_cart', 'primary']]);

  dlg('job-work-issue', 'Stock & shop floor', 'Issue material to vendor', 'Raise an outward job work challan',
    'Issue material · JW-0418', 'Shree Balaji Engineering · CNC turning', 540, [
      fields('Challan', [f('Challan no', 'CH-0293', 'lock', 'Auto'), f('Date', '17-08-2026', 'calendar_today', ''), f('Expected return', '22-08-2026', 'calendar_today', '5 days'), f('Vehicle', 'GJ-03-CD-9921', '', '')]),
      table('Material', ['Item', '>Qty', 'Unit', '>Value'], [
        ['MS Round Bar EN8 40mm', '#420', 'kg', '$₹2,94,000'],
        ['Consumable — cutting oil', '#12', 'ltr', '$₹4,800'],
      ]),
      note('warning', 'schedule', 'Under GST, job work material must return within 180 days. You will be reminded after 20 days.'),
    ], [['Cancel', '', 'ghost'], ['Issue & print challan', 'print', 'primary']]);

  dlg('qc-result', 'Stock & shop floor', 'Record QC result', 'Accept or reject material received back',
    'QC · JW-0398', 'Bush PB-18 plating · Yash Fabricators · 1,200 nos', 500, [
      fields('', [f('Inspected quantity', '1,200 nos', '', ''), f('Accepted', '1,178 nos', '', ''), f('Rejected', '22 nos', '', '1.8% rejection'), f('Rejection reason', 'Plating thickness below spec', 'expand_more', ''), f('Inspector', 'Alpesh Makwana', 'expand_more', ''), f('Action on rejects', 'Return to vendor for rework', 'expand_more', '')]),
      note('info', 'info', 'Rejected quantity stays on the vendor challan until reworked material is received.'),
    ], [['Cancel', '', 'ghost'], ['Record result', 'check', 'primary']]);

  /* ─────────── People & access ─────────── */
  dlg('invite-user', 'People & access', 'Invite user', 'Add a colleague or a party portal login',
    'Invite a user', 'They receive an email link valid for 7 days', 480, [
      fields('', [f('Full name', 'Dinesh Parmar', '', ''), f('Email', 'dinesh@jayhind.co.in', '', ''), f('Kind', 'Staff', 'expand_more', 'Staff or party portal'), f('Role', 'Stores', 'expand_more', 'Sets what they can reach'), f('Approval limit', '₹0', '', 'Stores role cannot approve'), f('Require 2FA', 'Yes', 'expand_more', '')]),
      note('info', 'shield', 'Party portal users only ever see their own transactions, statements and job work.'),
    ], [['Cancel', '', 'ghost'], ['Send invite', 'mail', 'primary']]);

  dlg('permissions', 'People & access', 'Role permissions', 'The permission matrix behind a role',
    'Stores — permissions', '6 users hold this role', 620, [
      table('Module access', ['Module', 'View', 'Create', 'Edit', 'Approve', 'Delete'], [
        ['Transaction', '@ok:Yes', '@ok:Yes', '@warn:Own only', '@mute:No', '@mute:No'],
        ['Product & Service', '@ok:Yes', '@ok:Yes', '@ok:Yes', '@mute:No', '@mute:No'],
        ['Job Work', '@ok:Yes', '@ok:Yes', '@warn:Own only', '@mute:No', '@mute:No'],
        ['Human Resources', '@mute:No', '@mute:No', '@mute:No', '@mute:No', '@mute:No'],
        ['Users & Roles', '@mute:No', '@mute:No', '@mute:No', '@mute:No', '@mute:No'],
        ['Reports', '@warn:Stock only', '@mute:No', '@mute:No', '@mute:No', '@mute:No'],
      ]),
      note('info', 'info', 'Changing a role applies immediately to all 6 users, on their next page load.'),
    ], [['Cancel', '', 'ghost'], ['Save role', 'check', 'primary']]);

  dlg('unlock-user', 'People & access', 'Unlock account', 'Release an account locked by failed sign-ins',
    'Unlock Jignesh Vora?', 'Locked at 09:14 today after 5 failed attempts', 440, [
      table('Recent attempts', ['Time', 'Source', 'Result'], [
        ['~09:14', 'Mobile · 49.36.x.x', '@bad:Failed'],
        ['~09:13', 'Mobile · 49.36.x.x', '@bad:Failed'],
        ['~09:11', 'Mobile · 49.36.x.x', '@bad:Failed'],
        ['~08:52', 'Web · office network', '@ok:Success'],
      ]),
      toggles('On unlock', [on('Force a password change at next sign-in', ''), off('Require 2FA setup', 'Recommended for stores role'), off('Notify the user by email', '')]),
    ], [['Keep locked', '', 'ghost'], ['Unlock account', 'lock_open', 'primary']]);

  dlg('apply-leave', 'People & access', 'Apply for leave', 'Self-service leave request',
    'Apply for leave', 'Harsh Patel · EMP-0004', 480, [
      fields('', [f('Leave type', 'Casual leave', 'expand_more', 'Balance 6 days'), f('From', '19-08-2026', 'calendar_today', ''), f('To', '21-08-2026', 'calendar_today', ''), f('Days', '3', 'lock', 'Excludes 1 holiday'), f('Cover', 'Meera Shah', 'expand_more', ''), f('Reason', 'Family function out of town', '', '', true)]),
      note('warning', 'group', '2 people from your department are already on leave on 20 Aug.'),
    ], [['Cancel', '', 'ghost'], ['Save draft', '', 'ghost'], ['Submit', 'send', 'primary']]);

  dlg('run-payroll', 'People & access', 'Run payroll', 'Final confirmation before locking the month',
    'Run August payroll?', '84 employees · net payable ₹42,18,000', 500, [
      table('Summary', ['Head', 'Employees', '>Amount'], [
        ['Gross earnings', '#84', '$₹46,82,000'],
        ['Provident fund', '#78', '#₹2,84,000'],
        ['Professional tax', '#84', '#₹16,800'],
        ['Advances recovered', '#6', '#₹1,63,200'],
        ['!Net payable', '#84', '$₹42,18,000'],
      ]),
      note('warning', 'lock', 'Running payroll locks August attendance. Later corrections must go through an arrears entry.'),
    ], [['Cancel', '', 'ghost'], ['Download bank file', 'download', 'ghost'], ['Run payroll', 'play_arrow', 'primary']]);

  /* ─────────── System ─────────── */
  dlg('notifications', 'System', 'Notification panel', 'The bell menu in the top bar',
    'Notifications', '3 unread', 420, [
      table('', ['', 'Notification', 'When'], [
        ['@warn:Approval', '!PB-0312 needs your approval — ₹2,84,600', '~2 min'],
        ['@bad:Overdue', '!Patel Auto Components is 6 days overdue', '~1 hour'],
        ['@ok:Registered', '!INV-2526-0148 e-Invoice registered', '~Yesterday'],
        ['@info:GST', '!GSTR-3B draft ready for July', '~Yesterday'],
        ['@mute:System', '!Backup completed — 4.2 GB', '~2 days'],
      ]),
    ], [['Mark all read', '', 'ghost'], ['Notification settings', 'settings', 'ghost']]);

  dlg('profile-menu', 'System', 'Profile menu', 'The avatar menu — account, company and sign-out',
    'Harsh Patel', 'Administrator · harsh@jayhind.co.in', 340, [
      table('', ['', 'Item', ''], [
        ['@mute:Person', '!My profile', '~'],
        ['@mute:Shield', '!Security & 2FA', '~On'],
        ['@mute:Palette', '!Appearance', '~Light'],
        ['@mute:Business', '!Switch company', '~2 available'],
        ['@mute:Event', '!Switch financial year', '~FY 25-26'],
        ['@mute:Help', '!Help & keyboard shortcuts', '~?'],
        ['@bad:Logout', '!Sign out', '~'],
      ]),
    ], []);

  dlg('company-switch', 'System', 'Switch company', 'Move between companies and financial years',
    'Switch company', 'Your books stay separate per company', 440, [
      picker('Search company…', ['Company', 'GSTIN', 'FY', 'Role'], [
        ['!Jayhind Industries', '~24AACFJ8821K1Z9', '~FY 25-26', '@ok:Admin'],
        ['!Jayhind Exports LLP', '~24AACFJ9930L1Z4', '~FY 25-26', '@ok:Admin'],
      ], 'Switching reloads the app with the selected books'),
      fields('', [f('Financial year', 'FY 2025-26 (current)', 'expand_more', 'Closed years open read-only')]),
    ], [['Cancel', '', 'ghost'], ['Switch', 'check', 'primary']]);

  dlg('shortcuts', 'System', 'Keyboard shortcuts', 'The full key map for fast data entry',
    'Keyboard shortcuts', 'Press ? anywhere to open this', 560, [
      table('Vouchers', ['Key', 'Action', 'Key', 'Action'], [
        ['~F4', 'Contra', '~F8', 'Sales'],
        ['~F5', 'Payment', '~F9', 'Purchase'],
        ['~F6', 'Receipt', '~⌘S', 'Save draft'],
        ['~F7', 'Journal', '~⌘↵', 'Save & submit'],
      ]),
      table('Grid & navigation', ['Key', 'Action', 'Key', 'Action'], [
        ['~⌘K', 'Jump to anything', '~Ins', 'Add a line'],
        ['~G then S', 'Go to sales', '~⌫', 'Delete a line'],
        ['~G then A', 'Go to approvals', '~Esc', 'Close dialog'],
        ['~/', 'Focus search', '~?', 'This help'],
      ]),
    ], [['Print this list', 'print', 'ghost'], ['Close', '', 'primary']]);

  dlg('session-expiry', 'System', 'Session expiry', 'Idle-timeout warning before sign-out',
    'Still there?', 'You will be signed out in 2 minutes', 400, [
      note('warning', 'schedule', 'Your session times out after 30 minutes of inactivity. Any unsaved voucher is kept as a draft.'),
    ], [['Sign out', '', 'ghost'], ['Stay signed in', 'refresh', 'primary']]);

  dlg('error-state', 'System', 'Error dialog', 'When a server action fails',
    'Could not register the e-Invoice', 'IRP returned error 2172', 460, [
      note('error', 'error', 'Duplicate IRN — an invoice with this number was already registered on 14 Aug 2026 at 11:05.'),
      fields('', [f('Reference', 'REQ-88fa2c41', 'content_copy', 'Quote this to support'), f('Next step', 'Use the existing IRN', 'expand_more', '')]),
    ], [['Contact support', '', 'ghost'], ['Retry', 'refresh', 'ghost'], ['Use existing IRN', 'check', 'primary']]);

  dlg('toasts', 'System', 'Toasts & inline alerts', 'The non-blocking confirmations and warnings',
    'Toasts', 'Auto-dismiss after 5 seconds · stack bottom-right', 460, [
      { kind: 'toasts', items: [
        { tone: 'success', icon: 'check_circle', title: 'Invoice INV-2526-0149 saved', text: 'e-Invoice registered · IRN 1a2b3c4d…', action: 'View' },
        { tone: 'warning', icon: 'warning', title: 'Stock short by 160 nos', text: 'MS Flange 6" — the invoice was saved anyway', action: 'Plan PO' },
        { tone: 'error', icon: 'error', title: 'e-Way Bill failed', text: 'Vehicle number format is invalid', action: 'Retry' },
        { tone: 'info', icon: 'info', title: 'Export ready', text: 'sales-invoices-aug.xlsx · 143 rows', action: 'Download' },
      ] },
    ], [['Close', '', 'primary']]);

  dlg('empty-state', 'System', 'Empty & loading states', 'What a screen shows before there is data',
    'Empty states', 'Every grid and dashboard uses these', 480, [
      { kind: 'empties', items: [
        { icon: 'receipt_long', title: 'No vouchers yet', text: 'Create your first sales invoice, or import from Tally.', action: 'New sales invoice' },
        { icon: 'filter_alt_off', title: 'No rows match this filter', text: '4 conditions applied — try clearing the date range.', action: 'Clear filters' },
        { icon: 'wifi_off', title: 'Could not load', text: 'Check your connection and try again.', action: 'Retry' },
        { icon: 'lock', title: 'You do not have access', text: 'The Stores role cannot open payroll. Ask an admin.', action: 'Request access' },
      ] },
    ], [['Close', '', 'primary']]);

  /* ─────────── gallery screens ─────────── */
  var groups = {};
  Object.keys(D).forEach(function (id) {
    var g = D[id].group;
    (groups[g] = groups[g] || []).push(id);
  });
  var slug = function (g) { return 'dlg-' + g.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); };
  var SUB = {
    'Pickers': 'Search-and-select overlays used inside forms',
    'Voucher actions': 'Approve, reject, cancel and settle',
    'Compliance': 'e-Invoice, e-Way Bill and GST filing',
    'Data & grid': 'Columns, filters, import, export and destructive guards',
    'Print & share': 'Getting a document to the party',
    'Stock & shop floor': 'Adjustments, job work and quality',
    'People & access': 'Users, roles, leave and payroll',
    'System': 'Menus, shortcuts, errors, toasts and empty states',
  };
  Object.keys(groups).forEach(function (g) {
    S[slug(g)] = { kind: 'gallery', title: g, sub: SUB[g] || '', items: groups[g] };
  });

  window.__JH_DIALOGS = D;
  if (window.__JH_SCREENS) Object.keys(S).forEach(function (k) { window.__JH_SCREENS[k] = S[k]; });
  window.__JH_DIALOG_NAV = Object.keys(groups).map(function (g) {
    return [slug(g), g, groups[g].length];
  });
})();
