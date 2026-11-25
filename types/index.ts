export type RoleId = 'player' | 'staff' | 'academy' | 'store' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export interface UserRecord {
  uid: string; fullName: string; email: string;
  accountStatus: AccountStatus; createdAt: number; updatedAt: number;
}
export interface MeResponse { user: UserRecord; roles: RoleId[]; }
