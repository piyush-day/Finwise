

// default data 
const defaultData = [
  { id: '1', date: '2026-03-01', amount: 5000, category: 'Salary', type: 'income', desc: 'March salary' },
  { id: '2', date: '2026-03-05', amount: 1200, category: 'Food', type: 'expense', desc: 'Groceries' },
  { id: '3', date: '2026-03-10', amount: 800, category: 'Shopping', type: 'expense', desc: 'Clothing' },
  { id: '4', date: '2026-04-02', amount: 1500, category: 'Freelance', type: 'income', desc: 'Design project' },
  { id: '5', date: '2026-04-07', amount: 2000, category: 'Food', type: 'expense', desc: 'Restaurant' },
  { id: '6', date: '2026-04-12', amount: 300, category: 'Transport', type: 'expense', desc: 'Uber' },
  { id: '7', date: '2026-04-15', amount: 400, category: 'Bills', type: 'expense', desc: 'Electricity' },
  { id: '8', date: '2026-03-20', amount: 250, category: 'Entertainment', type: 'expense', desc: 'Movies' }
];

// category lists 
const incomeCats = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
const expenseCats = ['Food', 'Shopping', 'Transport', 'Bills', 'Entertainment', 'Health', 'Other'];

// load from localStorage 
let transactions = [];
let currentRole = 'admin'; // admin or viewer
let darkMode = false;

// filter/sort state
let filterType = 'all';
let filterCategory = 'all';
let searchText = '';
let sortBy = 'date-desc';

// chart variables
let lineChart = null;
let pieChart = null;

// modal stuff
let showModal = false;
let editingId = null;
let modalForm = { date: '', desc: '', type: 'expense', category: 'Food', amount: '' };

// load data when page loads
function loadData() {
  const saved = localStorage.getItem('finwise_data');
  if (saved) {
    transactions = JSON.parse(saved);
  } else {
    transactions = JSON.parse(JSON.stringify(defaultData));
  }
  
  const savedDark = localStorage.getItem('dark_mode');
  if (savedDark === 'true') {
    darkMode = true;
    document.body.classList.add('dark-mode');
  }
}

function saveData() {
  localStorage.setItem('finwise_data', JSON.stringify(transactions));
  localStorage.setItem('dark_mode', darkMode);
}

// helper to get category list based on type
function getCategories(type) {
  return type === 'income' ? incomeCats : expenseCats;
}

// calculate all the stats
function calculateStats() {
  let totalIncome = 0;
  let totalExpense = 0;
  let expensesByCat = {};
  
  transactions.forEach(t => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      expensesByCat[t.category] = (expensesByCat[t.category] || 0) + t.amount;
    }
  });
  
  let balance = totalIncome - totalExpense;
  
  // find highest spending category
  let topCat = { name: 'None', amount: 0 };
  for (let cat in expensesByCat) {
    if (expensesByCat[cat] > topCat.amount) {
      topCat = { name: cat, amount: expensesByCat[cat] };
    }
  }
  
  // get months for comparison
  let months = [...new Set(transactions.map(t => t.date.substring(0,7)))].sort();
  let currentMonthExpense = 0;
  let prevMonthExpense = 0;
  
  if (months.length >= 2) {
    let currentMonth = months[months.length - 1];
    let prevMonth = months[months.length - 2];
    currentMonthExpense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonth)).reduce((sum, t) => sum + t.amount, 0);
    prevMonthExpense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(prevMonth)).reduce((sum, t) => sum + t.amount, 0);
  }
  
  let changePercent = prevMonthExpense ? ((currentMonthExpense - prevMonthExpense) / prevMonthExpense * 100).toFixed(1) : 0;
  
  let insight = '';
  if (topCat.name !== 'None') {
    insight = `You're spending the most on ${topCat.name} (₹${topCat.amount.toFixed(2)}). Maybe time to budget?`;
  } else {
    insight = 'Add some expenses to see spending insights';
  }
  
  if (currentMonthExpense > prevMonthExpense && prevMonthExpense > 0) {
    insight += ` Spending went up ${changePercent}% this month.`;
  } else if (currentMonthExpense < prevMonthExpense && prevMonthExpense > 0) {
    insight += ` Nice! Spending dropped ${Math.abs(changePercent)}% compared to last month.`;
  }
  
  return { balance, totalIncome, totalExpense, topCat, currentMonthExpense, changePercent, insight };
}

