# Attendance - Frontend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.sample .env
```

3. Copy the `src/` folder contents from the main project into this `src/` directory.

4. Start the development server:
```bash
npm run dev

npm install @radix-ui/react-scroll-area @radix-ui/react-checkbox @radix-ui/react-dropdown-menu
npm install lucide-react


```

The app will be available at `http://localhost:3000`.

## Build for Production
```bash
npm run build
```

The built files will be in the `dist/` directory. Serve them with any static file server.
