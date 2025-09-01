import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function WorkspaceLayout({ children }: Props) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}


