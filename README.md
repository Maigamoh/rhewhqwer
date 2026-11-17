# Clinical Triage Decision Support

A static website that helps clinicians prioritise cases for review. It scores clinical data with **NEWS2** and can take an optional score from a **separately validated, approved imaging model** (`image_ai_score`, 0–1; ≥ 0.70 escalates one tier). All processing happens in the browser. No data leaves the device.

> **Not a medical device.** Decision support only; a clinician makes every decision. Before clinical use you need local validation, bias/subgroup testing, regulatory clearance, and a clinical safety case. NEWS2 is not validated for children, pregnancy, or chronic hypercapnic respiratory failure.

## Data rules
Only use data that is synthetic, de-identified, or that you hold a lawful basis and licence to use. The site enforces an attestation gate and keeps a local audit log.

## Run in VS Code
1. Install [VS Code](https://code.visualstudio.com/) and open this folder (`File → Open Folder`).
2. Install the recommended **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server** (http://127.0.0.1:5500).

Alternative (Node.js): `npm start`.

## Publish to GitHub
```bash
git init -b main
git add .
git commit -m "Initial commit: triage decision support"
# Option A: GitHub CLI
gh repo create triage-support --public --source=. --push
# Option B: create an empty repo on github.com first, then
git remote add origin https://github.com/<your-username>/triage-support.git
git push -u origin main
```
Then on GitHub: **Settings → Pages → Source: GitHub Actions**. The included workflow deploys on every push to `main`. Your site goes live at `https://<your-username>.github.io/triage-support/`.

## X-ray batch prioritisation (`scan.html`)
1. Train the model with `pneumonia_training_colab.ipynb` and download `pneumonia_model_export.zip`.
2. Unzip `pneumonia_densenet121.onnx` and `model_meta.json` into `model/`.
3. Open `scan.html` through Live Server. Select several chest X-rays; they are ranked by estimated pneumonia likelihood, each with an attention heatmap. Ranking is **not** clinical severity.

## CSV format
`id,age,rr,spo2,o2,sbp,pulse,temp,alert,image_ai_score` (see `sample-data/sample.csv`). Use `o2` = 1 for supplemental oxygen and `alert` = 0 if not alert.

## Structure
```
index.html      page markup
css/styles.css  styling (light/dark)
js/app.js       NEWS2 scoring, tiering, audit log
sample-data/    synthetic example CSV
.github/        Pages deployment workflow
```
