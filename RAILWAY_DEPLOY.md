# Railway deployment

This project deploys as two Railway services from the same GitHub repository:

- **API** uses `Dockerfile.api`.
- **Dashboard** uses `Dockerfile.web`.

## Create the services

1. Create a Railway project.
2. Add two services from this GitHub repository.
3. Set the API service Dockerfile path to `Dockerfile.api`.
4. Set the dashboard service Dockerfile path to `Dockerfile.web`.
5. Generate a public domain for both services.
6. Set the dashboard variable `VITE_API_BASE` to the API public URL plus `/api`, for example `https://your-api.up.railway.app/api`.

## API variables

Add these to the API service Variables tab. Do not commit them:

```text
FIREBASE_PROJECT_ID=mstsor-v1
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
SMTP_USER=...
SMTP_PASS=...
GROK_API_KEY=...
```

Railway supplies `PORT` automatically. The API listens on it.

## Manager login data

Create this in Firestore, in the existing `users` collection:

```text
username: "your-manager-username"
password: "your-manager-password"
role: "route_manager"
active: true
```

The public event portal remains available without manager login. Manager routes require this Firestore login.

## GitHub Actions deployment

Add these repository secrets under **GitHub > Settings > Secrets and variables > Actions**:

```text
RAILWAY_TOKEN
RAILWAY_PROJECT_ID
RAILWAY_API_SERVICE_ID
RAILWAY_WEB_SERVICE_ID
```

Every push to `main` runs the build checks and deploys both Railway services. Pull requests run validation only.

## Local run

```powershell
powershell -ExecutionPolicy Bypass -File .\start-project.ps1
```

Keep `.env`, `adminpass.txt`, Firebase JSON credentials, and all private keys outside Git.