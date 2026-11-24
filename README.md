# sitely — Construction Log

A modern, offline-first web application for logging daily construction work activities.

Ships to the App Store and Play Store as **sitely**; see `RELEASE.md` for the
build and submission runbook.

## Features

- **Offline-First Architecture** - Works without internet connection
- **Auto-Sync** - Automatically syncs data when connection is restored
- **Work Log Management** - Track personnel, equipment, materials, and work details
- **PDF Export** - Generate PDF reports from work logs
- **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Styling**: Tailwind CSS + shadcn/ui components
- **Offline Storage**: IndexedDB
- **Forms**: React Hook Form + Zod validation
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- MongoDB instance (local or cloud)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your MongoDB connection string

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Variables

```env
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
```

## Project Structure

```
Construction_worker_log/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── forms/             # Form pages
│   └── worklogs/          # Work log pages
├── components/            # React components
│   ├── forms/            # Form-specific components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and helpers
│   ├── models/          # Mongoose models
│   └── constants.ts     # App-wide constants
├── types/               # TypeScript type definitions
└── __tests__/          # Test files
```

## Key Features Explained

### Offline Mode

The app uses IndexedDB to queue work logs when offline:

1. User submits a work log while offline
2. Data is saved to IndexedDB with a temporary ID
3. When connection is restored, SyncManager automatically syncs pending logs
4. Successfully synced logs are removed from the queue

See `lib/syncService.ts` and `lib/indexedDBHelper.ts` for implementation.

### Data Schema

All work logs follow a unified schema (see `types/models.d.ts`):

```typescript
interface IWorkLog {
  date: Date;
  project: ObjectId;
  author: ObjectId;
  weather?: string;
  temperature?: number;
  workDescription: string;
  personnel: Array<{ role: string; count: number }>;
  equipment: Array<{ type: string; count: number; hours?: number }>;
  materials: Array<{ name: string; quantity: number; unit: string }>;
  notes?: string;
}
```

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Architecture

### Offline-First Design

```
User Submission
     ↓
[Online?] → Yes → POST /api/worklogs → MongoDB
     ↓
    No
     ↓
IndexedDB (pending queue)
     ↓
[Connection Restored]
     ↓
SyncManager → POST /api/worklogs → MongoDB
     ↓
Remove from IndexedDB
```

### Component Hierarchy

```
App Layout
├── SyncManager (background sync)
├── Page
│   └── WorkLogForm
│       ├── FormField (reusable)
│       ├── Alert (reusable)
│       └── ArrayFieldManager (reusable)
```

## Recent Improvements

See [REFACTORING.md](./REFACTORING.md) for detailed documentation on recent code improvements:

- ✅ Unified data schema (removed transformation logic)
- ✅ Extracted reusable components and hooks
- ✅ Centralized constants and configuration
- ✅ Improved code organization and readability

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Use meaningful commit messages

## License

Private project - not for public distribution

## Support

For questions or issues, please contact the development team.
