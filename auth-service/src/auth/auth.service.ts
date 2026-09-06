import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User } from './entities/user.entity';

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async register(input: { email: string; password: string }): Promise<PublicUser> {
    const existing = await this.userRepo.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({ email: input.email, passwordHash });

    let saved: User;
    try {
      saved = await this.userRepo.save(user);
    } catch (err) {
      // The findOne check above and this save aren't atomic, so two
      // concurrent registrations with the same email can both pass the
      // check and race to insert. The loser hits the DB's unique
      // constraint on email (Postgres 23505) — recover by reporting the
      // same conflict the pre-check would have caught, instead of letting
      // the raw DB error escape as an unhandled 500.
      if (err instanceof QueryFailedError && (err as unknown as { code?: string }).code === '23505') {
        throw new ConflictException('An account with that email already exists');
      }
      throw err;
    }

    return { id: saved.id, email: saved.email };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: PublicUser }> {
    const user = await this.userRepo.findOne({ where: { email: input.email } });

    // Identical error for "no such user" and "wrong password" — a distinct
    // message here would let an attacker enumerate registered accounts.
    const invalid = new UnauthorizedException('Invalid email or password');
    if (!user) throw invalid;

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw invalid;

    const secret: jwt.Secret = process.env.JWT_SECRET as string;
    const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      secret,
      { expiresIn },
    );

    return { token, user: { id: user.id, email: user.email } };
  }
}
