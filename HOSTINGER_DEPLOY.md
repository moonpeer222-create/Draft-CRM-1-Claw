# 🚀 Hostinger Deployment Guide

Your code is now pushed to GitHub! Follow these steps to deploy your multi-tenant CRM to Hostinger.

## Option 1: Hostinger Shared Hosting (H-Panel)
If you are using standard Hostinger Web Hosting, follow these steps:

1.  **Build Locallly:**
    - Run `npm run build` in your terminal.
    - This creates a `dist/` folder.
2.  **Upload via File Manager:**
    - Log into your Hostinger H-Panel.
    - Go to **File Manager** -> `public_html`.
    - Upload all files inside the `dist/` folder into `public_html`.
3.  **Configure .htaccess (IMPORTANT):**
    - Since this is a Single Page App (SPA), you need to ensure all routes redirect to `index.html`.
    - Create a file named `.htaccess` in `public_html` with:
      ```apache
      <IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
      </IfModule>
      ```

## Option 2: Hostinger Git Integration (Auto-Deploy)
This is the **recommended** way if your Hostinger plan supports it:

1.  In H-Panel, go to **Advanced** -> **Git**.
2.  Connect your GitHub repository: `https://github.com/moonpeer222-create/Draft-CRM-1-Claw.git`
3.  Select the `main` branch.
4.  Set the **Deployment Path** to `public_html`.
5.  In the **Auto-Deployment** section, use this build command if allowed:
    - `npm install && npm run build`
    - *Note:* If Hostinger doesn't support build commands, you must push the `dist` folder to a separate branch (not recommended) or use a GitHub Action to FTP/SSH the files.

## Option 3: Hostinger VPS (Ubuntu/Debian)
If you have a VPS, run these commands via SSH:

```bash
# 1. Update and install Node
sudo apt update && sudo apt install nodejs npm -y

# 2. Clone the repo
git clone https://github.com/moonpeer222-create/Draft-CRM-1-Claw.git
cd Draft-CRM-1-Claw

# 3. Install and Build
npm install
npm run build

# 4. Serve with PM2 or Nginx
sudo npm install -g serve
pm2 start "serve -s dist -p 3000" --name "emerald-crm"
```

---

### 🔑 API Configuration
Don't forget to add your **Supabase Environment Variables** in the Hostinger panel (or in a `.env` file on VPS):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
