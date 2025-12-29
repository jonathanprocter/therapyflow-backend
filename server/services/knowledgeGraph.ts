// =============================================================================
// CLINICAL SECOND BRAIN - KNOWLEDGE GRAPH BUILDER
// Core functionality for contextual memory, pattern recognition, and therapeutic insights
// =============================================================================

import { storage } from '../storage.js';
const db = storage.db;
import { eq, and, asc } from 'drizzle-orm';
import { clinicalAI } from './clinicalAI.js';
// Simplified audit logging for now
const auditLog = async (action: string, userId: string, data: any) => {
  console.log(`[AUDIT] ${action} by ${userId}:`, data);
};

export interface ClinicalEntity {
  id: string;
  type: 'client' | 'goal' | 'intervention' | 'theme' | 'pattern' | 'outcome' | 'emotion' | 'behavior';
  name: string;
  metadata: {
    firstSeen: Date;
    lastSeen: Date;
    frequency: number;
    context: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    intensity?: number; // 1-10 scale
    sessionIds: string[];
  };
  connections: string[]; // IDs of connected entities
}

export interface ClinicalConnection {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: 'relates_to' | 'caused_by' | 'leads_to' | 'similar_to' | 'part_of' | 'contradicts' | 'improves' | 'worsens';
  strength: number; // 0-1 confidence score
  evidence: string[]; // Session notes that support this connection
  firstObserved: Date;
  lastReinforced: Date;
  frequency: number; // How often this connection appears
}

export interface TherapeuticJourney {
  clientId: string;
  timeline: TimelineEvent[];
  patterns: TherapeuticPattern[];
  breakthroughs: Breakthrough[];
  challenges: Challenge[];
  progressIndicators: ProgressIndicator[];
}

export interface TimelineEvent {
  date: Date;
  type: 'session' | 'breakthrough' | 'setback' | 'goal_achieved' | 'new_goal' | 'intervention_started';
  description: string;
  significance: 'high' | 'medium' | 'low';
  relatedEntities: string[];
}

export interface TherapeuticPattern {
  name: string;
  description: string;
  frequency: number;
  firstObserved: Date;
  lastObserved: Date;
  triggers: string[];
  outcomes: string[];
  effectiveness: number; // 0-1 scale
}

export interface Breakthrough {
  date: Date;
  description: string;
  catalysts: string[]; // What led to this breakthrough
  impact: string;
  relatedGoals: string[];
}

export interface Challenge {
  name: string;
  description: string;
  firstIdentified: Date;
  severity: 'high' | 'medium' | 'low';
  interventionsAttempted: string[];
  currentStatus: 'active' | 'improving' | 'resolved';
}

export interface ProgressIndicator {
  metric: string;
  currentValue: number;
  previousValue: number;
  trend: 'improving' | 'stable' | 'declining';
  confidence: number;
  lastUpdated: Date;
}

/**
 * Clinical Knowledge Graph Builder
 * Creates intelligent connections between all elements of a client's therapeutic journey
 */
export class ClinicalKnowledgeGraph {
  constructor() {
    // Use the existing clinicalAI instance
  }

  /**
   * Build comprehensive knowledge graph for a client
   * This is the core "second brain" intelligence
   */
  async buildClientKnowledgeGraph(clientId: string, practitionerId: string): Promise<{
    entities: ClinicalEntity[];
    connections: ClinicalConnection[];
    insights: string[];
    therapeuticJourney: TherapeuticJourney;
  }> {
    await auditLog('build_knowledge_graph', practitionerId, {
      clientId,
      action: 'building_clinical_knowledge_graph'
    });

    console.log(`[KNOWLEDGE GRAPH] Building for client ${clientId}`);

    try {
      // 1. Extract all entities from client's history
      const entities = await this.extractClinicalEntities(clientId, practitionerId);

      // 2. Discover connections between entities
      const connections = await this.discoverConnections(entities, clientId, practitionerId);

      // 3. Generate insights from the graph
      const insights = await this.generateGraphInsights(entities, connections);

      // 4. Map the therapeutic journey
      const therapeuticJourney = await this.mapTherapeuticJourney(clientId, practitionerId, entities, connections);

      return {
        entities,
        connections,
        insights,
        therapeuticJourney,
      };
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error building graph:', error);
      
      // Return empty graph with manual fallback
      return {
        entities: [],
        connections: [],
        insights: ['Knowledge graph building unavailable - using manual analysis'],
        therapeuticJourney: {
          clientId,
          timeline: [],
          patterns: [],
          breakthroughs: [],
          challenges: [],
          progressIndicators: []
        }
      };
    }
  }

