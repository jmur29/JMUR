import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Brain,
  CreditCard,
  ShieldAlert,
  Landmark,
  ScrollText,
  ClipboardList,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useApplication } from '../hooks/useApplication';
import { usePermissions } from '../hooks/usePermissions';
import { pipelineApi } from '../lib/api';
import Tabs from '../components/ui/Tabs';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Breadcrumb from '../components/ui/Breadcrumb';
import ProcessingPipeline from '../components/ui/ProcessingPipeline';
import { formatDate } from '../lib/utils';

import BorrowerTab from '../components/application/BorrowerTab';
import IncomeTab from '../components/application/IncomeTab';
import PropertyTab from '../components/application/PropertyTab';
import TermsTab from '../components/application/TermsTab';
import DocumentsTab from '../components/application/DocumentsTab';
import RatiosTab from '../components/application/RatiosTab';
import DecisionTab from '../components/application/DecisionTab';
import NotesTimeline from '../components/application/NotesTimeline';
import AssignmentSelector from '../components/application/AssignmentSelector';
import ClassifiedDocumentsTab from '../components/application/ClassifiedDocumentsTab';
import DownPaymentTab from '../components/application/DownPaymentTab';
import FraudSignalsTab from '../components/application/FraudSignalsTab';
import CreditMemoTab from '../components/application/CreditMemoTab';
import SubmissionNotesTab from '../components/application/SubmissionNotesTab';
import AiAuditTab from '../components/application/AiAuditTab';

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('borrower');
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const { data: application, isLoading, error } = useApplication(id ?? '');
  const { role, isUnderwriter } = usePermissions();
  const queryClient = useQueryClient();

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
  const isBroker = role === 'BROKER';

  const baseTabs = [
    { id: 'borrower', label: 'Borrower', icon: <User size={15} /> },
    { id: 'income', label: 'Income', icon: <DollarSign size={15} /> },
    { id: 'property', label: 'Property', icon: <Home size={15} /> },
    { id: 'terms', label: 'Terms', icon: <FileText size={15} /> },
    { id: 'documents', label: 'Documents', icon: <Files size={15} />, badge: application.documents.length > 0 ? application.documents.length : undefined },
    { id: 'ratios', label: 'Ratios', icon: <BarChart2 size={15} /> },
    { id: 'decision', label: 'Decision', icon: <CheckSquare size={15} /> },
    { id: 'classified-documents', label: 'AI Docs', icon: <Brain size={15} /> },
    { id: 'down-payment', label: 'Down Payment', icon: <Landmark size={15} /> },
    { id: 'fraud-signals', label: 'Fraud Signals', icon: <ShieldAlert size={15} /> },
    { id: 'credit-memo', label: 'Credit Memo', icon: <CreditCard size={15} /> },
    { id: 'ai-audit', label: 'AI Audit', icon: <ClipboardList size={15} /> },
  ];

  const tabs = isBroker
    ? [...baseTabs, { id: 'submission-notes', label: 'Submission Notes', icon: <ScrollText size={15} /> }]
    : baseTabs;

  const handleRunAiReview = async () => {
    try {
      await pipelineApi.start(id);
      setPipelineModalOpen(true);
    } catch {
      toast.error('Failed to start AI Review');
    }
  };

  const handlePipelineComplete = () => {
    setPipelineModalOpen(false);
    toast.success('AI Review complete');
    void queryClient.invalidateQueries({ queryKey: ['classified-documents', id] });
    void queryClient.invalidateQueries({ queryKey: ['down-payment', id] });
    void queryClient.invalidateQueries({ queryKey: ['fraud-signals', id] });
    void queryClient.invalidateQueries({ queryKey: ['credit-memo', id] });
    void queryClient.invalidateQueries({ queryKey: ['pipeline-status', id] });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Applications', href: '/applications' },
          { label: application.fileNumber },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/applications">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={15} />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">
                {application.fileNumber}
              </h1>
              <StatusBadge status={application.status} />
              <AssignmentSelector
                applicationId={application.id}
                assignedTo={application.assignedTo ?? null}
                currentRole={role}
              />
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
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Play size={14} />}
            onClick={() => void handleRunAiReview()}
          >
            Run AI Review
          </Button>
          <Link to={`/applications/${id}/report`}>
            <Button size="sm" variant="secondary" leftIcon={<Printer size={14} />}>
              Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Processing Pipeline Modal */}
      <Modal
        isOpen={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
        title="AI Review in Progress"
        size="md"
      >
        <ProcessingPipeline applicationId={id} onComplete={handlePipelineComplete} />
      </Modal>

      {/* Main content + Notes sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Tabs — takes 2/3 on desktop */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="px-4"
          />

          <div className="p-6">
            {activeTab === 'borrower' && <BorrowerTab application={application} />}
            {activeTab === 'income' && <IncomeTab application={application} />}
            {activeTab === 'property' && <PropertyTab application={application} />}
            {activeTab === 'terms' && <TermsTab application={application} />}
            {activeTab === 'documents' && <DocumentsTab application={application} />}
            {activeTab === 'ratios' && <RatiosTab application={application} />}
            {activeTab === 'decision' && <DecisionTab application={application} />}
            {activeTab === 'classified-documents' && (
              <ClassifiedDocumentsTab applicationId={application.id} />
            )}
            {activeTab === 'down-payment' && (
              <DownPaymentTab applicationId={application.id} />
            )}
            {activeTab === 'fraud-signals' && (
              <FraudSignalsTab applicationId={application.id} isUnderwriter={isUnderwriter} />
            )}
            {activeTab === 'credit-memo' && (
              <CreditMemoTab applicationId={application.id} />
            )}
            {activeTab === 'ai-audit' && (
              <AiAuditTab applicationId={application.id} />
            )}
            {activeTab === 'submission-notes' && isBroker && (
              <SubmissionNotesTab applicationId={application.id} />
            )}
          </div>
        </div>

        {/* Notes sidebar — 1/3 on desktop */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <NotesTimeline applicationId={application.id} />
        </div>
      </div>
    </div>
  );
}
