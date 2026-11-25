import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-4xl font-bold">404</h1>
      <p className="mt-2 text-lg font-semibold">{t('notFound.title')}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('notFound.desc')}</p>
      <Link to="/" className="mt-6">
        <Button>{t('notFound.goHome')}</Button>
      </Link>
    </div>
  );
}
