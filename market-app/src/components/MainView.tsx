import type { DocHandle, AutomergeUrl, DocumentId } from '@automerge/automerge-repo';
import { useDocument } from '@automerge/automerge-repo-react-hooks';
import { AppLayout, type AppContextValue, type UserDocument, type WorkspaceLoadingState, type ContentState } from 'narrative-ui';
import { useMarket } from '../hooks/useMarket';
import type { ListingType, CategoryId } from '../schema';
import { MarketModule } from '../modules/MarketModule';
// Debug extensions are auto-initialized via main.tsx import
import '../debug';

interface MainViewProps {
  documentId: DocumentId | null;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: (name?: string, avatarDataUrl?: string) => void;
  // User Document (from AppShell when enableUserDocument is true)
  userDocId?: string;
  userDocHandle?: DocHandle<UserDocument>;
  // Workspace loading state (from AppShell when document is still loading)
  workspaceLoading?: WorkspaceLoadingState;
  // Debug Dashboard toggle (from AppShell)
  onToggleDebugDashboard: () => void;
  // Content state from AppShell
  contentState: ContentState;
  // Callbacks for content state transitions
  onJoinWorkspace: (docUrl: string) => void;
  onCancelLoading: () => void;
  // Callback to go to start screen (from workspace switcher)
  onGoToStart?: () => void;
  // Callback to switch workspace without page reload
  onSwitchWorkspace?: (workspaceId: string) => void;
}

export function MainView({
  documentId,
  currentUserDid,
  displayName,
  onResetIdentity,
  onNewDocument,
  userDocId,
  userDocHandle,
  workspaceLoading,
  onToggleDebugDashboard,
  contentState,
  onJoinWorkspace,
  onCancelLoading,
  onGoToStart,
  onSwitchWorkspace,
}: MainViewProps) {
  // Load UserDocument for trust/verification features
  const [userDoc] = useDocument<UserDocument>(userDocId as AutomergeUrl | undefined);

  // Hook now handles docHandle internally using useDocHandle
  const {
    doc,
    docHandle,
    isLoading,
    listings,
    createListing,
    setListingStatus,
    addReaction,
    removeReaction,
    getReactionCount,
    hasUserReacted,
    getReactionsForListing,
    updateIdentity,
  } = useMarket(documentId);

  const handleCreateListing = (data: {
    type: ListingType;
    title: string;
    description: string;
    categoryId: CategoryId;
    location?: string;
  }) => {
    createListing(data, currentUserDid);
  };

  const handleReact = (listingId: string) => {
    addReaction(listingId, currentUserDid);
  };

  const handleRemoveReaction = (listingId: string) => {
    const reactions = getReactionsForListing(listingId);
    const myReaction = reactions.find(r => r.reactorDid === currentUserDid);
    if (myReaction) {
      removeReaction(myReaction.id, listingId);
    }
  };

  // Only show loading spinner when actually loading a document (not in start state)
  if (isLoading && contentState === 'ready') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <AppLayout
      doc={doc}
      docHandle={docHandle}
      documentId={documentId?.toString() ?? ''}
      currentUserDid={currentUserDid}
      appTitle="Marktplatz"
      workspaceName="Marktplatz"
      hideWorkspaceSwitcher={false}
      onResetIdentity={onResetIdentity}
      onCreateWorkspace={onNewDocument}
      onUpdateIdentityInDoc={(updates) => updateIdentity(currentUserDid, updates)}
      userDocHandle={userDocHandle}
      userDoc={userDoc}
      userDocUrl={userDocHandle?.url}
      onToggleDebugDashboard={onToggleDebugDashboard}
      workspaceLoading={workspaceLoading}
      contentState={contentState}
      onJoinWorkspace={onJoinWorkspace}
      onCancelLoading={onCancelLoading}
      identity={{ did: currentUserDid, displayName }}
      onGoToStart={onGoToStart}
      onSwitchWorkspace={onSwitchWorkspace}
    >
      {(ctx: AppContextValue) => (
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 pt-6 pb-24 max-w-3xl">
            <MarketModule
              data={doc?.data ?? { listings: {}, reactions: {} }}
              context={{
                currentUserDid,
                identities: doc?.identities ?? {},
                userDoc,
                trustGiven: userDoc?.trustGiven ?? {},
                trustReceived: userDoc?.trustReceived ?? {},
              }}
              onChange={() => {}}
              onCreateListing={handleCreateListing}
              onSetListingStatus={setListingStatus}
              onAddReaction={handleReact}
              onRemoveReaction={handleRemoveReaction}
              getReactionCount={getReactionCount}
              hasUserReacted={(listingId) => hasUserReacted(listingId, currentUserDid)}
              getReactionsForListing={getReactionsForListing}
              listings={listings.filter(l => !ctx.hiddenUserDids.has(l.createdBy))}
              hiddenUserDids={ctx.hiddenUserDids}
              doc={{ identities: doc?.identities ?? {} }}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
