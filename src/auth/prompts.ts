/**
 * Tiny readline prompts for the `auth login` flow. Matches the codebase
 * convention of using `node:readline` directly rather than pulling in a
 * prompts dependency.
 */
import { createInterface } from "node:readline/promises";
import { CliError } from "../cli-error";

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function promptEmail(): Promise<string> {
  const email = await ask("Email: ");
  if (!email) throw new CliError("Email is required.");
  if (!email.includes("@") || !email.includes(".")) {
    throw new CliError(`"${email}" does not look like a valid email.`);
  }
  return email;
}

export async function promptCode(): Promise<string> {
  const code = await ask("Code: ");
  if (!code) throw new CliError("Code is required.");
  return code;
}
