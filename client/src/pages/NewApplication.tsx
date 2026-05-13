import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { applicationsApi, borrowersApi, propertyApi, termsApi } from '../lib/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import BorrowerForm from '../components/forms/BorrowerForm';
import { cn } from '../lib/utils';
import type { Application } from '../types';

// ---------------------------------------------------------------------------
// Zod schemas per step
// ---------------------------------------------------------------------------
const borrowerSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  dob: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(7, 'Required'),
  employmentType: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACT', 'RETIRED', 'OTHER']),
  creditScore: z.number().min(300).max(900),
  bankruptcies: z.boolean().optional(),
  collections: z.boolean().optional(),
  existingMortgages: z.number().min(0).optional(),
  sin: z.string().optional(),
});

const propertySchema = z.object({
  address: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  province: z.string().min(2, 'Required'),
  postalCode: z.string().min(6, 'Required'),
  propertyType: z.enum(['DETACHED', 'SEMI', 'TOWNHOUSE', 'CONDO', 'DUPLEX', 'OTHER']),
  occupancy: z.enum(['OWNER', 'RENTAL', 'SECONDARY']),
  purchasePrice: z.number().min(1, 'Required'),
  downPayment: z.number().min(1, 'Required'),
});

const termsSchema = z.object({
  contractRate: z.number().min(0.01).max(30),
  amortizationYears: z.number().min(5).max(30),
  termYears: z.number().min(1).max(10),
  insured: z.boolean().optional(),
});

const fullSchema = z.object({
  borrower: borrowerSchema,
  property: propertySchema,
  terms: termsSchema,
});

type FormValues = z.infer<typeof fullSchema>;

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: 'Borrower Info' },
  { id: 2, title: 'Property' },
  { id: 3, title: 'Mortgage Terms' },
];

const PROVINCE_OPTIONS = [
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
].map((p) => ({ value: p, label: p }));

const PROPERTY_TYPE_OPTIONS = [
  { value: 'DETACHED', label: 'Detached' },
  { value: 'SEMI', label: 'Semi-Detached' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'OTHER', label: 'Other' },
];

const OCCUPANCY_OPTIONS = [
  { value: 'OWNER', label: 'Owner-Occupied' },
  { value: 'RENTAL', label: 'Rental' },
  { value: 'SECONDARY', label: 'Secondary Residence' },
];

const AMORT_OPTIONS = [5, 10, 15, 20, 25, 30].map((y) => ({
  value: y,
  label: `${y} years`,
}));

const TERM_OPTIONS = [1, 2, 3, 4, 5, 7, 10].map((y) => ({
  value: y,
  label: `${y} year${y > 1 ? 's' : ''}`,
}));

