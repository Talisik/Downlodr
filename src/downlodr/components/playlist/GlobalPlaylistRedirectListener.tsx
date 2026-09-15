import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { usePlaylistSelectionStore } from '@/downlodr/store/playlistSelectionStore';

/**
 * App-level owner of the "this was actually a playlist" redirect.
 *
 * TaskbarInputField classifies a pasted URL synchronously, and its rules are
 * YouTube-syntax only — a bilibili.tv season, a viu series, or any other site's
 * container URL is classified 'video' and starts a single download. The store
 * only learns the truth when getInfo comes back reporting a container, and a
 * Zustand action cannot navigate, so downloadActions parks the URL in
 * playlistSelectionStore.pendingPlaylistUrl and this component picks it up.
 *
 * It lives in App rather than TaskbarInputField because the taskbar unmounts on
 * the skedulosa/afda pages, which is exactly where an in-flight download from a
 * previous paste can land — the redirect must survive that unmount.
 */
const GlobalPlaylistRedirectListener = (): null => {
  const navigate = useNavigate();
  const pendingPlaylistUrl = usePlaylistSelectionStore(
    (s) => s.pendingPlaylistUrl,
  );
  const setPendingPlaylistUrl = usePlaylistSelectionStore(
    (s) => s.setPendingPlaylistUrl,
  );
  const loadPlaylist = usePlaylistSelectionStore((s) => s.loadPlaylist);

  useEffect(() => {
    if (!pendingPlaylistUrl) return;

    // Clear first: loadPlaylist is async, and leaving the URL parked would
    // re-fire this effect on the next store update.
    setPendingPlaylistUrl(null);

    // Navigate before the fetch resolves so the page can show its own loading
    // state, matching how the taskbar hands off to the selector.
    navigate('/playlist-selection');

    loadPlaylist(pendingPlaylistUrl).then((ok) => {
      if (!ok) {
        toast({
          variant: 'destructive',
          title: 'Could Not Load Playlist',
          description:
            'This link is a playlist or series, but its contents could not be fetched.',
          duration: 5000,
        });
      }
    });
  }, [pendingPlaylistUrl, setPendingPlaylistUrl, loadPlaylist, navigate]);

  return null;
};

export default GlobalPlaylistRedirectListener;
