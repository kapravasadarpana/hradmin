const state = { token: sessionStorage.getItem('hrToken'), user: null, records: {} };
const schemas = {
  employees: [['employeeId', 'Employee ID'], ['name', 'Employee name'], ['unit', 'Unit'], ['designation', 'Designation'], ['status', 'Status'], ['joiningDate', 'Joining date', 'date']],
  joinings: [['employeeId', 'Employee ID'], ['name', 'Employee name'], ['unit', 'Unit'], ['designation', 'Designation'], ['orderNo', 'Order number'], ['orderDate', 'Order date', 'date'], ['joinedDate', 'Joined date', 'date']],
  users: [['username', 'Username'], ['name', 'Full name'], ['password', 'Initial password', 'password'], ['role', 'Role']]
};
const recordColumns = {
  employees: ['employeeId', 'name', 'unit', 'designation', 'status', 'joiningDate'],
  transfers: ['employeeId', 'employeeName', 'fromUnit', 'designation', 'toUnit', 'orderNo', 'orderDate', 'status'],
  leaves: ['employeeId', 'employeeName', 'unit', 'designation', 'fromDate', 'toDate', 'reason', 'status'],
  joinings: ['employeeId', 'name', 'unit', 'designation', 'joinedDate', 'status']
};

async function server(action, ...args) {
  // text/plain avoids a CORS preflight, which Apps Script cannot answer
  const res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, args }) });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.data;
}
function byId(id) { return document.getElementById(id); }
function el(tag, props = {}, ...children) { const node = document.createElement(tag); Object.assign(node, props); children.flat().filter(Boolean).forEach(child => node.append(child)); return node; }
function option(value, label, selected) { return el('option', { value, textContent: label, selected: Boolean(selected) }); }
function titleCase(value) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase()); }

async function boot() {
  if (!state.token) return;
  try { state.user = await server('getSession', state.token); showApp(); }
  catch (_) { sessionStorage.removeItem('hrToken'); state.token = null; }
}

byId('loginForm').onsubmit = async event => {
  event.preventDefault(); byId('loginError').textContent = '';
  try {
    const result = await server('login', byId('username').value, byId('password').value);
    state.token = result.token; state.user = result.user; sessionStorage.setItem('hrToken', result.token); showApp();
  } catch (error) { byId('loginError').textContent = error.message; }
};
byId('passwordToggle').onclick = () => {
  const password = byId('password'); const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  byId('passwordToggle').textContent = '◉';
  byId('passwordToggle').setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  byId('passwordToggle').setAttribute('aria-pressed', String(!showing));
};
function showApp() { byId('login').classList.add('hidden'); byId('app').classList.remove('hidden'); byId('currentUser').textContent = state.user.name + ' · ' + state.user.role; go('dashboard'); }
byId('logout').onclick = async () => { await server('logout', state.token); sessionStorage.removeItem('hrToken'); location.reload(); };
document.querySelectorAll('.nav').forEach(button => button.onclick = () => go(button.dataset.page));

async function go(page) {
  document.querySelectorAll('.nav').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  byId('title').textContent = page === 'admin' ? 'Admin panel' : titleCase(page);
  if (page === 'dashboard') return renderDashboard();
  if (page === 'password') return renderPassword();
  if (page === 'admin') return renderAdmin();
  try { state.records[page] = await server('listRecords', state.token, page); renderTable(page); }
  catch (error) { byId('content').textContent = error.message; }
}

async function renderDashboard() {
  const content = byId('content');
  try {
    const data = await server('dashboard', state.token);
    const metrics = [
      ['Total employees', data.totalEmployees, 'metric-blue'], ['Inactive employees', data.inactiveEmployees, 'metric-red'],
      ['Active transfers', data.activeTransfers, 'metric-violet'], ['Pending leaves', data.pendingLeaves, 'metric-amber'], ['Pending joinings', data.newJoinings, 'metric-green']
    ];
    content.replaceChildren(
      el('section', { className: 'hero-card' }, el('div', {}, el('p', { className: 'eyebrow', textContent: 'HR COMMAND CENTRE' }), el('h2', { textContent: 'Everything your workforce needs, at a glance.' }), el('p', { textContent: 'Track records, approvals and workforce movement from one place.' }))),
      el('div', { className: 'grid metrics-grid' }, metrics.map(([label, value, color]) => el('section', { className: 'metric-card ' + color }, el('span', { textContent: label }), el('strong', { textContent: value })))),
      el('section', { className: 'card' }, el('div', { className: 'section-title' }, el('h2', { textContent: 'Recently added employees' }), el('button', { className: 'btn btn-light', textContent: 'View employees', onclick: () => go('employees') })), dataTable(data.recentEmployees, recordColumns.employees, 'readonly'))
    );
  } catch (error) { content.textContent = error.message; }
}

