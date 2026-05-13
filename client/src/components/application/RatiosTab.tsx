import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { useCalculate } from '../../hooks/useApplication';
import type { Application, UWResult } from '../../types';
import RatioGauge from '../ui/RatioGauge';
import FlagBadge from '../ui/FlagBadge';
import Button from '../ui/Button';
import { formatCurrency, formatPercent, getDecisionColor, getDecisionLabel } from '../../lib/utils';
import { cn } from '../../lib/utils';


interface RatiosTabProps {
  application: Application;
}

export default function RatiosTab({ application }: RatiosTabProps) {
  const [result, setResult] = useState<UWResult | null>(null);
  const calculateMutation = useCalculate(application.id);

  const handleCalculate = () => {
    calculateMutation.mutate(undefined, {
      onSuccess: (data) => setResult(data),
    });
  };

  const display = result;

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Underwriting Ratios
        </h3>
        <Button
          leftIcon={<Calculator size={15} />}
          loading={calculateMutation.isPending}
          onClick={handleCalculate}
        >
          Run Calculation
        </Button>
      </div>

      {!display && !calculateMutation.isPending && (
        <div className="text-center py-16 text-slate-400">
          <Calculator size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Click "Run Calculation" to analyze this application.</p>
        </div>
      )}

      {display && (
        <>
          {/* Decision badge */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold',
                getDecisionColor(display.decision)
              )}
            >
              {getDecisionLabel(display.decision)}
            </span>
            <span className="text-sm text-slate-500">
              Stress rate: {formatPercent(display.stressRate)}
            </span>
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
              <RatioGauge
                value={display.gds}
                threshold={32}
                label="GDS"
                format={(v) => `${v.toFixed(1)}%`}
              />
              <p className="text-xs text-slate-400 mt-1">
                Stress: {formatPercent(display.stressGds)}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <RatioGauge
                value={display.tds}
                threshold={44}
                label="TDS"
                format={(v) => `${v.toFixed(1)}%`}
              />
              <p className="text-xs text-slate-400 mt-1">
                Stress: {formatPercent(display.stressTds)}
              </p>
            </div>
            <div className="flex flex-col items-center">
              <RatioGauge
                value={display.ltv}
                threshold={80}
                label="LTV"
                format={(v) => `${v.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Monthly Income</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(display.monthlyIncome)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Mortgage Amount</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(display.mortgageAmount)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Monthly Payment</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(display.monthlyPayment)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-xs text-amber-600 mb-1">Stress Payment</p>
              <p className="text-sm font-semibold text-amber-800">
                {formatCurrency(display.stressPayment)}
              </p>
            </div>
          </div>

          {/* Stress test panel */}
          <div className="bg-slate-50 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Stress Test Results</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1">Stress Rate</p>
                <p className="font-semibold">{formatPercent(display.stressRate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Stress GDS</p>
                <p
                  className={cn(
                    'font-semibold',
                    display.stressGds > 32 ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {formatPercent(display.stressGds)}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ 32%</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Stress TDS</p>
                <p
                  className={cn(
                    'font-semibold',
                    display.stressTds > 44 ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {formatPercent(display.stressTds)}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ 44%</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Stress Payment</p>
                <p className="font-semibold text-amber-700">
                  {formatCurrency(display.stressPayment)}
                </p>
              </div>
            </div>
          </div>

          {/* Qualifying income breakdown */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Qualifying Income Breakdown</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">
                      Source
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">
                      Annual
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">
                      Monthly
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { label: 'Base Salary', value: display.qualifyingIncome.baseSalary },
                    { label: 'Bonus (50%)', value: display.qualifyingIncome.bonus },
                    { label: 'Overtime (50%)', value: display.qualifyingIncome.overtime },
                    { label: 'Other Income', value: display.qualifyingIncome.otherIncome },
                    { label: 'Self-Employed', value: display.qualifyingIncome.selfEmployed },
                    { label: 'Rental Income', value: display.qualifyingIncome.rental },
                    { label: 'Co-Applicant', value: display.qualifyingIncome.coApplicant },
                  ]
                    .filter((row) => row.value > 0)
                    .map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
                        <td className="px-4 py-2.5 text-right text-slate-900">
                          {formatCurrency(row.value)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">
                          {formatCurrency(row.value / 12)}
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5 text-slate-900">Total Qualifying</td>
                    <td className="px-4 py-2.5 text-right text-slate-900">
                      {formatCurrency(display.qualifyingIncome.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-900">
                      {formatCurrency(display.qualifyingIncome.total / 12)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Flags */}
          {display.flags.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">
                Underwriting Flags ({display.flags.length})
              </h4>
              <div className="space-y-2">
                {display.flags.map((flag, i) => (
                  <FlagBadge
                    key={i}
                    type={flag.type}
                    message={flag.message}
                    field={flag.field}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
