import { Router, type IRouter } from 'express';
import healthRouter from './health.js';
import routesRouter from './routes.js';
import buyersRouter from './buyers.js';
import emailRouter from './email.js';
import modelsRouter from './models.js';
import debugRouter from './debug.js';

const router: IRouter = Router();

router.use(healthRouter);
router.use('/routes', routesRouter);
router.use('/', buyersRouter);        // handles /routes/:id/buyers and /buyers/:id
router.use('/email', emailRouter);
router.use('/', modelsRouter);        // handles /routes/:id/models and /models/:id
router.use('/debug', debugRouter);

export default router;
