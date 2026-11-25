import { ok } from '@/lib/api/response';

// Public endpoint for Android APK in-app update checks
export async function GET() {
  return ok({
    versionName: '1.1.0',
    versionCode: 2,
    minSupportedVersionCode: 1,
    downloadUrl: 'https://github.com/balajipanchireddy-arch/playnex/releases/latest/download/PlayNex.apk',
    releaseNotes: 'Mobile UI redesign for narrow screens, optional ground/product images & descriptions, Admin System Management with selective deletion, 30-day notification cleanup.',
    mandatory: false,
    updateAvailable: true,
  });
}

