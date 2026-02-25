# Production Setup (Ubuntu + Nginx + systemd)

## 1) Prepare app env

Create `apps/server/.env`:

```env
HOST=127.0.0.1
PORT=8080
DATA4LIBRARY_API_KEY=...
PROXY_SHARED_SECRET=...
OPENAI_API_KEY=...
```

`127.0.0.1` is recommended when Nginx is in front.

## 2) Build server

```bash
cd /opt/library-insights
npm install
npm run build -w @library-insights/server
```

## 3) Install systemd service

```bash
cd /opt/library-insights
sudo cp deploy/systemd/library-insights-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now library-insights-server
sudo systemctl status library-insights-server --no-pager
```

Logs:

```bash
journalctl -u library-insights-server -f
```

## 4) Install Nginx reverse proxy

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
cd /opt/library-insights
sudo cp deploy/nginx/library-insights-server.conf /etc/nginx/sites-available/library-insights-server
sudo ln -sf /etc/nginx/sites-available/library-insights-server /etc/nginx/sites-enabled/library-insights-server
```

SSL 인증서 발급 (DNS A 레코드가 먼저 적용되어야 함):

```bash
sudo certbot --nginx -d api.library-insights.work
```

```bash
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 5) Firewall recommendation

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8080/tcp
sudo ufw status
```

## 6) Cloudflare Pages env update

Set in Pages project dashboard:

- `LIB_PROXY_BASE_URL=https://api.library-insights.work`
- `LIB_PROXY_SHARED_SECRET=<same as server PROXY_SHARED_SECRET>`

> `OPENAI_API_KEY` is no longer needed in Cloudflare Pages.
> OpenAI calls are now proxied through the VPS server.
