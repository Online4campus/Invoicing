// SECTION: In-memory state (also used as payloads for Google Drive storage)
const state = {
  clients: [],
  products: [],
  invoices: [],
  recurring: [],
  payments: [],
};

// Simple ID helper
const id = () => Math.random().toString(36).slice(2, 10);

// SECTION: DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// SECTION: Navigation between panels
function initNavigation() {
  const navItems = $$(".nav-item");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;

      navItems.forEach((b) => b.classList.toggle("nav-item--active", b === btn));
      $$(".panel").forEach((panel) => {
        panel.classList.toggle("panel--active", panel.id === `panel-${section}`);
      });
    });
  });
}

// SECTION: Clients
function renderClients(filter = "") {
  const list = $("#client-list");
  const empty = $("#client-empty");
  list.innerHTML = "";

  const filtered = state.clients.filter((c) => {
    const term = filter.trim().toLowerCase();
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.company && c.company.toLowerCase().includes(term))
    );
  });

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  filtered.forEach((client) => {
    const li = document.createElement("li");
    li.className = "list__item";

    li.innerHTML = `
      <div class="list__item-main">
        <span class="list__item-title">${client.name}</span>
        <span class="list__item-subtitle">${client.company || ""}</span>
        <span class="list__item-meta">${client.email || ""}</span>
      </div>
      <div class="list__item-meta">
        <span>${client.phone || ""}</span>
      </div>
    `;

    list.appendChild(li);
  });

  // Update client selects used elsewhere
  syncClientOptions();
}

function syncClientOptions() {
  const clientSelects = ["#invoice-client", "#recurring-client", "#statement-client"]
    .map((idSel) => $(idSel))
    .filter(Boolean);

  clientSelects.forEach((select) => {
    const prev = select.value;
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select client";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    state.clients.forEach((client) => {
      const opt = document.createElement("option");
      opt.value = client.id;
      opt.textContent = client.name;
      select.appendChild(opt);
    });

    if (prev) select.value = prev;
  });
}

function initClients() {
  const form = $("#client-form");
  const search = $("#client-search");
  const addClientBtn = $("#add-client-btn");

  addClientBtn?.addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#client-name")?.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const client = {
      id: id(),
      name: data.get("clientName").toString().trim(),
      email: data.get("clientEmail").toString().trim(),
      company: data.get("clientCompany").toString().trim(),
      phone: data.get("clientPhone").toString().trim(),
      notes: data.get("clientNotes").toString().trim(),
    };

    if (!client.name) return;

    state.clients.push(client);
    form.reset();
    renderClients(search.value);
    updateReports();
  });

  search.addEventListener("input", () => renderClients(search.value));

  renderClients();
}

// SECTION: Products
function renderProducts(filter = "") {
  const list = $("#product-list");
  const empty = $("#product-empty");
  list.innerHTML = "";

  const term = filter.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  });

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  filtered.forEach((product) => {
    const li = document.createElement("li");
    li.className = "list__item";

    li.innerHTML = `
      <div class="list__item-main">
        <span class="list__item-title">${product.name}</span>
        <span class="list__item-subtitle">${product.description || ""}</span>
        <span class="list__item-meta">${product.sku || ""}</span>
      </div>
      <div class="list__item-amount">
        ${formatCurrency(product.price)}
      </div>
    `;

    list.appendChild(li);
  });

  syncProductOptions();
}

function syncProductOptions() {
  const selects = $$(".invoice-product-select");
  selects.forEach((select) => {
    const current = select.value;
    select.innerHTML = "";

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Custom";
    select.appendChild(none);

    state.products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  });
}

function initProducts() {
  const form = $("#product-form");
  const search = $("#product-search");
  const addProductBtn = $("#add-product-btn");

  addProductBtn?.addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#product-name")?.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const product = {
      id: id(),
      name: data.get("productName").toString().trim(),
      sku: data.get("productSku").toString().trim(),
      price: Number(data.get("productPrice")) || 0,
      taxRate: Number(data.get("productTax")) || 0,
      description: data.get("productDescription").toString().trim(),
    };

    if (!product.name) return;

    state.products.push(product);
    form.reset();
    renderProducts(search.value);
    updateReports();
  });

  search.addEventListener("input", () => renderProducts(search.value));

  renderProducts();
}

