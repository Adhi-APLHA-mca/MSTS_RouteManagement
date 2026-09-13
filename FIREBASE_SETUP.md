# Firebase and Firestore setup

The API stores routes, buyers, models, and events in Cloud Firestore through the Firebase Admin SDK. The Drizzle/PostgreSQL package is present in the monorepo but is not used by the current API routes.

## 1. Create or open the Firebase project

1. Open the Firebase console and select project `mstsor-v1`.
2. In **Build > Firestore Database**, click **Create database**.
3. Choose a region and start in production mode.
4. In **Project settings > Service accounts**, choose **Generate new private key**.

## 2. Configure local credentials

Copy `.env.example` to `.env` in this repository root. Fill in `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from the downloaded service-account JSON. Keep the JSON file and `.env` out of Git.

The private key can stay on one line with `\\n` escape sequences, for example:

```text
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

## 3. Start the services

From `MSTS_RouteManagement`, open two PowerShell terminals.

```powershell
$env:PORT = "8080"
pnpm --filter @workspace/api-server run dev
```

In the second terminal:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/msts-dashboard run dev
```

The API is available at `http://localhost:8080`, and the dashboard is available at `http://localhost:5173`. Verify Firestore access with `GET http://localhost:8080/api/routes`; an empty array means the connection works and no routes exist yet. The dashboard proxies its `/api` requests to port 8080.

## Required Firebase IAM access

The service account needs permission to read and write Cloud Firestore. The Firebase-generated service account normally has this access. If requests return `PERMISSION_DENIED`, check IAM and Firestore Database rules in the Firebase console.

## Route manager login

The route-manager dashboard uses a Firestore username/password document. Create a document in the existing `users` collection:

```text
users/{any-document-id}
username: "your-manager-username"
password: "your-manager-password"
role: "route_manager"
active: true
```

Keep the manager password restricted to this document and do not expose it in the frontend. `/events` remains public; routes, buyers, models, client details, and schedule management require this manager login. For stronger production security, store a password hash instead of plaintext and update the verifier accordingly.
