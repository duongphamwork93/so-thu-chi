/**
 * Encodes recorded Float32 PCM chunks into a clean 16kHz mono 16-bit RIFF WAV Blob.
 * Using PCM WAV via Web Audio API avoids iOS Safari MediaRecorder fragmented MP4/WebM codec bugs.
 */
export interface EncodedWavResult {
  blob: Blob;
  durationSec: number;
  peakAmplitude: number;
}

function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (targetSampleRate >= inputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(buffer.length / sampleRateRatio));
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(
      buffer.length,
      Math.round((offsetResult + 1) * sampleRateRatio)
    );
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function encodeFloat32ChunksToWav(
  chunks: Float32Array[],
  inputSampleRate: number,
  targetSampleRate = 16000
): EncodedWavResult {
  let totalLength = 0;
  for (let i = 0; i < chunks.length; i++) {
    totalLength += chunks[i].length;
  }

  const merged = new Float32Array(totalLength);
  let offset = 0;
  let peakAmplitude = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    merged.set(chunk, offset);
    offset += chunk.length;
    for (let j = 0; j < chunk.length; j++) {
      const abs = Math.abs(chunk[j]);
      if (abs > peakAmplitude) peakAmplitude = abs;
    }
  }

  const durationSec = inputSampleRate > 0 ? totalLength / inputSampleRate : 0;
  const resampled = downsampleBuffer(merged, inputSampleRate || 44100, targetSampleRate);

  // Gentle auto-gain if speech is quiet (mobile mic held far away) without amplifying pure silence noise
  const gain = peakAmplitude > 0.008 && peakAmplitude < 0.35 ? Math.min(8, 0.7 / peakAmplitude) : 1;

  const dataLength = resampled.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let writeOffset = 44;
  for (let i = 0; i < resampled.length; i++) {
    const sample = Math.max(-1, Math.min(1, resampled[i] * gain));
    view.setInt16(writeOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    writeOffset += 2;
  }

  return {
    blob: new Blob([view], { type: 'audio/wav' }),
    durationSec,
    peakAmplitude,
  };
}
