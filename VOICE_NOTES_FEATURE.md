# Voice Notes Feature Documentation

## Overview

The Voice Notes feature allows therapists to quickly record voice memos during or after client sessions. These notes are automatically transcribed using OpenAI Whisper and displayed on the dashboard at the end of each day for easy review, copying, and exporting.

---

## 🎯 Key Features

### 1. **Quick Voice Recording**
- Record voice notes for specific clients and sessions
- Automatic transcription using OpenAI Whisper
- Support for multiple note types (follow-up, reminder, observation, general)
- Priority levels (low, normal, high, urgent)

### 2. **Daily Dashboard Summary**
- View all pending voice notes at end of day
- Organized by priority and client
- One-click copy to clipboard
- Export as Markdown, text, or JSON

### 3. **Client-Specific Notes**
- Attach notes to specific clients and sessions
- View all notes for a client
- Filter by status (pending, reviewed, completed, archived)

### 4. **Flexible Export**
- Export as Markdown (formatted)
- Export as plain text (simple)
- Export as JSON (structured data)
- Copy individual notes or entire summary

---

## 📡 API Endpoints

### Create Voice Note

**POST /api/voice-notes**

Record a new voice note with automatic transcription.

```bash
curl -X POST http://localhost:5000/api/voice-notes \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "sessionId": "session-456",
    "audio": "base64-encoded-audio-data",
    "noteType": "follow_up",
    "priority": "high",
    "tags": ["medication", "follow-up"]
  }'
```

**Request Body:**
```json
{
  "clientId": "string (required)",
  "sessionId": "string (optional)",
  "audio": "base64-encoded audio data (required)",
  "noteType": "follow_up | reminder | observation | general (optional)",
  "priority": "low | normal | high | urgent (optional)",
  "tags": ["string"] (optional),
  "metadata": {} (optional)
}
```

**Response:**
```json
{
  "success": true,
  "voiceNote": {
    "id": "note-uuid",
    "therapistId": "therapist-id",
    "clientId": "client-123",
    "sessionId": "session-456",
    "transcription": "Remember to follow up on medication adjustment...",
    "noteType": "follow_up",
    "priority": "high",
    "status": "pending",
    "tags": ["medication", "follow-up"],
    "durationSeconds": 15,
    "createdAt": "2025-12-30T18:30:00Z"
  }
}
```

---

### Get Daily Summary

**GET /api/voice-notes/daily-summary**

Get all pending voice notes for today, organized by priority and client.

```bash
# Get today's summary as JSON
curl http://localhost:5000/api/voice-notes/daily-summary

# Get as Markdown
curl http://localhost:5000/api/voice-notes/daily-summary?format=markdown

# Get for specific date
curl http://localhost:5000/api/voice-notes/daily-summary?date=2025-12-30
```

**Query Parameters:**
- `date` (optional): ISO 8601 date string (default: today)
- `format` (optional): `json`, `markdown`, or `text` (default: json)

**Response (JSON format):**
```json
{
  "success": true,
  "summary": {
    "date": "2025-12-30",
    "totalNotes": 8,
    "byPriority": {
      "urgent": [
        {
          "id": "note-1",
          "clientName": "Sarah Johnson",
          "transcription": "Client mentioned suicidal ideation, need immediate follow-up",
          "noteType": "follow_up",
          "priority": "urgent",
          "createdAt": "2025-12-30T14:30:00Z",
          "tags": ["risk", "urgent"]
        }
      ],
      "high": [...],
      "normal": [...],
      "low": [...]
    },
    "byClient": [
      {
        "clientId": "client-123",
        "clientName": "Sarah Johnson",
        "notes": [...]
      }
    ]
  }
}
```

**Response (Markdown format):**
```markdown
# Voice Notes Summary - 2025-12-30

**Total Notes:** 8

## 🚨 URGENT
- **Sarah Johnson**: Client mentioned suicidal ideation, need immediate follow-up

## ⚠️  HIGH PRIORITY
- **Michael Chen**: Follow up on medication side effects
- **Emily Davis**: Schedule family therapy session

## 📋 By Client

### Sarah Johnson
- 🚨 Client mentioned suicidal ideation, need immediate follow-up
- 📝 Discussed new coping strategies for anxiety

### Michael Chen
- ⚠️  Follow up on medication side effects
- 📝 Made progress on anger management goals
```

---

### Get Client Voice Notes

**GET /api/voice-notes/client/:clientId**

Get all voice notes for a specific client.

```bash
# Get all notes for a client
curl http://localhost:5000/api/voice-notes/client/client-123

# Get only pending notes
curl http://localhost:5000/api/voice-notes/client/client-123?status=pending

# Limit results
curl http://localhost:5000/api/voice-notes/client/client-123?limit=10
```

