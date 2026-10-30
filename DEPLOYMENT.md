# OpsPilot AI — Production Deployment & Run Guide

This guide provides end-to-end instructions for running and deploying **OpsPilot AI** across different production and testing environments:

1. [Local Production Run via Docker Compose](#1-local-production-run-via-docker-compose)
2. [Standalone Container Deployments](#2-standalone-container-deployments)
3. [Bare-Metal / Linux VM Deployment (Systemd + Nginx)](#3-bare-metal--linux-vm-deployment-systemd--nginx)
4. [Cloud Container Deployment (GCP Cloud Run / AWS ECS / Render)](#4-cloud-container-deployment)
5. [Split Deployment (Vercel/Netlify Frontend + Cloud Backend)](#5-split-deployment-static-frontend--cloud-api)
6. [Environment Variables Reference](#6-environment-variables-reference)

---

## 1. Local Production Run via Docker Compose

The fastest, zero-dependency way to spin up the entire platform locally in production mode:

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Commands
```bash
# Clone the repository
git clone https://github.com/saniamactelinap/opspilot-ai.git
cd opspilot-ai

# Build and start both containers
docker compose up --build -d
```

### Accessing the Services
* **Frontend Web Dashboard:** [http://localhost:5173](http://localhost:5173)
* **Backend REST API:** [http://localhost:8000](http://localhost:8000)
* **API Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Stopping Containers
```bash
docker compose down
```

---

## 2. Standalone Container Deployments

You can build and deploy the backend and frontend Docker containers individually:

### Backend Container
```bash
cd backend
docker build -t opspilot-backend:latest .
docker run -d -p 8000:8000 --name opspilot-backend opspilot-backend:latest
```

### Frontend Container
```bash
cd frontend
docker build --build-arg VITE_API_BASE_URL=http://localhost:8000 -t opspilot-frontend:latest .
docker run -d -p 5173:80 --name opspilot-frontend opspilot-frontend:latest
```

---

## 3. Bare-Metal / Linux VM Deployment (Systemd + Nginx)

For deployment on an Ubuntu/Debian virtual private server (AWS EC2, GCP Compute Engine, DigitalOcean Droplet, Hetzner):

### Step 1: Install System Dependencies
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nodejs npm nginx git
```

### Step 2: Clone & Setup Backend
```bash
cd /opt
sudo git clone https://github.com/saniamactelinap/opspilot-ai.git
sudo chown -R $USER:$USER /opt/opspilot-ai
cd /opt/opspilot-ai

# Create backend virtual environment & install requirements
python3 -m venv backend/.venv
./backend/.venv/bin/pip install --upgrade pip
./backend/.venv/bin/pip install -r backend/requirements.txt
```

### Step 3: Configure Systemd Service for Backend
Create `/etc/systemd/system/opspilot-backend.service`:
```ini
[Unit]
Description=OpsPilot AI FastAPI Backend Server
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/opspilot-ai/backend
ExecStart=/opt/opspilot-ai/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable opspilot-backend
sudo systemctl start opspilot-backend
```

### Step 4: Build Frontend Assets
```bash
cd /opt/opspilot-ai/frontend
npm ci
VITE_API_BASE_URL=/api npm run build
```

### Step 5: Configure Nginx as Reverse Proxy
Create `/etc/nginx/sites-available/opspilot`:
```nginx
server {
    listen 80;
    server_name your-domain.com; # or server IP

    # Frontend Single Page App
    location / {
        root /opt/opspilot-ai/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger Documentation
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/opspilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Cloud Container Deployment

### Google Cloud Run
1. **Backend:**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/opspilot-backend backend/
   gcloud run deploy opspilot-backend \
     --image gcr.io/YOUR_PROJECT_ID/opspilot-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```
2. Note the returned backend URL (e.g. `https://opspilot-backend-xyz-uc.a.run.app`).

3. **Frontend:**
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/opspilot-frontend \
     --build-arg VITE_API_BASE_URL=https://opspilot-backend-xyz-uc.a.run.app frontend/
   gcloud run deploy opspilot-frontend \
     --image gcr.io/YOUR_PROJECT_ID/opspilot-frontend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Render or Railway
* **Backend:** Connect repository, select Dockerfile path `backend/Dockerfile`, set port `8000`.
* **Frontend:** Create a static site or web service, set build command `npm ci && npm run build`, output folder `dist`, and set `VITE_API_BASE_URL` to backend service URL.

---

## 5. Split Deployment (Static Frontend + Cloud API)

Deploy frontend static files to **Vercel** or **Netlify** and backend to **Render**, **Railway**, or **Fly.io**:

1. **Deploy Backend to Render / Fly.io / Railway:**
   * Build using `backend/Dockerfile`.
   * Secure HTTPS endpoint generated (e.g. `https://api.opspilot.dev`).
2. **Deploy Frontend to Vercel / Netlify:**
   * Root Directory: `frontend`
   * Build Command: `npm run build`
   * Output Directory: `dist`
   * Environment Variable: `VITE_API_BASE_URL=https://api.opspilot.dev`

---

## 6. Environment Variables Reference

| Variable | Scope | Default Value | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Frontend | `http://127.0.0.1:8000` | Target URL of the OpsPilot FastAPI backend |
| `PORT` | Backend | `8000` | Port on which the Uvicorn ASGI server binds |
| `DATABASE_URL` | Backend | `sqlite:///./opspilot.db` | SQLAlchemy connection string (supports SQLite, Postgres) |

---

## 7. Verification After Deployment

Verify that both tiers are communicating correctly:
```bash
# 1. Health check returns status: ok and database: connected
curl -s http://localhost:8000/api/health

# 2. Pipeline list endpoint returns JSON array of pipelines
curl -s http://localhost:8000/api/pipelines

# 3. Check frontend responds with HTTP 200
curl -I http://localhost:5173
```
