/**
 * Test Supabase Connection
 * Quick script to verify Supabase is connected and accessible
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Testing Supabase Connection...\n');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');
  console.error('\n💡 Make sure .env.local has these values set');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log('   URL:', SUPABASE_URL.substring(0, 40) + '...');
console.log('   Service Key:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...\n');

try {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔌 Testing database connection...');

  // Try a simple query to test connection
  const { data, error, count } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Connection failed!');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    console.error('\n💡 Possible issues:');
    console.error('   - Wrong SUPABASE_URL');
    console.error('   - Wrong SUPABASE_SERVICE_KEY');
    console.error('   - Database tables not created');
    console.error('   - Network/firewall issue');
    process.exit(1);
  }

  console.log('✅ Supabase connected successfully!');
  console.log('   Database is accessible');
  console.log('   Table "analyses" exists');
  if (count !== null) {
    console.log(`   Total analyses: ${count}`);
  }
  console.log('\n🎉 Connection test passed!');

} catch (error) {
  console.error('❌ Connection test failed!');
  console.error('   Error:', error.message);
  console.error('\n💡 Check:');
  console.error('   - Environment variables are correct');
  console.error('   - Network connection');
  console.error('   - Supabase project is active');
  process.exit(1);
}
