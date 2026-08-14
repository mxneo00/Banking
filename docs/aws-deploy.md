# AWS first deploy (us-east-1)

Beginner path for this repo: React files on S3, FastAPI on one EC2 instance,
Postgres on Supabase, CloudFront as the HTTPS URL (no custom domain).

Do **not** paste `.pem` files, AWS keys, `DATABASE_URL`, or `JWT_SECRET_KEY`
into chat or into git.

Current resources (us-east-1):

- EC2 (Amazon Linux 2023): Elastic IP `100.59.252.244`, SSH user `ec2-user`
- Key pair file: `jooyoung-key.pem` (store outside the repo)
- S3 bucket: `banking-frontend-jooyoung` (keep **Block all public access** on)

---

## 1. Supabase

1. Create a project (East US if offered). Save the database password.
2. Use the **session pooler** URI (IPv4). Direct `db.<ref>.supabase.co` is often
   IPv6-only and EC2 cannot reach it.
3. Format for this app:

   `postgresql+psycopg://postgres.<ref>:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`

4. You do not create tables by hand. `init_db()` runs `create_all` on API startup.
5. Optional: from your laptop, put that URL in `.env` and run `python check_connection.py`.

If the password contains `%`, `#`, or spaces, URL-encode it. systemd also treats
`%` specially in `EnvironmentFile` — prefer a password without `%`.

---

## 2. Windows SSH (already working)

In PowerShell (adjust the path if the key is not in Downloads):

```powershell
icacls "$env:USERPROFILE\Downloads\jooyoung-key.pem" /inheritance:r
icacls "$env:USERPROFILE\Downloads\jooyoung-key.pem" /grant:r "${env:USERNAME}:(R)"
ssh -i "$env:USERPROFILE\Downloads\jooyoung-key.pem" ec2-user@100.59.252.244
```

---

## 3. Install the API on EC2

Push this branch to GitHub first, then on the instance:

```bash
sudo dnf update -y
sudo dnf install -y git nginx python3.11 python3.11-pip
cd ~
git clone -b jygonza-deployment https://github.com/mxneo00/Banking.git
cd Banking
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If `git clone` asks for credentials, the repo is private: use a GitHub personal
access token, or copy the project from your laptop with `scp` instead.

Create `/home/ec2-user/Banking/.env` (never commit this file):

```bash
nano /home/ec2-user/Banking/.env
```

Use a **new** JWT secret. Generate one on the instance:

```bash
python3.11 -c "import secrets; print(secrets.token_hex(32))"
```

`.env` contents (fill in secrets yourself):

```
DATABASE_URL=postgresql+psycopg://postgres.<ref>:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
JWT_SECRET_KEY=<paste-the-generated-hex>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://REPLACE_WITH_CLOUDFRONT_DOMAIN
SEED_DEMO_DATA=false
```

Leave `CORS_ORIGINS` as a placeholder until CloudFront exists, then edit and
`sudo systemctl restart banking-api`.

Install systemd + nginx:

```bash
sudo cp /home/ec2-user/Banking/deploy/banking-api.service /etc/systemd/system/
sudo cp /home/ec2-user/Banking/deploy/nginx.conf /etc/nginx/conf.d/banking-api.conf
sudo nginx -t
```

If `nginx -t` errors about a duplicate `default_server`, open `/etc/nginx/nginx.conf`
and comment out the built-in `server { listen 80 ... }` block, then `sudo nginx -t` again.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now banking-api
sudo systemctl enable --now nginx
```

Smoke tests:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1/health
```

From your laptop browser or PowerShell: `http://100.59.252.244/health` should
return `{"status":"ok"}`.

Logs if it fails: `sudo journalctl -u banking-api -e`

---

## 4. Frontend to S3

On your **laptop** (not EC2), from `frontend/`:

```powershell
copy .env.production.example .env.production
npm ci
npm run build
```

`VITE_API_URL` must be empty so the browser calls `/api/...` on the CloudFront
origin. Upload the contents of `frontend/dist/` to bucket `banking-frontend-jooyoung`
(object at the bucket root: `index.html`, plus `assets/`). Console: bucket →
**Upload**. Keep block public access **on**. Do not enable static website hosting.

---

## 5. CloudFront (after `/health` works on port 80)

One distribution, two origins. Create in the CloudFront console (distributions
are global; the S3 origin stays `us-east-1`).

1. **Origin 1 — S3:** origin domain = `banking-frontend-jooyoung.s3.us-east-1.amazonaws.com`.
   Origin access: **Origin access control settings (recommended)**. Create an OAC
   (sign requests, S3). CloudFront will show a bucket-policy snippet — paste it
   into the S3 bucket **Permissions → Bucket policy**.
2. **Origin 2 — EC2:** origin domain = `100.59.252.244`, protocol **HTTP only**,
   HTTP port 80. Name it e.g. `banking-api-ec2`.
3. **Default behavior:** origin = S3. Viewer protocol = Redirect HTTP to HTTPS.
4. **Additional behavior:** path pattern `/api*`, origin = EC2, viewer protocol =
   Redirect HTTP to HTTPS, allowed methods GET/HEAD/OPTIONS/PUT/POST/PATCH/DELETE,
   cache policy **CachingDisabled**, origin request policy **AllViewerExceptHostHeader**
   (or forward all headers except Host if that policy name differs).
5. **Error pages:** create custom responses for **403** and **404** → `/index.html`,
   response code **200**. Required for React Router (`/login`, `/budgets`, …).
6. Wait until the distribution status is **Enabled**. The URL looks like
   `https://dxxxx.cloudfront.net`.

Then on EC2, set `CORS_ORIGINS=https://dxxxx.cloudfront.net` in `.env` and:

```bash
sudo systemctl restart banking-api
```

Open the CloudFront URL, register or log in, and hit a customer page.

---

## 6. Security before you share the URL

- New `JWT_SECRET_KEY` (not the `.env.example` placeholder)
- `SEED_DEMO_DATA=false` unless you want demo passwords on the internet
- `.pem` and `.env` stay off git
- SSH port 22 from your IP only; Uvicorn bound to localhost
- Elastic IP stays associated (free only while attached)

---

## 7. Updating later

- **API:** SSH, `cd ~/Banking`, `git pull`, `sudo systemctl restart banking-api`.
  Re-run `pip install -r requirements.txt` inside the venv if dependencies changed.
- **Frontend:** rebuild locally, re-upload `dist/` to S3, then CloudFront →
  **Invalidations** → create `/*` (otherwise old JS can stick for up to 24h).
- **Stop/start EC2:** the Elastic IP keeps CloudFront’s origin stable. systemd
  starts `banking-api` and nginx on reboot if they were enabled.
