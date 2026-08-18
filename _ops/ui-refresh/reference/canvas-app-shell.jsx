
const inr = n => '₹' + n.toLocaleString('en-IN');
const inr2 = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── navigation (mirrors src/core/navigation/navigation.config.ts) ── */
const NAV = [
  ['dashboard', 'Dashboard', 'Home', 'space_dashboard', [
    ['Overview', [['dashboard', 'Business overview', 'dashboard'], ['approvals', 'Pending approvals', 'fact_check', '23'], ['dues', 'Dues', 'event_busy', '9']]],
  ]],
  ['transaction', 'Transaction', 'Books', 'receipt_long', [
    ['Menu', [
      ['dashboard', 'Dashboard', 'dashboard'],
      ['pending-approvals', 'Pending Approvals', 'fact_check', '14'],
      ['outstanding', 'Outstanding', 'account_balance'],
      ['party-statement', 'Party Statement', 'receipt_long'],
      ['dues', 'Dues', 'event_busy', '9'],
      ['gst-returns', 'GST Returns', 'summarize'],
      ['chart-of-accounts', 'Chart of Accounts', 'account_balance_wallet'],
      ['invoice-scanning', 'Invoice Scanning', 'document_scanner', '5'],
    ]],
    ['Purchase', [
      ['purchase-requisition', 'Purchase Requisition', 'assignment'],
      ['purchase-order', 'Purchase Order', 'shopping_cart', '4'],
      ['goods-receipt', 'Goods Receipt', 'inventory_2'],
      ['purchase', 'Purchase', 'call_received'],
      ['debit-note', 'Debit Note', 'arrow_upward'],
    ]],
    ['Sales', [
      ['sales-entry', 'New Sales Invoice', 'add_circle'],
      ['quotation', 'Quotation', 'request_quote'],
      ['sales-order', 'Sales Order', 'list_alt', '6'],
      ['delivery-challan', 'Delivery Challan', 'local_shipping'],
      ['sales', 'Sales', 'call_made'],
      ['credit-note', 'Credit Note', 'arrow_downward'],
    ]],
    ['Cash & Accounting', [
      ['payment', 'Payment', 'payments'],
      ['receipt', 'Receipt', 'receipt'],
      ['journal', 'Journal', 'class'],
      ['contra', 'Contra', 'swap_horiz'],
    ]],
    ['Reports', [
      ['trial-balance', 'Trial Balance', 'account_balance'],
      ['profit-and-loss', 'Profit & Loss', 'trending_up'],
      ['balance-sheet', 'Balance Sheet', 'account_balance_wallet'],
      ['day-book', 'Day Book', 'menu_book'],
      ['group-statement', 'Group Statement', 'receipt_long'],
      ['cash-book', 'Cash Book', 'payments'],
      ['bank-book', 'Bank Book', 'account_balance'],
      ['daily-cash', 'Daily Cash', 'event'],
      ['payment-register', 'Payment Register', 'call_made'],
      ['receipt-register', 'Receipt Register', 'call_received'],
      ['stock-ledger', 'Stock Ledger', 'inventory_2'],
      ['valuation-summary', 'Valuation Summary', 'price_check'],
      ['reorder-alerts', 'Reorder Alerts', 'warning', '12'],
    ]],
    ['Masters & setup', [
      ['trx-nature', 'Nature', 'category'],
      ['trx-group', 'Transaction Group', 'layers'],
      ['financial-year', 'Financial Year', 'event_available'],
      ['tax-rates', 'GST Rates', 'percent'],
      ['transaction-config', 'Configuration', 'settings_suggest'],
      ['data-import', 'Data Import', 'upload_file'],
    ]],
  ]],
  ['product', 'Product & Service', 'Stock', 'inventory_2', [
    ['Menu', [
      ['dashboard', 'Dashboard', 'dashboard'],
      ['product-list', 'Product List', 'list_alt'],
      ['service-list', 'Service List', 'handyman'],
    ]],
    ['Product Management', [
      ['quantity', 'Quantity', 'production_quantity_limits'],
      ['product-price', 'Price', 'sell'],
      ['product-media', 'Product Media', 'perm_media'],
    ]],
    ['Stock Conversion', [
      ['conversions', 'Conversions', 'merge'],
      ['bom-templates', 'BOM Templates', 'receipt_long'],
    ]],
    ['Masters', [
      ['manufacturer', 'Manufacturer', 'factory'],
      ['measurementUnit', 'Measurement Unit', 'straighten'],
      ['returnPolicy', 'Return Policy', 'assignment_return'],
      ['productCondition', 'Product Condition', 'rule'],
      ['productWarranty', 'Product Warranty', 'verified_user'],
      ['categorys-tags', 'Categories & Tags', 'local_offer'],
    ]],
    ['Configuration', [
      ['general-settings', 'General Settings', 'tune'],
      ['dynamic-fields', 'Dynamic Fields', 'dynamic_form'],
    ]],
  ]],
  ['job-work', 'Job Work', 'Shop', 'precision_manufacturing', [
    ['Menu', [
      ['dashboard', 'Dashboard', 'dashboard'],
      ['board', 'Job Work Board', 'view_kanban'],
      ['ready-queue', 'Ready Queue', 'playlist_play', '8'],
      ['challans', 'Challans', 'local_shipping'],
      ['billing-run', 'Billing Run', 'receipt_long'],
      ['reports', 'Reports', 'assessment'],
    ]],
    ['Masters', [
      ['operation-types', 'Operation Types', 'category'],
      ['machines', 'Machines', 'precision_manufacturing'],
      ['vendor-capabilities', 'Vendor Capabilities', 'engineering'],
      ['route-templates', 'Route Templates', 'route'],
      ['party-settings', 'Party Billing Settings', 'calendar_month'],
      ['configuration', 'Job Work Settings', 'tune'],
    ]],
  ]],
  ['hr', 'Human Resources', 'People', 'groups', [
    ['Menu', [
      ['dashboard', 'HR Dashboard', 'dashboard'],
      ['self-service', 'My Self-Service', 'person_pin'],
      ['employees', 'Employees', 'badge'],
    ]],
    ['Attendance', [
      ['daily', 'Daily Attendance', 'event_available'],
      ['attendance-reports', 'Attendance Reports', 'summarize'],
      ['shifts', 'Shifts', 'schedule'],
    ]],
    ['Leave', [
      ['applications', 'Leave Applications', 'fact_check', '5'],
      ['calendar', 'Leave Calendar', 'calendar_month'],
      ['leave-types', 'Leave Types', 'category'],
      ['holidays', 'Holidays', 'celebration'],
    ]],
    ['Payroll', [
      ['runs', 'Payroll Runs', 'request_quote'],
      ['salary-structures', 'Salary Structures', 'tune'],
      ['salary-components', 'Salary Components', 'view_list'],
    ]],
    ['Masters', [
      ['departments', 'Departments', 'account_tree'],
      ['designations', 'Designations', 'work'],
      ['employment-types', 'Employment Types', 'badge'],
    ]],
  ]],
  ['users-roles', 'Users & Roles', 'Access', 'admin_panel_settings', [
    ['Menu', [
      ['dashboard', 'Dashboard', 'dashboard'],
      ['users', 'Users', 'manage_accounts'],
      ['roles', 'Roles', 'admin_panel_settings'],
      ['user-configuration', 'User Configuration', 'tune'],
    ]],
  ]],
  ['site-configrations', 'Company Configuration', 'Company', 'business', [
    ['Setup', [['site-configrations', 'Company Configuration', 'business']]],
  ]],
  ['chat', 'Chat', 'Chat', 'forum', [['Menu', [['chat', 'Team chat', 'forum', '2']]]]],
  ['file-manager', 'Files', 'Files', 'folder_open', [['Menu', [['file-manager', 'All files', 'folder_open']]]]],
  ['audit-logs', 'Audit Log', 'Audit', 'history', [['Menu', [['audit-logs', 'Audit log', 'history']]]]],
  ['company-export', 'Export / Offboarding', 'Export', 'archive', [['Menu', [['company-export', 'Export / Offboarding', 'archive']]]]],
  ['my-account', 'My Account (Party Portal)', 'Portal', 'account_circle', [
    ['Party portal', [
      ['party-dashboard', 'Dashboard', 'dashboard'],
      ['transactions', 'My Transactions', 'receipt_long'],
      ['payments', 'Payments & Receipts', 'payments'],
      ['statement', 'Account Statement', 'menu_book'],
      ['party-job-work', 'Job Work', 'precision_manufacturing'],
    ]],
  ]],
];

