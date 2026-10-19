// PROTOTYPE: throwaway variant switcher for UI prototypes. Never merge to main.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type PrototypeVariant = { key: string; name: string };

export function usePrototypeVariant(variants: PrototypeVariant[]) {
    const [searchParams] = useSearchParams();
    const key = searchParams.get('variant') ?? variants[0].key;
    return variants.find(v => v.key === key) ?? variants[0];
}

export default function PrototypeSwitcher({ variants }: { variants: PrototypeVariant[] }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const current = usePrototypeVariant(variants);
    const index = variants.indexOf(current);

    const go = (delta: number) => {
        const next = variants[(index + delta + variants.length) % variants.length];
        const params = new URLSearchParams(searchParams);
        params.set('variant', next.key);
        setSearchParams(params, { replace: true });
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'ArrowRight') go(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    if (process.env.NODE_ENV === 'production') return null;

    return <Box sx={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
        bgcolor: '#111', color: '#fff', borderRadius: 999, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        border: '2px dashed #ff0',
    }}>
        <IconButton size='small' sx={{ color: '#fff' }} onClick={() => go(-1)} aria-label='Previous variant'><ChevronLeftIcon /></IconButton>
        <Typography sx={{ fontFamily: 'monospace', minWidth: 220, textAlign: 'center' }}>
            PROTOTYPE {current.key} ({current.name})
        </Typography>
        <IconButton size='small' sx={{ color: '#fff' }} onClick={() => go(1)} aria-label='Next variant'><ChevronRightIcon /></IconButton>
    </Box>;
}
