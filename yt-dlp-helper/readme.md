# YT-DLP Helper

Helps you with YT-DLP stuff. A TypeScript wrapper for yt-dlp that simplifies video downloading from YouTube and other supported platforms.

## Installation

```sh
npm install yt-dlp-helper
```

## How to Use

### Quick Start

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const controller = await YTDLP.download({
        args: {
            url: "https://www.youtube.com/watch?v=PHMTfx3gWqw",
            output: "path/to/filename",
            audioFormat: "mp3",
        },
    });

    for await (const chunk of controller.listen()) console.log(chunk);
})();
```

Sample `chunk`.

```json
{
    "status": "downloading",
    "downloaded_bytes": 1354043,
    "total_bytes": 1354043,
    "tmpfilename": "The Oldeelva River on the outskirts of Olden, Norway. #norway  #cruisenorwegian #cruiseship [PHMTfx3gWqw].f140.m4a.part",
    "filename": "The Oldeelva River on the outskirts of Olden, Norway. #norway  #cruisenorwegian #cruiseship [PHMTfx3gWqw].f140.m4a",
    "eta": 0,
    "speed": 8148429.533646017,
    "elapsed": 0.2281484603881836,
    "ctx_id": null,
    "_eta_str": "00:00",
    "_speed_str": "   7.77MiB/s",
    "_percent_str": "100.0%",
    "_total_bytes_str": "   1.29MiB",
    "_total_bytes_estimate_str": "       N/A",
    "_downloaded_bytes_str": "   1.29MiB",
    "_elapsed_str": "00:00:00",
    "_default_template": "100.0% of    1.29MiB at    7.77MiB/s ETA 00:00"
}
```

### Downloading the YT-DLP Binary Manually

You can download the YT-DLP binary through the package with various configuration options.
This is automatically done when attempting to download a video (can be disabled.)

#### Basic Usage

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    // Download latest version to default location
    await YTDLP.downloadYTDLP();

    // Now you can use other functions
})();
```

#### Advanced Usage with Options

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    // Download with custom options
    await YTDLP.downloadYTDLP({
        filePath: "./custom/path/yt-dlp",      // Custom download path
        version: "2023.12.30",                // Specific version (optional)
        platform: "linux",                    // Target platform (auto-detected by default)
        forceDownload: true                    // Force download even if exists
    });
})();
```

#### Download Options

| Parameter      | Type               | Default                    | Description                                    |
| -------------- | ------------------ | -------------------------- | ---------------------------------------------- |
| filePath       | string \| null     | `"./yt-dlp"` or `"./yt-dlp.exe"` | Custom path to save the binary            |
| version        | string             | Latest version             | Specific version to download (e.g., "2023.12.30") |
| platform       | NodeJS.Platform    | Current OS platform        | Target platform: "win32", "linux", "darwin", etc. |
| forceDownload  | boolean            | false                      | Force download even if file already exists    |

### Checking YT-DLP Version

You can check the version of your installed YT-DLP binary or get the latest available version.

#### Get Current Installed Version

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    // Check version of default binary
    const version = await YTDLP.getYTDLPVersion();
    
    if (version) {
        console.log(`YT-DLP version: ${version}`);
    } else {
        console.log("YT-DLP not found or not executable");
    }
})();
```

#### Get Version of Custom Binary Path

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    // Check version of binary at custom path
    const version = await YTDLP.getYTDLPVersion("./custom/path/yt-dlp");
    
    if (version) {
        console.log(`YT-DLP version: ${version}`);
    } else {
        console.log("YT-DLP not found at specified path");
    }
})();
```

#### Get Latest Available Version

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    // Get the latest version available on GitHub
    const latestVersion = await YTDLP.getLatestYTDLPVersion();
    
    if (latestVersion) {
        console.log(`Latest YT-DLP version: ${latestVersion}`);
        
        // Compare with installed version
        const currentVersion = await YTDLP.getYTDLPVersion();
        
        if (currentVersion && currentVersion !== latestVersion) {
            console.log("Update available!");
            
            // Download the latest version
            await YTDLP.downloadYTDLP({
                version: latestVersion,
                forceDownload: true
            });
        }
    } else {
        console.log("Unable to fetch latest version");
    }
})();
```

