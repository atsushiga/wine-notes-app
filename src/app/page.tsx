'use client';
import React, { useState, useRef } from 'react';
import WineForm, { WineFormValues, WineFormHandle } from '@/components/WineForm';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { RotateCcw } from 'lucide-react';

export default function Page() {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWineType, setCurrentWineType] = useState('赤');
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
          <button
            onClick={handleClear}
            className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          >
            <RotateCcw size={16} />
            <span>入力をクリア</span>
          </button>
        }
      />

      <WineForm
        ref={formRef}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        persistKey="wine-form-new"
        onWineTypeChange={setCurrentWineType}
      />

      {sent && (
        <p className={`text-sm ${sent.ok ? 'text-green-600' : 'text-red-600'} mt-4 px-4`}>
          {sent.ok ? '保存しました（ID: ' + sent.id + '）' : `保存に失敗しました: ${sent.error}`}
        </p>
      )}
    </ContentContainer>
  );
}
