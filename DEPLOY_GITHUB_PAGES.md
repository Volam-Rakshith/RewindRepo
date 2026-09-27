# Deploy RewindRepo to GitHub Pages from Windows CMD

This zip already includes the GitHub Pages workflow at:

```text
.github/workflows/deploy-pages.yml
```

So you do **not** need PowerShell, Notepad, `mkdir -p`, or `cat`.

## 1. Extract the zip

Use Windows File Explorer:

1. Right-click `RewindRepo-GitHubPages-Ready.zip`.
2. Click **Extract All**.
3. Open the extracted `RewindRepo` folder.
4. Click the folder address bar, type `cmd`, and press Enter.

You should now be inside the project folder in Command Prompt.

## 2. Push to your GitHub repo

Run these commands exactly:

```bat
git init
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Volam-Rakshith/RewindRepo.git
git add .
git commit -m "Initial commit: add RewindRepo with GitHub Pages deployment"
git push -u origin main
```

If Git says your identity is missing, run these once and retry the commit:

```bat
git config --global user.name "Volam Rakshith"
git config --global user.email "YOUR_GITHUB_EMAIL@example.com"
git commit -m "Initial commit: add RewindRepo with GitHub Pages deployment"
git push -u origin main
```

If push is rejected because the GitHub repo already has a README or other files, run:

```bat
git pull origin main --allow-unrelated-histories
git push -u origin main
```

If GitHub asks for login, use your GitHub username and a Personal Access Token instead of your password.

## 3. Enable GitHub Pages

Go to:

```text
https://github.com/Volam-Rakshith/RewindRepo/settings/pages
```

Set:

```text
Source: GitHub Actions
```

## 4. Wait for deployment

Go to:

```text
https://github.com/Volam-Rakshith/RewindRepo/actions
```

Open **Deploy to GitHub Pages** and wait until it becomes green.

## 5. Live URL

Your app should be live at:

```text
https://volam-rakshith.github.io/RewindRepo/
```
