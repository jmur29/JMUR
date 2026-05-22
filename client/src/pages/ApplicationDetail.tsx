import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User,
  Home,
  DollarSign,
  FileText,
  BarChart2,
  CheckSquare,
  Files,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { useApplication } from '../hooks/useApplication';
import Tabs from '../components/ui/Tabs';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { formatDate } from '../lib/utils';

import BorrowerTab from '../components/application/BorrowerTab';
import IncomeTab from '../components/application/IncomeTab';
import PropertyTab from '../components/application/PropertyTab';
import TermsTab from '../components/application/TermsTab';
import DocumentsTab from '../components/application/DocumentsTab';
import RatiosTab from '../components/application/RatiosTab';
import DecisionTab from '../components/application/DecisionTab';

const TABS = [
  { id: 'borrower', label: 'Borrower', icon: <User size={15} /> },
  { id: 'income', label: 'Income', icon: <DollarSign size={15} /> },
  { id: 'property', label: 'Property', icon: <Home size={15} /> },
  { id: 'terms', label: 'Terms', icon: <FileText size={15} /> },
  { id: 'documents', label: 'Documents', icon: <Files size={15} /> },
  { id: 'ratios', label: 'Ratios', icon: <BarChart2 size={15} /> },
  { id: 'decision', label: 'Decision', icon: <CheckSquare size={15} /> },
];

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('borrower');
  const { data: application, isLoading, error } = useApplication(id ?? '');

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="text-center py-24">
        <p className="text-red-600 font-medium">Failed to load application.</p>
        <Link to="/applications" className="mt-3 inline-block text-sm text-blue-600 underline">
          Back to list
        </Link>
      </div>
    );
  }

  const primary = application.borrowers.find((b) => b.type === 'PRIMARY');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/applications">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={15} />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">
                {application.fileNumber}
              </h1>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {primary
                ? `${primary.firstName} ${primary.lastName}`
                : 'No borrower added yet'}{' '}
              · Created {formatDate(application.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/applications/${id}/report`}>
            <Button size="sm" variant="secondary" leftIcon={<Printer size={14} />}>
              Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            badge:
              t.id === 'documents' && application.documents.length > 0
                ? application.documents.length
                : undefined,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="px-4"
        />

        <div className="p-6">
          {activeTab === 'borrower' && (
            <BorrowerTab application={application} />
          )}
          {activeTab === 'income' && (
            <IncomeTab application={application} />
          )}
          {activeTab === 'property' && (
            <PropertyTab application={application} />
          )}
          {activeTab === 'terms' && (
            <TermsTab application={application} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab application={application} />
          )}
          {activeTab === 'ratios' && (
            <RatiosTab application={application} />
          )}
          {activeTab === 'decision' && (
            <DecisionTab application={application} />
          )}
        </div>
      </div>
    </div>
  );
}
