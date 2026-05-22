import { useState, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { borrowersApi } from '../../lib/api';
import type { Application, Borrower } from '../../types';
import { appKeys } from '../../hooks/useApplication';
import BorrowerForm from '../forms/BorrowerForm';
import Button from '../ui/Button';
import { cn } from '../../lib/utils';

const borrowerSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  dob: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Required'),
  sin: z.string().optional(),
  employmentType: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACT', 'RETIRED', 'OTHER']),
  creditScore: z.number().min(300).max(900),
  bankruptcies: z.boolean().optional(),
  collections: z.boolean().optional(),
  existingMortgages: z.number().min(0).optional(),
});

type BorrowerFormValues = z.infer<typeof borrowerSchema>;

interface SingleBorrowerFormProps {
  borrower: Borrower;
  applicationId: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

function SingleBorrowerForm({
  borrower,
  applicationId,
  onDelete,
  canDelete = false,
}: SingleBorrowerFormProps) {
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);

  const methods = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
    defaultValues: {
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      dob: borrower.dob,
      email: borrower.email,
      phone: borrower.phone,
      sin: borrower.sin ?? '',
      employmentType: borrower.employmentType,
      creditScore: borrower.creditScore,
      bankruptcies: borrower.bankruptcies,
      collections: borrower.collections,
      existingMortgages: borrower.existingMortgages,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Borrower>) => borrowersApi.update(borrower.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
      setIsDirty(false);
      toast.success('Borrower saved');
    },
    onError: () => toast.error('Failed to save borrower'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => borrowersApi.delete(borrower.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
      toast.success('Co-borrower removed');
    },
    onError: () => toast.error('Failed to remove co-borrower'),
  });

  const onBlurSave = useCallback(
    async (field: string, value: unknown) => {
      setIsDirty(true);
      const isValid = await methods.trigger();
      if (!isValid) return;
      const values = methods.getValues();
      updateMutation.mutate({ ...values, [field]: value });
    },
    [methods, updateMutation]
  );

  const onSubmit = (values: BorrowerFormValues) => {
    updateMutation.mutate(values);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            {borrower.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower'}
          </h3>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                Unsaved
              </span>
            )}
            {updateMutation.isPending && (
              <span className="text-xs text-slate-400">Saving…</span>
            )}
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={13} />}
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (confirm('Remove this co-borrower?')) deleteMutation.mutate();
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <BorrowerForm showSin />

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            loading={updateMutation.isPending}
            leftIcon={<Save size={14} />}
          >
            Save
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------

interface BorrowerTabProps {
  application: Application;
}

export default function BorrowerTab({ application }: BorrowerTabProps) {
  const queryClient = useQueryClient();
  const [addingCo, setAddingCo] = useState(false);

  const primaryBorrower = application.borrowers.find((b) => b.type === 'PRIMARY');
  const coBorrower = application.borrowers.find((b) => b.type === 'CO_BORROWER');

  const addCoMutation = useMutation({
    mutationFn: () =>
      borrowersApi.create(application.id, {
        type: 'CO_BORROWER',
        firstName: '',
        lastName: '',
        dob: '',
        email: '',
        phone: '',
        employmentType: 'EMPLOYED',
        creditScore: 700,
        bankruptcies: false,
        collections: false,
        existingMortgages: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      setAddingCo(false);
    },
    onError: () => toast.error('Failed to add co-borrower'),
  });

  return (
    <div className="space-y-8">
      {primaryBorrower ? (
        <SingleBorrowerForm
          borrower={primaryBorrower}
          applicationId={application.id}
        />
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          No primary borrower on file.
        </div>
      )}

      <div className="border-t border-slate-100 pt-6">
        {coBorrower ? (
          <SingleBorrowerForm
            borrower={coBorrower}
            applicationId={application.id}
            canDelete
          />
        ) : (
          <div
            className={cn(
              'rounded-lg border-2 border-dashed border-slate-200 p-6 text-center',
              addingCo && 'border-blue-300 bg-blue-50'
            )}
          >
            {addingCo ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Creating co-borrower record…
                </p>
                <Button
                  size="sm"
                  loading={addCoMutation.isPending}
                  onClick={() => addCoMutation.mutate()}
                >
                  Confirm Add Co-Borrower
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAddingCo(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-3">No co-borrower added.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setAddingCo(true)}
                >
                  Add Co-Borrower
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
