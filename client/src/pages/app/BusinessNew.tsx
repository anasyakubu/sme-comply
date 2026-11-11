/**
 * Module purpose: Creates a new business using the shared validated form, then updates business selection/navigation.
 */
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useBusiness } from '../../context/BusinessContext';
import { errorMessage, post } from '../../lib/api';
import type { Business } from '../../types';
import { PageHeader } from '../../components/ui';
import { BusinessForm, BusinessFormValues, toPayload } from '../../components/business/BusinessForm';

/**
 * Creates a new business using the shared validated form, then updates business selection/navigation.
 */
export default function BusinessNew() {
  const navigate = useNavigate();
  const { reload, setCurrentId } = useBusiness();

  const onSubmit = async (values: BusinessFormValues) => {
    try {
      const res = await post<{ business: Business; generation: { created: number; applicableRequirements: number } }>('/businesses', toPayload(values));
      const { business, generation } = res.data;
      toast.success(`${business.businessName} added. ${generation.applicableRequirements} requirements apply, ${generation.created} obligations scheduled.`, { duration: 6000 });
      await reload();
      setCurrentId(business._id);
      navigate('/app');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        back={
          <Link to="/app/businesses" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> Businesses
          </Link>
        }
        title="Add a business"
        description="We use these answers to work out which obligations apply. You can change them any time and the list updates."
      />
      <BusinessForm submitLabel="Add business and see obligations" onSubmit={onSubmit} onCancel={() => navigate(-1)} />
    </div>
  );
}
