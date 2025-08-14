# Environment Configuration Guide

## Supabase Toggle Setup

This application now supports easy switching between Supabase and local JSON storage.

### To Disable Supabase (Current Recommended Setting)

Create a `.env` file in your project root with the following content:

```env
# Supabase Configuration (DISABLED)
USE_SUPABASE=false

# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration (OPTIONAL)
PORT=3000
```

### To Re-enable Supabase Later

Simply update your `.env` file:

```env
# Supabase Configuration (ENABLED)
USE_SUPABASE=true
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration (OPTIONAL)
PORT=3000
```

## How It Works

- When `USE_SUPABASE=false` (or not set), the application stores all data in local JSON files in the `data/` directory
- When `USE_SUPABASE=true`, the application uses your Supabase database
- All existing data in the `data/` folder is preserved
- You can switch between modes anytime by changing the environment variable

## Quick Setup Commands

1. **Disable Supabase immediately:**
   ```bash
   echo "USE_SUPABASE=false" > .env
   echo "OPENAI_API_KEY=your_key_here" >> .env
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

## Files Used for Local Storage

- `data/reports.json` - Stores all generated reports
- `data/analytics.json` - Stores analytics events
- `data/requests.json` - Stores request logs

These files are automatically created and managed by the application.