export default function NewApplication() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const methods = useForm<FormValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      borrower: {
        employmentType: 'EMPLOYED',
        creditScore: 720,
        bankruptcies: false,
        collections: false,
        existingMortgages: 0,
      },
      property: {
        propertyType: 'DETACHED',
        occupancy: 'OWNER',
        province: 'ON',
      },
      terms: {
        contractRate: 5.25,
        amortizationYears: 25,
        termYears: 5,
        insured: false,
      },
    },
  });

  const {
    handleSubmit,
    trigger,
    register,
    formState: { errors },
  } = methods;

  const createMutation = useMutation<Application, Error, FormValues>({
    mutationFn: async (values) => {
      // 1. Create shell application
      const app = await applicationsApi.create({});

      // 2. Create borrower
      await borrowersApi.create(app.id, {
        ...values.borrower,
        type: 'PRIMARY',
        creditScore: Number(values.borrower.creditScore),
        existingMortgages: Number(values.borrower.existingMortgages ?? 0),
      });

      // 3. Create property
      await propertyApi.create(app.id, {
        ...values.property,
        purchasePrice: Number(values.property.purchasePrice),
        downPayment: Number(values.property.downPayment),
        appraisedValue: Number(values.property.purchasePrice),
        annualTax: 0,
        monthlyHeat: 150,
        condoFees: 0,
      });

      // 4. Create terms
      await termsApi.create(app.id, {
        contractRate: Number(values.terms.contractRate),
        amortizationYears: Number(values.terms.amortizationYears),
        termYears: Number(values.terms.termYears),
        insured: values.terms.insured ?? false,
        stressRate: Math.max(Number(values.terms.contractRate) + 2, 5.25),
        monthlyPayment: 0,
        mortgageAmount: 0,
      });

      return app;
    },
    onSuccess: (app) => {
      toast.success('Application created successfully');
      navigate(`/applications/${app.id}`);
    },
    onError: () => {
      toast.error('Failed to create application. Please try again.');
    },
  });

  const nextStep = async () => {
    let fields: (keyof FormValues)[] = [];
    if (step === 1) fields = ['borrower'];
    if (step === 2) fields = ['property'];
    const ok = await trigger(fields);
    if (ok) setStep((s) => s + 1);
  };

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Application</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete all 3 steps to create the mortgage file.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-colors',
                step > s.id
                  ? 'bg-green-500 text-white'
                  : step === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              )}
            >
              {step > s.id ? <Check size={14} /> : s.id}
            </div>
            <span
              className={cn(
                'text-sm font-medium hidden sm:block',
                step === s.id ? 'text-blue-600' : step > s.id ? 'text-green-600' : 'text-slate-400'
              )}
            >
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  step > s.id ? 'bg-green-400' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form */}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
            {/* Step 1: Borrower */}
            {step === 1 && (
              <>
                <h2 className="text-base font-semibold text-slate-900">Primary Borrower</h2>
                <BorrowerForm prefix="borrower." showSin />
              </>
            )}

            {/* Step 2: Property */}
            {step === 2 && (
              <>
                <h2 className="text-base font-semibold text-slate-900">Property Information</h2>
                <div className="space-y-4">
                  <Input
                    label="Street Address"
                    required
                    error={errors.property?.address?.message}
                    {...register('property.address')}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <Input
                        label="City"
                        required
                        error={errors.property?.city?.message}
                        {...register('property.city')}
                      />
                    </div>
                    <Select
                      label="Province"
                      required
                      options={PROVINCE_OPTIONS}
                      error={errors.property?.province?.message}
                      {...register('property.province')}
                    />
                    <Input
                      label="Postal Code"
                      required
                      placeholder="M5V 1A1"
                      error={errors.property?.postalCode?.message}
                      {...register('property.postalCode')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Property Type"
                      required
                      options={PROPERTY_TYPE_OPTIONS}
                      error={errors.property?.propertyType?.message}
                      {...register('property.propertyType')}
                    />
                    <Select
                      label="Occupancy"
                      required
                      options={OCCUPANCY_OPTIONS}
                      error={errors.property?.occupancy?.message}
                      {...register('property.occupancy')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Purchase Price ($)"
                      type="number"
                      required
                      placeholder="500000"
                      error={errors.property?.purchasePrice?.message}
                      {...register('property.purchasePrice', { valueAsNumber: true })}
                    />
                    <Input
                      label="Down Payment ($)"
                      type="number"
                      required
                      placeholder="100000"
                      error={errors.property?.downPayment?.message}
                      {...register('property.downPayment', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Terms */}
            {step === 3 && (
              <>
                <h2 className="text-base font-semibold text-slate-900">Mortgage Terms</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Input
                      label="Contract Rate (%)"
                      type="number"
                      step="0.01"
                      required
                      placeholder="5.25"
                      error={errors.terms?.contractRate?.message}
                      {...register('terms.contractRate', { valueAsNumber: true })}
                    />
                    <Select
                      label="Amortization"
                      required
                      options={AMORT_OPTIONS}
                      error={errors.terms?.amortizationYears?.message}
                      {...register('terms.amortizationYears', { valueAsNumber: true })}
                    />
                    <Select
                      label="Term"
                      required
                      options={TERM_OPTIONS}
                      error={errors.terms?.termYears?.message}
                      {...register('terms.termYears', { valueAsNumber: true })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      {...register('terms.insured')}
                    />
                    CMHC Insured mortgage
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-4">
            <Button
              type="button"
              variant="secondary"
              leftIcon={<ChevronLeft size={16} />}
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                rightIcon={<ChevronRight size={16} />}
                onClick={nextStep}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                loading={createMutation.isPending}
                leftIcon={<Check size={16} />}
              >
                Create Application
              </Button>
            )}
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
