# TherapyFlow AI Assistant - User Guide

## Overview

The TherapyFlow AI Assistant is your intelligent companion for managing your therapy practice. It has comprehensive access to all your client data, session notes, therapeutic insights, and treatment plans, enabling natural conversations about your clients and practice.

---

## 🎯 Key Features

### 1. **Contextual Awareness**
- Knows all your clients and their histories
- Understands treatment plans and goals
- Tracks progress over time
- Remembers conversation context

### 2. **Voice Conversations**
- Real-time voice chat powered by ElevenLabs
- Natural, human-like responses
- Hands-free operation
- Multiple voice options

### 3. **Clinical Support**
- Evidence-based recommendations
- Progress analysis
- Risk assessment
- Treatment planning assistance

### 4. **Documentation Help**
- AI-generated progress notes
- SOAP format support
- Multiple therapeutic frameworks (ACT, DBT, CBT, etc.)
- Quick note drafting

---

## 🚀 Getting Started

### Setup

1. **API Keys Required:**
   ```env
   OPENAI_API_KEY=sk-...          # For GPT-4 and Whisper
   ANTHROPIC_API_KEY=sk-ant-...   # For Claude (optional)
   ELEVENLABS_API_KEY=...         # For voice features
   ```

2. **Add to your `.env` file** and restart the server

3. **Verify Setup:**
   ```bash
   curl http://localhost:5000/api/ai/voices
   ```

### First Conversation

**Example 1: Ask about a client**
```
You: "Tell me about Sarah Johnson's progress this month"

AI: "Sarah Johnson has had 4 sessions this month. Her anxiety 
scores have decreased from 8/10 to 5/10. She's been practicing 
the mindfulness techniques we discussed and reports better sleep..."
```

**Example 2: Get session prep**
```
You: "What should I focus on in my next session with Michael?"

AI: "Based on Michael's recent sessions, I'd suggest:
1. Following up on the conflict with his partner from last week
2. Reviewing his progress on anger management techniques
3. Discussing his upcoming job interview..."
```

---

## 📡 API Endpoints

### Text Chat

**POST /api/ai/chat**

Start or continue a text conversation with the AI assistant.

```bash
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about my clients with anxiety",
    "includeContext": true
  }'
```

**Request:**
```json
{
  "message": "Your question or request",
  "conversationId": "optional-conversation-id",
  "clientId": "optional-client-id",
  "includeContext": true,
  "model": "gpt-4-turbo"
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI response text...",
  "conversationId": "uuid-v4",
  "context": {
    "summary": "Client context summary..."
  }
}
```

---

### Client Context

**GET /api/ai/context/:clientId**

Get comprehensive context about a specific client.

```bash
curl http://localhost:5000/api/ai/context/client-123?daysBack=30
```

**Query Parameters:**
- `includeNotes` (boolean, default: true)
- `includeInsights` (boolean, default: true)
- `includeTreatmentPlan` (boolean, default: true)
- `includeDocuments` (boolean, default: false)
- `daysBack` (integer, default: 90)

**Response:**
```json
{
  "success": true,
  "context": {
    "client": {...},
    "recentSessions": [...],
    "progressNotes": [...],
    "therapeuticInsights": [...],
    "treatmentPlan": {...},
    "summary": "Comprehensive summary..."
  }
}
```

---

### Client Analysis

**POST /api/ai/analyze**

Get AI-powered analysis of client data.

```bash
curl -X POST http://localhost:5000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "analysisType": "progress",
    "daysBack": 90
  }'
```

**Analysis Types:**
- `progress` - Overall progress assessment
- `patterns` - Recurring themes and patterns
- `risk` - Risk assessment and concerns
- `recommendations` - Treatment recommendations

**Response:**
```json
{
  "success": true,
  "analysis": "Detailed AI analysis...",
  "analysisType": "progress",
  "clientId": "client-123",
  "daysBack": 90
}
```

---

### Therapeutic Suggestions

**POST /api/ai/suggest**

Get evidence-based therapeutic suggestions.

```bash
curl -X POST http://localhost:5000/api/ai/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "Client experiencing panic attacks at work",
    "clientId": "client-123"
  }'
```

**Response:**
```json
{
  "success": true,
  "suggestions": "Evidence-based recommendations...",
  "scenario": "Client experiencing panic attacks at work"
}
```

---

### Draft Progress Note

**POST /api/ai/draft-note**

Generate an AI-drafted progress note in SOAP format.

```bash
curl -X POST http://localhost:5000/api/ai/draft-note \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "sessionDate": "2025-12-30",
    "sessionNotes": "Client discussed work stress...",
    "framework": "ACT"
  }'
```

**Supported Frameworks:**
- `ACT` - Acceptance and Commitment Therapy
- `DBT` - Dialectical Behavior Therapy
- `CBT` - Cognitive Behavioral Therapy
- `Narrative` - Narrative Therapy
- `Existential` - Existential Therapy
- `Psychodynamic` - Psychodynamic approaches

**Response:**
```json
{
  "success": true,
  "draftNote": "SOAP formatted progress note...",
  "clientId": "client-123",
  "framework": "ACT"
}
```

