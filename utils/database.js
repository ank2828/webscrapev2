import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Check if Supabase should be used (defaults to false for safety)
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

// Initialize Supabase client only if enabled
let supabase = null;
if (USE_SUPABASE) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ USE_SUPABASE is true but Supabase credentials are missing. Falling back to local storage.');
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client initialized.');
  }
} else {
  console.log('📁 Using local JSON file storage (Supabase disabled).');
}

// Local storage paths - Vercel compatible
const DATA_DIR = process.env.VERCEL ? '/tmp/data' : 'data';
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

// Ensure data directory exists (Vercel /tmp is writable)
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Utility functions for local JSON storage
async function readJSONFile(filePath) {
  try {
    await ensureDataDir(); // Ensure directory exists
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeJSONFile(filePath, data) {
  await ensureDataDir(); // Ensure directory exists
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export { supabase };

// Helper function to save report to database
export async function saveReport(reportData) {
  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .insert([reportData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving report to Supabase:', error);
      throw error;
    }
    
    console.log('✅ Report saved to Supabase database:', data.id);
    return data;
  } else {
    // Local JSON storage
    const reports = await readJSONFile(REPORTS_FILE);
    const newReport = {
      id: uuidv4(),
      ...reportData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    reports.push(newReport);
    await writeJSONFile(REPORTS_FILE, reports);
    
    console.log('✅ Report saved to local storage:', newReport.id);
    return newReport;
  }
}

// Helper function to check if report exists
export async function checkExistingReport(url, maxAgeHours = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('url', url)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('❌ Error checking existing report in Supabase:', error);
      throw error;
    }
    
    if (data) {
      console.log('🔍 Found existing report in Supabase for URL:', url);
    }
    
    return data;
  } else {
    // Local JSON storage
    const reports = await readJSONFile(REPORTS_FILE);
    const matchingReport = reports
      .filter(report => report.url === url)
      .filter(report => new Date(report.created_at) >= cutoffDate)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (matchingReport) {
      console.log('🔍 Found existing report in local storage for URL:', url);
    }
    
    return matchingReport || null;
  }
}

// Helper function to log analytics event
export async function logAnalytics(eventType, reportId, metadata = {}) {
  if (supabase) {
    const { error } = await supabase
      .from('analytics')
      .insert([{
        event_type: eventType,
        report_id: reportId,
        metadata
      }]);
    
    if (error) {
      console.error('❌ Error logging analytics to Supabase:', error);
      throw error;
    }
    
    console.log(`📊 Analytics logged to Supabase: ${eventType}`);
  } else {
    // Local JSON storage
    const analytics = await readJSONFile(ANALYTICS_FILE);
    const newAnalytic = {
      id: uuidv4(),
      event_type: eventType,
      report_id: reportId,
      metadata,
      created_at: new Date().toISOString()
    };
    analytics.push(newAnalytic);
    await writeJSONFile(ANALYTICS_FILE, analytics);
    
    console.log(`📊 Analytics logged to local storage: ${eventType}`);
  }
}

// Helper function to log report request
export async function logReportRequest(requestData) {
  if (supabase) {
    const { data, error } = await supabase
      .from('report_requests')
      .insert([requestData])
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging report request to Supabase:', error);
      throw error;
    }

    console.log('📝 Request logged to Supabase:', data.id);
    return data;
  } else {
    // Local JSON storage
    const requests = await readJSONFile(REQUESTS_FILE);
    const newRequest = {
      id: uuidv4(),
      ...requestData,
      created_at: new Date().toISOString()
    };
    requests.push(newRequest);
    await writeJSONFile(REQUESTS_FILE, requests);
    
    console.log('📝 Request logged to local storage:', newRequest.id);
    return newRequest;
  }
}

// Helper function to update report request status
export async function updateReportRequestStatus(requestId, status, reportId = null, errorMessage = null) {
  if (supabase) {
    const updateData = { status };
    if (reportId) updateData.report_id = reportId;
    if (errorMessage) updateData.error_message = errorMessage;

    const { error } = await supabase
      .from('report_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('❌ Error updating request status in Supabase:', error);
      throw error;
    }
    
    console.log(`🔄 Request status updated in Supabase: ${status}`);
  } else {
    // Local JSON storage
    const requests = await readJSONFile(REQUESTS_FILE);
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex !== -1) {
      requests[requestIndex].status = status;
      if (reportId) requests[requestIndex].report_id = reportId;
      if (errorMessage) requests[requestIndex].error_message = errorMessage;
      requests[requestIndex].updated_at = new Date().toISOString();
      
      await writeJSONFile(REQUESTS_FILE, requests);
      console.log(`🔄 Request status updated in local storage: ${status}`);
    } else {
      console.warn(`⚠️ Request with ID ${requestId} not found in local storage`);
    }
  }
}

