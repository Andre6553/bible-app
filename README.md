# Bible Study Application

A comprehensive Bible study web application built with React and Supabase, featuring multiple Bible versions, intuitive reading experience, and powerful search capabilities.

## Features

- 📖 **Multiple Bible Versions**: AFR83, NLT, AFR53 (Upgraded), KJV, and AMP
- 🔍 **AI Concept Search**: Find verses by meaning, theme, or feeling, not just keywords
- 🤖 **AI Chapter Summaries**: Get scholarly summaries and outlines for any chapter
- ⚖️ **Parallel Reading**: side-by-side split view for comparing translations
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

## 📱 User Manual & Features

### 📖 Bible Reader
- **Version Selection**: Tap the version badge in the top right to switch between **AFR83, NLT, AFR53, KJV, AMP**.
- **Parallel Reading (Split-View) ⚖️**: Tap the 📖 icon to compare two versions side-by-side. 
    - **PC**: Displays two synchronized columns.
    - **Mobile**: Uses an integrated interleaved view for easy comparison.
- **AI Chapter Summaries 📝**: Click the document icon next to the chapter title for a scholarly summary and outline of the text (in English or Afrikaans).
- **Navigation**: Tap the **Book Name** (e.g., "John 3") for the quick selector, or use the arrow keys to flip chapters.

### 🔍 Search & AI
- **Concept Search (AI) 🤖**: Ask questions like "how to deal with anxiety" or "God's promises". The AI understands meaning, not just keywords.
- **Exact Match 🔍**: Standard search for specific phrases like "love your neighbor".
- **AI Research Lab**: Use shortcuts directly in the search bar:
    - `/story [topic]` - Get the full biblical narrative.
    - `/mean [word]` - Biblical definition.
    - `/explain [topic]` - Theological explanation.
    - `/who [person]` - Biography.
- **History Management 🕒**: Access your last 30 searches. Toggle "Manage" mode to delete specific history items.

### ✍️ Daily Inspiration (Blog)
- **Daily Devotional**: A fresh, AI-generated devotional greets you every day based on diverse themes.
- **Recommended Reading**: Personalized articles based on your interests.
- **Language Toggle**: 
    - Go to **Profile** page.
    - Switch between **English** and **Afrikaans**.
    - This localizes all blog content, headers, and even scripture references (using correct AFR53/83 texts).
    - **Note**: The **AFR53** text has been fully upgraded to a high-quality, clean digital version.
- **"New" (Nuut) Button**:
    - Don't like today's content? Tap **"New"** (or **"Nuut"**) to generate fresh content immediately.
    - **Note**: Regular users can refresh once per hour (or day, depending on settings). **Super Users** have unlimited refreshes.

### 👤 Profile & Settings
- **Personalize**: Set your display name.
- **Stats**: View your reading streaks and highlights.

### 🛠️ Admin & Shortcuts
There is a hidden **Diagnostics & Shortcuts Menu** for power users and admins (to view error logs, system health, and test crashes).

- **How to Access**: 
    1. Go to the app.
    2. Tap the **Profile (User Icon)** in the bottom navigation bar **5 times quickly**.
    3. You will be taken to the hidden `/stats` page.
- **Features**:
    - View System Health.
    - View/Clear Error Logs.
    - Test System Stability.

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

## 🔑 Project Credentials & Backend

For administrative purposes, here are the key connections and credentials used by this app:

- **GitHub Repository**: [Andre6553/bible-app](https://github.com/Andre6553/bible-app)
- **Google Gemini API**: Used for AI devotionals and research.
    - **Endpoint**: `https://generativelanguage.googleapis.com`
    - **Key**: Managed via `VITE_GEMINI_API_KEY` in `.env`
- **Supabase Backend**: Core database and authentication.
    - **URL**: `https://fikjnvkzhemamtlwsrin.supabase.co`
    - **Keys**: Managed in `src/config/supabaseClient.js`
- **Vercel Deployment**: [bible-app-phi-one.vercel.app](https://bible-app-phi-one.vercel.app)

> [!NOTE]
> You can also view these live in the **Admin Stats** page (under "Project Credentials & Backend") after unlocking with the admin PIN.

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue in the project repository.
