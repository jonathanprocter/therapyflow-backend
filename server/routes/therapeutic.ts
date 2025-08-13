import { Request, Response, Router } from 'express';
import { enhancedStorage } from '../storage-extensions';

const router = Router();

router.post('/synthesize/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, focusTags } = req.body;
    const therapistId = (req as any).user?.id;

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

router.post('/recall/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { query } = req.body;
    const therapistId = (req as any).user?.id;

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

router.get('/insights/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const therapistId = (req as any).user?.id;

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

router.get('/tags/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { category } = req.query;
    const therapistId = (req as any).user?.id;

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
