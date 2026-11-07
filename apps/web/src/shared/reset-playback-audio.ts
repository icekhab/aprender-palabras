import { resetFeedbackAudioGraph } from './feedback-sound'
import { resetSpeechAudioGraph } from './speech'

/** Recreate Web Audio graphs after leaving mic/SpeechRecognition on iOS. */
export function resetPlaybackAudioGraph(): void {
  resetSpeechAudioGraph()
  resetFeedbackAudioGraph()
}
