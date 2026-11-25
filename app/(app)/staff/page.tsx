/**
 * /staff route is deprecated.
 * Staff management has been integrated into the Academy module.
 * This page redirects users to /academy automatically.
 */
import { redirect } from 'next/navigation';

export default function StaffRedirectPage() {
  redirect('/academy');
}