// SECTION: Invoices & line items
function createLineItemsHeader(container) {
  const header = document.createElement("div");
  header.className = "invoice-row invoice-row__header";
  header.innerHTML = `
    <div class="invoice-row__cell">Item</div>
    <div class="invoice-row__cell">Qty</div>
    <div class="invoice-row__cell">Price</div>
    <div class="invoice-row__cell">Line total</div>
    <div class="invoice-row__cell"></div>
  `;
  container.appendChild(header);
}

function addLineItem(initial = {}) {
  const container = $("#invoice-items-container");
  if (!container.querySelector(".invoice-row__header")) {
    createLineItemsHeader(container);
  }

  const row = document.createElement("div");
  row.className = "invoice-row";

  const description = document.createElement("input");
  description.type = "text";
  description.className = "invoice-row__input";
  description.placeholder = "Item description";
  description.value = initial.description || "";

  const productSelect = document.createElement("select");
  productSelect.className = "invoice-row__input invoice-product-select";

  const productWrapper = document.createElement("div");
  productWrapper.style.display = "flex";
  productWrapper.style.gap = "6px";
  productWrapper.appendChild(productSelect);
  productWrapper.appendChild(description);

  const qty = document.createElement("input");
  qty.type = "number";
  qty.min = "0";
  qty.step = "1";
  qty.className = "invoice-row__input";
  qty.value = initial.quantity ?? 1;

  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.step = "0.01";
  price.className = "invoice-row__input";
  price.value = initial.price ?? 0;

  const total = document.createElement("div");
  total.textContent = formatCurrency(0);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "invoice-row__remove";
  removeBtn.title = "Remove line";
  removeBtn.textContent = "✕";

  const cells = [productWrapper, qty, price, total, removeBtn];

  cells.forEach((content) => {
    const cell = document.createElement("div");
    cell.className = "invoice-row__cell";
    cell.appendChild(content);
    row.appendChild(cell);
  });

  container.appendChild(row);
  syncProductOptions();

  const recalc = () => updateInvoiceTotals();
  [qty, price, productSelect].forEach((el) => el.addEventListener("input", recalc));
  description.addEventListener("input", recalc);
  removeBtn.addEventListener("click", () => {
    row.remove();
    if (container.children.length <= 1) {
      container.innerHTML = ""; // remove header as well
    }
    updateInvoiceTotals();
  });

  productSelect.addEventListener("change", () => {
    const product = state.products.find((p) => p.id === productSelect.value);
    if (product) {
      if (!description.value) description.value = product.name;
      if (!price.value || Number(price.value) === 0) price.value = String(product.price);
    }
    updateInvoiceTotals();
  });

  updateInvoiceTotals();
}

function getInvoiceLines() {
  const container = $("#invoice-items-container");
  const rows = Array.from(container.querySelectorAll(".invoice-row"));
  // skip header row (has header class on container)
  return rows
    .filter((row) => !row.classList.contains("invoice-row__header"))
    .map((row) => {
      const [itemCell, qtyCell, priceCell] = row.querySelectorAll(".invoice-row__cell");
      const productSelect = itemCell.querySelector("select");
      const descriptionInput = itemCell.querySelector("input[type=text]");
      const qtyInput = qtyCell.querySelector("input");
      const priceInput = priceCell.querySelector("input");

      return {
        productId: productSelect.value || null,
        description: descriptionInput.value.trim(),
        quantity: Number(qtyInput.value) || 0,
        price: Number(priceInput.value) || 0,
      };
    })
    .filter((line) => line.quantity > 0 && (line.description || line.productId));
}

function updateInvoiceTotals() {
  const lines = getInvoiceLines();
  let subtotal = 0;
  let taxTotal = 0;

  lines.forEach((line, index) => {
    const lineBase = line.quantity * line.price;
    subtotal += lineBase;

    let taxRate = 0;
    if (line.productId) {
      const product = state.products.find((p) => p.id === line.productId);
      if (product) taxRate = product.taxRate || 0;
    }
    const tax = (lineBase * taxRate) / 100;
    taxTotal += tax;

    const container = $("#invoice-items-container");
    const rows = Array.from(container.querySelectorAll(".invoice-row"));
    const row = rows.filter((r) => !r.classList.contains("invoice-row__header"))[index];
    if (row) {
      const totalCell = row.querySelectorAll(".invoice-row__cell")[3];
      if (totalCell) totalCell.textContent = formatCurrency(lineBase + tax);
    }
  });

  const total = subtotal + taxTotal;
  $("#invoice-subtotal").textContent = formatCurrency(subtotal);
  $("#invoice-tax").textContent = formatCurrency(taxTotal);
  $("#invoice-total").textContent = formatCurrency(total);
}

