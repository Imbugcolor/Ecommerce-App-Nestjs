import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_AUTH_CALLBACK_URL'),
      scope: ['public_profile'],
    });
  }

  async validate(accessToken: string, _refreshToken: string, profile: Profile) {
    const { username, photos } = profile;

    const user = {
      username,
      picture: photos[0].value,
    };

    return user;
  }
}
