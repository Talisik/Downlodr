/**
 * A custom React function
 * This function takes a video link as input and returns the corresponding
 * embed URL based on the platform
 *  - (YouTube, Vimeo, Dailymotion, Facebook, TikTok, Twitter, Twitch).
 *
 * It handles various URL formats and extracts
 * the necessary video ID to construct the embed URL.
 *
 * @param link  - The URL of the video to be embedded.
 *
 * @returns link   - The embed URL for the video.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface VideoUrl {
  url: string;
  platform?:
    | 'youtube'
    | 'vimeo'
    | 'dailymotion'
    | 'facebook'
    | 'tiktok'
    | 'twitter'
    | 'twitch';
}

const GetEmbedUrl = (link: string): string => {
  try {
    const url = new URL(link);
    const hostname = url.hostname;
    let embedUrl = '';

    // Extract video ID based on platform
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const videoId =
        url.searchParams.get('v') || url.pathname.split('/').pop();

      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else {
        console.error('Could not extract YouTube video ID');
      }
    } else if (hostname.includes('vimeo.com')) {
      const videoId =
        url.searchParams.get('v') || url.pathname.split('/').pop();
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    } else if (
      hostname.includes('dailymotion.com') ||
      hostname.includes('dai.ly')
    ) {
      const videoId = url.pathname.split('/').pop()?.split('_')[0];
      embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
    } else if (hostname.includes('facebook.com')) {
      // Handle both video.php?v= and /videos/ formats
      let videoId;
      if (url.pathname.includes('video.php')) {
        videoId = url.searchParams.get('v');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        videoId = url.pathname.split('/videos/')[1]?.split('/')[0];
      }
      embedUrl = `https://www.facebook.com/plugins/video.php?href=${url}&show_text=false&width=500`;
    } else if (hostname.includes('tiktok.com')) {
      // Extract video ID from TikTok URL
      let videoId = '';

      // Standard TikTok URL format: https://www.tiktok.com/@username/video/{video_id}
      if (url.pathname.includes('/@')) {
        // Extract video ID for standard URLs
        const pathParts = url.pathname.split('/');
        videoId = pathParts[pathParts.length - 1]; // Get last part of path, which is the video ID
      }
      // Shortened TikTok URL format: https://vm.tiktok.com/{video_id}/
      else if (url.pathname.includes('/video/')) {
        // Extract video ID for shortened URLs
        videoId = url.pathname.split('/').pop(); // Get the last part of the path
      }

      if (videoId) {
        embedUrl = `https://www.tiktok.com/embed/${videoId}`;
      } else {
        console.error('Could not extract TikTok video ID');
      }
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      // Get the tweet ID from the URL
      const tweetId = url.pathname.split('/').pop();
      embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`;
    } else if (hostname.includes('twitch.tv')) {
      const pathSegments = url.pathname.split('/');
      const videoId = pathSegments.includes('videos')
        ? pathSegments.pop()
        : null;
      const channelName = pathSegments[1];
      if (videoId) {
        embedUrl = `https://player.twitch.tv/?video=${videoId}&parent=localhost`;
      } else {
        embedUrl = `https://player.twitch.tv/?channel=${channelName}&parent=localhost`;
      }
    } else {
      console.error('Unsupported video URL:', link);
    }

    return embedUrl;
  } catch (error) {
    console.error('Invalid URL:', link);
    return '';
  }
};

export default GetEmbedUrl;