function renderInvoices(filter = "") {
  const list = $("#invoice-list");
  const empty = $("#invoice-empty");
  list.innerHTML = "";

  const term = filter.trim().toLowerCase();
  const filtered = state.invoices.filter((inv) => {
    if (!term) return true;
    const client = state.clients.find((c) => c.id === inv.clientId);
    return (
      inv.number.toLowerCase().includes(term) ||
      (client && client.name.toLowerCase().includes(term))
    );
  });

  if (!filtered.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  filtered.forEach((invoice) => {
    const li = document.createElement("li");
    li.className = "list__item";

    const client = state.clients.find((c) => c.id === invoice.clientId);

    li.innerHTML = `
      <div class="list__item-main">
        <span class="list__item-title">${invoice.number}</span>
        <span class="list__item-subtitle">${client ? client.name : "Unknown client"}</span>
        <span class="list__item-meta">Issue ${invoice.issueDate} · Due ${invoice.dueDate}</span>
      </div>
      <div class="list__item-main" style="align-items:flex-end; text-align:right;">
        <span class="list__item-amount">${formatCurrency(invoice.total)}</span>
        <span class="list__item-meta">${invoice.status.toUpperCase()}</span>
      </div>
    `;

    list.appendChild(li);
  });

  syncInvoiceOptionsForPayments();
  updateReports();
}

function syncInvoiceOptionsForPayments() {
  const select = $("#payment-invoice");
  if (!select) return;

  const current = select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select invoice";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  state.invoices.forEach((inv) => {
    const client = state.clients.find((c) => c.id === inv.clientId);
    const opt = document.createElement("option");
    opt.value = inv.id;
    opt.textContent = `${inv.number} · ${client ? client.name : "Unknown"}`;
    select.appendChild(opt);
  });

  if (current) select.value = current;
}

function initInvoices() {
  const form = $("#invoice-form");
  const addInvoiceBtn = $("#add-invoice-btn");
  const quickInvoiceBtn = $("#new-invoice-quick");
  const search = $("#invoice-search");
  const addLineBtn = $("#add-line-item");
  const resetBtn = $("#invoice-reset");

  const goToInvoices = () => {
    const invoicesTab = $$('.nav-item').find((btn) => btn.dataset.section === 'invoices');
    invoicesTab?.click();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  addInvoiceBtn?.addEventListener("click", goToInvoices);
  quickInvoiceBtn?.addEventListener("click", goToInvoices);

  addLineBtn.addEventListener("click", () => addLineItem());

  resetBtn.addEventListener("click", () => {
    $("#invoice-items-container").innerHTML = "";
    updateInvoiceTotals();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const lines = getInvoiceLines();

    if (!lines.length) {
      alert("Add at least one line item before saving the invoice.");
      return;
    }

    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
    let taxTotal = 0;
    lines.forEach((line) => {
      let taxRate = 0;
      if (line.productId) {
        const product = state.products.find((p) => p.id === line.productId);
        if (product) taxRate = product.taxRate || 0;
      }
      taxTotal += (line.quantity * line.price * taxRate) / 100;
    });

    const invoice = {
      id: id(),
      clientId: data.get("invoiceClient"),
      number: data.get("invoiceNumber").toString().trim(),
      issueDate: data.get("invoiceDate"),
      dueDate: data.get("invoiceDue"),
      status: data.get("invoiceStatus"),
      lines,
      subtotal,
      tax: taxTotal,
      total: subtotal + taxTotal,
    };

    state.invoices.push(invoice);
    form.reset();
    $("#invoice-items-container").innerHTML = "";
    updateInvoiceTotals();
    renderInvoices(search.value);
  });

  search.addEventListener("input", () => renderInvoices(search.value));

  // start with one empty line
  addLineItem();
  renderInvoices();
}

// SECTION: Recurring invoices
function renderRecurring() {
  const list = $("#recurring-list");
  const empty = $("#recurring-empty");
  list.innerHTML = "";

  if (!state.recurring.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  state.recurring.forEach((item) => {
    const li = document.createElement("li");
    li.className = "list__item";

    const client = state.clients.find((c) => c.id === item.clientId);

    li.innerHTML = `
      <div class="list__item-main">
        <span class="list__item-title">${client ? client.name : "Unknown client"}</span>
        <span class="list__item-subtitle">${item.intervalLabel}</span>
        <span class="list__item-meta">Starts ${item.startDate}</span>
      </div>
      <div class="list__item-amount">
        ${formatCurrency(item.amount)} / ${item.interval}
      </div>
    `;

    list.appendChild(li);
  });

  updateReports();
}

function intervalLabel(value) {
  switch (value) {
    case "monthly":
      return "Bills every month";
    case "quarterly":
      return "Bills every quarter";
    case "yearly":
      return "Bills every year";
    default:
      return "Recurring";
  }
}

function initRecurring() {
  const form = $("#recurring-form");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const item = {
      id: id(),
      clientId: data.get("recurringClient"),
      interval: data.get("recurringInterval"),
      intervalLabel: intervalLabel(data.get("recurringInterval")),
      startDate: data.get("recurringStart"),
      amount: Number(data.get("recurringAmount")) || 0,
      notes: data.get("recurringNotes").toString().trim(),
    };

    state.recurring.push(item);
    form.reset();
    renderRecurring();
  });

  renderRecurring();
}

