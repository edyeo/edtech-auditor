import { useEffect, useState } from 'react'
import { fetchVocabularyImage } from '@/lib/learner.api'

// Pictures are fetched once per session; the endpoint needs the bearer token, so they cannot be a plain <img src>.
const objectUrls = new Map<string, Promise<string>>()

function loadObjectUrl(imageId: string): Promise<string> {
  let url = objectUrls.get(imageId)
  if (!url) {
    url = fetchVocabularyImage(imageId).then((blob) => URL.createObjectURL(blob))
    objectUrls.set(imageId, url)
    url.catch(() => objectUrls.delete(imageId))
  }
  return url
}

type VocabularyImageProps = {
  imageId: string
  alt?: string
  className?: string
}

/** A picture saved with a note. */
export function VocabularyImage({ imageId, alt = '', className }: VocabularyImageProps) {
  const [loaded, setLoaded] = useState<{ imageId: string; url: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    loadObjectUrl(imageId)
      .then((url) => alive && setLoaded({ imageId, url }))
      .catch(() => alive && setLoaded({ imageId, url: null }))
    return () => {
      alive = false
    }
  }, [imageId])

  if (loaded?.imageId !== imageId) return <span className="text-xs text-muted-foreground">이미지 불러오는 중...</span>
  if (!loaded.url) return <span className="text-xs text-muted-foreground">[이미지를 불러오지 못했습니다]</span>
  return <img src={loaded.url} alt={alt} className={className} />
}
