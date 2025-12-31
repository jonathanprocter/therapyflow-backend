# TherapyFlow AI Assistant Architecture

## Overview

The TherapyFlow AI Assistant is a comprehensive, contextually-aware AI system that provides real-time assistance to therapists through both text and voice interfaces. It has full access to the application's data and can engage in natural conversations about clients, sessions, progress notes, and therapeutic insights.

---

## Core Components

### 1. AI Context Manager
**Purpose:** Maintains conversation context and application state awareness

**Features:**
- Session-based conversation memory
- Access to all client data, notes, sessions
- Therapeutic insights and journey synthesis
- Document content and analysis
- Treatment plans and goals
- Real-time data retrieval

### 2. AI Conversation Service
**Purpose:** Handles AI model interactions (OpenAI, Anthropic)

**Features:**
- Multi-model support (GPT-4, Claude)
- Streaming responses
- Function calling for data access
- Context-aware prompting
- Conversation history management

### 3. ElevenLabs Voice Integration
**Purpose:** Real-time voice conversations

**Features:**
- Text-to-speech for AI responses
- Speech-to-text for user input
- Streaming audio support
- Voice selection and customization
- Real-time conversation flow

### 4. AI Assistant API Routes
**Purpose:** RESTful and WebSocket endpoints

**Endpoints:**
- `/api/ai/chat` - Text-based conversations
- `/api/ai/voice/stream` - Real-time voice streaming
- `/api/ai/context/:clientId` - Get client context
- `/api/ai/analyze` - Analyze client data
- `/api/ai/suggest` - Get therapeutic suggestions

---

## Data Access Patterns

### Client Context
```typescript
{
  client: {
    id, name, demographics, status
  },
  recentSessions: [...],
  progressNotes: [...],
  therapeuticInsights: [...],
  treatmentPlan: {...},
  goals: [...],
  allianceScores: [...],
  documents: [...]
}
```

### Conversation Context
```typescript
{
  conversationId: string,
  therapistId: string,
  clientId?: string,
  messages: [
    { role: 'user' | 'assistant', content: string, timestamp: Date }
  ],
  context: {
    currentTopic: string,
    referencedClients: string[],
    referencedSessions: string[],
    referencedDocuments: string[]
  }
}
```

---

## AI Capabilities

### 1. Client Information Retrieval
- Get client demographics and history
- Retrieve session notes and insights
- Access treatment plans and goals
- Review progress over time

### 2. Therapeutic Analysis
- Analyze session patterns
- Identify themes and trends
- Suggest interventions
- Risk assessment

### 3. Documentation Assistance
- Generate progress note drafts
- Summarize sessions
- Create treatment plan updates
- Draft client communications

### 4. Clinical Decision Support
- Evidence-based recommendations
- Diagnostic considerations
- Treatment modality suggestions
- Resource recommendations

### 5. Administrative Support
- Schedule management
- Appointment reminders
- Document organization
- Reporting assistance

---

## Voice Conversation Flow

```
User speaks → Speech-to-Text → AI Processing → Text-to-Speech → User hears
                                      ↓
                              Context Retrieval
                              (Client data, notes, etc.)
```

### Real-time Streaming
1. User speaks into microphone
2. Audio streamed to ElevenLabs STT
3. Text sent to AI model with context
4. AI response generated with data access
5. Response streamed to ElevenLabs TTS
6. Audio played back to user

---

## Security & Privacy

### Access Control
- Therapist authentication required
- Client data scoped to therapist
- Conversation logging for audit
- HIPAA-compliant data handling

### Data Protection
- Encrypted conversations
- No data sent to third parties (except AI providers)
- Conversation history retention policy
- Secure API key management

---

## Implementation Plan

### Phase 1: Context Management
- [x] Design architecture
- [ ] Implement context manager
- [ ] Create data access layer
- [ ] Build conversation memory

### Phase 2: AI Integration
- [ ] OpenAI/Anthropic integration
- [ ] Function calling for data access
- [ ] Streaming response support
- [ ] Context-aware prompting

### Phase 3: Voice Integration
- [ ] ElevenLabs STT integration
- [ ] ElevenLabs TTS integration
- [ ] WebSocket streaming
- [ ] Audio processing pipeline

