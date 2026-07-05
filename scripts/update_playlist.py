#!/usr/bin/env python3
"""
デスブロカレンダー プレイリスト自動更新スクリプト
──────────────────────────────────────────────────
- 該当月の参加者チャンネルを members.ts から取得
- 各チャンネルの該当月動画を YouTube Data API で取得
- プレイリストに未追加の動画を追加
- 重複追加防止（playlistItems を既存と比較）

Usage:
  python3 scripts/update_playlist.py              # 現在の月を更新
  python3 scripts/update_playlist.py --month 2026-07  # 指定月を更新
  python3 scripts/update_playlist.py --dry-run  # ドライラン（追加せず表示のみ）
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from calendar import monthrange
from datetime import datetime

TOKEN_PATH = os.path.expanduser("~/.hermes/google_token.json")
MEMBERS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "lib", "members.ts")
CHANNEL_ID = "UCmx8RUU-52-l8xUfmJvEYIA"  # backspace.fm

# playlistId per month (month_label -> playlist_id)
# 既存のプレイリストがある場合はここに追加
PLAYLISTS = {
    "2026-07": "PLLEoWx5iB0RI",
}


def load_token():
    token = json.load(open(TOKEN_PATH))
    # Refresh if expired (using simple urllib, no google-auth dependency)
    expires_at = token.get("expires_at")
    if expires_at and int(expires_at) < time.time() and token.get("refresh_token"):
        data = urllib.parse.urlencode({
            "client_id": token["client_id"],
            "client_secret": token["client_secret"],
            "refresh_token": token["refresh_token"],
            "grant_type": "refresh_token",
        }).encode()
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp = urllib.request.urlopen(req)
        new = json.loads(resp.read())
        token.update({
            "access_token": new["access_token"],
            "token": new["access_token"],
            "expiry": new.get("expires_in", 3600),
            "expires_at": str(int(time.time()) + new.get("expires_in", 3600)),
        })
        with open(TOKEN_PATH, "w") as f:
            json.dump(token, f, indent=2)
    return token


def yt_request(url, method="GET", data=None):
    token = load_token()
    headers = {
        "Authorization": f"Bearer {token['access_token']}",
        "Content-Type": "application/json",
    }
    if data:
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def parse_members_ts():
    """members.tsからチャンネルIDリストを抽出"""
    content = open(MEMBERS_PATH).read()
    # Find the active month's member list (July by default)
    ids = []
    # Try JULY_DEFAULT_CHANNELS first, then DEFAULT_CHANNELS
    for label in ["JULY_DEFAULT_CHANNELS", "DEFAULT_CHANNELS"]:
        # Find the array block: label ... = [ ... ];
        idx = content.find(label)
        if idx == -1:
            continue
        # Find the '=' sign, then the opening bracket after it
        # (TypeScript uses Channel[], so the first [ is type annotation)
        eq_pos = content.find("=", idx)
        if eq_pos == -1:
            continue
        bracket_start = content.find("[", eq_pos)
        if bracket_start == -1:
            continue
        # Find matching closing bracket by counting depth
        depth = 0
        for i in range(bracket_start, len(content)):
            if content[i] == "[":
                depth += 1
            elif content[i] == "]":
                depth -= 1
                if depth == 0:
                    block = content[bracket_start:i]
                    for ch_id in re.findall(r'id:\s*"([^"]+)"', block):
                        if ch_id not in ids:
                            ids.append(ch_id)
                    break
        if ids:
            break
    return ids


def get_current_month():
    now = datetime.now()
    return f"{now.year}-{now.month:02d}"


def get_playlist_for_month(month_str):
    """月文字列に対応するプレイリストIDを返す。なければ作成"""
    if month_str in PLAYLISTS:
        return PLAYLISTS[month_str]

    # 新規作成
    year, month = month_str.split("-")
    title = f"{year}年{int(month)}月 デスブロカレンダー"
    result = yt_request(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
        method="POST",
        data={
            "snippet": {
                "title": title,
                "description": f"デスブロカレンダー {title} 参加メンバーのVLOGプレイリスト",
                "channelId": CHANNEL_ID,
            },
            "status": {
                "privacyStatus": "public",
            },
        },
    )
    pid = result["id"]
    PLAYLISTS[month_str] = pid
    print(f"  📋 New playlist created: {title} (ID: {pid})")
    return pid


def get_existing_playlist_items(playlist_id):
    """プレイリストの既存動画IDセットを取得"""
    video_ids = set()
    page_token = None
    while True:
        params = {
            "part": "snippet",
            "playlistId": playlist_id,
            "maxResults": 50,
        }
        if page_token:
            params["pageToken"] = page_token
        result = yt_request(
            "https://www.googleapis.com/youtube/v3/playlistItems?" + urllib.parse.urlencode(params)
        )
        for item in result.get("items", []):
            vid = item["snippet"]["resourceId"]["videoId"]
            video_ids.add(vid)
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return video_ids


def fetch_channel_month_videos(channel_id, year, month):
    """指定チャンネルの該当月動画を取得"""
    _, last_day = monthrange(int(year), int(month))
    videos = []
    page_token = None
    while True:
        params = {
            "part": "snippet",
            "channelId": channel_id,
            "type": "video",
            "maxResults": 50,
            "order": "date",
            "publishedAfter": f"{year}-{int(month):02d}-01T00:00:00Z",
            "publishedBefore": f"{year}-{int(month):02d}-{last_day}T23:59:59Z",
        }
        if page_token:
            params["pageToken"] = page_token
        result = yt_request(
            "https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode(params)
        )
        for item in result.get("items", []):
            vid = item["id"]["videoId"]
            title = item["snippet"]["title"]
            ch_title = item["snippet"]["channelTitle"]
            published = item["snippet"]["publishedAt"]
            videos.append({
                "videoId": vid,
                "title": title,
                "channel": ch_title,
                "publishedAt": published,
            })
        page_token = result.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.1)
    return videos


def add_to_playlist(playlist_id, video_id):
    """動画をプレイリストに追加"""
    yt_request(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        method="POST",
        data={
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": video_id,
                },
            },
        },
    )


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]

    month_str = get_current_month()
    for i, a in enumerate(args):
        if a == "--month" and i + 1 < len(args):
            month_str = args[i + 1]

    year, month = month_str.split("-")
    print(f"📅 Updating playlist for {month_str} ({'DRY RUN' if dry_run else 'LIVE'})")

    # Get playlist
    playlist_id = get_playlist_for_month(month_str)
    print(f"  Playlist: https://www.youtube.com/playlist?list={playlist_id}")

    # Get existing items
    existing = get_existing_playlist_items(playlist_id)
    print(f"  Existing videos: {len(existing)}")

    # Get member channel IDs
    channel_ids = parse_members_ts()
    print(f"  Members: {len(channel_ids)}")

    # Fetch new videos
    all_new = []
    for ch_id in channel_ids:
        videos = fetch_channel_month_videos(ch_id, year, month)
        for v in videos:
            if v["videoId"] not in existing:
                all_new.append(v)
        time.sleep(0.2)

    # Sort by publishedAt
    all_new.sort(key=lambda v: v["publishedAt"])

    if not all_new:
        print("  ✅ No new videos to add")
        return

    print(f"  🆕 Videos to add: {len(all_new)}")
    for v in all_new:
        print(f"    + {v['channel']}: {v['title'][:60]}")

    if dry_run:
        print("  (dry-run — skipping actual additions)")
        return

    # Add to playlist
    added = 0
    errors = 0
    for i, video in enumerate(all_new):
        try:
            add_to_playlist(playlist_id, video["videoId"])
            added += 1
        except Exception as e:
            errors += 1
            print(f"    ❌ Error: {video['videoId']}: {e}")

        # Rate limiting
        if (i + 1) % 10 == 0:
            time.sleep(1)
        else:
            time.sleep(0.5)

    print(f"\n  ✅ Added {added} videos ({errors} errors)")
    print(f"  Playlist: https://www.youtube.com/playlist?list={playlist_id}")


if __name__ == "__main__":
    main()
