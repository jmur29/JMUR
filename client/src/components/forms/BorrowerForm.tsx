import { useFormContext } from 'react-hook-form';
import Input from '../ui/Input';
import Select from '../ui/Select';
import type { EmploymentType } from '../../types';

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'OTHER', label: 'Other' },
];

interface BorrowerFormProps {
  prefix?: string; // e.g. "borrower." for nested fields
  showSin?: boolean;
}

export default function BorrowerForm({ prefix = '', showSin = false }: BorrowerFormProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const field = (name: string) => `${prefix}${name}`;
  const err = (name: string) => {
    const parts = field(name).split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = errors;
    for (const p of parts) {
      cur = cur?.[p];
    }
    return cur?.message as string | undefined;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First Name"
          required
          error={err('firstName')}
          {...register(field('firstName'))}
        />
        <Input
          label="Last Name"
          required
          error={err('lastName')}
          {...register(field('lastName'))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Date of Birth"
          type="date"
          required
          error={err('dob')}
          {...register(field('dob'))}
        />
        {showSin && (
          <Input
            label="SIN"
            placeholder="XXX-XXX-XXX"
            error={err('sin')}
            {...register(field('sin'))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          required
          error={err('email')}
          {...register(field('email'))}
        />
        <Input
          label="Phone"
          type="tel"
          placeholder="416-555-0100"
          error={err('phone')}
          {...register(field('phone'))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          label="Employment Type"
          required
          options={EMPLOYMENT_OPTIONS}
          placeholder="Select type"
          error={err('employmentType')}
          {...register(field('employmentType'))}
        />
        <Input
          label="Credit Score"
          type="number"
          min={300}
          max={900}
          placeholder="720"
          required
          error={err('creditScore')}
          {...register(field('creditScore'), { valueAsNumber: true })}
        />
        <Input
          label="Existing Mortgages"
          type="number"
          min={0}
          placeholder="0"
          error={err('existingMortgages')}
          {...register(field('existingMortgages'), { valueAsNumber: true })}
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            {...register(field('bankruptcies'))}
          />
          Prior bankruptcy
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            {...register(field('collections'))}
          />
          Collections on file
        </label>
      </div>
    </div>
  );
}