// SECTION: Payments
function renderPayments() {
  const list = $("#payment-list");
  const empty = $("#payment-empty");
  list.innerHTML = "";

  if (!state.payments.length) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  state.payments.forEach((payment) => {
    const li = document.createElement("li");
    li.className = "list__item";

    const invoice = state.invoices.find((inv) => inv.id === payment.invoiceId);
    const client = invoice && state.clients.find((c) => c.id === invoice.clientId);

    li.innerHTML = `
      <div class="list__item-main">
        <span class="list__item-title">${client ? client.name : "Unknown client"}</span>
        <span class="list__item-subtitle">Invoice ${invoice ? invoice.number : "N/A"}</span>
        <span class="list__item-meta">${payment.date} · ${payment.method}</span>
      </div>
      <div class="list__item-amount">
        ${formatCurrency(payment.amount)}
      </div>
    `;

    list.appendChild(li);
  });

  updateReports();
}

function initPayments() {
  const form = $("#payment-form");
  const addPaymentBtn = $("#add-payment-btn");

  addPaymentBtn?.addEventListener("click", () => {
    const paymentsTab = $$('.nav-item').find((btn) => btn.dataset.section === 'payments');
    paymentsTab?.click();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const payment = {
      id: id(),
      invoiceId: data.get("paymentInvoice"),
      date: data.get("paymentDate"),
      amount: Number(data.get("paymentAmount")) || 0,
      method: data.get("paymentMethod"),
      notes: data.get("paymentNotes").toString().trim(),
    };

    state.payments.push(payment);

    // Mark invoice as paid if fully covered
    const invoice = state.invoices.find((inv) => inv.id === payment.invoiceId);
    if (invoice) {
      const paidTotal = state.payments
        .filter((p) => p.invoiceId === invoice.id)
        .reduce((sum, p) => sum + p.amount, 0);
      if (paidTotal >= invoice.total) invoice.status = "paid";
    }

    form.reset();
    renderPayments();
    renderInvoices();
  });

  renderPayments();
}

// SECTION: Reports and statements
let invoiceStatusChart;

function updateReports() {
  updateKpis();
  renderInvoiceStatusChart();
  renderStatementPreview();
}

function updateKpis() {
  const outstanding = state.invoices
    .filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => sum + inv.total, 0);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const paidThisMonth = state.payments.reduce((sum, p) => {
    const d = new Date(p.date);
    if (!p.date || Number.isNaN(d.getTime())) return sum;
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
      ? sum + p.amount
      : sum;
  }, 0);

  $("#kpi-outstanding").textContent = formatCurrency(outstanding);
  $("#kpi-paid").textContent = formatCurrency(paidThisMonth);
  $("#kpi-recurring").textContent = state.recurring.length.toString();
}

