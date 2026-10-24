/**
 * Shrinks a form-check video on the client's phone before it is uploaded.
 *
 * Phones film at 15 Mbit/s or more (an iPhone's "Most Compatible" 1080p is
 * about 14), and the coach in Bali receives at about 8: the video arrived
 * slower than it played, so it froze or never started. 720p at 2.5 Mbit/s
 * is plenty to judge a position, plays at once, and uploads several times
 * faster for the client too.
 *
 * Everything runs on the device with its own video encoder (WebCodecs), so
 * there is no server and nothing to pay. Anything that goes wrong (an old
 * phone without the encoder, an odd file) returns the original untouched:
 * a slow video still beats no video.
 */

const LONG_SIDE = 1280; // 720p
const VIDEO_BITRATE = 2_500_000;
/** Below this, the file is already light enough to stream as it is. */
const KEEP_UNDER_BITRATE = 4_000_000;
/** No progress for this long: the encoder is stuck, send the original. */
const STALL_MS = 10_000;
/** Total time allowed: twice the clip's length, and at least this. */
const MIN_BUDGET_MS = 30_000;

export type PreparedVideo = { file: Blob; ext: string; compressed: boolean };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function compressVideo(
  original: File,
  onProgress?: (fraction: number) => void
): Promise<PreparedVideo> {
  const keep: PreparedVideo = {
    file: original,
    ext: original.name.split(".").pop() || "mp4",
    compressed: false,
  };
  if (typeof VideoEncoder === "undefined") return keep;

  try {
    // Loaded only when a video is actually sent: it weighs about 150 KB,
    // which the workout page would otherwise download on every open.
    const {
      ALL_FORMATS,
      BlobSource,
      BufferTarget,
      Conversion,
      Input,
      Mp4OutputFormat,
      Output,
      canEncodeVideo,
    } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(original), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return keep;
    const duration = await input.computeDuration();
    const w = track.displayWidth;
    const h = track.displayHeight;
    const bitrate = duration > 0 ? (original.size * 8) / duration : Infinity;
    if (bitrate <= KEEP_UNDER_BITRATE && Math.max(w, h) <= LONG_SIDE) return keep;

    const scale = Math.min(1, LONG_SIDE / Math.max(w, h));
    const width = even(w * scale);
    const height = even(h * scale);
    if (!(await canEncodeVideo("avc", { width, height, bitrate: VIDEO_BITRATE }))) {
      return keep;
    }
    const stats = await track.computePacketStats(120);

    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    const conversion = await Conversion.init({
      input,
      output,
      // Phones add extra tracks (spatial audio, metadata) that a browser
      // cannot decode; the main picture and sound are all a coach needs.
      tracks: "primary",
      video: {
        codec: "avc",
        width,
        height,
        // Same aspect ratio as the source, so nothing is cropped or stretched.
        fit: "contain",
        bitrate: VIDEO_BITRATE,
        // 60 fps doubles the size for nothing a coach can see.
        ...(stats.averagePacketRate > 31 ? { frameRate: 30 } : {}),
      },
      audio: { codec: "aac" },
    });
    if (!conversion.isValid) return keep;

    // A phone whose encoder stalls must not leave the client staring at
    // "Preparing video… 1%": give up and send the original instead. Some
    // encoders (the iOS simulator's, at least) accept frames and never
    // finish, and then even cancel() never returns, so the conversion is
    // raced against the watchdog rather than awaited.
    let lastMove = Date.now();
    const started = Date.now();
    conversion.onProgress = (p) => {
      lastMove = Date.now();
      onProgress?.(p);
    };
    let watchdog: ReturnType<typeof setInterval> | undefined;
    const gaveUp = new Promise<false>((resolve) => {
      watchdog = setInterval(() => {
        const now = Date.now();
        if (now - lastMove > STALL_MS || now - started > Math.max(MIN_BUDGET_MS, duration * 2000)) {
          void conversion.cancel().catch(() => {});
          resolve(false);
        }
      }, 1000);
    });
    const finished = conversion.execute().then(
      () => true as const,
      () => false as const
    );
    const ok = await Promise.race([finished, gaveUp]);
    clearInterval(watchdog);
    if (!ok) return keep;

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength >= original.size * 0.9) return keep;
    const file = new Blob([buffer], { type: "video/mp4" });

    // A file that shrank but lost its length is worse than a slow one.
    const check = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    if (Math.abs((await check.computeDuration()) - duration) > 1) return keep;

    return { file, ext: "mp4", compressed: true };
  } catch (e) {
    console.warn("Video compression skipped:", e);
    return keep;
  }
}
