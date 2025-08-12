# ConnectFlow: Slack Message Scheduler



## A modern React/TypeScript application that integrates with Slack to enable scheduling and management of messages across channels.

## Features

- 🔐 Secure OAuth 2.0 authentication with Slack
- 📋 View and select channels from your Slack workspace
- 📨 Send instant messages to any channel
- ⏰ Schedule messages for future delivery
- 📝 Manage scheduled messages (view, cancel)
- 👤 Support for sending messages as yourself or as a bot
- 🌐 Responsive UI that works on both desktop and mobile

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Material UI** for component library
- **React Router** for navigation
- **SWR** for data fetching and caching
- **Vite** for build tooling and development server

### Backend
- **Node.js** runtime
- **Express.js** framework (API mode)
- **Prisma ORM** for database interactions
- **JWT** for session management
- **Axios** for HTTP requests to Slack API

### Database
- **PostgreSQL** (hosted on Neon)
- Managed with Prisma migrations

### Tools & Infrastructure
- **LocalTunnel** for local development exposure
- **Netlify Functions** for serverless deployment
- **GitHub Actions** for CI/CD
- **ESLint** and **Prettier** for code quality

## Project Structure

```
slack-connect-app/
├── backend/
│   ├── netlify/
│   ├── prisma/
│   ├── public/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── slackController.ts
│   │   ├── jobs/
│   │   │   └── messageScheduler.ts
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts
│   │   ├── repositories/
│   │   │   ├── installationRepository.ts
│   │   │   └── messageRepository.ts
│   │   ├── routes/
│   │   │   └── apiRoutes.ts
│   │   ├── services/
│   │   │   └── tokenService.ts
│   │   └── index.ts
│   ├── .env
│   ├── .dockerignore
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/
│   │   └── vite.svg
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── netlify.toml
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
```

## Live Demo

