import express from 'express';
const router = express.Router();
import * as authCheck from '../controllers/authCheckController.js';

router.get('/auth-check', authCheck.getUserType);

export default router;