// Helper function to get domain from URL
export function extractDomain(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    // Fallback for invalid URLs
    return url;
  }
}

// Helper function to get past reports
export async function getPastReports(limit = 50) {
  if (supabase) {
    console.log('🔍 Fetching reports from Supabase database...');

    const { data, error } = await supabase
      .from('reports')
      .select('id, url, domain, created_at, processing_time_ms, tokens_used')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching past reports from Supabase:', error);
      throw error;
    }

    console.log(`✅ Successfully retrieved ${data?.length || 0} reports from Supabase`);
    return data || [];
  } else {
    // Local JSON storage
    console.log('🔍 Fetching reports from local storage...');
    const reports = await readJSONFile(REPORTS_FILE);
    
    const sortedReports = reports
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(report => ({
        id: report.id,
        url: report.url,
        domain: report.domain,
        created_at: report.created_at,
        processing_time_ms: report.processing_time_ms,
        tokens_used: report.tokens_used
      }));

    console.log(`✅ Successfully retrieved ${sortedReports.length} reports from local storage`);
    return sortedReports;
  }
}

// Helper function to get a single report by ID
export async function getReportById(reportId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      console.error('❌ Error fetching report by ID from Supabase:', error);
      throw error;
    }

    console.log('📄 Retrieved report from Supabase:', reportId);
    return data;
  } else {
    // Local JSON storage
    const reports = await readJSONFile(REPORTS_FILE);
    const report = reports.find(r => r.id === reportId);
    
    if (!report) {
      throw new Error(`Report with ID ${reportId} not found`);
    }

    console.log('📄 Retrieved report from local storage:', reportId);
    return report;
  }
}

// Helper function to delete a report by ID
export async function deleteReport(reportId) {
  if (supabase) {
    // First delete any related analytics records
    const { error: analyticsError } = await supabase
      .from('analytics')
      .delete()
      .eq('report_id', reportId);

    if (analyticsError) {
      console.error('❌ Error deleting analytics for report:', analyticsError);
      // Continue execution to attempt deleting other records
    }

    // Then delete any related request records
    const { error: requestsError } = await supabase
      .from('report_requests')
      .delete()
      .eq('report_id', reportId);
      
    if (requestsError) {
      console.error('❌ Error deleting requests for report:', requestsError);
    }

    // Finally delete the report itself
    const { error: reportError } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (reportError) {
      console.error('❌ Error deleting report from Supabase:', reportError);
      throw reportError;
    }
    
    console.log('🗑️ Report deleted from Supabase successfully:', reportId);
    return true;
  } else {
    // Local JSON storage
    let success = true;
    
    // Delete from analytics
    try {
      const analytics = await readJSONFile(ANALYTICS_FILE);
      const filteredAnalytics = analytics.filter(a => a.report_id !== reportId);
      await writeJSONFile(ANALYTICS_FILE, filteredAnalytics);
    } catch (error) {
      console.error('❌ Error deleting analytics for report:', error);
    }

    // Delete from requests
    try {
      const requests = await readJSONFile(REQUESTS_FILE);
      const filteredRequests = requests.filter(r => r.report_id !== reportId);
      await writeJSONFile(REQUESTS_FILE, filteredRequests);
    } catch (error) {
      console.error('❌ Error deleting requests for report:', error);
    }

    // Delete the report itself
    try {
      const reports = await readJSONFile(REPORTS_FILE);
      const reportIndex = reports.findIndex(r => r.id === reportId);
      
      if (reportIndex === -1) {
        throw new Error(`Report with ID ${reportId} not found`);
      }
      
      reports.splice(reportIndex, 1);
      await writeJSONFile(REPORTS_FILE, reports);
      
      console.log('🗑️ Report deleted from local storage successfully:', reportId);
    } catch (error) {
      console.error('❌ Error deleting report from local storage:', error);
      throw error;
    }
    
    return success;
  }
} 