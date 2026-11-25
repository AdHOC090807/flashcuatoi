import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, Layers, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { updateSettings } from '@/db/actions';
import { useAppStore } from '@/store/useAppStore';

export function OnboardingTourModal() {
  const { t } = useTranslation();
  const { tourOpen, setTourOpen } = useAppStore();
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Sparkles,
      title: t('onboarding.step1Title'),
      desc: t('onboarding.step1Desc'),
      color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    },
    {
      icon: BrainCircuit,
      title: t('onboarding.step2Title'),
      desc: t('onboarding.step2Desc'),
      color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Layers,
      title: t('onboarding.step3Title'),
      desc: t('onboarding.step3Desc'),
      color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  const finish = async () => {
    await updateSettings({ onboardingCompleted: true });
    setTourOpen(false);
    setStep(0);
  };

  return (
    <Dialog
      open={tourOpen}
      onOpenChange={async (open) => {
        if (!open) await finish();
      }}
    >
      <DialogContent className="max-w-md text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${current.color}`}
        >
          <Icon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold">{current.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{current.desc}</p>

        <div className="mt-5 flex justify-center gap-1.5">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === step ? 'w-6 bg-primary' : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={finish}>
            {t('common.skip')}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                {t('common.previous')}
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>{t('common.next')}</Button>
            ) : (
              <Button onClick={finish}>{t('onboarding.getStarted')}</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
