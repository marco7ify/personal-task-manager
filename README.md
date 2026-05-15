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

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:4004`

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

All data is stored locally in your browser using localStorage. No data is sent to any server.

## License

MIT
