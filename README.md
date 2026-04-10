# NikFoods Admin Panel

Admin dashboard for managing the NikFoods application.

## Features

- ✅ JWT-based authentication
- ✅ Admin-only access control
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Material-UI components
- ✅ MongoDB integration
- ✅ Protected routes with middleware

## Tech Stack       

- **Framework**: Next.js 16 (App Router)
- **UI Library**: Material-UI (MUI) v7
- **Icons**: Tabler Icons
- **Database**: MongoDB
- **Authentication**: JWT (without NextAuth)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB database (local or cloud)
- npm or yarn package manager

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**

   Create a `.env.local` file in the root directory:
   ```env
   DATABASE_URL=mongodb://localhost:27017/nikfoods
   PRIVATE_KEY=your-super-secret-jwt-key-here
   ```

3. **Create an admin user in MongoDB:**

   Since there's no signup page, you need to create an admin user directly in the database:
   ```javascript
   // Connect to MongoDB and run this in MongoDB Compass or Shell
   db.users.insertOne({
     email: "admin@nikfoods.com",
     password: "$2a$10$...", // Use bcrypt to hash your password
     role: "ADMIN",
     name: "Admin User",
     isCompleted: true,
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

   To generate a hashed password, you can use this Node.js script:
   ```javascript
   const bcrypt = require('bcryptjs');
   const password = 'your-password-here';
   const hash = bcrypt.hashSync(password, 10);
   console.log(hash);
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
nikfoods-admin/
├── src/
│   ├── app/
│   │   ├── api/auth/login/     # Login API endpoint
│   │   ├── dashboard/          # Admin dashboard page
│   │   ├── login/              # Login page
│   │   ├── providers/          # Theme provider
│   │   └── layout.tsx          # Root layout
│   ├── contexts/
│   │   └── AuthContext.tsx     # Authentication context
│   ├── lib/
│   │   ├── db.ts               # MongoDB handler
│   │   ├── jwt.ts              # JWT token handler
│   │   └── validation.ts       # Form validation utilities
│   ├── theme/
│   │   ├── colors.ts           # Color constants
│   │   └── theme.ts            # MUI theme configuration
│   └── types/
│       ├── auth.ts             # Auth type definitions
│       └── user.ts             # User type definitions
├── middleware.ts               # Route protection middleware
└── package.json
```

## Authentication Flow

1. User enters email and password on `/login` page
2. Credentials are validated and sent to `/api/auth/login`
3. API verifies credentials against MongoDB
4. API checks if user has `ADMIN` role
5. JWT token is generated (valid for 7 days)
6. Token and user info are stored in localStorage
7. User is redirected to `/dashboard`

## Protected Routes

All routes except `/login` and `/api/auth/login` are protected by middleware. Unauthenticated users are automatically redirected to the login page.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MongoDB connection string | `mongodb://localhost:27017/nikfoods` |
| `PRIVATE_KEY` | Secret key for JWT signing | `your-super-secret-key` |

## Development Notes

- This project uses **only light theme** (no dark mode)
- **No Grid component** from MUI is used (as per project requirements)
- Authentication uses **simple JWT tokens** without cookies or NextAuth
- The project follows the same color scheme as the original nikfoods project

## Building for Production

```bash
npm run build
npm start
```

## License

Private - NikFoods
