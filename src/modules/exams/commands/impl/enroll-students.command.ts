import { EnrollStudentsDto } from '../../dto/enroll-students.dto';

export class EnrollStudentsCommand {
  constructor(
    public readonly examId: string,
    public readonly enrollStudentsDto: EnrollStudentsDto,
    public readonly userId: string,
  ) {}
}
