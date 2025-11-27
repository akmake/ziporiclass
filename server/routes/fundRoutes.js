import express from 'express';
import { getFunds, addFund, refreshAllPrices, sellFund, deleteFund } from '../controllers/fundController.js';

const router = express.Router();

router.route('/')
  .get(getFunds)
  .post(addFund);

router.post('/refresh', refreshAllPrices);
router.post('/:id/sell', sellFund);
router.delete('/:id', deleteFund);

export default router;