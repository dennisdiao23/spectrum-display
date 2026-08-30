# How to review on this PC

Cloud Cursor does **not** change the files on your Windows folder by itself. GitHub is the hand-off. Pull on this PC, then `npm start`, then look at **localhost**. The live site is a separate step.

## Flow that works

```
Cloud Cursor makes changes
        ↓
Pushes (or you merge) to GitHub
        ↓
On your PC: git pull
        ↓
npm start → review localhost
        ↓
When happy → deploy / live on Railway
```

**Live site** (after a successful Railway deploy): https://www.spectrumdisplay.com  
**This PC folder:** `C:\Users\denni\OneDrive\Desktop\spectrum-display`

OneDrive does **not** update GitHub. `localhost` only shows what you pulled.

---

## Step-by-step on your PC

1. Open **PowerShell**

2. Go to the project

```
cd C:\Users\denni\OneDrive\Desktop\spectrum-display
```

3. Get the latest code from GitHub

```
git checkout main
git pull origin main
```

4. Install deps if needed (first time, or after new packages)

```
npm install
```

5. Stop every old Node first (this is why `/company` 404s while the homepage works)

```
taskkill /F /IM node.exe
```

Then start one server:

```
npm start
```

The PowerShell window should say `Listening on 0.0.0.0:3000` and `Company: http://localhost:3000/company`. Leave that window open.

6. Open in browser

- Site: http://localhost:3000
- Company sign in: http://localhost:3000/company
- If `/company` still fails: http://localhost:3000/company.html
- Designer: http://localhost:3000/led-wall-calculator
- Company website: http://localhost:3000/company/website
- Company inventory: http://localhost:3000/company/inventory
- Company customers: http://localhost:3000/company/customers
- Sales quotes: http://localhost:3000/company/sales/quotes
- Sales orders: http://localhost:3000/company/sales/orders
- Invoices: http://localhost:3000/company/sales/invoices

7. If it looks old

- `taskkill /F /IM node.exe`
- Pull again, then `npm start`
- Hard refresh: **Ctrl + F5**

**See mobile size on a PC:** Chrome → **F12** → **Ctrl + Shift + M**. Pick a phone (for example iPhone 12 Pro) and refresh.

---

## After you like it

Merging to **`main`** tells Railway to rebuild. Watch the **web** service until the deploy is **SUCCESS**, then check https://www.spectrumdisplay.com (hard refresh there too).

If Railway is still on the old version, localhost can already be right — they are two different copies.
