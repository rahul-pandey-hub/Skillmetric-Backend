import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { RegisterCommand } from '../impl/register.command';
import { User } from '../../../users/schemas/user.schema';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async execute(command: RegisterCommand) {
    const { name, email, password, role, studentId } = command;

    // Check if user exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new this.userModel({
      name,
      email,
      password: hashedPassword,
      role,
      studentId,
    });

    await user.save();

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
    };
  }
}