function renderTable(type) {
  const rows = state.records[type] || []; const columns = recordColumns[type];
  byId('content').replaceChildren(
    el('div', { className: 'page-head' }, el('p', { className: 'muted', textContent: rows.length + ' record(s)' }), el('button', { className: 'btn btn-primary', textContent: 'Add ' + type.slice(0, -1), onclick: () => openForm(type) })),
    el('section', { className: 'card' }, dataTable(rows, columns, type))
  );
}

function table(rows, columns, type) {
  const tableNode = el('table', { className: 'table' });
  const hasActions = type && (type !== 'users');
  tableNode.append(el('thead', {}, el('tr', {}, ...columns.map(column => el('th', { textContent: titleCase(column) })), hasActions && el('th', { textContent: 'Action' }))));
  const body = el('tbody');
  if (!rows.length) body.append(el('tr', {}, el('td', { colSpan: columns.length + 1, textContent: 'No records found.' })));
  rows.forEach(row => {
    const tr = el('tr', {}, ...columns.map(column => el('td', { textContent: row[column] || '—' })));
    if (hasActions) {
      const actions = [el('button', { className: 'btn btn-light', textContent: 'Edit', onclick: () => openForm(type, row) })];
      if (type === 'joinings' && row.status === 'Pending' && state.user.role === 'Administrator') actions.push(el('button', { className: 'btn btn-success', textContent: 'Approve', onclick: () => approveJoining(row.id) }));
      tr.append(el('td', { className: 'actions' }, actions));
    }
    body.append(tr);
  });
  tableNode.append(body); return tableNode;
}

function dataTable(rows, columns, type) {
  const tableState = { query: '', sort: '', ascending: true, page: 1, pageSize: 10 };
  const wrapper = el('div');
  const search = el('input', { type: 'search', placeholder: 'Filter table…', ariaLabel: 'Filter table' });
  const pageSize = el('select', { ariaLabel: 'Rows per page' }, [10, 25, 50, 100].map(size => option(String(size), size + ' per page', size === 10)));
  const tableWrap = el('div', { className: 'table-wrap' });
  const summary = el('span', { className: 'muted' });
  const previous = el('button', { className: 'btn btn-light', textContent: 'Previous' });
  const next = el('button', { className: 'btn btn-light', textContent: 'Next' });
  const pager = el('div', { className: 'pager' }, summary, el('div', { className: 'pager-buttons' }, previous, next));
  wrapper.append(el('div', { className: 'table-tools' }, search, pageSize), tableWrap, pager);
  const redraw = () => {
    let result = rows.filter(row => columns.some(column => String(row[column] || '').toLowerCase().includes(tableState.query)));
    if (tableState.sort) result = result.slice().sort((a, b) => String(a[tableState.sort] || '').localeCompare(String(b[tableState.sort] || ''), undefined, { numeric: true }) * (tableState.ascending ? 1 : -1));
    const pages = Math.max(1, Math.ceil(result.length / tableState.pageSize)); tableState.page = Math.min(tableState.page, pages);
    const start = (tableState.page - 1) * tableState.pageSize; const pageRows = result.slice(start, start + tableState.pageSize);
    const tableNode = el('table', { className: 'table' });
    const hasActions = !['users', 'readonly'].includes(type);
    tableNode.append(el('thead', {}, el('tr', {}, ...columns.map(column => {
      const marker = tableState.sort === column ? (tableState.ascending ? ' ↑' : ' ↓') : ' ↕';
      return el('th', {}, el('button', { className: 'sort-btn', textContent: titleCase(column) + marker, onclick: () => { if (tableState.sort === column) tableState.ascending = !tableState.ascending; else { tableState.sort = column; tableState.ascending = true; } redraw(); } }));
    }), hasActions && el('th', { textContent: 'Action' }))));
    const body = el('tbody');
    if (!pageRows.length) body.append(el('tr', {}, el('td', { colSpan: columns.length + 1, textContent: 'No matching records found.' })));
    pageRows.forEach(row => {
      const tr = el('tr', {}, ...columns.map(column => el('td', { textContent: row[column] || '—' })));
      if (hasActions) {
        const actions = [el('button', { className: 'btn btn-light', textContent: 'Edit', onclick: () => openForm(type, row) })];
        if (type === 'joinings' && row.status === 'Pending' && state.user.role === 'Administrator') actions.push(el('button', { className: 'btn btn-success', textContent: 'Approve', onclick: () => approveJoining(row.id) }));
        tr.append(el('td', { className: 'actions' }, actions));
      }
      body.append(tr);
    });
    tableNode.append(body); tableWrap.replaceChildren(tableNode);
    summary.textContent = result.length ? 'Showing ' + (start + 1) + '–' + Math.min(start + tableState.pageSize, result.length) + ' of ' + result.length : '0 records';
    previous.disabled = tableState.page === 1; next.disabled = tableState.page === pages;
  };
  search.oninput = () => { tableState.query = search.value.trim().toLowerCase(); tableState.page = 1; redraw(); };
  pageSize.onchange = () => { tableState.pageSize = Number(pageSize.value); tableState.page = 1; redraw(); };
  previous.onclick = () => { tableState.page--; redraw(); }; next.onclick = () => { tableState.page++; redraw(); };
  redraw(); return wrapper;
}

