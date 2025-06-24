# Setup Guide for Cosentus Sales Intelligence

## Environment Configuration

To use the AI Chat Agent feature and other functionality, you need to create a `.env` file in the root directory with your API keys.

### Steps:

1. **Create a `.env` file** in the root directory (same folder as `server.js`)

2. **Add the following content** to your `.env` file:

```
# OpenAI API Configuration
OPENAI_API_KEY=your_actual_openai_api_key

# Supabase Configuration  
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration (optional)
PORT=3000
```

3. **Replace the placeholder values:**
   - `your_actual_openai_api_key` - Get from https://platform.openai.com/api-keys
   - `your_supabase_project_url` - From your Supabase project settings
   - `your_supabase_anon_key` - From your Supabase project settings

### Important Notes:

- The `.env` file is already in `.gitignore` so it won't be committed to your repository
- Never share your API keys publicly
- Restart the server after creating/updating the `.env` file

### Testing the Chat Feature:

1. Make sure your `.env` file has the correct `OPENAI_API_KEY`
2. Restart the server: `npm start`
3. Go to Past Reports page
4. Open any report
5. Type a question in the "Ask AI Agent" chat bar below the PDF

The AI agent will search through both the report summary and all the raw crawled data to answer your questions! 