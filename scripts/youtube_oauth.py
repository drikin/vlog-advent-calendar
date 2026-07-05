#!/usr/bin/env python3
"""YouTube OAuth re-auth for youtube scope (playlist management).
Usage: python3 ~/Dev/vlog-advent-calendar/scripts/youtube_oauth.py
Then open the printed URL in your browser, authenticate, and paste the code.
"""
import json, sys, os, urllib.parse, urllib.request, webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler

TOKEN_PATH = os.path.expanduser("~/.hermes/google_token.json")

def load_token():
    return json.load(open(TOKEN_PATH))

def save_token(data):
    with open(TOKEN_PATH, "w") as f:
        json.dump(data, f, indent=2)

def exchange_code(code):
    token = load_token()
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": token["client_id"],
        "client_secret": token["client_secret"],
        "redirect_uri": "http://localhost:8080/oauth/callback",
        "grant_type": "authorization_code",
    }).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp = urllib.request.urlopen(req)
    new_creds = json.loads(resp.read())

    # Merge new credentials into existing token
    token.update({
        "token": new_creds["access_token"],
        "access_token": new_creds["access_token"],
        "refresh_token": new_creds.get("refresh_token", token.get("refresh_token")),
        "expiry": new_creds.get("expires_in"),
        "expires_at": str(int(__import__("time").time()) + new_creds.get("expires_in", 3600)),
        "scopes": new_creds.get("scope", "").split(),
    })
    save_token(token)
    print(f"\n✅ Token updated! Scopes: {token['scopes']}")
    return token

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/oauth/callback"):
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            code = params.get("code", [None])[0]
            if code:
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"<h1>Auth OK! You can close this tab.</h1>")
                self.wfile.flush()
                exchange_code(code)
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"<h1>Error: no code in callback</h1>")
            # Shutdown server after handling
            import threading
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(404)
            self.end_headers()

def main():
    token = load_token()

    scopes = [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
    ]

    params = {
        "client_id": token["client_id"],
        "redirect_uri": "http://localhost:8080/oauth/callback",
        "scope": " ".join(scopes),
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    print(f"\n🔐 Open this URL in your browser:\n{url}\n")
    webbrowser.open(url)

    server = HTTPServer(("localhost", 8080), CallbackHandler)
    print("Waiting for callback on http://localhost:8080 ...")
    server.serve_forever()
    print("Done!")

if __name__ == "__main__":
    main()
