import type { PostHeroActorKey } from "../director/post-hero-frame-resolver";

export interface PostHeroActorLifecycleState {
  requestedState: PostHeroActorKey;
  displayedState: PostHeroActorKey | null;
  pendingState: PostHeroActorKey | null;
  visible: boolean;
}

export interface PostHeroActorLifecycleResult {
  requestedState: PostHeroActorKey;
  displayedState: PostHeroActorKey;
  pendingState: PostHeroActorKey | null;
  visible: boolean;
  stateReady: boolean;
}

/** Keeps a valid displayed actor while its requested successor is still loading. */
export function resolvePostHeroActorLifecycle({
  requestedState,
  requestedReady,
  previous,
  visible,
}: {
  requestedState: PostHeroActorKey;
  requestedReady: boolean;
  previous?: PostHeroActorLifecycleState;
  visible: boolean;
}): PostHeroActorLifecycleResult {
  if (!visible) {
    return {
      requestedState,
      displayedState: previous?.displayedState ?? requestedState,
      pendingState: null,
      visible: false,
      stateReady: requestedReady,
    };
  }

  const isFirstVisibleState = !previous?.visible || !previous.displayedState;
  if (isFirstVisibleState || requestedState === previous.displayedState || requestedReady) {
    return {
      requestedState,
      displayedState: requestedState,
      pendingState: requestedReady ? null : requestedState,
      visible: true,
      stateReady: requestedReady,
    };
  }

  return {
    requestedState,
    displayedState: previous.displayedState,
    pendingState: requestedState,
    visible: true,
    stateReady: false,
  };
}
