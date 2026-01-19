# LUMEN Backend

A REST API that powers the LUMEN activity management platform, enabling seamless event registration and reducing manual effort for staff in managing participant data.

## Problem Statement

> How might we reduce friction in activity sign-ups for both individuals and caregivers, while reducing manual effort for staff in managing and consolidating registration data?

## Features

- **Event Management** - Create, update, and delete activities
- **User Registration** - Handle participant and volunteer sign-ups
- **Conflict Detection** - Prevent double-booking of time slots
- **Capacity Management** - Track and enforce event limits
- **API Documentation** - Swagger UI for easy testing

## Tech Stack

- Node.js + Express
- MySQL
- JWT Authentication
- Swagger

## Prerequisites

- Node.js (v18 or higher)
- npm
- MySQL database (local or cloud)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LUMEN-BE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file:
   ```env
   DB_HOST=localhost
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=master_database
   DB_PORT=3306
   JWT_SECRET=your_jwt_secret
   PORT=3001
   ```

4. **Set up the database**
   ```bash
   mysql -u your_username -p < schema.sql
   ```

5. **Connect to Google Cloud SQL**
   
   Authenticate with Google Cloud:
   ```bash
   gcloud auth application-default login
   ```
   
   Start the Cloud SQL Proxy:
   ```bash
   ./cloud-sql-proxy h4good-good-people:asia-southeast1:h4good --port 3307
   ```
   
   Keep this running in a separate terminal.

6. **Start the server**
   ```bash
   npm start
   ```

7. **View API Documentation**
   ```
   http://localhost:3001/api-docs
   ```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run production server |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List all events |
| POST | `/api/events` | Create new event |
| POST | `/api/participant-events` | Register participant |
| POST | `/api/volunteer-events` | Register volunteer |
| GET | `/api/users` | List all users |

See `/api-docs` for full documentation.

## Project Structure

```
LUMEN-BE/
├── server.js         # Entry point
├── db.js             # Database connection
├── schema.sql        # Database schema
├── swagger.js        # API documentation config
└── routes/
    └── api.js        # All API routes
```
