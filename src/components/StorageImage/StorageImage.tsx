import { ImgHTMLAttributes } from 'preact/compat';
import { Image, ImageProps } from '@mantine/core';
import { useStorageUrl } from '../../hooks/useStorageUrl';

interface StorageImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
}

export function StorageImage({ src, ...props }: StorageImageProps) {
  const resolvedSrc = useStorageUrl(src);

  if (!resolvedSrc) {
    return null;
  }

  return <img src={resolvedSrc} {...props} />;
}

interface MantineStorageImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null;
}

export function MantineStorageImage({ src, ...props }: MantineStorageImageProps) {
  const resolvedSrc = useStorageUrl(src);

  if (!resolvedSrc) {
    return null;
  }

  return <Image src={resolvedSrc} {...props} />;
}
