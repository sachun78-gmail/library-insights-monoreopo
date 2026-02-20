# Production Setup (Ubuntu + Nginx + systemd)

## 1) Prepare app env

Create `apps/server/.env`:

```env
HOST=127.0.0.1
PORT=8080
DATA4LIBRARY_API_KEY=...
PROXY_SHARED_SECRET=...
```

`127.0.0.1` is recommended when Nginx is in front.

## 2) Build server

```bash
cd /opt/bookReserch
npm install
npm run build -w @bookreserch/server
```

## 3) Install systemd service

```bash
cd /opt/bookReserch
sudo cp deploy/systemd/bookreserch-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bookreserch-server
sudo systemctl status bookreserch-server --no-pager
```

Logs:

```bash
journalctl -u bookreserch-server -f
```

## 4) Install Nginx reverse proxy

```bash
sudo apt-get update
sudo apt-get install -y nginx
cd /opt/bookReserch
sudo cp deploy/nginx/bookreserch-server.conf /etc/nginx/sites-available/bookreserch-server
sudo ln -sf /etc/nginx/sites-available/bookreserch-server /etc/nginx/sites-enabled/bookreserch-server
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

## 5) Firewall recommendation

When Nginx is enabled, close direct app port and expose only 80/443:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8080/tcp
sudo ufw status
```

## 6) TLS

Let's Encrypt requires a real domain (`A` record to this server IP).  
Without a domain, trusted public TLS cannot be issued.

Options before buying a domain:

1. HTTP only on IP (temporary)
2. Self-signed cert on IP (encrypted but browser warning)
3. Cloudflare Tunnel/Zero Trust (if you want HTTPS without opening inbound ports)

After you buy a domain, run:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com
```

## 7) Cloudflare Pages env update

Set in Pages project:

- `LIB_PROXY_BASE_URL=https://api.your-domain.com`
- `LIB_PROXY_SHARED_SECRET=<same as server PROXY_SHARED_SECRET>`
