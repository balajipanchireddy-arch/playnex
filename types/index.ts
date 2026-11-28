export type RoleId = 'player' | 'staff' | 'academy' | 'store' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  updatedAt?: number;
}

export interface UserRecord {
  uid: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  suspensionReason?: string;
  suspendedAt?: number;
  address?: string;
  location?: GeoLocation;
  createdAt: number;
  updatedAt: number;
}

export interface MeResponse {
  user: UserRecord;
  roles: RoleId[];
}

export type PlayerVerificationStatus =
  | 'not_submitted'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'resubmission_required'
  | 'suspended_expired';

export type BookingStatus =
  | 'confirmed'
  | 'cancelled'
  | 'checked_in'
  | 'completed'
  | 'no_show';

export type OrderPaymentStatus = 'pending' | 'unpaid' | 'paid_at_venue';

export type RentalStatus = 'pending' | 'active' | 'returned' | 'overdue' | 'cancelled';

export interface CleanupReport {
  mode: 'selective' | 'complete_reset';
  executedAt: number;
  executedBy: string;
  deletedCount: number;
  preservedCount: number;
  filesDeleted: number;
  failedCount: number;
  skippedCount: number;
  remainingCounts: Record<string, number>;
  details: Record<
    string,
    {
      deleted: number;
      preserved: number;
      skipped: number;
      failed: number;
      filesDeleted: number;
      errors: string[];
    }
  >;
  errors: string[];
  recoveryInstructions: string[];
}
