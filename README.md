# MiniMart Computerized Accounting System

A complete **frontend-only** university semester project that demonstrates how a Kenyan mini supermarket can manage sales, purchases, inventory, expenses and financial records using a computerized accounting system.

Built with **HTML5**, **CSS3** and ** JavaScript**. All data is stored in the browser using **LocalStorage**.

> This is a demonstration system for academic presentation. Login authentication is simulated in JavaScript and is **not** production-grade security.

---

## Features

- Professional login with role-based demo accounts
- Dashboard with live statistics and charts
- Product, inventory, supplier and customer management
- Point of Sale (POS) with printable receipts
- Purchase recording with automatic stock increase
- Expense tracking (operating expenses only)
- Accounting views: Revenue, COGS, Gross Profit, Net Profit
- Reports with date filters, print and CSV export
- User management and business settings
- Sample Kenyan supermarket data in **KES**

---

## Demo login accounts

| Role | Username | Password |
|------|----------|----------|
| Administrator | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |
| Accountant | `accountant` | `account123` |
| Storekeeper | `storekeeper` | `store123` |

---

## How to open and run (Google Chrome + VS Code Live Server)

1. Install **Visual Studio Code** if you do not already have it.
2. Install the **Live Server** extension by Ritwick Dey:
   - Open VS Code
   - Go to Extensions (`Ctrl+Shift+X`)
   - Search for `Live Server`
   - Click **Install**
3. In VS Code, open the project folder:
   - **File → Open Folder…**
   - Select the `MiniMart` folder (the folder that contains `index.html` and `login.html`)
4. In the Explorer pane, right-click `index.html` or `login.html`
5. Choose **Open with Live Server**
6. Google Chrome should open automatically at an address like:
   - `http://127.0.0.1:5500/index.html`
7. Click **Launch System** / go to the login page and sign in with a demo account.

### Alternative (without Live Server)

You can also double-click `index.html` or `login.html` to open the files directly in Chrome. Live Server is recommended because it refreshes the page automatically when you edit files.

---

## Suggested presentation flow

1. Log in as **Administrator**
2. Show the **Dashboard** (sales, profit, low stock)
3. Open **POS / Sales**, complete a sale and print a receipt
4. Show **Inventory** stock reduced after the sale
5. Record a **Purchase** and show stock increased
6. Open **Accounting** and explain Revenue − COGS = Gross Profit, then Gross − Expenses = Net Profit
7. Generate a **Profit & Loss** report and export CSV
8. Log out and log in as **Cashier** to show restricted menu access

---

## Resetting sample data

Administrators can reset the original demonstration data from **Settings → Reset demonstration data**.

---

## Project structure

```
MiniMart/
├── index.html
├── login.html
├── dashboard.html
├── products.html
├── inventory.html
├── sales.html
├── purchases.html
├── suppliers.html
├── customers.html
├── expenses.html
├── accounting.html
├── reports.html
├── users.html
├── settings.html
├── css/
│   ├── style.css
│   ├── dashboard.css
│   └── responsive.css
├── js/
│   ├── storage.js
│   ├── auth.js
│   ├── main.js
│   ├── dashboard.js
│   ├── products.js
│   ├── inventory.js
│   ├── sales.js
│   ├── purchases.js
│   ├── suppliers.js
│   ├── customers.js
│   ├── expenses.js
│   ├── accounting.js
│   ├── reports.js
│   ├── users.js
│   └── settings.js
└── README.md
```

---

## Notes for markers / examiners

- No PHP, Python, Java, C++, MySQL or backend server is required.
- Financial calculations distinguish **sales revenue**, **cost of goods sold** and **operating expenses**.
- Inventory purchases increase stock and are **not** counted as operating expenses when calculating net profit.
- All modules share one LocalStorage data layer so the dashboard, reports and accounting pages stay in sync.
