import { Request, Response, Router } from 'express';
import { enhancedStorage } from "../storage-extensions.js";
import { verifyClientOwnership, SecureClientQueries } from '../middleware/clientAuth.js';
import { getTherapistIdOrDefault } from '../utils/auth-helpers.js';

const router = Router();

router.post('/synthesize/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, focusTags } = req.body;
    const therapistId = getTherapistIdOrDefault(req);

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const synthesis = await enhancedStorage.synthesizeClientJourney(
      clientId,
      therapistId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        focusTags,
      }
    );

    res.json({ success: true, synthesis });
  } catch (error) {
    console.error('Error synthesizing journey:', error);
    res.status(500).json({ success: false, error: 'Failed to synthesize journey' });
  }
});

router.post('/recall/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { query } = req.body;
    const therapistId = getTherapistIdOrDefault(req);

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const results = await enhancedStorage.quickRecall(
      therapistId,
      clientId,
      query
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in quick recall:', error);
    res.status(500).json({ success: false, error: 'Failed to perform recall' });
  }
});

// Get recent insights across all clients for dashboard widget (must come before parameterized route)
router.get('/insights/recent', async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistIdOrDefault(req);
    const { limit = 10 } = req.query;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get recent insights across all clients for this therapist
    const { sessionInsights } = await import('@shared/schema-extensions.js');
    const { db } = await import('../db.js');
    const { eq, desc } = await import('drizzle-orm');

    const insights = await db
      .select()
      .from(sessionInsights)
      .where(eq(sessionInsights.therapistId, therapistId))
      .orderBy(desc(sessionInsights.createdAt))
      .limit(Number(limit));

    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error getting recent insights:', error);
    res.status(500).json({ success: false, error: 'Failed to get recent insights' });
  }
});

router.get('/insights/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const therapistId = getTherapistIdOrDefault(req);

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const insights = await enhancedStorage.getTherapeuticInsights(clientId);

    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ success: false, error: 'Failed to get insights' });
  }
});

router.get('/tags/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { category } = req.query;
    const therapistId = getTherapistIdOrDefault(req);

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tags = await enhancedStorage.getSessionTags(
      clientId,
      category as string
    );

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, error: 'Failed to get tags' });
  }
});

export default router;