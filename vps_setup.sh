#!/bin/bash
# 🚀 Emerald CRM - VPS Environment Setup Script
# Run this once on your Hostinger VPS to prepare it for GitHub Auto-Deploy.

echo "Installing system dependencies..."
sudo apt update
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx

echo "Installing global Node.js packages..."
sudo npm install -g pm2

echo "Configuring Nginx for emeraldconsultancycompany.com..."
sudo rm -f /etc/nginx/sites-available/emerald-crm
sudo rm -f /etc/nginx/sites-enabled/emerald-crm

cat <<EOF | sudo tee /etc/nginx/sites-available/emerald-crm
server {
    listen 80;
    server_name emeraldconsultancycompany.com www.emeraldconsultancycompany.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/emerald-crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

echo "--------------------------------------------------------"
echo "✅ VPS Environment Ready!"
echo "Next Step: Add your GitHub Secrets and push to deploy."
echo "--------------------------------------------------------"
