import lightLogo from '../../assets/syncpack-logo-light.jpeg';
import darkLogo from '../../assets/syncpack-logo-dark.jpeg';
import { cn } from './ui/utils';

type BrandLogoProps = {
  variant?: 'light' | 'dark';
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({ variant = 'light', className, imageClassName }: BrandLogoProps) {
  const src = variant === 'dark' ? darkLogo : lightLogo;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-md bg-white',
        className,
      )}
      aria-label="SyncPack"
      role="img"
    >
      <img
        src={src}
        alt="SyncPack"
        className={cn(
          'relative mx-auto h-full w-auto max-w-full object-contain',
          imageClassName,
        )}
        draggable={false}
      />
    </div>
  );
}
