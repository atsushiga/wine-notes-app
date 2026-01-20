'use client';
import React, { useState } from 'react';
import WineForm, { WineFormValues } from '@/components/WineForm';

export default function Page() {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <main className="min-h-dvh bg-transparent text-[var(--fg)] transition-colors duration-500 pb-40">
      <h1 className="text-2xl font-semibold mb-4">ワイン・テイスティング記録</h1>

      <WineForm onSubmit={onSubmit} isSubmitting={isSubmitting} persistKey="wine-form-new" />

      {sent && (
        <p className={`text-sm ${sent.ok ? 'text-green-600' : 'text-red-600'} mt-4 px-4`}>
          {sent.ok ? '保存しました（ID: ' + sent.id + '）' : `保存に失敗しました: ${sent.error}`}
        </p>
      )}
    </main>
  );
}
