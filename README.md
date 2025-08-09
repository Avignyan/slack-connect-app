# ConnectFlow - Slack Message Scheduler

ConnectFlow is a full-stack web application that allows users to securely connect their Slack workspace, send messages to channels instantly, and schedule messages for future delivery. This project was built as an assignment to demonstrate skills in full-stack development, OAuth 2.0 integration, and secure token management.

*(Optional: Add a screenshot of your final, styled dashboard here)*
`![Dashboard Screenshot](link-to-your-screenshot.png)`

## ✨ Features

* **Secure Slack Authentication:** Connects to any Slack workspace using a robust, database-backed OAuth 2.0 flow.
* **Send Messages:** A clean UI to select a channel and send a message instantly.
* **Schedule Messages:** A date/time picker to schedule messages for future delivery.
* **Automated Sending:** A background scheduler (cron job) runs every minute to reliably send due messages.
* **Manage Scheduled Messages:** View a live-updating list of all pending messages and cancel any message with a single click.
* **Automatic Token Refresh:** Seamlessly and automatically uses refresh tokens to get new access tokens in the background, ensuring continuous, uninterrupted service.

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite, Material-UI (MUI)
* **Backend:** Node.js, Express, TypeScript, tsx
* **Database:** SQLite with Prisma ORM
* **Scheduling:** `node-cron` for background jobs
* **API Integration:** `@slack/oauth`, `@slack/web-api`

---

## 🚀 Local Setup and Installation

To run this project locally, please follow these steps:

**Prerequisites:**
* Node.js (v18 or later recommended)
* npm

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd slack-connect-app
```

### 2. Backend Setup
You will need one terminal for the backend.

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Create a .env file for your credentials
# You can copy the example file
cp .env.example .env 
```

Now, open the newly created `.env` file and add your credentials. You must choose a unique subdomain for localtunnel.

```env
# backend/.env
DATABASE_URL="file:./dev.db"

# Your Slack App Credentials
SLACK_CLIENT_ID="YOUR_SLACK_CLIENT_ID"
SLACK_CLIENT_SECRET="YOUR_SLACK_CLIENT_SECRET"

# Your public-facing URLs
BACKEND_PUBLIC_URL="https://your-unique-subdomain.loca.lt"
FRONTEND_URL="http://localhost:5173"
```

Finally, create the database and start the server:

```bash
# Create and migrate the database
npx prisma migrate dev

# Start the backend server
npm run dev
```

### 3. Frontend Setup
You will need a second, separate terminal.

```bash
# Navigate to the frontend directory from the project root
cd frontend

# Install dependencies
npm install

# Start the frontend server
npm run dev
```

The application will be available at `http://localhost:5173`.

### 4. Run Localtunnel
You will need a third, separate terminal to expose your local backend server.

```bash
# Run this from any directory
# Use the same unique subdomain you configured in your .env file
npx localtunnel --port 8000 --subdomain your-unique-subdomain
```

## 🏗️ Architectural Overview

This project is structured as a monorepo containing separate frontend and backend applications.

The backend follows a layered architecture to ensure a clean Separation of Concerns:

* **Routes:** Define the API endpoints.
* **Controllers:** Handle incoming HTTP requests and format outgoing responses. They coordinate between services and repositories.
* **Services:** Contain core business logic, such as the tokenService which handles the logic for refreshing expired Slack tokens.
* **Repositories:** Abstract all database interactions using the Repository Pattern. No other part of the application communicates directly with Prisma.
* **Jobs:** A node-cron scheduler runs as a background process, checking the database for due messages every minute.

The OAuth flow is secured against CSRF attacks using a custom, database-backed stateStore. This was implemented to solve persistent `invalid_state` errors caused by conflicts between browser cookies and the localtunnel service, ensuring a secure and reliable authentication process.

## 🧗 Challenges & Learnings

### Challenge: Persistent `invalid_state` OAuth Error

**Problem:** During the authentication callback, a recurring `invalid_state` error occurred. The default cookie-based state verification from Slack's library was found to be incompatible with the localtunnel and browser environment.

**Solution:** I implemented a custom, robust stateStore that uses the project's SQLite database. This solution generates a unique state string, saves it to the database, and verifies it from the database on callback, completely bypassing the problematic browser cookie mechanism.

### Challenge: Slack API Not Providing a Refresh Token

**Problem:** After a successful installation, the installation object from Slack was missing the required `refreshToken` and `expiresAt` fields, making the token refresh logic impossible.

**Solution:** After extensive debugging, it was discovered that for Slack to issue refresh tokens, the app must have "Token Rotation" enabled. As the UI toggle for this feature has been removed from Slack's dashboard, the modern equivalent was to fully configure the app for distribution (e.g., by activating public distribution and providing support/privacy URLs) and perform a complete, clean re-installation.

### Learning:

* Gained a deep, practical understanding of the complete OAuth 2.0 flow, from user-facing redirects to backend code exchange and secure state management.
* Learned the critical importance of the token lifecycle, implementing logic to automatically refresh expiring access tokens to ensure uninterrupted service.
* Developed strong debugging skills for a complex full-stack environment involving multiple running processes, a tunneling service, and a third-party API with specific, evolving configuration requirements.