#### Version Management Example

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    async function checkAndUpdateYTDLP() {
        try {
            const currentVersion = await YTDLP.getYTDLPVersion();
            const latestVersion = await YTDLP.getLatestYTDLPVersion();
            
            if (!currentVersion) {
                console.log("YT-DLP not found. Downloading latest version...");
                await YTDLP.downloadYTDLP();
                return;
            }
            
            console.log(`Current version: ${currentVersion}`);
            console.log(`Latest version: ${latestVersion}`);
            
            if (latestVersion && currentVersion !== latestVersion) {
                console.log("Updating YT-DLP to latest version...");
                await YTDLP.downloadYTDLP({
                    version: latestVersion,
                    forceDownload: true
                });
                console.log("Update completed!");
            } else {
                console.log("YT-DLP is up to date!");
            }
        } catch (error) {
            console.error("Error managing YT-DLP version:", error);
        }
    }
    
    await checkAndUpdateYTDLP();
})();
```

### Downloading FFmpeg Binary Manually

You can download the FFmpeg binary through the package.
This is automatically done when attempting to download a video (can be disabled.)

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    await YTDLP.downloadFFmpeg();

    // Now you can use other functions
})();
```

### Retrieving Terminals via ID

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    async function newController() {
        const controller = await YTDLP.download({
            args: {
                url: "https://www.youtube.com/watch?v=PHMTfx3gWqw",
                output: "path/to/filename",
            },
        });

        if (controller == null) return;

        return controller.id;
    }

    const id = await newController();

    if (id == null) return;

    const controller = YTDLP.Terminal.fromID(id); // The controller can be retrieved with its ID.

    if (controller == null) return;

    for await (const chunk of controller.listen()) {
        console.log(chunk);
    }
})();
```

### Stopping the Download

The download can be stopped at any time.

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const controller = await YTDLP.download({
        args: {
            url: "https://www.youtube.com/watch?v=PHMTfx3gWqw",
            output: "path/to/filename",
            videoFormat: "597", // The video format ID, found in `.getInfo(...)`.
            audioFormat: "mp3",
        },
    });

    if (controller == null) return;

    let stopping = false;

    for await (const chunk of controller.listen()) {
        if (!stopping) {
            stopping = true;
            setTimeout(() => controller.kill(), 1_000); // Stop the process after 1 second.
        }

        console.log(chunk);
    }
})();
```

### Rate Limiting

Download speed can be rate-limited.

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const controller = await YTDLP.download({
        args: {
            url: "https://www.youtube.com/watch?v=PHMTfx3gWqw",
            output: "path/to/filename",
            videoFormat: "597",
            audioFormat: "mp3",
            limitRate: "50K", // B = Bytes, K = KiB, M = MiB, G = GiB
        },
    });

    // Listen for progress updates
})();
```

### Configuration Options

You can control the download behavior with configuration options:

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const controller = await YTDLP.download({
        args: {
            url: "https://www.youtube.com/watch?v=PHMTfx3gWqw",
            output: "path/to/filename",
        },
        downloadBinary: {
            ytdlp: true, // Auto-download yt-dlp binary if missing
            ffmpeg: true, // Auto-download ffmpeg binary if missing
        },
        ytdlpDownloadDestination: "./custom/path", // Optional custom path for yt-dlp
        ffmpegDownloadDestination: "./custom/path", // Optional custom path for ffmpeg
    });

    // Process updates
})();
```

