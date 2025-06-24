-- Cosentus Sales Intelligence Database Schema
-- Run this in your Supabase SQL Editor

-- Create reports table to store generated reports
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  crawled_content JSONB,
  summary_content TEXT,
  pdf_url TEXT,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster URL lookups
CREATE INDEX idx_reports_url ON reports(url);
CREATE INDEX idx_reports_domain ON reports(domain);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- Create report_requests table to track all requests
CREATE TABLE report_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  report_id UUID REFERENCES reports(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for report_requests
CREATE INDEX idx_report_requests_url ON report_requests(url);
CREATE INDEX idx_report_requests_status ON report_requests(status);
CREATE INDEX idx_report_requests_created_at ON report_requests(created_at DESC);

-- Create analytics table for tracking usage
CREATE TABLE analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES reports(id),
  event_type TEXT NOT NULL, -- view, download, generate, cache_hit
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for analytics
CREATE INDEX idx_analytics_report_id ON analytics(report_id);
CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_created_at ON analytics(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (we'll update these when we add auth)
CREATE POLICY "Public reports are viewable by everyone" 
  ON reports FOR SELECT 
  USING (true);

CREATE POLICY "Public reports can be inserted by everyone" 
  ON reports FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public report_requests are viewable by everyone" 
  ON report_requests FOR SELECT 
  USING (true);

CREATE POLICY "Public report_requests can be inserted by everyone" 
  ON report_requests FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public report_requests can be updated by everyone" 
  ON report_requests FOR UPDATE 
  USING (true);

CREATE POLICY "Public analytics are viewable by everyone" 
  ON analytics FOR SELECT 
  USING (true);

CREATE POLICY "Public analytics can be inserted by everyone" 
  ON analytics FOR INSERT 
  WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_reports_updated_at 
  BEFORE UPDATE ON reports 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial test data (optional)
-- INSERT INTO reports (url, domain, summary_content, processing_time_ms, tokens_used) 
-- VALUES ('https://example.com', 'example.com', 'Test report content', 5000, 100); 