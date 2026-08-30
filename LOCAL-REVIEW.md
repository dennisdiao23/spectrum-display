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

5. Run locally

```
npm start
```

6. Open in browser

- Site: http://localhost:3000
- Designer: http://localhost:3000/led-wall-calculator
- Company sign in: http://localhost:3000/company
- Company website: http://localhost:3000/company/website
- Company inventory: http://localhost:3000/company/inventory

Leave the PowerShell window open while you look. Closing it, or Ctrl+C, stops the server.

7. If it looks old

- Stop the server: **Ctrl + C**
- Pull again, then `npm start`
- Hard refresh: **Ctrl + F5**

**See mobile size on a PC:** Chrome → **F12** → **Ctrl + Shift + M**. Pick a phone (for example iPhone 12 Pro) and refresh.

---

## After you like it

Merging to **`main`** tells Railway to rebuild. Watch the **web** service until the deploy is **SUCCESS**, then check https://www.spectrumdisplay.com (hard refresh there too).

If Railway is still on the old version, localhost can already be right — they are two different copies.
