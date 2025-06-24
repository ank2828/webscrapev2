import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Database features will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper function to save report to database
export async function saveReport(reportData) {
  if (!supabase) {
    console.warn('Database not configured. Report will not be saved.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([reportData])
      .select()
      .single();

    if (error) throw error;
    console.log('✅ Report saved to database:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error saving report:', error);
    return null;
  }
}

// Helper function to check if report exists
export async function checkExistingReport(url, maxAgeHours = 24) {
  if (!supabase) return null;

  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('url', url)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    
    if (data) {
      console.log('🔍 Found existing report for URL:', url);
    }
    return data;
  } catch (error) {
    console.error('❌ Error checking existing report:', error);
    return null;
  }
}

// Helper function to log analytics event
export async function logAnalytics(eventType, reportId, metadata = {}) {
  if (!supabase) return;

  try {
    await supabase
      .from('analytics')
      .insert([{
        event_type: eventType,
        report_id: reportId,
        metadata
      }]);
    
    console.log(`📊 Analytics logged: ${eventType}`);
  } catch (error) {
    console.error('❌ Error logging analytics:', error);
  }
}

// Helper function to log report request
export async function logReportRequest(requestData) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('report_requests')
      .insert([requestData])
      .select()
      .single();

    if (error) throw error;
    console.log('📝 Request logged:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error logging request:', error);
    return null;
  }
}

// Helper function to update report request status
export async function updateReportRequestStatus(requestId, status, reportId = null, errorMessage = null) {
  if (!supabase) return;

  try {
    const updateData = { status };
    if (reportId) updateData.report_id = reportId;
    if (errorMessage) updateData.error_message = errorMessage;

    await supabase
      .from('report_requests')
      .update(updateData)
      .eq('id', requestId);

    console.log(`🔄 Request status updated: ${status}`);
  } catch (error) {
    console.error('❌ Error updating request status:', error);
  }
}

// Helper function to get domain from URL
export function extractDomain(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Helper function to get past reports from last 7 days
export async function getPastReports(limit = 50) {
  if (!supabase) return [];

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days

    const { data, error } = await supabase
      .from('reports')
      .select('id, url, domain, created_at, processing_time_ms, tokens_used')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    console.log(`📋 Retrieved ${data?.length || 0} past reports`);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching past reports:', error);
    return [];
  }
}

// Helper function to get a single report by ID
export async function getReportById(reportId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) throw error;
    console.log('📄 Retrieved report:', reportId);
    return data;
  } catch (error) {
    console.error('❌ Error fetching report by ID:', error);
    return null;
  }
}

// Helper function to delete a report by ID
export async function deleteReport(reportId) {
  if (!supabase) {
    console.warn('Database not configured. Cannot delete report.');
    return false;
  }

  try {
    // First delete any related analytics records
    await supabase
      .from('analytics')
      .delete()
      .eq('report_id', reportId);

    // Then delete any related request records
    await supabase
      .from('report_requests')
      .delete()
      .eq('report_id', reportId);

    // Finally delete the report itself
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);

    if (error) throw error;
    
    console.log('🗑️ Report deleted successfully:', reportId);
    return true;
  } catch (error) {
    console.error('❌ Error deleting report:', error);
    return false;
  }
} 