import type { CognitoGateway } from "@/infra/gateways/cognito";
import type { GoogleSignInRequest, SignInResponse } from "@/shared/types/auth";

type GoogleCognito = Pick<CognitoGateway, "exchangeAuthorizationCode">;

// Ends with the same tokens as a password sign-in, so the route treats both
// alike: refresh token into the cookie, the rest into the body.
export class SignInWithGoogleUseCase {
  constructor(private cognito: GoogleCognito) {}

  async execute(request: GoogleSignInRequest): Promise<SignInResponse> {
    const tokens = await this.cognito.exchangeAuthorizationCode(request);

    return { success: true, ...tokens };
  }
}
