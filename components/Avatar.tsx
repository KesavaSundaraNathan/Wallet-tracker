'use client';

import { useStore } from '@/lib/store';

/** Profile photo, or initials on an indigo gradient when there's none. */
export function Avatar({ size = 44, className = '' }: { size?: number; className?: string }) {
  const name = useStore((s) => s.profileName);
  const avatar = useStore((s) => s.avatar);
  const initials = (name.trim() || 'You').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt={name || 'Profile photo'} width={size} height={size}
      className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5b6cff] to-[#2a2ad6] font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials}
    </span>
  );
}

/** Read an image file, centre-crop to a square and downscale so it fits in localStorage. */
export async function fileToAvatar(file: File, px = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('That file isn’t an image we can read.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
    return c.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
