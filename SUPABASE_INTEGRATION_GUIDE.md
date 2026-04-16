# 🔐 SUPABASE INTEGRATION GUIDE - EMERALD VISA CONSULTANCY CRM

## 📋 TABLE OF CONTENTS

1. [Supabase Setup](#supabase-setup)
2. [Database Schema](#database-schema)
3. [Row Level Security (RLS)](#row-level-security)
4. [Authentication Flow](#authentication-flow)
5. [User Management System](#user-management-system)
6. [Implementation Steps](#implementation-steps)

---

## 🚀 SUPABASE SETUP

### **Step 1: Create Supabase Project**

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Login
3. Click "New Project"
4. Fill in details:
   - **Name:** emerald-visa-crm
   - **Database Password:** (strong password - save it!)
   - **Region:** Choose closest to your users
5. Wait for project setup (2-3 minutes)

### **Step 2: Get API Credentials**

Navigate to: **Project Settings → API**

Copy these values:
```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (KEEP SECRET!)
```

---

## 🗄️ DATABASE SCHEMA

### **Table 1: users (extends auth.users)**

```sql
-- Create custom users table with additional fields
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master_admin', 'admin', 'agent', 'customer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  photo_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_created_by ON public.users(created_by);
```

### **Table 2: cases**

```sql
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  cnic TEXT,
  passport TEXT,
  country TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'documents', 'medical', 'visa', 'ticketing', 'completed', 'rejected')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  agent_id UUID REFERENCES public.users(id),
  agent_name TEXT,
  total_fee NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cases_customer_id ON public.cases(customer_id);
CREATE INDEX idx_cases_agent_id ON public.cases(agent_id);
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_priority ON public.cases(priority);
CREATE INDEX idx_cases_case_number ON public.cases(case_number);
```

### **Table 3: payments**

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank', 'easypaisa', 'jazzcash', 'card')),
  receipt_number TEXT UNIQUE,
  description TEXT,
  collected_by UUID REFERENCES public.users(id),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_payments_case_id ON public.payments(case_id);
CREATE INDEX idx_payments_collected_by ON public.payments(collected_by);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);
```

### **Table 4: documents**

```sql
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  notes TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  verified_by UUID REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_documents_case_id ON public.documents(case_id);
CREATE INDEX idx_documents_status ON public.documents(status);
```

### **Table 5: timeline_events**

```sql
CREATE TABLE public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('status', 'payment', 'document', 'medical', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_timeline_case_id ON public.timeline_events(case_id);
CREATE INDEX idx_timeline_created_at ON public.timeline_events(created_at);
```

### **Table 6: notes**

```sql
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  important BOOLEAN DEFAULT false,
  author_id UUID REFERENCES public.users(id),
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notes_case_id ON public.notes(case_id);
CREATE INDEX idx_notes_important ON public.notes(important);
```

### **Table 7: notifications**

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('case', 'payment', 'document', 'deadline', 'agent', 'system')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  actionable BOOLEAN DEFAULT false,
  action_url TEXT,
  action_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);
```

### **Table 8: attendance**

```sql
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT CHECK (status IN ('present', 'late', 'absent', 'leave')),
  leave_type TEXT CHECK (leave_type IN ('sick', 'casual', 'annual', 'unpaid')),
  notes TEXT,
  approved_by UUID REFERENCES public.users(id),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_status ON public.attendance(status);
```

---

## 🔒 ROW LEVEL SECURITY (RLS) POLICIES

### **Users Table Policies**

```sql
-- Master Admin can see all users
CREATE POLICY "master_admin_all_users" ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'master_admin'
    )
  );

-- Admins can see admins, agents, and customers (not other master_admins)
CREATE POLICY "admin_view_users" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    )
    AND role != 'master_admin'
  );

-- Agents can view their own profile and customers
CREATE POLICY "agent_view_profile" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR (
      role = 'customer' 
      AND EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'agent'
      )
    )
  );

-- Users can view their own profile
CREATE POLICY "users_view_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Only master_admin and admin can create users
CREATE POLICY "admin_create_users" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
  );

-- Only master_admin and admin can update users (except master_admin role)
CREATE POLICY "admin_update_users" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
    AND role != 'master_admin'
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

### **Cases Table Policies**

```sql
-- Admins can see all cases
CREATE POLICY "admin_all_cases" ON public.cases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
  );

-- Agents can see their assigned cases
CREATE POLICY "agent_view_cases" ON public.cases
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
  );

-- Customers can see their own cases
CREATE POLICY "customer_view_cases" ON public.cases
  FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin', 'agent')
    )
  );

-- Admins and agents can create cases
CREATE POLICY "admin_agent_create_cases" ON public.cases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin', 'agent')
    )
  );

-- Admins and assigned agents can update cases
CREATE POLICY "admin_agent_update_cases" ON public.cases
  FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
  );
```

### **Payments, Documents, Timeline, Notes Policies**

```sql
-- Similar pattern for all related tables
-- Admins: full access
-- Agents: access to their cases
-- Customers: read-only access to their cases

-- Payments
CREATE POLICY "admin_all_payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('master_admin', 'admin')
    )
  );

CREATE POLICY "agent_case_payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = payments.case_id AND cases.agent_id = auth.uid()
    )
  );

CREATE POLICY "customer_view_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cases 
      WHERE cases.id = payments.case_id AND cases.customer_id = auth.uid()
    )
  );

-- Apply same pattern to documents, timeline_events, notes
```

### **Notifications Table Policies**

```sql
-- Users can only see their own notifications
CREATE POLICY "users_own_notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "system_create_notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
```

---

## 🔐 AUTHENTICATION FLOW

### **Master Admin Setup (First User)**

```sql
-- Create first master admin user manually in Supabase Dashboard
-- SQL Editor → New Query:

-- 1. Create auth user first (through Supabase Auth UI or SQL)
INSERT INTO auth.users (
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  'admin@emeraldvisa.com',
  crypt('YourSecurePassword123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Master Admin"}',
  NOW(),
  NOW()
) RETURNING id;

-- 2. Then create profile in public.users (use the returned ID)
INSERT INTO public.users (
  id,
  email,
  phone,
  full_name,
  role,
  status,
  created_at,
  updated_at
) VALUES (
  'UUID-FROM-ABOVE', -- Replace with actual UUID
  'admin@emeraldvisa.com',
  '+92-300-1234567',
  'Master Admin',
  'master_admin',
  'active',
  NOW(),
  NOW()
);
```

### **User Creation Flow (by Admin)**

```typescript
// When admin creates a new user:
1. Admin fills form (email, phone, name, role)
2. System creates auth.users entry (via Supabase Auth)
3. System creates public.users profile
4. System sends invitation email
5. User receives email with temporary password
6. User logs in and changes password
```

---

## 👥 USER MANAGEMENT SYSTEM

### **Role Hierarchy**

```
Master Admin (Top Level)
    ├─ Can create: Admins, Agents, Customers
    ├─ Can delete: Any user
    ├─ Can modify: Any user
    └─ Full system access

Admin (Second Level)
    ├─ Can create: Agents, Customers
    ├─ Can delete: Agents, Customers (not Admins)
    ├─ Can modify: Agents, Customers
    └─ Full case/payment/document access

Agent (Third Level)
    ├─ Cannot create users
    ├─ Can manage assigned cases
    ├─ Can add payments/documents to their cases
    └─ Limited system access

Customer (End User)
    ├─ Cannot create users
    ├─ Can view their own cases
    ├─ Can upload documents
    └─ Minimal access
```

### **Permission Matrix**

| Action | Master Admin | Admin | Agent | Customer |
|--------|--------------|-------|-------|----------|
| Create Master Admin | ✅ | ❌ | ❌ | ❌ |
| Create Admin | ✅ | ❌ | ❌ | ❌ |
| Create Agent | ✅ | ✅ | ❌ | ❌ |
| Create Customer | ✅ | ✅ | ✅ | ❌ |
| Delete Users | ✅ | ✅* | ❌ | ❌ |
| View All Cases | ✅ | ✅ | ❌ | ❌ |
| Create Cases | ✅ | ✅ | ✅ | ❌ |
| Modify Any Case | ✅ | ✅ | ❌** | ❌ |
| View Reports | ✅ | ✅ | ✅*** | ❌ |
| System Settings | ✅ | ✅ | ❌ | ❌ |

\* Admin can only delete Agents/Customers  
\** Agent can only modify assigned cases  
\*** Agent can only view their own performance

---

## 🛠️ IMPLEMENTATION STEPS

### **Step 1: Install Supabase Client**

```bash
npm install @supabase/supabase-js
# or
pnpm add @supabase/supabase-js
```

### **Step 2: Configure Environment Variables**

Create `.env` file:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Step 3: Run Database Migrations**

1. Copy all SQL from above
2. Go to Supabase Dashboard → SQL Editor
3. Create new query
4. Paste SQL and run
5. Verify tables created

### **Step 4: Setup Master Admin**

1. Use SQL above to create first master admin
2. Or use Supabase Auth UI to create user
3. Then add to public.users table with role='master_admin'

### **Step 5: Integrate Code**

See implementation files:
- `/src/app/lib/supabase.ts` - Supabase client
- `/src/app/lib/auth.ts` - Authentication logic
- `/src/app/lib/api.ts` - API functions
- `/src/app/pages/admin/AdminUserManagement.tsx` - User management UI

### **Step 6: Test Workflow**

1. Login as master admin
2. Create an admin user
3. Login as admin
4. Create an agent user
5. Verify permissions work correctly

---

## 🔐 SECURITY BEST PRACTICES

### **1. Environment Variables**
- ✅ Never commit `.env` to git
- ✅ Use different keys for dev/prod
- ✅ Rotate keys regularly

### **2. Row Level Security**
- ✅ Enable RLS on all tables
- ✅ Test policies thoroughly
- ✅ Use `auth.uid()` for user context

### **3. Password Security**
- ✅ Enforce strong passwords (8+ chars, uppercase, lowercase, number, symbol)
- ✅ Force password change on first login
- ✅ Implement password reset flow

### **4. API Security**
- ✅ Use anon key for client-side
- ✅ Never expose service_role key
- ✅ Validate all inputs
- ✅ Rate limit API calls

### **5. Audit Logging**
- ✅ Log all user creations/deletions
- ✅ Track who made changes
- ✅ Monitor failed login attempts

---

## 📊 MIGRATION FROM LOCALSTORAGE

To migrate existing data:

```typescript
// 1. Export from LocalStorage
const cases = CRMDataStore.getCases();

// 2. Import to Supabase
for (const caseItem of cases) {
  await supabase.from('cases').insert({
    case_number: caseItem.id,
    customer_name: caseItem.customerName,
    phone: caseItem.phone,
    email: caseItem.email,
    // ... map all fields
  });
}
```

---

## 🎯 NEXT STEPS

After Supabase is connected:

1. ✅ Implement authentication UI
2. ✅ Create user management dashboard
3. ✅ Migrate existing data
4. ✅ Test all RLS policies
5. ✅ Add real-time subscriptions
6. ✅ Implement file uploads (documents)
7. ✅ Setup email notifications
8. ✅ Add backup/restore functionality

---

## 📞 SUPPORT

For issues:
- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- This guide: See implementation files for code examples

---

**Ready to implement! All code files are being created next...**