Frontend: [https://slack-connect-app-coral.vercel.app](https://slack-connect-app-coral.vercel.app)  
Backend: [https://slack-connect-ap.netlify.app/.netlify/functions/api](https://slack-connect-ap.netlify.app/.netlify/functions/api)

## Try It Out: Join Our Test Workspace

To test the application without setting up your own Slack workspace:

1. Join our test workspace using [this invite link](https://join.slack.com/t/testworkspace-vtf2531/shared_invite/zt-3b2jcyfo4-fXweuRhvjecI86FJybzhhg)
2. After joining, you'll have access to several test channels
3. Visit the [live demo](https://slack-connect-app-coral.vercel.app) and authorize with the test workspace
4. Start scheduling messages!

## Setup Instructions

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- A Slack workspace with admin privileges
- PostgreSQL database (local or cloud-hosted like Neon)
- GitHub account (for deployment options)

### Slack App Setup

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch" and provide your app name and workspace
3. Under "OAuth & Permissions", add the following scopes:
   - `channels:read`
   - `channels:history`
   - `chat:write`
   - `users:read`
   - `users.profile:read`
   - `users:read.email`
   - `team:read`
4. Set up the Redirect URL: `https://your-backend-url/auth/slack/callback`
5. Save changes and install the app to your workspace
6. Note your Client ID and Client Secret for the next steps
7. **Important:** For token refresh functionality to work, set up your app for distribution (add Privacy Policy and Terms of Service URLs)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Avignyan/slack-connect-app.git
cd slack-connect-app
cd backend

# Install dependencies
npm install

# Set up your .env file (example below)
cat > .env << EOF
SLACK_CLIENT_ID="1234567890.abcdef123456"
SLACK_CLIENT_SECRET="example_client_secret_ABC123"
SLACK_STATE_SECRET="example_state_secret_xyz789"
BACKEND_PUBLIC_URL="https://example-backend.loca.lt"
FRONTEND_URL="http://localhost:5173"
DATABASE_URL="postgresql://user:password@localhost:5432/connectflowdb"
EOF

# Run Prisma migrations
npx prisma migrate dev

# Start the development server
npm run dev

# In a separate terminal, create a tunnel for local development
npx localtunnel --port 8000 --subdomain example-backend.loca.lt
```

### Frontend Setup

```bash
# Navigate to the frontend directory in a separate terminal
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend should now be running at http://localhost:5173, with the backend API available at your localtunnel URL.

### LocalTunnel Explained

When developing OAuth applications locally, you need a public URL for callback URLs. LocalTunnel creates a temporary public URL that forwards to your local development server:

1. `npx localtunnel --port 8000 --subdomain example-backend.loca.lt` creates a public URL like `example-backend.loca.lt`
2. This URL forwards all requests to your local server running on port 8000
3. You can use this URL in your Slack app configuration for the redirect URL

### Prisma Database Setup

This project uses Prisma ORM to manage the database:

1. The schema is defined in `prisma/schema.prisma`
2. `npx prisma migrate dev` creates necessary tables in your database
3. `npx prisma studio` provides a visual interface to browse and edit data (optional)

### Environment Variables

```
# Slack OAuth Configuration
SLACK_CLIENT_ID="your_client_id_from_slack"
SLACK_CLIENT_SECRET="your_client_secret_from_slack"
SLACK_STATE_SECRET="random_secret_for_oauth_state"

# URLs
BACKEND_PUBLIC_URL="your_localtunnel_or_deployed_backend_url"
FRONTEND_URL="your_frontend_url"

# Database
DATABASE_URL="your_postgresql_connection_string"
```

### API Endpoints

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|---------------|
| `/auth/slack/install` | GET | Initiates Slack OAuth flow | None |
| `/auth/slack/callback` | GET | OAuth callback from Slack | None |
| `/channels` | GET | Retrieves user's Slack channels | Required |
| `/send-message` | POST | Sends immediate message | Required |
| `/schedule-message` | POST | Schedules a future message | Required |
| `/scheduled-messages` | GET | Lists scheduled messages | Required |
| `/scheduled-messages/:id` | DELETE | Cancels a scheduled message | Required |
| `/logout` | POST | Logs out the user | Required |

## Architecture Overview

### OAuth Flow

The application uses OAuth 2.0 for secure authorization with Slack:

1. User clicks "Connect to Slack" button
2. User is redirected to Slack for authorization
3. Slack redirects back with a temporary code
4. Backend exchanges code for a permanent token
5. Token is stored in the database with expiration
6. All subsequent API calls use this token


[![OAuth Flow Diagram](diagram.svg)

### Token Management

- Tokens are stored securely in the PostgreSQL database
- Each token has an expiration time tracked in the database
- Backend validates token expiration on each API request
- Invalid tokens trigger automatic refresh using Slack's API
- No sensitive data is stored client-side

### Scheduled Task Handling

The application leverages Slack's native scheduled messages API:

1. User composes a message and selects date/time
2. Request is sent to backend with authorization
3. Backend calls `chat.scheduleMessage` Slack API
4. Message details are stored in the database for tracking
5. Backend provides endpoints to list and cancel scheduled messages

## Challenges & Learnings

### Challenge: Slack API Not Providing a Refresh Token
**Problem:** After a successful installation, the installation object from Slack was missing the required refreshToken and expiresAt fields, making the token refresh logic impossible.

**Solution:** After extensive debugging, it was discovered that for Slack to issue refresh tokens, the app must have "Token Rotation" enabled. As the UI toggle for this feature has been removed from Slack's dashboard, the modern equivalent was to fully configure the app for distribution (e.g., by activating public distribution and providing support/privacy URLs) and perform a complete, clean re-installation.

### Challenge: Frontend Path Resolution Errors
**Problem:** The frontend was making API calls to incorrect URLs, resulting in 404 errors. The issue was that we were appending `/api` to requests when the backend URL already included `/api` in its path.

**Solution:** Standardized URL handling by creating a central API client that properly constructs URLs. This involved removing duplicate path segments and ensuring consistent path resolution between development and production environments.

### Challenge: Database Connection in Serverless Environment
**Problem:** When deploying to serverless platforms, we encountered database connection pooling issues where each function invocation was creating a new connection, quickly exhausting the database connection limit.

**Solution:** Implemented a connection pooling strategy using PgBouncer and restructured our database access to use a singleton pattern that maintains a connection pool across function invocations, dramatically reducing connection overhead and preventing timeout errors.

### Challenge: Environment-Specific OAuth Redirect URLs
**Problem:** Managing OAuth redirect URLs across local development, staging, and production environments was creating configuration headaches and deployment issues.

**Solution:** Created a dynamic configuration system that detects the current environment and sets the appropriate redirect URL. For local development, we implemented automatic localtunnel URL registration, while production environments use environment variables for configuration.

## Future Improvements

- Add message templates for quicker scheduling
- Support for rich text formatting and attachments
- Recurring message scheduling
- Analytics for message engagement
- Multi-workspace support

## Contact

Avignyan - [GitHub](https://github.com/Avignyan)

Project Link: [https://github.com/Avignyan/slack-connect-app](https://github.com/Avignyan/slack-connect-app)

---
Last updated: 2025-08-12 00:21:12 (UTC)  
by Avignyan
