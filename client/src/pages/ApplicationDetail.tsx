import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  User, Home, DollarSign, FileText,
  BarChart2, CheckSquare, Files, ArrowLeft,
  Printer, Sparkles, Brain, ChevronRight,
} from 'lucide-react';
import { useApplication } from '../hooks/useApplication';
import Tabs from '../components/ui/Tabs';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, cn } from '../lib/utils';
import BorrowerTab from '../components/application/BorrowerTab';
import IncomeTab from '../components/application/IncomeTab';
import PropertyTab from '../components/application/PropertyTab';
import TermsTab from '../components/application/TermsTab';
import DocumentsTab from '../components/application/DocumentsTab';
import RatiosTab from '../components/application/RatiosTab';
import DecisionTab from '../components/application/DecisionTab';
import AIAnalysisTab from '../components/application/AIAnalysisTab';

const TABS = [
  { id: 'ai', label: 'AI Analysis', icon: <Sparkles size={15} /> },
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
  const [activeTab, setActiveTab] = useState('ai');
  const { data: application, isLoading, error } = useApplication(id ?? '');

  if (!id) return null;

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  }

  if (error || !application) {
    return (
      <div className="text-center py-24">
        <p className="text-[#991B1B] font-medium text-sm">Failed to load application.</p>
        <Link to="/applications" className="mt-3 inline-flex items-center gap-1 text-sm text-[#1B4332]">
          <ArrowLeft size={13} /> Back to files
        </Link>
      </div>
    );
  }

  const primary = application.borrowers.find((b) => b.type === 'PRIMARY');

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#6B6860]">
        <Link to="/applications" className="hover:text-[#1B4332] transition-colors">Files</Link>
        <ChevronRight size={14} />
        <span className="font-mono text-[#1A1916]">{application.fileNumber}</span>
      </div>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center text-[#1B4332] flex-shrink-0">
              <User size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold font-mono text-[#1A1916]">{application.fileNumber}</h1>
                <StatusBadge status={application.status} />
              </div>
              <p className="text-sm text-[#6B6860] mt-0.5">
                {primary ? `${primary.firstName} ${primary.lastName}` : 'No borrower yet'}
                {' · '}Created {formatDate(application.createdAt)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to={`/applications/${id}/intelligence`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                'border-[#1B4332] text-[#1B4332] hover:bg-[#D1FAE5]'
              )}
            >
              <Brain size={13} />
              Deal Intel
            </Link>
            <Link
              to={`/applications/${id}/review`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                'border-[#E8E6E1] text-[#1A1916] hover:border-[#1B4332] hover:text-[#1B4332]'
              )}
            >
              <BarChart2 size={13} />
              UW Review
            </Link>
            <Link
              to={`/applications/${id}/report`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                'border-[#E8E6E1] text-[#1A1916] hover:border-[#1B4332] hover:text-[#1B4332]'
              )}
            >
              <Printer size={13} />
              Report
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div className="card overflow-hidden">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            badge: t.id === 'documents' && application.documents.length > 0
              ? application.documents.length : undefined,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="px-4"
        />
        <div className="p-6">
          {activeTab === 'ai' && <AIAnalysisTab application={application} />}
          {activeTab === 'borrower' && <BorrowerTab application={application} />}
          {activeTab === 'income' && <IncomeTab application={application} />}
          {activeTab === 'property' && <PropertyTab application={application} />}
          {activeTab === 'terms' && <TermsTab application={application} />}
          {activeTab === 'documents' && <DocumentsTab application={application} />}
          {activeTab === 'ratios' && <RatiosTab application={application} />}
          {activeTab === 'decision' && <DecisionTab application={application} />}
        </div>
      </div>
    </div>
  );
}
