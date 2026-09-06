import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  // Length is the requirement that actually correlates with strength;
  // character-class rules mostly produce predictable substitutions.
  @IsString()
  @MinLength(8)
  password: string;
}
