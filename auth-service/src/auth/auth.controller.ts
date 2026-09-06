import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// Deliberately transport-agnostic: this service returns the JWT as JSON and
// knows nothing about cookies, CSRF or browsers. The gateway owns all of that.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    // Registration auto-authenticates, so the caller gets a token straight
    // away rather than being bounced to a login form.
    const { token } = await this.authService.login(dto);
    return { token, user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
