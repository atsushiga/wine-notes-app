'use client';

import React, { useRef, useState } from 'react';
import WineForm, { WineFormHandle, WineFormValues } from '@/components/WineForm';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Mic, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type InputMode = 'simple' | 'detailed';

interface WineEntryClientProps {
  defaultInputMode: InputMode;
}

export default function WineEntryClient({ defaultInputMode }: WineEntryClientProps) {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simpleMode, setSimpleMode] = useState(defaultInputMode !== 'detailed');
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

  const modeButtonClass = (active: boolean) => (
    `inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:flex-none ${active
      ? 'bg-[var(--text)] text-[var(--card-bg)] shadow-sm'
      : 'text-[var(--text-muted)] hover:bg-[var(--card-bg)] hover:text-[var(--text)]'
    }`
  );

  return (
    <ContentContainer size="form" className="pb-40">
      <PageHeader
        title="テイスティング記録"
        subtitle="感性を言葉にして、記憶に残す"
        accentColor="var(--accent)"
        actions={
          <>
            <div className="inline-flex w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-sm sm:w-auto">
              <button
                type="button"
                onClick={() => setSimpleMode(true)}
                aria-pressed={simpleMode}
                className={modeButtonClass(simpleMode)}
              >
                <Mic size={16} />
                <span>簡単記録</span>
              </button>
              <button
                type="button"
                onClick={() => setSimpleMode(false)}
                aria-pressed={!simpleMode}
                className={modeButtonClass(!simpleMode)}
              >
                <SlidersHorizontal size={16} />
                <span>こだわり入力</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="ml-auto inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
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
