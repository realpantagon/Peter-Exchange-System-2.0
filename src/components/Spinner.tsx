// Shared loading spinner. Inherits color via `currentColor`, so set the text
// color on a wrapper (or pass className) to theme it.
export default function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            className={`animate-spin shrink-0 ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            role="status"
            aria-label="กำลังโหลด"
        >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}

// Centered spinner + optional label, for full-panel loading states.
export function LoadingBlock({ label = 'กำลังโหลด…', className = '', size = 24 }: { label?: string; className?: string; size?: number }) {
    return (
        <div className={`flex items-center justify-center gap-2 ${className}`} style={{ color: 'var(--vault-muted, #64748b)' }}>
            <Spinner size={size} />
            {label && <span className="text-sm font-medium">{label}</span>}
        </div>
    )
}
