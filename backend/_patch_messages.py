"""
Temporary patch script: rewrites the peer_messages endpoints in main.py
with a cleaner implementation that works for both SQLite and PostgreSQL.
"""

import re

with open("main.py", "r") as f:
    content = f.read()

OLD = '''@app.post("/api/connect/messages", tags=["Campus Connect Messages"], response_model=PeerMessageOut)
def send_peer_message(payload: PeerMessageCreate):
    """
    Send a peer-to-peer message. Stored in the database so it is
    visible to the recipient on any device when they poll.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO peer_messages (sender_id, recipient_id, content, created_at, is_read)
            VALUES (?, ?, ?, ?, 0)
            """,
            (payload.sender_id, payload.recipient_id, payload.content, now),
        )
        # Fetch the newly inserted row
        if conn.is_postgres:
            new_id = cur.fetchone()["id"] if cur.rowcount else None
            # For postgres the RETURNING clause is easier; re-execute select
            row = conn.execute(
                "SELECT * FROM peer_messages WHERE id = ?", (new_id,)
            ).fetchone()
        else:
            new_id = cur.lastrowid
            row = conn.execute(
                "SELECT * FROM peer_messages WHERE id = ?", (new_id,)
            ).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to save message")

    return PeerMessageOut(
        id=row["id"],
        sender_id=row["sender_id"],
        recipient_id=row["recipient_id"],
        content=row["content"],
        created_at=row["created_at"],
        is_read=row["is_read"],
    )'''

NEW = '''@app.post("/api/connect/messages", tags=["Campus Connect Messages"], response_model=PeerMessageOut)
def send_peer_message(payload: PeerMessageCreate):
    """
    Send a peer-to-peer message. Stored in the database so it is
    visible to the recipient on any device when they poll.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Insert the message
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO peer_messages (sender_id, recipient_id, content, created_at, is_read)
            VALUES (?, ?, ?, ?, 0)
            """,
            (payload.sender_id, payload.recipient_id, payload.content, now),
        )

    # Fetch the just-inserted row (latest for this sender→recipient pair with same timestamp)
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM peer_messages
            WHERE sender_id = ? AND recipient_id = ? AND created_at = ?
            ORDER BY id DESC LIMIT 1
            """,
            (payload.sender_id, payload.recipient_id, now),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to save message")

    return PeerMessageOut(
        id=row["id"],
        sender_id=row["sender_id"],
        recipient_id=row["recipient_id"],
        content=row["content"],
        created_at=row["created_at"],
        is_read=row["is_read"],
    )'''

if OLD in content:
    content = content.replace(OLD, NEW)
    with open("main.py", "w") as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("ERROR: OLD string not found in main.py")
    # print first 200 chars of what's around line 887
    lines = content.split('\n')
    for i, line in enumerate(lines[882:930], start=883):
        print(f"{i}: {repr(line)}")