---

### Voice Features

#### Text-to-Speech

**POST /api/ai/voice/text-to-speech**

Convert text to natural-sounding speech.

```bash
curl -X POST http://localhost:5000/api/ai/voice/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is your AI assistant",
    "voiceId": "EXAVITQu4vr4xnSDxMaL"
  }' \
  --output audio.mp3
```

**Request:**
```json
{
  "text": "Text to convert to speech",
  "voiceId": "optional-voice-id",
  "model": "eleven_monolingual_v1"
}
```

**Response:** Audio file (audio/mpeg)

---

#### Speech-to-Text

**POST /api/ai/voice/speech-to-text**

Convert audio to text using OpenAI Whisper.

```bash
curl -X POST http://localhost:5000/api/ai/voice/speech-to-text \
  -H "Content-Type: audio/wav" \
  --data-binary @audio.wav
```

**Response:**
```json
{
  "success": true,
  "text": "Transcribed text from audio..."
}
```

---

#### Available Voices

**GET /api/ai/voices**

Get list of available ElevenLabs voices.

```bash
curl http://localhost:5000/api/ai/voices
```

**Response:**
```json
{
  "success": true,
  "voices": [
    {
      "voice_id": "EXAVITQu4vr4xnSDxMaL",
      "name": "Bella",
      "category": "premade",
      "labels": {...}
    },
    ...
  ]
}
```

---

### Search

**POST /api/ai/search**

Search across all client data using full-text search.

```bash
curl -X POST http://localhost:5000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "anxiety coping strategies",
    "includeNotes": true,
    "includeInsights": true,
    "limit": 20
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "progress_note",
      "data": {...}
    },
    {
      "type": "insight",
      "data": {...}
    }
  ],
  "query": "anxiety coping strategies",
  "count": 15
}
```

---

## 🎙️ Real-Time Voice Conversations

### WebSocket Connection

Connect to the voice streaming endpoint for real-time conversations.

**Endpoint:** `ws://localhost:5000/api/ai/voice/stream`

### JavaScript Example

```javascript
const ws = new WebSocket('ws://localhost:5000/api/ai/voice/stream');

// Start conversation
ws.send(JSON.stringify({
  action: 'start',
  therapistId: 'your-therapist-id',
  clientId: 'optional-client-id'
}));

// Send audio chunks
ws.send(audioBuffer);

// Stop and process
ws.send(JSON.stringify({
  action: 'stop'
}));

// Receive responses
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'ready':
      console.log('Ready to receive audio');
      break;
    case 'transcription':
      console.log('You said:', message.data);
      break;
    case 'text':
      console.log('AI response:', message.data);
      break;
    case 'audio':
      // Play audio response
      const audioData = atob(message.data);
      playAudio(audioData);
      break;
  }
};
```

---

## 💡 Use Cases

### 1. Session Preparation

**Ask:**
```
"I have a session with Emily in 10 minutes. What should I know?"
```

**AI provides:**
- Recent session summary
- Current treatment goals
- Unresolved issues
- Suggested focus areas

---

### 2. Progress Tracking

**Ask:**
```
"How is John doing compared to last month?"
```

**AI analyzes:**
- Session attendance
- Alliance scores
- Progress note themes
- Goal achievement

---

### 3. Clinical Decision Support

**Ask:**
```
"My client is showing signs of burnout. What interventions would you recommend?"
```

**AI suggests:**
- Evidence-based interventions
- Relevant therapeutic frameworks
- Self-care strategies
- Resources and referrals

---

### 4. Documentation

**Ask:**
```
"Draft a progress note for today's session with Maria"
```

**AI generates:**
- SOAP formatted note
- Integrated with treatment plan
- Evidence-based interventions
- Professional language

---

### 5. Pattern Recognition

**Ask:**
```
"What patterns do you see across my clients with trauma histories?"
```

**AI identifies:**
- Common themes
- Effective interventions
- Risk factors
- Treatment trends

---

## 🔒 Security & Privacy

### HIPAA Compliance

- All conversations are encrypted
- Data never leaves your infrastructure
- Audit logging enabled
- Session-based authentication required

### Data Access

The AI assistant can access:
- ✅ Client demographics
- ✅ Session notes
- ✅ Progress notes
- ✅ Treatment plans
- ✅ Therapeutic insights
- ✅ Alliance scores
- ✅ Documents (if enabled)

The AI assistant CANNOT:
- ❌ Access other therapists' data
- ❌ Modify data without explicit request
- ❌ Share data externally
- ❌ Store conversations permanently (configurable)

---

## ⚙️ Configuration

### Model Selection

Choose between different AI models based on your needs:

| Model | Best For | Speed | Cost |
|-------|----------|-------|------|
| **GPT-4 Turbo** | General conversations | Fast | Medium |
| **GPT-4** | Complex analysis | Medium | High |
| **Claude 3 Opus** | Clinical documentation | Medium | High |
| **Claude 3 Sonnet** | Quick responses | Fast | Low |

**Default:** GPT-4 Turbo for conversations, Claude 3 Opus for clinical notes

### Voice Settings

Customize voice characteristics:

