import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '@/locales/en/common.json';
import enSettings from '@/locales/en/settings.json';
import enDownlodr from '@/locales/en/downlodr.json';
import enSkedulosa from '@/locales/en/skedulosa.json';
import enPlugins from '@/locales/en/plugins.json';
import enSidebar from '@/locales/en/sidebar.json';
import enNavbar from '@/locales/en/navbar.json';
import enAdditionalOptions from '@/locales/en/additionalOptions.json';
import enFolderDirectory from '@/locales/en/folderDirectory.json';
import enDownloadLogs from '@/locales/en/downloadLogs.json';
import enPlaylistSelection from '@/locales/en/playlistSelection.json';

import esCommon from '@/locales/es/common.json';
import esSettings from '@/locales/es/settings.json';
import esDownlodr from '@/locales/es/downlodr.json';
import esSkedulosa from '@/locales/es/skedulosa.json';
import esPlugins from '@/locales/es/plugins.json';
import esSidebar from '@/locales/es/sidebar.json';
import esNavbar from '@/locales/es/navbar.json';
import esAdditionalOptions from '@/locales/es/additionalOptions.json';
import esFolderDirectory from '@/locales/es/folderDirectory.json';
import esDownloadLogs from '@/locales/es/downloadLogs.json';
import esPlaylistSelection from '@/locales/es/playlistSelection.json';

import ptCommon from '@/locales/pt/common.json';
import ptSettings from '@/locales/pt/settings.json';
import ptDownlodr from '@/locales/pt/downlodr.json';
import ptSkedulosa from '@/locales/pt/skedulosa.json';
import ptPlugins from '@/locales/pt/plugins.json';
import ptSidebar from '@/locales/pt/sidebar.json';
import ptNavbar from '@/locales/pt/navbar.json';
import ptAdditionalOptions from '@/locales/pt/additionalOptions.json';
import ptFolderDirectory from '@/locales/pt/folderDirectory.json';
import ptDownloadLogs from '@/locales/pt/downloadLogs.json';
import ptPlaylistSelection from '@/locales/pt/playlistSelection.json';

import koCommon from '@/locales/ko/common.json';
import koSettings from '@/locales/ko/settings.json';
import koDownlodr from '@/locales/ko/downlodr.json';
import koSkedulosa from '@/locales/ko/skedulosa.json';
import koPlugins from '@/locales/ko/plugins.json';
import koSidebar from '@/locales/ko/sidebar.json';
import koNavbar from '@/locales/ko/navbar.json';
import koAdditionalOptions from '@/locales/ko/additionalOptions.json';
import koFolderDirectory from '@/locales/ko/folderDirectory.json';
import koDownloadLogs from '@/locales/ko/downloadLogs.json';
import koPlaylistSelection from '@/locales/ko/playlistSelection.json';

import jaCommon from '@/locales/ja/common.json';
import jaSettings from '@/locales/ja/settings.json';
import jaDownlodr from '@/locales/ja/downlodr.json';
import jaSkedulosa from '@/locales/ja/skedulosa.json';
import jaPlugins from '@/locales/ja/plugins.json';
import jaSidebar from '@/locales/ja/sidebar.json';
import jaNavbar from '@/locales/ja/navbar.json';
import jaAdditionalOptions from '@/locales/ja/additionalOptions.json';
import jaFolderDirectory from '@/locales/ja/folderDirectory.json';
import jaDownloadLogs from '@/locales/ja/downloadLogs.json';
import jaPlaylistSelection from '@/locales/ja/playlistSelection.json';

import deCommon from '@/locales/de/common.json';
import deSettings from '@/locales/de/settings.json';
import deDownlodr from '@/locales/de/downlodr.json';
import deSkedulosa from '@/locales/de/skedulosa.json';
import dePlugins from '@/locales/de/plugins.json';
import deSidebar from '@/locales/de/sidebar.json';
import deNavbar from '@/locales/de/navbar.json';
import deAdditionalOptions from '@/locales/de/additionalOptions.json';
import deFolderDirectory from '@/locales/de/folderDirectory.json';
import deDownloadLogs from '@/locales/de/downloadLogs.json';
import dePlaylistSelection from '@/locales/de/playlistSelection.json';

import zhTWCommon from '@/locales/zh-TW/common.json';
import zhTWSettings from '@/locales/zh-TW/settings.json';
import zhTWDownlodr from '@/locales/zh-TW/downlodr.json';
import zhTWSkedulosa from '@/locales/zh-TW/skedulosa.json';
import zhTWPlugins from '@/locales/zh-TW/plugins.json';
import zhTWSidebar from '@/locales/zh-TW/sidebar.json';
import zhTWNavbar from '@/locales/zh-TW/navbar.json';
import zhTWAdditionalOptions from '@/locales/zh-TW/additionalOptions.json';
import zhTWFolderDirectory from '@/locales/zh-TW/folderDirectory.json';
import zhTWDownloadLogs from '@/locales/zh-TW/downloadLogs.json';
import zhTWPlaylistSelection from '@/locales/zh-TW/playlistSelection.json';