async function renderAdmin() {
  const content = byId('content');
  if (state.user.role !== 'Administrator') { content.textContent = 'Only administrators can access this panel.'; return; }
  try {
    const [users, joinings] = await Promise.all([server('listRecords', state.token, 'users'), server('listRecords', state.token, 'joinings')]);
    const pending = joinings.filter(record => record.status === 'Pending');
    content.replaceChildren(
      el('section', { className: 'admin-banner' }, el('div', {}, el('p', { className: 'eyebrow', textContent: 'ADMINISTRATION' }), el('h2', { textContent: 'Users and joining approvals' }), el('p', { textContent: 'Approve joinings to create active employee records.' }))),
      el('section', { className: 'card' }, el('div', { className: 'section-title' }, el('h2', { textContent: 'Pending new joinings' }), el('span', { className: 'pill', textContent: pending.length + ' pending' })), dataTable(pending, recordColumns.joinings, 'joinings')),
      el('section', { className: 'card' }, el('div', { className: 'section-title' }, el('h2', { textContent: 'User management' }), el('button', { className: 'btn btn-primary', textContent: 'Add user', onclick: () => openForm('users') })), dataTable(users, ['username', 'name', 'role', 'active'], 'users'))
    );
  } catch (error) { content.textContent = error.message; }
}

async function openForm(type, record = {}) {
  const modal = byId('recordModal'); modal.dataset.type = type; modal.dataset.id = record.id || '';
  byId('modalTitle').textContent = (record.id ? 'Edit ' : 'Add ') + type.slice(0, -1); byId('formError').textContent = '';
  const fields = byId('formFields'); fields.replaceChildren();
  if (type === 'transfers' || type === 'leaves') await addEmployeeSelectionFields(type, record, fields);
  else schemas[type].forEach(field => fields.append(createStandardField(field, record, type)));
  modal.showModal();
}

function createStandardField([key, label, inputType], record, type) {
  if (key === 'status' || key === 'role') {
    const values = key === 'role' ? ['Administrator', 'HR Manager', 'Staff'] : (type === 'leaves' ? ['Pending', 'Approved', 'Rejected'] : ['Active', 'Inactive']);
    const select = el('select', { name: key }); values.forEach(value => select.append(option(value, value, (record[key] || values[0]) === value)));
    return el('label', { textContent: label }, select);
  }
  const required = type === 'users' || key === 'employeeId' || (type === 'employees' && ['name', 'designation'].includes(key)) || (type === 'joinings' && ['name', 'unit', 'designation', 'joinedDate'].includes(key));
  return el('label', { textContent: label }, el('input', { name: key, type: inputType || 'text', value: record[key] || '', required }));
}

