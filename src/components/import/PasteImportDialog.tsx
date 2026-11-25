import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { PasteImportWorkspace } from './PasteImportWorkspace';

interface PasteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDeckId?: string;
}

export function PasteImportDialog({ open, onOpenChange, defaultDeckId }: PasteImportDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('pasteImport.title')}
        description={t('pasteImport.subtitle')}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:w-[95vw] sm:max-w-5xl sm:rounded-2xl sm:p-6"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <PasteImportWorkspace
            defaultDeckId={defaultDeckId}
            onRequestClose={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