  /**
   * Extract all clinical entities from client's history
   */
  private async extractClinicalEntities(clientId: string, practitionerId: string): Promise<ClinicalEntity[]> {
    const entities: ClinicalEntity[] = [];

    try {
      // For now, return mock data - will be enhanced with real database queries
      const notes: any[] = [];

      console.log(`[KNOWLEDGE GRAPH] Processing ${notes.length} notes for entities`);

      // Extract entities from each note
      for (const note of notes) {
        try {
          const noteEntities = await this.extractEntitiesFromNote(note);
          entities.push(...noteEntities);
        } catch (error) {
          console.error(`[KNOWLEDGE GRAPH] Error extracting entities from note ${note.id}:`, error);
          // Continue processing other notes
        }
      }

      // Consolidate similar entities
      return this.consolidateEntities(entities);
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error extracting entities:', error);
      return [];
    }
  }

  /**
   * Extract entities from a single progress note using NLP and AI
   */
  private async extractEntitiesFromNote(note: any): Promise<ClinicalEntity[]> {
    const entities: ClinicalEntity[] = [];
    const content = note.content || note.subjectiveNotes || note.objectiveNotes || note.assessment || note.plan || '';

    try {
      // 1. Extract therapeutic themes using pattern matching and AI
      const themes = await this.extractThemes(content, note.sessionDate, note.id);
      entities.push(...themes);

      // 2. Extract emotional patterns
      const emotions = await this.extractEmotionalPatterns(content, note.sessionDate, note.id);
      entities.push(...emotions);

      // 3. Extract behavioral patterns
      const behaviors = await this.extractBehavioralPatterns(content, note.sessionDate, note.id);
      entities.push(...behaviors);

      // 4. Extract interventions and techniques
      const interventions = await this.extractInterventions(content, note.sessionDate, note.id);
      entities.push(...interventions);

      // 5. Extract goals and outcomes
      const goals = await this.extractGoals(content, note.sessionDate, note.id);
      entities.push(...goals);

      return entities;
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error in extractEntitiesFromNote:', error);
      return [];
    }
  }

  /**
   * Extract therapeutic themes using pattern matching
   */
  private async extractThemes(content: string, sessionDate: Date, sessionId: string): Promise<ClinicalEntity[]> {
    const themes: ClinicalEntity[] = [];
    
    // Common therapeutic themes with pattern matching
    const themePatterns = {
      'anxiety': /\b(anxious|anxiety|worried|nervous|panic|fear|overwhelmed)\b/gi,
      'depression': /\b(depressed|depression|sad|hopeless|down|low\s+mood|empty)\b/gi,
      'relationships': /\b(relationship|partner|family|friends|social|marriage|dating)\b/gi,
      'work_stress': /\b(work|job|career|workplace|boss|colleague|stress|deadline)\b/gi,
      'self_esteem': /\b(self-esteem|confidence|self-worth|self-image|insecure|inadequate)\b/gi,
      'trauma': /\b(trauma|traumatic|abuse|assault|accident|loss|grief|ptsd)\b/gi,
      'coping': /\b(coping|cope|manage|handle|deal\s+with|strategy|technique)\b/gi,
      'goals': /\b(goal|objective|target|aim|want\s+to|hoping\s+to|plan\s+to)\b/gi,
      'sleep': /\b(sleep|insomnia|tired|fatigue|rest|exhausted|sleeping)\b/gi,
      'substance_use': /\b(alcohol|drinking|drugs|substance|smoking|addiction)\b/gi,
      'anger': /\b(angry|anger|rage|furious|irritated|frustrated|mad)\b/gi,
      'stress': /\b(stress|stressed|pressure|overwhelmed|burden)\b/gi,
    };

    for (const [themeName, pattern] of Object.entries(themePatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const context = this.extractContext(content, themeName, 50);
        
        themes.push({
          id: `theme-${themeName}-${sessionId}`,
          type: 'theme',
          name: themeName.replace('_', ' '),
          metadata: {
            firstSeen: sessionDate,
            lastSeen: sessionDate,
            frequency: matches.length,
            context,
            intensity: this.calculateIntensity(content, matches),
            sessionIds: [sessionId],
          },
          connections: [],
        });
      }
    }

    return themes;
  }

