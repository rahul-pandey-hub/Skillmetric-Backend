import { CreateQuestionHandler } from './create-question.handler';
import { UpdateQuestionHandler } from './update-question.handler';
import { DeleteQuestionHandler } from './delete-question.handler';

export const CommandHandlers = [
  CreateQuestionHandler,
  UpdateQuestionHandler,
  DeleteQuestionHandler,
];
