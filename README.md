# Road Chart apps

## Deploy on Netlify

1. **Sign in:** Go to [netlify.com](https://www.netlify.com) and sign in.
2. **Deploy:**
   - **Drag & drop:** In the Netlify dashboard, open **Sites → Add new site → Deploy manually**. Drag the **Road Chart** folder (the one that contains `index.html`, `extract.html`, `styles.css`, etc.) into the drop zone.
   - **Or with Git:** Initialize a repo in this folder, push to GitHub/GitLab, then in Netlify choose **Add new site → Import an existing project** and connect the repo. Publish directory: **`.`** (or leave default). No build command.
3. Your site will be live at a URL like `https://random-name-123.netlify.app`. You can set a custom domain in **Site settings → Domain management**.

---

## 1. Query Language Analyzer (`index.html`)

Analyse data query language (SQL-style): parse queries, view tokens and structure, and run SELECTs against your CSV data.

### Features

- **Analyze** – Tokenize and parse SQL: see query type, tables, columns, WHERE, ORDER BY, LIMIT.
- **Tokens** – View the token stream (keywords, identifiers, strings, numbers, operators).
- **Run** – Load a CSV (e.g. `Road Chart.csv`), write a SELECT query, and run it in the browser.

## How to run

1. Open `index.html` in a browser (double-click or **File → Open**).
2. Or serve the folder with a local server, e.g.  
   `npx serve .`  
   then open the URL shown (e.g. http://localhost:3000).

## Usage

1. **Analyze** – Type a SQL query and click **Analyze** to see its structure and tokens.
2. **Load CSV** – Click **Load CSV** and choose `Road Chart.csv` (or any CSV).
3. **Run on data** – Use a SELECT with table name `data`, e.g.  
   `SELECT Road_No, "Name of road", Scheme FROM data WHERE Scheme = 'CRIDP' LIMIT 10`  
   then click **Run on data** to see results.

## Supported query features (for Run)

- `SELECT col1, col2 FROM data` or `SELECT * FROM data`
- `WHERE column = 'value'` (and `!=`, `>`, `<`, `>=`, `<=`)
- `ORDER BY column`
- `LIMIT n`

Column names with spaces must be double-quoted, e.g. `"Name of road"`.

---

## 2. Extract by Completed Year (`extract.html`)

Extract rows where **Completed Year &lt; input year**, with:

- **Length of stretch per road** – table of Road No, Name of road, total length (sum of `Length`), and number of stretches
- **Total length** – sum of all matching stretch lengths
- **All matching rows** – full data table in a second tab

### Usage

1. Open `extract.html`.
2. Click **Load CSV** and choose `Road Chart.csv`.
3. Enter a year (e.g. `2020`).
4. Click **Extract**. View the “By road” summary and “All matching rows” tab.