async function addEmployeeSelectionFields(type, record, fields) {
  const filters = await server('getEmployeeFilters', state.token, record.fromUnit || record.unit || '', record.designation || '');
  const unitKey = type === 'transfers' ? 'fromUnit' : 'unit';
  const unit = el('select', { name: unitKey, required: true });
  const designation = el('select', { name: 'designation', required: true, disabled: !record[unitKey] });
  const employee = el('select', { name: 'employeeId', required: true, disabled: !record.designation });
  const employeeName = el('input', { name: 'employeeName', type: 'hidden', value: record.employeeName || '' });
  function fillSelect(select, items, placeholder, selected, label) { select.replaceChildren(option('', placeholder)); items.forEach(item => select.append(option(typeof item === 'string' ? item : item.employeeId, typeof item === 'string' ? item : item.name + ' (' + item.employeeId + ')', (typeof item === 'string' ? item : item.employeeId) === selected))); }
  fillSelect(unit, filters.units, 'Select unit', record[unitKey]);
  async function refreshDesignations() { const data = await server('getEmployeeFilters', state.token, unit.value, ''); fillSelect(designation, data.designations, 'Select designation', record.designation); designation.disabled = !unit.value; employee.replaceChildren(option('', 'Select employee')); employee.disabled = true; }
  async function refreshEmployees() { const data = await server('getEmployeeFilters', state.token, unit.value, designation.value); fillSelect(employee, data.employees, 'Select employee', record.employeeId); employee.disabled = !designation.value; }
  unit.onchange = async () => { record.designation = ''; record.employeeId = ''; await refreshDesignations(); };
  designation.onchange = async () => { record.employeeId = ''; await refreshEmployees(); };
  employee.onchange = () => { const selected = employee.options[employee.selectedIndex]; employeeName.value = selected && employee.value ? selected.textContent.replace(/ \([^)]*\)$/, '') : ''; };
  fields.append(el('label', { textContent: 'Unit' }, unit), el('label', { textContent: 'Designation' }, designation), el('label', { textContent: 'Employee name' }, employee), employeeName);
  if (record[unitKey]) { await refreshDesignations(); if (record.designation) await refreshEmployees(); }
  if (type === 'transfers') {
    const destination = el('select', { name: 'toUnit', required: true });
    fillSelect(destination, filters.units, 'Select transfer unit', record.toUnit);
    fields.append(el('label', { textContent: 'Transfer to unit' }, destination));
  }
  const extra = type === 'transfers' ? [['orderNo', 'Order number'], ['orderDate', 'Order date', 'date'], ['joinedDate', 'Joined date', 'date'], ['status', 'Status']] : [['fromDate', 'From date', 'date'], ['toDate', 'To date', 'date'], ['orderNo', 'Order number'], ['orderDate', 'Order date', 'date'], ['reason', 'Reason'], ['status', 'Status']];
  extra.forEach(field => fields.append(createStandardField(field, record, type)));
}

byId('closeModal').onclick = () => byId('recordModal').close();
byId('recordForm').onsubmit = async event => {
  event.preventDefault(); const modal = byId('recordModal'); const type = modal.dataset.type; const error = byId('formError'); error.textContent = '';
  const record = Object.fromEntries(new FormData(event.currentTarget)); if (modal.dataset.id) record.id = modal.dataset.id;
  try { type === 'users' ? await server('saveUser', state.token, record) : await server('saveRecord', state.token, type, record); modal.close(); showToast('Record saved.'); go(type === 'users' ? 'admin' : type); }
  catch (failure) { error.textContent = failure.message; }
};
async function approveJoining(id) { try { await server('approveJoining', state.token, id); showToast('Joining approved and employee added to the active list.'); renderAdmin(); } catch (error) { showToast(error.message); } }
function renderPassword() {
  const form = el('form', { className: 'card stack password-card' });
  form.append(el('h2', { textContent: 'Change your password' }), el('label', { textContent: 'Current password' }, el('input', { name: 'currentPassword', type: 'password', required: true })), el('label', { textContent: 'New password (10+ characters)' }, el('input', { name: 'newPassword', type: 'password', minLength: 10, required: true })), el('label', { textContent: 'Confirm new password' }, el('input', { name: 'confirmPassword', type: 'password', minLength: 10, required: true })), el('p', { className: 'error' }), el('button', { className: 'btn btn-primary', textContent: 'Update password' }));
  form.onsubmit = async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); const error = form.querySelector('.error'); if (data.newPassword !== data.confirmPassword) { error.textContent = 'New passwords do not match.'; return; } try { await server('changePassword', state.token, data.currentPassword, data.newPassword); showToast('Password updated.'); form.reset(); } catch (failure) { error.textContent = failure.message; } };
  byId('content').replaceChildren(form);
}
function showToast(message) { const node = byId('toast'); node.textContent = message; node.classList.remove('hidden'); setTimeout(() => node.classList.add('hidden'), 3500); }
boot();