### Phase 4: API & Routes
- [ ] REST API endpoints
- [ ] WebSocket endpoints
- [ ] Caching layer
- [ ] Rate limiting

### Phase 5: Optimization
- [ ] Response caching
- [ ] Context compression
- [ ] Streaming optimization
- [ ] Performance monitoring

---

## Technology Stack

### AI Models
- **Primary:** OpenAI GPT-4 / GPT-4-turbo
- **Alternative:** Anthropic Claude 3 Opus/Sonnet
- **Voice:** ElevenLabs API

### Backend
- **Framework:** Express.js
- **WebSockets:** ws library
- **Streaming:** Server-Sent Events (SSE)
- **Caching:** Redis

### Database
- **Primary:** PostgreSQL (via Drizzle ORM)
- **Cache:** Redis for conversation history

---

## API Specifications

### Text Chat Endpoint
```typescript
POST /api/ai/chat
{
  message: string,
  conversationId?: string,
  clientId?: string,
  context?: {
    includeNotes?: boolean,
    includeInsights?: boolean,
    includeTreatmentPlan?: boolean
  }
}

Response: {
  response: string,
  conversationId: string,
  context: {...},
  suggestions?: string[]
}
```

### Voice Stream Endpoint
```typescript
WebSocket /api/ai/voice/stream
{
  action: 'start' | 'audio' | 'stop',
  audio?: base64,
  clientId?: string
}

Response: {
  type: 'transcription' | 'response' | 'audio',
  data: string | base64
}
```

### Context Retrieval
```typescript
GET /api/ai/context/:clientId
Response: {
  client: {...},
  recentActivity: [...],
  insights: [...],
  summary: string
}
```

---

## Conversation Examples

### Example 1: Client Overview
**User:** "Tell me about Sarah Johnson's progress this month"

**AI Process:**
1. Identify client: Sarah Johnson
2. Retrieve sessions from past month
3. Get progress notes and insights
4. Analyze trends
5. Generate summary

**AI Response:** "Sarah Johnson has had 4 sessions this month. Her anxiety scores have decreased from 8/10 to 5/10. She's been practicing the mindfulness techniques we discussed and reports better sleep. Her main focus has been work-related stress, and she's made progress in setting boundaries with her supervisor."

### Example 2: Session Preparation
**User:** "What should I focus on in my next session with Michael?"

**AI Process:**
1. Identify client: Michael
2. Review recent sessions and notes
3. Check treatment plan goals
4. Identify unresolved issues
5. Generate recommendations

**AI Response:** "Based on Michael's recent sessions, I'd suggest focusing on: 1) Following up on the conflict with his partner that came up last week, 2) Reviewing his progress on the anger management techniques, and 3) Discussing his upcoming job interview which he mentioned was causing anxiety."

### Example 3: Documentation
**User:** "Draft a progress note for today's session with Emily"

**AI Process:**
1. Identify client and session
2. Retrieve session details
3. Review treatment plan
4. Generate structured note

**AI Response:** "Here's a draft progress note for Emily's session today: [Generates structured note with presenting problem, interventions, client response, plan, and next steps]"

---

## Performance Considerations

### Caching Strategy
- Client context: 5 minutes TTL
- Conversation history: Session-based
- AI responses: Not cached (unique)
- Voice audio: Stream, no cache

### Optimization
- Lazy load full context
- Compress conversation history
- Stream long responses
- Parallel data fetching

### Rate Limiting
- Text chat: 60 requests/minute
- Voice streaming: 10 concurrent sessions
- Context retrieval: 100 requests/minute

---

## Future Enhancements

### Phase 2 Features
- Multi-language support
- Custom voice training
- Proactive suggestions
- Automated scheduling

### Phase 3 Features
- Video call integration
- Screen sharing analysis
- Real-time note taking
- Collaborative AI editing

---

## Success Metrics

### Usage Metrics
- Conversations per day
- Average conversation length
- Voice vs text usage
- Most common queries

### Quality Metrics
- Response accuracy
- User satisfaction
- Time saved
- Error rate

### Performance Metrics
- Response latency
- Streaming quality
- Context retrieval speed
- Cache hit rate

---

**Status:** Architecture Complete  
**Next Step:** Implementation Phase 1  
**Target Completion:** 2-3 days
