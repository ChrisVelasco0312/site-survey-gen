export type UserRole = 'admin' | 'field_worker';
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