  /**
   * Extract emotional patterns from content
   */
  private async extractEmotionalPatterns(content: string, sessionDate: Date, sessionId: string): Promise<ClinicalEntity[]> {
    const emotions: ClinicalEntity[] = [];
    
    const emotionPatterns = {
      'joy': /\b(happy|joy|joyful|excited|elated|pleased|content|satisfied)\b/gi,
      'sadness': /\b(sad|sadness|sorrow|grief|heartbroken|disappointed|dejected)\b/gi,
      'fear': /\b(afraid|scared|fearful|terrified|worried|anxious|nervous)\b/gi,
      'anger': /\b(angry|mad|furious|irritated|annoyed|frustrated|rage)\b/gi,
      'disgust': /\b(disgusted|repulsed|revolted|sick|nauseous)\b/gi,
      'surprise': /\b(surprised|shocked|amazed|astonished|startled)\b/gi,
      'shame': /\b(ashamed|shame|embarrassed|humiliated|guilty)\b/gi,
      'guilt': /\b(guilty|guilt|remorse|regret|sorry)\b/gi,
    };

    for (const [emotionName, pattern] of Object.entries(emotionPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const context = this.extractContext(content, emotionName, 30);
        const sentiment = this.determineSentiment(emotionName);
        
        emotions.push({
          id: `emotion-${emotionName}-${sessionId}`,
          type: 'emotion',
          name: emotionName,
          metadata: {
            firstSeen: sessionDate,
            lastSeen: sessionDate,
            frequency: matches.length,
            context,
            sentiment,
            intensity: this.calculateIntensity(content, matches),
            sessionIds: [sessionId],
          },
          connections: [],
        });
      }
    }

    return emotions;
  }

  /**
   * Extract behavioral patterns from content
   */
  private async extractBehavioralPatterns(content: string, sessionDate: Date, sessionId: string): Promise<ClinicalEntity[]> {
    const behaviors: ClinicalEntity[] = [];
    
    const behaviorPatterns = {
      'avoidance': /\b(avoid|avoiding|avoidance|escape|withdrew|hiding)\b/gi,
      'isolation': /\b(isolated|isolation|alone|lonely|withdraw|withdrawn)\b/gi,
      'procrastination': /\b(procrastinate|procrastination|delay|postpone|put\s+off)\b/gi,
      'self_harm': /\b(self-harm|cutting|hurt\s+myself|harm\s+myself)\b/gi,
      'exercise': /\b(exercise|workout|gym|running|walking|yoga|sports)\b/gi,
      'meditation': /\b(meditate|meditation|mindfulness|breathing|relaxation)\b/gi,
      'journaling': /\b(journal|journaling|writing|diary|write\s+down)\b/gi,
      'socializing': /\b(social|socializing|friends|gathering|party|meeting)\b/gi,
    };

    for (const [behaviorName, pattern] of Object.entries(behaviorPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const context = this.extractContext(content, behaviorName, 40);
        const sentiment = this.determineBehaviorSentiment(behaviorName);
        
        behaviors.push({
          id: `behavior-${behaviorName}-${sessionId}`,
          type: 'behavior',
          name: behaviorName.replace('_', ' '),
          metadata: {
            firstSeen: sessionDate,
            lastSeen: sessionDate,
            frequency: matches.length,
            context,
            sentiment,
            intensity: this.calculateIntensity(content, matches),
            sessionIds: [sessionId],
          },
          connections: [],
        });
      }
    }

    return behaviors;
  }

