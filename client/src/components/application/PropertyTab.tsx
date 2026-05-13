import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { propertyApi } from '../../lib/api';
import type { Application } from '../../types';
import { appKeys } from '../../hooks/useApplication';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { formatPercent } from '../../lib/utils';

const propertySchema = z.object({
  address: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  province: z.string().min(2, 'Required'),
  postalCode: z.string().min(6, 'Required'),
  propertyType: z.enum(['DETACHED', 'SEMI', 'TOWNHOUSE', 'CONDO', 'DUPLEX', 'OTHER']),
  occupancy: z.enum(['OWNER', 'RENTAL', 'SECONDARY']),
  purchasePrice: z.number().min(1, 'Required'),
  appraisedValue: z.number().min(1, 'Required'),
  downPayment: z.number().min(1, 'Required'),
  annualTax: z.number().min(0).default(0),
  monthlyHeat: z.number().min(0).default(150),
  condoFees: z.number().min(0).default(0),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const PROVINCE_OPTIONS = ['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(
  (p) => ({ value: p, label: p })
);

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

interface PropertyTabProps {
  application: Application;
}

export default function PropertyTab({ application }: PropertyTabProps) {
  const queryClient = useQueryClient();
  const property = application.property;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: property?.address ?? '',
      city: property?.city ?? '',
      province: property?.province ?? 'ON',
      postalCode: property?.postalCode ?? '',
      propertyType: property?.propertyType ?? 'DETACHED',
      occupancy: property?.occupancy ?? 'OWNER',
      purchasePrice: property?.purchasePrice ?? 0,
      appraisedValue: property?.appraisedValue ?? 0,
      downPayment: property?.downPayment ?? 0,
      annualTax: property?.annualTax ?? 0,
      monthlyHeat: property?.monthlyHeat ?? 150,
      condoFees: property?.condoFees ?? 0,
    },
  });

  useEffect(() => {
    if (property) {
      reset({
        address: property.address,
        city: property.city,
        province: property.province,
        postalCode: property.postalCode,
        propertyType: property.propertyType,
        occupancy: property.occupancy,
        purchasePrice: property.purchasePrice,
        appraisedValue: property.appraisedValue,
        downPayment: property.downPayment,
        annualTax: property.annualTax,
        monthlyHeat: property.monthlyHeat,
        condoFees: property.condoFees,
      });
    }
  }, [property, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: PropertyFormValues) => {
      if (property?.id) {
        return propertyApi.update(property.id, data);
      }
      return propertyApi.create(application.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      toast.success('Property saved');
    },
    onError: () => toast.error('Failed to save property'),
  });

  const values = watch();
  const ltv =
    values.appraisedValue > 0
      ? ((values.appraisedValue - values.downPayment) / values.appraisedValue) * 100
      : 0;

  const onSubmit = (data: PropertyFormValues) => {
    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Property Details
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

      {/* Address */}
      <Input
        label="Street Address"
        required
        error={errors.address?.message}
        {...register('address')}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2">
          <Input
            label="City"
            required
            error={errors.city?.message}
            {...register('city')}
          />
        </div>
        <Select
          label="Province"
          required
          options={PROVINCE_OPTIONS}
          error={errors.province?.message}
          {...register('province')}
        />
        <Input
          label="Postal Code"
          required
          placeholder="M5V 1A1"
          error={errors.postalCode?.message}
          {...register('postalCode')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Property Type"
          required
          options={PROPERTY_TYPE_OPTIONS}
          error={errors.propertyType?.message}
          {...register('propertyType')}
        />
        <Select
          label="Occupancy"
          required
          options={OCCUPANCY_OPTIONS}
          error={errors.occupancy?.message}
          {...register('occupancy')}
        />
      </div>

      {/* Values */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Purchase Price ($)"
          type="number"
          min={0}
          required
          error={errors.purchasePrice?.message}
          {...register('purchasePrice', { valueAsNumber: true })}
        />
        <Input
          label="Appraised Value ($)"
          type="number"
          min={0}
          required
          error={errors.appraisedValue?.message}
          {...register('appraisedValue', { valueAsNumber: true })}
        />
        <Input
          label="Down Payment ($)"
          type="number"
          min={0}
          required
          error={errors.downPayment?.message}
          {...register('downPayment', { valueAsNumber: true })}
        />
      </div>

      {/* Carrying costs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Annual Property Tax ($)"
          type="number"
          min={0}
          error={errors.annualTax?.message}
          {...register('annualTax', { valueAsNumber: true })}
        />
        <Input
          label="Monthly Heating ($)"
          type="number"
          min={0}
          error={errors.monthlyHeat?.message}
          {...register('monthlyHeat', { valueAsNumber: true })}
        />
        <Input
          label="Monthly Condo Fees ($)"
          type="number"
          min={0}
          error={errors.condoFees?.message}
          {...register('condoFees', { valueAsNumber: true })}
        />
      </div>

      {/* LTV preview */}
      <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-medium text-slate-600">LTV Preview</span>
        <span
          className={`text-lg font-semibold ${
            ltv > 95
              ? 'text-red-600'
              : ltv > 80
              ? 'text-amber-600'
              : 'text-green-600'
          }`}
        >
          {ltv > 0 ? formatPercent(ltv) : '—'}
        </span>
      </div>
    </form>
  );
}