**Query Parameters:**
- `status` (optional): `pending`, `reviewed`, `completed`, `archived`
- `limit` (optional): Number of notes to return (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "notes": [
    {
      "id": "note-uuid",
      "therapistId": "therapist-id",
      "clientId": "client-123",
      "sessionId": "session-456",
      "transcription": "Remember to follow up on medication adjustment...",
      "noteType": "follow_up",
      "priority": "high",
      "status": "pending",
      "tags": ["medication"],
      "createdAt": "2025-12-30T18:30:00Z"
    }
  ],
  "count": 5
}
```

---

### Update Voice Note Status

**PATCH /api/voice-notes/:noteId/status**

Update the status of a voice note.

```bash
curl -X PATCH http://localhost:5000/api/voice-notes/note-123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**Request Body:**
```json
{
  "status": "pending | reviewed | completed | archived"
}
```

**Response:**
```json
{
  "success": true,
  "voiceNote": {
    "id": "note-123",
    "status": "completed",
    "completedAt": "2025-12-30T20:00:00Z"
  }
}
```

---

### Bulk Status Update

**POST /api/voice-notes/bulk-status**

Update the status of multiple voice notes at once.

```bash
curl -X POST http://localhost:5000/api/voice-notes/bulk-status \
  -H "Content-Type: application/json" \
  -d '{
    "noteIds": ["note-1", "note-2", "note-3"],
    "status": "reviewed"
  }'
```

**Request Body:**
```json
{
  "noteIds": ["string"],
  "status": "pending | reviewed | completed | archived"
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "voiceNotes": [...]
}
```

---

### Delete Voice Note

**DELETE /api/voice-notes/:noteId**

Delete a voice note.

```bash
curl -X DELETE http://localhost:5000/api/voice-notes/note-123
```

**Response:**
```json
{
  "success": true,
  "message": "Voice note deleted"
}
```

---

### Export Daily Summary

**GET /api/voice-notes/export/daily**

Export daily summary in various formats.

```bash
# Export as Markdown
curl http://localhost:5000/api/voice-notes/export/daily?format=markdown \
  --output voice-notes-2025-12-30.md

# Export as plain text
curl http://localhost:5000/api/voice-notes/export/daily?format=text \
  --output voice-notes-2025-12-30.txt

# Export as JSON
curl http://localhost:5000/api/voice-notes/export/daily?format=json \
  --output voice-notes-2025-12-30.json
```

**Query Parameters:**
- `date` (optional): ISO 8601 date string (default: today)
- `format` (optional): `markdown`, `text`, or `json` (default: markdown)

**Response:** File download with appropriate content type

---

## 🎙️ Recording Voice Notes

### From Web Interface (JavaScript Example)

```javascript
// Start recording
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
  const audioBuffer = await audioBlob.arrayBuffer();
  const base64Audio = btoa(
    String.fromCharCode(...new Uint8Array(audioBuffer))
  );

  // Send to API
  const response = await fetch('/api/voice-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: 'client-123',
      sessionId: 'session-456',
      audio: base64Audio,
      noteType: 'follow_up',
      priority: 'normal'
    })
  });

  const result = await response.json();
  console.log('Transcription:', result.voiceNote.transcription);
};

// Record for 10 seconds
mediaRecorder.start();
setTimeout(() => mediaRecorder.stop(), 10000);
```

---

## 📊 Dashboard Integration

### Daily Summary Widget

Display voice notes on the dashboard at the end of each day:

```javascript
// Fetch daily summary
const response = await fetch('/api/voice-notes/daily-summary');
const { summary } = await response.json();

// Display urgent notes first
summary.byPriority.urgent.forEach(note => {
  displayUrgentNote(note);
});

// Display by client
summary.byClient.forEach(client => {
  displayClientNotes(client);
});
```

### Copy to Clipboard

```javascript
// Get summary as Markdown
const response = await fetch('/api/voice-notes/export/daily?format=markdown');
const markdown = await response.text();

// Copy to clipboard
navigator.clipboard.writeText(markdown);
```

---

## 🔄 Workflow Examples

### During Session

1. **Quick Note During Session**
   ```
   Therapist: [Presses record button]
   "Emily mentioned her mother's illness is affecting her sleep. 
   Follow up next session about coping strategies."
   [Stops recording]
   ```

2. **Note is automatically:**
   - Transcribed
   - Attached to Emily's record
   - Marked as pending
   - Tagged with session ID

### End of Day

1. **View Dashboard Summary**
   - See all pending notes organized by priority
   - Urgent notes displayed prominently
   - Grouped by client for easy review

2. **Review and Action**
   - Mark notes as reviewed
   - Copy important notes to EMR
   - Export summary for records
   - Mark completed notes

3. **Export for Records**
   - Export as Markdown for documentation
   - Copy to clipboard for pasting
   - Save as text file for backup

---

## 🎯 Use Cases

### 1. Session Follow-Ups

**Scenario:** During session, client mentions needing to schedule medical appointment

**Action:**
```
[Record voice note]
"Remind Sarah to schedule cardiology appointment. 
She mentioned chest pain last week."
Priority: High
Type: Follow-up
```

**Result:** Note appears on dashboard, easy to review and act on

---

### 2. Medication Reminders

**Scenario:** Need to follow up on medication adjustment

**Action:**
```
[Record voice note]
"Michael started new SSRI last week. 
Check for side effects and effectiveness next session."
Priority: Normal
Type: Reminder
```

**Result:** Reminder ready for next session preparation

---

### 3. Clinical Observations