```json
{
  "voiceId": "EXAVITQu4vr4xnSDxMaL",
  "stability": 0.5,
  "similarityBoost": 0.75,
  "model": "eleven_monolingual_v1"
}
```

- **Stability** (0-1): Lower = more expressive, Higher = more consistent
- **Similarity Boost** (0-1): How closely to match the original voice
- **Model**: Voice synthesis model to use

---

## 🐛 Troubleshooting

### Common Issues

**1. "ElevenLabs not configured"**
- Add `ELEVENLABS_API_KEY` to your `.env` file
- Restart the server

**2. "OpenAI API error"**
- Verify `OPENAI_API_KEY` is correct
- Check API usage limits
- Ensure billing is active

**3. "Client not found or access denied"**
- Verify client ID is correct
- Ensure therapist has access to client
- Check authentication token

**4. Slow responses**
- Enable Redis caching (`REDIS_URL`)
- Reduce `daysBack` parameter
- Use faster models (Claude Sonnet)

**5. Voice quality issues**
- Adjust stability and similarity boost
- Try different voice IDs
- Check audio input quality

---

## 📊 Performance Tips

### 1. Use Caching
```env
REDIS_URL=redis://localhost:6379
```

### 2. Limit Context Size
```json
{
  "daysBack": 30,  // Instead of 90
  "includeDocuments": false
}
```

### 3. Choose Appropriate Models
- Quick questions → Claude Sonnet
- Complex analysis → Claude Opus
- General chat → GPT-4 Turbo

### 4. Batch Requests
- Get context once, use multiple times
- Cache conversation IDs
- Reuse WebSocket connections

---

## 🎓 Best Practices

### 1. **Be Specific**
❌ "Tell me about my clients"
✅ "Tell me about clients with anxiety who haven't shown progress in the last month"

### 2. **Provide Context**
❌ "What should I do?"
✅ "My client with PTSD is avoiding trauma work. What gradual exposure techniques would you recommend?"

### 3. **Review AI Suggestions**
- Always review AI-generated notes before saving
- Use AI suggestions as a starting point
- Apply your clinical judgment

### 4. **Maintain Confidentiality**
- Don't share conversation IDs
- Clear conversation history regularly
- Use secure connections (HTTPS/WSS)

### 5. **Leverage Voice Features**
- Use voice for hands-free session prep
- Record session summaries by voice
- Practice therapeutic responses

---

## 🔄 Workflow Integration

### Morning Routine
```bash
# 1. Get today's schedule
curl http://localhost:5000/api/sessions/today

# 2. Prepare for each session
curl -X POST http://localhost:5000/api/ai/chat \
  -d '{"message": "Prepare me for my 9am session with Emily"}'

# 3. Review insights
curl http://localhost:5000/api/ai/context/emily-id
```

### After Session
```bash
# 1. Draft progress note
curl -X POST http://localhost:5000/api/ai/draft-note \
  -d '{"clientId": "emily-id", "sessionNotes": "..."}'

# 2. Update treatment plan
curl -X POST http://localhost:5000/api/ai/suggest \
  -d '{"scenario": "Client made breakthrough...", "clientId": "emily-id"}'
```

### Weekly Review
```bash
# 1. Analyze client progress
curl -X POST http://localhost:5000/api/ai/analyze \
  -d '{"clientId": "emily-id", "analysisType": "progress", "daysBack": 7}'

# 2. Identify patterns
curl -X POST http://localhost:5000/api/ai/analyze \
  -d '{"clientId": "emily-id", "analysisType": "patterns"}'
```

---

## 📚 Additional Resources

### Documentation
- [API Reference](./AI_ASSISTANT_ARCHITECTURE.md)
- [Implementation Guide](./IMPLEMENTATION_SUMMARY_2025-12-30.md)
- [Quick Reference](./QUICK_REFERENCE.md)

### Support
- GitHub Issues: [therapyflow-backend](https://github.com/jonathanprocter/therapyflow-backend)
- Email: support@therapyflow.com

### Therapeutic Frameworks
The AI is trained on:
- Acceptance and Commitment Therapy (ACT)
- Dialectical Behavior Therapy (DBT)
- Cognitive Behavioral Therapy (CBT)
- Narrative Therapy
- Existential Therapy
- Psychodynamic approaches

---

## 🎉 Getting the Most Out of AI Assistant

### Tips for Success

1. **Start Simple**
   - Begin with basic questions
   - Gradually explore advanced features
   - Build confidence over time

2. **Experiment with Voice**
   - Try different voices
   - Adjust settings to your preference
   - Use for different scenarios

3. **Integrate into Workflow**
   - Use daily for session prep
   - Draft notes immediately after sessions
   - Review weekly progress

4. **Provide Feedback**
   - Note what works well
   - Report issues promptly
   - Suggest improvements

5. **Stay Updated**
   - Check for new features
   - Review documentation updates
   - Attend training sessions

---

**Version:** 1.0.0  
**Last Updated:** December 30, 2025  
**Status:** Production Ready

---

*The TherapyFlow AI Assistant is designed to augment your clinical expertise, not replace it. Always apply your professional judgment and maintain ethical standards in all client interactions.*
