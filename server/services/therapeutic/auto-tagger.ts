import natural from 'natural';
import { sessionTags, sessionInsights, type InsertSessionTag, type InsertSessionInsight } from '@shared/schema-extensions';
import { db } from '../../db';
import { eq } from 'drizzle-orm';

// Simple sentiment analysis fallback
const analyzeSentiment = (text: string) => {
  const positiveWords = ['happy', 'good', 'great', 'excellent', 'positive', 'joy', 'love', 'satisfied'];
  const negativeWords = ['sad', 'bad', 'terrible', 'negative', 'angry', 'hate', 'frustrated', 'depressed'];
  
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });
  
  return { score, comparative: score / words.length };
};
const tokenizer = new natural.WordTokenizer();

interface TagPattern {
  category: string;
  patterns: Record<string, RegExp>;
}

export class AutoTagger {
  private tagPatterns: TagPattern[] = [
    {
      category: 'emotions',
      patterns: {
        anxiety: /\b(anxious|worried|nervous|panic|fear|stressed|overwhelmed)\b/gi,
        depression: /\b(sad|depressed|hopeless|empty|numb|down|blue)\b/gi,
        anger: /\b(angry|frustrated|irritated|mad|furious|annoyed|resentful)\b/gi,
        joy: /\b(happy|joyful|excited|pleased|content|grateful|cheerful)\b/gi,
        grief: /\b(loss|mourning|bereaved|grieving|sorrow)\b/gi,
      }
    },
    {
      category: 'themes',
      patterns: {
        relationships: /\b(partner|spouse|friend|family|mother|father|child|parent|sibling)\b/gi,
        work: /\b(job|work|career|boss|colleague|office|workplace|employment)\b/gi,
        self_esteem: /\b(confidence|worth|value|inadequate|failure|self-image|identity)\b/gi,
        trauma: /\b(trauma|abuse|neglect|ptsd|flashback|trigger|assault)\b/gi,
        boundaries: /\b(boundaries|limits|saying no|assertive|space|autonomy)\b/gi,
        attachment: /\b(attachment|abandonment|connection|intimacy|trust)\b/gi,
      }
    },
    {
      category: 'coping_strategies',
      patterns: {
        mindfulness: /\b(breathing|meditation|present|aware|mindful|grounding)\b/gi,
        exercise: /\b(exercise|workout|walk|run|gym|physical|yoga)\b/gi,
        social_support: /\b(talked to|reached out|support|helped|connected with)\b/gi,
        journaling: /\b(journal|writing|wrote down|diary|reflection)\b/gi,
        therapy_techniques: /\b(cbt|dbt|emdr|thought challenging|reframing)\b/gi,
      }
    },
    {
      category: 'progress_indicators',
      patterns: {
        improvement: /\b(better|improved|progress|easier|managing|coping well)\b/gi,
        struggle: /\b(harder|difficult|struggling|worse|challenge|setback)\b/gi,
        breakthrough: /\b(realized|understood|discovered|insight|aha moment|clarity)\b/gi,
        stability: /\b(stable|consistent|maintaining|steady|balanced)\b/gi,
      }
    }
  ];

  async tagContent(
    content: string,
    sessionId: string,
    clientId: string,
    therapistId: string
  ): Promise<void> {
    const tags = this.extractTags(content);
    const insights = this.extractInsights(content);

    for (const [category, categoryTags] of Object.entries(tags)) {
      if (categoryTags.length > 0) {
        await db.insert(sessionTags).values({
          sessionId,
          category,
          tags: categoryTags,
          confidence: this.calculateConfidence(content, categoryTags),
        } as any);
      }
    }

    for (const insight of insights) {
      await db.insert(sessionInsights).values({
        sessionId,
        clientId,
        therapistId,
        insight: insight.text,
        insightType: insight.type,
        confidence: insight.confidence,
      } as any);
    }
  }

  private extractTags(content: string): Record<string, string[]> {
    const extractedTags: Record<string, string[]> = {};

    for (const { category, patterns } of this.tagPatterns) {
      const categoryTags = new Set<string>();

      for (const [tagName, pattern] of Object.entries(patterns)) {
        // Reset lastIndex to avoid global regex state issues
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
          categoryTags.add(tagName);
        }
      }

      if (categoryTags.size > 0) {
        extractedTags[category] = Array.from(categoryTags);
      }
    }

    extractedTags.custom = this.extractCustomTags(content);
    return extractedTags;
  }

  private extractCustomTags(content: string): string[] {
    const customTags: string[] = [];

    const medPattern = /\b(?:taking|prescribed|medication|started)\s+(\w+(?:\s+\w+)?)/gi;
    const medications = content.match(medPattern) || [];
    medications.forEach(med => {
      const cleanMed = med.replace(/^(taking|prescribed|medication|started)\s+/i, '');
      customTags.push(`medication:${cleanMed.toLowerCase()}`);
    });

    const techniquePattern = /\b(?:tried|using|practicing|learned)\s+(\w+(?:\s+\w+)?)/gi;
    const techniques = content.match(techniquePattern) || [];
    techniques.slice(0, 3).forEach(tech => {
      const cleanTech = tech.replace(/^(tried|using|practicing|learned)\s+/i, '');
      customTags.push(`technique:${cleanTech.toLowerCase()}`);
    });

    return customTags;
  }

  private extractInsights(content: string): Array<{ text: string; type: string; confidence: number }> {
    const insights: Array<{ text: string; type: string; confidence: number }> = [];

    const insightPatterns = [
      { pattern: /I (?:realized|realize) that ([^.!?]+)[.!?]/gi, type: 'realization' },
      { pattern: /I (?:understand|understood) (?:now )?that ([^.!?]+)[.!?]/gi, type: 'understanding' },
      { pattern: /I(?:'ve| have) learned that ([^.!?]+)[.!?]/gi, type: 'learning' },
      { pattern: /The pattern I see is ([^.!?]+)[.!?]/gi, type: 'pattern' },
      { pattern: /I(?:'m| am) noticing that ([^.!?]+)[.!?]/gi, type: 'observation' },
    ];

    for (const { pattern, type } of insightPatterns) {
      // Reset lastIndex before matching
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        insights.push({
          text: match[1].trim(),
          type,
          confidence: 85,
        });
      }
    }

    return insights.slice(0, 5);
  }

  private analyzeSentiment(content: string): number {
    const result = analyzeSentiment(content);
    const maxScore = Math.max(Math.abs(result.score), 1);
    return result.score / maxScore;
  }

  private calculateConfidence(content: string, tags: string[]): number {
    const words = tokenizer.tokenize(content.toLowerCase());
    const wordCount = words.length;

    let matchCount = 0;
    for (const tag of tags) {
      const pattern = new RegExp(`\\b${tag}\\b`, 'gi');
      const matches = content.match(pattern);
      matchCount += matches ? matches.length : 0;
    }

    const confidence = Math.min(Math.round((matchCount / wordCount) * 1000 + 50), 100);
    return confidence;
  }
}

export const autoTagger = new AutoTagger();