import zhCNCommon from '@/locales/zh-CN/common.json';
import zhCNSettings from '@/locales/zh-CN/settings.json';
import zhCNDownlodr from '@/locales/zh-CN/downlodr.json';
import zhCNSkedulosa from '@/locales/zh-CN/skedulosa.json';
import zhCNPlugins from '@/locales/zh-CN/plugins.json';
import zhCNSidebar from '@/locales/zh-CN/sidebar.json';
import zhCNNavbar from '@/locales/zh-CN/navbar.json';
import zhCNAdditionalOptions from '@/locales/zh-CN/additionalOptions.json';
import zhCNFolderDirectory from '@/locales/zh-CN/folderDirectory.json';
import zhCNDownloadLogs from '@/locales/zh-CN/downloadLogs.json';
import zhCNPlaylistSelection from '@/locales/zh-CN/playlistSelection.json';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      settings: enSettings,
      downlodr: enDownlodr,
      skedulosa: enSkedulosa,
      plugins: enPlugins,
      sidebar: enSidebar,
      navbar: enNavbar,
      additionalOptions: enAdditionalOptions,
      folderDirectory: enFolderDirectory,
      downloadLogs: enDownloadLogs,
      playlistSelection: enPlaylistSelection,
    },
    es: {
      common: esCommon,
      settings: esSettings,
      downlodr: esDownlodr,
      skedulosa: esSkedulosa,
      plugins: esPlugins,
      sidebar: esSidebar,
      navbar: esNavbar,
      additionalOptions: esAdditionalOptions,
      folderDirectory: esFolderDirectory,
      downloadLogs: esDownloadLogs,
      playlistSelection: esPlaylistSelection,
    },
    pt: {
      common: ptCommon,
      settings: ptSettings,
      downlodr: ptDownlodr,
      skedulosa: ptSkedulosa,
      plugins: ptPlugins,
      sidebar: ptSidebar,
      navbar: ptNavbar,
      additionalOptions: ptAdditionalOptions,
      folderDirectory: ptFolderDirectory,
      downloadLogs: ptDownloadLogs,
      playlistSelection: ptPlaylistSelection,
    },
    ko: {
      common: koCommon,
      settings: koSettings,
      downlodr: koDownlodr,
      skedulosa: koSkedulosa,
      plugins: koPlugins,
      sidebar: koSidebar,
      navbar: koNavbar,
      additionalOptions: koAdditionalOptions,
      folderDirectory: koFolderDirectory,
      downloadLogs: koDownloadLogs,
      playlistSelection: koPlaylistSelection,
    },
    ja: {
      common: jaCommon,
      settings: jaSettings,
      downlodr: jaDownlodr,
      skedulosa: jaSkedulosa,
      plugins: jaPlugins,
      sidebar: jaSidebar,
      navbar: jaNavbar,
      additionalOptions: jaAdditionalOptions,
      folderDirectory: jaFolderDirectory,
      downloadLogs: jaDownloadLogs,
      playlistSelection: jaPlaylistSelection,
    },
    de: {
      common: deCommon,
      settings: deSettings,
      downlodr: deDownlodr,
      skedulosa: deSkedulosa,
      plugins: dePlugins,
      sidebar: deSidebar,
      navbar: deNavbar,
      additionalOptions: deAdditionalOptions,
      folderDirectory: deFolderDirectory,
      downloadLogs: deDownloadLogs,
      playlistSelection: dePlaylistSelection,
    },
    'zh-TW': {
      common: zhTWCommon,
      settings: zhTWSettings,
      downlodr: zhTWDownlodr,
      skedulosa: zhTWSkedulosa,
      plugins: zhTWPlugins,
      sidebar: zhTWSidebar,
      navbar: zhTWNavbar,
      additionalOptions: zhTWAdditionalOptions,
      folderDirectory: zhTWFolderDirectory,
      downloadLogs: zhTWDownloadLogs,
      playlistSelection: zhTWPlaylistSelection,
    },
    'zh-CN': {
      common: zhCNCommon,
      settings: zhCNSettings,
      downlodr: zhCNDownlodr,
      skedulosa: zhCNSkedulosa,
      plugins: zhCNPlugins,
      sidebar: zhCNSidebar,
      navbar: zhCNNavbar,
      additionalOptions: zhCNAdditionalOptions,
      folderDirectory: zhCNFolderDirectory,
      downloadLogs: zhCNDownloadLogs,
      playlistSelection: zhCNPlaylistSelection,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: [
    'common',
    'settings',
    'downlodr',
    'skedulosa',
    'plugins',
    'sidebar',
    'navbar',
    'additionalOptions',
    'folderDirectory',
    'downloadLogs',
    'playlistSelection',
  ],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
