import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForgotPasswordUseCase } from "@/applications/useCases/ForgotPasswordUseCase";

describe("ForgotPasswordUseCase", () => {
  it("responds identically whether or not the email has an account", async () => {
    const seen: string[] = [];
    const cognito = {
      forgotPassword: async ({ email }: { email: string }) => {
        seen.push(email);
      },
    };

    const useCase = new ForgotPasswordUseCase(cognito);

    const registered = await useCase.execute({ email: "artur@example.com" });
    const unknown = await useCase.execute({ email: "nobody@example.com" });

    // Byte-identical responses. Any difference — a different message, a
    // different status, even a measurably different latency — is enough to
    // test whether an address is registered.
    assert.deepEqual(registered, unknown);
    assert.equal(registered.success, true);
    assert.match(registered.message, /if that email has an account/i);

    // Both still reached Cognito: the neutral response must not come from
    // skipping the call, or nobody would ever receive a reset code.
    assert.deepEqual(seen, ["artur@example.com", "nobody@example.com"]);
  });
});
