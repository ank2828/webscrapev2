// Test Supabase Connection
import { supabase } from './utils/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function testSupabaseConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  // Check if credentials are loaded
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.log('Please add these to your .env file:');
    console.log('SUPABASE_URL=https://your-project.supabase.co');
    console.log('SUPABASE_ANON_KEY=your-anon-key');
    return;
  }

  if (!supabase) {
    console.error('❌ Supabase client not initialized');
    return;
  }

  try {
    // Test basic connection
    console.log('📡 Testing basic connection...');
    const { data, error } = await supabase.from('reports').select('count', { count: 'exact' }).limit(1);
    
    if (error) {
      console.error('❌ Connection error:', error.message);
      if (error.message.includes('JWT')) {
        console.log('💡 Check your SUPABASE_ANON_KEY - it might be incorrect');
      }
      if (error.message.includes('not found')) {
        console.log('💡 Make sure you ran the SQL schema in Supabase SQL Editor');
      }
      return;
    }

    console.log('✅ Successfully connected to Supabase!');
    console.log(`📊 Current reports in database: ${data?.[0]?.count || 0}`);
    
    // Test insert capability
    console.log('🧪 Testing database write...');
    const testReport = {
      url: 'https://test-connection.example.com',
      domain: 'test-connection.example.com',
      summary_content: 'Test connection report',
      processing_time_ms: 1000,
      tokens_used: 50
    };

    const { data: insertData, error: insertError } = await supabase
      .from('reports')
      .insert([testReport])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
      return;
    }

    console.log('✅ Successfully wrote test data!');
    console.log(`📝 Test report ID: ${insertData.id}`);

    // Clean up test data
    await supabase.from('reports').delete().eq('id', insertData.id);
    console.log('🧹 Test data cleaned up');

    console.log('\n🎉 Supabase integration is working perfectly!');
    console.log('You can now start your server and generate reports with caching.');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSupabaseConnection(); 