/**
 * Module purpose: Explains the empty-business state and guides users to register a business before using compliance features.
 */
import { Building2 } from 'lucide-react';
import { ButtonLink, EmptyState } from '../ui';

export function NoBusiness() {
  return (
    <div className="panel">
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Add your first business"
        message="Tell us about your business and we'll list the filings that apply to it, with their due dates."
        action={<ButtonLink to="/app/businesses/new">Add business</ButtonLink>}
      />
    </div>
  );
}
