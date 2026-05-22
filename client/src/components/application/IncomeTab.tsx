import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { incomeApi } from '../../lib/api';
import type { Application, Borrower, EmploymentType } from '../../types';
import { appKeys } from '../../hooks/useApplication';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { formatCurrency } from '../../lib/utils';

const incomeSchema = z.object({
  employerName: z.string().optional(),
  jobTitle: z.string().optional(),
  yearsEmployed: z.number().min(0).optional(),
  baseSalary: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
  overtime: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
  selfEmployedAvg: z.number().min(0).optional(),
  rentalIncome: z.number().min(0).default(0),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

function totalAnnual(v: IncomeFormValues, empType: EmploymentType): number {
  if (empType === 'SELF_EMPLOYED') {
    return (v.selfEmployedAvg ?? 0) + v.rentalIncome;
  }
  if (empType === 'RETIRED' || empType === 'OTHER') {
    return v.otherIncome + v.rentalIncome;
  }
  return v.baseSalary + v.bonus * 0.5 + v.overtime * 0.5 + v.otherIncome + v.rentalIncome;
}

interface IncomeSectionProps {
  borrower: Borrower;
  applicationId: string;
}

function IncomeSection({ borrower, applicationId }: IncomeSectionProps) {
  const queryClient = useQueryClient();
  const empType = borrower.employmentType;
  const income = borrower.income;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      employerName: income?.employerName ?? '',
      jobTitle: income?.jobTitle ?? '',
      yearsEmployed: income?.yearsEmployed ?? 0,
      baseSalary: income?.baseSalary ?? 0,
      bonus: income?.bonus ?? 0,
      overtime: income?.overtime ?? 0,
      otherIncome: income?.otherIncome ?? 0,
      selfEmployedAvg: income?.selfEmployedAvg ?? 0,
      rentalIncome: income?.rentalIncome ?? 0,
    },
  });

  useEffect(() => {
    if (income) {
      reset({
        employerName: income.employerName ?? '',
        jobTitle: income.jobTitle ?? '',
        yearsEmployed: income.yearsEmployed ?? 0,
        baseSalary: income.baseSalary ?? 0,
        bonus: income.bonus ?? 0,
        overtime: income.overtime ?? 0,
        otherIncome: income.otherIncome ?? 0,
        selfEmployedAvg: income.selfEmployedAvg ?? 0,
        rentalIncome: income.rentalIncome ?? 0,
      });
    }
  }, [income, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: IncomeFormValues) => {
      if (income?.id) {
        return incomeApi.update(income.id, data);
      }
      return incomeApi.create(borrower.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
      toast.success('Income saved');
    },
    onError: () => toast.error('Failed to save income'),
  });

  const values = watch();
  const annualTotal = totalAnnual(values, empType);

  const onSubmit = (data: IncomeFormValues) => {
    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          {borrower.type === 'PRIMARY' ? 'Primary Borrower' : 'Co-Borrower'} — {borrower.firstName} {borrower.lastName}
        </h3>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              Unsaved
            </span>
          )}
          <Button type="submit" size="sm" loading={saveMutation.isPending} leftIcon={<Save size={14} />}>
            Save
          </Button>
        </div>
      </div>

      {/* Employment context fields */}
      {(empType === 'EMPLOYED' || empType === 'CONTRACT') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Employer Name"
            error={errors.employerName?.message}
            {...register('employerName')}
          />
          <Input
            label="Job Title"
            error={errors.jobTitle?.message}
            {...register('jobTitle')}
          />
          <Input
            label="Years Employed"
            type="number"
            step="0.5"
            min={0}
            error={errors.yearsEmployed?.message}
            {...register('yearsEmployed', { valueAsNumber: true })}
          />
        </div>
      )}

      {empType === 'SELF_EMPLOYED' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="2-Year Avg Net Income ($)"
            type="number"
            min={0}
            error={errors.selfEmployedAvg?.message}
            {...register('selfEmployedAvg', { valueAsNumber: true })}
          />
          <Input
            label="Years Self-Employed"
            type="number"
            step="0.5"
            min={0}
            error={errors.yearsEmployed?.message}
            {...register('yearsEmployed', { valueAsNumber: true })}
          />
        </div>
      )}

      {/* Income fields */}
      {(empType === 'EMPLOYED' || empType === 'CONTRACT') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Base Salary ($)"
            type="number"
            min={0}
            required
            error={errors.baseSalary?.message}
            {...register('baseSalary', { valueAsNumber: true })}
          />
          <Input
            label="Annual Bonus ($)"
            type="number"
            min={0}
            hint="50% qualifying"
            error={errors.bonus?.message}
            {...register('bonus', { valueAsNumber: true })}
          />
          <Input
            label="Overtime ($)"
            type="number"
            min={0}
            hint="50% qualifying"
            error={errors.overtime?.message}
            {...register('overtime', { valueAsNumber: true })}
          />
          <Input
            label="Other Income ($)"
            type="number"
            min={0}
            error={errors.otherIncome?.message}
            {...register('otherIncome', { valueAsNumber: true })}
          />
        </div>
      )}

      {(empType === 'RETIRED' || empType === 'OTHER') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Annual Income ($)"
            type="number"
            min={0}
            required
            error={errors.otherIncome?.message}
            {...register('otherIncome', { valueAsNumber: true })}
          />
        </div>
      )}

      {/* Rental income for all */}
      <Input
        label="Rental Income (Annual) ($)"
        type="number"
        min={0}
        error={errors.rentalIncome?.message}
        {...register('rentalIncome', { valueAsNumber: true })}
      />

      {/* Total */}
      <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-slate-600">Qualifying Annual Income</span>
        <span className="text-lg font-semibold text-slate-900">{formatCurrency(annualTotal)}</span>
      </div>
    </form>
  );
}

interface IncomeTabProps {
  application: Application;
}

export default function IncomeTab({ application }: IncomeTabProps) {
  const primaryBorrower = application.borrowers.find((b) => b.type === 'PRIMARY');
  const coBorrower = application.borrowers.find((b) => b.type === 'CO_BORROWER');

  return (
    <div className="space-y-8">
      {primaryBorrower ? (
        <IncomeSection borrower={primaryBorrower} applicationId={application.id} />
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">
          Add a primary borrower first.
        </div>
      )}

      {coBorrower && (
        <>
          <div className="border-t border-slate-100" />
          <IncomeSection borrower={coBorrower} applicationId={application.id} />
        </>
      )}
    </div>
  );
}
