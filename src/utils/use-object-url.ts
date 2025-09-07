import { useEffect, useState } from 'react'

export function useObjectUrl(file?: File) {
  const [url, setUrl] = useState<string>('')

  useEffect(() => {
    if (!file) {
      setUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}