**Scenario:** Notice important behavioral change

**Action:**
```
[Record voice note]
"Emily showed significant improvement in affect today. 
More animated, made eye contact, smiled frequently. 
Consider reducing session frequency."
Priority: Normal
Type: Observation
```

**Result:** Documented observation for treatment planning

---

### 4. Urgent Concerns

**Scenario:** Client mentions concerning thoughts

**Action:**
```
[Record voice note]
"John mentioned passive suicidal ideation. 
Denied intent or plan. Scheduled safety check-in for tomorrow. 
Monitor closely."
Priority: Urgent
Type: Follow-up
```

**Result:** Urgent note prominently displayed, immediate action reminder

---

## 📋 Data Structure

### Voice Note Schema

```typescript
interface VoiceNote {
  id: string;
  therapistId: string;
  clientId: string;
  sessionId?: string;
  audioUrl?: string;
  transcription: string;
  noteType: 'follow_up' | 'reminder' | 'observation' | 'general';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'reviewed' | 'completed' | 'archived';
  tags: string[];
  durationSeconds?: number;
  createdAt: Date;
  reviewedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}
```

---

## 🔒 Security & Privacy

### HIPAA Compliance

- ✅ All voice notes encrypted in transit (HTTPS)
- ✅ Access control (therapist-scoped data)
- ✅ Audit logging for all operations
- ✅ Secure audio storage (if implemented)
- ✅ Automatic transcription (no human review)

### Data Protection

- Voice notes only accessible by creating therapist
- Audio files can be stored securely (S3 with encryption)
- Transcriptions stored in database with encryption at rest
- Automatic cleanup of old notes (configurable retention)

---

## ⚙️ Configuration

### Environment Variables

```env
# Required for voice transcription
OPENAI_API_KEY=sk-...

# Optional: Audio storage (S3)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=therapyflow-voice-notes
AWS_REGION=us-east-1

# Optional: Retention policy
VOICE_NOTES_RETENTION_DAYS=90
```

### Database Migration

The voice notes table is automatically created on server startup. Manual migration:

```bash
psql -d therapyflow -f server/migrations/add-voice-notes.sql
```

---

## 📈 Performance

### Transcription Speed

- **Average:** 1-2 seconds for 30-second recording
- **Depends on:** Audio length, API response time
- **Optimization:** Process in background, show loading state

### Caching

- Daily summaries cached for 5 minutes
- Client notes cached on first access
- Cache cleared on new note creation

### Database Indexes

- Therapist ID + Created Date (for daily summaries)
- Client ID (for client-specific queries)
- Status (for pending notes)
- Full-text search on transcription

---

## 🐛 Troubleshooting

### Common Issues

**1. "OpenAI API key not configured"**
- Add `OPENAI_API_KEY` to `.env` file
- Restart server

**2. Transcription fails**
- Check audio format (WAV, MP3, M4A supported)
- Verify audio is not corrupted
- Check OpenAI API usage limits

**3. Notes not appearing in daily summary**
- Verify note status is "pending"
- Check date filter
- Clear cache and retry

**4. Audio upload fails**
- Check file size (max 25MB)
- Verify base64 encoding
- Check network connection

---

## 🎓 Best Practices

### 1. **Be Concise**
- Keep voice notes under 30 seconds
- Focus on actionable items
- Use clear, specific language

### 2. **Use Priority Levels**
- **Urgent:** Immediate action required
- **High:** Important, address within 24 hours
- **Normal:** Standard follow-up
- **Low:** Nice to remember, not critical

### 3. **Tag Appropriately**
- Use consistent tags across notes
- Examples: "medication", "risk", "family", "progress"
- Makes searching and filtering easier

### 4. **Review Daily**
- Check dashboard at end of each day
- Mark notes as reviewed
- Export for documentation
- Complete or archive old notes

### 5. **Maintain Privacy**
- Avoid using full names in recordings
- Don't include sensitive details unnecessarily
- Review transcriptions for accuracy
- Delete audio files after transcription (if desired)

---

## 🚀 Future Enhancements

### Planned Features

1. **Voice Commands**
   - "Mark as urgent"
   - "Tag with medication"
   - "Attach to session"

2. **Smart Suggestions**
   - AI-powered priority detection
   - Automatic tag suggestions
   - Related note recommendations

3. **Integration**
   - SimplePractice sync
   - Calendar reminders
   - Email notifications

4. **Advanced Export**
   - PDF generation
   - Email delivery
   - Scheduled summaries

---

## 📞 Support

### Documentation
- [API Reference](./QUICK_REFERENCE.md)
- [AI Assistant Guide](./AI_ASSISTANT_USER_GUIDE.md)
- [Implementation Details](./IMPLEMENTATION_SUMMARY_2025-12-30.md)

### Issues
- GitHub: [therapyflow-backend/issues](https://github.com/jonathanprocter/therapyflow-backend/issues)
- Email: support@therapyflow.com

---

**Version:** 1.0.0  
**Last Updated:** December 30, 2025  
**Status:** Production Ready

---

*Voice Notes feature designed to help therapists capture important information quickly and review it efficiently at the end of each day.*
