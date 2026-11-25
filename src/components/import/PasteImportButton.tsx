import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardPaste } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { PasteImportDialog } from './PasteImportDialog';

interface PasteImportButtonProps {
  defaultDeckId?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

export function PasteImportButton({
  defaultDeckId,
  variant = 'outline',
  size = 'md',
}: PasteImportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <ClipboardPaste className="h-4 w-4" />
        <span>{t('pasteImport.entryButton')}</span>
      </Button>
      <PasteImportDialog open={open} onOpenChange={setOpen} defaultDeckId={defaultDeckId} />
    </>
  );
}
