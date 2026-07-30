import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAccessPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwt.accessSecret')!,
    });
  }

  /** Rezultatul devine `request.user` — vezi `CurrentUser` decorator. */
  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      companyId: payload.companyId,
      roleId: payload.roleId,
      email: payload.email,
    };
  }
}
