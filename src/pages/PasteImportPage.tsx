import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasteImportWorkspace } from '@/components/import/PasteImportWorkspace';

export function PasteImportPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('pasteImport.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pasteImport.subtitle')}</p>
        </div>

        <Link to="/decks">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span>{t('nav.decks')}</span>
          </Button>
        </Link>
      </div>

      <PasteImportWorkspace />
    </div>
  );
}
