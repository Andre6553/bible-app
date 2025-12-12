# Bible Study Application

A comprehensive Bible study web application built with React and Supabase, featuring multiple Bible versions, intuitive reading experience, and powerful search capabilities.

## Features

- 📖 **Multiple Bible Versions**: AFR83, NLT, AFR53, KJV, and AMP
- 🔍 **Advanced Search**: Search verses across all versions with keyword highlighting
- 📱 **Responsive Design**: Works seamlessly on mobile and desktop devices
- ⚡ **Progressive Web App**: Install on your device for native-like experience
- 🎨 **Modern UI**: YouVersion-inspired interface with smooth animations
- 🌙 **Dark Theme**: Easy on the eyes for extended reading sessions
- 📚 **Easy Navigation**: Quick book and chapter selection
- 💾 **Offline Support**: Service worker caching for improved performance

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- Supabase account with Bible database configured

## Database Schema

Your Supabase database should have the following tables:

### `versions` table
```sql
- id: integer (primary key)
- abbreviation: text (e.g., "KJV", "NLT")
- name: text (e.g., "King James Version")
```

### `books` table
```sql
- id: integer (primary key)
- name: text (e.g., "Genesis", "Matthew")
- testament: text ("OT" or "NT")
- book_order: integer (1-66)
```

### `verses` table
```sql
- id: integer (primary key)
- book_id: integer (foreign key to books)
- chapter: integer
- verse: integer
- text: text
- version_id: integer (foreign key to versions)
```

## Installation

1. **Clone or download this project**

2. **Install dependencies**
```bash
npm install
```

3. **Configure Supabase**
   - The Supabase URL and API key are already configured in `src/config/supabaseClient.js`
   - Ensure your Supabase database has the required tables and data

4. **Run the development server**
```bash
npm run dev
```

The application will open automatically at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Deployment

### Deploy to Netlify

1. Push your code to a Git repository
2. Connect your repository to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts

### Deploy to GitHub Pages

1. Install gh-pages: `npm install --save-dev gh-pages`
2. Add to package.json scripts:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
3. Run: `npm run deploy`

## Project Structure

```
bible-study-app/
├── public/
│   └── manifest.json          # PWA manifest
├── src/
│   ├── components/
│   │   ├── BibleReader.jsx    # Main Bible reading component
│   │   ├── BibleReader.css
│   │   ├── Search.jsx         # Search component
│   │   ├── Search.css
│   │   ├── BottomNav.jsx      # Navigation component
│   │   └── BottomNav.css
│   ├── config/
│   │   └── supabaseClient.js  # Supabase configuration
│   ├── services/
│   │   └── bibleService.js    # Bible data API methods
│   ├── App.jsx                # Main app component
│   ├── App.css                # Global styles
│   ├── main.jsx               # Entry point
│   └── index.css              # CSS reset
├── index.html
├── package.json
└── vite.config.js             # Vite & PWA configuration
```

## Usage

### Reading the Bible

1. Select a Bible version from the dropdown (top-right)
2. Click "Select Book" to choose a book
3. Use the chapter navigation arrows to move between chapters
4. Tap any verse to highlight it

### Searching

1. Navigate to the Search tab
2. Enter keywords or phrases
3. Select a specific version or search across all versions
4. Results show matching verses with highlighted search terms

## Technologies Used

- **React** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Supabase** - Backend and database
- **Vite PWA Plugin** - Progressive Web App functionality
- **Workbox** - Service worker and caching

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Features

- Service worker caching for API responses
- Lazy loading of components
- Optimized bundle size
- Fast initial load with Vite

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue in the project repository.
