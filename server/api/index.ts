import { Router } from 'express';
import { projectRouter } from './projects.js';
import { taskRouter } from './tasks.js';
import { ccRouter } from './cc.js';
import { requirementRouter } from './requirements.js';

export const apiRouter = Router();

// Mount sub-routers
apiRouter.use('/projects', projectRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/cc', ccRouter);
apiRouter.use('/requirements', requirementRouter);

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
    },
  });
});