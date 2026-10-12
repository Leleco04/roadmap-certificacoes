import type { CSSProperties } from 'react'
import { defaultTrackPresentation, trackPresentation } from '../catalog/data'

export function trackStyle(id: string): CSSProperties {
  const presentation = trackPresentation[id] ?? defaultTrackPresentation
  return { '--track-color': presentation.color, '--track-background': presentation.background } as CSSProperties
}