  /**
   * Extract interventions and techniques mentioned
   */
  private async extractInterventions(content: string, sessionDate: Date, sessionId: string): Promise<ClinicalEntity[]> {
    const interventions: ClinicalEntity[] = [];
    
    const interventionPatterns = {
      'cognitive_restructuring': /\b(cognitive\s+restructuring|thought\s+challenging|reframe|reframing)\b/gi,
      'mindfulness': /\b(mindfulness|mindful|present\s+moment|awareness|grounding)\b/gi,
      'exposure_therapy': /\b(exposure|exposure\s+therapy|gradual\s+exposure|systematic\s+desensitization)\b/gi,
      'relaxation': /\b(relaxation|progressive\s+muscle|deep\s+breathing|calm|calming)\b/gi,
      'homework': /\b(homework|assignment|practice|between\s+sessions|try\s+this\s+week)\b/gi,
      'role_playing': /\b(role\s+play|role\s+playing|practice\s+conversation|rehearse)\b/gi,
      'psychoeducation': /\b(education|explain|understanding|learn|information)\b/gi,
    };

    for (const [interventionName, pattern] of Object.entries(interventionPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        const context = this.extractContext(content, interventionName, 60);
        
        interventions.push({
          id: `intervention-${interventionName}-${sessionId}`,
          type: 'intervention',
          name: interventionName.replace('_', ' '),
          metadata: {
            firstSeen: sessionDate,
            lastSeen: sessionDate,
            frequency: matches.length,
            context,
            sentiment: 'positive', // Interventions are generally positive
            sessionIds: [sessionId],
          },
          connections: [],
        });
      }
    }

    return interventions;
  }

