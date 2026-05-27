'use client';
import React, { useState, useRef } from 'react';
import WineForm, { WineFormValues, WineFormHandle } from '@/components/WineForm';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Mic, RotateCcw } from 'lucide-react';

export default function Page() {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);
  const formRef = useRef<WineFormHandle>(null);

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
          <>
            <button
              type="button"
              onClick={() => setSimpleMode((value) => !value)}
              aria-pressed={simpleMode}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${simpleMode
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--primary)]'
                }`}
            >
              <Mic size={16} />
              <span>簡単記録</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            >
              <RotateCcw size={16} />
              <span>入力をクリア</span>
            </button>
          </>
        }
      />

      <WineForm
        ref={formRef}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        persistKey="wine-form-new"
        simpleMode={simpleMode}
      />

      {sent && (
        <p className={`text-sm ${sent.ok ? 'text-green-600' : 'text-red-600'} mt-4 px-4`}>
          {sent.ok ? '保存しました（ID: ' + sent.id + '）' : `保存に失敗しました: ${sent.error}`}
        </p>
      )}
    </ContentContainer>
  );
}
