export type UserRole = 'superadmin' | 'admin' | 'field_worker' | 'read_only';
export type GroupAssignment = 'grupo_a' | 'grupo_b' | 'all';

export interface UserProfile {
  uid: string;
  email: string;
  full_name: string;
  role: UserRole;
  group_assignment: GroupAssignment;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}