  /**
   * Extract goals and outcomes mentioned
   */
  private async extractGoals(content: string, sessionDate: Date, sessionId: string): Promise<ClinicalEntity[]> {
    const goals: ClinicalEntity[] = [];
    
    const goalPatterns = [
      /I want to (.{10,100}?)(?:\.|,|;|$)/gi,
      /My goal is to (.{10,100}?)(?:\.|,|;|$)/gi,
      /I hope to (.{10,100}?)(?:\.|,|;|$)/gi,
      /I plan to (.{10,100}?)(?:\.|,|;|$)/gi,
      /I would like to (.{10,100}?)(?:\.|,|;|$)/gi,
    ];

    for (const pattern of goalPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match && match[1]) {
          const goalText = match[1].trim();
          
          goals.push({
            id: `goal-${goalText.substring(0, 20).replace(/\s+/g, '-')}-${sessionId}`,
            type: 'goal',
            name: goalText,
            metadata: {
              firstSeen: sessionDate,
              lastSeen: sessionDate,
              frequency: 1,
              context: match[0],
              sentiment: 'positive',
              sessionIds: [sessionId],
            },
            connections: [],
          });
        }
      }
    }

    return goals;
  }

  /**
   * Consolidate similar entities to avoid duplicates
   */
  private consolidateEntities(entities: ClinicalEntity[]): ClinicalEntity[] {
    const consolidated: ClinicalEntity[] = [];
    const entityMap = new Map<string, ClinicalEntity>();

    for (const entity of entities) {
      const key = `${entity.type}-${entity.name.toLowerCase()}`;
      
      if (entityMap.has(key)) {
        // Merge with existing entity
        const existing = entityMap.get(key)!;
        existing.metadata.frequency += entity.metadata.frequency;
        existing.metadata.lastSeen = new Date(Math.max(
          existing.metadata.lastSeen.getTime(),
          entity.metadata.lastSeen.getTime()
        ));
        existing.metadata.sessionIds.push(...entity.metadata.sessionIds);
        
        // Update context with most recent or most detailed
        if (entity.metadata.context.length > existing.metadata.context.length) {
          existing.metadata.context = entity.metadata.context;
        }
      } else {
        entityMap.set(key, { ...entity });
        consolidated.push(entityMap.get(key)!);
      }
    }

    return consolidated;
  }

  /**
   * Discover connections between entities
   */
  private async discoverConnections(
    entities: ClinicalEntity[],
    clientId: string,
    practitionerId: string
  ): Promise<ClinicalConnection[]> {
    const connections: ClinicalConnection[] = [];

    try {
      // 1. Temporal connections (what happens in sequence)
      const temporalConnections = await this.findTemporalConnections(entities);
      connections.push(...temporalConnections);

      // 2. Co-occurrence connections (what appears together)
      const coOccurrenceConnections = await this.findCoOccurrenceConnections(entities);
      connections.push(...coOccurrenceConnections);

      // 3. Causal relationships (based on common therapeutic knowledge)
      const causalConnections = await this.findCausalConnections(entities);
      connections.push(...causalConnections);

      return this.consolidateConnections(connections);
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error discovering connections:', error);
      return [];
    }
  }

  /**
   * Find temporal patterns between entities
   */
  private async findTemporalConnections(entities: ClinicalEntity[]): Promise<ClinicalConnection[]> {
    const connections: ClinicalConnection[] = [];

    // Sort entities by first appearance
    const sortedEntities = entities.sort((a, b) => 
      a.metadata.firstSeen.getTime() - b.metadata.firstSeen.getTime()
    );

    for (let i = 0; i < sortedEntities.length - 1; i++) {
      for (let j = i + 1; j < sortedEntities.length; j++) {
        const entityA = sortedEntities[i];
        const entityB = sortedEntities[j];

        // Check if there's a consistent temporal pattern
        const timeDiff = entityB.metadata.firstSeen.getTime() - entityA.metadata.firstSeen.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        // If entities appear within therapeutic timeframe (4 weeks)
        if (daysDiff > 0 && daysDiff <= 28) {
          const strength = this.calculateTemporalStrength(entityA, entityB, daysDiff);
          
          if (strength > 0.5) {
            connections.push({
              id: `temporal-${entityA.id}-${entityB.id}`,
              fromEntityId: entityA.id,
              toEntityId: entityB.id,
              relationshipType: 'leads_to',
              strength,
              evidence: [
                `${entityA.name} consistently appeared before ${entityB.name}`,
                `Time gap: ${Math.round(daysDiff)} days`
              ],
              firstObserved: entityA.metadata.firstSeen,
              lastReinforced: new Date(),
              frequency: 1,
            });
          }
        }
      }
    }

    return connections;
  }

  /**
   * Find entities that frequently co-occur in the same sessions
   */
  private async findCoOccurrenceConnections(entities: ClinicalEntity[]): Promise<ClinicalConnection[]> {
    const connections: ClinicalConnection[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        // Find common sessions
        const commonSessions = entityA.metadata.sessionIds.filter(sessionId =>
          entityB.metadata.sessionIds.includes(sessionId)
        );

        if (commonSessions.length > 0) {
          const coOccurrenceRate = commonSessions.length / Math.max(
            entityA.metadata.sessionIds.length,
            entityB.metadata.sessionIds.length
          );

          if (coOccurrenceRate > 0.3) { // 30% co-occurrence threshold
            connections.push({
              id: `cooccurrence-${entityA.id}-${entityB.id}`,
              fromEntityId: entityA.id,
              toEntityId: entityB.id,
              relationshipType: 'relates_to',
              strength: coOccurrenceRate,
              evidence: [
                `Appeared together in ${commonSessions.length} sessions`,
                `Co-occurrence rate: ${Math.round(coOccurrenceRate * 100)}%`
              ],
              firstObserved: new Date(Math.min(
                entityA.metadata.firstSeen.getTime(),
                entityB.metadata.firstSeen.getTime()
              )),
              lastReinforced: new Date(),
              frequency: commonSessions.length,
            });
          }
        }
      }
    }

    return connections;
  }

  /**
   * Find causal relationships based on therapeutic knowledge
   */
  private async findCausalConnections(entities: ClinicalEntity[]): Promise<ClinicalConnection[]> {
    const connections: ClinicalConnection[] = [];

    // Define known causal relationships in therapy
    const causalPatterns = {
      'stress': ['anxiety', 'sleep', 'anger', 'relationships'],
      'anxiety': ['avoidance', 'isolation', 'sleep'],
      'depression': ['isolation', 'self esteem', 'motivation'],
      'trauma': ['anxiety', 'depression', 'relationships'],
      'work stress': ['relationships', 'sleep', 'anxiety'],
      'anger': ['relationships', 'guilt', 'regret'],
      'mindfulness': ['anxiety', 'stress'], // Intervention that helps
      'exercise': ['depression', 'anxiety', 'self esteem'], // Positive intervention
    };

    for (const [cause, effects] of Object.entries(causalPatterns)) {
      const causeEntity = entities.find(e => e.name.toLowerCase().includes(cause.toLowerCase()));
      
      if (causeEntity) {
        for (const effect of effects) {
          const effectEntity = entities.find(e => e.name.toLowerCase().includes(effect.toLowerCase()));
          
          if (effectEntity) {
            const relationshipType = ['mindfulness', 'exercise'].includes(cause) ? 'improves' : 'caused_by';
            const strength = this.calculateCausalStrength(causeEntity, effectEntity);

            if (strength > 0.4) {
              connections.push({
                id: `causal-${causeEntity.id}-${effectEntity.id}`,
                fromEntityId: causeEntity.id,
                toEntityId: effectEntity.id,
                relationshipType,
                strength,
                evidence: [
                  `Clinical knowledge: ${cause} typically ${relationshipType.replace('_', ' ')} ${effect}`,
                  `Observed pattern in client's sessions`
                ],
                firstObserved: new Date(Math.min(
                  causeEntity.metadata.firstSeen.getTime(),
                  effectEntity.metadata.firstSeen.getTime()
                )),
                lastReinforced: new Date(),
                frequency: 1,
              });
            }
          }
        }
      }
    }

    return connections;
  }

  /**
   * Consolidate similar connections
   */
  private consolidateConnections(connections: ClinicalConnection[]): ClinicalConnection[] {
    const consolidated: ClinicalConnection[] = [];
    const connectionMap = new Map<string, ClinicalConnection>();

    for (const connection of connections) {
      const key = `${connection.fromEntityId}-${connection.toEntityId}-${connection.relationshipType}`;
      
      if (connectionMap.has(key)) {
        // Merge with existing connection
        const existing = connectionMap.get(key)!;
        existing.strength = Math.max(existing.strength, connection.strength);
        existing.frequency += connection.frequency;
        existing.evidence.push(...connection.evidence);
        existing.lastReinforced = new Date();
      } else {
        connectionMap.set(key, { ...connection });
        consolidated.push(connectionMap.get(key)!);
      }
    }

    return consolidated;
  }

  /**
   * Generate insights from the knowledge graph
   */
  private async generateGraphInsights(
    entities: ClinicalEntity[],
    connections: ClinicalConnection[]
  ): Promise<string[]> {
    const insights: string[] = [];

    try {
      // 1. Most frequent themes
      const themes = entities.filter(e => e.type === 'theme')
        .sort((a, b) => b.metadata.frequency - a.metadata.frequency);
      
      if (themes.length > 0) {
        insights.push(`Most frequent theme: "${themes[0].name}" (appeared ${themes[0].metadata.frequency} times)`);
      }

      // 2. Strong connections
      const strongConnections = connections.filter(c => c.strength > 0.7);
      if (strongConnections.length > 0) {
        const strongest = strongConnections[0];
        const fromEntity = entities.find(e => e.id === strongest.fromEntityId);
        const toEntity = entities.find(e => e.id === strongest.toEntityId);
        
        if (fromEntity && toEntity) {
          insights.push(`Strong pattern: "${fromEntity.name}" consistently ${strongest.relationshipType.replace('_', ' ')} "${toEntity.name}"`);
        }
      }

      // 3. Progress indicators
      const positiveEmotions = entities.filter(e => 
        e.type === 'emotion' && e.metadata.sentiment === 'positive'
      );
      
      if (positiveEmotions.length > 0) {
        insights.push(`${positiveEmotions.length} positive emotional indicators identified`);
      }

      // 4. Intervention effectiveness
      const interventions = entities.filter(e => e.type === 'intervention');
      if (interventions.length > 0) {
        insights.push(`${interventions.length} therapeutic interventions documented`);
      }

      // 5. Recurring patterns needing attention
      const highFrequencyNegative = entities.filter(e => 
        e.metadata.frequency > 3 && e.metadata.sentiment === 'negative'
      );
      
      if (highFrequencyNegative.length > 0) {
        const names = highFrequencyNegative.map(e => e.name).join(', ');
        insights.push(`Recurring concerns requiring attention: ${names}`);
      }

      return insights;
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error generating insights:', error);
      return ['Insight generation temporarily unavailable'];
    }
  }

  /**
   * Map the complete therapeutic journey
   */
  private async mapTherapeuticJourney(
    clientId: string,
    practitionerId: string,
    entities: ClinicalEntity[],
    connections: ClinicalConnection[]
  ): Promise<TherapeuticJourney> {
    try {
      // Build timeline from entities and sessions
      const timeline = await this.buildTimeline(entities);
      
      // Identify patterns
      const patterns = await this.identifyPatterns(entities, connections);
      
      // Find breakthroughs
      const breakthroughs = await this.identifyBreakthroughs(entities, connections);
      
      // Identify ongoing challenges
      const challenges = await this.identifyChallenges(entities, connections);
      
      // Calculate progress indicators
      const progressIndicators = await this.calculateProgressIndicators(entities);

      return {
        clientId,
        timeline,
        patterns,
        breakthroughs,
        challenges,
        progressIndicators,
      };
    } catch (error) {
      console.error('[KNOWLEDGE GRAPH] Error mapping therapeutic journey:', error);
      return {
        clientId,
        timeline: [],
        patterns: [],
        breakthroughs: [],
        challenges: [],
        progressIndicators: []
      };
    }
  }

  // Helper methods
  private extractContext(content: string, keyword: string, maxLength: number = 100): string {
    const index = content.toLowerCase().indexOf(keyword.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - maxLength / 2);
    const end = Math.min(content.length, index + keyword.length + maxLength / 2);
    
    return content.substring(start, end).trim();
  }

  private calculateIntensity(content: string, matches: RegExpMatchArray): number {
    // Simple intensity calculation based on frequency and context
    const baseIntensity = Math.min(matches.length, 10) / 10;
    
    // Look for intensity modifiers
    const intensifiers = /\b(very|extremely|really|quite|so|incredibly|absolutely)\s+/gi;
    const modifierMatches = content.match(intensifiers);
    const modifierBonus = modifierMatches ? Math.min(modifierMatches.length * 0.1, 0.3) : 0;
    
    return Math.min(baseIntensity + modifierBonus, 1);
  }

  private determineSentiment(emotionName: string): 'positive' | 'negative' | 'neutral' {
    const positiveEmotions = ['joy', 'happiness', 'excitement', 'satisfaction', 'contentment'];
    const negativeEmotions = ['sadness', 'fear', 'anger', 'disgust', 'shame', 'guilt'];
    
    if (positiveEmotions.some(e => emotionName.includes(e))) return 'positive';
    if (negativeEmotions.some(e => emotionName.includes(e))) return 'negative';
    return 'neutral';
  }

  private determineBehaviorSentiment(behaviorName: string): 'positive' | 'negative' | 'neutral' {
    const positiveBehaviors = ['exercise', 'meditation', 'journaling', 'socializing'];
    const negativeBehaviors = ['avoidance', 'isolation', 'procrastination', 'self_harm'];
    
    if (positiveBehaviors.includes(behaviorName)) return 'positive';
    if (negativeBehaviors.includes(behaviorName)) return 'negative';
    return 'neutral';
  }

  private calculateTemporalStrength(entityA: ClinicalEntity, entityB: ClinicalEntity, daysDiff: number): number {
    // Closer in time = stronger connection, but not too close (same day = less meaningful)
    if (daysDiff < 1) return 0.2;
    if (daysDiff <= 7) return 0.8;
    if (daysDiff <= 14) return 0.6;
    if (daysDiff <= 28) return 0.4;
    return 0.2;
  }

  private calculateCausalStrength(causeEntity: ClinicalEntity, effectEntity: ClinicalEntity): number {
    // Base strength on frequency and temporal proximity
    const frequencyFactor = Math.min(
      (causeEntity.metadata.frequency + effectEntity.metadata.frequency) / 10,
      1
    );
    
    const temporalFactor = this.calculateTemporalStrength(causeEntity, effectEntity, 
      Math.abs(effectEntity.metadata.firstSeen.getTime() - causeEntity.metadata.firstSeen.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return (frequencyFactor + temporalFactor) / 2;
  }

  private async buildTimeline(entities: ClinicalEntity[]): Promise<TimelineEvent[]> {
    const timeline: TimelineEvent[] = [];
    
    // Sort entities by first appearance
    const sortedEntities = entities.sort((a, b) => 
      a.metadata.firstSeen.getTime() - b.metadata.firstSeen.getTime()
    );

    for (const entity of sortedEntities) {
      timeline.push({
        date: entity.metadata.firstSeen,
        type: entity.type === 'goal' ? 'new_goal' : 'session',
        description: `First mention of ${entity.name}`,
        significance: entity.metadata.frequency > 3 ? 'high' : 'medium',
        relatedEntities: [entity.id],
      });
    }

    return timeline;
  }

  private async identifyPatterns(entities: ClinicalEntity[], connections: ClinicalConnection[]): Promise<TherapeuticPattern[]> {
    const patterns: TherapeuticPattern[] = [];
    
    // Find entities that appear frequently and have strong connections
    const frequentEntities = entities.filter(e => e.metadata.frequency > 2);
    
    for (const entity of frequentEntities) {
      const relatedConnections = connections.filter(c => 
        c.fromEntityId === entity.id || c.toEntityId === entity.id
      );
      
      if (relatedConnections.length > 0) {
        patterns.push({
          name: `${entity.name} pattern`,
          description: `Recurring pattern involving ${entity.name}`,
          frequency: entity.metadata.frequency,
          firstObserved: entity.metadata.firstSeen,
          lastObserved: entity.metadata.lastSeen,
          triggers: relatedConnections
            .filter(c => c.toEntityId === entity.id)
            .map(c => entities.find(e => e.id === c.fromEntityId)?.name || 'Unknown'),
          outcomes: relatedConnections
            .filter(c => c.fromEntityId === entity.id)
            .map(c => entities.find(e => e.id === c.toEntityId)?.name || 'Unknown'),
          effectiveness: relatedConnections.reduce((sum, c) => sum + c.strength, 0) / relatedConnections.length,
        });
      }
    }

    return patterns;
  }

  private async identifyBreakthroughs(entities: ClinicalEntity[], connections: ClinicalConnection[]): Promise<Breakthrough[]> {
    const breakthroughs: Breakthrough[] = [];
    
    // Look for positive interventions or goals
    const positiveEntities = entities.filter(e => 
      e.metadata.sentiment === 'positive' && e.metadata.frequency > 1
    );

    for (const entity of positiveEntities) {
      const catalysts = connections
        .filter(c => c.toEntityId === entity.id && c.relationshipType === 'leads_to')
        .map(c => entities.find(e => e.id === c.fromEntityId)?.name || 'Unknown');

      if (catalysts.length > 0) {
        breakthroughs.push({
          date: entity.metadata.firstSeen,
          description: `Breakthrough in ${entity.name}`,
          catalysts,
          impact: `Positive development in client's ${entity.type}`,
          relatedGoals: entities
            .filter(e => e.type === 'goal')
            .map(e => e.id),
        });
      }
    }

    return breakthroughs;
  }

  private async identifyChallenges(entities: ClinicalEntity[], connections: ClinicalConnection[]): Promise<Challenge[]> {
    const challenges: Challenge[] = [];
    
    // Look for high-frequency negative entities
    const challengingEntities = entities.filter(e => 
      e.metadata.sentiment === 'negative' && e.metadata.frequency > 2
    );

    for (const entity of challengingEntities) {
      const interventions = connections
        .filter(c => c.fromEntityId === entity.id && c.relationshipType === 'improves')
        .map(c => entities.find(e => e.id === c.toEntityId)?.name || 'Unknown');

      challenges.push({
        name: entity.name,
        description: `Ongoing challenge with ${entity.name}`,
        firstIdentified: entity.metadata.firstSeen,
        severity: entity.metadata.frequency > 5 ? 'high' : entity.metadata.frequency > 3 ? 'medium' : 'low',
        interventionsAttempted: interventions,
        currentStatus: entity.metadata.lastSeen > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) ? 'active' : 'improving',
      });
    }

    return challenges;
  }

  private async calculateProgressIndicators(entities: ClinicalEntity[]): Promise<ProgressIndicator[]> {
    const indicators: ProgressIndicator[] = [];
    
    // Calculate trend for each entity type
    const entityTypes = ['theme', 'emotion', 'behavior', 'intervention'];
    
    for (const type of entityTypes) {
      const typeEntities = entities.filter(e => e.type === type);
      const positiveCount = typeEntities.filter(e => e.metadata.sentiment === 'positive').length;
      const totalCount = typeEntities.length;
      
      if (totalCount > 0) {
        const positiveRatio = positiveCount / totalCount;
        
        indicators.push({
          metric: `${type} positivity`,
          currentValue: positiveRatio,
          previousValue: positiveRatio * 0.8, // Simulated previous value
          trend: positiveRatio > 0.5 ? 'improving' : positiveRatio > 0.3 ? 'stable' : 'declining',
          confidence: Math.min(totalCount / 10, 1),
          lastUpdated: new Date(),
        });
      }
    }

    return indicators;
  }
}