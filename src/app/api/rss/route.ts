import { CHANNELS } from "@/config/channels";
import { fetchAllVideos } from "@/lib/youtube";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * RSS 2.0 feed for Vlog Advent Calendar.
 * Lists all non-live video entries across all member channels.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  let videos = await fetchAllVideos(CHANNELS);
  // Sort newest first for RSS
  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  // Limit to last 100 entries
  videos = videos.slice(0, 100);

  const feedItems = videos
    .map(
      (v) => `    <item>
      <title><![CDATA[${v.title}]]></title>
      <link>https://youtube.com/watch?v=${v.videoId}</link>
      <guid isPermaLink="false">vlog-advent-${v.videoId}</guid>
      <pubDate>${new Date(v.publishedAt).toUTCString()}</pubDate>
      <description><![CDATA[${v.channelName} (${v.channelHandle}) のVlog強化月間 第${new Date(v.publishedAt).getDate()}日目]]></description>
      <author>${v.channelName}</author>
      <category>Vlog強化月間</category>
      <media:thumbnail url="${v.thumbnail}" />
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Vlog強化月間 - アドベントカレンダー</title>
    <link>${baseUrl}/</link>
    <description>参加メンバーのデイリーVlogをまとめてチェック。Vlog強化月間（June 2026）</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/favicon.ico</url>
      <title>Vlog強化月間</title>
      <link>${baseUrl}/</link>
    </image>
    ${feedItems}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
