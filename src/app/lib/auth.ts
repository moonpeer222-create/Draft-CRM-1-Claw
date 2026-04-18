/**
 * @deprecated Improvement #8 — This file is DEPRECATED.
 * Use authApi from './api.ts' for server-side session authentication.
 * This file is kept only for backward compatibility with components
 * that still reference its exports. Do NOT add new functionality here.
 */
// Authentication Service (DEPRECATED — use api.ts authApi instead)
import { supabase, DbUser, getCurrentUser, getCurrentUserProfile } from './supabase';
import { toast } from './toast';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  phone: string;
  full_name: string;
  password: string;
  role: DbUser['role'];
  created_by?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: DbUser;
  error?: string;
}

// Authentication Class
export class AuthService {
  // Login with email and password
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed' };
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'User profile not found' };
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      return { success: true, user: profile };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Logout
  static async logout(): Promise<void> {
    await supabase.auth.signOut();
  }

  // Create new user (Admin only)
  static async createUser(userData: SignupData): Promise<AuthResponse> {
    try {
      // Check if current user is admin
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        return { success: false, error: 'Not authenticated' };
      }

      // Permission check
      if (
        userData.role === 'master_admin' &&
        currentProfile.role !== 'master_admin'
      ) {
        return {
          success: false,
          error: 'Only master admin can create master admins',
        };
      }

      if (
        userData.role === 'admin' &&
        !['master_admin'].includes(currentProfile.role)
      ) {
        return { success: false, error: 'Only master admin can create admins' };
      }

      if (
        userData.role === 'agent' &&
        !['master_admin', 'admin'].includes(currentProfile.role)
      ) {
        return { success: false, error: 'Only admins can create agents' };
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
          },
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user' };
      }

      // Create user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          phone: userData.phone,
          full_name: userData.full_name,
          role: userData.role,
          status: 'active',
          created_by: currentProfile.id,
          metadata: {},
        })
        .select()
        .single();

      if (profileError) {
        // Rollback: delete auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: profileError.message };
      }

      // Create welcome notification
      await supabase.from('notifications').insert({
        user_id: authData.user.id,
        type: 'system',
        priority: 'medium',
        title: 'Welcome to Emerald Tech Partner',
        message: `Your account has been created successfully. Please change your password on first login.`,
        read: false,
        actionable: false,
        metadata: {},
      });

      return { success: true, user: profile };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Update user
  static async updateUser(
    userId: string,
    updates: Partial<DbUser>
  ): Promise<AuthResponse> {
    try {
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        return { success: false, error: 'Not authenticated' };
      }

      // Permission check
      const { data: targetUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!targetUser) {
        return { success: false, error: 'User not found' };
      }

      // Can't modify master_admin unless you are master_admin
      if (
        targetUser.role === 'master_admin' &&
        currentProfile.role !== 'master_admin'
      ) {
        return {
          success: false,
          error: 'Only master admin can modify master admins',
        };
      }

      // Prevent role escalation
      if (updates.role) {
        if (
          updates.role === 'master_admin' &&
          currentProfile.role !== 'master_admin'
        ) {
          return {
            success: false,
            error: 'Cannot escalate to master admin',
          };
        }
        if (
          updates.role === 'admin' &&
          currentProfile.role !== 'master_admin'
        ) {
          return { success: false, error: 'Cannot escalate to admin' };
        }
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Delete user
  static async deleteUser(userId: string): Promise<AuthResponse> {
    try {
      const currentProfile = await getCurrentUserProfile();
      if (!currentProfile) {
        return { success: false, error: 'Not authenticated' };
      }

      // Get target user
      const { data: targetUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!targetUser) {
        return { success: false, error: 'User not found' };
      }

      // Permission check
      if (
        targetUser.role === 'master_admin' &&
        currentProfile.role !== 'master_admin'
      ) {
        return {
          success: false,
          error: 'Only master admin can delete master admins',
        };
      }

      if (
        targetUser.role === 'admin' &&
        currentProfile.role !== 'master_admin'
      ) {
        return { success: false, error: 'Only master admin can delete admins' };
      }

      // Soft delete - mark as suspended instead of hard delete
      const { error } = await supabase
        .from('users')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Optionally hard delete from auth.users
      // await supabase.auth.admin.deleteUser(userId);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Change password
  static async changePassword(newPassword: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Get all users (Admin only)
  static async getAllUsers(
    filters?: {
      role?: DbUser['role'];
      status?: DbUser['status'];
      search?: string;
    }
  ): Promise<{ success: boolean; users?: DbUser[]; error?: string }> {
    try {
      let query = supabase.from('users').select('*');

      // Apply filters
      if (filters?.role) {
        query = query.eq('role', filters.role);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, users: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Get user by ID
  static async getUserById(
    userId: string
  ): Promise<{ success: boolean; user?: DbUser; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Update user status
  static async updateUserStatus(
    userId: string,
    status: DbUser['status']
  ): Promise<AuthResponse> {
    return this.updateUser(userId, { status });
  }

  // Get users by role
  static async getUsersByRole(
    role: DbUser['role']
  ): Promise<{ success: boolean; users?: DbUser[]; error?: string }> {
    return this.getAllUsers({ role });
  }

  // Validate current session
  static async validateSession(): Promise<boolean> {
    const user = await getCurrentUser();
    return !!user;
  }

  // Get current user role
  static async getCurrentUserRole(): Promise<DbUser['role'] | null> {
    const profile = await getCurrentUserProfile();
    return profile?.role || null;
  }

  // Check if user can create specific role
  static canCreateRole(
    currentRole: DbUser['role'],
    targetRole: DbUser['role']
  ): boolean {
    const hierarchy: Record<DbUser['role'], number> = {
      master_admin: 4,
      admin: 3,
      agent: 2,
      customer: 1,
    };

    return hierarchy[currentRole] > hierarchy[targetRole];
  }
}

// Password validation
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone validation (Pakistan format)
export function validatePhone(phone: string): boolean {
  // Accepts formats: +92-300-1234567, 03001234567, +923001234567
  const phoneRegex = /^(\+92|92|0)?(3\d{9})$/;
  return phoneRegex.test(phone.replace(/[-\s]/g, ''));
}
