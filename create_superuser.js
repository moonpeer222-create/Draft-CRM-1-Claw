import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsglpnxboaxkrgtmlsps.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZ2xwbnhib2F4a3JndG1sc3BzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODQ1MCwiZXhwIjoyMDkxNTI0NDUwfQ.q2GQy2OhtS2-92YTiEaV5o8PCSJ89Xcozh0YRGsrqjg';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function createSuperUser() {
  console.log('Creating super user...');
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'super@emerald.com',
    password: 'password123',
    email_confirm: true
  });

  if (authErr) {
    if (authErr.message.includes('already been registered')) {
        console.log('User already exists, updating their profile instead.');
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        let user = existingUser.users.find(u => u.email === 'super@emerald.com');
        if (user) {
            await updateProfile(user.id);
        }
    } else {
        console.error('Error creating user:', authErr);
    }
  } else if (authData.user) {
    console.log('User created:', authData.user.id);
    await updateProfile(authData.user.id);
  }
}

async function updateProfile(userId) {
  console.log('Updating profile for user:', userId);
  
  // Try to insert or update the profile
  const { data, error } = await supabase.from('profiles').upsert({
    id: userId,
    email: 'super@emerald.com',
    full_name: 'System Super User',
    role: 'master_admin',
    organization_id: 'be8be659-28a8-45c9-a5ce-146fb6037d5b',
    
    
    
  }).select();

  if (error) {
    console.error('Error updating profile:', error);
  } else {
    console.log('Profile configured successfully as master_admin!');
  }
}

createSuperUser();
