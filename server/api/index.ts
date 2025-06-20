import { Router } from 'express';
import { ccRouter } from './cc.js';
import { projectRouter } from './projects.js';
import { requirementRouter } from './requirements.js';
import { taskRouter } from './tasks.js';
import { qualityCheckRouter } from './quality-check.js';
import { executionPhasesRouter } from './execution-phases.js';

export const apiRouter = Router();

// Mount sub-routers
apiRouter.use('/projects', projectRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/cc', ccRouter);
apiRouter.use('/requirements', requirementRouter);
apiRouter.use('/quality-check', qualityCheckRouter);
apiRouter.use('/execution-phases', executionPhasesRouter);

// API root endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'CC Parallel Execution System API',
    version: '1.0.0',
    endpoints: {
      projects: '/api/projects',
      tasks: '/api/tasks',
      cc: '/api/cc',
      requirements: '/api/requirements',
      qualityCheck: '/api/quality-check',
      executionPhases: '/api/execution-phases',
    },
  });
});
