import { Request, Response, Router } from 'express';
import { enhancedStorage } from "../storage-extensions";
import { verifyClientOwnership, SecureClientQueries } from '../middleware/clientAuth';

const router = Router();

router.post('/synthesize/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, focusTags } = req.body;
    const therapistId = (req as any).user?.id || (req as any).therapistId;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized - therapist ID required' });
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
    const therapistId = (req as any).user?.id || (req as any).therapistId;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized - therapist ID required' });
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
    const therapistId = (req as any).user?.id || (req as any).therapistId;
    const { limit = 10 } = req.query;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized - therapist ID required' });
    }

    // For now, return empty array - would need to implement cross-client insights
    // This would typically aggregate recent insights from all therapist's clients
    const insights: any[] = [];

    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error getting recent insights:', error);
    res.status(500).json({ success: false, error: 'Failed to get recent insights' });
  }
});

router.get('/insights/:clientId', verifyClientOwnership, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const therapistId = (req as any).user?.id || (req as any).therapistId;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized - therapist ID required' });
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
    const therapistId = (req as any).user?.id || (req as any).therapistId;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized - therapist ID required' });
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