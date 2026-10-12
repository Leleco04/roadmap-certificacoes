import { defaultTrackPresentation, trackPresentation } from '../catalog/data'
import type { Track } from '../domain/models'
import { trackStyle } from '../utilities/presentation'

export function TrackBadge({ track }: { track: Track }) {
  return <span className="track-badge" style={trackStyle(track.id)}><span aria-hidden="true">{(trackPresentation[track.id] ?? defaultTrackPresentation).symbol}</span>{track.name}</span>
}
