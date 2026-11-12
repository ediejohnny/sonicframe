/** A podcast feed for the tests: one show, with the episodes given. */

export function feed(items: string, channel = ''): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
<title>The Show</title>
<itunes:author>Ana</itunes:author>
<itunes:image href="https://cdn.test/show.jpg"/>
${channel}
${items}
</channel>
</rss>`;
}

/** An older episode, with every field a feed can give. */
export const ONE = `<item>
<title>Pilot</title>
<guid>ep-1</guid>
<pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate>
<enclosure url="https://cdn.test/ep1.mp3" type="audio/mpeg" length="1"/>
<itunes:duration>1:02:03</itunes:duration>
<itunes:image href="https://cdn.test/ep1.jpg"/>
<podcast:chapters url="https://cdn.test/ep1.json" type="application/json+chapters"/>
<podcast:transcript url="https://cdn.test/ep1.vtt" type="text/vtt"/>
</item>`;

/** A newer episode, with a relative address and no picture of its own. */
export const TWO = `<item>
<title>Second</title>
<pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate>
<enclosure url="ep2.mp3" type="audio/mpeg"/>
<itunes:duration>754</itunes:duration>
</item>`;