NAV.push(['dialogs', 'Dialogs & Popups', 'Dialogs', 'web_asset', [
  ['Overlays', [
    ['dlg-pickers', 'Pickers', 'search'],
    ['dlg-voucher-actions', 'Voucher actions', 'fact_check'],
    ['dlg-compliance', 'Compliance', 'verified'],
    ['dlg-data-grid', 'Data & grid', 'grid_on'],
    ['dlg-print-share', 'Print & share', 'print'],
    ['dlg-stock-shop-floor', 'Stock & shop floor', 'inventory_2'],
    ['dlg-people-access', 'People & access', 'manage_accounts'],
    ['dlg-system', 'System', 'settings'],
  ]],
]]);

const MODULE_SUB = {
  dashboard: 'Your day, in one place',
  transaction: 'Vouchers, money and returns',
  product: 'Catalogue, stock and pricing',
  'job-work': 'Shop floor and outsourcing',
  hr: 'People, attendance and payroll',
  'users-roles': 'Access control',
  'site-configrations': 'Company profile and defaults',
  chat: 'Internal messaging',
  'file-manager': 'Every uploaded document',
  'audit-logs': 'Who changed what',
  'company-export': 'Data portability',
  'my-account': 'Self-service for trading parties',
  dialogs: 'Every modal, menu, toast and empty state',
};

