import { handleEffectWithProtocol } from '../effect-handler';
import { protectedProcedure } from '../orpc';
import { createRunUseCase, listRunsUseCase } from '../use-cases/runs';

const runsRouter = {
  create: protectedProcedure.runs.create.handler(
    async ({ context, input, errors }) =>
      handleEffectWithProtocol(
        context.runtime,
        context.user,
        createRunUseCase({ user: context.user, input }),
        errors,
        {
          requestId: context.requestId,
          span: 'api.runs.create',
        },
      ),
  ),

  list: protectedProcedure.runs.list.handler(async ({ context, input, errors }) =>
    handleEffectWithProtocol(
      context.runtime,
      context.user,
      listRunsUseCase({ user: context.user, input }),
      errors,
      {
        requestId: context.requestId,
        span: 'api.runs.list',
      },
    ),
  ),
};

export default runsRouter;