### Retrieving Video Information

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const info = await YTDLP.getInfo(
        "https://www.youtube.com/watch?v=Qe9U1XzX36s"
    );

    console.log(info);
})();
```

Sample Result:

```json
{
  ok: true,
  data: {
    id: 'Qe9U1XzX36s',
    title: 'Riding Trident 660 after 1st Service & 1000Kms RAW Impressions',
    formats: [...],
    thumbnails: [...],
    thumbnail: 'https://i.ytimg.com/vi/Qe9U1XzX36s/maxresdefault.jpg',
    description: "I had given the Triumph Trident 660 for it's first service and I ride it for the first time after completing the first service and we also cross the 1000 Km mark. So I share my raw impressions what I found on this bike and what's different after the first completing the first service you can also call this the ownership review of the trident 660 after riding it for 1000 kms.\n" +
      '\n' +
      'My other video after 10 days of owing the Triumph Trident 660 https://www.youtube.com/watch?v=zm1gqHfVFu4',
    channel_id: 'UCS5cgC8B_dGDftYqE_TbneQ',
    channel_url: 'https://www.youtube.com/channel/UCS5cgC8B_dGDftYqE_TbneQ',
    duration: 1395,
    view_count: 35851,
    average_rating: null,
    age_limit: 0,
    webpage_url: 'https://www.youtube.com/watch?v=Qe9U1XzX36s',
    categories: [ 'Autos & Vehicles' ],
    tags: [
      'trident 660',
      ...
    ],
    playable_in_embed: true,
    live_status: 'not_live',
    release_timestamp: null,
    _format_sort_fields: [
      'quality',  'res',
      'fps',      'hdr:12',
      'source',   'vcodec:vp9.2',
      'channels', 'acodec',
      'lang',     'proto'
    ],
    automatic_captions: {
      ab: [Array],
      ...
    },
    subtitles: {},
    comment_count: 133,
    chapters: [...],
    heatmap: null,
    like_count: 1179,
    channel: 'GeekyRanjit Rides & Vlogs',
    channel_follower_count: 42500,
    uploader: 'GeekyRanjit Rides & Vlogs',
    uploader_id: '@GeekyRanjitRidesVlogs',
    uploader_url: 'https://www.youtube.com/@GeekyRanjitRidesVlogs',
    upload_date: '20220224',
    timestamp: 1645683543,
    availability: 'public',
    original_url: 'https://www.youtube.com/watch?v=Qe9U1XzX36s',
    webpage_url_basename: 'watch',
    webpage_url_domain: 'youtube.com',
    extractor: 'youtube',
    extractor_key: 'Youtube',
    playlist: null,
    playlist_index: null,
    display_id: 'Qe9U1XzX36s',
    fulltitle: 'Riding Trident 660 after 1st Service & 1000Kms RAW Impressions',
    duration_string: '23:15',
    release_year: null,
    is_live: false,
    was_live: false,
    requested_subtitles: null,
    _has_drm: null,
    epoch: 1730251613,
    requested_formats: [...],
    format: '313 - 3840x2160 (2160p)+251 - audio only (medium)',
    format_id: '313+251',
    ext: 'webm',
    protocol: 'https+https',
    language: 'en',
    format_note: '2160p+medium',
    filesize_approx: 3099662469,
    tbr: 17770.757,
    width: 3840,
    height: 2160,
    resolution: '3840x2160',
    fps: 30,
    dynamic_range: 'SDR',
    vcodec: 'vp09.00.50.08',
    vbr: 17674.131,
    stretched_ratio: null,
    aspect_ratio: 1.78,
    acodec: 'opus',
    abr: 96.626,
    asr: 48000,
    audio_channels: 2,
    _filename: 'Riding Trident 660 after 1st Service & 1000Kms RAW Impressions [Qe9U1XzX36s].webm',
    filename: 'Riding Trident 660 after 1st Service & 1000Kms RAW Impressions [Qe9U1XzX36s].webm',
    _type: 'video',
    _version: [Object]
  }
}
```

### Retrieving Playlist Information

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const info = await YTDLP.getPlaylistInfo({
        url: "https://www.youtube.com/watch?v=Qe9U1XzX36s&list=PLQxjZBFrSfLAMKZKcgPzBjplN8iLtBN8c",
    });

    console.log(info);
})();
```

Sample Result:

```json
{
  ok: true,
  data: {
    id: 'PLQxjZBFrSfLAMKZKcgPzBjplN8iLtBN8c',
    title: 'My Bike Reviews',
    availability: null,
    channel_follower_count: null,
    description: '',
    tags: [],
    thumbnails: [
      {
        url: 'https://i.ytimg.com/vi/Qe9U1XzX36s/hqdefault.jpg?sqp=-oaymwEWCKgBEF5IWvKriqkDCQgBFQAAiEIYAQ==&rs=AOn4CLAaG1EyFfksl6QAM0swM-m11ib2TQ',
        height: 94,
        width: 168,
        id: '0',
        resolution: '168x94'
      },
      ...
    ],
    modified_date: '20221123',
    view_count: 430,
    playlist_count: 2,
    channel: 'GeekyRanjit Rides & Vlogs',
    channel_id: 'UCS5cgC8B_dGDftYqE_TbneQ',
    uploader_id: '@GeekyRanjitRidesVlogs',
    uploader: 'GeekyRanjit Rides & Vlogs',
    channel_url: 'https://www.youtube.com/channel/UCS5cgC8B_dGDftYqE_TbneQ',
    uploader_url: 'https://www.youtube.com/@GeekyRanjitRidesVlogs',
    _type: 'playlist',
    entries: [
      {
        _type: 'url',
        ie_key: 'Youtube',
        id: 'Qe9U1XzX36s',
        url: 'https://www.youtube.com/watch?v=Qe9U1XzX36s',
        title: 'Riding Trident 660 after 1st Service & 1000Kms RAW Impressions',
        description: null,
        duration: 1396,
        channel_id: 'UCS5cgC8B_dGDftYqE_TbneQ',
        channel: 'GeekyRanjit Rides & Vlogs',
        channel_url: 'https://www.youtube.com/channel/UCS5cgC8B_dGDftYqE_TbneQ',
        uploader: 'GeekyRanjit Rides & Vlogs',
        uploader_id: '@GeekyRanjitRidesVlogs',
        uploader_url: 'https://www.youtube.com/@GeekyRanjitRidesVlogs',
        thumbnails: [Array],
        timestamp: null,
        release_timestamp: null,
        availability: null,
        view_count: 35000,
        live_status: null,
        channel_is_verified: null,
        __x_forwarded_for_ip: null
      },
      ...
    ],
    extractor_key: 'YoutubeTab',
    extractor: 'youtube:tab',
    webpage_url: 'https://www.youtube.com/playlist?list=PLQxjZBFrSfLAMKZKcgPzBjplN8iLtBN8c',
    original_url: 'https://www.youtube.com/watch?v=Qe9U1XzX36s&list=PLQxjZBFrSfLAMKZKcgPzBjplN8iLtBN8c',
    webpage_url_basename: 'playlist',
    webpage_url_domain: 'youtube.com',
    release_year: null,
    epoch: 1730251617,
    __files_to_move: {},
    _version: [Object]
  }
}
```

### Manually Invoking the YT-DLP Binary

You can invoke YT-DLP with your own set of arguments.

The data returned is YT-DLP's logs, not the downloaded file.

Note that in this method, there is no progress update.

```js
import * as YTDLP from "yt-dlp-helper";

(async () => {
    const info = await YTDLP.invoke({
        args: ["--dump-json", "https://www.youtube.com/watch?v=PHMTfx3gWqw"],
    });

    console.log(info);
})();
```

Sample Result:

```json
{
  ok: true,
  exitCode: 0,
  error: '',
  data: [string],
}
```

### Download Arguments Reference

The `args` parameter for the `download` function accepts the following options:

| Parameter    | Type   | Description                                            |
| ------------ | ------ | ------------------------------------------------------ |
| url          | string | The URL of the video to be processed                   |
| output       | string | The path to save the output file                       |
| videoFormat  | string | The format of the video to be downloaded               |
| audioFormat  | string | The format of the audio to be extracted (e.g., "mp3")  |
| audioQuality | string | Quality of the extracted audio (0-10, where 0 is best) |
| remuxVideo   | string | Format to remux the video to (e.g., "mp4", "webm")     |
| limitRate    | string | Maximum download rate (e.g., "50K" or "4.2M")          |
