import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Request, Response } from 'express';
import type { CookieOptions } from 'express';
import * as jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, JwtAuthGuard } from '../common/jwt-auth.guard';
import { buildForwardedHeaders } from '../common/request-headers';
import { translateProxyError } from '../common/proxy-error';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || 'http://localhost:3005';

const REQUEST_TIMEOUT_MS = 5000;

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

// Derive the cookie's lifetime from the token's OWN exp claim rather than a
// hardcoded constant. Token lifetime is set by auth-service's JWT_EXPIRES_IN,
// which the gateway never sees — hardcoding an hour meant the two drifted
// silently the moment anyone changed that env var: a longer token left the
// browser dropping a still-valid cookie, a shorter one left a stale cookie
// looking logged-in while every request 401'd.
//
// decode, not verify: this token was just minted by our own auth-service, and
// it is verified for real on every subsequent request by JwtAuthGuard.
function tokenMaxAgeMs(token: string): number {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return DEFAULT_MAX_AGE_MS;
    const remaining = decoded.exp * 1000 - Date.now();
    return remaining > 0 ? remaining : DEFAULT_MAX_AGE_MS;
  } catch {
    return DEFAULT_MAX_AGE_MS;
  }
}

// SameSite=Lax is the CSRF defence: it withholds the cookie on cross-site
// POST, and every state-changing endpoint in this API is a POST. If a
// state-changing GET is ever added, this reasoning breaks and a CSRF token
// becomes necessary.
//
// maxAge is deliberately absent so this same shape serves both setting and
// clearing: clearCookie must match on httpOnly/sameSite/secure/path or the
// browser silently ignores the clear and the user stays logged in.
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

// The gateway — not auth-service — owns the cookie, because the existing
// proxy methods return `res.data` and discard downstream response headers.
// An auth-service-issued Set-Cookie would be silently swallowed here.
@Controller('auth')
export class AuthController {
  constructor(private readonly http: HttpService) {}

  private async forward(
    path: string,
    body: unknown,
    req: Request,
    res: Response,
  ) {
    let downstream;
    try {
      downstream = await firstValueFrom(
        this.http
          .post(`${AUTH_SERVICE_URL}/auth/${path}`, body, {
            headers: buildForwardedHeaders(req.correlationId),
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
      );
    } catch (err) {
      // Without this an AxiosError reaches AllExceptionsFilter, which only
      // recognises HttpException — so a wrong password came back as a blanket
      // 500 and the UI could not tell it apart from an outage.
      throw translateProxyError(err);
    }

    const { token, user } = downstream.data;
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...cookieOptions(),
      maxAge: tokenMaxAgeMs(token),
    });
    // Deliberately omits `token` — putting it in the body would hand JS a
    // readable copy and defeat the point of httpOnly.
    return { user };
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.forward('register', dto, req, res);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.forward('login', dto, req, res);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Stateless tokens — nothing to revoke server-side, so this is purely
    // "stop sending the cookie". Revocation is out of scope for this sprint.
    res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return { user: req.user };
  }
}
