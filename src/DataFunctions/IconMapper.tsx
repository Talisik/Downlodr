/* eslint-disable prettier/prettier */
import { BiSolidPlusSquare } from 'react-icons/bi';
import {
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaPause,
  FaPlay,
  FaRegTimesCircle,
  FaSoundcloud,
  FaStop
} from 'react-icons/fa';
import { HiMiniArrowPath } from 'react-icons/hi2';
import { LiaMixcloud } from "react-icons/lia";
import { MdOndemandVideo, MdOutlineWeb, MdPodcasts } from 'react-icons/md';
import { SiDailymotion, SiImgur } from "react-icons/si";
import {
  TbBrandBandcamp,
  TbBrandBilibili,
  TbBrandDiscord,
  TbBrandFacebook,
  TbBrandInstagram,
  TbBrandKick,
  TbBrandLinkedin,
  TbBrandPinterest,
  TbBrandReddit,
  TbBrandRumble,
  TbBrandSpotify,
  TbBrandTelegram,
  TbBrandTiktok,
  TbBrandTumblr,
  TbBrandTwitch,
  TbBrandTwitter,
  TbBrandVimeo,
  TbBrandYoutube,
  TbDeviceTabletSearch
} from 'react-icons/tb';
import { TfiFlickr } from "react-icons/tfi";

// Helper function to map extractor keys to their respective icons
export const getExtractorIcon = (extractorKey: string) => {
  const key = extractorKey.toLowerCase();

  // YouTube and related
  if (key.includes('youtube') || key.includes('youtu.be')) {
    return <TbBrandYoutube className="text-red-500" size={22} />;
  }

  // Twitch
  if (key.includes('twitch')) {
    return <TbBrandTwitch className="text-purple-600" size={22} />;
  }

  // TikTok
  if (key.includes('tiktok')) {
    return <TbBrandTiktok className="text-black dark:text-white" size={22} />;
  }

  // Bilibili
  if (key.includes('biliintl') || key.includes('bili')) {
    return <TbBrandBilibili className="text-sky-500" size={22} />;
  }

  // Instagram
  if (key.includes('instagram')) {
    return <TbBrandInstagram className="text-pink-600" size={22} />;
  }

  // Twitter/X
  if (key.includes('twitter') || key.includes('x.com')) {
    return <TbBrandTwitter className="text-sky-500" size={22} />;
  }

  // Facebook
  if (key.includes('facebook') || key.includes('fb.com')) {
    return <TbBrandFacebook className="text-sky-500" size={22} />;
  }

  // Reddit
  if (key.includes('reddit')) {
    return <TbBrandReddit className="text-orange-600" size={22} />;
  }

  // Vimeo
  if (key.includes('vimeo')) {
    return <TbBrandVimeo className="text-sky-500" size={22} />;
  }

  // Dailymotion
  if (key.includes('dailymotion')) {
    return <SiDailymotion className="text-sky-500" size={22} />;
  }

  // Rumble
  if (key.includes('rumble')) {
    return <TbBrandRumble className="text-green-600" size={22} />;
  }

  // Kick
  if (key.includes('kick')) {
    return <TbBrandKick className="text-green-500" size={22} />;
  }

  // Spotify
  if (key.includes('spotify')) {
    return <TbBrandSpotify className="text-green-500" size={22} />;
  }

  // SoundCloud
  if (key.includes('soundcloud')) {
    return <FaSoundcloud className="text-orange-500" size={22} />;
  }

  // Mixcloud
  if (key.includes('mixcloud')) {
    return <LiaMixcloud className="text-sky-500" size={22} />;
  }

  // Bandcamp
  if (key.includes('bandcamp')) {
    return <TbBrandBandcamp className="text-sky-500" size={22} />;
  }

  // Discord
  if (key.includes('discord')) {
    return <TbBrandDiscord className="text-indigo-500" size={22} />;
  }

  // Telegram
  if (key.includes('telegram')) {
    return <TbBrandTelegram className="text-sky-500" size={22} />;
  }

  // LinkedIn
  if (key.includes('linkedin')) {
    return <TbBrandLinkedin className="text-blue-700" size={22} />;
  }

  // Tumblr 
  if (key.includes('tumblr')) {
    return <TbBrandTumblr className="text-sky-500" size={22} />;
  }

  // Pinterest
  if (key.includes('pinterest')) {
    return <TbBrandPinterest className="text-red-500" size={22} />;
  }

  // Flickr
  if (key.includes('flickr')) {
    return <TfiFlickr className="text-pink-500" size={22} />;
  }

  // Imgur
  if (key.includes('imgur')) {
    return <SiImgur className="text-green-600" size={22} />;
  }

  // Podcast-related
  if (
    key.includes('podcast') ||
    key.includes('anchor') ||
    key.includes('buzzsprout')
  ) {
    return <MdPodcasts className="text-purple-500" size={22} />;
  }

  // Generic video/media
  if (
    key.includes('video') ||
    key.includes('media') ||
    key.includes('stream')
  ) {
    return <MdOndemandVideo className="text-gray-600" size={22} />;
  }

  // Default icon for unknown extractors
  return <MdOutlineWeb className="text-gray-500" size={22} />;
};

// Helper function to map status to their respective icons
export const getStatusIcon = (status: string, size = 16) => {
  const statusLower = status.toLowerCase();

  switch (statusLower) {
    case 'finished':
      return <FaCheckCircle size={size} className="text-green-600" />;
    
    case 'failed':
      return <FaRegTimesCircle size={size} className="text-red-500" />;
    
    case 'cancelled':
      return <FaStop size={size} className="text-red-500" />;
    
    case 'initializing':
      return <HiMiniArrowPath size={size} className="text-sky-500 animate-spin" />;
    
    case 'paused':
      return <FaPause size={size} className="text-yellow-600" />;
    
    case 'to download':
      return <FaDownload size={size} className="text-orange-600" />;
    
    case 'fetching metadata':
      return <TbDeviceTabletSearch size={size} className="text-sky-500 animate-pulse" />;
    
    case 'queued':
      return <BiSolidPlusSquare size={size} className="text-sky-500" />;
    
    case 'downloading':
      return <FaPlay size={size} className="text-sky-500" />;
    
    default:
      return <FaClock size={size} className="text-gray-500" />;
  }
};
