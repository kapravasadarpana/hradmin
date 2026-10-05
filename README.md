# HR Portal: GitHub Pages frontend -> Apps Script backend -> Google Sheet

## 1. Backend (Google Sheet + Apps Script)
1. Create a Google Sheet and copy its ID (the long string in the URL).
2. In the sheet: Extensions > Apps Script. Paste `backend/Code.gs` (replace everything).
3. Project Settings > Script Properties > add `SPREADSHEET_ID` = your sheet ID.
4. Select function `setup` > Run (authorize). This creates the tabs and the admin user.
   Login: `admin` / `ChangeMe123!` (change it right away).
5. Deploy > New deployment > Web app: Execute as **Me**, Who has access **Anyone**.
6. Copy the Web app URL (ends with `/exec`).

## 2. Frontend (GitHub Pages)
1. Open `frontend/config.js` and paste the Web app URL.
2. Create a GitHub repo and upload the contents of `frontend/` (index.html, styles.css, app.js, config.js) to the repo root.
3. Settings > Pages > Deploy from branch > `main` / root. Your site is at `https://<user>.github.io/<repo>/`.

## Notes
- After editing Code.gs, use Deploy > Manage deployments > Edit > New version, or the URL keeps serving old code.
- Requests use `text/plain` so the browser skips the CORS preflight, which Apps Script can't answer.
- I changed `doPost` to a whitelist. The original let anyone call internal helpers like `readRows_('users')` or `setup` with no login, which would expose password hashes.
