'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import WineForm, { WineFormValues, WineFormHandle } from '@/components/WineForm';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { RotateCcw, Sparkles } from 'lucide-react';
import { consumeRecordDraftFromVisualExplanation } from '@/lib/aiExplainerStorage';

export default function Page() {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<WineFormValues> | undefined>();
  const [hasLoadedInitialValues, setHasLoadedInitialValues] = useState(false);
  const formRef = useRef<WineFormHandle>(null);

  useEffect(() => {
    const aiDraft = consumeRecordDraftFromVisualExplanation();
    if (aiDraft) {
      setInitialValues(aiDraft);
    }
    setHasLoadedInitialValues(true);
  }, []);

  const onSubmit = async (values: WineFormValues) => {
    setSent(null);
    setIsSubmitting(true);

    const payload = {
      ...values,
      price:
        values.price !== '' && values.price != null
          ? Number(values.price)
          : null,
    };

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      setSent(json);
    } catch (err) {
      console.error('Submit error:', err);
      setSent({ ok: false, error: String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    formRef.current?.clear();
  };

  return (
    <ContentContainer size="form" className="pb-40">
      <PageHeader
        title="テイスティング記録"
        subtitle="感性を言葉にして、記憶に残す"
        accentColor="var(--accent)"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/ai-explainer"
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
            >
              <Sparkles size={16} />
              <span>AI解説へ</span>
            </Link>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            >
              <RotateCcw size={16} />
              <span>入力をクリア</span>
            </button>
          </div>
        }
      />

      {hasLoadedInitialValues && (
        <WineForm
          key={initialValues ? 'ai-explainer-draft' : 'new-record'}
          ref={formRef}
          defaultValues={initialValues}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          persistKey="wine-form-new"
        />
      )}

      {sent && (
        <p className={`text-sm ${sent.ok ? 'text-green-600' : 'text-red-600'} mt-4 px-4`}>
          {sent.ok ? '保存しました（ID: ' + sent.id + '）' : `保存に失敗しました: ${sent.error}`}
        </p>
      )}
    </ContentContainer>
  );
}
