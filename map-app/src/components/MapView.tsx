import { DocumentId } from '@automerge/automerge-repo';
import { useRepo } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue } from 'narrative-ui';
import { useMapDocument } from '../hooks/useMapDocument';
import type { MapDoc } from '../schema/map-data';
import { MapContent } from './MapContent';

interface MapViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
}

/**
 * Main map view component (standalone app shell)
 * Uses MapContent for the actual map rendering
 */
export function MapView({
  documentId,
  currentUserDid,
  privateKey,
  publicKey,
  displayName,
  onResetIdentity,
  onNewDocument,
}: MapViewProps) {
  const repo = useRepo();
  const docHandle = repo.find<MapDoc>(documentId);
  const mapData = useMapDocument(
    documentId,
    docHandle,
    currentUserDid,
    privateKey,
    publicKey,
    displayName
  );

  const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;

  return (
    <AppLayout
      doc={mapData?.doc}
      docHandle={docHandle}
      documentId={documentId.toString()}
      currentUserDid={currentUserDid}
      appTitle="Narrative Map"
      workspaceName="Map"
      hideWorkspaceSwitcher={false}
      logoUrl={logoUrl}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={mapData?.updateIdentity}
    >
      {(ctx: AppContextValue) => (
        <div className="flex-1 relative overflow-hidden">
          {mapData && (
            <MapContent
              currentUserDid={currentUserDid}
              locations={mapData.locations}
              identities={mapData.doc.identities}
              hiddenUserDids={ctx.hiddenUserDids}
              onSetLocation={mapData.setMyLocation}
              onRemoveLocation={mapData.removeMyLocation}
              getMyLocation={mapData.getMyLocation}
              doc={mapData.doc}
            />
          )}
        </div>
      )}
    </AppLayout>
  );
}
