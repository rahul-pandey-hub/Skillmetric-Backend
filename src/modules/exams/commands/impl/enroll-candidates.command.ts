import { EnrollCandidatesDto } from '../../dto/enroll-candidates.dto';

export class EnrollCandidatesCommand {
  constructor(
    public readonly examId: string,
    public readonly enrollCandidatesDto: EnrollCandidatesDto,
    public readonly userId: string,
  ) {}
}
