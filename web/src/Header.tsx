type HeaderProps = {
    title: string
    subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
    return (
        <header>
            <h1>{title}</h1>
            {subtitle && <h2>{subtitle}</h2>}
        </header>
    )
}