function renderInvoiceStatusChart() {
  const ctx = document.getElementById("invoice-status-chart");
  if (!ctx || !window.Chart) return;

  const counts = {
    draft: 0,
    sent: 0,
    paid: 0,
  };

  state.invoices.forEach((inv) => {
    if (counts[inv.status] != null) counts[inv.status] += 1;
  });

  const data = {
    labels: ["Draft", "Sent", "Paid"],
    datasets: [
      {
        label: "Invoices",
        data: [counts.draft, counts.sent, counts.paid],
        backgroundColor: [
          "rgba(148, 163, 184, 0.8)",
          "rgba(56, 189, 248, 0.8)",
          "rgba(34, 197, 94, 0.9)",
        ],
        borderWidth: 0,
        borderRadius: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9ca3af" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(55, 65, 81, 0.6)" },
        ticks: { color: "#9ca3af" },
      },
    },
  };

  if (!window.Chart) return;

  if (invoiceStatusChart) {
    invoiceStatusChart.data = data;
    invoiceStatusChart.options = options;
    invoiceStatusChart.update();
  } else {
    invoiceStatusChart = new window.Chart(ctx, {
      type: "bar",
      data,
      options,
    });
  }
}

function renderStatementPreview() {
  const select = $("#statement-client");
  const container = $("#statement-preview");
  if (!select || !container) return;

  const clientId = select.value;
  if (!clientId) {
    container.innerHTML = '<p class="statement__empty">Choose a client to preview their statement.</p>';
    return;
  }

  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return;

  const clientInvoices = state.invoices.filter((inv) => inv.clientId === clientId);
  const total = clientInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const paid = state.payments
    .filter((p) => clientInvoices.some((inv) => inv.id === p.invoiceId))
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = total - paid;

  container.innerHTML = `
    <div class="statement__header">
      <div>
        <div style="font-weight:500;">${client.name}</div>
        <div style="font-size:12px; color:#9ca3af;">${client.email || ""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px; color:#9ca3af;">Outstanding</div>
        <div style="font-weight:600;">${formatCurrency(balance)}</div>
      </div>
    </div>
    <div class="statement__row">
      <span>Total billed</span>
      <span>${formatCurrency(total)}</span>
    </div>
    <div class="statement__row">
      <span>Payments received</span>
      <span>${formatCurrency(paid)}</span>
    </div>
  `;
}

// SECTION: Google Drive integration hooks
// NOTE: This is a placeholder for a real implementation with OAuth & Drive API.
// The functions below show where you would add calls to Google APIs.

const drive = {
  isConnected: false,

  async connect() {
    // In a production app, you would:
    // 1. Trigger Google OAuth
    // 2. Store the access token
    // 3. Create or locate an app folder in Drive
    // Here we just simulate a short delay and mark as connected.
    const statusDot = document.querySelector(".drive-status__dot");
    const statusLabel = document.querySelector(".drive-status__label");
    if (!statusDot || !statusLabel) return;

    statusLabel.textContent = "Connecting…";

    await new Promise((resolve) => setTimeout(resolve, 800));

    this.isConnected = true;
    statusDot.classList.remove("drive-status__dot--disconnected");
    statusDot.classList.add("drive-status__dot--connected");
    statusLabel.textContent = "Connected (demo)";
  },

  // Serializes local state ready to be sent to Google Drive
  exportPayload() {
    return JSON.stringify(state, null, 2);
  },

  // Demonstrates where you would import state from Google Drive
  importPayload(payload) {
    try {
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      Object.assign(state, parsed);
      // Re-render all UI from imported data
      renderClients();
      renderProducts();
      renderInvoices();
      renderRecurring();
      renderPayments();
      updateReports();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to import data from Drive", e);
    }
  },
};

function initDrive() {
  const connectBtn = document.getElementById("drive-connect");
  connectBtn?.addEventListener("click", () => {
    drive.connect();
  });
}

// SECTION: Utilities
function formatCurrency(amount) {
  if (Number.isNaN(amount)) amount = 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// SECTION: Statement client change listener
function initStatementListener() {
  const select = $("#statement-client");
  if (!select) return;
  select.addEventListener("change", renderStatementPreview);
}

// SECTION: Bootstrapping
window.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initClients();
  initProducts();
  initInvoices();
  initRecurring();
  initPayments();
  initDrive();
  initStatementListener();

  // Set billing period label to current month/year
  const now = new Date();
  const label = now.toLocaleString("en-US", { month: "short", year: "numeric" });
  const periodEl = document.getElementById("current-period");
  if (periodEl) periodEl.textContent = label;

  updateReports();
});
