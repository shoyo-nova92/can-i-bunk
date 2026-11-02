# Can I Bunk?

A semester attendance planner built using HTML, CSS, JavaScript, Node.js, Express.js, MongoDB and Mongoose.

The application helps students track attendance, plan future classes, and calculate how many classes they can miss while maintaining their required attendance percentage.

## Features

- Add and manage subjects
- Track attended and missed classes
- View classes in a calendar
- Calculate attendance percentages and future bunk allowances
- Import timetable data from PDFs, spreadsheets and images
- Register and log in
- Save and retrieve attendance records from MongoDB Atlas
- Create, read, update and delete subjects and sessions using REST APIs

## Technologies Used

**Frontend:** HTML5, CSS3, JavaScript

**Backend:** Node.js, Express.js

**Database:** MongoDB Atlas, Mongoose

**Authentication:** JWT, bcrypt

**API Testing:** Postman

## Project Setup

Requirements: Node.js 22 or newer, npm, and a MongoDB Atlas connection.

Clone the repository:

```bash
git clone https://github.com/shoyo-nova92/can-i-bunk.git
cd can-i-bunk
```

Install dependencies:

```bash
npm ci
npm --prefix server ci
```

Create a `server/.env` file using `server/.env.example` and configure the MongoDB URI and JWT secret.

Start the application:

```bash
npm run start:atlas
```

Open the application at:

http://127.0.0.1:3000

Check the database connection at:

http://127.0.0.1:3000/api/health

The frontend is served by the Express server, so a separate frontend server is not required.

## Backend Structure

- `server/src/index.js` — Starts the server
- `server/src/app.js` — Configures Express
- `server/src/database.js` — Connects MongoDB
- `server/src/models.js` — Defines Mongoose schemas
- `server/src/routes.js` — Defines API endpoints
- `server/src/controllers/auth.js` — Handles registration and login
- `server/src/controllers/planner.js` — Handles planner CRUD operations
- `server/src/middleware/auth.js` — Verifies authentication

## API Endpoints

| Method | Endpoint             | Description     |
| ------ | -------------------- | --------------- |
| POST   | `/api/auth/register` | Register user   |
| POST   | `/api/auth/login`    | Login user      |
| GET    | `/api/state`         | Get planner     |
| PUT    | `/api/state`         | Save planner    |
| GET    | `/api/subjects`      | Get subjects    |
| GET    | `/api/subjects/:id`  | Get one subject |
| POST   | `/api/subjects`      | Create subject  |
| PATCH  | `/api/subjects/:id`  | Update subject  |
| DELETE | `/api/subjects/:id`  | Delete subject  |
| GET    | `/api/sessions`      | Get sessions    |
| POST   | `/api/sessions`      | Create session  |
| PATCH  | `/api/sessions/:id`  | Update session  |
| DELETE | `/api/sessions/:id`  | Delete session  |

Planner endpoints require authentication. Update and delete operations also use revision numbers to prevent conflicting changes.

## Testing

Run frontend tests:

```bash
npm test
```

Run backend tests:

```bash
npm run test:api
```

Run the Postman collection using Newman while the server is running:

```bash
npm run test:postman
```

For Postman Desktop, import the files from the `postman` folder:

- `Can-I-Bunk.postman_collection.json`
- `Local.postman_environment.json`

The collection tests authentication, CRUD operations, validation and user access.

## MongoDB Storage

The database contains `users` and `planners` collections.

Each planner belongs to a user and stores subject and session records inside its `state` object.

The browser also supports a separate local planner using `localStorage`. Account planner data is saved to MongoDB when the user selects **Save to account**.

## Assignment

This project implements the backend concepts covered in the Node.js, Express.js and MongoDB tutorial, including database models, controllers, routes, CRUD APIs and Postman testing.

The repository is public. Instructor approval may be required because the backend was added to an existing project rather than created in a separate assignment repository.
