# Personal Task Manager

A modern, feature-rich task management application built with React and Vite.

## Features

- 📋 Task and Event management
- 📁 Project organization
- 🔁 Recurring tasks (daily, weekly, monthly)
- 📅 Multiple views: List, Schedule, Board, Calendar
- 🎨 Dark/Light theme support
- 💾 Local storage persistence
- 🔍 Search functionality
- ⚡ Fast and responsive

## Getting Started

### Requirements

- Node.js 22 or newer (the Supabase client needs native WebSocket support; Node 20 crashes the server on startup)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:4004`

### Supabase Backend Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql` from this repo.
3. Copy `.env.example` to `.env` and fill:
   - `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional — if omitted, the server uses the publishable key and relies on row-level security)
4. Start the app with `npm run dev`.

No Supabase account handy? Click "Continue without an account (local only)" on the login screen to run entirely from browser localStorage.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── views/          # View components (List, Schedule, Board, Calendar)
│   ├── Sidebar.jsx
│   ├── TaskInput.jsx
│   ├── TaskRow.jsx
│   ├── EditModal.jsx
│   └── Settings.jsx
├── styles/             # CSS files
├── utils/              # Utility functions and store
│   ├── store.js        # Data store and persistence
│   ├── filters.js      # Filtering logic
│   └── recurrence.js   # Recurrence handling
├── App.jsx             # Main app component
└── main.jsx            # Entry point
```

## Usage

- **Add Tasks**: Use the input bar at the top to add new tasks or events
- **Projects**: Create projects from the sidebar to organize tasks
- **Views**: Switch between List, Schedule, Board, and Calendar views
- **Filters**: Use sidebar or filter bar to view specific task sets
- **Drag & Drop**: Drag tasks to different dates/times in Board and Schedule views
- **Recurring Tasks**: Set up daily, weekly, or monthly recurring tasks
- **Settings**: Customize schedule hours, theme, and reschedule settings

## Data Storage

- Primary storage: Supabase table `public.app_store` through the Node/Express backend.
- Local cache: Browser `localStorage` is still used for offline/fallback UX.

## License

MIT
