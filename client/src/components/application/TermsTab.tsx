import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { termsApi } from '../../lib/api';
import type { Application } from '../../types';
import { appKeys } from '../../hooks/useApplication';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { formatCurrency, formatPercent } from '../../lib/utils';

const termsSchema = z.object({
  contractRate: z.number().min(0.01).max(30),
  amortizationYears: z.number().min(5).max(30),
  termYears: z.number().min(1).max(10),
  insured: z.boolean().optional(),
});

type TermsFormValues = z.infer<typeof termsSchema>;

const AMORT_OPTIONS = [5, 10, 15, 20, 25, 30].map((y) => ({ value: y, label: `${y} years` }));
const TERM_OPTIONS = [1, 2, 3, 4, 5, 7, 10].map((y) => ({
  value: y,
  label: `${y} year${y > 1 ? 's' : ''}`,
}));

function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const n = years * 12;
  return (principal * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1);
}

interface TermsTabProps {
  application: Application;
}

export default function TermsTab({ application }: TermsTabProps) {
  const queryClient = useQueryClient();
  const terms = application.mortgageTerms;
  const property = application.property;

  const mortgageAmount = property
    ? property.appraisedValue - property.downPayment
    : 0;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<TermsFormValues>({
    resolver: zodResolver(termsSchema),
    defaultValues: {
      contractRate: terms?.contractRate ?? 5.25,
      amortizationYears: terms?.amortizationYears ?? 25,
      termYears: terms?.termYears ?? 5,
      insured: terms?.insured ?? false,
    },
  });

  useEffect(() => {
    if (terms) {
      reset({
        contractRate: terms.contractRate,
        amortizationYears: terms.amortizationYears,
        termYears: terms.termYears,
        insured: terms.insured,
      });
    }
  }, [terms, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: TermsFormValues) => {
      const stressRate = Math.max(Number(data.contractRate) + 2, 5.25);
      const monthlyPayment = calcMonthlyPayment(
        mortgageAmount,
        data.contractRate,
        data.amortizationYears
      );
      if (terms?.id) {
        return termsApi.update(terms.id, { ...data, stressRate, monthlyPayment, mortgageAmount });
      }
      return termsApi.create(application.id, { ...data, stressRate, monthlyPayment, mortgageAmount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      toast.success('Terms saved');
    },
    onError: () => toast.error('Failed to save terms'),
  });

  const values = watch();
  const contractRate = Number(values.contractRate) || 0;
  const amortYears = Number(values.amortizationYears) || 25;
  const stressRate = Math.max(contractRate + 2, 5.25);
  const monthlyPayment = calcMonthlyPayment(mortgageAmount, contractRate, amortYears);
  const stressPayment = calcMonthlyPayment(mortgageAmount, stressRate, amortYears);

  const onSubmit = (data: TermsFormValues) => {
    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Mortgage Terms
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Contract Rate (%)"
          type="number"
          step="0.01"
          min={0.01}
          max={30}
          required
          error={errors.contractRate?.message}
          {...register('contractRate', { valueAsNumber: true })}
        />
        <Select
          label="Amortization Period"
          required
          options={AMORT_OPTIONS}
          error={errors.amortizationYears?.message}
          {...register('amortizationYears', { valueAsNumber: true })}
        />
        <Select
          label="Term Length"
          required
          options={TERM_OPTIONS}
          error={errors.termYears?.message}
          {...register('termYears', { valueAsNumber: true })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          {...register('insured')}
        />
        CMHC Insured Mortgage
      </label>

      {/* Computed preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Mortgage Amount</p>
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(mortgageAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Stress Rate</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatPercent(stressRate)} <span className="text-xs font-normal text-slate-400">(min 5.25%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Monthly Payment</p>
          <p className="text-sm font-semibold text-slate-900">
            {monthlyPayment > 0 ? formatCurrency(monthlyPayment) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Stress Payment</p>
          <p className="text-sm font-semibold text-amber-700">
            {stressPayment > 0 ? formatCurrency(stressPayment) : '—'}
          </p>
        </div>
      </div>
    </form>
  );
}
