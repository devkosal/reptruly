import { useEffect } from 'react'

/** Sets the browser tab title for the lifetime of the component. */
export default function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · reptruly` : 'reptruly'
  }, [title])
}