const CHIP = {
  ok: 'color:var(--success);background:var(--success-bg);',
  warn: 'color:var(--warning);background:var(--warning-bg);',
  bad: 'color:var(--error);background:var(--error-bg);',
  info: 'color:var(--info);background:var(--info-bg);',
  mute: 'color:var(--muted);background:var(--surface-2);',
};

class Component extends DCLogic {
  state = { theme: 'light', module: 'dashboard', screen: 'dashboard', dialog: null, open: {}, filter: '', sortCol: 2, sortDir: 'desc' };

  go(module, screen) { this.setState({ module, screen, filter: '' }); }

  componentDidMount() {
    let n = 0;
    const t = setInterval(() => {
      if ((window.__JH_SCREENS && window.__JH_DIALOGS) || ++n > 60) { clearInterval(t); this.forceUpdate(); }
    }, 100);
  }

  renderVals() {
    const { theme, module, screen, dialog, open, filter, sortCol, sortDir } = this.state;
    const q = filter.trim().toLowerCase();
    const modDef = NAV.find(m => m[0] === module) || NAV[0];
    const all = { ...(window.__JH_SCREENS || {}), ...(window.__JH_DIALOG_SCREENS || {}) };
    const label = (NAV.find(m => m[0] === module) || NAV[0])[4]
      .reduce((a, g) => a.concat(g[1]), []).filter(i => i[0] === screen).map(i => i[1])[0] || screen;
    const scr = all[module + '/' + screen] || all[screen] || {
      kind: 'list', title: label, sub: 'This screen is part of the ' + module + ' module',
      cols: ['Name', 'Reference', 'Date', 'Owner', 'Status'], rows: [],
    };

    const modules = NAV.map(([id, name, short, icon, groups]) => ({
      id, name, short, icon,
      style: id === module ? 'background:var(--primary-container);color:var(--on-primary-container);' : '',
      onClick: () => this.go(id, groups[0][1][0][0]),
    }));

    const totalItems = modDef[4].reduce((a, g) => a + g[1].length, 0);
    const useAccordion = totalItems > 14;

    const sections = modDef[4].map(([label, items], gi) => {
      const key = module + '|' + label;
      const matches = items.filter(([, name]) => !q || name.toLowerCase().includes(q));
      const holdsActive = items.some(([route]) => route === screen);
      const pinned = !useAccordion || gi === 0;
      const isOpen = pinned ? true : (q ? matches.length > 0 : (open[key] !== undefined ? open[key] : holdsActive));
      const alerts = matches.reduce((a, i) => a + (i[3] ? Number(i[3]) || 0 : 0), 0);
      return {
        label,
        open: isOpen,
        countLabel: pinned ? '' : String(matches.length),
        countStyle: 'color:var(--muted);opacity:.7;',
        alertLabel: alerts && !isOpen ? String(alerts) : '',
        alertStyle: alerts && !isOpen ? '' : 'display:none;',
        headStyle: pinned ? 'cursor:default;' : (holdsActive && !isOpen ? 'background:var(--surface-1);' : ''),
        chevronStyle: pinned ? 'display:none;' : (isOpen ? 'transform:rotate(90deg);' : ''),
        onToggle: pinned ? (() => {}) : (() => this.setState(s => ({ open: { ...s.open, [key]: !isOpen } }))),
        items: matches.map(([route, name, icon, badge]) => ({
          name, icon, badge: badge || '',
          indentStyle: pinned ? '' : 'padding-left:14px;',
          style: route === screen ? 'background:var(--primary-container);color:var(--on-primary-container);font-weight:600;' : '',
          iconStyle: route === screen ? 'color:var(--primary);' : 'color:var(--muted);',
          badgeStyle: badge ? 'color:var(--error);' : 'color:var(--muted);',
          onClick: e => { e.preventDefault(); this.setState({ screen: route }); },
        })),
      };
    }).filter(s => !q || s.items.length);

    const cell = raw => {
      const s = String(raw);
      if (s[0] === '@') {
        const i = s.indexOf(':');
        return { isChip: true, isPlain: false, text: s.slice(i + 1), chipStyle: CHIP[s.slice(1, i)] || CHIP.mute, style: '' };
      }
      if (s[0] === '#') return { isChip: false, isPlain: true, text: s.slice(1), style: 'text-align:right; font-family:\'IBM Plex Mono\',monospace; font-variant-numeric:tabular-nums;' };
      if (s[0] === '$') return { isChip: false, isPlain: true, text: s.slice(1), style: 'text-align:right; font-weight:600; font-family:\'IBM Plex Mono\',monospace; font-variant-numeric:tabular-nums;' };
      if (s[0] === '~') return { isChip: false, isPlain: true, text: s.slice(1), style: 'color:var(--muted);' };
      if (s[0] === '!') return { isChip: false, isPlain: true, text: s.slice(1), style: 'font-weight:600;' };
      return { isChip: false, isPlain: true, text: s, style: '' };
    };
    const colDef = c => {
      const right = c[0] === '>';
      return { label: right ? c.slice(1) : c, style: right ? 'text-align:right;' : 'text-align:left;' };
    };
    const gridCol = (c, i) => {
      const d = colDef(c);
      const active = i === sortCol;
      return {
        ...d,
        innerStyle: d.style.indexOf('right') > -1 ? 'flex-direction:row-reverse;' : '',
        sortIcon: active ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more',
        sortStyle: active ? 'color:var(--primary);' : 'color:var(--border-strong);',
        onSort: () => this.setState(s => ({
          sortCol: i,
          sortDir: s.sortCol === i && s.sortDir === 'asc' ? 'desc' : 'asc',
        })),
      };
    };

    const rows = (scr.rows || []).map(r => ({ cells: r.map(cell) }));
    const dlgDef = dialog ? (window.__JH_DIALOGS || {})[dialog] : null;
    const trendData = [[62,48],[71,55],[58,44],[83,61],[77,58],[69,52],[92,66],[88,70],[74,59],[96,72],[104,78],[86,64]];

    return {
      theme,
      toggleTheme: () => this.setState(s => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      modules, sections,
      filterText: filter,
      filterStyle: totalItems > 10 ? '' : 'display:none;',
      onFilter: e => this.setState({ filter: e.target.value }),
      clearFilter: () => this.setState({ filter: '' }),
      clearStyle: filter ? '' : 'visibility:hidden;',
      moduleTitle: modDef[1],
      moduleSub: MODULE_SUB[module] || '',
      screenTitle: scr.title,
      screenSub: scr.sub || '',
      openEntry: () => this.go('transaction', 'sales-entry'),
      openPalette: () => this.setState({ dialog: 'command-palette' }),
      openNotifications: () => this.setState({ dialog: 'notifications' }),
      openProfile: () => this.setState({ dialog: 'profile-menu' }),
      openCompany: () => this.setState({ dialog: 'company-switch' }),

      isList: scr.kind === 'list',
      isDash: scr.kind === 'dash',
      isForm: scr.kind === 'form',
      isBoard: scr.kind === 'board',
      isSettings: scr.kind === 'settings',
      isScan: scr.kind === 'scan',
      isChat: scr.kind === 'chat',
      isFiles: scr.kind === 'files',
      isGallery: scr.kind === 'gallery',

      galleryItems: (scr.items || []).map(id => {
        const d = (window.__JH_DIALOGS || {})[id] || {};
        return { name: d.name || id, desc: d.desc || '', onClick: () => this.setState({ dialog: id }) };
      }),
      dialogOpen: !!dlgDef,
      closeDialog: () => this.setState({ dialog: null }),
      dlg: {
        title: dlgDef ? dlgDef.title : '',
        sub: dlgDef ? dlgDef.sub : '',
        widthStyle: 'max-width:' + ((dlgDef && dlgDef.width) || 480) + 'px;',
        hasFooter: !!(dlgDef && dlgDef.footer && dlgDef.footer.length),
        footer: ((dlgDef && dlgDef.footer) || []).map(([label, icon, tone]) => ({
          label, icon: icon || '',
          style: tone === 'primary'
            ? 'border:1px solid var(--primary); background:var(--primary); color:var(--on-primary);'
            : tone === 'danger'
              ? 'border:1px solid var(--error); background:var(--error-bg); color:var(--error);'
              : 'border:1px solid var(--border-strong); background:var(--surface); color:var(--on-surface);',
        })),
        sections: ((dlgDef && dlgDef.sections) || []).map(s => {
          const base = {
            hasTitle: !!s.title, title: s.title || '',
            isFields: s.kind === 'fields', isPicker: s.kind === 'picker', isTable: s.kind === 'table',
            isToggles: s.kind === 'toggles', isSteps: s.kind === 'steps', isNote: s.kind === 'note',
            isToasts: s.kind === 'toasts', isEmpties: s.kind === 'empties',
            placeholder: s.placeholder || '', footNote: s.footNote || '',
            icon: s.icon || 'info', text: s.text || '',
            noteStyle: s.kind === 'note'
              ? 'background:var(--' + s.tone + '-bg); color:var(--' + s.tone + ');'
              : '',
            colDefs: (s.cols || []).map(colDef),
            rowDefs: (s.rows || []).map((r, i) => ({
              cells: r.map(cell),
              rowStyle: i === 0 && s.kind === 'picker' ? 'background:var(--primary-container);' : '',
            })),
            items: [],
          };
          if (s.kind === 'fields') {
            base.items = s.items.map(i => ({ ...i, spanStyle: i.full ? 'grid-column:1/-1;' : '' }));
          } else if (s.kind === 'toggles') {
            base.items = s.items.map(i => ({
              ...i,
              toggleStyle: i.on ? 'background:var(--primary);' : 'background:var(--surface-2);',
              knobStyle: i.on ? 'right:2px;' : 'left:2px;',
            }));
          } else if (s.kind === 'steps') {
            base.items = s.items.map(i => ({
              label: i.label,
              state: i.state === 'done' ? 'Done' : i.state === 'active' ? 'Working…' : 'Waiting',
              icon: i.state === 'done' ? 'check_circle' : i.state === 'active' ? 'progress_activity' : 'radio_button_unchecked',
              iconStyle: i.state === 'done' ? 'color:var(--success);' : i.state === 'active' ? 'color:var(--primary);' : 'color:var(--muted);',
              labelStyle: i.state === 'todo' ? 'color:var(--muted);' : 'font-weight:500;',
            }));
          } else if (s.kind === 'toasts') {
            base.items = s.items.map(i => ({
              ...i,
              iconStyle: 'color:var(--' + i.tone + ');',
              barStyle: 'border-left:3px solid var(--' + i.tone + ');',
            }));
          } else if (s.kind === 'empties') {
            base.items = s.items;
          }
          return base;
        }),
      },

      cols: (scr.cols || []).map(gridCol),
      rows,
      sortIcon: sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward',
      sortLabel: ((scr.cols || [])[sortCol] || '').replace(/^>/, ''),
      toggleSortDir: () => this.setState(s => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
      openFilterDialog: () => this.setState({ dialog: 'filter-builder' }),
      openColumnDialog: () => this.setState({ dialog: 'column-config' }),
      openExportDialog: () => this.setState({ dialog: 'export' }),
      countLine: scr.count || ('1–' + rows.length + ' of ' + rows.length),
      actions: (scr.actions || [['Add', 'add', 1], ['Export', 'download', 0]]).map(([label, icon, primary]) => ({
        label, icon,
        style: primary ? 'background:var(--primary);border-color:var(--primary);color:var(--on-primary);' : '',
        onClick: () => {
          if (/^new /i.test(label)) this.setState({ screen: 'sales-entry' });
          else if (/export/i.test(label)) this.setState({ dialog: 'export' });
          else if (/import/i.test(label)) this.setState({ dialog: 'import' });
          else if (/configure|settings/i.test(label)) this.setState({ dialog: 'column-config' });
          else if (/^approve/i.test(label)) this.setState({ dialog: 'bulk-action' });
          else if (/^reject/i.test(label)) this.setState({ dialog: 'reject-voucher' });
          else if (/print/i.test(label)) this.setState({ dialog: 'print-preview' });
          else if (/scan/i.test(label)) this.setState({ dialog: 'import' });
          else if (/adjust/i.test(label)) this.setState({ dialog: 'stock-adjustment' });
          else if (/purchase order/i.test(label)) this.setState({ dialog: 'reorder-po' });
          else if (/payroll/i.test(label)) this.setState({ dialog: 'run-payroll' });
          else if (/invite/i.test(label)) this.setState({ dialog: 'invite-user' });
          else this.setState({ dialog: 'party-picker' });
        },
      })),
      views: (scr.views || [['All', ''], ['Active', ''], ['Archived', '']]).map(([label, count], i) => ({
        label, count,
        style: i === 0 ? 'background:var(--primary);border-color:var(--primary);color:var(--on-primary);' : '',
      })),
      filters: (scr.filters || [['This month', 'calendar_month'], ['Add filter', 'add']])
        .map(f => (Array.isArray(f) ? { label: f[0], icon: f[1] } : f)),
      hasSummary: !!scr.summary,
      summary: (scr.summary || []).map(([label, value, tone]) => ({
        label, value, style: tone ? 'color:var(--' + tone + ');' : '',
      })),

      kpis: scr.kpis || [],
      queueTitle: scr.queueTitle || 'Needs your attention',
      queue: (scr.queue || []).map(q => ({ ...q, iconStyle: 'color:var(--' + q.tone + ');background:var(--' + q.tone + '-bg);' })),
      panelTitle: scr.panelTitle || 'Breakdown',
      bars: scr.bars || [],
      chartTitle: scr.chartTitle || 'Trend',
      seriesA: scr.seriesA || 'Sales', seriesB: scr.seriesB || 'Purchases',
      trend: trendData.map(([s, p], i) => ({
        label: ['S','O','N','D','J','F','M','A','M','J','J','A'][i],
        salesStyle: 'height:' + Math.round(s / 110 * 100) + '%;',
        purchaseStyle: 'height:' + Math.round(p / 110 * 100) + '%;',
      })),

      headerFields: scr.headerFields || [],
      itemCols: (scr.itemCols || []).map(colDef),
      itemRows: (scr.itemRows || []).map(r => ({ cells: r.map(cell) })),
      totals: (scr.totals || []).map(t => ({
        ...t,
        wrapStyle: t.stacked ? 'flex-direction:column; align-items:stretch; gap:2px;' : '',
      })),
      formCompliance: (scr.formCompliance || []).map(c => ({ ...c, iconStyle: 'color:var(--' + c.tone + ');' })),

      boardCols: scr.boardCols || [],
      settingGroups: scr.settingGroups || [],
      scanLines: scr.scanLines || [],
      scanFields: scr.scanFields || [],
      threads: scr.threads || [],
      messages: scr.messages || [],
      files: scr.files || [],
    };
  }
}