// get data for trend chart
function getTrendData() {
  if (transactions.length === 0) return { months: [], balances: [] };
  
  let sorted = [...transactions].sort((a,b) => new Date(a.date) - new Date(b.date));
  let monthly = new Map();
  
  sorted.forEach(t => {
    let month = t.date.substring(0,7);
    let flow = t.type === 'income' ? t.amount : -t.amount;
    monthly.set(month, (monthly.get(month) || 0) + flow);
  });
  
  let months = Array.from(monthly.keys()).sort();
  let balances = [];
  let running = 0;
  
  for (let month of months) {
    running += monthly.get(month);
    balances.push(running);
  }
  
  return { months, balances };
}

// get expense breakdown for pie chart
function getExpenseBreakdown() {
  let breakdown = new Map();
  transactions.filter(t => t.type === 'expense').forEach(t => {
    breakdown.set(t.category, (breakdown.get(t.category) || 0) + t.amount);
  });
  return Array.from(breakdown.entries()).map(([cat, amt]) => ({ category: cat, amount: amt }));
}

// filter and sort transactions 
function getFilteredTransactions() {
  let filtered = [...transactions];
  
  if (filterType !== 'all') {
    filtered = filtered.filter(t => t.type === filterType);
  }
  
  if (filterCategory !== 'all') {
    filtered = filtered.filter(t => t.category === filterCategory);
  }
  
  if (searchText.trim()) {
    let q = searchText.toLowerCase();
    filtered = filtered.filter(t => t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }
  
  if (sortBy === 'date-desc') {
    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
  } else if (sortBy === 'date-asc') {
    filtered.sort((a,b) => new Date(a.date) - new Date(b.date));
  } else if (sortBy === 'amount-desc') {
    filtered.sort((a,b) => b.amount - a.amount);
  } else if (sortBy === 'amount-asc') {
    filtered.sort((a,b) => a.amount - b.amount);
  }
  
  return filtered;
}

// get all unique categories for filter dropdown
function getAllCategories() {
  let cats = new Set(transactions.map(t => t.category));
  return ['all', ...Array.from(cats).sort()];
}

// CRUD operations
function addTransaction(txn) {
  if (currentRole !== 'admin') return;
  let newId = Date.now().toString();
  let newTxn = {
    id: newId,
    date: txn.date,
    amount: parseFloat(txn.amount),
    category: txn.category,
    type: txn.type,
    desc: txn.desc
  };
  transactions.unshift(newTxn);
  saveData();
  render();
}

function updateTransaction(id, txn) {
  if (currentRole !== 'admin') return;
  let index = transactions.findIndex(t => t.id === id);
  if (index !== -1) {
    transactions[index] = {
      ...transactions[index],
      date: txn.date,
      amount: parseFloat(txn.amount),
      category: txn.category,
      type: txn.type,
      desc: txn.desc
    };
    saveData();
    render();
  }
}

function deleteTransaction(id) {
  if (currentRole !== 'admin') return;
  if (confirm('Delete this transaction? Are you sure?')) {
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    render();
  }
}

function resetToDefault() {
  if (currentRole !== 'admin') return;
  if (confirm('Reset everything to default? This will delete all your data!')) {
    transactions = JSON.parse(JSON.stringify(defaultData));
    saveData();
    render();
  }
}

function exportToCSV() {
  if (transactions.length === 0) {
    alert('No data to export');
    return;
  }
  
  let headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
  let rows = transactions.map(t => [t.date, t.desc, t.category, t.type, t.amount]);
  let csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  let blob = new Blob([csv], { type: 'text/csv' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = `finwise_export_${new Date().toISOString().slice(0,19)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// open modal for add/edit
function openAddModal() {
  if (currentRole !== 'admin') return;
  editingId = null;
  modalForm = {
    date: new Date().toISOString().slice(0,10),
    desc: '',
    type: 'expense',
    category: 'Food',
    amount: ''
  };
  showModal = true;
  renderModal();
}

function openEditModal(txn) {
  if (currentRole !== 'admin') return;
  editingId = txn.id;
  modalForm = {
    date: txn.date,
    desc: txn.desc,
    type: txn.type,
    category: txn.category,
    amount: txn.amount.toString()
  };
  showModal = true;
  renderModal();
}

function closeModal() {
  showModal = false;
  editingId = null;
  render();
}

function saveModalForm() {
  if (!modalForm.date || !modalForm.desc || !modalForm.amount) {
    alert('Please fill in all fields');
    return;
  }
  
  let amountNum = parseFloat(modalForm.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    alert('Amount must be a positive number');
    return;
  }
  
  let txnData = {
    date: modalForm.date,
    desc: modalForm.desc,
    type: modalForm.type,
    category: modalForm.category,
    amount: amountNum
  };
  
  if (editingId) {
    updateTransaction(editingId, txnData);
  } else {
    addTransaction(txnData);
  }
  
  closeModal();
}

// chart stuff 
function initCharts() {
  let lineCanvas = document.getElementById('lineChart');
  let pieCanvas = document.getElementById('pieChart');
  if (!lineCanvas || !pieCanvas) return;
  
  let trend = getTrendData();
  let breakdown = getExpenseBreakdown();
  let textColor = darkMode ? '#e2e8f0' : '#1e293b';
  
  if (lineChart) lineChart.destroy();
  if (pieChart) pieChart.destroy();
  
  if (trend.months.length > 0) {
    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: trend.months,
        datasets: [{
          label: 'Balance (₹)',
          data: trend.balances,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: textColor } }
        }
      }
    });
  }
  
  if (breakdown.length > 0) {
    pieChart = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels: breakdown.map(b => b.category),
        datasets: [{
          data: breakdown.map(b => b.amount),
          backgroundColor: ['#f97316', '#10b981', '#8b5cf6', '#ec489a', '#06b6d4', '#f59e0b', '#6366f1']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } }
        }
      }
    });
  }
}

// render modal 
function renderModal() {
  let modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  
  if (!showModal) {
    modalRoot.innerHTML = '';
    return;
  }
  
  let cats = getCategories(modalForm.type);
  
  modalRoot.innerHTML = `
    <div class="modal" id="modalBackdrop">
      <div class="modal-content">
        <h2 style="margin-bottom: 1rem; font-size: 1.25rem; font-weight: bold;">
          ${editingId ? 'Edit Transaction' : 'Add Transaction'}
        </h2>
        <form id="modalForm">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="modalDate" value="${modalForm.date}" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="modalDesc" value="${escapeHtml(modalForm.desc)}" placeholder="What was this for?" required>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="modalType">
              <option value="income" ${modalForm.type === 'income' ? 'selected' : ''}>Income</option>
              <option value="expense" ${modalForm.type === 'expense' ? 'selected' : ''}>Expense</option>
            </select>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="modalCategory">
              ${cats.map(c => `<option value="${c}" ${modalForm.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Amount (₹)</label>
            <input type="number" id="modalAmount" value="${modalForm.amount}" step="0.01" placeholder="0.00" required>
          </div>
          <div class="flex gap-2" style="margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
            <button type="button" id="cancelModal" class="btn btn-secondary" style="flex: 1;">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // event listeners for modal
  let typeSelect = document.getElementById('modalType');
  let categorySelect = document.getElementById('modalCategory');
  
  typeSelect.addEventListener('change', (e) => {
    let newType = e.target.value;
    let newCats = getCategories(newType);
    let currentCat = categorySelect.value;
    categorySelect.innerHTML = newCats.map(c => `<option value="${c}" ${currentCat === c ? 'selected' : ''}>${c}</option>`).join('');
    modalForm.type = newType;
  });
  
  document.getElementById('modalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    modalForm.date = document.getElementById('modalDate').value;
    modalForm.desc = document.getElementById('modalDesc').value;
    modalForm.type = document.getElementById('modalType').value;
    modalForm.category = document.getElementById('modalCategory').value;
    modalForm.amount = document.getElementById('modalAmount').value;
    saveModalForm();
  });
  
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalBackdrop')) closeModal();
  });
}

// helper to escape html
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// main render function 
function render() {
  let stats = calculateStats();
  let filtered = getFilteredTransactions();
  let allCategories = getAllCategories();
  let isAdmin = currentRole === 'admin';
  let trend = getTrendData();
  let breakdown = getExpenseBreakdown();
  
  let html = `
    <div class="container">
      <!-- header -->
      <div class="header">
        <div class="logo">
          <h1><i class="fas fa-coins"></i> Finwise</h1>
          <p style="font-size: 0.875rem; color: #64748b;">track your money, no stress</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="darkModeBtn" class="btn btn-secondary">
            <i class="fas ${darkMode ? 'fa-sun' : 'fa-moon'}"></i> ${darkMode ? 'Light' : 'Dark'}
          </button>
          <div class="flex" style="background: #f1f5f9; border-radius: 9999px; padding: 0.25rem;">
            <button id="viewerBtn" class="${currentRole === 'viewer' ? 'btn-primary' : 'btn-secondary'}" style="border-radius: 9999px; padding: 0.25rem 1rem;">Viewer</button>
            <button id="adminBtn" class="${currentRole === 'admin' ? 'btn-primary' : 'btn-secondary'}" style="border-radius: 9999px; padding: 0.25rem 1rem;">Admin</button>
          </div>
          ${isAdmin ? `<button id="resetBtn" class="btn btn-secondary"><i class="fas fa-undo"></i> Reset</button>` : ''}
        </div>
      </div>
      
      <!-- stats cards -->
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-label"><i class="fas fa-wallet"></i> Balance</div>
          <div class="stat-value" style="color: #4f46e5;">₹${stats.balance.toFixed(2)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label"><i class="fas fa-arrow-up" style="color: #10b981;"></i> Income</div>
          <div class="stat-value" style="color: #10b981;">₹${stats.totalIncome.toFixed(2)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label"><i class="fas fa-arrow-down" style="color: #ef4444;"></i> Expense</div>
          <div class="stat-value" style="color: #ef4444;">₹${stats.totalExpense.toFixed(2)}</div>
        </div>
      </div>
      
      <!-- charts -->
      <div class="charts-row">
        <div class="chart-container">
          <h3 style="margin-bottom: 0.5rem;"><i class="fas fa-chart-line"></i> Balance Trend</h3>
          <canvas id="lineChart"></canvas>
          ${trend.months.length === 0 ? '<p style="text-align: center; color: #94a3b8;">No data yet</p>' : ''}
        </div>
        <div class="chart-container">
          <h3 style="margin-bottom: 0.5rem;"><i class="fas fa-chart-pie"></i> Spending by Category</h3>
          <canvas id="pieChart"></canvas>
          ${breakdown.length === 0 ? '<p style="text-align: center; color: #94a3b8;">No expense data</p>' : ''}
        </div>
      </div>
      
      <!-- insights -->
      <div class="insights-box">
        <h3 style="margin-bottom: 0.5rem;"><i class="fas fa-lightbulb" style="color: #f59e0b;"></i> Insights</h3>
        <div class="insights-grid">
          <div><strong>🏆 Top Category</strong><br>${stats.topCat.name !== 'None' ? `${stats.topCat.name} (₹${stats.topCat.amount.toFixed(2)})` : '—'}</div>
          <div><strong>📊 Monthly Change</strong><br>${stats.changePercent !== 0 ? `${stats.changePercent > 0 ? '↑' : '↓'} ${Math.abs(stats.changePercent)}%` : 'No change'}</div>
          <div><strong>💡 Tip</strong><br>${stats.insight}</div>
        </div>
      </div>
      
      <!-- transactions -->
      <div class="transactions-wrapper">
        <div class="transactions-header">
          <h3><i class="fas fa-list"></i> Transactions</h3>
          <div class="flex gap-2">
            ${isAdmin ? `<button id="addBtn" class="btn btn-primary"><i class="fas fa-plus"></i> Add</button>` : ''}
            <button id="exportBtn" class="btn btn-secondary"><i class="fas fa-download"></i> CSV</button>
          </div>
        </div>
        
        <div class="filters-bar">
          <div class="filter-group">
            <label>Type</label>
            <select id="filterTypeSelect">
              <option value="all" ${filterType === 'all' ? 'selected' : ''}>All</option>
              <option value="income" ${filterType === 'income' ? 'selected' : ''}>Income</option>
              <option value="expense" ${filterType === 'expense' ? 'selected' : ''}>Expense</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Category</label>
            <select id="filterCatSelect">
              ${allCategories.map(c => `<option value="${c}" ${filterCategory === c ? 'selected' : ''}>${c === 'all' ? 'All' : c}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group">
            <label>Sort by</label>
            <select id="sortSelect">
              <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Date (newest)</option>
              <option value="date-asc" ${sortBy === 'date-asc' ? 'selected' : ''}>Date (oldest)</option>
              <option value="amount-desc" ${sortBy === 'amount-desc' ? 'selected' : ''}>Amount (high-low)</option>
              <option value="amount-asc" ${sortBy === 'amount-asc' ? 'selected' : ''}>Amount (low-high)</option>
            </select>
          </div>
          <div class="filter-group" style="flex: 1;">
            <label>Search</label>
            <input type="text" id="searchInput" placeholder="description or category" value="${escapeHtml(searchText)}">
          </div>
        </div>
        
        <div style="overflow-x: auto;">
          ${filtered.length === 0 ? 
            '<div style="padding: 3rem; text-align: center; color: #94a3b8;"><i class="fas fa-inbox"></i> No transactions found</div>' :
            `<table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th>${isAdmin ? '<th></th>' : ''}</tr>
              </thead>
              <tbody>
                ${filtered.map(t => `
                  <tr>
                    <td>${t.date}</td>
                    <td><strong>${escapeHtml(t.desc)}</strong></td>
                    <td>${t.category}</td>
                    <td><span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
                    <td style="${t.type === 'income' ? 'color: #10b981;' : 'color: #ef4444;'} font-weight: 600;">₹${t.amount.toFixed(2)}</td>
                    ${isAdmin ? `<td><button class="edit-btn btn btn-secondary" data-id="${t.id}" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem;"><i class="fas fa-edit"></i></button><button class="delete-btn btn btn-secondary" data-id="${t.id}" style="padding: 0.25rem 0.5rem; background: #fee2e2;"><i class="fas fa-trash"></i></button></td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          }
        </div>
      </div>
    </div>
    <div id="modal-root"></div>
  `;
  
  document.getElementById('app').innerHTML = html;
  
  // attach event listeners
  document.getElementById('darkModeBtn')?.addEventListener('click', toggleDarkMode);
  document.getElementById('viewerBtn')?.addEventListener('click', () => { currentRole = 'viewer'; render(); });
  document.getElementById('adminBtn')?.addEventListener('click', () => { currentRole = 'admin'; render(); });
  document.getElementById('resetBtn')?.addEventListener('click', resetToDefault);
  document.getElementById('addBtn')?.addEventListener('click', openAddModal);
  document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
  
  document.getElementById('filterTypeSelect')?.addEventListener('change', (e) => { filterType = e.target.value; render(); });
  document.getElementById('filterCatSelect')?.addEventListener('change', (e) => { filterCategory = e.target.value; render(); });
  document.getElementById('sortSelect')?.addEventListener('change', (e) => { sortBy = e.target.value; render(); });
  document.getElementById('searchInput')?.addEventListener('input', (e) => { searchText = e.target.value; render(); });
  
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      let id = btn.getAttribute('data-id');
      let txn = transactions.find(t => t.id === id);
      if (txn) openEditModal(txn);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      let id = btn.getAttribute('data-id');
      deleteTransaction(id);
    });
  });
  
  setTimeout(() => initCharts(), 50);
}

function toggleDarkMode() {
  darkMode = !darkMode;
  if (darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  localStorage.setItem('dark_mode', darkMode);
  render();
}

// start the app
loadData();
render();
