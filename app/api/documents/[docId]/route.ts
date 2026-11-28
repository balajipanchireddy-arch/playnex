import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySession } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/admin';
import { findUserStoreDoc } from '@/lib/stores/resolve';

/**
 * Private Document Vault Access Endpoint
 * Serves uploaded identity/rental proofs ONLY to the document owner,
 * an authorized store owner (for rental proofs), or a platform admin.
 * Public access is strictly denied and responses are never cached.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const docId = params.docId;
  if (!docId) {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid', message: 'Document ID required' } },
      { status: 400 }
    );
  }

  try {
    const docSnap = await adminDb.collection('privateVerificationDocs').doc(docId).get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { ok: false, error: { code: 'not_found', message: 'Document not found' } },
        { status: 404 }
      );
    }

    const doc = docSnap.data()!;
    const callerIsAdmin = await isAdmin(session.uid);
    const isOwner = doc.ownerId === session.uid;
    let isAuthorizedStore = false;

    if (!callerIsAdmin && !isOwner && doc.purpose === 'rental_proof') {
      if (doc.storeOwnerId === session.uid) {
        isAuthorizedStore = true;
      } else {
        const callerStore = await findUserStoreDoc(session.uid);
        if (
          callerStore &&
          (doc.storeId === callerStore.id || doc.storeOwnerId === callerStore.id)
        ) {
          isAuthorizedStore = true;
        }
      }
    }

    if (!callerIsAdmin && !isOwner && !isAuthorizedStore) {
      return NextResponse.json(
        { ok: false, error: { code: 'forbidden', message: 'You are not authorized to view this private document' } },
        { status: 403 }
      );
    }

    const buffer = Buffer.from(doc.base64Data || '', 'base64');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${doc.fileName || 'proof'}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { code: 'server_error', message: e?.message || 'Failed to read private document' } },
      { status: 500 }
    );
  }
}
