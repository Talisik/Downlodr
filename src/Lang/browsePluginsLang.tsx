import { renderIcon } from '@/Utils/iconHelpers';

const sampleSvgIcon =
  '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red" /></svg>';

const browsePluginsLang = [
  {
    id: 'cc-to-markdown-downlodr',
    name: 'CC to Markdown',
    version: '1.0.1',
    description: 'Convert video captions into markdown documents.',
    author: 'Downlodr',
    icon: renderIcon(sampleSvgIcon, 'md', 'CC to Markdown'),
    downloads: '12.1k',
    size: '8.4 MB',
    repoLink: 'https://github.com/Talisik/downlodr-cc-markdown-plugin',
    downlodrLink: 'https://downlodr.com/plugin/cc-to-markdown/',
  },
  {
    id: 'format-converter-downlodr',
    name: 'Format Converter',
    version: '1.0.1',
    description:
      'Converts videos to different formats using customizable quality and settings.',
    author: 'Downlodr',
    icon: renderIcon(sampleSvgIcon, 'md', 'Format Converter'),
    downloads: '12.1k',
    size: '120.7 KB',
    repoLink: 'https://github.com/Talisik/downlodr-converter-plugin',
    downlodrLink: 'https://downlodr.com/plugin/related-content-finder/',
  },
  {
    id: 'metadata-exporter-downlodr',
    name: 'Metadata Exporter',
    version: '1.0.1',

    description:
      'View and edit video metadata with powerful batch processing tools.',
    author: 'Downlodr',
    icon: renderIcon(sampleSvgIcon, 'md', 'Metadata Exporter'),
    downloads: '12.1k',
    size: '280.7 KB',
    repoLink: 'https://github.com/Talisik/downlodr-metadata-plugin',
    downlodrLink: 'https://downlodr.com/plugin/topic-research/',
  },
];

export default browsePluginsLang;
