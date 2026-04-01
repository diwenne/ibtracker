import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  console.log('\n--- 📋 DATABASE STRUCTURE DUMP ---');

  // We can't use information_schema easily via anon key, 
  // so we'll try to find ONE row and dump its keys for each table.
  const tables = ['subjects', 'assessments', 'user_settings'];

  for (const table of tables) {
    console.log(`\nTABLE: ${table.toUpperCase()}`);
    console.log('---------------------------------');
    
    // Select 1 to see the columns
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error) {
      console.log(`❌ Inaccessible: ${error.message}`);
      continue;
    }

    if (data && data.length > 0) {
      const entry = data[0];
      Object.keys(entry).forEach(col => {
        console.log(`   - ${col.padEnd(20)} | Value: ${entry[col]}`);
      });
    } else {
      console.log('⚠️  Table exists but is empty (Cannot discover columns).');
    }
  }
}

main();
